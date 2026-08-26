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
  Headset, Phone, PhoneOutgoing, AlertTriangle, Check, Play, Loader2, UserPlus, CalendarCheck, Settings,
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
