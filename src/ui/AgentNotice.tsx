import { useState } from 'react'
import { useAgents } from './agents'

function word(status: 'running' | 'done' | 'failed') {
  if (status === 'running') return 'Running'
  if (status === 'failed') return 'Failed'
  if (status === 'done') return 'Finished'
  return 'Not active'
}

export function AgentNotice() {
  const jobs = useAgents()
  const [open, setOpen] = useState(false)
  const running = jobs.some((job) => job.status === 'running')
  const failed = !running && jobs[0]?.status === 'failed'

  return (
    <div className="agent-notice">
      <button
        type="button"
        className={running ? 'live' : failed ? 'failed' : ''}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {running ? 'Running' : failed ? 'Failed' : 'Not active'}
      </button>
      {open && (
        <div className="agent-log" role="status">
          {jobs.length === 0 ? (
            <p>No agent has run yet.</p>
          ) : (
            <ul>
              {jobs.map((job) => (
                <li key={job.id} data-status={job.status}>
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
