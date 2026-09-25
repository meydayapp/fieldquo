// app/app/receptionist/CallRow.js
//
// One call on the receptionist page, in its own file so the row can be drawn
// outside the page — the /signup side panel renders this exact component
// against fixture calls rather than a hand-drawn lookalike.
//
// Presentational apart from CallQuoteDraft, which it renders as it always
// has: that child draws nothing for a call with no transcript, and only
// fetches when its own button is pressed. The row's buttons do nothing but
// call the handlers they are given, and each is rendered only when its
// handler is — except "Dealt with" on an urgent row, which the page always
// wires, and which is inert without `onSeen`.
//
// Props (all optional unless noted):
//   call             (required) a GET /api/voice/calls row — see the fields
//                    read below: id, direction, recoveredAt, from, at,
//                    durationSec, costCents, summary, leadId, leadRecovered,
//                    bookingId, booking { at, mode }, recordingHref,
//                    quote { id, number, needsReview }, hasTranscript,
//                    quoteDraftedAt, quoteDraftSkipped
//   formatDateTime   (required) the company's date-time formatter —
//                    useCompanyPreferences().formatDateTime
//   urgent           draws the amber "needs you" card and the Dealt-with button
//   busy, bookingCallback, callbackResult, aiAvailable
//   onSeen, onArchive, onUnarchive, onBookCallback
"use client";

import Link from "next/link";
import {
  PhoneOutgoing, Check, Play, Loader2, UserPlus, CalendarCheck, History,
  Archive, ArchiveRestore, FileText, PhoneCall,
} from "lucide-react";
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

function duration(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function CallRow({
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
