import { getStore } from "@/lib/server-store";
import { recoverConversation } from "@/lib/trueforge";
import { conversationView } from "@/lib/view";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try { await recoverConversation(id); }
  catch (error) { console.error("Could not sync TrueForge conversation", error); }
  const view = conversationView(getStore(), id);
  return view ? Response.json(view) : Response.json({ error: "Conversation not found" }, { status: 404 });
}
