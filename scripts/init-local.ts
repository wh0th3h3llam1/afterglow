import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

if (existsSync(".env.local")) {
  console.log(".env.local already exists; left unchanged.");
} else {
  const token = randomBytes(32).toString("hex");
  writeFileSync(".env.local", [
    "# Afterglow local-only configuration. Keep this file private.",
    "AFTERGLOW_MODE=REPLAY",
    "AFTERGLOW_DB_PATH=./data/afterglow.sqlite",
    "AFTERGLOW_MCP_PORT=3401",
    `AFTERGLOW_MCP_TOKEN=${token}`,
    "TRUEFORGE_BASE_URL=http://localhost:8790",
    "TRUEFORGE_MODEL=openai/gpt-5-4-mini",
    "# OPENAI_API_KEY=",
    "# DAYTONA_API_KEY=",
    "# AFTERGLOW_SKILL_GIT_URL=",
    "# AFTERGLOW_SKILL_GIT_COMMIT=",
    "AFTERGLOW_SKILL_ENABLED=false",
    "# RESEND_API_KEY=",
    "# RESEND_FROM=",
    "# TEST_RECIPIENT_ALLOWLIST=",
    "",
  ].join("\n"), { flag: "wx" });
  console.log("Created ignored .env.local in REPLAY mode. Add credentials before using LIVE or DRY_RUN.");
}
