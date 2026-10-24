import { z } from "zod";
import { apiError } from "@/lib/api";
import { inspectConversationRuntime } from "@/lib/trueforge";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json(await inspectConversationRuntime(z.uuid().parse(id)));
  } catch (error) { return apiError(error); }
}
