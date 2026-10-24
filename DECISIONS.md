# Afterglow decisions

Record consequential choices here as dated entries. An entry remains in place if later superseded; add a new entry and link back to it.

## 2026-10-24 — Project location and scope

**Status:** Accepted

**Context:** The supplied `Build` workspace is empty; the nearby QuestGraph project is unrelated. The user chose the `Build` folder for Afterglow.

**Decision:** Build a new local, single-user Afterglow app in the root of `Build`. Keep raw notes, database files, environment files, and outbox data out of the public GitHub repository.

**Alternatives:** Reuse QuestGraph or add multi-user hosting. Both would expand scope and conflict with the brief.

**Consequences:** Localhost is the supported demo environment. Internet-facing deployment would require a separate authentication and hosting design.

## 2026-10-24 — Stack and runtime boundary

**Status:** Accepted, subject to the integration proof

**Context:** The brief prefers a TypeScript web app, SQLite, a small MCP server, and TrueForge. The machine-wide Node version is 20.20.0, while a bundled Node 24.22.1 runtime is available.

**Decision:** Use Next.js, TypeScript, Tailwind, Drizzle with SQLite, a separate TypeScript MCP server, and TrueForge as the sole agent loop. Use bundled Node 24 for setup and runtime. Pin dependency versions after a working proof.

**Alternatives:** A Python backend or a custom agent loop would add another stack or bypass TrueForge.

**Consequences:** App, MCP server, and TrueForge need coordinated localhost startup. TrueForge's local server remains on loopback.

**Source:** [TrueForge quickstart](https://github.com/truefoundry/trueforge/blob/main/docs/quickstart.mdx), [agent sessions and approval events](https://github.com/truefoundry/trueforge/blob/main/docs/api/use-agent.mdx).

## 2026-10-24 — Delivery and approval

**Status:** Accepted design; implementation unverified

**Context:** The user selected Resend. Sending must follow an explicit TrueForge approval for one immutable draft version and survive duplicate clicks or uncertain provider outcomes.

**Decision:** Gate the literal `send_email` MCP tool name in TrueForge. The app records the pending session and tool-call reference, compares the reviewed version, and resumes with a TrueForge approval event. The MCP tool accepts a draft-version ID and enforces a durable one-delivery intent. Use Resend's idempotency key as a second guard; unknown outcomes need reconciliation rather than blind retries.

**Alternatives:** A direct browser send route or SMTP would weaken the stated approval path or differ from the selected provider.

**Consequences:** An edit creates a new version and requires a new pause. Resend's 24-hour key retention means Afterglow must retain its own uniqueness guard longer.

**Source:** [TrueForge tool approvals](https://github.com/truefoundry/trueforge/blob/main/docs/api/use-agent.mdx), [Resend idempotency](https://resend.com/changelog/idempotency-keys).

## 2026-10-24 — Runtime skill and build-time skills

**Status:** Accepted design; registration unverified

**Context:** The user chose to host the `followup-voice` skill in a public Afterglow GitHub repository and has indicated a Daytona sandbox is available.

**Decision:** Keep the runtime `SKILL.md` in this codebase, register it at a pinned Git commit, and attach it with a Daytona-backed sandbox. Use the installed `source-driven-development` skill to verify SDK signatures, `api-and-interface-design` and `security-and-hardening` for versioned approval boundaries, `frontend-ui-engineering` and the app-screen `design-taste-frontend` workflow for the desk, `test-driven-development` for delivery guards, and `documentation-and-adrs` to preserve rationale. Build-time skills do not become agent runtime tools.

**Alternatives:** Putting all voice guidance in the agent prompt is the fallback if sandbox or Git registration fails; that would be recorded as a limitation, not described as an attached runtime skill.

**Consequences:** Registration requires a published source and configured Daytona provider. The current Chrome DevTools MCP testing server is unavailable, so browser verification will use available browser automation.

**Source:** [TrueForge skills](https://github.com/truefoundry/trueforge/blob/main/docs/skills.mdx), [TrueForge sandbox](https://github.com/truefoundry/trueforge/blob/main/docs/sandbox.mdx).

## 2026-10-24 — Operating modes and visual direction

**Status:** Accepted design

**Context:** Credentials may be missing during a local demo, but the UI must not imply delivery that did not occur.

**Decision:** Make LIVE, DRY RUN, and REPLAY visible. DRY RUN uses a local outbox, REPLAY uses fixtures with no provider calls, and only a confirmed provider receipt produces a SENT state. Use the brief's Dusk Desk palette, Fraunces/Bricolage typography, paper stack, and desktop/mobile ordering, subject to contrast checks.

**Alternatives:** Silent fallback or a generic dashboard would misrepresent behavior or miss the brief's primary deliverable.

**Consequences:** Mode and outcome labels are part of the data contract and acceptance tests.

## 2026-10-24 — Verified local connector configuration

**Status:** Accepted and verified for connector discovery

**Context:** TrueForge 0.180.0 rejected the loopback MCP URL with `Outbound URL blocked for host "127.0.0.1"`. Its installed runtime reads `OUTBOUND_URL_ALLOWED_HOSTS` as a JSON string array. The model catalog is empty without a configured provider.

**Decision:** Start only the local TrueForge process with `OUTBOUND_URL_ALLOWED_HOSTS='["127.0.0.1","localhost"]'`, while keeping MCP and web listeners bound to loopback. Generate an ignored random MCP bearer token for local registration. Keep initial mode REPLAY until the OpenAI provider is configured.

**Alternatives:** Disable the network guard entirely or expose MCP publicly. Both would weaken the local demo boundary.

**Consequences:** The startup recipe must include the allowlist. Connector discovery is proven, but model execution and approval pauses still require credentials and a live turn.

**Source:** Installed `@truefoundry/trueforge@0.180.0` configuration and `@truefoundry/trueforge-core` URL guard; `scripts/register-connector.ts` returned all nine tool names and no configured models.

## 2026-10-24 — Catalog model name

**Status:** Accepted; provider setup awaits a key

**Context:** The requested `openai/gpt-5.4-mini` spelling is absent from TrueForge 0.180.0's OpenAI catalog. The catalog entry has `name: gpt-5-4-mini` and `modelId: gpt-5.4-mini`.

**Decision:** Configure and request `openai/gpt-5-4-mini` in TrueForge, using the catalog's upstream `gpt-5.4-mini` ID. Check configured models before starting a live turn.

**Alternatives:** Pass the dotted spelling as a TrueForge FQN or use a larger model. The first would fail catalog lookup; the second would spend more of the constrained demo budget.

**Consequences:** The startup script and `.env.local` must use the hyphenated FQN. No live turn can be claimed until `setup:model` succeeds with a real key.

**Source:** TrueForge 0.180.0 local `catalogs.modelProviders.list()` response and `models.list()` response.

## 2026-10-24 — Correspondence desk and source-backed recipients

**Status:** Accepted, replay browser verified

**Context:** The brief calls for a distinctive desk, honest modes, and clarification rather than guessed identities. Browser checks at 360px, 768px, and desktop showed the Dusk Desk layout without horizontal clipping.

**Decision:** Use tokenized indigo/plum framing, warm paper letters, ember actions, and a visible mode badge. Require a saved contact with a matching email before the agent can save a first draft. Keep raw notes separate and reveal them on demand. REPLAY accepts only the recorded fixture.

**Alternatives:** Generic dashboard cards or arbitrary recipient strings from the model. Both weaken the visual or provenance requirements.

**Consequences:** Missing or ambiguous email stops draft persistence and calls for clarification. User edits create a new immutable version; a previous approval cannot send that version.

**Source:** Supplied Dusk Desk brief, `src/lib/store.test.ts`, browser replay and responsive checks.

## 2026-10-24 — Recovery and dry-run evidence

**Status:** Accepted; local behavior verified

**Context:** Refresh and process restart must restore work; a dry run needs a durable local receipt and must never claim real delivery.

**Decision:** Store notes, draft versions, session references, approvals, deliveries, and run events in SQLite. Keep outbox JSON under ignored `data/outbox`. On an interrupted send older than two minutes, show `delivery_unknown` for reconciliation and retain the single delivery intent. Preserve other configured OpenAI models when adding the catalog-selected one.

**Alternatives:** Browser-only state, a transient dry-run result, or automatic retry after a network timeout would lose work or risk duplicate mail.

**Consequences:** Replay and dry-run state survives the web process. A genuinely slow provider response can conservatively appear uncertain and needs manual reconciliation. Agent pause restoration and live provider outcomes still need credential-backed verification.

**Source:** `src/lib/recovery.test.ts`, `src/lib/delivery.test.ts`, browser restart check, installed TrueForge SDK `settings.modelProviders` contract.

## 2026-10-24 — Public source and credential boundary

**Status:** Published and locally registered; runtime attachment pending credentials

**Context:** TrueForge loads skills from Git at a pinned commit. The user chose their signed-in GitHub account for the public Afterglow source, while provider credentials and personal notes must remain local.

**Decision:** Publish the audited source as [wh0th3h3llam1/afterglow](https://github.com/wh0th3h3llam1/afterglow). Keep `.env.local`, SQLite, raw notes, and outbox under ignored paths. Register `followup-voice` from pinned commit `d0e24a735e17e8aba741c4cede611e131111e96d`; attach it only when the Daytona sandbox is configured.

**Alternatives:** Keep the skill only in an inline prompt, or publish sample notes and secrets with the code. The inline prompt remains a documented temporary fallback; personal data does not belong in public Git.

**Consequences:** The code can be cloned and reviewed now. TrueForge listed the registered skill locally, but its attachment in a live agent session remains unverified.

**Source:** Public repository creation response, `git ls-remote origin refs/heads/main` matching commit `d0e24a735e17e8aba741c4cede611e131111e96d`, `npm run setup:skill` success, staged file audit, [TrueForge skills](https://github.com/truefoundry/trueforge/blob/main/docs/skills.mdx).

## 2026-10-24 — Interrupted turn restoration

**Status:** Implemented and mocked-SDK verified; live verification pending

**Context:** SQLite restores saved notes and drafts, but an interrupted web process can lose its stream while TrueForge continues a turn. Multiple contacts can also leave one saved draft and one unanswered clarification in the same conversation.

**Decision:** On a read of a processing conversation after its local stream is gone, fetch the latest TrueForge turn and event history. Rebuild only missing run events and pending approval references, then derive the visible state from the authoritative turn. Reserve an in-process guard so regular polling does not duplicate the active stream. Require a `CLARIFY:` final response for a missing detail even when another contact already has a draft.

**Alternatives:** Treat the last SQLite status as final, restart the agent turn from the notes, or automatically resume an uncertain approval. Those approaches leave the desk stuck, duplicate model work, or weaken the approval boundary.

**Consequences:** A restart can recover a completed or paused turn without an automatic send. The SDK snapshot path is tested with a simulated paused turn; its live behavior still needs a credential-backed run. Unsupported pauses are shown as a failure with a pointer to TrueForge's local approval UI.

**Source:** Installed TrueForge SDK `sessions.listEvents` and `sessions.getTurn` types; `src/lib/trueforge-recovery.test.ts` repeated-sync and clarification cases.
