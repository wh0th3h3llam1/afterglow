# Afterglow progress

Updated: 2026-10-24 (America/Los_Angeles)

## Current phase

Local implementation verified; public-repository publication and credential-gated integration remain.

## Completed and verified

- Confirmed the chosen `Build` workspace was empty and contained no existing repository or project instructions.
- Confirmed the bundled Node.js runtime is `v24.22.1`, which meets TrueForge's documented Node.js 22.14+ requirement. The machine-wide Node.js is `v20.20.0`; commands for this project must use the bundled runtime until a newer machine-wide version is installed.
- Reviewed TrueForge's official session, streaming, approval, MCP, skill, and sandbox documentation. No live runtime call has been made.
- Pinned and installed the TypeScript runtime, SDK, Next.js, SQLite, Drizzle, MCP, Resend, and test dependencies. Generated and applied two Drizzle migrations to the ignored local SQLite database.
- Built durable Conversation, Contact, Promise, Draft, immutable DraftVersion, Approval, Delivery, and RunEvent tables and store methods. Focused tests cover recovery, approval and delivery guards, recipient edits, and an actual ignored dry-run outbox file.
- Started the local TrueForge 0.180.0 runtime and Afterglow MCP server. `scripts/register-connector.ts` registered `afterglow` and discovered all nine tools through TrueForge, including `send_email` and clarification resource updates.
- Created an ignored `.env.local` with a random MCP bearer token in REPLAY mode. TrueForge's model catalog currently returns `[]` because no provider credentials are configured.
- Added validated server routes for capture, clarification, immutable edits, redrafting, review requests, approval decisions, state restoration, and run events. The TrueForge adapter uses the installed SDK's typed session, streamed event, and `user.tool_approval` contracts; the model/approval path is not yet live-verified.
- Built the Dusk Desk interface with a replay fixture, source-note reveal, inline tweak form, exact review dialog, promise ledger, and activity list. Browser checks showed the fixture, source reveal, exact review, editable version 2, and refresh restoration; screenshots at 360px, 768px, and desktop showed no horizontal clipping. Escape closes the review dialog.
- Added recovery and replay isolation tests, a local JSON outbox for DRY RUN, and a stale-send reconciliation state. A full Next.js process restart restored the selected replay letter and immutable version 2 from SQLite. Production-only `npm audit --omit=dev` reported zero advisories; the all-dependency audit reports ten development-dependency advisories (five moderate, five high) in the pinned build tooling.
- `npm test` passed 17 tests, `npm run typecheck` passed, and `npm run build` produced all routes on 2026-10-24. This was after the final recipient edit and outbox changes. The model configuration script now preserves any other configured OpenAI models; it awaits a key for runtime verification.
- Audited the staged file list and tracked content for environment secrets, databases, raw notes, and outbox files; only placeholders and fictional fixtures are tracked. Git Credential Manager authenticated the signed-in GitHub account `wh0th3h3llam1` without exposing its token.

## Next work

1. Publish the sanitized code to a public GitHub repository and record its commit and URL here.
2. Register the pinned runtime skill with the public Git URL once a Daytona key is supplied.
3. Verify a live OpenAI session, MCP call, TrueForge approval pause and resume, and Resend delivery when credentials and a consenting recipient are supplied.

## Blockers and limits

- OpenAI, Resend, Daytona, and consenting test-recipient credentials are not present in the process environment. A live model turn, approval pause, Git-backed skill registration, and real delivery remain unverified until configured.
- TrueForge blocks loopback MCP URLs by default. Local startup must set `OUTBOUND_URL_ALLOWED_HOSTS='["127.0.0.1","localhost"]'`; this was verified by successful tool discovery after restart.
- No GitHub remote exists yet. GitHub CLI is absent, but the signed-in account is available through Git Credential Manager and its API credential.
- The live turn, provider failure behavior, review resume, and runtime skill attachment cannot be certified with mocks or replay. The current verified demo path is REPLAY, and DRY RUN has unit-level outbox evidence only.

## Usage budget

| Meter | Used | Limit |
| --- | ---: | ---: |
| Live OpenAI agent turns | 0 | 30 |
| Real test emails | 0 | 5 |

Completion entries should include the check or browser observation that proved the work. Keep failures, remaining tasks, and mode-specific limitations visible.
