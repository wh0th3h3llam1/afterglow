import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadEnv(root = process.cwd()) {
  let text = ''
  try {
    text = readFileSync(resolve(root, '.env'), 'utf8')
  } catch {
    return
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (process.env[key] == null || process.env[key] === '') process.env[key] = value
  }
}
