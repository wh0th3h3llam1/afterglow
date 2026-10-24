# Afterglow progress

Updated: 2026-10-24 (America/Los_Angeles)

## Current phase

Credential-backed local integration verified through TrueForge approval and DRY RUN delivery. The production server is running at `http://127.0.0.1:3000`, and the verified source is published. LIVE Resend delivery is outside the current mock-email scope.

## Completed work and evidence

- Built the local Next.js, TypeScript, Tailwind, SQLite/Drizzle app and separate MCP server with nine registered tools. The bundled Node.js runtime is v24.22.1; TrueForge runtime and SDK are pinned to 0.180.0. The machine-wide Node.js 20.20.0 remains too old for TrueForge.
- Persisted conversations, contacts, promises, drafts, immutable draft versions, approvals, deliveries, run events, and TrueForge session/turn references. Drizzle migrations applied to ignored SQLite data. A web-process restart previously restored a replay draft; the credential-backed DRY RUN conversation and receipt also survived a browser refresh.
- Built the Dusk Desk note capture, clarification, source reveal, edit/redraft, exact-version review, activity, and promise ledger. Browser checks covered 360px, 768px, and desktop without horizontal clipping, modal keyboard focus/Escape, representative contrast ratios of at least 4.54:1, and reduced-motion behavior. The selected conversation now restores its notes and mode after refresh.
- Published audited source at [wh0th3h3llam1/afterglow](https://github.com/wh0th3h3llam1/afterglow). `.env.local`, SQLite, raw notes, and outbox data remain ignored. Git Credential Manager used the signed-in GitHub account; no repository secret was published.
- Registered `followup-voice` from public commit `d0e24a735e17e8aba741c4cede611e131111e96d`, configured the Daytona environment, and verified a live TrueForge session spec includes the pinned skill, Daytona sandbox setting, and `openai/gpt-5-4-mini`. Actual sandbox creation has not been observed in run events.
- Configured the OpenAI catalog model. A live DRY RUN capture called the Afterglow MCP tools, saved a fictional contact, promise, and draft with its promised URL. A fresh review turn called `get_draft`, then the gated `send_email`; TrueForge emitted `tool.approval_required` for the exact immutable version.
- Approved that fictional DRY RUN through the app's TrueForge `user.tool_approval` path. Browser displayed **Dry run saved** with a local outbox receipt, and SQLite confirmed `approval=allowed`, `delivery=dry_run`, the receipt file exists, and the promise remains open. No Resend call or real email occurred. Browser refresh restored the DRY RUN letter, receipt, mode, and notes.
- Added a read-only **Check actual calls** panel backed by TrueForge session/event history. The latest LIVE session returned two turns, six model messages, and saved-contact/promise/draft MCP calls. The completed DRY RUN session returned three turns, six model messages, `get_draft`, `send_email`, and one approval pause. Both session specs attach `followup-voice` and configure `afterglow-daytona`; neither event history showed sandbox execution. The browser displayed these results without consuming another agent turn.
- The browser now labels a completed DRY RUN **Mock email sent to local outbox** and explicitly says no email reached the recipient. The captured LIVE screen lacked Resend credentials; it now explains that requirement and offers its notes for a new DRY RUN capture. `AFTERGLOW_MODE` sets the new-capture default, while saved conversations retain their original mode.
- The installed SDK's streaming `model.message` omits the full call payload; authoritative `sessions.listEvents` supplies it. Turn state for the verified approval is `done` with `requiredActions`, not `paused`. The adapter now reconciles event history and accepts both SDK state forms while still verifying the pending event and exact tool-call/version references. A unit test covers each form.
- `npm run typecheck` and `npm test` passed after the runtime-inspection change: 23 tests across four files. `npm run build` compiled the final production bundle and routes. After a web-process restart, browser reload restored the completed DRY RUN letter, receipt, mode, and notes; port 3000 returned HTTP 200, MCP health on port 3401 returned 200, and TrueForge on `localhost:8790` returned 200. Production-only `npm audit --omit=dev` returned zero advisories; the full dependency audit reported ten development-tooling advisories (five moderate, five high).
- Audited the seven changed tracked files and staged file list; no credential patterns were present, and `.env.local`, SQLite, outbox, and screenshot paths were ignored. Pushed approval/recovery fixes and records as commit `79844f5` to public `main`.

## Next tasks

1. If LIVE delivery is later requested, configure Resend sender, key, and consenting-recipient allowlist, then test a single real delivery and provider reconciliation within the five-email cap.
2. If Daytona execution itself needs certification, deliberately invoke a sandbox-requiring skill action and inspect the resulting sandbox/provider record; session configuration alone is not proof.

## Blockers and known limits

- The user requested mock email for now. Resend credentials, verified sender, and consenting recipients are absent, so LIVE delivery is intentionally unverified and unavailable.
- The local TrueForge runtime did not require the supplied remote TrueForge access token; it was neither saved nor used.
- TrueForge accepts the Git skill in the live agent spec with Daytona enabled, but no sandbox creation event has been observed. Skill execution itself is not yet certified.
- A live process restart during an active approval pause has not been exercised. Unit tests cover recovery, and browser refresh verified the completed live DRY RUN state.
- TrueForge loopback MCP discovery requires `OUTBOUND_URL_ALLOWED_HOSTS='["127.0.0.1","localhost"]'` on the local runtime process.

## Usage budget

| Meter | Used | Limit |
| --- | ---: | ---: |
| Live OpenAI agent turns | 8 | 30 |
| Real test emails | 0 | 5 |

The first skill-enabled session attempt failed before a model turn because Git skills reject `preload: true`. Two early review turns fetched the draft but did not request approval; a fresh session with revised review instructions reached the approval gate. An initial resume click was rejected locally because the adapter expected only `paused`; it created no delivery. The corrected resume produced one outbox receipt.
