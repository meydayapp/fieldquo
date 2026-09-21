// app/platform/signups/page.js
//
// The people who wanted FieldQuo enough to type their business into it, and
// then hit the card screen and stopped.
//
// ══ Why this screen exists ═════════════════════════════════════════════════
//
// Ten of them are sitting in the live database and nothing has ever shown them
// to anybody: the dashboard counted them as companies, the company list showed
// them as "pending" beside real customers, and the trial banner filed them
// under "in an unpaid free month" — which is three screens agreeing that a
// person who gave FieldQuo no card and no money is a customer.
//
// The owner's instruction was "flag it to the fieldquo platform so that we call
// them". This is the flag. Everything on a row is something a rep needs before
// dialling, and the two that matter most are the two that stop a call going
// wrong: whether the recovery email has already gone out, and whether this
// person is on FieldQuo's own do-not-contact list.
//
// English only, like the rest of the console.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Ban,
  Building2,
  Flame,
  Loader2,
  Mail,
  MailCheck,
  Phone,
  RefreshCw,
} from "lucide-react";
import { count } from "@/app/components/platform/MetricCard";

/**
 * What the nudge decision means, in words a person can act on.
 *
 * Keyed off the reason code lib/signup/abandoned.js returns rather than
 * re-derived here — a second opinion about the same question written beside the
 * screen is exactly how the trial count came to be wrong on two tiles at once.
 * An unknown code falls through to the code itself rather than to a friendly
 * sentence that might be false.
 */
const NUDGE_LABELS = {
  due: "Email goes out on tonight's run",
  too_early: "Too new — waiting out the delay",
  too_late: "Past the window — no email will be sent",
  already_nudged: "Recovery email sent",
  address_already_nudged: "Covered by an email to the same address",
  suppressed: "On the do-not-contact list — no email",
  no_recipient: "No email address on the signup",
  no_owner: "No owner — created from the console, not a signup",
  completed_checkout: "Completed checkout (should not be on this list)",
  demo: "Demo account (should not be on this list)",
  no_created_at: "No signup date on record",
  held_by_rep: "A rep holds this signup — their intro replaces the email",
};

/**
 * Where a started-never-finished signup stands on the sales floor, in words.
 * Keyed off the state code /api/platform/signups derives from the row and
 * its Prospect, never re-derived here.
 */
function startedState(state) {
  switch (state?.code) {
    case "rep_lead":
      return { text: `${state.rep?.name || "A rep"}'s lead — came in on their link`, tone: "muted" };
    case "assigned":
      return { text: `${state.hot ? "Hot lead" : "Lead"} assigned to ${state.rep?.name || "a rep"}`, tone: "hot" };
    case "unassigned":
      return { text: `${state.hot ? "Hot lead" : "Lead"} — unassigned, in the review folder`, tone: "hot" };
    case "skipped":
      return { text: SKIP_LABELS[state.reason] || `Not promoted: ${state.reason}`, tone: "muted" };
    case "no_phone":
      return { text: "No phone typed yet — nothing to call", tone: "muted" };
    case "waiting":
      return { text: `Quiet for ${state.quietMinutes} min — becomes a hot lead after ${state.promoteAfterMinutes}`, tone: "muted" };
    default:
      return { text: state?.code || "—", tone: "muted" };
  }
}

const SKIP_LABELS = {
  suppressed: "On the do-not-contact list — never promoted",
  company_exists: "Already a company on the books",
  completed: "Completed the signup",
};

function minutesAgo(value) {
  if (!value) return "—";
  const m = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} days ago`;
}

function daysAgo(value) {
  if (!value) return null;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}

function formatDay(value) {
  if (!value) return "—";
  return new Date(value).toISOString().slice(0, 10);
}

export default function PlatformSignupsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/platform/signups");
      const json = await res.json();
      // Every branch has an else. AGENTS.md recurring failure class #2.
      if (!res.ok) throw new Error(json.error || "Couldn't load incomplete signups.");
      setData(json);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const signups = data?.signups || [];
  const started = data?.started || [];
  const policy = data?.policy;
  const usedProduct = signups.filter((s) => s.quotes > 0 || s.clients > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Incomplete signups</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Started a signup, never finished Stripe Checkout, never gave a card.
            They are not counted as companies anywhere on this console. Nothing
            here is deleted — the account and everything in it stays exactly as
            they left it.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── Started, never finished ──────────────────────────────────────
          The typed-as-you-go rows (lib/signup/leads.js): people who put a
          name, a company or a number into the first step and stopped
          before a Company row existed. Until 2026-09-21 these were the
          thirteen "left at Trades" in the funnel and nowhere else. */}
      {!loading && data ? (
        <section className="space-y-3" data-started-signups>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Started, never finished</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              What people typed into the first step of the signup and where each one now stands:
              quiet for thirty minutes with a phone number and it becomes a <strong>hot lead</strong> in
              the <Link href="/platform/sales/review?signups=hot" className="underline">review folder</Link> for
              you to assign; one that came in on a rep&apos;s link is that rep&apos;s own lead.
            </p>
          </div>
          {started.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
              Nobody has a half-typed signup right now.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
              {started.map((r) => {
                const state = startedState(r.state);
                return (
                  <div key={r.id} className="px-5 py-4 flex flex-wrap gap-4 justify-between" data-started-row>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{r.companyName || r.name || r.email}</span>
                        {r.state?.hot ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900">
                            <Flame size={11} /> Hot
                          </span>
                        ) : null}
                        {r.referredBy ? (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                            referred by {r.referredBy.name || r.referredBy.code}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.name || "no name"}
                        {r.where ? ` · ${r.where}` : ""}
                        {r.trades?.length ? ` · ${r.trades.join(", ")}` : ""}
                        {r.language ? ` · ${r.language.toUpperCase()}` : ""}
                        {` · got as far as ${r.stepLabel}`}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-foreground hover:underline">
                          <Mail size={12} /> {r.email}
                        </a>
                        {r.phone ? (
                          <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-foreground hover:underline">
                            <Phone size={12} /> {r.phone}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">no phone</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <div className="text-sm text-foreground">Last seen {minutesAgo(r.lastSeenAt)}</div>
                      <div className="text-xs text-muted-foreground">Started {formatDay(r.startedAt)}</div>
                      <div className={`text-xs ${state.tone === "hot" ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>{state.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      <h2 className="text-lg font-semibold text-foreground">Reached the card screen, never paid</h2>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : !data ? null : signups.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Building2 size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nobody has an unfinished signup right now.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              {count(signups.length)}{" "}
              {signups.length === 1 ? "unfinished signup" : "unfinished signups"}
            </span>
            {usedProduct > 0 && (
              <span>
                {count(usedProduct)} of them created a quote or a client without
                ever giving a card
              </span>
            )}
            {policy && (
              <span>
                One email each, {policy.delayHours}h after signup, never past{" "}
                {policy.windowDays} days
              </span>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {signups.map((s) => {
              const age = daysAgo(s.createdAt);
              return (
                <div key={s.id} className="px-5 py-4 flex flex-wrap gap-4 justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/platform/companies/${s.id}`}
                        className="font-medium text-foreground hover:underline truncate"
                      >
                        {s.name}
                      </Link>
                      {s.doNotContact && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900">
                          <Ban size={11} /> Do not contact
                        </span>
                      )}
                      {s.lead ? (
                        <Link
                          href={s.lead.assignedTo ? "/platform/sales/reps" : "/platform/sales/review?signups=all"}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                            s.lead.kind === "stalled" || s.lead.hot
                              ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900"
                              : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900"
                          }`}
                          data-signup-floor-chip
                        >
                          <Flame size={11} />
                          {s.lead.kind === "stalled" ? "Stalled" : "New signup"}
                          {" → "}
                          {s.lead.assignedTo ? `assigned to ${s.lead.assignedTo.name}` : "unassigned"}
                        </Link>
                      ) : null}
                      {(s.quotes > 0 || s.clients > 0) && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900">
                          Used the product · {count(s.quotes)} quotes ·{" "}
                          {count(s.clients)} clients
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {s.ownerName || "no name on the account"}
                      {s.where ? ` · ${s.where}` : ""}
                      {s.industries?.length ? ` · ${s.industries.join(", ")}` : ""}
                      {s.language ? ` · ${s.language.toUpperCase()}` : ""}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {/* Real links, not decorative text: this screen exists so
                          somebody rings or writes to these people. */}
                      {s.email ? (
                        <a
                          href={`mailto:${s.email}`}
                          className="inline-flex items-center gap-1 text-foreground hover:underline"
                        >
                          <Mail size={12} /> {s.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">no email</span>
                      )}
                      {s.phone ? (
                        <a
                          href={`tel:${s.phone}`}
                          className="inline-flex items-center gap-1 text-foreground hover:underline"
                        >
                          <Phone size={12} /> {s.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">no phone</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <div className="text-sm text-foreground">
                      Signed up {formatDay(s.createdAt)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {age === 0 ? "today" : `${count(age)} days ago`}
                    </div>
                    <div className="text-xs inline-flex items-center gap-1 text-muted-foreground">
                      {s.nudgeSentAt ? (
                        <>
                          <MailCheck size={12} /> Emailed {formatDay(s.nudgeSentAt)}
                        </>
                      ) : (
                        <>{NUDGE_LABELS[s.nudgeState] || s.nudgeState}</>
                      )}
                    </div>
                    {s.doNotContact && s.doNotContactReason && (
                      <div className="text-xs text-red-700 dark:text-red-300 max-w-xs">
                        {s.doNotContactReason}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
