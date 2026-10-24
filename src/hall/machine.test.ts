import { describe, expect, it } from 'vitest'
import { PRIYA_NOTE, PRIYA_URL } from './fixtures'
import {
  applyParams,
  footerLine,
  hydrate,
  initialState,
  promiseView,
  readNote,
  reduce,
  visibleIds,
} from './machine'

function run() {
  let state = initialState()
  state = reduce(state, { type: 'type-note', note: PRIYA_NOTE })
  state = reduce(state, { type: 'submit-note' })
  state = reduce(state, { type: 'finish-processing', now: '1:08 PM' })
  state = reduce(state, { type: 'type-repo', url: PRIYA_URL })
  state = reduce(state, { type: 'submit-clarify' })
  return state
}

describe('afterglow hall', () => {
  it('reads Priya without inventing a link', () => {
    const read = readNote(PRIYA_NOTE)
    expect(read.name).toBe('Priya')
    expect(read.org).toBe('Nimbus')
    expect(read.email).toBe('priya@nimbus.example')
    expect(read.intro).toBe(true)
  })

  it('asks for the repo and refuses a bad link', () => {
    let state = initialState()
    expect(reduce(state, { type: 'submit-note' }).sessions.new.error).toBe('Write who you met.')
    state = reduce(state, { type: 'type-note', note: PRIYA_NOTE })
    state = reduce(state, { type: 'submit-note' })
    state = reduce(state, { type: 'finish-processing', now: '1:08 PM' })
    expect(state.sessions.new.phase).toBe('clarify')
    expect(state.sessions.new.event).toMatch(/repository/i)
    state = reduce(state, { type: 'type-repo', url: 'not a link' })
    state = reduce(state, { type: 'submit-clarify' })
    expect(state.sessions.new.phase).toBe('clarify')
    expect(state.sessions.new.body).toBe('')
  })

  it('asks for an email before the repo when the note has none', () => {
    let state = initialState()
    state = reduce(state, { type: 'type-note', note: 'Met Jonah from Northline. I promised to share my repo.' })
    state = reduce(state, { type: 'submit-note' })
    state = reduce(state, { type: 'finish-processing', now: '2:00 PM' })
    expect(state.sessions.new.clarify).toBe('email')
    state = reduce(state, { type: 'submit-clarify' })
    expect(state.sessions.new.error).toMatch(/email/i)
    state = reduce(state, { type: 'type-email', email: 'jonah@northline.example' })
    state = reduce(state, { type: 'submit-clarify' })
    expect(state.sessions.new.clarify).toBe('repo')
    expect(state.sessions.new.phase).toBe('clarify')
  })

  it('keeps the intro open and closes the repo when the approved letter has the link', () => {
    let state = run()
    const repo = state.sessions.new.promises[0]
    const intro = state.sessions.new.promises[1]
    expect(promiseView(repo, state.sessions.new)).toBe('in-letter')
    expect(promiseView(intro, state.sessions.new)).toBe('open')

    state = reduce(state, { type: 'review' })
    state = reduce(state, { type: 'approve', now: '1:10 PM' })
    expect(state.sessions.new.delivery).toBe('proof')
    expect(promiseView(repo, state.sessions.new)).toBe('kept')
    expect(promiseView(intro, state.sessions.new)).toBe('open')

    let live = run()
    live = reduce(live, { type: 'set-mode', mode: 'live' })
    live = reduce(live, { type: 'review' })
    live = reduce(live, { type: 'approve', now: '1:12 PM' })
    expect(live.sessions.new.delivery).toBe('proof')
    expect(promiseView(live.sessions.new.promises[0], live.sessions.new)).toBe('kept')
    expect(promiseView(live.sessions.new.promises[1], live.sessions.new)).toBe('open')
  })

  it('clears approval on tweak and does not send a replay or a denial', () => {
    let state = run()
    state = reduce(state, { type: 'review' })
    state = reduce(state, { type: 'type-tweak', text: 'Shorter' })
    state = reduce(state, { type: 'apply-tweak' })
    expect(state.sessions.new.phase).toBe('draft')
    expect(state.sessions.new.version).toBe(2)
    expect(state.sessions.new.body).toMatch(/Happy to compare notes/)
    expect(state.sessions.new.delivery).toBe('none')

    state = reduce(state, { type: 'review' })
    state = reduce(state, { type: 'deny' })
    expect(state.sessions.new.phase).toBe('draft')
    expect(state.sessions.new.delivery).toBe('none')

    state = reduce(state, { type: 'set-mode', mode: 'replay' })
    state = reduce(state, { type: 'review' })
    state = reduce(state, { type: 'approve', now: '1:20 PM' })
    expect(state.sessions.new.delivery).toBe('none')
    expect(state.sessions.new.phase).toBe('review')
  })

  it('does not retry an uncertain delivery or close a skipped promise', () => {
    let state = reduce(initialState(), { type: 'jump', preset: 'uncertain' })
    state = reduce(state, { type: 'retry' })
    expect(state.sessions.new.delivery).toBe('uncertain')
    state = reduce(state, { type: 'check-uncertain' })
    expect(state.sessions.new.event).toMatch(/Nothing was sent again/)

    state = reduce(initialState(), { type: 'jump', preset: 'skipped' })
    expect(state.sessions.new.promises.every((item) => promiseView(item, state.sessions.new) === 'open')).toBe(true)
  })

  it('starts another follow-up when a letter already exists', () => {
    let state = reduce(initialState(), { type: 'select', id: 'samira' })
    state = reduce(state, { type: 'type-note', note: 'Met Samira again about the CFP draft.' })
    state = reduce(state, { type: 'submit-note' })
    expect(state.sessions.samira.phase).toBe('processing')
    expect(state.sessions.samira.note).toMatch(/again/)
    expect(state.sessions.samira.delivery).toBe('none')
  })

  it('writes a skipped letter again without sending it', () => {
    const state = reduce(initialState(), { type: 'select', id: 'samira' })
    const next = reduce(state, { type: 'redraft' })
    expect(next.sessions.samira.phase).toBe('draft')
    expect(next.sessions.samira.body).toMatch(/Samira/)
    expect(next.sessions.samira.delivery).toBe('none')
  })

  it('keeps a saved hall and adds a fixture that was missing', () => {
    const saved = initialState()
    delete saved.sessions.noor
    const restored = hydrate(JSON.stringify(saved))
    expect(restored?.sessions.noor?.name).toBe('Noor')
    expect(restored?.sessions.new.phase).toBe('empty')
  })

  it('blocks a disconnected submit and labels the footer', () => {
    let state = reduce(initialState(), { type: 'set-connection', connection: 'disconnected' })
    state = reduce(state, { type: 'type-note', note: PRIYA_NOTE })
    state = reduce(state, { type: 'submit-note' })
    expect(state.sessions.new.phase).toBe('empty')
    expect(footerLine(state)).toMatch(/disconnected/i)
  })

  it('keeps one event on stage and finds every Priya', () => {
    const state = initialState()
    const onStage = visibleIds(state).filter((id) => id !== 'new')
    expect(onStage.every((id) => state.sessions[id].conferenceId === 'patch')).toBe(true)
    const names = Object.values(state.sessions)
      .filter((item) => item.name === 'Priya')
      .map((item) => item.id)
    expect(names).toEqual(expect.arrayContaining(['priya', 'priya-harbor']))
    const next = reduce(state, { type: 'select', id: 'priya-harbor' })
    expect(next.eventId).toBe('harbor')
    expect(visibleIds(next)).toContain('priya-harbor')
    expect(visibleIds(next)).not.toContain('priya')
  })

  it('adds a new meeting to the current hall', () => {
    const state = reduce(initialState(), {
      type: 'add-person',
      id: 'met-ada',
      name: 'Ada',
      org: 'Loom',
      email: 'ada@loom.example',
      topic: 'Badges',
      note: 'Met Ada from Loom.',
      subject: 'Following up with Ada',
      body: 'Hey Ada,\n\nMet Ada from Loom.\n\nAarsh',
      now: '4:40 PM',
    })
    expect(state.activeId).toBe('met-ada')
    expect(state.sessions['met-ada'].conferenceId).toBe('patch')
    expect(visibleIds(state)).toContain('met-ada')
  })

  it('restores a review link', () => {
    const state = applyParams(initialState(), new URLSearchParams('phase=review&panel=source'))
    expect(state.sessions.new.phase).toBe('review')
    expect(state.sessions.new.panel).toBe('source')
    expect(state.revealHall).toBe(true)
  })
})
