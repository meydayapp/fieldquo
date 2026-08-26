"use client";

// app/app/receptionist/page.js
//
// What the phone receptionist has been doing.
//
// Replaces the honest "coming soon" that stood here while the feature didn't
// exist.
//
// ── Flagged calls first, and they don't clear themselves ───────────────────
//
// A call the agent marked urgent — somebody said "flooding", "gas", "the
// ceiling is coming down" — sits at the top until a person marks it seen. It
// does NOT clear by being scrolled past, because the entire point of the flag
// is that somebody has to act on it today.
//
// ── It says what each call cost ────────────────────────────────────────────
//
// Per call, not just as a running balance. "Where did my credit go" is the first
// question anyone asks about prepaid anything, and the answer belongs beside the
// call rather than in a total they have to reconcile themselves.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Headset, Phone, PhoneOutgoing, AlertTriangle, Check, Play, Loader2, UserPlus, CalendarCheck, Settings, History,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import CallQuoteDraft from "./CallQuoteDraft";
import { useTranslation } from "@/app/hooks/useTranslation";

const money = (c) => `$${(Number(c || 0) / 100).toFixed(2)}`;

function duration(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function ReceptionistPage() {
  const { t } = useTranslation();
  const { formatDateTime } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  // The outcome of a "recover missed calls" press, as a { tone, text } the
  // panel below renders. Held rather than toast-ed because "nothing was
  // missing" and "four calls came back" are both answers the person wants to
  // keep reading while they scan the list.
  const [recovering, setRecovering] = useState(false);
  const [recoverResult, setRecoverResult] = useState(null);

  // `data` stays null on failure. `data?.calls || []` used to render the
  // "you haven't turned this on yet" panel — complete with a Set it up button —
  // to a company whose receptionist is running and whose calls we simply
  // couldn't fetch.
  const [errorKey, setErrorKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey("");
    const result = await fetchList("/api/voice/calls");
    if (result.aborted) return;
    if (result.ok) setData(result.data);
    else setErrorKey(result.errorKey);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markSeen(id) {
    setBusy(id);
    try {
      const res = await fetch("/api/voice/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.receptionist.updateError"));
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  // ── Asking the provider what we missed ─────────────────────────────────
  //
  // Every branch says something. An `if (res.ok)` with no else is the failure
  // class AGENTS.md lists second, and it would be especially cruel here: the
  // person pressing this has already had one thing silently fail on them.
  async function recover() {
    setRecovering(true);
    setRecoverResult(null);
    try {
      const res = await fetch("/api/voice/calls/recover", { method: "POST" });
      if (!res.ok) {
        await reportResponseError(res, t("app.receptionist.recoverError"));
        return;
      }
      const body = await res.json().catch(() => null);
      if (!body?.ok) {
        setRecoverResult({
          tone: "warn",
          text:
            body?.reason === "not_configured"
              ? t("app.receptionist.recoverUnconfigured")
              : t("app.receptionist.recoverError"),
        });
        return;
      }

      const found = body.recovered > 0 || body.leadsRecovered > 0;
      setRecoverResult({
        tone: found ? "good" : "plain",
        text: found
          ? t("app.receptionist.recoverDone", {
              calls: body.calls,
              recovered: body.recovered,
              leads: body.leadsRecovered,
            })
          : t("app.receptionist.recoverNothing"),
        // Said alongside the count, never instead of it. A run that recovered
        // four calls and skipped the leads because this deployment has no model
        // key must not look like four empty calls.
        note:
          body.leadsSkipped === "ai_unavailable" && body.recovered > 0
            ? t("app.receptionist.recoverNoAi")
            : body.leadsSkipped === "quota_exceeded" && body.recovered > 0
              ? t("app.receptionist.recoverQuota")
              : body.partial
                ? t("app.receptionist.recoverPartial")
                : null,
      });
      // Only reload when something actually changed. A no-op run must not make
      // the list flash as if it had.
      if (found) await load();
    } finally {
      setRecovering(false);
    }
  }

  const calls = data?.calls || [];
  // Whether the deployment can call a model at all. `data` is null on a failed
  // load, and `?? false` rather than `?? true` on purpose: offering a button we
  // don't know works is the failure this codebase keeps being swept for.
  const aiAvailable = data?.aiAvailable ?? false;
  // Three states, and only the first of them wants "Set it up". A company whose
  // receptionist is bought and answering was being told to go and set up the
  // thing they had already set up — on the very page they opened to find out
  // why it looked idle.
  const setup = data?.setup || null;
  // Absent on a failed load, so the button is not offered when we don't know
  // whether it would work — the same `?? false` reasoning as aiAvailable.
  const canRecover = data?.canRecover ?? false;
  const emptyState = !setup
    ? "unknown"
    : !setup.hasNumber
      ? "no_number"
      : setup.answering
        ? "answering"
        : "switched_off";
  const flagged = calls.filter((c) => c.needsReview);
  const rest = calls.filter((c) => !c.needsReview);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[12rem]">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Headset size={22} /> {t("app.nav.receptionist")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.receptionist.subtitle")}
          </p>
        </div>
        {/* Present only when it can actually do something — see canRecover in
            app/api/voice/calls/route.js. Deliberately beside Settings rather
            than buried in it: the person who needs it is looking at an empty
            list, on this page, right now. */}
        {canRecover && (
          <button
            type="button"
            onClick={recover}
            disabled={recovering}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
          >
            {recovering ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <History size={15} />
            )}
            {recovering ? t("app.receptionist.recovering") : t("app.receptionist.recover")}
          </button>
        )}
        <Link
          href="/app/settings/voice"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted"
        >
          <Settings size={15} />{" "}
          {emptyState === "no_number" || emptyState === "unknown"
            ? t("app.receptionist.setUp")
            : t("app.receptionist.settings")}
        </Link>
      </div>

      {recoverResult && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            recoverResult.tone === "good"
              ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100"
              : recoverResult.tone === "warn"
                ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100"
                : "border-border bg-card text-foreground"
          }`}
        >
          <p>{recoverResult.text}</p>
          {recoverResult.note && (
            <p className="mt-1 opacity-80">{recoverResult.note}</p>
          )}
        </div>
      )}

      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={load}
        isEmpty={calls.length === 0}
        skeleton={
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-accent rounded-xl" />
            <div className="h-24 bg-accent rounded-xl" />
          </div>
        }
        empty={
          // Not an error state. A company that hasn't turned it on yet, or that
          // has had a quiet week, gets a sentence and a way forward rather than
          // an empty grid. It is reachable only on a SUCCESSFUL load — offering
          // "Set it up" to someone whose receptionist is already running was
          // the failure this whole change is about.
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Phone size={22} className="mx-auto text-muted-foreground" />
            <p className="text-sm font-medium text-foreground mt-3">
              {emptyState === "answering"
                ? t("app.receptionist.emptyAnswering")
                : emptyState === "switched_off"
                  ? t("app.receptionist.emptyOff")
                  : t("app.receptionist.empty")}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {emptyState === "answering"
                ? t("app.receptionist.emptyAnsweringHint")
                : emptyState === "switched_off"
                  ? t("app.receptionist.emptyOffHint")
                  : t("app.receptionist.emptyHint")}
            </p>
            <Link
              href="/app/settings/voice"
              className="inline-block mt-4 px-5 py-2.5 rounded-full bg-inverted text-inverted-foreground text-sm font-semibold"
            >
              {emptyState === "answering"
                ? t("app.receptionist.checkItCta")
                : emptyState === "switched_off"
                  ? t("app.receptionist.turnOnCta")
                  : t("app.receptionist.setUpCta")}
            </Link>
          </div>
        }
      >
        <div className="space-y-6">
      {flagged.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-2">
            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400" />
            {t("app.receptionist.needsYou", { count: flagged.length })}
          </h2>
          <div className="space-y-2">
            {flagged.map((c) => (
              <CallRow
                key={c.id}
                call={c}
                urgent
                busy={busy === c.id}
                onSeen={() => markSeen(c.id)}
                formatDateTime={formatDateTime}
                aiAvailable={aiAvailable}
              />
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          {flagged.length > 0 && (
            <h2 className="text-sm font-bold text-foreground mb-2">{t("app.receptionist.everythingElse")}</h2>
          )}
          <div className="space-y-2">
            {rest.map((c) => (
              <CallRow
                key={c.id}
                call={c}
                formatDateTime={formatDateTime}
                aiAvailable={aiAvailable}
              />
            ))}
          </div>
        </section>
      )}
        </div>
      </ListState>
    </div>
  );
}

function CallRow({ call, urgent, busy, onSeen, formatDateTime, aiAvailable }) {
  const { t } = useTranslation();
  return (
    <div
      className={`rounded-xl border p-4 ${
        urgent
          ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
          : "border-border bg-card"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* Which way the call went. An outbound row without this reads as a
            customer who rang — but it's a call the assistant placed, and the
            summary ("confirmed the quote") only makes sense with the arrow. */}
        {call.direction === "outbound" && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
            <PhoneOutgoing size={11} /> {t("app.receptionist.weCalled")}
          </span>
        )}
        {/* ── "Why is a call from Tuesday only appearing now?" ──────────────
            Because it never reached us. The row is not late; it was lost, and
            the contractor did nothing wrong. Said on the row rather than in a
            help article, with the date we got it back in the title so the gap
            between the call and the rescue is visible rather than implied. */}
        {call.recoveredAt && (
          <span
            title={t("app.receptionist.recoveredWhy", {
              when: formatDateTime(call.recoveredAt),
            })}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300"
          >
            <History size={11} /> {t("app.receptionist.recoveredBadge")}
          </span>
        )}
        <span className="font-semibold text-foreground tabular-nums">
          {call.from || t("app.receptionist.unknownNumber")}
        </span>
        <span className="text-xs text-muted-foreground">
          {call.at ? formatDateTime(call.at) : ""}
        </span>
        <span className="text-xs text-muted-foreground">{duration(call.durationSec)}</span>
        <span className="text-xs text-muted-foreground">{money(call.costCents)}</span>
      </div>

      {call.summary && <p className="text-sm text-foreground mt-2">{call.summary}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* What the call PRODUCED, linked. A summary is useful; the lead it
            created is the thing somebody actually has to act on. */}
        {/* /app/leads, not /app/leads/<id> — there IS no lead detail route,
            and a link to one would 404. The list is where a lead is worked
            from, so that's where this goes. */}
        {call.leadId && (
          <Link
            href="/app/leads"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-muted"
          >
            <UserPlus size={13} /> {t("app.receptionist.savedAsLead")}
          </Link>
        )}
        {/* A lead the assistant took on the line and one we read back off the
            recording are different levels of confidence, and the person about
            to ring the number should know which they have. Only ever shown
            beside the lead link — it is a qualifier on that link, not a badge
            of its own. */}
        {call.leadId && call.leadRecovered && (
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">
            <History size={13} /> {t("app.receptionist.recoveredLead")}
          </span>
        )}
        {/* The visit, WHEN it is, and a way to reach it. This was a green pill
            with no time, no name and no href — the contractor was told a visit
            had been booked and given nothing to find it with. It now goes to
            the calendar, where the appointment created alongside the booking
            actually appears (see lib/voice/availability.js). */}
        {call.bookingId && (
          <Link
            href="/app/appointments"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:brightness-95"
          >
            <CalendarCheck size={13} />
            {call.booking?.at
              ? t("app.receptionist.bookedVisitAt", {
                  when: formatDateTime(call.booking.at),
                })
              : t("app.receptionist.bookedVisit")}
          </Link>
        )}
        {call.recordingUrl && (
          <a
            href={call.recordingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-muted"
          >
            <Play size={13} /> {t("app.receptionist.listen")}
          </a>
        )}

        {/* Reading the call as quote scope. Deliberately here and not on the
            phone: the receptionist may never say a price, and this happens
            afterwards, in front of a person who sets one. */}
        <CallQuoteDraft call={call} aiAvailable={aiAvailable} />

        {urgent && (
          <button
            type="button"
            disabled={busy}
            onClick={onSeen}
            className="ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-inverted text-inverted-foreground font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {t("app.receptionist.dealtWith")}
          </button>
        )}
      </div>
    </div>
  );
}
