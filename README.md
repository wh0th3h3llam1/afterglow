# Afterglow

A conference follow-up desk. You write who you met, Afterglow drafts a letter you approve, and the graph keeps the promise. Mail stays on this machine. Nothing is sent to a real inbox.

## Run it

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173.

Copy `.env.example` to `.env` and fill in the values locally. `.env` is gitignored. Do not commit it.

## What you can do

- Pick a conference, or choose **All events** to scroll every person.
- Click a badge. The light follows it. Write the note and turn it into a letter. The letter stays a draft until you approve it.
- Search a name. Voice records from the microphone and writes the words into the search bar, or into the field you last selected. In a browser without speech recognition, the recording is transcribed through the gateway when you stop.
- Add someone from the Agents panel: "I met Ada from Loom." That adds a badge and writes the meeting to the graph.
- Open **Graph** for the 3D conference graph. Drag to turn it, scroll to zoom, right-drag to pan, and toggle each edge type.

## Services

The app runs without these, on the local fixtures. Connect them in `.env` when you want the live path.

| Variable | Used for |
|---|---|
| `TRUEFORGE_BASE_URL` | Local approval loop. Default `http://localhost:8790`. |
| `TRUEFORGE_GATEWAY_URL` | Phrasing and speech transcription. |
| `TRUEFORGE_ACCESS_TOKEN` | Gateway access. Stays on the server. |
| `TRUEFORGE_MODEL` | Chat model. Default `openai/gpt-5.6-luna`. |
| `TRUEFORGE_TRANSCRIBE_MODEL` | Speech model. Default `openai/whisper-1`. |
| `QODO_API_KEY` | Qodo tool handshake. Stays on the server. |
| `FALKORDB_HOST`, `FALKORDB_PORT`, `FALKORDB_USERNAME`, `FALKORDB_PASSWORD` | Conference graph. TLS on, graph name `conference`. |

## Checks

```bash
npm test
npm run build
```
