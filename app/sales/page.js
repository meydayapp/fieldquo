// app/sales/page.js
//
// The portal's front door: what a rep should do next, and their own numbers.
//
// ══ What was here before, and why it moved ═══════════════════════════════
//
// The attributed-companies table, now at /sales/companies. It is a good screen
// and it was the wrong front door: it answers "did the ones I closed stick?",
// which is a month-end question, while a rep opening this portal is standing
// outside a shop between calls asking "who is waiting on me". Two different
// questions, so two screens rather than one screen with a scoreboard bolted on.
//
// ══ Four independent loads, and one of them failing is not a zero ════════
//
// Every card fetches its own endpoint and holds its own state. That is more
// code than one aggregating call and it is the shape the data forces: there is
// no /api/sales/home, this work may not add one (the API surface belongs to
// another brief), and — more importantly — a rep on a driveway connection gets
// three cards and one honest "couldn't load" instead of a blank page. Nothing
// here ever renders 0 for a load that failed; `null` and `0` are different
// values all the way from the fetch to the sentence at the top. lib/loadState.js
// argues the general case; app/sales/nextAction.js is where it is enforced.
//
// ══ The signup link finally has a reader ═════════════════════════════════
//
// /api/sales/me has returned `signupLink` and `signups` since it was written
// and NOTHING rendered either — the first recurring failure class in
// AGENTS.md, a field written and never read, sitting on the one artefact a rep
// actually hands to a contractor. Both are on this screen now.
//
// ══ English, like the four screens beside it ═════════════════════════════
//
// The shell and /sales/companies are translated; queue, leads, threads and
// notes are not (docs/sales-intel/STATUS.md records the decision). This is a
// working screen next to those four, so it follows them. The keys it would
// need are listed in the report that shipped it, ready to add to
// app/i18n/appMessages.js — that catalogue is gated on English and French
// only, so translating this surface is a smaller job than it looks.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Users,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import {
  LAPSE_WARNING_HOURS,
  nextAction,
  queueSummary,
  repliesWaiting,
  untouchedLeads,
} from "./nextAction";
import OutreachNotice from "./leads/OutreachNotice";

const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";
const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";

/**
 * One fetch, one piece of state, three outcomes.
 *
 * `data === null && error === ""` is "still loading"; `error` set is "we asked
 * and did not get an answer". Kept as one hook so no card can accidentally
 * collapse the two into a falsy check and render an empty list for a failure.
 */
function useEndpoint(url) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson(url));
    } catch (err) {
      // The failed load REPLACES the data. Leaving a stale payload beside a
      // red banner is how a screen shows yesterday's number as today's.
      setData(null);
      setError(err?.message || "That didn’t load.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load };
}

/** A card that says what failed and offers the one control that can fix it. */
function CardError({ message, onRetry }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
      <div className="min-w-0 space-y-2">
        <p className="text-foreground break-words">{message}</p>
        <button type="button" onClick={onRetry} className={`${BTN} border border-border text-foreground`}>
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    </div>
  );
}

/**
 * A number, or the reason there isn't one. Never a zero standing in for either.
 */
function Figure({ value, label, loading }) {
  return (
    <div className="min-w-0">
      <p className="text-2xl font-semibold text-foreground tabular-nums">
        {loading ? (
          <Loader2 size={18} className="animate-spin inline text-muted-foreground" />
        ) : value === null || value === undefined ? (
          <span className="text-base font-medium text-muted-foreground">Not loaded</span>
        ) : (
          value
        )}
      </p>
      <p className="text-xs text-muted-foreground break-words">{label}</p>
    </div>
  );
}

export default function SalesHomePage() {
  const me = useEndpoint("/api/sales/me");
  // No trade filter: the home screen wants the rep's whole book and the whole
  // pool, which is what this route returns when nothing is named.
  const queue = useEndpoint("/api/sales/queue");
  const leads = useEndpoint("/api/sales/leads");
  const threads = useEndpoint("/api/sales/threads");

  const [copied, setCopied] = useState(false);

  const q = queueSummary(queue.data);
  const replies = repliesWaiting(threads.data?.threads);
  const untouched = untouchedLeads(leads.data?.counts);

  const action = nextAction({
    repliesWaiting: replies,
    prospectsToCall: q.toCall,
    freeToClaim: q.freeToClaim,
    newLeads: untouched,
  });

  const stillLoading = me.loading || queue.loading || leads.loading || threads.loading;
  const signupLink = me.data?.signupLink || null;
  // Clipboard access is absent on an insecure origin and in some in-app
  // browsers. The button only exists where the API does; the link itself is in
  // a selectable field either way, so nothing is unreachable without it.
  const canCopy =
    typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";

  async function copyLink() {
    if (!signupLink || !canCopy) return;
    try {
      await navigator.clipboard.writeText(signupLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // A refused clipboard permission is not a success. Say nothing rather
      // than showing "Copied" over a clipboard that still holds something else.
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        {/* Not "Good morning" — this is read at 07:00 and at 20:00 and the
            portal has no idea which, so it says nothing it cannot know. */}
        <h1 className="text-xl font-semibold text-foreground break-words">Your day</h1>
        <p className="text-sm text-muted-foreground">
          Everything below is yours alone. Nothing here is another rep&rsquo;s book.
        </p>
      </header>

      {/* ── The one sentence ────────────────────────────────────────────────
          Its own card, at the top, because it is the reason the screen exists.
          When a card below it failed to load, this says so instead of ranking
          the rungs it can still see — see app/sales/nextAction.js. */}
      <section
        className={`rounded-xl border p-4 space-y-3 ${
          action.code === "unknown"
            ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40"
            : "border-border bg-card"
        }`}
      >
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Next</p>
        {stillLoading && action.code === "unknown" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Working out what&rsquo;s waiting on you…
          </p>
        ) : (
          <>
            <p
              className={`text-lg font-semibold break-words ${
                action.code === "unknown"
                  ? "text-amber-900 dark:text-amber-200"
                  : "text-foreground"
              }`}
            >
              {action.headline}
            </p>
            <p
              className={`text-sm break-words ${
                action.code === "unknown"
                  ? "text-amber-900 dark:text-amber-200"
                  : "text-muted-foreground"
              }`}
            >
              {action.detail}
            </p>
            {action.href && (
              <Link href={action.href} className={`${BTN} bg-primary text-primary-foreground w-full`}>
                {action.cta} <ArrowRight size={16} />
              </Link>
            )}
          </>
        )}
      </section>

      {/* Outreach readiness, from whichever of the two lists answered. Both
          routes compute it; taking the first that arrived avoids claiming
          sending is fine because the other request is still in flight. */}
      <OutreachNotice outreach={leads.data?.outreach || threads.data?.outreach} />

      {/* ── Conversations ─────────────────────────────────────────────────── */}
      <section className={CARD}>
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-muted-foreground shrink-0" />
          <h2 className="text-base font-semibold text-foreground">Conversations</h2>
        </div>
        {threads.error ? (
          <CardError message={threads.error} onRetry={threads.reload} />
        ) : (
          <>
            <div className="flex gap-6">
              <Figure value={replies} label="waiting on your reply" loading={threads.loading} />
              <Figure
                value={threads.data?.threads ? threads.data.threads.length : null}
                label="open threads"
                loading={threads.loading}
              />
            </div>
            <Link href="/sales/threads" className={`${BTN} border border-border text-foreground w-full`}>
              Open conversations
            </Link>
          </>
        )}
      </section>

      {/* ── The queue ─────────────────────────────────────────────────────── */}
      <section className={CARD}>
        <div className="flex items-center gap-2">
          <Phone size={16} className="text-muted-foreground shrink-0" />
          <h2 className="text-base font-semibold text-foreground">Your queue</h2>
        </div>
        {queue.error ? (
          <CardError message={queue.error} onRetry={queue.reload} />
        ) : (
          <>
            <div className="flex gap-6">
              <Figure value={q.toCall} label="claimed, not called yet" loading={queue.loading} />
              <Figure value={q.freeToClaim} label="free to claim" loading={queue.loading} />
            </div>
            {/* Rendered only when it is true. A permanently visible "0 lapse
                soon" trains a rep to stop reading the line that matters. */}
            {q.lapsingSoon ? (
              <p className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200 break-words">
                <Clock size={15} className="mt-0.5 shrink-0" />
                {q.lapsingSoon} {q.lapsingSoon === 1 ? "claim lapses" : "claims lapse"} within{" "}
                {LAPSE_WARNING_HOURS} hours and go back in the pool.
              </p>
            ) : null}
            <Link href="/sales/queue" className={`${BTN} border border-border text-foreground w-full`}>
              Open the queue
            </Link>
          </>
        )}
      </section>

      {/* ── Leads ─────────────────────────────────────────────────────────── */}
      <section className={CARD}>
        <div className="flex items-center gap-2">
          <Users size={16} className="text-muted-foreground shrink-0" />
          <h2 className="text-base font-semibold text-foreground">My leads</h2>
        </div>
        {leads.error ? (
          <CardError message={leads.error} onRetry={leads.reload} />
        ) : (
          <>
            <div className="flex gap-6">
              <Figure value={untouched} label="added, not contacted" loading={leads.loading} />
              <Figure
                value={leads.data?.counts ? (leads.data.counts.contacted ?? 0) : null}
                label="contacted"
                loading={leads.loading}
              />
            </div>
            <Link href="/sales/leads" className={`${BTN} border border-border text-foreground w-full`}>
              Open my leads
            </Link>
          </>
        )}
      </section>

      {/* ── The rep's own numbers ─────────────────────────────────────────── */}
      <section className={CARD}>
        <h2 className="text-base font-semibold text-foreground">Signups you brought in</h2>
        {me.error ? (
          <CardError message={me.error} onRetry={me.reload} />
        ) : (
          <>
            <div className="flex flex-wrap gap-6">
              <Figure value={me.data?.signups?.today ?? null} label="today (UTC)" loading={me.loading} />
              <Figure
                value={me.data?.signups?.thisWeek ?? null}
                label="this week (UTC, from Monday)"
                loading={me.loading}
              />
              <Figure value={me.data?.signups?.total ?? null} label="all time" loading={me.loading} />
            </div>
            <p className="text-xs text-muted-foreground break-words">
              {/* lib/sales/repStats.js fixes the day boundary at UTC on purpose,
                  and its own comment asks the UI to say so rather than let a rep
                  read it as their local midnight. */}
              Counted in UTC so every rep and the office agree on what &ldquo;today&rdquo; means — your
              local evening may already be tomorrow here.
            </p>
            <Link href="/sales/companies" className={`${BTN} border border-border text-foreground w-full`}>
              What happened to them
            </Link>
          </>
        )}
      </section>

      {/* ── The signup link ───────────────────────────────────────────────── */}
      <section className={CARD}>
        <h2 className="text-base font-semibold text-foreground">Your signup link</h2>
        {me.error ? (
          <CardError message={me.error} onRetry={me.reload} />
        ) : me.loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </p>
        ) : signupLink ? (
          <>
            <p className="text-sm text-muted-foreground break-words">
              A company that signs up through this is attributed to you at signup. Nothing else
              claims a company — there is no form anywhere that lets a rep assert one.
            </p>
            {/* readOnly, not disabled: a disabled input cannot be selected, and
                selecting the text is the fallback when there is no clipboard. */}
            <input
              readOnly
              value={signupLink}
              onFocus={(e) => e.target.select()}
              aria-label="Your signup link"
              className="w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-muted text-foreground"
            />
            {canCopy && (
              <button type="button" onClick={copyLink} className={`${BTN} border border-border text-foreground w-full`}>
                {copied ? <CheckCircle2 size={16} /> : <ClipboardCopy size={16} />}
                {copied ? "Copied" : "Copy the link"}
              </button>
            )}
            {me.data?.code && (
              <p className="text-xs text-muted-foreground break-words">
                Your code is <span className="font-mono">{me.data.code}</span>. It is fixed — a
                changed code would quietly stop crediting the links already printed on a card.
              </p>
            )}
          </>
        ) : (
          // signupLinkFor() returns null when it has no origin or no code, and
          // a half-built URL handed to a contractor is worse than none.
          <p className="text-sm text-muted-foreground break-words">
            No signup link could be built for your account. Ask a superadmin to check your rep code
            on the Reps screen — nothing is shown here rather than a link that would not attribute.
          </p>
        )}
      </section>
    </div>
  );
}
