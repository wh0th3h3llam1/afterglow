import { TrueForge } from "@truefoundry/trueforge-sdk";

const token = process.env.AFTERGLOW_MCP_TOKEN;
if (!token || token.length < 24) throw new Error("Set AFTERGLOW_MCP_TOKEN in .env.local");
const port = Number(process.env.AFTERGLOW_MCP_PORT ?? 3401);
const client = new TrueForge({ baseUrl: process.env.TRUEFORGE_BASE_URL ?? "http://127.0.0.1:8790" });
async function main() {
const response = await client.settings.mcpServers.createOrUpdate({
  manifest: {
    name: "afterglow",
    description: "Local contacts, promises, immutable drafts, and approval-gated email delivery.",
    type: "remote",
    url: `http://127.0.0.1:${port}/mcp`,
    auth: { type: "header", headers: { Authorization: `Bearer ${token}` } },
  },
});
console.log(`Registered TrueForge connector: ${response.data.manifest.name}`);
const tools = await client.mcpServers.listTools("afterglow");
console.log("Discovered tools:", JSON.stringify(tools.data.map((tool) => tool.name)));
const models = await client.models.list();
console.log("Configured models:", JSON.stringify(models.data.map((model) => model.name)));
const catalog = await client.catalogs.modelProviders.list();
const openai = catalog.data.find((provider) => provider.type === "openai");
console.log("OpenAI catalog includes preferred model:", Boolean(openai && "models" in openai && openai.models.some((model) => model.name === "gpt-5-4-mini")));
console.log("OpenAI catalog models:", JSON.stringify(openai && "models" in openai ? openai.models.map((model) => model.name) : []));
console.log("Preferred catalog entry:", JSON.stringify(openai && "models" in openai ? openai.models.find((model) => model.name === "gpt-5-4-mini") : null));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
