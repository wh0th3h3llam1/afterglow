import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "node:path";
import { openDatabase } from "./db";
import { createStore } from "./store";

const mocks = vi.hoisted(() => ({ getStore: vi.fn(), listEvents: vi.fn(), getTurn: vi.fn(), getSession: vi.fn() }));
vi.mock("./server-store", () => ({ getStore: mocks.getStore }));
vi.mock("@truefoundry/trueforge-sdk", () => ({ TrueForge: class {
  sessions = { listEvents: mocks.listEvents, getTurn: mocks.getTurn, get: mocks.getSession };
} }));

import { inspectConversationRuntime, recoverConversation } from "./trueforge";

describe("TrueForge turn recovery", () => {
  let opened: ReturnType<typeof openDatabase>;
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    opened = openDatabase(":memory:");
    migrate(opened.db, { migrationsFolder: resolve("drizzle") });
    store = createStore(opened.db);
    mocks.getStore.mockReturnValue(store);
    mocks.listEvents.mockReset();
    mocks.getTurn.mockReset();
    mocks.getSession.mockReset();
  });
  afterEach(() => opened.sqlite.close());

  it.each(["paused", "done"] as const)("restores a %s exact-version approval once after a process restart", async (turnStatus) => {
    const conversation = store.capture("Met Mira and promised to follow up.", "DRY_RUN");
    const contact = store.saveContact({ conversationId: conversation.id, name: "Mira", email: "mira@example.com" });
    const { version } = store.createDraft({ conversationId: conversation.id, contactId: contact.id, recipientName: "Mira", recipientEmail: "mira@example.com", subject: "Following up", body: "Good meeting you, Mira.", resourceLinks: [] });
    store.setConversation(conversation.id, { sessionId: "session-1", activeTurnId: "turn-1", status: "processing" });
    const createdAt = new Date().toISOString();
    const source = { id: "source-1", type: "model.message", threadId: "main", createdAt, toolCalls: [{ id: "call-1", type: "function", function: { name: "send_email", arguments: JSON.stringify({ draftVersionId: version.id }) }, toolInfo: { type: "mcp", serverId: "server-1", serverName: "afterglow", name: "send_email" } }] };
    const pause = { id: "pause-1", type: "tool.approval_required", threadId: "main", createdAt, toolCalls: [{ id: "call-1", sourceEventId: "source-1" }] };
    const items = [{ event: pause, turnId: "turn-1" }, { event: source, turnId: "turn-1" }];
    mocks.listEvents.mockImplementation(async () => ({ data: items, async *[Symbol.asyncIterator]() { yield* items; } }));
    const state = turnStatus === "paused"
      ? { status: "paused", actionRequiredOnEvents: [{ id: "pause-1" }] }
      : { status: "done", output: null, requiredActions: [pause] };
    mocks.getTurn.mockResolvedValue({ data: { id: "turn-1", sessionId: "session-1", state } });

    await recoverConversation(conversation.id);
    expect(store.getConversation(conversation.id)?.status).toBe("awaiting_approval");
    expect(store.listApprovals(version.id)).toMatchObject([{ draftVersionId: version.id, toolCallId: "call-1", status: "pending" }]);
    expect(store.listRunEvents(conversation.id)).toHaveLength(2);

    store.setConversation(conversation.id, { status: "processing" });
    await recoverConversation(conversation.id);
    expect(store.listApprovals(version.id)).toHaveLength(1);
    expect(store.listRunEvents(conversation.id)).toHaveLength(2);
  });

  it("restores a clarification even when another contact already has a draft", async () => {
    const conversation = store.capture("Met Mira and Leah; Leah's email is missing.", "DRY_RUN");
    const contact = store.saveContact({ conversationId: conversation.id, name: "Mira", email: "mira@example.com" });
    store.createDraft({ conversationId: conversation.id, contactId: contact.id, recipientName: "Mira", recipientEmail: "mira@example.com", subject: "Following up", body: "Good meeting you, Mira.", resourceLinks: [] });
    store.setConversation(conversation.id, { sessionId: "session-2", activeTurnId: "turn-2", status: "processing" });
    mocks.listEvents.mockResolvedValue({ data: [], async *[Symbol.asyncIterator]() {} });
    mocks.getTurn.mockResolvedValue({ data: { id: "turn-2", sessionId: "session-2", state: { status: "done", output: { content: "CLARIFY: What email should I use for Leah?" } } } });

    await recoverConversation(conversation.id);
    expect(store.getConversation(conversation.id)).toMatchObject({ status: "needs_input", question: "What email should I use for Leah?" });
    expect(store.listDrafts(conversation.id)).toHaveLength(1);
  });

  it("reports actual TrueForge MCP calls without claiming Daytona execution", async () => {
    const conversation = store.capture("Met Mira and promised to follow up.", "DRY_RUN");
    store.setConversation(conversation.id, { sessionId: "session-3" });
    mocks.getSession.mockResolvedValue({ data: { agent: { type: "inline", spec: {
      model: { name: "openai/gpt-5-4-mini" },
      skills: [{ name: "followup-voice" }],
      config: { sandbox: { enabled: true, environmentName: "afterglow-daytona" } },
    } } } });
    const events = [
      { event: { type: "turn.created" } },
      { event: { type: "model.message", toolCalls: [{ toolInfo: { type: "mcp", serverName: "afterglow", name: "save_draft" } }] } },
      { event: { type: "tool.approval_required" } },
    ];
    mocks.listEvents.mockResolvedValue({ async *[Symbol.asyncIterator]() { yield* events; } });

    expect(await inspectConversationRuntime(conversation.id)).toMatchObject({
      sessionId: "session-3", model: "openai/gpt-5-4-mini", turnCount: 1,
      modelMessageCount: 1, mcpToolCalls: ["afterglow.save_draft"], approvalPauseCount: 1,
      skillAttached: true, sandboxConfigured: true, sandboxEventObserved: false,
    });
  });
});
