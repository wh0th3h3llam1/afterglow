# Afterglow progress

Updated: 2026-10-24 (America/Los_Angeles)

## Current phase

Public source published; credential-gated integration remains.

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
- Reopened the exact review in the browser after the recovery changes: focus began on Close review, Tab remained inside the dialog, and Escape closed it. Representative text and control color pairs measured 4.54:1 or higher (paper/ink 13.87:1; ember button/dark text 5.88:1).
- Added recovery and replay isolation tests, a local JSON outbox for DRY RUN, and a stale-send reconciliation state. A full Next.js process restart restored the selected replay letter and immutable version 2 from SQLite. Production-only `npm audit --omit=dev` reported zero advisories; the all-dependency audit reports ten development-dependency advisories (five moderate, five high) in the pinned build tooling.
- `npm test` passed 21 tests, `npm run typecheck` passed, and `npm run build` produced all routes on 2026-10-24. This includes recipient edits, post-approval edits, definite provider rejection, uncertain outcomes, and the real local outbox file. The model configuration script preserves other configured OpenAI models; it awaits a key for runtime verification.
- Added a read-only TrueForge session sync for a processing conversation after a web restart. It reads the latest turn and events, restores a paused exact-version approval or final clarification, and skips previously stored events. A mocked SDK recovery test proved one pending approval and two unique run events after repeated sync. Active live-turn restart behavior remains unverified without an OpenAI key.
- Audited the staged file list and tracked content for environment secrets, databases, raw notes, and outbox files; only placeholders and fictional fixtures are tracked. Git Credential Manager authenticated the signed-in GitHub account `wh0th3h3llam1` without exposing its token.
- Created the public [Afterglow repository](https://github.com/wh0th3h3llam1/afterglow) and pushed initial commit `d0e24a735e17e8aba741c4cede611e131111e96d`. `git ls-remote origin refs/heads/main` returned that same commit.
- Pinned that public commit in ignored `.env.local` and ran `npm run setup:skill`; TrueForge listed the registered `followup-voice` skill. Attachment in an agent session still awaits the Daytona sandbox key.

## Next work

1. Configure Daytona and attach the registered runtime skill in an agent session once its key is supplied.
2. Verify a live OpenAI session, MCP call, TrueForge approval pause and resume, and Resend delivery when credentials and a consenting recipient are supplied.
3. Check live refresh and process-restart behavior while a TrueForge turn is active, and use the bundled approval UI for the demo if custom approval proves unreliable.

## Blockers and limits

- OpenAI, Resend, Daytona, and consenting test-recipient credentials are not present in the process environment. A live model turn, approval pause, Git-backed skill registration, and real delivery remain unverified until configured.
- TrueForge blocks loopback MCP URLs by default. Local startup must set `OUTBOUND_URL_ALLOWED_HOSTS='["127.0.0.1","localhost"]'`; this was verified by successful tool discovery after restart.
- The public Git source is available and `followup-voice` is registered with TrueForge; `AFTERGLOW_SKILL_ENABLED` remains false until Daytona setup and attachment succeed.
- The live turn, real provider behavior, review resume, active-turn restart, and runtime skill attachment cannot be certified with mocks or replay. The current verified browser demo path is REPLAY, and DRY RUN has unit-level outbox evidence only.

## Usage budget

| Meter | Used | Limit |
| --- | ---: | ---: |
| Live OpenAI agent turns | 0 | 30 |
| Real test emails | 0 | 5 |

Completion entries should include the check or browser observation that proved the work. Keep failures, remaining tasks, and mode-specific limitations visible.
