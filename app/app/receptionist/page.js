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
  ChevronDown, ChevronRight, Archive, ArchiveRestore, FileText, PhoneCall, CalendarClock,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import CallQuoteDraft from "./CallQuoteDraft";
import { useTranslation } from "@/app/hooks/useTranslation";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";

// US dollars, explicitly. These cents come off the voice credit ledger,
// which is denominated in USD (lib/voice/creditCurrency.js) — a bare "$" on
// a CAD account reads as about 40% less than the call actually cost.
const money = (c) =>
  formatAppMoney(Number(c || 0) / 100, CREDIT_CURRENCY, "en");

// What the booking badge says, per mode.
//
// The receptionist arranges callbacks and video calls as well as visits (see
// phoneBookableModes in lib/voice/visitPath.js — a callback is the DEFAULT for
// a company that charges for consultations), and this badge said "Booked a
// visit" for all three. A caller who agreed to a phone call at three appeared
// on this screen as somebody expecting a van.
//
// The canonical wording table is MODE_WORDS in lib/voice/visitPath.js, and this
// is deliberately not an import of it. Nothing in that module is server-only —
// it pulls in lib/booking/fee.js and lib/currency.js, both dependency-free and
// safe in a browser bundle — so the reason is not reachability. It is that
// MODE_WORDS holds untranslated English the agent SPEAKS aloud ("someone will
// come out to you"), while this badge is read by contractors in six languages
// and has to go through t(). One table cannot be both, so the distinction — not
// the strings — is mirrored, in app/i18n/appMessages.js next to bookedVisit.
//
// `mode` is one of call | visit | video and defaults to "visit" server-side
// (app/api/voice/calls/route.js); the fallbacks here cover an older row or a
// mode this build doesn't know, which reads as a visit rather than as nothing.
const BOOKED_KEYS = {
  visit: { at: "app.receptionist.bookedVisitAt", plain: "app.receptionist.bookedVisit" },
  call: { at: "app.receptionist.bookedCallAt", plain: "app.receptionist.bookedCall" },
  video: { at: "app.receptionist.bookedVideoAt", plain: "app.receptionist.bookedVideo" },
};

// ── Why the manual "Book a callback" refused ──────────────────────────────
//
// POST /api/voice/calls/[id]/book-callback answers 409 with a `reason` for
// every way the booking can fail, and every one of them is a different thing
// to do next. One generic "couldn't do that" is what makes somebody press the
// button a second time and get the same nothing — so each reason gets its own
// sentence, and the reason that is almost always the real one (no opening
// hours on file) gets somewhere to go as well.
//
// Anything not in this table — address_required, unknown_event_type, a reason
// a later build adds — falls to callbackFailed, which says the booking didn't
// happen rather than pretending to know why.
const CALLBACK_REASON_KEYS = {
  already_booked: "app.receptionist.callbackAlready",
  no_phone: "app.receptionist.callbackNoPhone",
  not_callbacks: "app.receptionist.callbackNotCallbacks",
  no_times: "app.receptionist.callbackNoTimes",
  fee_due: "app.receptionist.callbackFeeDue",
  taken: "app.receptionist.callbackTaken",
  bad_slot: "app.receptionist.callbackBadSlot",
};

function duration(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function ReceptionistPage() {
  const { t } = useTranslation();
  const { formatDateTime } = useCompanyPreferences();
  // The same gate the endpoint takes (requests: view_create_edit). Below it the
  // button is not rendered AND no notice replaces it — a member who may not
  // book callbacks is not being denied anything they asked for, and a "you
  // can't do this" line on every row would be noise about a job that isn't
  // theirs. The server refuses regardless; this only stops offering it.
  const canBookCallback = useHasLevel("requests", "view_create_edit");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  // Collapsed on arrival: the archive is the log and it grows forever.
  const [showArchived, setShowArchived] = useState(false);
  // The outcome of a "recover missed calls" press, as a { tone, text } the
  // panel below renders. Held rather than toast-ed because "nothing was
  // missing" and "four calls came back" are both answers the person wants to
  // keep reading while they scan the list.
  const [recovering, setRecovering] = useState(false);
  const [recoverResult, setRecoverResult] = useState(null);
  // Which row is mid-booking, and what the last press answered. Held apart from
  // `busy` on purpose: booking a callback must not put a spinner in the Archive
  // button beside it, which would read as archiving.
  const [callbackBusy, setCallbackBusy] = useState(null);
  const [callbackResult, setCallbackResult] = useState(null);

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

  // Reversible, and the same endpoint: archiving is triage and triage is wrong
  // sometimes. `archived` present is what tells PATCH this is the archive verb
  // rather than the "I've looked at the flag" one.
  async function setArchived(id, archived) {
    setBusy(id);
    try {
      const res = await fetch("/api/voice/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, archived }),
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

  // ── The manual backup for the callback the assistant didn't book ────────
  //
  // 409 is an ANSWER from this endpoint, not a transport failure: it is how the
  // route says which of half a dozen fixable things is in the way. So the body
  // is read on 409 as well as on 200, and only a status we did not plan for
  // goes to the generic toast. 403 is among those and shouldn't happen — a
  // member below requests:view_create_edit never sees the button.
  async function bookCallback(id) {
    setCallbackBusy(id);
    setCallbackResult(null);
    try {
      const res = await fetch(`/api/voice/calls/${id}/book-callback`, {
        method: "POST",
      });
      if (!res.ok && res.status !== 409) {
        await reportResponseError(res, t("app.receptionist.callbackFailed"));
        return;
      }
      const body = await res.json().catch(() => null);

      if (body?.booked) {
        // The time comes back from the server that wrote it, and is repeated
        // here rather than only appearing in the badge: somebody pressed a
        // button that puts a stranger in their diary and is owed the when.
        setCallbackResult({
          id,
          tone: "good",
          text: t("app.receptionist.callbackBooked", { when: body.at || "" }),
        });
        // Swaps the button for the booking badge on the row.
        await load();
        return;
      }

      const reason = body?.reason || "failed";
      setCallbackResult({
        id,
        // "There is already one" is the thing they wanted being true already,
        // not a warning.
        tone: reason === "already_booked" ? "plain" : "warn",
        text: t(CALLBACK_REASON_KEYS[reason] || "app.receptionist.callbackFailed"),
        // Opening hours live on Company.businessHours, edited on the company
        // settings screen — a company that has never set them is offered no
        // slots at all, deliberately, so this is nearly always the fix.
        href: reason === "no_times" ? "/app/settings/company" : null,
        hrefText:
          reason === "no_times" ? t("app.receptionist.callbackNoTimesCta") : null,
      });
      // Our copy of the row says there is no booking and the server says there
      // is. Reload so the badge — and the time on it — appears.
      if (reason === "already_booked") await load();
    } finally {
      setCallbackBusy(null);
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
  // ── Three groups, because "seen it" and "done with it" are different ────
  //
  // The page used to be flagged-vs-everything-else, and "everything else" was
  // a reverse-chronological log: a call that should have become a quote and
  // never did sank down it, indistinguishable from a call about opening hours.
  // Nothing was wrong with it, so nothing flagged it, and the only person who
  // would notice was the customer who never heard back.
  //
  // So the middle group is a WORKING LIST — calls with no quote and nobody
  // saying they are finished — and the log becomes an archive underneath it.
  // A call leaves the working list two ways: its quote exists (derived from
  // Quote.sourceCallId by the API), or somebody archived it by hand.
  const flagged = calls.filter((c) => c.needsReview);
  const open = calls.filter((c) => !c.needsReview && !c.archived);
  const archived = calls.filter((c) => !c.needsReview && c.archived);

  // ── "Somebody is expecting a call" belongs above the list, not in it ─────
  //
  // Built from the booking times already in this payload — no second fetch, no
  // nav badge somewhere else in the app, and nothing at all when there is
  // nothing coming. A heads-up that is present on a quiet day is a heads-up
  // people stop reading.
  //
  // `pending_payment` and `cancelled` are excluded because neither is a
  // commitment: one is a slot held while somebody pays and may never be paid
  // for, the other is a slot already given back. Counting either would be
  // asserting an appointment that does not exist — the padding failure class.
  // Their rows still carry their own badge; this line only counts what a
  // contractor should plan their morning around.
  const upcoming = calls
    .map((c) => c.booking)
    .filter(
      (b) => b?.at && b.status !== "cancelled" && b.status !== "pending_payment",
    )
    .map((b) => new Date(b.at))
    .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > Date.now())
    .sort((a, b) => a.getTime() - b.getTime());

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div data-tour="receptionist-header" className="flex-1 min-w-[12rem]">
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
          data-tour="receptionist-settings"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted"
        >
          <Settings size={15} />{" "}
          {emptyState === "no_number" || emptyState === "unknown"
            ? t("app.receptionist.setUp")
            : t("app.receptionist.settings")}
        </Link>
      </div>

      {upcoming.length > 0 && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <CalendarClock size={15} className="mt-0.5 shrink-0" />
          <span>
            {t("app.receptionist.upcomingSummary", {
              count: t("app.receptionist.upcomingCount", { value: upcoming.length }),
              when: formatDateTime(upcoming[0]),
            })}
          </span>
        </p>
      )}

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
                onBookCallback={canBookCallback ? () => bookCallback(c.id) : null}
                bookingCallback={callbackBusy === c.id}
                callbackResult={callbackResult?.id === c.id ? callbackResult : null}
              />
            ))}
          </div>
        </section>
      )}

      {open.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-2">
            {t("app.receptionist.openTitle", { count: open.length })}
          </h2>
          <p className="text-xs text-muted-foreground mb-2">
            {t("app.receptionist.openHint")}
          </p>
          <div className="space-y-2">
            {open.map((c) => (
              <CallRow
                key={c.id}
                call={c}
                busy={busy === c.id}
                onArchive={() => setArchived(c.id, true)}
                formatDateTime={formatDateTime}
                aiAvailable={aiAvailable}
                onBookCallback={canBookCallback ? () => bookCallback(c.id) : null}
                bookingCallback={callbackBusy === c.id}
                callbackResult={callbackResult?.id === c.id ? callbackResult : null}
              />
            ))}
          </div>
        </section>
      )}

      {archived.length > 0 && (
        <section>
          {/* Collapsed by default. It is the log, and it grows forever — open
              on arrival it would bury the working list it exists to protect. */}
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-sm font-bold text-muted-foreground flex items-center gap-1.5 mb-2"
          >
            {showArchived ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            {t("app.receptionist.archivedTitle", { count: archived.length })}
          </button>
          {showArchived && (
            <div className="space-y-2">
              {archived.map((c) => (
                <CallRow
                  key={c.id}
                  call={c}
                  busy={busy === c.id}
                  // Only the ones a person archived can be un-archived. A call
                  // whose quote exists is archived BY that quote, and a button
                  // that appeared to undo it would do nothing — the next load
                  // derives the same answer from the quote all over again.
                  onUnarchive={c.archivedAt ? () => setArchived(c.id, false) : null}
                  formatDateTime={formatDateTime}
                  aiAvailable={aiAvailable}
                  onBookCallback={canBookCallback ? () => bookCallback(c.id) : null}
                  bookingCallback={callbackBusy === c.id}
                  callbackResult={callbackResult?.id === c.id ? callbackResult : null}
                />
              ))}
            </div>
          )}
        </section>
      )}
        </div>
      </ListState>
    </div>
  );
}

function CallRow({
  call, urgent, busy, onSeen, onArchive, onUnarchive, formatDateTime, aiAvailable,
  onBookCallback, bookingCallback, callbackResult,
}) {
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
        {/* What was arranged, WHEN it is, and a way to reach it. This was a
            green pill with no time, no name and no href — the contractor was
            told a visit had been booked and given nothing to find it with. It
            now goes to the calendar, where the appointment created alongside
            the booking actually appears (see lib/voice/availability.js).
            The wording follows the booking's mode; see BOOKED_KEYS. */}
        {call.bookingId && (
          <Link
            href="/app/appointments"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:brightness-95"
          >
            <CalendarCheck size={13} />
            {call.booking?.at
              ? t(BOOKED_KEYS[call.booking?.mode]?.at || BOOKED_KEYS.visit.at, {
                  when: formatDateTime(call.booking.at),
                })
              : t(BOOKED_KEYS[call.booking?.mode]?.plain || BOOKED_KEYS.visit.plain)}
          </Link>
        )}
        {/* The gated proxy, not the provider's URL — see
            /api/voice/calls/[id]/recording. The href is a FieldQuo path with a
            call id in it and is useless without a session. */}
        {call.recordingHref && (
          <a
            href={call.recordingHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-muted"
          >
            <Play size={13} /> {t("app.receptionist.listen")}
          </a>
        )}

        {/* The quote this call became. A link, not a tick: "a quote exists"
            without a way to reach it is a fact the reader then has to go and
            look up by hand. */}
        {call.quote && (
          <Link
            href={`/app/quotes/${call.quote.id}`}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-muted"
          >
            <FileText size={13} />
            {call.quote.needsReview
              ? t("app.receptionist.quoteNeedsReview", { number: call.quote.number })
              : t("app.receptionist.quoteMade", { number: call.quote.number })}
          </Link>
        )}

        {/* Reading the call as quote scope. Deliberately here and not on the
            phone: the receptionist may never say a price, and this happens
            afterwards, in front of a person who sets one. */}
        <CallQuoteDraft call={call} aiAvailable={aiAvailable} />

        {/* ── Why no draft, when there is no draft ────────────────────────
            A skip that renders as nothing reads as the AI being broken, and
            the likeliest cause is fixable and invisible: the caller asked for
            work that is not in this company's service list. Only the reasons a
            person can act on are shown — a hang-up needs no explanation. */}
        {!call.quoteDraftedAt && call.quoteDraftSkipped && (
          <span className="text-xs text-muted-foreground">
            {t(
              `app.receptionist.noDraft.${call.quoteDraftSkipped}`,
              t("app.receptionist.noDraft.other", ""),
            )}
          </span>
        )}

        {/* ── The human backup for a callback that never got booked ───────
            Only when this call has NO booking. A call that has one already
            shows its badge above; a button beside that badge would offer to do
            a thing the server correctly refuses to do twice.

            Absent entirely below requests:view_create_edit — no button and no
            notice. See canBookCallback on the page. */}
        {!call.bookingId && onBookCallback && (
          <button
            type="button"
            disabled={bookingCallback}
            onClick={onBookCallback}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-muted disabled:opacity-50"
          >
            {bookingCallback ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <PhoneCall size={13} />
            )}
            {bookingCallback
              ? t("app.receptionist.callbackBooking")
              : t("app.receptionist.bookCallback")}
          </button>
        )}

        {onArchive && (
          <button
            type="button"
            disabled={busy}
            onClick={onArchive}
            className="ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
            {t("app.receptionist.archive")}
          </button>
        )}
        {onUnarchive && (
          <button
            type="button"
            disabled={busy}
            onClick={onUnarchive}
            className="ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ArchiveRestore size={13} />}
            {t("app.receptionist.unarchive")}
          </button>
        )}

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

      {/* What the press answered, on the row it was pressed on. Kept beside the
          call rather than toasted: "no free times, you never set opening hours"
          is a sentence somebody needs to still be reading while they go and fix
          it. Survives the reload that follows a success, so the confirmed time
          stays visible next to the badge it just created. */}
      {callbackResult && (
        <p
          className={`mt-2 text-xs ${
            callbackResult.tone === "good"
              ? "text-emerald-700 dark:text-emerald-300"
              : callbackResult.tone === "warn"
                ? "text-amber-700 dark:text-amber-300"
                : "text-muted-foreground"
          }`}
        >
          {callbackResult.text}
          {callbackResult.href && (
            <>
              {" "}
              <Link href={callbackResult.href} className="underline font-medium">
                {callbackResult.hrefText}
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
