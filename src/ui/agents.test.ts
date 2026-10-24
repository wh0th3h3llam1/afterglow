import { describe, expect, it } from 'vitest'
import { initialState } from '../hall/machine'
import { classifyVoice, daySummary, matchPeople } from './agents'

describe('voice routing', () => {
  const sessions = Object.values(initialState().sessions)

  it('keeps one named follow-up and both Priyas', () => {
    const mara = classifyVoice('follow up with Mara about the seed round')
    expect(mara).toMatchObject({ kind: 'followup', name: 'Mara' })
    expect(matchPeople('Mara', sessions).map((item) => item.id)).toEqual(['mara'])
    expect(matchPeople('Priya', sessions).map((item) => item.id).sort()).toEqual(['priya', 'priya-harbor'])
    expect(matchPeople('Priya from Keel', sessions).map((item) => item.id)).toEqual(['priya-harbor'])
  })

  it('sends find and a bare name to search, and a day phrase to the summary', () => {
    expect(classifyVoice('find Elena')).toEqual({ kind: 'search', query: 'Elena' })
    expect(classifyVoice('who is Nico')).toEqual({ kind: 'search', query: 'Nico' })
    expect(classifyVoice('summarize my day')).toEqual({ kind: 'day' })
  })

  it('summarizes the current conference and an empty hall', () => {
    const summary = daySummary(sessions, 'patch')
    expect(summary).toContain('Mara at Loomline')
    expect(summary).not.toContain('Tess')
    expect(daySummary([], 'patch')).toBe('No meetings are on this conference yet.')
  })
})
