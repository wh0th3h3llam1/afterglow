import { useEffect, useReducer, useState } from 'react'
import { applyParams, hydrate, initialState, reduce, serialize, STORAGE_KEY, writeQuery } from './hall/machine'
import type { HallState } from './hall/types'
import { Hall, webglOk } from './scene/Hall'
import { Desk } from './ui/Desk'
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
        dispatch({ type: 'apply-followup', now, ...data })
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return
        dispatch({ type: 'finish-processing', now })
      })
    return () => controller.abort()
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
    fetch('/api/meetings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = response.ok ? await response.json() : null
        if (data?.chain && data?.raw) {
          dispatch({ type: 'set-path', chain: data.chain, raw: data.raw, nodes: data.nodes, edges: data.edges })
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [session.id, session.name, session.org, session.topic, session.email, session.phase])

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
      <Desk state={state} dispatch={dispatch} narrow={narrow} renderer={renderer} />
    </>
  )
}
