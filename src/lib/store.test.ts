import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "node:path";
import { openDatabase } from "./db";
import { createStore } from "./store";

describe("Afterglow persistence and delivery guards", () => {
  let opened: ReturnType<typeof openDatabase>;
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    opened = openDatabase(":memory:");
    migrate(opened.db, { migrationsFolder: resolve("drizzle") });
    store = createStore(opened.db);
  });
  afterEach(() => opened.sqlite.close());

  function readyDraft() {
    const conversation = store.capture("Met Mira about her climate data project; promised the repo.", "DRY_RUN");
    const contact = store.saveContact({ conversationId: conversation.id, name: "Mira", email: "mira@example.com" });
    store.savePromise({ conversationId: conversation.id, contactId: contact.id, description: "Share the repo", requiresResource: true, resourceLink: "https://example.com/repo" });
    const { draft, version } = store.createDraft({
      conversationId: conversation.id,
      contactId: contact.id,
      recipientName: "Mira",
      recipientEmail: "mira@example.com",
      subject: "Great meeting you",
      body: "Mira, I enjoyed hearing about your climate data project. Here is the repo: https://example.com/repo. Best, Ash",
      resourceLinks: ["https://example.com/repo"],
    });
    return { conversation, draft, version };
  }

  it("keeps raw notes separate and refuses a draft missing a promised resource", () => {
    const conversation = store.capture("Promised to share a repo with Mira.", "DRY_RUN");
    store.savePromise({ conversationId: conversation.id, description: "Share the repo", requiresResource: true });
    expect(() => store.createDraft({ conversationId: conversation.id, recipientName: "Mira", recipientEmail: "mira@example.com", subject: "Hello", body: "I will send the repo soon.", resourceLinks: [] })).toThrow(/resource/i);
    expect(store.getConversation(conversation.id)?.rawNotes).toBe("Promised to share a repo with Mira.");
  });

  it("invalidates a pending approval when reviewed content changes", () => {
    const { conversation, draft, version } = readyDraft();
    const approval = store.addPendingApproval({ draftVersionId: version.id, sessionId: "session-1", turnId: "turn-1", threadId: "main", toolCallId: "call-1", sourceEventId: "event-1" });
    const next = store.reviseDraft(draft.id, version.id, { body: `${version.body}\nLet's keep in touch.` });
    expect(next.versionNumber).toBe(2);
    expect(next.id).not.toBe(version.id);
    expect(store.getApproval(approval.id)?.status).toBe("invalidated");
    expect(() => store.decideApproval({ approvalId: approval.id, decision: "allow", sessionId: "session-1", toolCallId: "call-1" })).toThrow(/current|invalidated/i);
    expect(store.getConversation(conversation.id)?.rawNotes).toContain("climate data");
  });

  it("does not let an edit redirect a saved contact's draft to another address", () => {
    const { draft, version } = readyDraft();
    expect(() => store.reviseDraft(draft.id, version.id, { recipientEmail: "other@example.com" })).toThrow(/match/i);
    expect(store.getDraft(draft.id)?.currentVersionId).toBe(version.id);
  });

  it("binds approval to the stored session and tool call", () => {
    const { version } = readyDraft();
    const approval = store.addPendingApproval({ draftVersionId: version.id, sessionId: "session-1", turnId: "turn-1", threadId: "main", toolCallId: "call-1", sourceEventId: "event-1" });
    expect(() => store.decideApproval({ approvalId: approval.id, decision: "allow", sessionId: "other-session", toolCallId: "call-1" })).toThrow(/session/i);
    expect(() => store.decideApproval({ approvalId: approval.id, decision: "allow", sessionId: "session-1", toolCallId: "other-call" })).toThrow(/tool call/i);
    expect(store.decideApproval({ approvalId: approval.id, decision: "allow", sessionId: "session-1", toolCallId: "call-1" }).status).toBe("allowed");
  });

  it("refuses a missing address or an address attached to a different person", () => {
    const conversation = store.capture("Met Mira and another attendee. Mira's address was not recorded.", "DRY_RUN");
    const mira = store.saveContact({ conversationId: conversation.id, name: "Mira" });
    store.saveContact({ conversationId: conversation.id, name: "Leah", email: "leah@example.com" });
    const draft = { conversationId: conversation.id, contactId: mira.id, recipientName: "Mira", recipientEmail: "leah@example.com", subject: "Hello", body: "Good to meet you.", resourceLinks: [] };
    expect(() => store.createDraft(draft)).toThrow(/missing/i);
    const other = store.saveContact({ conversationId: conversation.id, name: "Mira", email: "mira@example.com" });
    expect(() => store.createDraft({ ...draft, contactId: other.id, recipientEmail: "leah@example.com" })).toThrow(/match/i);
  });

  it("lets clarification update a contact and a promised resource", () => {
    const conversation = store.capture("Met Mira and promised her a repository link.", "DRY_RUN");
    const contact = store.saveContact({ conversationId: conversation.id, name: "Mira" });
    const promise = store.savePromise({ conversationId: conversation.id, contactId: contact.id, description: "Share the repository", requiresResource: true });
    store.updateContact(contact.id, { conversationId: conversation.id, email: "mira@example.com" });
    store.setPromiseResource(promise.id, "https://example.com/repo");
    expect(store.createDraft({ conversationId: conversation.id, contactId: contact.id, recipientName: "Mira", recipientEmail: "mira@example.com", subject: "The repo", body: "Here is the repo: https://example.com/repo", resourceLinks: ["https://example.com/repo"] }).version.versionNumber).toBe(1);
  });

  it("keeps a contact-specific promised link off another contact's draft", () => {
    const conversation = store.capture("Met Mira and Leah. Promised Mira a repository link.", "DRY_RUN");
    const mira = store.saveContact({ conversationId: conversation.id, name: "Mira", email: "mira@example.com" });
    const leah = store.saveContact({ conversationId: conversation.id, name: "Leah", email: "leah@example.com" });
    store.savePromise({ conversationId: conversation.id, contactId: mira.id, description: "Share the repository", requiresResource: true, resourceLink: "https://example.com/repo" });
    expect(store.createDraft({ conversationId: conversation.id, contactId: leah.id, recipientName: "Leah", recipientEmail: "leah@example.com", subject: "Good to meet you", body: "Leah, good to meet you.", resourceLinks: [] }).version.versionNumber).toBe(1);
  });

  it("denial never grants delivery and duplicate decisions are rejected", () => {
    const { version } = readyDraft();
    const approval = store.addPendingApproval({ draftVersionId: version.id, sessionId: "session-1", turnId: "turn-1", threadId: "main", toolCallId: "call-1", sourceEventId: "event-1" });
    store.decideApproval({ approvalId: approval.id, decision: "deny", sessionId: "session-1", toolCallId: "call-1" });
    expect(() => store.claimDelivery(version.id)).toThrow(/approval/i);
    expect(() => store.decideApproval({ approvalId: approval.id, decision: "allow", sessionId: "session-1", toolCallId: "call-1" })).toThrow(/pending/i);
  });

  it("claims one delivery per approved immutable version", () => {
    const { version } = readyDraft();
    const approval = store.addPendingApproval({ draftVersionId: version.id, sessionId: "session-1", turnId: "turn-1", threadId: "main", toolCallId: "call-1", sourceEventId: "event-1" });
    expect(() => store.claimDelivery(version.id)).toThrow(/approval/i);
    store.decideApproval({ approvalId: approval.id, decision: "allow", sessionId: "session-1", toolCallId: "call-1" });
    const first = store.claimDelivery(version.id);
    const second = store.claimDelivery(version.id);
    expect(first.kind).toBe("claimed");
    expect(second.kind).toBe("existing");
    expect(first.delivery.idempotencyKey).toBe(second.delivery.idempotencyKey);
    store.completeDelivery(first.delivery.id, "dry_run", "outbox-1");
    expect(store.claimDelivery(version.id).delivery.status).toBe("dry_run");
  });

  it("never treats a sent email as proof that a promise is kept", () => {
    const { conversation, version } = readyDraft();
    const approval = store.addPendingApproval({ draftVersionId: version.id, sessionId: "session-1", turnId: "turn-1", threadId: "main", toolCallId: "call-1", sourceEventId: "event-1" });
    store.decideApproval({ approvalId: approval.id, decision: "allow", sessionId: "session-1", toolCallId: "call-1" });
    const claim = store.claimDelivery(version.id);
    store.completeDelivery(claim.delivery.id, "dry_run", "outbox-1");
    expect(store.listPromises(conversation.id)[0]?.status).toBe("open");
  });
});
