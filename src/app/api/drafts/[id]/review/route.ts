import { z } from "zod";
import { apiError } from "@/lib/api";
import { assertLiveDeliveryReady } from "@/lib/delivery";
import { getStore } from "@/lib/server-store";
import { continueConversation } from "@/lib/trueforge";

export const runtime = "nodejs";
const schema = z.object({ expectedVersionId: z.uuid() });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { expectedVersionId } = schema.parse(await request.json());
    const store = getStore();
    const draft = store.getDraft(id);
    if (!draft || draft.currentVersionId !== expectedVersionId || draft.status !== "draft") throw new Error("Review requires the current unsent draft version");
    const conversation = store.getConversation(draft.conversationId);
    if (!conversation || conversation.mode === "REPLAY") throw new Error("Replay cannot request delivery approval");
    if (conversation.mode === "LIVE") assertLiveDeliveryReady(store.getVersion(expectedVersionId)!.recipientEmail);
    await continueConversation(draft.conversationId, `REVIEW PHASE. The user clicked Request final approval for draft ${id}, version ${expectedVersionId}. Call get_draft for ${id}; if currentVersionId is ${expectedVersionId}, your next action must be send_email({draftVersionId:"${expectedVersionId}"}). The configured TrueForge gate will pause that tool call for the user's final decision, so invoking it cannot deliver yet. Do not save another draft, stop after get_draft, or ask for confirmation in text. If the version differs, explain the mismatch instead.`);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
