import { EVENTS, PEOPLE, PRIYA_NOTE, PRIYA_URL } from './fixtures'
import type {
  Action,
  ClarifyField,
  Connection,
  Delivery,
  HallState,
  Jump,
  Mode,
  Panel,
  Phase,
  PromiseItem,
  PromiseView,
  GraphEdge,
  GraphNode,
  Session,
} from './types'

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

export function readNote(note: string) {
  const email = note.match(EMAIL)?.[0] ?? ''
  const name = note.match(/\b(?:met|meet)\s+([A-Z][a-z]+)/)?.[1] ?? 'Someone'
  const org = note.match(/\bfrom\s+([A-Z][A-Za-z]+)/)?.[1] ?? ''
  const intro = /introduc/i.test(note)
  const topic = /memor/i.test(note)
    ? 'Agent memory'
    : 'A conversation'
  return { email, name, org, intro, topic }
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function isUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function promisesFor(intro: boolean): PromiseItem[] {
  const items: PromiseItem[] = [
    { id: 'repo', label: 'Share the repo', fulfillsOnSend: true },
  ]
  if (intro) {
    items.push({
      id: 'intro',
      label: 'Introduction to their engineering lead',
      fulfillsOnSend: false,
    })
  }
  return items
}

export function letterFor(name: string, org: string, url: string, kind: 'full' | 'short' | 'revised') {
  const subject = 'Following up on agent memory'
  const place = org ? ` at ${org}` : ''
  const body =
    kind === 'short'
      ? `Hey ${name},\n\nHere’s the repo I mentioned after the agent talk: ${url}.\n\nHappy to compare notes on memory.\n\nAarsh`
      : kind === 'revised'
        ? `Hey ${name},\n\nStill thinking about what summaries drop. The repo is ${url}.\n\nAarsh`
        : `Hey ${name},\n\nEnjoyed our conversation about what gets lost when agents rely on summaries. Here’s the repo I mentioned: ${url}.\n\nCurious how it compares with your approach${place}. Happy to keep comparing notes.\n\nAarsh`
  return { subject, body }
}

export function promiseView(item: PromiseItem, session: Session): PromiseView {
  const inBody =
    item.fulfillsOnSend && session.repoUrl !== '' && session.body.includes(session.repoUrl)
  if (!inBody) return 'open'
  if (session.delivery === 'sent' || session.delivery === 'proof') return 'kept'
  if (session.phase === 'draft' || session.phase === 'review' || session.phase === 'outcome') {
    return 'in-letter'
  }
  return 'open'
}

export function statusWord(session: Session) {
  if (session.delivery === 'sent') return 'Sent'
  if (session.delivery === 'proof') return 'Proof'
  if (session.delivery === 'failed') return 'Not sent'
  if (session.delivery === 'uncertain') return 'Uncertain'
  if (session.phase === 'skipped') return 'Skipped'
  if (session.phase === 'clarify') return 'Needs a detail'
  if (session.phase === 'review' && session.awaitingSend) return 'Waiting for your OK'
  if (session.phase === 'review') return 'Review'
  if (session.phase === 'processing') return 'Reading'
  if (session.phase === 'draft') return 'Draft'
  if (session.phase === 'empty') return 'New'
  return 'Open'
}

export function fixtureGraph(session: Session): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const who = session.name
  const org = session.org || 'their org'
  const topic = (session.topic || 'the conversation').toLowerCase()
  const nodes: GraphNode[] = [
    { id: 'Person:You', label: 'Person', name: 'You' },
    { id: `Person:${who}`, label: 'Person', name: who },
    { id: `Organization:${org}`, label: 'Organization', name: org },
    { id: `Conversation:Talk with ${who}`, label: 'Conversation', name: `Talk with ${who}` },
    { id: `Topic:${topic}`, label: 'Topic', name: topic },
  ]
  const edges: GraphEdge[] = [
    { from: 'Person:You', to: `Person:${who}`, type: 'MET' },
    { from: `Person:${who}`, to: `Organization:${org}`, type: 'WORKS_AT' },
    { from: `Conversation:Talk with ${who}`, to: `Person:${who}`, type: 'WITH' },
    { from: `Conversation:Talk with ${who}`, to: `Topic:${topic}`, type: 'DISCUSSED' },
  ]
  if (session.promises.some((item) => item.id === 'repo')) {
    nodes.push({ id: 'Promise:the repo', label: 'Promise', name: 'the repo' })
    edges.push({ from: 'Person:You', to: 'Promise:the repo', type: 'OWES' })
  }
  if (session.promises.some((item) => item.id === 'intro')) {
    nodes.push({ id: 'Promise:intro', label: 'Promise', name: 'intro' })
    edges.push({ from: `Person:${who}`, to: 'Promise:intro', type: 'OFFERED' })
  }
  return { nodes, edges }
}

export function pathView(session: Session): { chain: string; nodes: GraphNode[]; edges: GraphEdge[] } | null {
  const text = readablePath(session)
  if (!text) return null
  if (session.pathNodes?.length && session.pathEdges?.length) {
    return { chain: text.chain, nodes: session.pathNodes, edges: session.pathEdges }
  }
  return { chain: text.chain, ...fixtureGraph(session) }
}

export function readablePath(session: Session): { chain: string; raw: string } | null {
  if (session.pathChain && session.pathRaw) return { chain: session.pathChain, raw: session.pathRaw }
  if (session.phase === 'empty' || session.phase === 'processing' || session.name === 'New badge') return null
  const org = session.org || 'their org'
  const topic = (session.topic || 'the conversation').toLowerCase()
  const owe = session.promises.some((item) => item.id === 'repo') ? 'the repo' : (session.promises[0]?.label ?? 'the next thing')
  return {
    chain: `You met ${session.name} · ${session.name} at ${org} · talked about ${topic} · you owe ${owe}`,
    raw: `(self)-[:MET]->(${session.name})-[:WORKS_AT]->(${org}) ; (talk)-[:DISCUSSED]->(${topic}) ; (self)-[:OWES]->(${owe})`,
  }
}

export function footerLine(state: HallState) {
  const session = state.sessions[state.activeId]
  const mode = state.mode === 'live' ? 'Live' : state.mode === 'dry-run' ? 'Dry run' : 'Replay'
  const conn = state.connection === 'connected' ? 'TrueForge connected' : 'TrueForge disconnected'
  const path = state.pathSource === 'graph' ? 'FalkorDB path' : 'Fixture path'
  return `${mode} · ${conn} · ${session.event} · ${path}`
}

export function visibleIds(state: HallState) {
  if (!state.revealHall) return [state.activeId]
  const catalogIds = PEOPLE.filter((person) => person.eventId === state.eventId).map((person) => person.id)
  const added = Object.values(state.sessions)
    .filter((item) => item.id !== 'new' && item.conferenceId === state.eventId && !catalogIds.includes(item.id))
    .map((item) => item.id)
  return ['new', ...catalogIds, ...added].filter((id) => state.sessions[id])
}

function blankSession(): Session {
  return {
    id: 'new',
    name: 'New badge',
    org: '',
    email: '',
    topic: 'A conversation',
    note: '',
    subject: '',
    body: '',
    repoUrl: '',
    tweak: '',
    promises: [],
    phase: 'empty',
    panel: 'none',
    clarify: 'repo',
    version: 0,
    versions: [],
    delivery: 'none',
    event: 'Write who you met.',
    error: '',
    sentAt: null,
    when: '',
    conferenceId: '',
    conference: '',
    venue: '',
    date: '',
  }
}

function sessionFrom(
  partial: Pick<Session, 'id' | 'name' | 'org' | 'email' | 'topic' | 'note' | 'when'> &
    Partial<Session>,
): Session {
  return {
    subject: '',
    body: '',
    repoUrl: '',
    tweak: '',
    promises: promisesFor(/introduc/i.test(partial.note)),
    phase: 'draft',
    panel: 'none',
    clarify: 'repo',
    version: 1,
    versions: [],
    delivery: 'none',
    event: 'Draft ready',
    error: '',
    sentAt: null,
    conferenceId: partial.conferenceId || 'patch',
    conference: partial.conference || 'Patch the Conference',
    venue: partial.venue || 'San Francisco',
    date: partial.date || 'Oct 24, 2026',
    ...partial,
  }
}

function presetSessions(): Record<string, Session> {
  const sessions: Record<string, Session> = { new: blankSession() }
  for (const person of PEOPLE) {
    const event = EVENTS.find((item) => item.id === person.eventId)
    const base = sessionFrom({
      ...person,
      conferenceId: person.eventId,
      conference: event?.name || '',
      venue: event?.venue || '',
      date: event?.date || '',
    })
    if (person.id === 'jonah') {
      sessions[person.id] = {
        ...base,
        phase: 'clarify',
        clarify: 'repo',
        version: 0,
        subject: '',
        body: '',
        event: 'Which repository did you promise to share?',
      }
    } else if (person.id === 'mei') {
      const letter = letterFor(person.name, person.org, PRIYA_URL, 'full')
      sessions[person.id] = {
        ...base,
        ...letter,
        repoUrl: PRIYA_URL,
        phase: 'outcome',
        delivery: 'sent',
        sentAt: '10:22 AM',
        event: `Recorded for ${person.email}`,
      }
    } else if (person.id === 'luis') {
      const letter = letterFor(person.name, person.org, PRIYA_URL, 'full')
      sessions[person.id] = {
        ...base,
        ...letter,
        repoUrl: PRIYA_URL,
        phase: 'draft',
        event: 'Draft ready',
      }
    } else if (person.id === 'samira') {
      sessions[person.id] = {
        ...base,
        phase: 'skipped',
        version: 0,
        promises: [{ id: 'draft', label: 'Send the CFP draft', fulfillsOnSend: false }],
        event: 'Skipped',
      }
    } else if (person.id === 'andre') {
      const letter = letterFor(person.name, person.org, PRIYA_URL, 'full')
      sessions[person.id] = {
        ...base,
        ...letter,
        repoUrl: PRIYA_URL,
        phase: 'outcome',
        delivery: 'failed',
        error: 'The mail provider refused the message.',
        event: 'Not sent',
      }
    } else if (person.id === 'noor') {
      sessions[person.id] = {
        ...base,
        subject: 'How traces are stored',
        body: 'Hey Noor,\n\nYou asked how traces are stored when the summary is all an agent keeps. I keep the raw notes, and I only summarize after the promise is written down.\n\nAarsh',
        promises: [{ id: 'answer', label: 'Answer how traces are stored', fulfillsOnSend: false }],
        phase: 'draft',
        event: 'Draft ready',
      }
    } else if (person.id === 'imani') {
      sessions[person.id] = {
        ...base,
        phase: 'clarify',
        clarify: 'email',
        version: 0,
        subject: '',
        body: '',
        event: 'What email should this letter use?',
      }
    } else {
      sessions[person.id] = {
        ...base,
        subject: `Following up on ${person.topic}`,
        body: `Hey ${person.name},\n\nFollowing up on ${person.topic}.\n\n${person.note}\n\nAarsh`,
        phase: 'draft',
        event: 'Draft ready',
      }
    }
  }
  return sessions
}

export function initialState(): HallState {
  return {
    activeId: 'new',
    sessions: presetSessions(),
    mode: 'dry-run',
    connection: 'connected',
    revealHall: false,
    activityOpen: false,
    chatOpen: false,
    eventId: 'patch',
    entered: false,
  }
}

function patch(state: HallState, id: string, next: Partial<Session>, extra?: Partial<HallState>): HallState {
  const current = state.sessions[id]
  return {
    ...state,
    ...extra,
    sessions: { ...state.sessions, [id]: { ...current, ...next } },
  }
}

function active(state: HallState) {
  return state.sessions[state.activeId]
}

export function reduce(state: HallState, action: Action): HallState {
  const id = state.activeId
  const session = active(state)

  switch (action.type) {
    case 'type-note': {
      if (session.phase === 'processing') return state
      return patch(state, id, { note: action.note, error: '' })
    }
    case 'type-email':
      return patch(state, id, { email: action.email, error: '' })
    case 'type-repo':
      return patch(state, id, { repoUrl: action.url, error: '' })
    case 'type-tweak':
      return patch(state, id, { tweak: action.text, error: '' })
    case 'type-subject':
      if (session.phase !== 'draft') return state
      return patch(state, id, { subject: action.subject, error: '' })
    case 'type-body':
      if (session.phase !== 'draft') return state
      return patch(state, id, { body: action.body, error: '' })
    case 'submit-note': {
      if (session.phase === 'processing') return state
      if (state.connection === 'disconnected') {
        return patch(state, id, { error: 'TrueForge disconnected', event: 'TrueForge disconnected' })
      }
      if (session.note.trim() === '') {
        return patch(state, id, { error: 'Write who you met.' })
      }
      return patch(state, id, {
        phase: 'processing',
        error: '',
        delivery: 'none',
        awaitingSend: false,
        sentAt: null,
        event: 'Reading what you told me…',
      })
    }
    case 'apply-followup': {
      if (session.phase !== 'processing') return state
      const clarify = action.clarify
      const letterReady = Boolean(action.subject && action.body)
      const phase = clarify && !letterReady ? 'clarify' : action.waiting ? 'review' : 'draft'
      return patch(
        state,
        id,
        {
          name: action.name || session.name,
          org: action.org,
          email: action.email,
          topic: action.topic || session.topic,
          promises: promisesFor(action.intro),
          subject: action.subject,
          body: action.body,
          repoUrl: action.body.match(/https?:\/\/\S+/)?.[0] ?? '',
          clarify: clarify === 'email' ? 'email' : 'repo',
          phase,
          when: action.now,
          version: letterReady ? 1 : 0,
          awaitingSend: action.waiting,
          pathChain: action.chain || undefined,
          pathRaw: action.raw || undefined,
          pathNodes: action.nodes,
          pathEdges: action.edges,
          error: '',
          event: action.waiting
            ? 'Waiting for your OK'
            : clarify === 'email'
              ? 'What email should this letter use?'
              : clarify === 'repo' && !letterReady
                ? 'Which repository did you promise to share?'
                : 'Draft ready',
        },
        { revealHall: true, pathSource: action.chain ? 'graph' : state.pathSource },
      )
    }
    case 'finish-processing': {
      if (session.phase !== 'processing') return state
      const read = readNote(session.note)
      const clarify: ClarifyField = read.email ? 'repo' : 'email'
      return patch(
        state,
        id,
        {
          name: read.name,
          org: read.org,
          email: read.email,
          topic: read.topic,
          promises: promisesFor(read.intro),
          clarify,
          phase: 'clarify',
          when: action.now,
          event: clarify === 'email' ? 'What email should this letter use?' : 'Which repository did you promise to share?',
          error: '',
        },
        { revealHall: true },
      )
    }
    case 'submit-clarify': {
      if (session.phase !== 'clarify') return state
      if (session.clarify === 'email') {
        if (!isEmail(session.email)) return patch(state, id, { error: 'Enter an email address.' })
        return patch(state, id, {
          clarify: 'repo',
          error: '',
          event: 'Which repository did you promise to share?',
        })
      }
      if (!isUrl(session.repoUrl)) return patch(state, id, { error: 'Enter the repository link.' })
      const letter = letterFor(session.name, session.org, session.repoUrl.trim(), 'full')
      return patch(state, id, {
        repoUrl: session.repoUrl.trim(),
        ...letter,
        phase: 'draft',
        clarify: 'repo',
        version: 1,
        panel: 'none',
        error: '',
        event: 'Draft ready',
      })
    }
    case 'toggle-source': {
      if (!session.note || session.phase === 'empty' || session.phase === 'processing') return state
      const panel: Panel = session.panel === 'source' ? 'none' : 'source'
      return patch(state, id, { panel })
    }
    case 'open-tweak': {
      if (session.phase !== 'draft' && session.phase !== 'review') return state
      return patch(state, id, {
        phase: 'draft',
        panel: 'tweak',
        error: '',
        event: session.phase === 'review' ? 'Approval cleared. The letter is editable again.' : session.event,
      })
    }
    case 'apply-tweak': {
      if (session.phase !== 'draft' && session.phase !== 'review') return state
      if (session.tweak.trim() === '') return patch(state, id, { error: 'Say what to change.' })
      if (!session.repoUrl) return patch(state, id, { error: 'The repository link is still missing.' })
      // shortcut: any tweak other than "shorter" uses one grounded revision, swap for the model when TrueForge is connected.
      const kind = /short/i.test(session.tweak) ? 'short' : 'revised'
      const letter = letterFor(session.name, session.org, session.repoUrl, kind)
      return patch(state, id, {
        versions: [...session.versions, { subject: session.subject, body: session.body }],
        ...letter,
        version: session.version + 1,
        phase: 'draft',
        panel: 'none',
        tweak: '',
        delivery: 'none',
        error: '',
        event: kind === 'short' ? 'Shorter draft ready' : 'Revised draft ready',
      })
    }
    case 'close-panel':
      if (state.activityOpen) return { ...state, activityOpen: false }
      if (session.panel !== 'none') return patch(state, id, { panel: 'none' })
      if (state.chatOpen) return { ...state, chatOpen: false }
      return state
    case 'toggle-chat':
      return { ...state, chatOpen: !state.chatOpen }
    case 'toggle-activity':
      return { ...state, activityOpen: !state.activityOpen }
    case 'review': {
      if (session.phase !== 'draft') return state
      if (state.connection === 'disconnected') {
        return patch(state, id, { error: 'TrueForge disconnected', event: 'TrueForge disconnected' })
      }
      return patch(state, id, { phase: 'review', panel: 'none', error: '', event: 'Review the letter' })
    }
    case 'approve': {
      if (session.phase !== 'review') return state
      if (state.connection === 'disconnected') {
        return patch(state, id, { error: 'TrueForge disconnected', event: 'TrueForge disconnected' })
      }
      if (state.mode === 'replay') {
        return patch(state, id, { error: 'Replay uses a saved fixture.', event: 'Replay · saved fixture' })
      }
      return patch(state, id, {
        phase: 'outcome',
        delivery: 'proof',
        panel: 'none',
        awaitingSend: false,
        error: '',
        sentAt: null,
        event: 'Proof · local outbox',
      })
    }
    case 'deny': {
      if (session.phase !== 'review') return state
      return patch(state, id, {
        phase: 'draft',
        panel: 'none',
        delivery: 'none',
        awaitingSend: false,
        error: '',
        event: 'Held back. Nothing was sent.',
      })
    }
    case 'skip': {
      if (session.phase === 'empty' || session.phase === 'processing' || session.phase === 'skipped') return state
      return patch(state, id, { phase: 'skipped', panel: 'none', delivery: 'none', error: '', event: 'Skipped' })
    }
    case 'redraft': {
      if (session.phase !== 'skipped') return state
      if (session.body.trim()) {
        return patch(state, id, { phase: 'draft', panel: 'none', error: '', event: 'Draft ready' })
      }
      const subject = session.subject || `Following up on ${session.topic}`
      const body = session.repoUrl
        ? letterFor(session.name, session.org, session.repoUrl, 'full').body
        : `Hey ${session.name},\n\nFollowing up on ${session.topic}.\n\n${session.note}\n\nAarsh`
      return patch(state, id, { phase: 'draft', panel: 'none', subject, body, version: 1, error: '', event: 'Draft ready' })
    }
    case 'retry': {
      if (session.delivery !== 'failed') return state
      return patch(state, id, {
        phase: 'review',
        delivery: 'none',
        error: '',
        event: 'Waiting for your OK',
      })
    }
    case 'check-uncertain': {
      if (session.delivery !== 'uncertain') return state
      return patch(state, id, { event: 'Check the outbox before sending again. Nothing was sent again.' })
    }
    case 'select': {
      if (!state.sessions[action.id]) return state
      if (action.toggle && action.id === state.activeId) return { ...state, chatOpen: !state.chatOpen }
      const conferenceId = state.sessions[action.id].conferenceId
      return {
        ...state,
        activeId: action.id,
        chatOpen: true,
        entered: true,
        eventId: conferenceId || state.eventId,
      }
    }
    case 'set-event': {
      const ids = PEOPLE.filter((person) => person.eventId === action.id).map((person) => person.id)
      const stay = state.activeId === 'new' || ids.includes(state.activeId)
      return {
        ...state,
        eventId: action.id,
        entered: true,
        chatOpen: false,
        activeId: stay ? state.activeId : ids[0] || 'new',
      }
    }
    case 'add-person': {
      const event = EVENTS.find((item) => item.id === state.eventId)
      const session = sessionFrom({
        id: action.id,
        name: action.name,
        org: action.org,
        email: action.email,
        topic: action.topic || 'A conversation',
        note: action.note,
        when: action.now,
        conferenceId: state.eventId,
        conference: event?.name || '',
        venue: event?.venue || '',
        date: event?.date || '',
        subject: action.subject,
        body: action.body,
        phase: action.subject && action.body ? 'draft' : 'clarify',
        clarify: action.email ? 'repo' : 'email',
        event: action.subject && action.body ? 'Draft ready' : 'What email should this letter use?',
      })
      return {
        ...state,
        revealHall: true,
        entered: true,
        activeId: action.id,
        chatOpen: true,
        sessions: { ...state.sessions, [action.id]: session },
      }
    }
    case 'step': {
      const ids = visibleIds(state)
      const index = ids.indexOf(state.activeId)
      if (index < 0 || ids.length < 2) return state
      const next = ids[(index + action.dir + ids.length) % ids.length]
      return { ...state, activeId: next }
    }
    case 'set-mode':
      return { ...state, mode: action.mode }
    case 'set-connection':
      return {
        ...state,
        connection: action.connection,
        sessions: {
          ...state.sessions,
          [id]: {
            ...session,
            event: action.connection === 'disconnected' ? 'TrueForge disconnected' : session.event,
            error: action.connection === 'disconnected' ? 'TrueForge disconnected' : '',
          },
        },
      }
    case 'jump':
      return applyJump(state, action.preset)
    case 'set-path':
      return patch(
        state,
        id,
        { pathChain: action.chain, pathRaw: action.raw, pathNodes: action.nodes, pathEdges: action.edges },
        { pathSource: 'graph' },
      )
    case 'await-send':
      return patch(state, id, {
        awaitingSend: action.waiting,
        event: action.waiting ? 'Waiting for your OK' : session.event,
      })
    default:
      return state
  }
}

function priyaBase(phase: Phase, delivery: Delivery, event: string, extra?: Partial<Session>): Session {
  const read = readNote(PRIYA_NOTE)
  const letter = letterFor(read.name, read.org, PRIYA_URL, 'full')
  const drafted = phase !== 'empty' && phase !== 'clarify' && phase !== 'processing'
  return {
    ...blankSession(),
    name: read.name,
    org: read.org,
    email: read.email,
    topic: read.topic,
    note: PRIYA_NOTE,
    when: '1:08 PM',
    promises: promisesFor(true),
    repoUrl: drafted ? PRIYA_URL : '',
    subject: drafted ? letter.subject : '',
    body: drafted ? letter.body : '',
    version: drafted ? 1 : 0,
    phase,
    delivery,
    event,
    clarify: 'repo',
    ...extra,
  }
}

export function applyJump(state: HallState, preset: Jump): HallState {
  const mode: Mode = preset === 'replay' ? 'replay' : preset === 'sent' ? 'live' : 'dry-run'
  const connection: Connection = preset === 'disconnected' ? 'disconnected' : 'connected'
  if (preset === 'empty') {
    return {
      ...state,
      activeId: 'new',
      mode,
      connection,
      revealHall: false,
      activityOpen: state.activityOpen,
      pathSource: 'fixture',
      chatOpen: false,
      sessions: { ...state.sessions, new: blankSession() },
    }
  }

  const built: Record<Jump, Session> = {
    empty: blankSession(),
    clarify: priyaBase('clarify', 'none', 'Which repository did you promise to share?'),
    draft: priyaBase('draft', 'none', 'Draft ready'),
    review: priyaBase('review', 'none', 'Review the letter'),
    sent: priyaBase('outcome', 'sent', 'Recorded for priya@nimbus.example', { sentAt: '1:08 PM' }),
    proof: priyaBase('outcome', 'proof', 'Dry run · not delivered'),
    failed: priyaBase('outcome', 'failed', 'Not sent', { error: 'The mail provider refused the message.' }),
    uncertain: priyaBase('outcome', 'uncertain', 'Uncertain'),
    skipped: priyaBase('skipped', 'none', 'Skipped', { repoUrl: '', subject: '', body: '', version: 0 }),
    disconnected: priyaBase('draft', 'none', 'TrueForge disconnected', { error: 'TrueForge disconnected' }),
    replay: priyaBase('review', 'none', 'Replay · saved fixture'),
  }

  return {
    ...state,
      activeId: 'new',
      mode,
      connection,
      revealHall: true,
      pathSource: 'fixture',
      chatOpen: true,
    sessions: { ...state.sessions, new: built[preset] },
  }
}

export function writeQuery(state: HallState) {
  if (!state.entered) return ''
  const session = active(state)
  const params = new URLSearchParams()
  params.set('conversation', state.activeId)
  params.set('phase', session.phase)
  if (session.panel !== 'none') params.set('panel', session.panel)
  params.set('mode', state.mode)
  params.set('connection', state.connection)
  if (session.delivery !== 'none') params.set('delivery', session.delivery)
  if (state.activityOpen) params.set('activity', '1')
  if (state.chatOpen) params.set('chat', '1')
  return params.toString()
}

export function applyParams(state: HallState, params: URLSearchParams): HallState {
  const preset = params.get('phase')
  const jumps: Record<string, Jump> = {
    empty: 'empty',
    clarify: 'clarify',
    draft: 'draft',
    review: 'review',
    skipped: 'skipped',
  }
  let next = state
  if (preset === 'outcome') {
    const delivery = params.get('delivery')
    const jump: Jump =
      delivery === 'proof' ? 'proof' : delivery === 'failed' ? 'failed' : delivery === 'uncertain' ? 'uncertain' : 'sent'
    next = applyJump(next, jump)
  } else if (preset && jumps[preset]) {
    next = applyJump(next, jumps[preset])
  }
  if (params.get('mode') === 'replay') next = { ...next, mode: 'replay' }
  if (params.get('mode') === 'live') next = { ...next, mode: 'live' }
  if (params.get('mode') === 'dry-run') next = { ...next, mode: 'dry-run' }
  if (params.get('connection') === 'disconnected') {
    next = applyJump(next, 'disconnected')
  }
  const conversation = params.get('conversation')
  if (conversation && next.sessions[conversation] && preset !== 'outcome' && !jumps[preset ?? '']) {
    next = { ...next, activeId: conversation, revealHall: true }
  }
  const panel = params.get('panel')
  if (panel === 'source' || panel === 'tweak') {
    next = patch(next, next.activeId, { panel })
  }
  if (params.get('activity') === '1') next = { ...next, activityOpen: true }
  if (params.get('chat') === '1') next = { ...next, chatOpen: true }
  if (params.get('chat') === '0') next = { ...next, chatOpen: false }
  if (preset || conversation) next = { ...next, entered: true }
  return next
}

export const STORAGE_KEY = 'afterglow-hall'

export function serialize(state: HallState) {
  return JSON.stringify(state)
}

export function hydrate(raw: string): HallState | null {
  try {
    const parsed = JSON.parse(raw) as HallState
    if (!parsed.sessions || !parsed.sessions[parsed.activeId]) return null
    const sessions = { ...presetSessions(), ...parsed.sessions }
    return {
      ...parsed,
      sessions,
      chatOpen: parsed.chatOpen ?? false,
      eventId: parsed.eventId || 'patch',
      entered: parsed.entered ?? true,
    }
  } catch {
    return null
  }
}
