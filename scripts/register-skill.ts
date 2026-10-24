import { TrueForge } from "@truefoundry/trueforge-sdk";

async function main() {
  const url = process.env.AFTERGLOW_SKILL_GIT_URL;
  const ref = process.env.AFTERGLOW_SKILL_GIT_COMMIT;
  if (!url || !/^https:\/\/(github\.com|gitlab\.com)\/[^/]+\/[^/]+(?:\.git)?$/.test(url)) throw new Error("Set AFTERGLOW_SKILL_GIT_URL to a public HTTPS GitHub or GitLab repository");
  if (!ref || !/^[a-f0-9]{40}$/.test(ref)) throw new Error("Set AFTERGLOW_SKILL_GIT_COMMIT to a pinned 40-character commit SHA");
  const client = new TrueForge({ baseUrl: process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8790" });
  await client.settings.skills.createOrUpdate({ manifest: { type: "git", name: "followup-voice", description: "Write concise personal conference follow-ups without inventing details", url, ref, path: "skills/followup-voice" } });
  const skills = await client.skills.list();
  if (!skills.data.some((skill) => skill.name === "followup-voice")) throw new Error("Skill registration did not appear in TrueForge");
  console.log(`Registered followup-voice at pinned commit ${ref}.`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
