import { apiError } from "@/lib/api";
import { getStore } from "@/lib/server-store";

export const runtime = "nodejs";
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json({ draft: getStore().skipDraft(id) });
  } catch (error) { return apiError(error); }
}
