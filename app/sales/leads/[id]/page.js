// app/sales/leads/[id]/page.js
//
// One prospect: where they are in the pipeline, what has been said to them, and
// the box that says the next thing.
//
// ══ Three states the compose box can be in, and only one of them types ═════
//
//   1. Outreach isn't configured. No box at all — OutreachNotice stands in its
//      place and names the setting that is missing. A box that posts into a
//      409 is the dead control AGENTS.md opens with.
//   2. The prospect asked to stop. No box, and the reason said plainly. The
//      server refuses this too; the UI agreeing with it is courtesy, not
//      security.
//   3. Ready. The box renders, and any warning (replies not being filed yet)
//      renders above it rather than being swallowed.
//
// `params` is a Promise in Next 16, so this reads it with `use()` rather than
// destructuring it.
"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  Building2,
  Loader2,
  Mail,
  Send,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/sales/outreachPipeline";
import OutreachNotice from "../OutreachNotice";

function when(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SalesLeadPage({ params }) {
  const { id } = use(params);

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [candidates, setCandidates] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const next = await fetchJson(`/api/sales/leads/${id}`);
      setData(next);
      setNotes(next.lead.notes || "");
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const lead = data?.lead;
  const outreach = data?.outreach;
  const optedOut = data?.optedOut;

  async function patch(body) {
    setBusy(true);
    setError("");
    try {
      const next = await fetchJson(`/api/sales/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: jsonBody(body, "lead"),
      });
      setData((d) => ({ ...d, lead: next.lead }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadCandidates() {
    setError("");
    try {
      const next = await fetchJson(`/api/sales/leads/${id}/link`);
      setCandidates(next.candidates);
    } catch (err) {
      setError(err.message);
    }
  }

  async function link(companyId) {
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/sales/leads/${id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ companyId }, "link"),
      });
      setCandidates(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function send(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/sales/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ leadId: id, subject, body: message }, "email"),
      });
      setSubject("");
      setMessage("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!lead) {
    return (
      <div className="space-y-4">
        <Link href="/sales/leads" className="text-sm text-muted-foreground flex items-center gap-1">
          <ArrowLeft size={14} /> My leads
        </Link>
        {error ? (
          <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
            {error}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" /> Loading…
          </div>
        )}
      </div>
    );
  }

  const canCompose = Boolean(outreach?.canSend) && !optedOut && Boolean(lead.email);

  return (
    <div className="space-y-6">
      <Link href="/sales/leads" className="text-sm text-muted-foreground flex items-center gap-1">
        <ArrowLeft size={14} /> My leads
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">{lead.businessName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {[lead.contactName, lead.email, lead.phone].filter(Boolean).join(" · ") ||
            "No contact details yet"}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {LEAD_STATUSES.map((s) => (
          <button
            key={s}
            disabled={busy}
            onClick={() => patch({ status: s })}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border disabled:opacity-60 ${
              lead.status === s
                ? "bg-inverted text-inverted-foreground border-inverted"
                : "border-border text-muted-foreground"
            }`}
          >
            {LEAD_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* ── Did they sign up? ───────────────────────────────────────────────
          Only companies already attributed to this rep can be named here, and
          the server re-checks that at write time. See the link route's header:
          this is bookkeeping catching up to an attribution, never the other
          way round. */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Building2 size={15} className="text-muted-foreground" />
          Signed up as
        </div>
        {lead.convertedCompanyId ? (
          <p className="text-sm text-muted-foreground">
            Linked to a company you brought in
            {lead.convertedAt ? ` on ${when(lead.convertedAt)}` : ""}. Your
            commission for them is computed from the attribution, not from this
            link.
          </p>
        ) : candidates === null ? (
          <button
            onClick={loadCandidates}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-border"
          >
            Link a signup
          </button>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None of your signups are unlinked. A company only appears here once
            it is attributed to you.
          </p>
        ) : (
          <div className="space-y-1.5">
            {candidates.map((c) => (
              <button
                key={c.id}
                disabled={busy}
                onClick={() => link(c.id)}
                className="w-full text-left text-sm px-3 py-2 rounded-md border border-border hover:bg-muted/50 disabled:opacity-60"
              >
                <span className="font-medium text-foreground">{c.name}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {when(c.createdAt)}
                  {c.isDemo ? " · demo account" : ""}
                  {c.matchesEmail ? " · same email as this lead" : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <label className="text-sm font-semibold text-foreground">Notes</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          disabled={busy || notes === (lead.notes || "")}
          onClick={() => patch({ notes })}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-border disabled:opacity-50"
        >
          Save notes
        </button>
      </div>

      {/* ── Conversations ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mail size={15} className="text-muted-foreground" />
          Conversations
        </h2>
        {lead.threads.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
        )}
        {lead.threads.map((t) => (
          <Link
            key={t.id}
            href={`/sales/threads/${t.id}`}
            className="block rounded-lg border border-border px-4 py-3 hover:bg-muted/50"
          >
            <p className="text-sm font-medium text-foreground truncate">{t.subject}</p>
            <p className="text-xs text-muted-foreground">
              {t.messages.length} message{t.messages.length === 1 ? "" : "s"} · last{" "}
              {when(t.lastMessageAt)}
            </p>
          </Link>
        ))}
      </div>

      {/* ── Compose ────────────────────────────────────────────────────────── */}
      <OutreachNotice outreach={outreach} />

      {optedOut && (
        <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 flex items-start gap-2 text-sm">
          <Ban size={16} className="mt-0.5 text-red-700 dark:text-red-300 shrink-0" />
          <div>
            <p className="font-semibold text-red-900 dark:text-red-200">
              This prospect asked not to be emailed again.
            </p>
            <p className="text-red-800 dark:text-red-300/90">
              They replied with an unsubscribe request, so email to them is
              switched off here and refused by the server. CASL requires that to
              stick.
            </p>
          </div>
        </div>
      )}

      {!lead.email && !optedOut && (
        <p className="text-sm text-muted-foreground">
          Add an email address to this lead to write to them.
        </p>
      )}

      {canCompose && (
        <form onSubmit={send} className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold text-foreground">
            New email to {lead.email}
          </div>
          <p className="text-xs text-muted-foreground">
            Sent from your own address, {outreach.from}. Their reply reaches your
            mailbox and is filed here. FieldQuo&apos;s name and mailing address
            and an unsubscribe line are added to the bottom — CASL requires both
            in a commercial email.
          </p>
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            required
            rows={8}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write the email…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="text-sm font-semibold px-3 py-2 rounded-lg bg-inverted text-inverted-foreground flex items-center gap-1.5 disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Send
          </button>
        </form>
      )}
    </div>
  );
}
