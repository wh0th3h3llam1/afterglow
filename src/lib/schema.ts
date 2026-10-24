import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  rawNotes: text("raw_notes").notNull(),
  mode: text("mode", { enum: ["LIVE", "DRY_RUN", "REPLAY"] }).notNull(),
  status: text("status", {
    enum: ["captured", "processing", "needs_input", "draft_ready", "awaiting_approval", "sending", "sent", "dry_run", "failed", "delivery_unknown", "skipped"],
  }).notNull(),
  sessionId: text("session_id"),
  activeTurnId: text("active_turn_id"),
  lastSequence: integer("last_sequence").notNull().default(0),
  question: text("question"),
  questionThreadId: text("question_thread_id"),
  questionToolCallId: text("question_tool_call_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  name: text("name").notNull(),
  email: text("email"),
  organization: text("organization"),
  createdAt: text("created_at").notNull(),
});

export const promises = sqliteTable("promises", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  contactId: text("contact_id").references(() => contacts.id),
  description: text("description").notNull(),
  resourceLink: text("resource_link"),
  requiresResource: integer("requires_resource", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["open", "kept", "skipped"] }).notNull().default("open"),
  createdAt: text("created_at").notNull(),
  keptAt: text("kept_at"),
});

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  contactId: text("contact_id").references(() => contacts.id),
  currentVersionId: text("current_version_id"),
  status: text("status", { enum: ["draft", "awaiting_approval", "sent", "dry_run", "failed", "delivery_unknown", "skipped"] }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const draftVersions = sqliteTable("draft_versions", {
  id: text("id").primaryKey(),
  draftId: text("draft_id").notNull().references(() => drafts.id),
  versionNumber: integer("version_number").notNull(),
  recipientName: text("recipient_name").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  resourceLinksJson: text("resource_links_json").notNull().default("[]"),
  contentHash: text("content_hash").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("draft_versions_number_unique").on(table.draftId, table.versionNumber)]);

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  draftVersionId: text("draft_version_id").notNull().references(() => draftVersions.id),
  sessionId: text("session_id").notNull(),
  turnId: text("turn_id").notNull(),
  threadId: text("thread_id").notNull(),
  toolCallId: text("tool_call_id").notNull(),
  sourceEventId: text("source_event_id").notNull(),
  status: text("status", { enum: ["pending", "allowed", "denied", "invalidated"] }).notNull(),
  createdAt: text("created_at").notNull(),
  decidedAt: text("decided_at"),
}, (table) => [uniqueIndex("approvals_tool_call_unique").on(table.toolCallId)]);

export const deliveries = sqliteTable("deliveries", {
  id: text("id").primaryKey(),
  draftVersionId: text("draft_version_id").notNull().references(() => draftVersions.id),
  mode: text("mode", { enum: ["LIVE", "DRY_RUN"] }).notNull(),
  status: text("status", { enum: ["sending", "sent", "dry_run", "failed", "delivery_unknown"] }).notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  providerReceipt: text("provider_receipt"),
  failureReason: text("failure_reason"),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
}, (table) => [
  uniqueIndex("deliveries_version_unique").on(table.draftVersionId),
  uniqueIndex("deliveries_key_unique").on(table.idempotencyKey),
]);

export const runEvents = sqliteTable("run_events", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  sessionId: text("session_id").notNull(),
  turnId: text("turn_id").notNull(),
  sequence: integer("sequence").notNull(),
  eventId: text("event_id").notNull(),
  type: text("type").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("run_events_event_unique").on(table.eventId)]);
