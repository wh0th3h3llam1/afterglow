"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Mode } from "@/lib/store";

type Conversation = { id: string; rawNotes: string; mode: Mode; status: string; question: string | null; createdAt: string };
type Version = { id: string; versionNumber: number; recipientName: string; recipientEmail: string; subject: string; body: string; resourceLinksJson: string };
type Approval = { id: string; status: string; toolCallId: string };
type Delivery = { status: string; providerReceipt: string | null; failureReason: string | null; mode: string };
type Draft = { id: string; status: string; version: Version | null; approval: Approval | null; delivery: Delivery | null };
type PromiseRow = { id: string; description: string; resourceLink: string | null; status: string };
type View = { conversation: Conversation; drafts: Draft[]; promises: PromiseRow[]; events: { id: string; type: string; createdAt: string; sequence: number }[] };

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { captured: "Captured", processing: "At work", needs_input: "Needs a detail", draft_ready: "Ready to review", awaiting_approval: "Waiting for your OK", sending: "Delivering", sent: "Sent", dry_run: "Dry run saved", failed: "Needs attention", delivery_unknown: "Delivery uncertain", skipped: "Skipped" };
  return labels[status] ?? status;
}

export default function Desk({ sampleNotes }: { sampleNotes: string }) {
  const [mode, setMode] = useState<Mode>("REPLAY");
  const [notes, setNotes] = useState(sampleNotes);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [draftIndex, setDraftIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [redraft, setRedraft] = useState("");
  const [form, setForm] = useState({ recipientName: "", recipientEmail: "", subject: "", body: "", resourceLinks: "" });
  const reviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSelectedId(window.localStorage.getItem("afterglow:selectedConversation")); }, []);
  useEffect(() => { if (selectedId) window.localStorage.setItem("afterglow:selectedConversation", selectedId); }, [selectedId]);
  useEffect(() => {
    if (!reviewOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    reviewRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setReviewOpen(false); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(reviewRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled)") ?? []);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [reviewOpen]);

  const refresh = useCallback(async (id: string | null) => {
    const list = await jsonRequest<{ conversations: Conversation[] }>("/api/conversations");
    setConversations(list.conversations);
    if (id) setView(await jsonRequest<View>(`/api/conversations/${id}`));
  }, []);

  useEffect(() => { void refresh(selectedId).catch((e) => setError(e.message)); }, [refresh, selectedId]);
  useEffect(() => {
    if (!selectedId || !["processing", "sending", "awaiting_approval"].includes(view?.conversation.status ?? "")) return;
    const timer = window.setInterval(() => { void refresh(selectedId).catch(() => {}); }, 2500);
    return () => window.clearInterval(timer);
  }, [refresh, selectedId, view?.conversation.status]);

  const draft = view?.drafts[draftIndex] ?? null;
  const version = draft?.version ?? null;
  const activeMode = view?.conversation.mode ?? mode;

  async function action(work: () => Promise<void>) {
    setBusy(true); setError("");
    try { await work(); await refresh(selectedId); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  }

  function beginEdit() {
    if (!version) return;
    setForm({ recipientName: version.recipientName, recipientEmail: version.recipientEmail, subject: version.subject, body: version.body, resourceLinks: JSON.parse(version.resourceLinksJson).join("\n") });
    setEditing(true);
  }

  return <div className="shell">
    <header className="masthead">
      <div className="brand"><span className="brand-mark" aria-hidden="true">✳</span><span>afterglow</span><span className="brand-rule" /><span className="brand-note">the correspondence desk</span></div>
      <div className="mast-right"><span className="topline">A more thoughtful way to follow up</span><span className={`mode-badge mode-${activeMode.toLowerCase()}`}>{activeMode}</span></div>
    </header>
    <div className="horizon" aria-hidden="true" />
    <div className="desk-intro"><div><p className="eyebrow">TRUEFORGE × OPENAI · CONFERENCE FOLLOW-UP</p><h1>Keep the conversation going.</h1></div><p className="intro-copy">The best follow-up feels like picking up right where you left off.</p></div>
    <main className="desk-grid">
      <section className="capture-panel" aria-labelledby="capture-title">
        <div className="panel-heading"><span className="section-number">01 / THE NOTES</span><span className="tiny-star" aria-hidden="true">✦</span></div>
        <h2 id="capture-title">Who did you meet?</h2>
        <p className="panel-sub">Drop in the details while they’re still fresh. Names, promises, loose ends — all welcome.</p>
        <label className="field-label" htmlFor="mode">Operating mode</label>
        <select id="mode" value={mode} onChange={(e) => { const next = e.target.value as Mode; setMode(next); if (next === "REPLAY") setNotes(sampleNotes); }} disabled={busy}>
          <option value="REPLAY">REPLAY · recorded sample</option><option value="DRY_RUN">DRY RUN · real agent, local outbox</option><option value="LIVE">LIVE · real agent and email</option>
        </select>
        <label className="field-label" htmlFor="notes">Conversation notes</label>
        <textarea id="notes" className="notes-input" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} spellCheck="true" />
        <p className="field-hint">{mode === "REPLAY" ? "Recorded sample only. No model or email calls." : mode === "DRY_RUN" ? "Runs the agent. Delivery stays in a local outbox." : "Uses the agent and Resend after your approval."}</p>
        <button className="primary-button capture-button" disabled={busy || notes.trim().length < 10} onClick={() => action(async () => {
          const data = await jsonRequest<{ id: string }>("/api/conversations", { method: "POST", body: JSON.stringify({ notes, mode }) });
          setSelectedId(data.id); setDraftIndex(0); setEditing(false); setReviewOpen(false);
        })}>{busy ? "Working…" : mode === "REPLAY" ? "Load the sample" : "Turn into a follow-up"}<span aria-hidden="true">↗</span></button>
        {conversations.length > 0 && <div className="recent-list"><h3>On the desk</h3>{conversations.slice(0, 5).map((item) => <button key={item.id} className={`recent-item ${selectedId === item.id ? "selected" : ""}`} onClick={() => { setSelectedId(item.id); setDraftIndex(0); setEditing(false); setReviewOpen(false); }}><span className="recent-dot" /> <span>{new Date(item.createdAt).toLocaleDateString()} <small>{statusLabel(item.status)}</small></span><span aria-hidden="true">→</span></button>)}</div>}
      </section>

      <section className="letters-panel" aria-labelledby="letters-title">
        <div className="panel-heading"><span className="section-number">02 / THE LETTERS</span><span className="letter-count">{view?.drafts.length ?? 0} ON THE DESK</span></div>
        <h2 id="letters-title">A note worth sending.</h2>
        {error && <div role="alert" className="error-banner">{error}</div>}
        {view?.conversation.status === "needs_input" && <div className="question-box"><span className="question-kicker">A LITTLE MORE CONTEXT</span><h3>{view.conversation.question}</h3><label className="field-label" htmlFor="answer">Your answer</label><textarea id="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} /><button className="dark-button" disabled={busy || !answer.trim()} onClick={() => action(async () => { await jsonRequest(`/api/conversations/${selectedId}/answers`, { method: "POST", body: JSON.stringify({ answer }) }); setAnswer(""); })}>Continue the draft <span aria-hidden="true">↗</span></button></div>}
        {view?.conversation.status === "failed" && <div className="question-box"><span className="question-kicker">NEEDS ATTENTION</span><h3>{view.conversation.question || "The agent could not finish this turn."}</h3></div>}
        {!draft && view?.conversation.status !== "needs_input" && view?.conversation.status !== "failed" && <div className="empty-letter"><span className="empty-spark" aria-hidden="true">✳</span><p>{view ? "The agent is working through your notes." : "Your next conversation starts here."}</p><small>{view ? statusLabel(view.conversation.status) : "Capture a conversation to begin."}</small></div>}
        {draft && version && <>
          {view!.drafts.length > 1 && <div className="draft-tabs" role="tablist" aria-label="Drafts">{view!.drafts.map((item, index) => <button key={item.id} role="tab" aria-selected={index === draftIndex} className={index === draftIndex ? "active" : ""} onClick={() => { setDraftIndex(index); setEditing(false); }}>{item.version?.recipientName || `Letter ${index + 1}`}</button>)}</div>}
          <div className="paper-stack"><article className="letter-card"><div className="letter-meta"><span>AFTERGLOW / PERSONAL LETTER</span><span>NO. {String(version.versionNumber).padStart(2, "0")}</span></div>
            <div className="letter-rule" /><div className="letter-header"><span>TO</span><strong>{version.recipientName} <small>· {version.recipientEmail}</small></strong></div><div className="letter-header"><span>SUBJECT</span><strong>{version.subject}</strong></div><div className="letter-rule" />
            {editing ? <div className="edit-form"><label>Recipient name<input value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} /></label><label>Recipient email<input type="email" value={form.recipientEmail} onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })} /></label><label>Subject<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label><label>Letter<textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={10} /></label><label>Resource URLs, one per line<textarea value={form.resourceLinks} onChange={(e) => setForm({ ...form, resourceLinks: e.target.value })} rows={3} /></label><div className="button-row"><button className="dark-button" disabled={busy} onClick={() => action(async () => { await jsonRequest(`/api/drafts/${draft.id}`, { method: "PATCH", body: JSON.stringify({ expectedVersionId: version.id, recipientName: form.recipientName, recipientEmail: form.recipientEmail, subject: form.subject, body: form.body, resourceLinks: form.resourceLinks.split("\n").map((x) => x.trim()).filter(Boolean) }) }); setEditing(false); })}>Save new version</button><button className="text-button" onClick={() => setEditing(false)}>Cancel</button></div></div> : <div className="letter-body">{version.body}</div>}
            {draft.delivery?.status === "sent" && <div className="stamp sent-stamp">SENT</div>}{draft.delivery?.status === "dry_run" && <div className="stamp dry-stamp">DRY RUN</div>}
            <div className="letter-footer"><span>Thoughtfully, Afterglow</span><span className="footer-star" aria-hidden="true">✳</span></div></article></div>
          {draft.delivery && <div className={`delivery-note ${draft.delivery.status}`}><strong>{statusLabel(draft.delivery.status)}</strong><span>{draft.delivery.status === "sent" ? `Resend receipt: ${draft.delivery.providerReceipt}` : draft.delivery.status === "dry_run" ? `Local outbox receipt: ${draft.delivery.providerReceipt}` : draft.delivery.failureReason || "Check the provider receipt before taking further action."}</span></div>}
          <div className="letter-actions"><button className="source-button" onClick={() => setShowNotes(!showNotes)} aria-expanded={showNotes}>{showNotes ? "Hide source note" : "What you told me"} <span aria-hidden="true">↗</span></button><div className="action-right"><button className="text-button" disabled={busy || draft.status !== "draft"} onClick={() => action(async () => { await jsonRequest(`/api/drafts/${draft.id}/skip`, { method: "POST" }); })}>Skip</button><button className="text-button" onClick={beginEdit} disabled={busy || draft.status === "awaiting_approval" || draft.status === "sent" || draft.status === "dry_run" || draft.status === "skipped"}>Tweak</button><button className="primary-button" onClick={() => setReviewOpen(true)} disabled={busy || editing || draft.status === "sent" || draft.status === "dry_run" || draft.status === "skipped"}>{activeMode === "REPLAY" ? "Review preview" : "Review & send"} <span aria-hidden="true">↗</span></button></div></div>
          {showNotes && <div className="source-note"><span className="question-kicker">ORIGINAL NOTES</span><p>{view!.conversation.rawNotes}</p></div>}
          {activeMode !== "REPLAY" && draft.status === "draft" && <div className="redraft-row"><label className="field-label" htmlFor="redraft">Want a different angle?</label><div><input id="redraft" value={redraft} onChange={(e) => setRedraft(e.target.value)} placeholder="Make it warmer, shorter…" /><button className="text-button" disabled={busy || !redraft.trim()} onClick={() => action(async () => { await jsonRequest(`/api/drafts/${draft.id}/redraft`, { method: "POST", body: JSON.stringify({ instruction: redraft }) }); setRedraft(""); })}>Redraft ↗</button></div></div>}
        </>}
      </section>

      <aside className="promises-panel" aria-labelledby="promises-title"><div className="panel-heading"><span className="section-number">03 / THE THREAD</span><span className="tiny-star" aria-hidden="true">✦</span></div><h2 id="promises-title">Small promises,<br />kept well.</h2><p className="panel-sub">A good conversation leaves a thread. Here’s what you said you’d do.</p><div className="ledger-heading">PROMISES <span>{view?.promises.length ?? 0}</span></div>{view?.promises.length ? <div className="promise-list">{view.promises.map((item) => <div className="promise-item" key={item.id}><span className={`promise-check ${item.status}`} aria-hidden="true">{item.status === "kept" ? "✓" : "·"}</span><div><strong>{item.description}</strong><small>{item.resourceLink || "Resource still needed"}</small><em>{item.status === "kept" ? "Promise kept" : "Open promise"}</em></div></div>)}</div> : <p className="ledger-empty">Promises from the conversation will appear here.</p>}<div className="activity"><div className="ledger-heading">ACTIVITY <span>{view?.events.length ?? 0}</span></div>{view?.events.slice(-7).reverse().map((event) => <div className="activity-item" key={event.id}><span className="activity-mark" /><div><strong>{event.type === "replay.fixture" ? "Recorded sample loaded" : event.type.replaceAll(".", " ")}</strong><small>{new Date(event.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></div></div>)}{!view?.events.length && <p className="ledger-empty">The agent’s actual events appear as it works.</p>}</div></aside>
    </main>
    <footer className="site-footer"><span>AFTERGLOW · THE CORRESPONDENCE DESK</span><span>Nothing leaves without your OK.</span></footer>
    {reviewOpen && draft && version && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setReviewOpen(false); }}><div className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" ref={reviewRef}><button className="modal-close" aria-label="Close review" onClick={() => setReviewOpen(false)}>×</button><span className="question-kicker">{activeMode} · EXACT VERSION {version.versionNumber}</span><h2 id="review-title">The final look.</h2><p>Check every detail before the delivery step.</p><div className="review-fields"><div><small>RECIPIENT</small><strong>{version.recipientName} &lt;{version.recipientEmail}&gt;</strong></div><div><small>SUBJECT</small><strong>{version.subject}</strong></div><div><small>BODY</small><pre>{version.body}</pre></div><div><small>RESOURCE LINKS</small><strong>{JSON.parse(version.resourceLinksJson).join(" · ") || "None"}</strong></div></div>
      {activeMode === "REPLAY" ? <div className="replay-notice">REPLAY preview only. No TrueForge or email-provider call will occur.</div> : draft.approval ? <div className="approval-actions"><p className="approval-callout">Waiting for your OK. This decision applies only to the version shown above.</p><button className="text-button" disabled={busy} onClick={() => action(async () => { await jsonRequest(`/api/approvals/${draft.approval!.id}`, { method: "POST", body: JSON.stringify({ decision: "deny" }) }); setReviewOpen(false); })}>Don’t send</button><button className="primary-button" disabled={busy} onClick={() => action(async () => { await jsonRequest(`/api/approvals/${draft.approval!.id}`, { method: "POST", body: JSON.stringify({ decision: "allow" }) }); setReviewOpen(false); })}>{activeMode === "LIVE" ? "Approve & send" : "Approve dry run"} ↗</button></div> : <div className="approval-actions"><button className="text-button" onClick={() => setReviewOpen(false)}>Keep editing</button><button className="primary-button" disabled={busy || draft.status !== "draft"} onClick={() => action(async () => { await jsonRequest(`/api/drafts/${draft.id}/review`, { method: "POST", body: JSON.stringify({ expectedVersionId: version.id }) }); })}>Request final approval ↗</button></div>}
    </div></div>}
  </div>;
}
