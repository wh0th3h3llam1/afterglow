import { EVENTS } from '../hall/fixtures'
import type { Dispatch } from 'react'
import type { Action } from '../hall/types'
import { Mark } from './Mark'

export function Landing({ dispatch }: { dispatch: Dispatch<Action> }) {
  return (
    <div className="landing">
      <div className="landing-bg" aria-hidden="true">
        <div className="landing-light" />
        <div className="landing-floor" />
        <div className="landing-stage">
          <div className="landing-badge">
            <span>Priya</span>
            <small>Nimbus</small>
          </div>
          <div className="landing-badge">
            <span>Mara</span>
            <small>Loomline</small>
          </div>
          <div className="landing-badge">
            <span>Elena</span>
            <small>Ashlar</small>
          </div>
          <div className="landing-badge">
            <span>Jonah</span>
            <small>Northline</small>
          </div>
        </div>
      </div>
      <header className="landing-bar">
        <p className="brand">
          <Mark />
          Afterglow
        </p>
        <a href="#graph">Graph</a>
      </header>
      <section className="landing-hero">
        <h1>Follow up before the badge goes cold.</h1>
        <p>Afterglow turns a conference meeting into a letter you approve, with the promise still attached.</p>
        <div className="landing-actions">
          <a className="fill" href="#halls">
            Enter the hall
          </a>
          <a className="ghost" href="#graph">
            Conference graph
          </a>
        </div>
      </section>
      <section className="landing-use">
        <h2>What you do with it</h2>
        <ol>
          <li>
            <strong>Write the note.</strong> Who you met, and what you promised. Nothing gets invented.
          </li>
          <li>
            <strong>Read the letter.</strong> It is signed Aarsh, and it stays a draft until you approve it.
          </li>
          <li>
            <strong>Keep the promise.</strong> The graph remembers the meeting. The mail stays on this machine.
          </li>
        </ol>
      </section>
      <section className="landing-halls" id="halls">
        <h2>Pick a conference</h2>
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
      </section>
    </div>
  )
}
