import { useEffect, useId, useRef, useState, type Dispatch, type FormEvent } from 'react'
import gsap from 'gsap'
import { EVENTS } from '../hall/fixtures'
import { footerLine, pathView, promiseView, statusWord, visibleIds } from '../hall/machine'
import { AgentNotice } from './AgentNotice'
import { runSearch, type HallCommand } from './agents'
import { Mark } from './Mark'
import { PathGraph } from './PathGraph'
import { VoiceButton } from './VoiceButton'
import type { Action, HallState, Mode, Session } from '../hall/types'

function Words({ text, version }: { text: string; version: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const words = root.querySelectorAll('span')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      gsap.set(words, { opacity: 1 })
      return
    }
    const tween = gsap.fromTo(
      words,
      { opacity: 0.15 },
      { opacity: 1, duration: 0.35, stagger: 0.028, ease: 'power1.out' },
    )
    return () => {
      tween.kill()
    }
  }, [text, version])

  const lines = text.split('\n')
  return (
    <div ref={ref} className="letter-body">
      {lines.map((line, lineIndex) => (
        <p key={`${lineIndex}-${line}`}>
          {line.split(/(\s+)/).map((part, index) =>
            part.trim() === '' ? (
              part
            ) : (
              <span key={`${lineIndex}-${index}`}>{part}</span>
            ),
          )}
        </p>
      ))}
    </div>
  )
}

function clipLabel(session: Session, mode: Mode) {
  if (mode === 'replay') return 'Replay'
  if (session.awaitingSend) return 'Waiting for your OK'
  if (session.delivery === 'sent') return 'Sent'
  if (session.delivery === 'proof') return 'Proof'
  if (session.delivery === 'failed') return 'Not sent'
  if (session.delivery === 'uncertain') return 'Uncertain'
  if (session.phase === 'skipped') return 'Skipped'
  if (session.name === 'New badge') return 'Blank badge'
  return session.org ? `${session.name} · ${session.org}` : session.name
}

function promiseLabel(view: ReturnType<typeof promiseView>) {
  if (view === 'kept') return 'Kept'
  if (view === 'in-letter') return 'In this letter'
  return 'Open'
}

export function Desk({
  state,
  dispatch,
  narrow,
  renderer,
  command,
  onTranscript,
}: {
  state: HallState
  dispatch: Dispatch<Action>
  narrow: boolean
  renderer: 'webgl' | 'css'
  command: HallCommand | null
  onTranscript: (text: string) => void
}) {
  const session = state.sessions[state.activeId]
  const path = pathView(session)
  const [editing, setEditing] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<{ sentence: string; people: Array<string | { id?: string; name: string }>; qodo?: string } | null>(null)
  const [asking, setAsking] = useState(false)
  const [owes, setOwes] = useState<string[] | null>(null)
  const showActions = session.phase === 'draft' || session.phase === 'review'
  useEffect(() => {
    if (!command) return
    if (command.kind === 'show') {
      setQuestion(command.query)
      setAnswer({ sentence: command.sentence, people: [] })
      return
    }
    const text = command.query.trim()
    setQuestion(text)
    if (!text) return
    setAsking(true)
    void runSearch(text)
      .then((data) => setAnswer(data))
      .finally(() => setAsking(false))
  }, [command])
  useEffect(() => {
    setEditing(false)
  }, [session.id, session.version])
  const disconnected = state.connection === 'disconnected'
  useEffect(() => {
    if (!state.activityOpen) return
    const controller = new AbortController()
    fetch('/api/owes', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setOwes(Array.isArray(data?.owes) ? data.owes : null))
      .catch(() => setOwes(null))
    return () => controller.abort()
  }, [state.activityOpen, session.delivery, session.id])
  const errorId = useId()

  useEffect(() => {
    if (!session.error) return
    const field =
      session.phase === 'clarify'
        ? session.clarify === 'email'
          ? 'email'
          : 'repo'
        : session.panel === 'tweak'
          ? 'tweak'
          : 'note'
    document.getElementById(field)?.focus()
  }, [session.error, session.phase, session.clarify, session.panel])

  useEffect(() => {
    if (session.phase !== 'clarify') return
    if (window.matchMedia('(pointer: coarse)').matches) return
    document.getElementById(session.clarify === 'email' ? 'email' : 'repo')?.focus()
  }, [session.phase, session.clarify, session.id])

  useEffect(() => {
    const stamp = document.querySelector('.stamp')
    if (!stamp) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const tween = gsap.fromTo(stamp, { scale: 1.35, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.28, ease: 'power4.in' })
    return () => {
      tween.kill()
    }
  }, [session.delivery, session.id])

  const needle = question.trim().toLowerCase()
  const matches = needle
    ? Object.values(state.sessions).filter((item) => {
        if (item.id === 'new') return false
        return `${item.name} ${item.org} ${item.conference || ''} ${item.venue || ''}`.toLowerCase().includes(needle)
      })
    : []

  return (
    <>
      <a className="skip" href="#face">
        Skip to letter
      </a>
      <div className="grain" aria-hidden="true" />
      <header className="topbar">
        <p className="brand">
          <Mark />
          Afterglow
        </p>
        <label className="event-select">
          <span className="sr">Conference</span>
          <select
            aria-label="Conference"
            value={state.eventId}
            onChange={(event) => dispatch({ type: 'set-event', id: event.target.value })}
          >
            {EVENTS.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </label>
        <form
          className="top-search"
          onSubmit={(event) => {
            event.preventDefault()
            const text = question.trim()
            if (!text || asking) return
            setAsking(true)
            void runSearch(text)
              .then((data) => setAnswer(data))
              .finally(() => setAsking(false))
          }}
        >
          <label className="sr" htmlFor="ask">
            Search people
          </label>
          <input
            id="ask"
            name="ask"
            value={question}
            placeholder="Search a name"
            autoComplete="off"
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button className="fill" type="submit" disabled={asking || question.trim() === ''}>
            {asking ? 'Searching' : 'Search'}
          </button>
          {(matches.length > 0 || answer) && (
            <div className="search-panel">
              {matches.length > 0 && (
                <ul>
                  {matches.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => dispatch({ type: 'select', id: item.id })}>
                        <span className="search-name">{item.name}</span>
                        <span className="search-meta">
                          {item.org}
                          {item.conference ? ` · ${item.conference}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {answer && (
                <p className="search-answer">
                  {answer.sentence}
                  {answer.qodo ? ` ${answer.qodo}.` : ''}
                </p>
              )}
            </div>
          )}
        </form>
        <div className="top-tools">
          <VoiceButton onTranscript={onTranscript} />
          <AgentNotice />
          <a className="nav-link" href="#graph">
            Graph
          </a>
        </div>
      </header>

      <nav className="hall-nav" aria-label="Badges">
        <button type="button" onClick={() => dispatch({ type: 'step', dir: -1 })}>
          Previous
        </button>
        <button type="button" onClick={() => dispatch({ type: 'step', dir: 1 })}>
          Next
        </button>
      </nav>

      <main className="desk" data-chat={state.chatOpen ? 'true' : 'false'} data-actions={showActions ? 'true' : 'false'}>
        <button
          type="button"
          className="chat-tab"
          aria-expanded={Boolean(state.chatOpen)}
          aria-controls="dock"
          onClick={() => dispatch({ type: 'toggle-chat' })}
        >
          {state.chatOpen ? 'Hide letter' : session.name === 'New badge' ? 'Open letter' : session.name}
        </button>
        <div className="dock" id="dock" data-phase={session.phase} inert={state.chatOpen ? undefined : true} aria-hidden={state.chatOpen ? undefined : true}>
        <section className="slab" aria-labelledby="capture-label">
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault()
              dispatch({ type: 'submit-note' })
            }}
          >
            <label id="capture-label" htmlFor="note">
              Who did you meet?
            </label>
            <textarea
              id="note"
              name="note"
              value={session.note}
              readOnly={session.phase === 'processing'}
              placeholder="Priya from Nimbus, after the agent talk…"
              autoComplete="off"
              autoFocus={session.phase === 'empty' && !narrow && Boolean(state.chatOpen)}
              onChange={(event) => dispatch({ type: 'type-note', note: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  dispatch({ type: 'submit-note' })
                }
              }}
              aria-invalid={session.phase === 'empty' && session.error ? true : undefined}
              aria-describedby={session.phase === 'empty' && session.error ? errorId : undefined}
            />
            {session.phase === 'empty' && session.error && (
              <p id={errorId} className="error" aria-live="polite">
                {session.error}
              </p>
            )}
            <button
              className="fill"
              type="submit"
              disabled={session.phase === 'processing' || disconnected || session.note.trim() === ''}
              aria-busy={session.phase === 'processing'}
            >
              {session.phase === 'processing' && <span className="spinner" aria-hidden="true" />}
              Turn into a follow-up
            </button>
            {disconnected && <p className="reason">TrueForge disconnected. Reconnect to write a follow-up.</p>}
          </form>

          {state.revealHall && (
            <ul className="people">
              {visibleIds(state).map((id) => {
                const person = state.sessions[id]
                const current = id === state.activeId
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={current ? 'person current' : 'person'}
                      aria-current={current ? 'true' : undefined}
                      onClick={() => dispatch({ type: 'select', id })}
                    >
                      <span className="person-name">{person.name}</span>
                      <span className="person-topic">{person.topic}</span>
                      <span className="person-status">{statusWord(person)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <article className="face" id="face" aria-busy={session.phase === 'processing'}>
          <p className="clip">{clipLabel(session, state.mode)}</p>

          {session.phase === 'empty' && (
            <>
              <h1>Write who you met. Their badge shows up here.</h1>
              <p className="lede">The hall stays quiet until the note is in.</p>
            </>
          )}

          {session.phase === 'processing' && (
            <div className="skeleton">
              <p>Reading what you told me…</p>
              <span />
              <span />
              <span />
            </div>
          )}

          {session.phase === 'clarify' && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                dispatch({ type: 'submit-clarify' })
              }}
            >
              <h1>
                {session.clarify === 'email'
                  ? 'What email should this letter use?'
                  : 'Which repository did you promise to share?'}
              </h1>
              <blockquote className="source">
                <p>{session.note}</p>
              </blockquote>
              <div className="field-row">
              {session.clarify === 'email' ? (
                <label className="field">
                  Email
                  <input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    value={session.email}
                    placeholder="name@company.com"
                    aria-invalid={session.error ? true : undefined}
                    aria-describedby={session.error ? errorId : undefined}
                    onChange={(event) => dispatch({ type: 'type-email', email: event.target.value })}
                  />
                </label>
              ) : (
                <label className="field">
                  Repository
                  <input
                    id="repo"
                    name="repo"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    spellCheck={false}
                    value={session.repoUrl}
                    placeholder="https://…"
                    aria-invalid={session.error ? true : undefined}
                    aria-describedby={session.error ? errorId : undefined}
                    onChange={(event) => dispatch({ type: 'type-repo', url: event.target.value })}
                  />
                </label>
              )}
              <button className="fill" type="submit">
                {session.clarify === 'email' ? 'Save email' : 'Save link'}
              </button>
              </div>
              {session.error && (
                <p id={errorId} className="error" aria-live="polite">
                  {session.error}
                </p>
              )}
            </form>
          )}

          {(session.phase === 'draft' || session.phase === 'review' || session.phase === 'outcome' || session.phase === 'skipped') && (
            <>
              {(session.delivery === 'sent' || session.delivery === 'proof') && (
                <p className={session.delivery === 'sent' ? 'stamp sent' : 'stamp proof'}>
                  {session.delivery === 'sent' ? 'Sent' : 'Proof'}
                </p>
              )}
              {session.panel === 'source' && session.note && (
                <blockquote className="source">
                  <p className="kicker">What you told me</p>
                  <p>{session.note}</p>
                </blockquote>
              )}
              {session.phase === 'draft' ? (
                <h1 className="headline-wrap">
                  <label className="field headline" htmlFor="subject">
                    Subject
                    <input
                      id="subject"
                      name="subject"
                      value={session.subject}
                      autoComplete="off"
                      onChange={(event) => dispatch({ type: 'type-subject', subject: event.target.value })}
                    />
                  </label>
                  <label className="field" htmlFor="recipient">
                    To
                    <input
                      id="recipient"
                      name="recipient"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      spellCheck={false}
                      value={session.email}
                      onChange={(event) => dispatch({ type: 'type-email', email: event.target.value })}
                    />
                  </label>
                </h1>
              ) : (
                <h1>{session.subject || clipLabel(session, state.mode)}</h1>
              )}

              {session.phase === 'review' && (
                <dl className="review-list">
                  <div>
                    <dt>To</dt>
                    <dd>{session.email}</dd>
                  </div>
                  <div>
                    <dt>Subject</dt>
                    <dd>{session.subject}</dd>
                  </div>
                  <div>
                    <dt>Link</dt>
                    <dd>{session.repoUrl}</dd>
                  </div>
                </dl>
              )}

              {session.phase === 'draft' && editing ? (
                <label className="field" htmlFor="body">
                  Letter
                  <textarea
                    id="body"
                    name="body"
                    value={session.body}
                    rows={8}
                    autoComplete="off"
                    onChange={(event) => dispatch({ type: 'type-body', body: event.target.value })}
                  />
                </label>
              ) : (
                session.body && <Words text={session.body} version={session.version} />
              )}
              {session.phase === 'draft' && (
                <button type="button" className="ghost" onClick={() => setEditing((value) => !value)}>
                  {editing ? 'Show the letter' : 'Edit letter'}
                </button>
              )}

              {path && <PathGraph nodes={path.nodes} edges={path.edges} caption={path.chain} />}

              {session.promises.length > 0 && (
                <ul className="promises">
                  {session.promises.map((item) => {
                    const view = promiseView(item, session)
                    return (
                      <li key={item.id} className={view === 'open' ? 'open' : 'marked'}>
                        <span>
                          {item.label} · {promiseLabel(view)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}

              {session.delivery === 'sent' && (
                <p className="receipt">
                  Sent · {session.email} · {session.sentAt}. Fixture receipt · no mail provider.
                </p>
              )}
              {session.delivery === 'proof' && <p className="receipt">Proof · local outbox · no mail provider.</p>}
              {session.delivery === 'failed' && (
                <p className="receipt warn">Not sent. {session.error}</p>
              )}
              {session.delivery === 'uncertain' && (
                <p className="receipt warn">Uncertain. Check before sending again.</p>
              )}
              {session.phase === 'skipped' && (
                <>
                  <p className="receipt">Skipped. Open promises stay open.</p>
                  <button type="button" className="fill" onClick={() => dispatch({ type: 'redraft' })}>
                    Write the letter
                  </button>
                </>
              )}

              {session.panel === 'tweak' && (
                <form
                  className="tweak"
                  onSubmit={(event) => {
                    event.preventDefault()
                    dispatch({ type: 'apply-tweak' })
                  }}
                >
                  <label htmlFor="tweak">Tweak</label>
                  <input
                    id="tweak"
                    name="tweak"
                    value={session.tweak}
                    autoComplete="off"
                    placeholder="Shorter…"
                    onChange={(event) => dispatch({ type: 'type-tweak', text: event.target.value })}
                    aria-invalid={session.error ? true : undefined}
                    aria-describedby={session.error ? errorId : undefined}
                  />
                  <button className="fill" type="submit">
                    Revise
                  </button>
                </form>
              )}
              {session.error && (
                <p id={errorId} className="error" aria-live="polite">
                  {session.error}
                </p>
              )}

              {session.delivery === 'failed' && (
                <button className="fill" type="button" onClick={() => dispatch({ type: 'retry' })}>
                  Try again
                </button>
              )}
              {session.delivery === 'uncertain' && (
                <button className="ghost" type="button" onClick={() => dispatch({ type: 'check-uncertain' })}>
                  Check before sending again
                </button>
              )}
            </>
          )}

          {showActions && (
            <div className="actions">
              <button
                type="button"
                className="ghost"
                aria-pressed={session.panel === 'source'}
                onClick={() => dispatch({ type: 'toggle-source' })}
              >
                What you told me
              </button>
              <button type="button" className="ghost" onClick={() => dispatch({ type: 'open-tweak' })}>
                Tweak
              </button>
              <button type="button" className="ghost" onClick={() => dispatch({ type: 'skip' })}>
                Skip
              </button>
              {session.phase === 'review' ? (
                <>
                  <button
                    type="button"
                    className="fill"
                    disabled={disconnected || state.mode === 'replay'}
                    onClick={() => {
                      const now = timeLabel()
                      if (state.mode === 'replay') {
                        dispatch({ type: 'approve', now })
                        return
                      }
                      void fetch('/api/approve', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                          allow: true,
                          email: session.email,
                          subject: session.subject,
                          body: session.body,
                          repoUrl: session.repoUrl,
                          mode: state.mode,
                        }),
                      }).then((response) => {
                        if (response.ok) dispatch({ type: 'approve', now })
                      })
                    }}
                  >
                    Approve send
                  </button>
                  <button
                    type="button"
                    className="ghost danger"
                    onClick={() => {
                      if (session.awaitingSend) {
                        void fetch('/api/approve', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ allow: false }),
                        }).finally(() => dispatch({ type: 'deny' }))
                        return
                      }
                      dispatch({ type: 'deny' })
                    }}
                  >
                    Don’t send
                  </button>
                  {state.mode === 'replay' && <p className="reason">Replay uses a saved fixture.</p>}
                  {disconnected && <p className="reason">TrueForge disconnected</p>}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="fill"
                    disabled={disconnected}
                    onClick={() => dispatch({ type: 'review' })}
                  >
                    Review & send
                  </button>
                  {disconnected && <p className="reason">TrueForge disconnected</p>}
                </>
              )}
            </div>
          )}
        </article>
        </div>
      </main>

      <button
        type="button"
        className="session-button"
        aria-expanded={state.activityOpen}
        aria-controls="session-panel"
        aria-label={footerLine(state)}
        onClick={() => dispatch({ type: 'toggle-activity' })}
      >
        Session
      </button>
      <span className="sr" aria-live="polite">
        {footerLine(state)}
      </span>

      {renderer === 'css' && <p className="renderer-note">Flat hall. WebGL is unavailable.</p>}

      {state.activityOpen && (
        <section className="drawer" id="session-panel" aria-label="Session">
          <p className="drawer-note">
            {session.awaitingSend
              ? 'Waiting for your OK. send_email is paused. Deny sends nothing.'
              : 'Approving writes the local outbox. No mail provider is called.'}
          </p>
          {owes && <p className="drawer-note">Still owed: {owes.length ? owes.join(', ') : 'nothing open on OWES.'}</p>}
          <fieldset>
            <legend>Mode</legend>
            {(['dry-run', 'live', 'replay'] as const).map((mode) => (
              <label key={mode}>
                <input
                  type="radio"
                  name="mode"
                  checked={state.mode === mode}
                  onChange={() => dispatch({ type: 'set-mode', mode })}
                />
                {mode === 'dry-run' ? 'Dry run' : mode === 'live' ? 'Live' : 'Replay'}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Connection</legend>
            <label>
              <input
                type="radio"
                name="connection"
                checked={state.connection === 'connected'}
                onChange={() => dispatch({ type: 'set-connection', connection: 'connected' })}
              />
              Connected
            </label>
            <label>
              <input
                type="radio"
                name="connection"
                checked={state.connection === 'disconnected'}
                onChange={() => dispatch({ type: 'set-connection', connection: 'disconnected' })}
              />
              Disconnected
            </label>
          </fieldset>
          <div className="jumps">
            {(
              [
                ['empty', 'Empty hall'],
                ['clarify', 'Clarification'],
                ['draft', 'Letter'],
                ['review', 'Review'],
                ['sent', 'Sent'],
                ['proof', 'Proof'],
                ['failed', 'Not sent'],
                ['uncertain', 'Uncertain'],
                ['skipped', 'Skipped'],
                ['disconnected', 'Disconnected'],
                ['replay', 'Replay'],
              ] as const
            ).map(([preset, label]) => (
              <button key={preset} type="button" className="ghost" onClick={() => dispatch({ type: 'jump', preset })}>
                {label}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function timeLabel() {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date())
}
