import { ZodError } from "zod";

export function apiError(error: unknown) {
  const message = error instanceof ZodError ? error.issues.map((issue) => issue.message).join("; ") : error instanceof Error ? error.message : "Request failed";
  const status = error instanceof ZodError ? 400 : /not found/i.test(message) ? 404 : /not configured|unavailable/i.test(message) ? 503 : 409;
  return Response.json({ error: message }, { status });
}
