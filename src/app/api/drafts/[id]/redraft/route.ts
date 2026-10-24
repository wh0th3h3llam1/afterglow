import { z } from "zod";
import { apiError } from "@/lib/api";
import { getStore } from "@/lib/server-store";
import { continueConversation } from "@/lib/trueforge";

export const runtime = "nodejs";
const schema = z.object({ instruction: z.string().trim().min(1).max(1000) });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { instruction } = schema.parse(await request.json());
    const store = getStore();
    const draft = store.getDraft(id);
    if (!draft?.currentVersionId) throw new Error("Draft not found");
    const conversation = store.getConversation(draft.conversationId);
    if (!conversation || conversation.mode === "REPLAY") throw new Error("Redraft requires a live TrueForge session");
    if (draft.status === "awaiting_approval") throw new Error("Resolve the pending approval before redrafting");
    await continueConversation(draft.conversationId, `Redraft the current follow-up for draft ${id}, version ${draft.currentVersionId}. Instruction: ${instruction}. Use save_draft with draftId ${id} and expectedVersionId ${draft.currentVersionId} to save one new immutable version of the same draft. Preserve all verified promises and resources. Do not send.`);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
