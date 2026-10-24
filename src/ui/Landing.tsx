import { EVENTS } from '../hall/fixtures'
import type { Dispatch } from 'react'
import type { Action } from '../hall/types'

export function Landing({ dispatch }: { dispatch: Dispatch<Action> }) {
  return (
    <main className="landing">
      <p className="brand">Afterglow</p>
      <h1>Pick the hall</h1>
      <ul>
        {EVENTS.map((event) => (
          <li key={event.id}>
            <button type="button" onClick={() => dispatch({ type: 'set-event', id: event.id })}>
              <strong>{event.name}</strong>
              <span>
                {event.date} · {event.venue}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
