import { useState } from 'react'
import { useAgents } from './agents'

function word(status: 'running' | 'done' | 'failed') {
  if (status === 'running') return 'Running'
  if (status === 'done') return 'Finished'
  return 'Stopped'
}

export function AgentNotice() {
  const jobs = useAgents()
  const [open, setOpen] = useState(false)
  const running = jobs.some((job) => job.status === 'running')

  return (
    <div className="agent-notice">
      <button
        type="button"
        className={running ? 'on' : ''}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {running ? 'Running' : 'Agents'}
      </button>
      {open && (
        <div className="agent-log" role="status">
          {jobs.length === 0 ? (
            <p>No agent has run yet.</p>
          ) : (
            <ul>
              {jobs.map((job) => (
                <li key={job.id}>
                  <strong>{job.agent}</strong>
                  <span>{word(job.status)}</span>
                  <p>{job.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
