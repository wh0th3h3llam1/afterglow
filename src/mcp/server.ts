import { timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { z } from "zod";
import { deliverVersion } from "../lib/delivery";
import { getStore } from "../lib/server-store";

const token = process.env.AFTERGLOW_MCP_TOKEN;
if (!token || token.length < 24) throw new Error("Set a long AFTERGLOW_MCP_TOKEN in .env.local");

function authorized(header: string | undefined) {
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function result(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function safe<T>(work: () => T | Promise<T>) {
  return Promise.resolve().then(work).then(result).catch((error: unknown) => ({
    isError: true,
    content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Tool failed" }],
  }));
}

function createServer() {
  const server = new McpServer({ name: "afterglow", version: "0.1.0" });
  const store = getStore();

  server.registerTool("list_contacts", {
    description: "List saved contacts for the current captured conversation.",
    inputSchema: { conversationId: z.string().uuid() },
    annotations: { readOnlyHint: true },
  }, ({ conversationId }) => safe(() => store.listContacts(conversationId)));

  server.registerTool("save_contact", {
    description: "Save a person explicitly identified in the user's notes. For a clarification, pass contactId to update that person. Never infer an email address.",
    inputSchema: { conversationId: z.string().uuid(), contactId: z.string().uuid().optional(), name: z.string().min(1).max(160), email: z.email().optional(), organization: z.string().max(160).optional() },
  }, (input) => safe(() => input.contactId ? store.updateContact(input.contactId, input) : store.saveContact(input)));

  server.registerTool("save_promise", {
    description: "Record a specific commitment from the source notes. Mark requiresResource for a promised link or attachment.",
    inputSchema: { conversationId: z.string().uuid(), contactId: z.string().uuid().optional(), description: z.string().min(1).max(500), requiresResource: z.boolean().optional(), resourceLink: z.url().optional() },
  }, (input) => safe(() => store.savePromise(input)));

  server.registerTool("save_draft", {
    description: "Persist one complete follow-up. For a redraft, pass draftId and expectedVersionId to create an immutable revision of that draft. A promised resource must appear in the reviewed body and resourceLinks.",
    inputSchema: { conversationId: z.string().uuid(), contactId: z.string().uuid().optional(), draftId: z.string().uuid().optional(), expectedVersionId: z.string().uuid().optional(), recipientName: z.string().min(1).max(160), recipientEmail: z.email(), subject: z.string().min(1).max(240), body: z.string().min(1).max(10000), resourceLinks: z.array(z.url()).max(20) },
  }, (input) => safe(() => {
    if (input.draftId || input.expectedVersionId) {
      if (!input.draftId || !input.expectedVersionId || store.getDraft(input.draftId)?.conversationId !== input.conversationId) throw new Error("Redraft requires the current draft and version in this conversation");
      return { version: store.reviseDraft(input.draftId, input.expectedVersionId, input) };
    }
    return store.createDraft(input);
  }));

  server.registerTool("get_draft", {
    description: "Read a draft and its current immutable version before requesting approval.",
    inputSchema: { draftId: z.string().uuid() },
    annotations: { readOnlyHint: true },
  }, ({ draftId }) => safe(() => {
    const draft = store.getDraft(draftId);
    if (!draft) throw new Error("Draft not found");
    return { draft, version: draft.currentVersionId ? store.getVersion(draft.currentVersionId) : null };
  }));

  server.registerTool("list_promises", {
    description: "List commitments captured from the conversation; a sent email alone does not mark one kept.",
    inputSchema: { conversationId: z.string().uuid() },
    annotations: { readOnlyHint: true },
  }, ({ conversationId }) => safe(() => store.listPromises(conversationId)));

  server.registerTool("set_promise_resource", {
    description: "Set the exact promised URL after the user supplies it. Do not invent a resource.",
    inputSchema: { promiseId: z.string().uuid(), resourceLink: z.url() },
  }, ({ promiseId, resourceLink }) => safe(() => {
    if (!store.getPromise(promiseId)) throw new Error("Promise not found");
    store.setPromiseResource(promiseId, resourceLink);
    return store.getPromise(promiseId);
  }));

  server.registerTool("mark_promise_kept", {
    description: "Mark a promised resource kept only when a successful live delivery for the matching draft and contact contains that resource.",
    inputSchema: { promiseId: z.string().uuid(), evidenceDraftVersionId: z.string().uuid() },
  }, ({ promiseId, evidenceDraftVersionId }) => safe(() => {
    const promise = store.getPromise(promiseId);
    const version = store.getVersion(evidenceDraftVersionId);
    const draft = version ? store.getDraft(version.draftId) : undefined;
    const delivery = store.getDelivery(evidenceDraftVersionId);
    if (!promise || !version || !draft || draft.conversationId !== promise.conversationId || delivery?.status !== "sent") throw new Error("Matching confirmed live delivery is required");
    if (promise.contactId && draft.contactId !== promise.contactId) throw new Error("Delivered to a different contact");
    if (!promise.requiresResource || !promise.resourceLink || !JSON.parse(version.resourceLinksJson).includes(promise.resourceLink)) throw new Error("Promise-specific resource evidence is required");
    return store.markPromiseKept(promiseId);
  }));

  server.registerTool("send_email", {
    description: "Deliver only an immutable approved draft version. TrueForge MUST pause for explicit human approval before this tool runs. Do not pass arbitrary message text.",
    inputSchema: { draftVersionId: z.string().uuid() },
  }, ({ draftVersionId }) => safe(() => deliverVersion(store, draftVersionId)));

  return server;
}

const app = createMcpExpressApp({ host: "127.0.0.1" });
app.post("/mcp", async (req, res) => {
  if (!authorized(req.headers.authorization)) return void res.status(401).json({ error: "Unauthorized" });
  if (!req.body) return void res.status(400).json({ error: "Invalid MCP request" });
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { void transport.close(); void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed", error);
    if (!res.headersSent) res.status(500).json({ error: "MCP request failed" });
  }
});
app.get("/health", (_req, res) => res.json({ status: "ok", service: "afterglow-mcp" }));
app.get("/mcp", (_req, res) => res.status(405).end());
app.delete("/mcp", (_req, res) => res.status(405).end());

const port = Number(process.env.AFTERGLOW_MCP_PORT ?? 3401);
app.listen(port, "127.0.0.1", () => console.log(`Afterglow MCP listening on http://127.0.0.1:${port}/mcp`));
