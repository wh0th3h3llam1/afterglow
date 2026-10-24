import { getStore } from "@/lib/server-store";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const store = getStore();
  if (!store.getConversation(id)) return Response.json({ error: "Conversation not found" }, { status: 404 });
  return Response.json({ events: store.listRunEvents(id).map((row) => ({ id: row.id, type: row.type, sequence: row.sequence, createdAt: row.createdAt })) });
}
