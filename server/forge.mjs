import { isEventDelta, mergeEventDelta, TrueForge } from '@truefoundry/trueforge-sdk'
import { loadEnv } from './env.mjs'
import { explainFollowup } from './graph.mjs'
import { startMcp } from './mcp.mjs'
import { readOutbox, writeOutbox } from './outbox.mjs'

loadEnv()

const INSTRUCTIONS = `You write one conference follow-up for Aarsh. Use only facts from the note and from your tools. Never invent an email address or a repository URL.

Order:
1. Call remember_meeting with the person, organization, a topic of at most four words, email (empty string if absent), and whether they offered an introduction.
2. Call explain_followup with the person's name.
3. If the email is missing, stop and say the email is missing. Do not draft and do not call send_email.
4. If they promised a repository and the note has no https URL, stop and say the repository link is missing. Do not draft and do not call send_email.
5. Otherwise call save_draft with a short letter signed "Aarsh". Include the repository URL only if it appeared in the note.
6. Call send_email with that same letter. It will pause for approval. Do not claim the message was delivered.`

let client
let ready = false
let pending = null
let modelName = 'openai/gpt-4o'

function sdk() {
  if (!client) {
    client = new TrueForge({
      baseUrl: process.env.TRUEFORGE_BASE_URL || 'http://localhost:8790',
      timeoutInSeconds: 180,
    })
  }
  return client
}

async function reachable() {
  try {
    const response = await fetch(process.env.TRUEFORGE_BASE_URL || 'http://localhost:8790', {
      signal: AbortSignal.timeout(2000),
    })
    return response.status < 500
  } catch {
    return false
  }
}

function conflict(error) {
  const text = String(error?.statusCode || error?.message || error)
  return text.includes('409') || /conflict|already/i.test(text)
}

async function ensure() {
  if (ready) return
  await startMcp()
  if (!(await reachable())) throw new Error('TrueForge is not running')
  const tf = sdk()
  const listed = await tf.models.list()
  const names = (listed.data?.models || listed.data || []).map((model) => model.name).filter(Boolean)
  const openai = names.find((name) => name.startsWith('openai/'))
  if (openai) {
    modelName = openai
  } else if (process.env.OPENAI_API_KEY) {
    const manifest = {
      type: 'openai',
      auth: { apiKey: process.env.OPENAI_API_KEY },
      models: [{ modelId: 'gpt-4o', name: 'gpt-4o', properties: { contextLength: 128000, maxOutputTokens: 4096 } }],
    }
    try {
      await tf.settings.modelProviders.create({ manifest })
    } catch (error) {
      if (!conflict(error)) await tf.settings.modelProviders.upsert({ manifest })
    }
    modelName = 'openai/gpt-4o'
  } else {
    throw new Error('No OpenAI model is configured')
  }
  await tf.settings.mcpServers.upsert({
    manifest: {
      name: 'afterglow',
      description: 'Conference memory, the follow-up path, and a local outbox.',
      type: 'remote',
      url: 'http://127.0.0.1:8795/mcp',
    },
  })
  ready = true
}

function callsFrom(events) {
  const calls = []
  for (const event of events.values()) {
    if (event?.type !== 'model.message' || !Array.isArray(event.toolCalls)) continue
    for (const call of event.toolCalls) {
      let args = {}
      try {
        args = JSON.parse(call.function?.arguments || '{}')
      } catch {
        args = {}
      }
      calls.push({
        id: call.id,
        name: call.toolInfo?.name || call.function?.name,
        args,
      })
    }
  }
  return calls
}

async function readTurn(sessionId, input) {
  const events = new Map()
  const approvals = []
  const stream = await sdk().sessions.createTurnStream(sessionId, { input })
  for await (const item of stream.withMetadata()) {
    const event = item.data
    if (isEventDelta(event)) {
      const base = events.get(event.id)
      if (base) mergeEventDelta(base, event)
    } else {
      events.set(event.id, event)
    }
    if (event.type === 'tool.approval_required') approvals.push(event)
    if (event.type === 'turn.done') break
  }
  return { events, approvals, calls: callsFrom(events) }
}

function messageText(events) {
  return [...events.values()]
    .filter((event) => event.type === 'model.message')
    .map((event) => {
      const content = event.content
      if (typeof content === 'string') return content
      if (Array.isArray(content)) return content.map((part) => part.text || '').join('')
      return ''
    })
    .join('\n')
    .trim()
}

export async function transcribeAudio(buffer, mime) {
  const base = (process.env.TRUEFORGE_GATEWAY_URL || '').replace(/\/$/, '')
  const token = process.env.TRUEFORGE_ACCESS_TOKEN
  const model = process.env.TRUEFORGE_TRANSCRIBE_MODEL || 'openai/whisper-1'
  if (!base || !token) throw new Error('Transcription is not configured.')
  if (!buffer?.length) throw new Error('The recording was empty.')
  const form = new FormData()
  form.append('model', model)
  form.append('file', new Blob([buffer], { type: mime || 'audio/webm' }), 'speech.webm')
  const response = await fetch(`${base}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'X-TFY-METADATA': '{}',
      'X-TFY-LOGGING-CONFIG': '{"enabled": true}',
    },
    body: form,
    signal: AbortSignal.timeout(30000),
  })
  const data = await response.json().catch(() => ({}))
  const text = typeof data?.text === 'string' ? data.text.trim() : ''
  if (!response.ok || !text) {
    const detail = data?.error?.message || data?.error
    throw new Error(typeof detail === 'string' && detail ? detail : 'Transcription did not return words.')
  }
  return text
}

export async function phraseFacts(sentence) {
  const base = (process.env.TRUEFORGE_GATEWAY_URL || '').replace(/\/$/, '')
  const token = process.env.TRUEFORGE_ACCESS_TOKEN
  const model = process.env.TRUEFORGE_MODEL || 'openai/gpt-5.6-luna'
  if (!base || !token) return sentence
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'X-TFY-METADATA': '{}',
        'X-TFY-LOGGING-CONFIG': '{"enabled": true}',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Answer in one or two sentences using only the facts you are given. Do not invent people, companies, or promises. Do not send email.',
          },
          { role: 'user', content: sentence },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) return sentence
    const data = await response.json()
    const text = data.choices?.[0]?.message?.content
    return typeof text === 'string' && text.trim() ? text.trim() : sentence
  } catch {
    return sentence
  }
}

export async function forgeStatus() {
  return {
    running: await reachable(),
    pendingSend: Boolean(pending),
    baseUrl: process.env.TRUEFORGE_BASE_URL || 'http://localhost:8790',
  }
}

export async function followup({ note }) {
  await ensure()
  const { data: session } = await sdk().sessions.create({
    agent: {
      spec: {
        model: { name: modelName },
        instructions: INSTRUCTIONS,
        mcpServers: [
          {
            name: 'afterglow',
            enableTools: ['remember_meeting', 'explain_followup', 'save_draft', 'send_email'],
            preload: true,
            requireApprovalForTools: ['send_email'],
          },
        ],
        config: {
          dynamicSubAgents: { enabled: false },
          askUserQuestions: { enabled: false },
          generativeUi: { enabled: false },
          sandbox: { enabled: false },
          iterationLimit: 8,
        },
      },
    },
  })
  const turn = await readTurn(session.id, [{ type: 'user.message', content: note }])
  const remembered = turn.calls.find((call) => call.name === 'remember_meeting')?.args
  const draft = turn.calls.find((call) => call.name === 'save_draft')?.args
  const send = turn.calls.find((call) => call.name === 'send_email')
  const name = remembered?.name
  const path = name ? await explainFollowup(name) : null
  const approval = turn.approvals.find((item) =>
    item.toolCalls?.some((ref) => turn.calls.find((call) => call.id === ref.id)?.name === 'send_email'),
  )
  if (approval && send) {
    pending = {
      sessionId: session.id,
      approvals: approval.toolCalls
        .filter((ref) => turn.calls.find((call) => call.id === ref.id)?.name === 'send_email')
        .map((ref) => ({ threadId: approval.threadId, toolCallId: ref.id })),
    }
  } else {
    pending = null
  }
  const text = messageText(turn.events)
  let clarify = null
  if (!remembered?.email) clarify = 'email'
  else if (!draft?.body && /repositor|repo link|missing/i.test(text)) clarify = 'repo'
  return {
    source: 'trueforge',
    waiting: Boolean(pending),
    clarify,
    name: remembered?.name || '',
    org: remembered?.org || '',
    email: remembered?.email || '',
    topic: remembered?.topic || '',
    intro: Boolean(remembered?.intro),
    subject: draft?.subject || send?.args?.subject || '',
    body: draft?.body || send?.args?.body || '',
    chain: path?.chain || '',
    raw: path?.raw || '',
  }
}

export async function approveSend(body) {
  if (!pending) {
    const record = writeOutbox({
      to: body.email,
      subject: body.subject,
      body: body.body,
      mode: body.mode,
      provider: null,
    })
    return { approved: true, provider: null, outbox: record, resumed: false }
  }
  const current = pending
  pending = null
  const before = readOutbox().length
  await readTurn(
    current.sessionId,
    current.approvals.map((item) => ({
      type: 'user.tool_approval',
      threadId: item.threadId,
      toolCallId: item.toolCallId,
      approval: { status: 'allow' },
    })),
  )
  const records = readOutbox()
  const record =
    records.length > before
      ? records[records.length - 1]
      : writeOutbox({
          to: body.email,
          subject: body.subject,
          body: body.body,
          mode: body.mode,
          provider: null,
        })
  return { approved: true, provider: null, outbox: record, resumed: true }
}

export async function denySend() {
  if (!pending) return { approved: false, sent: false }
  const current = pending
  pending = null
  await readTurn(
    current.sessionId,
    current.approvals.map((item) => ({
      type: 'user.tool_approval',
      threadId: item.threadId,
      toolCallId: item.toolCallId,
      approval: { status: 'deny', reason: 'denied by user' },
    })),
  )
  return { approved: false, sent: false }
}
