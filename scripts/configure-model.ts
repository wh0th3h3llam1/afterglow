import { TrueForge } from "@truefoundry/trueforge-sdk";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Set OPENAI_API_KEY in .env.local first");
  const client = new TrueForge({ baseUrl: process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8790" });
  const catalog = await client.catalogs.modelProviders.list();
  const openai = catalog.data.find((provider) => provider.type === "openai");
  const model = openai && "models" in openai ? openai.models.find((item) => item.name === "gpt-5-4-mini") : undefined;
  if (!model) throw new Error("gpt-5-4-mini is absent from this TrueForge catalog");
  const configuredProviders = await client.settings.modelProviders.list();
  const existing = configuredProviders.data.find((provider) => provider.name === "openai")?.manifest;
  const previousModels = existing?.type === "openai" ? existing.models.filter((item) => item.name !== model.name) : [];
  await client.settings.modelProviders.createOrUpdate({ manifest: {
    type: "openai", auth: { apiKey },
    ...(existing?.type === "openai" && existing.baseUrl ? { baseUrl: existing.baseUrl } : {}),
    models: [...previousModels, model],
  } });
  const configured = await client.models.list();
  if (!configured.data.some((item) => item.name === "openai/gpt-5-4-mini")) throw new Error("OpenAI model was not visible after configuration");
  console.log("Configured TrueForge model openai/gpt-5-4-mini (upstream gpt-5.4-mini).");
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
