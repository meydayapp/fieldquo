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
  Headset, Phone, AlertTriangle, Loader2, Settings, History,
  ChevronDown, ChevronRight, CalendarClock,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
// The row — and what it says each call cost, and the booking badge's wording
// per mode — lives in CallRow.js.
import CallRow from "./CallRow";
import { useTranslation } from "@/app/hooks/useTranslation";

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
