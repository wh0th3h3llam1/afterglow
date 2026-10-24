import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "node:path";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { openDatabase } from "./db";
import { createStore } from "./store";
import { deliverVersion } from "./delivery";

describe("delivery adapter", () => {
  let opened: ReturnType<typeof openDatabase>;
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    opened = openDatabase(":memory:");
    migrate(opened.db, { migrationsFolder: resolve("drizzle") });
    store = createStore(opened.db);
  });
  afterEach(() => opened.sqlite.close());

  function approvedVersion(mode: "LIVE" | "DRY_RUN") {
    const conversation = store.capture("Met Mira and promised to follow up.", mode);
    const contact = store.saveContact({ conversationId: conversation.id, name: "Mira", email: "mira@example.com" });
    const { version } = store.createDraft({ conversationId: conversation.id, contactId: contact.id, recipientName: "Mira", recipientEmail: "mira@example.com", subject: "Following up", body: "Mira, it was good to meet you. Best, Ash", resourceLinks: [] });
    const approval = store.addPendingApproval({ draftVersionId: version.id, sessionId: "session-1", turnId: "turn-1", threadId: "main", toolCallId: "call-1", sourceEventId: "event-1" });
    store.decideApproval({ approvalId: approval.id, decision: "allow", sessionId: "session-1", toolCallId: "call-1" });
    return version;
  }

  it("records a dry run without calling a provider", async () => {
    const version = approvedVersion("DRY_RUN");
    const sendLive = vi.fn();
    const writeOutbox = vi.fn().mockResolvedValue("outbox/test.json");
    const result = await deliverVersion(store, version.id, sendLive, writeOutbox);
    expect(result.status).toBe("dry_run");
    expect(result.providerReceipt).toBe("outbox/test.json");
    expect(sendLive).not.toHaveBeenCalled();
    expect(writeOutbox).toHaveBeenCalledTimes(1);
  });

  it("writes an ignored local outbox file for an actual dry run", async () => {
    const version = approvedVersion("DRY_RUN");
    const sendLive = vi.fn();
    const result = await deliverVersion(store, version.id, sendLive);
    const path = resolve("data", result.providerReceipt!);
    try {
      expect(result.status).toBe("dry_run");
      expect(existsSync(path)).toBe(true);
      expect(JSON.parse(readFileSync(path, "utf8"))).toMatchObject({ draftVersionId: version.id, recipientEmail: "mira@example.com", mode: "DRY_RUN" });
      expect(sendLive).not.toHaveBeenCalled();
    } finally { if (existsSync(path)) unlinkSync(path); }
  });

  it("repeated requests return the first live receipt", async () => {
    const version = approvedVersion("LIVE");
    const sendLive = vi.fn().mockResolvedValue({ kind: "sent", receipt: "resend-1" });
    const first = await deliverVersion(store, version.id, sendLive);
    const second = await deliverVersion(store, version.id, sendLive);
    expect(first.status).toBe("sent");
    expect(second.status).toBe("sent");
    expect(sendLive).toHaveBeenCalledTimes(1);
  });

  it("holds an uncertain provider outcome instead of retrying", async () => {
    const version = approvedVersion("LIVE");
    const sendLive = vi.fn().mockRejectedValue(new Error("timeout"));
    const first = await deliverVersion(store, version.id, sendLive);
    const second = await deliverVersion(store, version.id, sendLive);
    expect(first.status).toBe("delivery_unknown");
    expect(second.status).toBe("delivery_unknown");
    expect(sendLive).toHaveBeenCalledTimes(1);
  });

  it("records a definite provider rejection without claiming delivery", async () => {
    const version = approvedVersion("LIVE");
    const sendLive = vi.fn().mockResolvedValue({ kind: "failed", reason: "Invalid verified sender" });
    const result = await deliverVersion(store, version.id, sendLive);
    expect(result.status).toBe("failed");
    expect(result.providerReceipt).toBeNull();
    expect(result.failureReason).toBe("Invalid verified sender");
    expect((await deliverVersion(store, version.id, sendLive)).status).toBe("failed");
    expect(sendLive).toHaveBeenCalledTimes(1);
  });
});
