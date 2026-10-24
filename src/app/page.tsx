import Desk from "./desk";
import { REPLAY_NOTES } from "@/lib/replay";
import type { Mode } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Home() {
  const configuredMode = process.env.AFTERGLOW_MODE;
  const defaultMode: Mode = configuredMode === "DRY_RUN" || configuredMode === "LIVE" ? configuredMode : "REPLAY";
  const liveConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM && process.env.TEST_RECIPIENT_ALLOWLIST?.trim());
  return <Desk sampleNotes={REPLAY_NOTES} defaultMode={defaultMode} liveConfigured={liveConfigured} />;
}
