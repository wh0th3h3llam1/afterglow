import { z } from "zod";
import { apiError } from "@/lib/api";
import { REPLAY_NOTES, seedReplay } from "@/lib/replay";
import { getStore } from "@/lib/server-store";
import { startConversation } from "@/lib/trueforge";

export const runtime = "nodejs";
const inputSchema = z.object({ notes: z.string().trim().min(10).max(20000), mode: z.enum(["LIVE", "DRY_RUN", "REPLAY"]) });

export async function GET() {
  return Response.json({ conversations: getStore().listConversations() });
}

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const store = getStore();
    if (input.mode === "REPLAY") {
      if (input.notes !== REPLAY_NOTES) throw new Error("REPLAY uses the recorded sample only. Switch to DRY RUN to process your own notes.");
      return Response.json({ id: seedReplay(store) }, { status: 201 });
    }
    const conversation = store.capture(input.notes, input.mode);
    try { await startConversation(conversation.id); }
    catch (error) {
      store.setConversation(conversation.id, { status: "failed", question: error instanceof Error ? error.message : "Runtime failed" });
    }
    return Response.json({ id: conversation.id }, { status: 201 });
  } catch (error) { return apiError(error); }
}
