import { loadEnv } from './env.mjs'

loadEnv()

const ENDPOINT = 'https://sdk.qodo.ai/v1/tools/mcp/'

function parseBody(text) {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return null
    }
  }
  const data = trimmed
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]')
    .at(-1)
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

async function rpc(body, sessionId) {
  const key = process.env.QODO_API_KEY
  if (!key) throw new Error('Qodo key is missing on the server')
  const headers = {
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  }
  if (sessionId) headers['mcp-session-id'] = sessionId
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  })
  const text = await response.text()
  return {
    ok: response.ok,
    status: response.status,
    sessionId: response.headers.get('mcp-session-id') || sessionId || '',
    body: parseBody(text),
  }
}

export async function qodoStatus() {
  if (!process.env.QODO_API_KEY) return { connected: false, tools: [] }
  try {
    const opened = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'afterglow', version: '1.0.0' },
      },
    })
    if (!opened.ok) return { connected: false, tools: [] }
    const listed = await rpc(
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      opened.sessionId,
    )
    const tools = (listed.body?.result?.tools || []).map((tool) => tool.name).filter(Boolean)
    return { connected: listed.ok && tools.length > 0, tools }
  } catch {
    return { connected: false, tools: [] }
  }
}
