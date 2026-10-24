import { AGENTS, useAgents } from './agents'

function word(status?: 'running' | 'done' | 'failed') {
  if (status === 'running') return 'Running'
  if (status === 'done') return 'Finished'
  if (status === 'failed') return 'Stopped'
  return 'Idle'
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
