import { useEffect, useReducer, useRef, useState } from 'react'
import { applyParams, hydrate, initialState, reduce, serialize, STORAGE_KEY, writeQuery } from './hall/machine'
import type { HallState } from './hall/types'
import { Hall, webglOk } from './scene/Hall'
import { finishAgent, startAgent, type HallCommand } from './ui/agents'
import { Desk } from './ui/Desk'
import { GraphPage } from './ui/GraphPage'
import { Landing } from './ui/Landing'
import { useNarrow, useReducedMotion, useReducedTransparency } from './ui/media'

function boot(): HallState {
  const stored = sessionStorage.getItem(STORAGE_KEY)
  if (stored) {
    const parsed = hydrate(stored)
    if (parsed) return parsed
  }
  return applyParams(initialState(), new URLSearchParams(window.location.search))
}

export function App() {
  const [state, dispatch] = useReducer(reduce, undefined, boot)
  const [renderer, setRenderer] = useState<'webgl' | 'css'>(() => (webglOk() ? 'webgl' : 'css'))
  const reduceMotion = useReducedMotion()
  const flat = useReducedTransparency()
  const narrow = useNarrow()
  const session = state.sessions[state.activeId]
  const [page, setPage] = useState(() => (window.location.hash === '#graph' ? 'graph' : 'hall'))
  const [command, setCommand] = useState<HallCommand | null>(null)
  const commandNonce = useRef(0)

  function onTranscript(text: string) {
    if (window.location.hash === '#graph') window.location.hash = '#hall'
    setCommand({ nonce: ++commandNonce.current, kind: 'fill', query: text })
  }

  useEffect(() => {
    const sync = () => setPage(window.location.hash === '#graph' ? 'graph' : 'hall')
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, serialize(state))
    const url = new URL(window.location.href)
    url.search = writeQuery(state)
    window.history.replaceState(null, '', url)
  }, [state])

  useEffect(() => {
    if (session.phase !== 'processing') return
    const controller = new AbortController()
    const now = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date())
    const job = startAgent('Draft', `Drafting a letter for ${session.name}`)
    let settled = false
    const settle = (detail: string, failed = false) => {
      if (settled) return
      settled = true
      finishAgent(job, detail, failed)
    }
    fetch('/api/followup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note: session.note, mode: state.mode }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('followup failed')
        const data = await response.json()
        if (!data?.name) throw new Error('followup empty')
        settle(`Letter drafted for ${data.name}`)
        dispatch({ type: 'apply-followup', now, ...data })
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return
        settle('The draft did not finish.', true)
        dispatch({ type: 'finish-processing', now })
      })
    return () => {
      controller.abort()
      settle('Stopped.', true)
    }
  }, [session.phase, session.id])

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (session.phase === 'empty' && session.note.trim() !== '') event.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [session.phase, session.note])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dispatch({ type: 'close-panel' })
        return
      }
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      if (event.key === 'ArrowRight') dispatch({ type: 'step', dir: 1 })
      if (event.key === 'ArrowLeft') dispatch({ type: 'step', dir: -1 })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    document.title = session.subject ? `${session.subject} · Afterglow` : 'Afterglow'
  }, [session.subject])

  useEffect(() => {
    if (session.phase === 'empty' || session.phase === 'processing' || session.name === 'New badge') return
    const controller = new AbortController()
    const body = JSON.stringify({
      id: session.id,
      name: session.name,
      org: session.org,
      topic: session.topic,
      email: session.email,
      intro: session.promises.some((item) => item.id === 'intro'),
    })
    const job = startAgent('Graph', `Saving ${session.name} to the graph`)
    let settled = false
    const settle = (detail: string, failed = false) => {
      if (settled) return
      settled = true
      finishAgent(job, detail, failed)
    }
    fetch('/api/meetings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = response.ok ? await response.json() : null
        if (data?.chain && data?.raw) {
          settle(`Saved ${session.name} on the graph.`)
          dispatch({ type: 'set-path', chain: data.chain, raw: data.raw, nodes: data.nodes, edges: data.edges })
          return
        }
        settle(response.ok ? `Saved ${session.name} on the graph.` : 'The graph did not save this meeting.', !response.ok)
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return
        settle('The graph did not save this meeting.', true)
      })
    return () => {
      controller.abort()
      settle('Stopped.', true)
    }
  }, [session.id, session.name, session.org, session.topic, session.email, session.phase])

  if (page === 'graph') return <GraphPage onText={onTranscript} />
  if (!state.entered) return <Landing dispatch={dispatch} />

  return (
    <>
      <Hall
        state={state}
        reduce={reduceMotion}
        flat={flat}
        narrow={narrow}
        renderer={renderer}
        onFallback={() => setRenderer('css')}
        onSelect={(id) => dispatch({ type: 'select', id, toggle: true })}
      />
      <Desk
        state={state}
        dispatch={dispatch}
        narrow={narrow}
        renderer={renderer}
        command={command}
      />
    </>
  )
}
