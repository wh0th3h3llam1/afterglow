# Afterglow

Afterglow is a local correspondence desk for conference follow-ups. It turns notes into personal drafts through TrueForge and an Afterglow MCP server, asks for missing details, and requires an explicit TrueForge tool approval before delivery. [Current progress](PROGRESS.md) and [dated decisions](DECISIONS.md) are kept separately so the state of the build is easy to resume.

## Requirements

- Windows PowerShell and Node.js **22.14 or newer**. The machine-wide Node on this development machine is 20.20.0; the commands below use its bundled Node 24.22.1.
- OpenAI key for DRY RUN or LIVE agent turns. Resend key, verified sender, and consenting test recipient for LIVE delivery. Daytona key and a public GitHub repository for the optional runtime skill.
- Run only on localhost. No account system or internet-facing deployment is provided.

## First setup (PowerShell)

Run these commands in `C:\Users\Ash\Documents\ChatGPT\Build`. In a different Windows environment, set `$nodeDir` and `$npmCli` to your Node 22.14+ installation instead.

```powershell
$nodeDir = 'C:\Users\Ash\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$npmCli = 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js'
$env:PATH = "$nodeDir;$env:PATH"
& "$nodeDir\node.exe" $npmCli ci
& "$nodeDir\node.exe" $npmCli run setup:local
& "$nodeDir\node.exe" $npmCli run db:migrate
```

`setup:local` creates an ignored `.env.local` in REPLAY mode with a random MCP bearer token. Put real values in that file; [.env.example](.env.example) lists every placeholder. Database files, notes, local outbox receipts, and secrets stay under ignored paths. Set `AFTERGLOW_MODE` to your preferred default, though each capture also records its selected mode.

## Start the desk

For **REPLAY**, start only the web app:

```powershell
$env:PATH = "$nodeDir;$env:PATH"
& "$nodeDir\node.exe" $npmCli run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) and load the recorded sample. REPLAY makes no model or email-provider calls.

For **DRY RUN** or **LIVE**, use three PowerShell terminals. Set `$nodeDir`, `$npmCli`, and `$env:PATH` in each terminal as above. Terminal 1 starts TrueForge with an explicit loopback connector allowlist:

```powershell
$env:LOCALAPPDATA = 'C:\Users\Ash\Documents\ChatGPT\Build\data\trueforge-local'
$env:OUTBOUND_URL_ALLOWED_HOSTS = '["127.0.0.1","localhost"]'
& "$nodeDir\node.exe" $npmCli run dev:trueforge
```

Terminal 2 starts the Afterglow MCP server:

```powershell
& "$nodeDir\node.exe" $npmCli run dev:mcp
```

With both running, register the connector and, after adding `OPENAI_API_KEY` to `.env.local`, configure the catalog model:

```powershell
& "$nodeDir\node.exe" $npmCli run setup:connector
& "$nodeDir\node.exe" $npmCli run setup:model
```

Terminal 3 starts the web app:

```powershell
& "$nodeDir\node.exe" $npmCli run dev
```

TrueForge's catalog calls this model `openai/gpt-5-4-mini`; its upstream model ID is `gpt-5.4-mini`. The runtime and SDK are pinned to 0.180.0. The connector registers nine tools, and the agent spec gates the literal `send_email` tool name. TrueForge itself listens on localhost port 8790, MCP on 3401, and Next.js on 3000.

## Optional Git-backed voice skill

The runtime skill lives at [skills/followup-voice/SKILL.md](skills/followup-voice/SKILL.md). After publishing this repository publicly, put its HTTPS Git URL and a **40-character commit SHA** in `.env.local` as `AFTERGLOW_SKILL_GIT_URL` and `AFTERGLOW_SKILL_GIT_COMMIT`. Add `DAYTONA_API_KEY`, then run:

```powershell
& "$nodeDir\node.exe" $npmCli run setup:sandbox
& "$nodeDir\node.exe" $npmCli run setup:skill
```

Set `AFTERGLOW_SKILL_ENABLED=true` in `.env.local` and restart the web app. The inline prompt already carries the same safety and tone rules until the Git skill and Daytona environment are verified. A successful connector registration alone does not mean the runtime skill is attached.

## Modes and safety

| Mode | Agent | Delivery result |
| --- | --- | --- |
| **LIVE** | TrueForge + configured OpenAI model | Resend receipt, only after exact-version approval; allowlisted consenting recipient required |
| **DRY RUN** | TrueForge + configured OpenAI model | Local outbox receipt labeled DRY RUN; never claims SENT |
| **REPLAY** | Recorded fixture only | No model, sandbox, or email-provider calls; review is a preview |

Each edit makes a new immutable version. Approval is tied to a pending TrueForge session, turn, tool call, and source event, and the server checks those against the reviewed version before resuming `user.tool_approval`. Each version has one durable delivery intent and one stable idempotency key. An uncertain provider outcome stays **Delivery uncertain** until manually reconciled; no blind retry occurs. Email delivery does not automatically mark a promise kept. The web app has no public send endpoint.

## Two-minute demo

1. Choose REPLAY, then **Load the sample**. A letter, source notes, and a promise appear.
2. Use **What you told me**, **Tweak**, and **Review & send** to inspect the exact version. REPLAY clearly says no provider call occurs.
3. With OpenAI configured, switch to DRY RUN and capture your own notes. Answer a clarification if one is needed. Request final approval, inspect the recipient, subject, body, and URLs, then approve the TrueForge pause. The result is labeled DRY RUN with a local outbox receipt.
4. With Resend configured and a consenting recipient on `TEST_RECIPIENT_ALLOWLIST`, choose LIVE and repeat. Only a confirmed Resend receipt displays SENT.

## Checks

```powershell
& "$nodeDir\node.exe" $npmCli run typecheck
& "$nodeDir\node.exe" $npmCli test
& "$nodeDir\node.exe" $npmCli run build
```

The tests cover missing email, a mismatched identity, missing promised resource, denial, stale edits, duplicate delivery, dry-run isolation, and uncertain provider outcomes. The live OpenAI/Resend path remains unverified until credentials and a consenting recipient are provided; [PROGRESS.md](PROGRESS.md) records the exact verified state and usage counts.
