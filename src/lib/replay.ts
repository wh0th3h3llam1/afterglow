import { randomUUID } from "node:crypto";
import type { createStore } from "./store";

export const REPLAY_NOTES = `Met Maya Chen from Harborlight at the TrueForge conference. She showed me how their team tracks customer feedback after workshops. I promised to send our public demo repository: https://github.com/example/afterglow-demo. Maya's email is maya@example.com. I sign off as Ash. Ask if she wants to compare notes next week.`;

export function seedReplay(store: ReturnType<typeof createStore>) {
  const conversation = store.capture(REPLAY_NOTES, "REPLAY");
  const contact = store.saveContact({ conversationId: conversation.id, name: "Maya Chen", email: "maya@example.com", organization: "Harborlight" });
  store.savePromise({ conversationId: conversation.id, contactId: contact.id, description: "Send the public demo repository", requiresResource: true, resourceLink: "https://github.com/example/afterglow-demo" });
  store.createDraft({
    conversationId: conversation.id,
    contactId: contact.id,
    recipientName: contact.name,
    recipientEmail: contact.email!,
    subject: "Great comparing workshop notes",
    body: `Hi Maya,\n\nI enjoyed hearing how Harborlight tracks customer feedback after workshops. As promised, here's our public demo repository: https://github.com/example/afterglow-demo\n\nWould you like to compare notes next week?\n\nAsh`,
    resourceLinks: ["https://github.com/example/afterglow-demo"],
  });
  store.saveRunEvent({ id: randomUUID(), conversationId: conversation.id, sessionId: "replay-fixture", turnId: "replay-fixture", sequence: 1, eventId: randomUUID(), type: "replay.fixture", payloadJson: JSON.stringify({ detail: "Recorded sample loaded; no model or provider calls" }), createdAt: new Date().toISOString() });
  store.setConversation(conversation.id, { lastSequence: 1, status: "draft_ready" });
  return conversation.id;
}
