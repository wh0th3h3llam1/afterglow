import { z } from "zod";
import { apiError } from "@/lib/api";
import { getStore } from "@/lib/server-store";
import { continueConversation } from "@/lib/trueforge";

export const runtime = "nodejs";
const schema = z.object({ answer: z.string().trim().min(1).max(3000) });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { answer } = schema.parse(await request.json());
    const conversation = getStore().getConversation(id);
    if (!conversation || conversation.status !== "needs_input") throw new Error("Conversation is not waiting for an answer");
    await continueConversation(id, `User clarification: ${answer}`);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
