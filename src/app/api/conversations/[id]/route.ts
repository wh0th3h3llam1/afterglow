import { getStore } from "@/lib/server-store";
import { conversationView } from "@/lib/view";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const view = conversationView(getStore(), id);
  return view ? Response.json(view) : Response.json({ error: "Conversation not found" }, { status: 404 });
}
