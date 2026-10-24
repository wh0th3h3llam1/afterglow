import { z } from "zod";
import { apiError } from "@/lib/api";
import { getStore } from "@/lib/server-store";

export const runtime = "nodejs";
const schema = z.object({
  expectedVersionId: z.uuid(),
  recipientName: z.string().trim().min(1).max(160),
  recipientEmail: z.email(),
  subject: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(10000),
  resourceLinks: z.array(z.url()).max(20),
});
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { expectedVersionId, ...content } = schema.parse(await request.json());
    const version = getStore().reviseDraft(id, expectedVersionId, content);
    return Response.json({ version });
  } catch (error) { return apiError(error); }
}
