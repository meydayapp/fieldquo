// app/sales/leads/[id]/page.js
//
// One prospect: where they are in the pipeline, what has been said to them, and
// the box that says the next thing.
//
// ══ The phone is on this screen, not only in the queue ════════════════════
//
// It was not, until the owner opened his own leads and found four businesses
// with numbers on them and nothing to press. The queue had the whole console —
// dial, timer, mute, hang up, disposition, notes — and the queue is fed by
// discovery, so a rep whose pool is empty had a portal that could not make a
// phone call at all. The server had always accepted a lead as a call target
// (app/api/sales/calls's targetFor, SalesCallAttempt.leadId); only the screen
// was missing. It renders the SAME component the queue does — see
// app/components/sales/DialRegion.js on why this is not a second copy.
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

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  Building2,
  Loader2,
  Mail,
  MapPin,
  Send,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/sales/outreachPipeline";
import { dialHref, salesCallReadiness } from "@/lib/sales/callingRules";
import { dialSpace } from "@/lib/sales/dialSpace";
import { SALES_SMS_TIME_ZONES } from "@/lib/sales/smsWindow";
import DialRegion from "@/app/components/sales/DialRegion";
import OutreachNotice from "../OutreachNotice";
import SignupLinkSms from "../SignupLinkSms";

// Matches the console's fields — 44px tall and 16px text, so a phone does not
// zoom the page when a rep taps one.
const FIELD =
  "mt-1 w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";

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
  // Where the phone rings. Held separately from `lead` because these three are
  // an unsaved edit until Save is pressed, and writing them straight onto the
  // loaded lead would make the dial region flip to "allowed" before anything
  // had been stored.
  const [place, setPlace] = useState({ country: "", province: "", timeZone: "" });
  const [placeOpen, setPlaceOpen] = useState(false);
  // The server's clock against ours, so the calling window is judged on the
  // server's time. Same reason the queue carries one: a laptop set to the
  // wrong zone would silently move a legal call an hour.
  const [clock, setClock] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const next = await fetchJson(`/api/sales/leads/${id}`);
      setData(next);
      setNotes(next.lead.notes || "");
      setPlace({
        country: next.lead.country || "",
        province: next.lead.province || "",
        timeZone: next.lead.timeZone || "",
      });
      const serverMs = next?.serverNow ? Date.parse(next.serverNow) : NaN;
      setClock(Number.isFinite(serverMs) ? { serverMs, localMs: Date.now() } : null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-evaluate the calling window while the screen sits open. A rep who
  // opened a lead at 20:58 must not still be looking at a live Call button at
  // 21:01 — the queue re-asks on the same cadence and for the same reason.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id2 = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id2);
  }, []);

  const lead = data?.lead;
  const outreach = data?.outreach;
  const optedOut = data?.optedOut;
  // The reason the SERVER reached, not one this screen assumes. contactOptedOut
  // answers from two sources and describeSuppression() writes the sentence:
  // which address or domain is listed, and how it got there — replied, asked on
  // the phone, texted STOP, a regulator's list. Until 2026-09-03 the route sent
  // this and nothing read it, and the screen printed "they replied with an
  // unsubscribe request" over all seven mechanisms.
  const optedOutReason = data?.optedOutReason;

  async function patch(body) {
    setBusy(true);
    setError("");
    try {
      const next = await fetchJson(`/api/sales/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: jsonBody(body, "lead"),
      });
      // Merged wholesale, not just the lead: the PATCH answer carries the
      // recomputed dial view and the server clock, and keeping the old `call`
      // beside a new location is how the screen would keep saying "we cannot
      // confirm" about a state the rep just typed in.
      setData((d) => ({ ...d, ...next }));
      setPlace({
        country: next.lead.country || "",
        province: next.lead.province || "",
        timeZone: next.lead.timeZone || "",
      });
      const serverMs = next?.serverNow ? Date.parse(next.serverNow) : NaN;
      if (Number.isFinite(serverMs)) setClock({ serverMs, localMs: Date.now() });
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

  // ── The call, decided exactly the way the queue decides it ───────────────
  //
  // Same three functions, same order: salesCallReadiness reads the rules,
  // dialHref is the only thing allowed to produce a tel: target, and dialSpace
  // re-gates that href against the decision. Nothing here shortcuts any of
  // them, which is what keeps a lead and a prospect from getting two different
  // answers about the same statute.
  const call = data?.call || null;
  const compliance = call
    ? salesCallReadiness({
        prospect: {
          country: call.callingContext.country,
          province: call.callingContext.province,
        },
        timeZone: call.callingContext.timeZone,
        now: new Date(clock ? clock.serverMs + (Date.now() - clock.localMs) : Date.now()),
      })
    : null;
  // `tick` is read so the window above is re-judged every thirty seconds.
  void tick;
  const space = dialSpace({
    // dialSpace reads `contact` and nothing else off this object, and the
    // server built that in the shape it expects — see lib/sales/leadDial.js.
    prospect: call ? { contact: call.contact } : null,
    compliance,
    href: dialHref(compliance, call?.phoneE164),
    claimedCount: 0,
  });

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

      {/* ── The phone ────────────────────────────────────────────────────────
          First, above the pipeline chips and the compose box, because ringing
          them is the thing a rep opened this screen to do. Never blank: every
          state DialRegion can be in says what is missing and what would fix
          it. */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Call them</h2>
          {call?.phoneE164 ? (
            <span className="text-xs text-muted-foreground tabular-nums">{call.phoneE164}</span>
          ) : null}
        </div>

        <DialRegion
          space={space}
          compliance={compliance}
          target={
            call
              ? {
                  leadId: lead.id,
                  phoneE164: call.phoneE164,
                  businessName: lead.businessName,
                }
              : null
          }
          onWorked={load}
        />

        {/* ── Where the phone rings ──────────────────────────────────────────
            The one thing a rep can do about "we cannot confirm this call is
            allowed", and therefore rendered right under the sentence that says
            it. Calling hours are the jurisdiction's, and 16 CFR 310.6(b)(7)
            exempts business calls from the federal rule entirely — so without
            a state there is nothing to evaluate and no federal floor to fall
            back on. Open by default when it is missing, folded once it is
            answered: a rep working a lead they have already located should not
            scroll past a form they filled in last week. */}
        <details
          open={placeOpen || !(lead.country && lead.province)}
          onToggle={(e) => setPlaceOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer text-xs text-muted-foreground flex items-center gap-1.5">
            <MapPin size={13} />
            {lead.country && lead.province
              ? `Where they are: ${lead.province}, ${lead.country}`
              : "Say where this business is"}
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Nothing is inferred from the area code — it is wrong for every ported number, and a
              guessed state would be a guessed statute.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-xs text-muted-foreground">
                Country
                <select
                  className={FIELD}
                  value={place.country}
                  onChange={(e) => setPlace((p) => ({ ...p, country: e.target.value }))}
                >
                  <option value="">Not stated</option>
                  <option value="CA">Canada</option>
                  <option value="US">United States</option>
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                State or province
                <input
                  className={FIELD}
                  value={place.province}
                  placeholder="ON, QC, TX…"
                  onChange={(e) => setPlace((p) => ({ ...p, province: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Their time zone
                <select
                  className={FIELD}
                  value={place.timeZone}
                  onChange={(e) => setPlace((p) => ({ ...p, timeZone: e.target.value }))}
                >
                  <option value="">Not stated</option>
                  {SALES_SMS_TIME_ZONES.map((z) => (
                    <option key={z.value} value={z.value}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                patch({
                  country: place.country,
                  province: place.province,
                  timeZone: place.timeZone,
                })
              }
              className="inline-flex items-center min-h-[44px] text-sm font-semibold px-4 rounded-lg border border-border disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} className="animate-spin mr-2" /> : null}
              Save where they are
            </button>
          </div>
        </details>
      </section>

      <div className="flex flex-wrap gap-1.5">
        {LEAD_STATUSES.map((s) => (
          <button
            key={s}
            disabled={busy}
            onClick={() => patch({ status: s })}
            // 44px: these five chips are how a rep moves a lead through the
            // pipeline one-handed, and they were 26px tall.
            className={`inline-flex items-center min-h-[44px] text-xs font-semibold px-3 rounded-full border disabled:opacity-60 ${
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
            className="inline-flex items-center min-h-[44px] text-sm font-semibold px-3 rounded-lg border border-border"
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
          className="inline-flex items-center min-h-[44px] text-sm font-semibold px-3 rounded-lg border border-border disabled:opacity-50"
        >
          Save notes
        </button>
      </div>

      {/* ── The signup link, by text ────────────────────────────────────────
          Its own component with its own fetch, because it asks a different
          question than the rest of this screen: whether FieldQuo holds a sales
          number, whether the mailing address is set, and what time it is where
          the prospect is. It decides for itself whether to render a button —
          see its header. */}
      <SignupLinkSms leadId={id} />

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
              FieldQuo may not email this prospect.
            </p>
            {/* The computed sentence, not an invented one. A domain-wide entry
                and a regulator's list are both reachable here, and neither is
                "this person unsubscribed" — telling a rep it was is how they
                ring back to argue about an email nobody sent. */}
            {optedOutReason ? (
              <p className="text-red-800 dark:text-red-300/90">{optedOutReason}</p>
            ) : null}
            <p className="text-red-800 dark:text-red-300/90">
              There is no compose box, and the server refuses the send as well —
              re-asked in the request that sends, so an opt-out that arrived
              while you were typing still wins. CASL requires that to stick.
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
            {/* `outreach.from` is the WORK mailbox now, not the sign-in
                address — see lib/sales/outreachSender.js's repSendingAddress.
                Saying "your own address" over a mailbox a superadmin assigned
                would be the sentence a rep reads before wondering where a
                reply went. */}
            Sent from your work mailbox, {outreach.from}. Their reply reaches it
            and is filed here. FieldQuo&apos;s name and mailing address
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
