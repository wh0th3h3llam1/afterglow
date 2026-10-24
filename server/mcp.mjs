import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { explainFollowup, rememberMeeting } from './graph.mjs'
import { writeOutbox } from './outbox.mjs'

const PORT = 8795

function tools() {
  const server = new McpServer({ name: 'afterglow', version: '1.0.0' })
  server.registerTool(
    'remember_meeting',
    {
      description: 'Write one conference conversation into the FalkorDB conference graph.',
      inputSchema: {
        name: z.string().describe('First name of the person'),
        org: z.string().describe('Organization'),
        topic: z.string().describe('What you talked about'),
        email: z.string().describe('Email, or an empty string if it was not in the note'),
        intro: z.boolean().describe('True when they offered an introduction'),
      },
    },
    async (args) => {
      const path = await rememberMeeting(args)
      return { content: [{ type: 'text', text: JSON.stringify(path) }] }
    },
  )
  server.registerTool(
    'explain_followup',
    {
      description: 'Return the multi-hop path that explains the follow-up.',
      inputSchema: { name: z.string().describe('Person name') },
      annotations: { readOnlyHint: true },
    },
    async ({ name }) => {
      const path = await explainFollowup(name)
      return { content: [{ type: 'text', text: JSON.stringify(path) }] }
    },
  )
  server.registerTool(
    'save_draft',
    {
      description: 'Store the letter subject and body. Do not invent facts that were not in the note or the tools.',
      inputSchema: {
        subject: z.string(),
        body: z.string(),
      },
    },
    async ({ subject, body }) => {
      return { content: [{ type: 'text', text: JSON.stringify({ subject, body }) }] }
    },
  )
  server.registerTool(
    'send_email',
    {
      description: 'Record the approved letter in the local outbox. This never calls a mail provider.',
      inputSchema: {
        to: z.string(),
        subject: z.string(),
        body: z.string(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ to, subject, body }) => {
      const record = writeOutbox({ to, subject, body, provider: null })
      return { content: [{ type: 'text', text: `Local outbox only. No provider. ${record.at}` }] }
    },
  )
  return server
}

let started

export function startMcp() {
  if (started) return started
  started = new Promise((resolve, reject) => {
    const app = createMcpExpressApp({ host: '127.0.0.1' })
    app.post('/mcp', async (req, res) => {
      const server = tools()
      try {
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
        await server.connect(transport)
        await transport.handleRequest(req, res, req.body)
        res.on('close', () => {
          transport.close()
          server.close()
        })
      } catch (error) {
        if (!res.headersSent) res.status(500).json({ error: error instanceof Error ? error.message : 'MCP error' })
      }
    })
    app.listen(PORT, '127.0.0.1', () => resolve(PORT))
    app.on?.('error', reject)
  })
  return started
}
