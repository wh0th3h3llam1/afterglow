import { useSyncExternalStore } from 'react'
import { statusWord } from '../hall/machine'
import type { Session } from '../hall/types'

export const AGENTS = ['Listen', 'Search', 'Day', 'Draft', 'Graph'] as const
export type AgentName = (typeof AGENTS)[number]

export type AgentJob = {
  id: number
  agent: AgentName
  status: 'running' | 'done' | 'failed'
  detail: string
}

export type VoiceIntent =
  | { kind: 'search'; query: string }
  | { kind: 'day' }
  | { kind: 'followup'; name: string; note: string }

export type HallCommand =
  | { nonce: number; kind: 'search'; query: string }
  | { nonce: number; kind: 'show'; query: string; sentence: string }
  | { nonce: number; kind: 'fill'; query: string }

type Listener = () => void

let jobs: AgentJob[] = []
let nextId = 1
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function startAgent(agent: AgentName, detail: string) {
  const job: AgentJob = { id: nextId++, agent, status: 'running', detail }
  jobs = [job, ...jobs].slice(0, 12)
  emit()
  return job.id
}

export function finishAgent(id: number, detail: string, failed = false) {
  jobs = jobs.map((job) =>
    job.id === id ? { ...job, status: failed ? 'failed' : 'done', detail } : job,
  )
  emit()
}

export function useAgents() {
  return useSyncExternalStore(subscribe, () => jobs, () => jobs)
}

export function classifyVoice(text: string): VoiceIntent {
  const raw = text.trim()
  const follow = raw.match(/^(?:please\s+)?follow\s*up\s+(?:with\s+)?(.+)$/i)
  if (follow) {
    const rest = follow[1]
    const name = rest.split(/\s+about\s+/i)[0].replace(/[.,!?]$/, '').trim()
    return { kind: 'followup', name, note: raw }
  }
  const search = raw.match(/^(?:please\s+)?(?:search(?:\s+for)?|find|who\s+is|who's|who\s+are)\s+(.+)$/i)
  if (search) return { kind: 'search', query: search[1].replace(/[?.!]$/, '').trim() }
  if (/\b(summarize|summarise|summary|my day)\b/i.test(raw)) return { kind: 'day' }
  return { kind: 'search', query: raw.replace(/[?.!]$/, '').trim() }
}

export function matchPeople(name: string, sessions: Session[]) {
  const needle = name.trim().toLowerCase()
  const people = sessions.filter((item) => item.id !== 'new')
  if (!needle) return []
  const named = people.filter((item) => item.name.toLowerCase() === needle)
  if (named.length) return named
  const affiliated = people.filter((item) => {
    const pair = `${item.name} from ${item.org}`.toLowerCase()
    const org = `${item.name} ${item.org}`.toLowerCase()
    return pair === needle || org === needle
  })
  if (affiliated.length) return affiliated
  return people.filter((item) => item.name.toLowerCase().includes(needle))
}

export function parseMeet(note: string) {
  const met = note.match(/\bmet\s+([A-Za-z][\w'-]*)(?:\s+from\s+([^,.]+))?/i)
  const name = met?.[1] ? met[1][0].toUpperCase() + met[1].slice(1) : ''
  const org = met?.[2]?.trim() || ''
  const email = note.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0] || ''
  return {
    name,
    org,
    email,
    topic: 'A conversation',
    subject: name ? `Following up with ${name}` : '',
    body: name ? `Hey ${name},\n\n${note}\n\nAarsh` : '',
  }
}

export function daySummary(sessions: Session[], eventId: string) {
  const people = sessions.filter((item) => item.id !== 'new' && (item.conferenceId || 'patch') === eventId)
  if (!people.length) return 'No meetings are on this conference yet.'
  return people
    .map((item) => `${item.name} at ${item.org || 'an unnamed company'}, ${item.topic}. ${statusWord(item)}.`)
    .join(' ')
}

export async function runSearch(question: string) {
  const job = startAgent('Search', question)
  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    })
    const data = await response.json()
    const sentence = typeof data?.sentence === 'string' && data.sentence ? data.sentence : 'Nothing matched that question.'
    finishAgent(job, sentence, !response.ok)
    return {
      sentence,
      people: Array.isArray(data?.people) ? data.people : [],
      qodo: typeof data?.qodo === 'string' ? data.qodo : '',
    }
  } catch {
    finishAgent(job, 'The graph did not answer.', true)
    return { sentence: 'The graph did not answer.', people: [], qodo: '' }
  }
}
