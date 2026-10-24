import { TrueForge } from "@truefoundry/trueforge-sdk";

async function main() {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) throw new Error("Set DAYTONA_API_KEY in .env.local first");
  const client = new TrueForge({ baseUrl: process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8790" });
  await client.settings.sandboxProviders.createOrUpdate({ manifest: {
    type: "daytona", auth: { apiKey }, autoArchiveIntervalInMinutes: 60,
    autoDeleteIntervalInMinutes: 1440, autoStopIntervalInMinutes: 30, execTimeoutMs: 120000,
  } });
  await client.sandboxEnvironments.createOrUpdate({ manifest: { name: "afterglow-daytona", description: "Isolated runtime for the followup-voice skill" } });
  console.log("Configured Daytona provider and afterglow-daytona environment.");
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
