import { askGraph, closeRepoIfLinked, explainFollowup, openOwes, rememberMeeting, wholeGraph } from './graph.mjs'
import { loadEnv } from './env.mjs'
import { readOutbox } from './outbox.mjs'
import { approveSend, denySend, followup, forgeStatus, phraseFacts } from './forge.mjs'
import { qodoStatus } from './qodo.mjs'

loadEnv()

function send(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(payload)
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export function attach(middlewares) {
  middlewares.use(async (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/')) return next()
    try {
      if (req.method === 'GET' && url.pathname === '/api/graph') {
        return send(res, 200, await wholeGraph())
      }
      if (req.method === 'GET' && url.pathname === '/api/path') {
        const path = await explainFollowup(url.searchParams.get('name') || undefined)
        if (!path) return send(res, 404, { error: 'No path' })
        return send(res, 200, path)
      }
      if (req.method === 'GET' && url.pathname === '/api/owes') {
        return send(res, 200, { owes: await openOwes(), graph: 'conference' })
      }
      if (req.method === 'GET' && url.pathname === '/api/forge') {
        return send(res, 200, await forgeStatus())
      }
      if (req.method === 'GET' && url.pathname === '/api/qodo') {
        return send(res, 200, await qodoStatus())
      }
      if (req.method === 'GET' && url.pathname === '/api/outbox') {
        return send(res, 200, { records: readOutbox() })
      }
      if (req.method === 'POST' && url.pathname === '/api/ask') {
        const body = await readBody(req)
        const found = await askGraph(body.question || '')
        const phrased = found.people.length ? await phraseFacts(found.sentence) : found.sentence
        const named = found.people.every((person) => {
          const text = phrased.toLowerCase()
          const name = String(person.name || person).toLowerCase()
          const org = String(person.org || '').toLowerCase()
          return text.includes(name) && (!org || text.includes(org))
        })
        const qodo = await qodoStatus()
        return send(res, 200, {
          sentence: named ? phrased : found.sentence,
          people: found.people,
          qodo: qodo.connected ? 'Qodo connected' : '',
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/meetings') {
        const body = await readBody(req)
        const path = await rememberMeeting(body)
        return send(res, 200, path ?? { error: 'Meeting stored without a path' })
      }
      if (req.method === 'POST' && url.pathname === '/api/followup') {
        const body = await readBody(req)
        return send(res, 200, await followup(body))
      }
      if (req.method === 'POST' && url.pathname === '/api/approve') {
        const body = await readBody(req)
        if (body.allow === false) return send(res, 200, await denySend())
        const closed = await closeRepoIfLinked(body.body || '', body.repoUrl || '')
        const result = await approveSend(body)
        return send(res, 200, { ...result, repoClosed: closed.closed, delivery: 'proof' })
      }
      return send(res, 404, { error: 'Unknown API route' })
    } catch (error) {
      return send(res, 500, { error: error instanceof Error ? error.message : 'Server error' })
    }
  })
}
