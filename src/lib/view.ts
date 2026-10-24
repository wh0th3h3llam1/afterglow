import type { createStore } from "./store";

export function conversationView(store: ReturnType<typeof createStore>, id: string) {
  store.recoverStaleDeliveries(new Date(Date.now() - 120_000).toISOString());
  const conversation = store.getConversation(id);
  if (!conversation) return null;
  return {
    conversation,
    contacts: store.listContacts(id),
    promises: store.listPromises(id),
    drafts: store.listDrafts(id).map((draft) => ({
      ...draft,
      version: draft.currentVersionId ? store.getVersion(draft.currentVersionId) : null,
      approval: draft.currentVersionId ? store.listApprovals(draft.currentVersionId).find((row) => row.status === "pending") ?? null : null,
      delivery: draft.currentVersionId ? store.getDelivery(draft.currentVersionId) ?? null : null,
    })),
    events: store.listRunEvents(id).map((row) => ({ id: row.id, type: row.type, createdAt: row.createdAt, sequence: row.sequence })),
  };
}
