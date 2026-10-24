import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openDatabase } from "./db";
import { createStore } from "./store";
import { deliverVersion } from "./delivery";
import { seedReplay } from "./replay";

describe("recovery and replay isolation", () => {
  const path = resolve(`data/test-recovery-${randomUUID()}.sqlite`);
  let opened: ReturnType<typeof openDatabase>;
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    opened = openDatabase(path);
    migrate(opened.db, { migrationsFolder: resolve("drizzle") });
    store = createStore(opened.db);
  });
  afterEach(() => {
    opened.sqlite.close();
    for (const suffix of ["", "-wal", "-shm"]) if (existsSync(path + suffix)) unlinkSync(path + suffix);
  });

  it("restores a pending version and exact approval references after reopening SQLite", () => {
    const conversation = store.capture("Met Mira, mira@example.com, about climate data.", "DRY_RUN");
    const contact = store.saveContact({ conversationId: conversation.id, name: "Mira", email: "mira@example.com" });
    const { draft, version } = store.createDraft({ conversationId: conversation.id, contactId: contact.id, recipientName: "Mira", recipientEmail: "mira@example.com", subject: "Climate data", body: "Good to meet you, Mira.", resourceLinks: [] });
    const approval = store.addPendingApproval({ draftVersionId: version.id, sessionId: "session-1", turnId: "turn-1", threadId: "main", toolCallId: "call-1", sourceEventId: "event-1" });
    opened.sqlite.close();
    opened = openDatabase(path);
    store = createStore(opened.db);
    expect(store.getConversation(conversation.id)?.sessionId).toBe("session-1");
    expect(store.getDraft(draft.id)?.currentVersionId).toBe(version.id);
    expect(store.getApproval(approval.id)).toMatchObject({ sessionId: "session-1", turnId: "turn-1", toolCallId: "call-1", sourceEventId: "event-1", status: "pending" });
  });

  it("replay fixture cannot call a delivery provider", async () => {
    const conversationId = seedReplay(store);
    const draft = store.listDrafts(conversationId)[0];
    const provider = vi.fn();
    await expect(deliverVersion(store, draft.currentVersionId!, provider)).rejects.toThrow(/Replay/i);
    expect(provider).not.toHaveBeenCalled();
    expect(store.getConversation(conversationId)?.mode).toBe("REPLAY");
  });

  it("changes interrupted sending to an uncertain outcome", () => {
    const conversation = store.capture("Met Mira, mira@example.com, about climate data.", "LIVE");
    const contact = store.saveContact({ conversationId: conversation.id, name: "Mira", email: "mira@example.com" });
    const { version } = store.createDraft({ conversationId: conversation.id, contactId: contact.id, recipientName: "Mira", recipientEmail: "mira@example.com", subject: "Climate data", body: "Good to meet you, Mira.", resourceLinks: [] });
    const approval = store.addPendingApproval({ draftVersionId: version.id, sessionId: "session-1", turnId: "turn-1", threadId: "main", toolCallId: "call-1", sourceEventId: "event-1" });
    store.decideApproval({ approvalId: approval.id, decision: "allow", sessionId: "session-1", toolCallId: "call-1" });
    store.claimDelivery(version.id);
    expect(store.recoverStaleDeliveries(new Date(Date.now() + 1000).toISOString())).toBe(1);
    expect(store.getDelivery(version.id)?.status).toBe("delivery_unknown");
    expect(store.claimDelivery(version.id).kind).toBe("existing");
  });
});
