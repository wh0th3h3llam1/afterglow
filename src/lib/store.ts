import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, lt } from "drizzle-orm";
import type { AfterglowDb } from "./db";
import { approvals, contacts, conversations, deliveries, drafts, draftVersions, promises, runEvents } from "./schema";

export type Mode = "LIVE" | "DRY_RUN" | "REPLAY";
export type DraftContent = {
  recipientName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  resourceLinks: string[];
};

const now = () => new Date().toISOString();
const id = () => randomUUID();

function hashContent(content: DraftContent) {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

function parseLinks(json: string) {
  const parsed: unknown = JSON.parse(json);
  return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
}

export function createStore(db: AfterglowDb) {
  function getConversation(conversationId: string) {
    return db.select().from(conversations).where(eq(conversations.id, conversationId)).get();
  }

  function getDraft(draftId: string) {
    return db.select().from(drafts).where(eq(drafts.id, draftId)).get();
  }

  function getVersion(versionId: string) {
    return db.select().from(draftVersions).where(eq(draftVersions.id, versionId)).get();
  }

  function getApproval(approvalId: string) {
    return db.select().from(approvals).where(eq(approvals.id, approvalId)).get();
  }

  function assertRecipient(conversationId: string, contactId: string | null | undefined, email: string) {
    if (!contactId) throw new Error("A specific saved contact is required for this draft");
    const contact = db.select().from(contacts).where(eq(contacts.id, contactId)).get();
    if (!contact || contact.conversationId !== conversationId) throw new Error("Contact does not belong to this conversation");
    if (!contact.email) throw new Error("Recipient email is missing; ask the user for it");
    if (contact.email.toLowerCase() !== email.trim().toLowerCase()) throw new Error("Recipient email does not match the identified contact");
  }

  function assertResources(conversationId: string, contactId: string | null | undefined, links: string[], body: string) {
    for (const link of links) if (!body.includes(link)) throw new Error("Resource link must appear in the reviewed body");
    for (const promise of db.select().from(promises).where(eq(promises.conversationId, conversationId)).all()) {
      if ((!promise.contactId || promise.contactId === contactId) && promise.requiresResource && (!promise.resourceLink || !links.includes(promise.resourceLink))) {
        throw new Error(`Missing promised resource for: ${promise.description}`);
      }
    }
  }

  function capture(rawNotes: string, mode: Mode) {
    if (!rawNotes.trim()) throw new Error("Notes are required");
    const row = { id: id(), rawNotes: rawNotes.trim(), mode, status: "captured" as const, createdAt: now(), updatedAt: now() };
    db.insert(conversations).values(row).run();
    return row;
  }

  function saveContact(input: { conversationId: string; name: string; email?: string | null; organization?: string | null }) {
    if (!getConversation(input.conversationId)) throw new Error("Conversation not found");
    const row = { id: id(), conversationId: input.conversationId, name: input.name.trim(), email: input.email ?? null, organization: input.organization ?? null, createdAt: now() };
    db.insert(contacts).values(row).run();
    return row;
  }

  function updateContact(contactId: string, input: { conversationId: string; name?: string; email?: string; organization?: string }) {
    const existing = db.select().from(contacts).where(eq(contacts.id, contactId)).get();
    if (!existing || existing.conversationId !== input.conversationId) throw new Error("Contact does not belong to this conversation");
    db.update(contacts).set({ name: input.name?.trim() ?? existing.name, email: input.email?.trim() ?? existing.email, organization: input.organization?.trim() ?? existing.organization }).where(eq(contacts.id, contactId)).run();
    return db.select().from(contacts).where(eq(contacts.id, contactId)).get()!;
  }

  function savePromise(input: { conversationId: string; contactId?: string | null; description: string; requiresResource?: boolean; resourceLink?: string | null }) {
    if (!getConversation(input.conversationId)) throw new Error("Conversation not found");
    if (input.contactId && db.select().from(contacts).where(eq(contacts.id, input.contactId)).get()?.conversationId !== input.conversationId) throw new Error("Promise contact does not belong to this conversation");
    const row = { id: id(), conversationId: input.conversationId, contactId: input.contactId ?? null, description: input.description.trim(), requiresResource: input.requiresResource ?? false, resourceLink: input.resourceLink ?? null, status: "open" as const, createdAt: now(), keptAt: null };
    db.insert(promises).values(row).run();
    return row;
  }

  function createDraft(input: DraftContent & { conversationId: string; contactId?: string | null }) {
    if (!getConversation(input.conversationId)) throw new Error("Conversation not found");
    assertResources(input.conversationId, input.contactId, input.resourceLinks, input.body);
    assertRecipient(input.conversationId, input.contactId, input.recipientEmail);
    if (!input.recipientEmail.trim() || !input.subject.trim() || !input.body.trim()) throw new Error("Recipient email, subject, and body are required");
    return db.transaction((tx) => {
      const draft = { id: id(), conversationId: input.conversationId, contactId: input.contactId ?? null, currentVersionId: null as string | null, status: "draft" as const, createdAt: now(), updatedAt: now() };
      const content: DraftContent = { recipientName: input.recipientName.trim(), recipientEmail: input.recipientEmail.trim(), subject: input.subject.trim(), body: input.body.trim(), resourceLinks: input.resourceLinks };
      const version = { id: id(), draftId: draft.id, versionNumber: 1, recipientName: content.recipientName, recipientEmail: content.recipientEmail, subject: content.subject, body: content.body, resourceLinksJson: JSON.stringify(content.resourceLinks), contentHash: hashContent(content), createdAt: now() };
      tx.insert(drafts).values(draft).run();
      tx.insert(draftVersions).values(version).run();
      tx.update(drafts).set({ currentVersionId: version.id }).where(eq(drafts.id, draft.id)).run();
      tx.update(conversations).set({ status: "draft_ready", updatedAt: now() }).where(eq(conversations.id, input.conversationId)).run();
      return { draft: { ...draft, currentVersionId: version.id }, version };
    });
  }

  function reviseDraft(draftId: string, expectedVersionId: string, changes: Partial<DraftContent>) {
    const draft = getDraft(draftId);
    if (!draft || draft.currentVersionId !== expectedVersionId) throw new Error("Draft version is not current");
    const previous = getVersion(expectedVersionId);
    if (!previous) throw new Error("Draft version not found");
    const content: DraftContent = {
      recipientName: changes.recipientName ?? previous.recipientName,
      recipientEmail: changes.recipientEmail ?? previous.recipientEmail,
      subject: changes.subject ?? previous.subject,
      body: changes.body ?? previous.body,
      resourceLinks: changes.resourceLinks ?? parseLinks(previous.resourceLinksJson),
    };
    assertResources(draft.conversationId, draft.contactId, content.resourceLinks, content.body);
    assertRecipient(draft.conversationId, draft.contactId, content.recipientEmail);
    if (!content.recipientEmail.trim() || !content.subject.trim() || !content.body.trim()) throw new Error("Recipient email, subject, and body are required");
    const version = { id: id(), draftId, versionNumber: previous.versionNumber + 1, recipientName: content.recipientName.trim(), recipientEmail: content.recipientEmail.trim(), subject: content.subject.trim(), body: content.body.trim(), resourceLinksJson: JSON.stringify(content.resourceLinks), contentHash: hashContent(content), createdAt: now() };
    db.transaction((tx) => {
      tx.insert(draftVersions).values(version).run();
      tx.update(drafts).set({ currentVersionId: version.id, status: "draft", updatedAt: now() }).where(eq(drafts.id, draftId)).run();
      tx.update(approvals).set({ status: "invalidated", decidedAt: now() }).where(and(eq(approvals.draftVersionId, expectedVersionId), eq(approvals.status, "pending"))).run();
      tx.update(conversations).set({ status: "draft_ready", updatedAt: now() }).where(eq(conversations.id, draft.conversationId)).run();
    });
    return version;
  }

  function addPendingApproval(input: { draftVersionId: string; sessionId: string; turnId: string; threadId: string; toolCallId: string; sourceEventId: string }) {
    const version = getVersion(input.draftVersionId);
    const draft = version ? getDraft(version.draftId) : undefined;
    if (!version || !draft || draft.currentVersionId !== version.id) throw new Error("Draft version is not current");
    const conversation = getConversation(draft.conversationId);
    if (!conversation || (conversation.sessionId && conversation.sessionId !== input.sessionId)) throw new Error("Approval session mismatch");
    const row = { id: id(), ...input, status: "pending" as const, createdAt: now(), decidedAt: null };
    db.transaction((tx) => {
      tx.insert(approvals).values(row).run();
      tx.update(conversations).set({ sessionId: input.sessionId, activeTurnId: input.turnId, status: "awaiting_approval", updatedAt: now() }).where(eq(conversations.id, draft.conversationId)).run();
      tx.update(drafts).set({ status: "awaiting_approval", updatedAt: now() }).where(eq(drafts.id, draft.id)).run();
    });
    return row;
  }

  function decideApproval(input: { approvalId: string; decision: "allow" | "deny"; sessionId: string; toolCallId: string }) {
    const approval = getApproval(input.approvalId);
    if (!approval || approval.status !== "pending") throw new Error("Approval is no longer pending or was invalidated");
    if (approval.sessionId !== input.sessionId) throw new Error("Approval session mismatch");
    if (approval.toolCallId !== input.toolCallId) throw new Error("Approval tool call mismatch");
    const version = getVersion(approval.draftVersionId);
    const draft = version ? getDraft(version.draftId) : undefined;
    if (!draft || draft.currentVersionId !== approval.draftVersionId) throw new Error("Draft version is not current");
    const status = input.decision === "allow" ? "allowed" : "denied";
    db.transaction((tx) => {
      tx.update(approvals).set({ status, decidedAt: now() }).where(eq(approvals.id, approval.id)).run();
      if (status === "denied") {
        tx.update(drafts).set({ status: "draft", updatedAt: now() }).where(eq(drafts.id, draft.id)).run();
        tx.update(conversations).set({ status: "draft_ready", updatedAt: now() }).where(eq(conversations.id, draft.conversationId)).run();
      }
    });
    return { ...approval, status };
  }

  function claimDelivery(draftVersionId: string) {
    const version = getVersion(draftVersionId);
    const draft = version ? getDraft(version.draftId) : undefined;
    if (!version || !draft || draft.currentVersionId !== version.id) throw new Error("Draft version is not current");
    const conversation = getConversation(draft.conversationId);
    if (!conversation || conversation.mode === "REPLAY") throw new Error("Replay cannot deliver");
    const allowed = db.select().from(approvals).where(and(eq(approvals.draftVersionId, version.id), eq(approvals.status, "allowed"))).get();
    if (!allowed || allowed.sessionId !== conversation.sessionId) throw new Error("Explicit TrueForge approval is required");
    const existing = db.select().from(deliveries).where(eq(deliveries.draftVersionId, version.id)).get();
    if (existing) return { kind: "existing" as const, delivery: existing };
    const row = { id: id(), draftVersionId, mode: conversation.mode, status: "sending" as const, idempotencyKey: `afterglow/draft-version/${draftVersionId}`, providerReceipt: null, failureReason: null, createdAt: now(), completedAt: null };
    try {
      db.transaction((tx) => {
        tx.insert(deliveries).values(row).run();
        tx.update(conversations).set({ status: "sending", updatedAt: now() }).where(eq(conversations.id, conversation.id)).run();
      });
      return { kind: "claimed" as const, delivery: row };
    } catch (error) {
      if (!(error instanceof Error) || !/UNIQUE/.test(error.message)) throw error;
      const concurrent = db.select().from(deliveries).where(eq(deliveries.draftVersionId, version.id)).get();
      if (!concurrent) throw error;
      return { kind: "existing" as const, delivery: concurrent };
    }
  }

  function completeDelivery(deliveryId: string, status: "sent" | "dry_run" | "failed" | "delivery_unknown", receipt?: string, failureReason?: string) {
    const delivery = db.select().from(deliveries).where(eq(deliveries.id, deliveryId)).get();
    if (!delivery || delivery.status !== "sending") throw new Error("Delivery is not in progress");
    const version = getVersion(delivery.draftVersionId)!;
    const draft = getDraft(version.draftId)!;
    db.transaction((tx) => {
      tx.update(deliveries).set({ status, providerReceipt: receipt ?? null, failureReason: failureReason ?? null, completedAt: now() }).where(eq(deliveries.id, deliveryId)).run();
      tx.update(drafts).set({ status, updatedAt: now() }).where(eq(drafts.id, draft.id)).run();
      tx.update(conversations).set({ status, updatedAt: now() }).where(eq(conversations.id, draft.conversationId)).run();
    });
  }

  function recoverStaleDeliveries(cutoff: string) {
    const stale = db.select().from(deliveries).where(and(eq(deliveries.status, "sending"), lt(deliveries.createdAt, cutoff))).all();
    for (const delivery of stale) completeDelivery(delivery.id, "delivery_unknown", undefined, "Process interrupted or provider outcome not confirmed; reconcile before another attempt");
    return stale.length;
  }

  function markPromiseKept(promiseId: string, resourceLink?: string) {
    const promise = db.select().from(promises).where(eq(promises.id, promiseId)).get();
    if (!promise) throw new Error("Promise not found");
    const link = resourceLink ?? promise.resourceLink;
    if (promise.requiresResource && !link) throw new Error("Promised resource is required");
    db.update(promises).set({ status: "kept", resourceLink: link, keptAt: now() }).where(eq(promises.id, promiseId)).run();
    return db.select().from(promises).where(eq(promises.id, promiseId)).get()!;
  }

  function skipDraft(draftId: string) {
    const draft = getDraft(draftId);
    if (!draft || draft.status !== "draft") throw new Error("Only an unsent draft can be skipped");
    db.update(drafts).set({ status: "skipped", updatedAt: now() }).where(eq(drafts.id, draftId)).run();
    return getDraft(draftId)!;
  }

  return {
    capture, getConversation,
    listConversations: () => db.select().from(conversations).orderBy(desc(conversations.createdAt)).all(),
    setConversation: (conversationId: string, values: Partial<typeof conversations.$inferInsert>) => db.update(conversations).set({ ...values, updatedAt: now() }).where(eq(conversations.id, conversationId)).run(),
    saveContact, updateContact, listContacts: (conversationId: string) => db.select().from(contacts).where(eq(contacts.conversationId, conversationId)).all(),
    savePromise, listPromises: (conversationId: string) => db.select().from(promises).where(eq(promises.conversationId, conversationId)).all(),
    getPromise: (promiseId: string) => db.select().from(promises).where(eq(promises.id, promiseId)).get(),
    setPromiseResource: (promiseId: string, resourceLink: string) => db.update(promises).set({ resourceLink }).where(and(eq(promises.id, promiseId), eq(promises.status, "open"))).run(),
    markPromiseKept,
    createDraft, reviseDraft, skipDraft, getDraft, getVersion,
    listDrafts: (conversationId: string) => db.select().from(drafts).where(eq(drafts.conversationId, conversationId)).all(),
    addPendingApproval, decideApproval, getApproval,
    listApprovals: (draftVersionId: string) => db.select().from(approvals).where(eq(approvals.draftVersionId, draftVersionId)).all(),
    claimDelivery, completeDelivery, recoverStaleDeliveries,
    getDelivery: (draftVersionId: string) => db.select().from(deliveries).where(eq(deliveries.draftVersionId, draftVersionId)).get(),
    hasRunEvent: (eventId: string) => !!db.select({ id: runEvents.id }).from(runEvents).where(eq(runEvents.eventId, eventId)).get(),
    saveRunEvent: (input: typeof runEvents.$inferInsert) => db.insert(runEvents).values(input).onConflictDoNothing().run(),
    listRunEvents: (conversationId: string) => db.select().from(runEvents).where(eq(runEvents.conversationId, conversationId)).orderBy(runEvents.sequence).all(),
  };
}
