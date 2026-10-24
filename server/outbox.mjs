import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = resolve(process.cwd(), 'server', 'outbox.json')

export function readOutbox() {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return []
  }
}

export function writeOutbox(record) {
  const next = [...readOutbox(), { ...record, at: new Date().toISOString() }]
  writeFileSync(file, JSON.stringify(next, null, 2))
  return next[next.length - 1]
}
