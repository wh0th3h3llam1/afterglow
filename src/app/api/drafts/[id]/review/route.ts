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
    await continueConversation(draft.conversationId, `The user opened Review & send for draft ${id}, version ${expectedVersionId}. Read it with get_draft. If and only if this is still the current complete version, call send_email with draftVersionId ${expectedVersionId}; TrueForge must pause before execution for the user's final decision. Do not change the content or ask to bypass approval.`);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
