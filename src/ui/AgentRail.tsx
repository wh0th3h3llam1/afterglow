import { AGENTS, useAgents } from './agents'

function word(status?: 'running' | 'done' | 'failed') {
  if (status === 'running') return 'Running'
  if (status === 'failed') return 'Failed'
  if (status === 'done') return 'Finished'
  return 'Not active'
}

export function AgentRail() {
  const jobs = useAgents()
  return (
    <aside className="agent-rail" aria-label="Agents">
      <p>Agents</p>
      <ul>
        {AGENTS.map((name) => {
          const latest = jobs.find((job) => job.agent === name)
          return (
            <li key={name} data-status={latest?.status || 'idle'}>
              <strong>{name}</strong>
              <span>{word(latest?.status)}</span>
              {latest?.detail && <p>{latest.detail}</p>}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
