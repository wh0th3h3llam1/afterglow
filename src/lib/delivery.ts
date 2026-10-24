import { Resend } from "resend";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { createStore } from "./store";

type Store = ReturnType<typeof createStore>;
type Version = NonNullable<ReturnType<Store["getVersion"]>>;
export type ProviderOutcome = { kind: "sent"; receipt: string } | { kind: "failed"; reason: string };
export type LiveSender = (version: Version, idempotencyKey: string) => Promise<ProviderOutcome>;
export type DryRunWriter = (version: Version, deliveryId: string) => Promise<string>;

export const writeDryRunOutbox: DryRunWriter = async (version, deliveryId) => {
  const folder = join(process.cwd(), "data", "outbox");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `${deliveryId}.json`), JSON.stringify({
    draftVersionId: version.id, recipientName: version.recipientName,
    recipientEmail: version.recipientEmail, subject: version.subject,
    body: version.body, resourceLinks: JSON.parse(version.resourceLinksJson),
    createdAt: new Date().toISOString(), mode: "DRY_RUN",
  }, null, 2), { encoding: "utf8", flag: "wx" });
  return `outbox/${deliveryId}.json`;
};

export const sendWithResend: LiveSender = async (version, idempotencyKey) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const allowed = (process.env.TEST_RECIPIENT_ALLOWLIST ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!apiKey || !from) return { kind: "failed", reason: "Resend credentials or sender are not configured" };
  if (!allowed.includes(version.recipientEmail.toLowerCase())) return { kind: "failed", reason: "Recipient is not in the consenting test allowlist" };
  const { data, error } = await new Resend(apiKey).emails.send({
    from,
    to: [version.recipientEmail],
    subject: version.subject,
    text: version.body,
  }, { idempotencyKey });
  if (error) {
    if (error.statusCode === null || error.statusCode >= 500 || error.name === "concurrent_idempotent_requests") throw new Error(`Resend outcome requires reconciliation: ${error.message}`);
    return { kind: "failed", reason: error.message };
  }
  if (!data?.id) throw new Error("Resend did not return a receipt; delivery outcome is unknown");
  return { kind: "sent", receipt: data.id };
};

export function assertLiveDeliveryReady(recipientEmail: string) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) throw new Error("Resend credentials and sender are required for LIVE review");
  const allowed = (process.env.TEST_RECIPIENT_ALLOWLIST ?? "").split(",").map((value) => value.trim().toLowerCase());
  if (!allowed.includes(recipientEmail.toLowerCase())) throw new Error("Recipient is not in the consenting test allowlist");
}

export async function deliverVersion(store: Store, draftVersionId: string, sendLive: LiveSender = sendWithResend, writeOutbox: DryRunWriter = writeDryRunOutbox) {
  const claim = store.claimDelivery(draftVersionId);
  if (claim.kind === "existing") return claim.delivery;
  if (claim.delivery.mode === "DRY_RUN") {
    try {
      const receipt = await writeOutbox(store.getVersion(draftVersionId)!, claim.delivery.id);
      store.completeDelivery(claim.delivery.id, "dry_run", receipt);
    } catch (error) {
      store.completeDelivery(claim.delivery.id, "failed", undefined, error instanceof Error ? error.message : "Could not write local outbox");
    }
    return store.getDelivery(draftVersionId)!;
  }
  const version = store.getVersion(draftVersionId)!;
  try {
    const outcome = await sendLive(version, claim.delivery.idempotencyKey);
    if (outcome.kind === "sent") store.completeDelivery(claim.delivery.id, "sent", outcome.receipt);
    else store.completeDelivery(claim.delivery.id, "failed", undefined, outcome.reason);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Provider response unavailable";
    store.completeDelivery(claim.delivery.id, "delivery_unknown", undefined, reason);
  }
  return store.getDelivery(draftVersionId)!;
}
