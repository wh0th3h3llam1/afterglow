export type Phase =
  | 'empty'
  | 'processing'
  | 'clarify'
  | 'draft'
  | 'review'
  | 'outcome'
  | 'skipped'

export type Panel = 'none' | 'source' | 'tweak'
export type Mode = 'live' | 'dry-run' | 'replay'
export type Connection = 'connected' | 'disconnected'
export type Delivery = 'none' | 'sent' | 'proof' | 'failed' | 'uncertain'
export type ClarifyField = 'email' | 'repo'
export type PromiseView = 'open' | 'in-letter' | 'kept'

export type GraphNode = { id: string; label: string; name: string }
export type GraphEdge = { from: string; to: string; type: string }

export type PromiseItem = {
  id: string
  label: string
  fulfillsOnSend: boolean
}

export type Version = { subject: string; body: string }

export type Session = {
  id: string
  name: string
  org: string
  email: string
  topic: string
  note: string
  subject: string
  body: string
  repoUrl: string
  tweak: string
  promises: PromiseItem[]
  phase: Phase
  panel: Panel
  clarify: ClarifyField
  version: number
  versions: Version[]
  delivery: Delivery
  event: string
  error: string
  sentAt: string | null
  when: string
  conferenceId?: string
  conference?: string
  venue?: string
  date?: string
  pathChain?: string
  pathRaw?: string
  pathNodes?: GraphNode[]
  pathEdges?: GraphEdge[]
  awaitingSend?: boolean
}

export type HallState = {
  activeId: string
  sessions: Record<string, Session>
  mode: Mode
  connection: Connection
  revealHall: boolean
  activityOpen: boolean
  chatOpen?: boolean
  pathSource?: 'fixture' | 'graph'
  eventId: string
  entered: boolean
}

export type Jump =
  | 'empty'
  | 'clarify'
  | 'draft'
  | 'review'
  | 'sent'
  | 'proof'
  | 'failed'
  | 'uncertain'
  | 'skipped'
  | 'disconnected'
  | 'replay'

export type Action =
  | { type: 'type-note'; note: string }
  | { type: 'type-email'; email: string }
  | { type: 'type-repo'; url: string }
  | { type: 'type-tweak'; text: string }
  | { type: 'type-subject'; subject: string }
  | { type: 'type-body'; body: string }
  | { type: 'submit-note' }
  | { type: 'finish-processing'; now: string }
  | { type: 'submit-clarify' }
  | { type: 'toggle-source' }
  | { type: 'open-tweak' }
  | { type: 'apply-tweak' }
  | { type: 'close-panel' }
  | { type: 'toggle-activity' }
  | { type: 'review' }
  | { type: 'approve'; now: string }
  | { type: 'deny' }
  | { type: 'skip' }
  | { type: 'redraft' }
  | { type: 'retry' }
  | { type: 'check-uncertain' }
  | { type: 'select'; id: string; toggle?: boolean }
  | { type: 'set-event'; id: string }
  | { type: 'add-person'; id: string; name: string; org: string; email: string; topic: string; note: string; subject: string; body: string; now: string }
  | { type: 'toggle-chat' }
  | { type: 'step'; dir: -1 | 1 }
  | { type: 'set-mode'; mode: Mode }
  | { type: 'set-connection'; connection: Connection }
  | { type: 'jump'; preset: Jump }
  | { type: 'set-path'; chain: string; raw: string; nodes?: GraphNode[]; edges?: GraphEdge[] }
  | { type: 'await-send'; waiting: boolean }
  | {
      type: 'apply-followup'
      now: string
      source: string
      waiting: boolean
      clarify: 'email' | 'repo' | null
      name: string
      org: string
      email: string
      topic: string
      intro: boolean
      subject: string
      body: string
      chain: string
      raw: string
      nodes?: GraphNode[]
      edges?: GraphEdge[]
    }
