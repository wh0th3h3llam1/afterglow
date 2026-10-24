import { z } from "zod";
import { apiError } from "@/lib/api";
import { verifyAndResumeApproval } from "@/lib/trueforge";

export const runtime = "nodejs";
const schema = z.object({ decision: z.enum(["allow", "deny"]) });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { decision } = schema.parse(await request.json());
    await verifyAndResumeApproval(id, decision);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
