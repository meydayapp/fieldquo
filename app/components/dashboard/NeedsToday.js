"use client";

// app/components/dashboard/NeedsToday.js
//
// The first thing on the dashboard: what is waiting on a person, today.
//
// Supersedes NeedsYou.js, whose three automation lines are carried in below
// unchanged — same endpoints, same refusal rules, same wording — with the
// money-shaped work put ABOVE them.
//
// ══ Why overdue invoices moved here ═════════════════════════════════════════
//
// They were inside a panel called "Money owed", below three other panels,
// described as a count: "$4,200 of that is past due." Two overdue invoices
// are not a statistic, they are two phone calls, and a count does not tell you
// whose. So they are rows now — who, how much, how late — at the top of the
// page, with the button that actually chases them.
//
// ══ Why it lists these and summarises the rest ══════════════════════════════
//
// An overdue invoice has no other home on this page above the fold, so it is
// named here. The three automation lines DO have homes — /app/estimate-reviews,
// /app/receptionist, /app/appointments — and reproducing those rows here would
// give the same call two places to be triaged, one of which would go stale. So
// each of those stays a count and a link, and the screen that owns the work
// keeps owning it.
//
// ══ Why it renders itself away ══════════════════════════════════════════════
//
// A banner present on a quiet day is a banner people stop reading, and a
// heading that says work is waiting over an empty list is an accusation nobody
// earned. Each line is independently absent; with all of them absent the
// component returns null.
//
// ══ Why a failed load is also nothing ═══════════════════════════════════════
//
// Every source here refuses somebody. /api/quotes/estimate-reviews wants
// quotes:view_only, /api/voice/calls wants the call-audio level, and the
// overdue rows come from /api/analytics/receivables, which wants
// invoices:view_only AND showPricing. A refusal is a boundary working as
// designed — nothing to apologise for, nothing to retry — so it renders as the
// absence of that line, never as a zero and never as a banner. Same reasoning
// as the "$0 revenue was a 403 wearing a number" comment in app/app/page.js:
// a count only ever comes from a body the server actually sent, which is why
// both states below start at null rather than [].

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  Headset,
  ArrowRight,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatMoney } from "@/lib/currency";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { Figure, FigureText } from "./Figure";
import { CARD_CLIPPED } from "./surface";

/**
 * The appointments the receptionist arranged that are still ahead, soonest
 * first.
 *
 * `pending_payment` and `cancelled` are excluded because neither is a
 * commitment: one is a slot held while somebody pays and may never be paid for,
 * the other is a slot already given back. Announcing either would assert an
 * appointment nobody made — the padding failure class in AGENTS.md.
 *
 * Deliberately the same rule as app/app/receptionist/page.js, which builds the
 * identical line from the identical payload. Two screens that count the same
 * bookings differently is worse than either count.
 */
function upcomingBookings(calls) {
  return (calls || [])
    .map((c) => c.booking)
    .filter(
      (b) => b?.at && b.status !== "cancelled" && b.status !== "pending_payment",
    )
    .map((b) => new Date(b.at))
    .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > Date.now())
    .sort((a, b) => a.getTime() - b.getTime());
}

const LINE =
  "flex items-start gap-2 text-sm text-muted-foreground hover:text-foreground min-h-[36px] py-1";

/**
 * @param needs      lib/dashboard/rank.js's `needsToday`
 * @param onChase    the page's chase handler — the same POST the panel below
 *                   uses. One handler, two entry points: the overdue rows are
 *                   promoted here, and the full "money owed" list downstairs
 *                   still needs the button for invoices that are not yet late.
 * @param chasing    the invoice id mid-request, or null
 */
export default function NeedsToday({
  needs,
  onChase,
  chasing,
  chaseError,
  chaseNote,
}) {
  const { t } = useTranslation();
  const { formatDateTime } = useCompanyPreferences();
  // null is "not known" — refused, failed, or not answered yet. Never [], which
  // would be this component asserting a zero it was never told.
  const [reviews, setReviews] = useState(null);
  const [calls, setCalls] = useState(null);

  useEffect(() => {
    let live = true;
    // Two independent loads rather than a Promise.all: a member refused the
    // calls endpoint must still get the quotes line, and vice versa.
    fetchJson("/api/quotes/estimate-reviews")
      .then((data) => {
        if (live && Array.isArray(data?.quotes)) setReviews(data.quotes);
      })
      .catch(() => {});
    fetchJson("/api/voice/calls")
      .then((data) => {
        if (live && Array.isArray(data?.calls)) setCalls(data.calls);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const reviewCount = reviews ? reviews.length : 0;
  // A call is done with when it became a quote or somebody archived it — the
  // API reports `archived` as either (see the Quote.sourceCallId join in
  // app/api/voice/calls/route.js). `!quote` is stated as well because this line
  // is about the quote that never got written, and a reader should not have to
  // know the derivation to trust the number.
  const openCalls = calls ? calls.filter((c) => !c.archived && !c.quote).length : 0;
  const upcoming = upcomingBookings(calls);
  const overdue = needs?.rows || [];

  if (
    overdue.length === 0 &&
    reviewCount === 0 &&
    openCalls === 0 &&
    upcoming.length === 0
  ) {
    return null;
  }

  return (
    <div className={CARD_CLIPPED}>
      <div className="px-4 sm:px-5 pt-4 pb-2">
        <h2 className="font-semibold text-foreground text-sm">
          {t("app.dash.needs.title", "Waiting on you")}
        </h2>
      </div>

      {/* ── The rows with money on them, first ──────────────────────────── */}
      {overdue.length > 0 && (
        <div className="border-t border-foreground/15 divide-y divide-foreground/10">
          {overdue.map((inv) => (
            <div
              key={inv.id}
              className="px-4 sm:px-5 py-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {inv.client?.name ||
                    t("app.invoiceLifecycle.thisClient", "this client")}
                </div>
                <FigureText className="text-xs font-semibold text-destructive flex items-center gap-1">
                  <AlertCircle size={12} className="shrink-0" aria-hidden="true" />
                  {t("app.dash.owed.daysPastDue", "{days} days past due", {
                    days: inv.daysPastDue,
                  })}
                </FigureText>
                <FigureText className="text-xs text-muted-foreground">
                  {inv.invoiceNumber}
                </FigureText>
              </div>

              <div className="shrink-0 text-right">
                <Figure className="block text-sm font-semibold text-foreground">
                  {formatMoney(inv.owed, needs.currency)}
                </Figure>
                {/* ── The reminder really sends ────────────────────────────
                    POST /api/invoices/[id]/request-payment emails the client a
                    portal link through Resend and stamps sentAt once Resend
                    accepts. It enforces invoices at view_create_edit, which is
                    exactly what `canRemind` reports, so this is not a button
                    the server will 403. It refuses with a 400 when the client
                    has no email address, and that sentence is shown rather than
                    swallowed — which is why the button still renders for a
                    member whose access hides the email: they may chase, they
                    simply cannot see the address they are chasing. */}
                {needs.canRemind &&
                  (inv.client?.email || inv.client?.restricted) && (
                    <button
                      type="button"
                      onClick={() => onChase?.(inv)}
                      disabled={chasing === inv.id}
                      className="mt-1 text-xs font-semibold border border-border rounded-full px-3 py-2 min-h-[36px] disabled:opacity-50"
                    >
                      {t("app.invoiceLifecycle.actionChase")}
                    </button>
                  )}
                {needs.canRemind &&
                  !inv.client?.email &&
                  !inv.client?.restricted && (
                    <div className="mt-1 text-xs text-muted-foreground max-w-[14rem]">
                      {t("app.invoiceLifecycle.noClientEmail", {
                        name:
                          inv.client?.name ||
                          t("app.invoiceLifecycle.thisClient"),
                      })}
                    </div>
                  )}
              </div>
            </div>
          ))}

          {needs.moreCount > 0 && (
            <Link
              href="/app/invoices"
              className="flex items-center gap-1 px-4 sm:px-5 py-3 text-xs text-muted-foreground min-h-[36px]"
            >
              <FigureText as="span">
                {t("app.dash.needs.overdueMore", "{count} more overdue", {
                  count: needs.moreCount,
                })}
              </FigureText>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      {chaseError && (
        <p className="px-4 sm:px-5 py-2 text-xs text-destructive flex items-start gap-1.5">
          <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          {chaseError}
        </p>
      )}
      {chaseNote && (
        <p className="px-4 sm:px-5 py-2 text-xs text-muted-foreground">{chaseNote}</p>
      )}

      {/* ── What the automation did that still needs a person ───────────── */}
      {(reviewCount > 0 || openCalls > 0 || upcoming.length > 0) && (
        <div
          className={`px-4 sm:px-5 py-2 space-y-0.5 ${
            overdue.length > 0 ? "border-t border-foreground/15" : ""
          }`}
        >
          {/* The one with money attached, so it goes first. */}
          {reviewCount > 0 && (
            <Link href="/app/estimate-reviews" className={LINE}>
              <BadgeCheck size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <FigureText as="span">
                {t("app.dash.needs.quotes", {
                  count: t("app.dash.needs.quotesCount", { value: reviewCount }),
                })}
              </FigureText>
              <ArrowRight size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            </Link>
          )}

          {openCalls > 0 && (
            <Link href="/app/receptionist" className={LINE}>
              <Headset size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <FigureText as="span">
                {t("app.dash.needs.calls", {
                  count: t("app.dash.needs.callsCount", { value: openCalls }),
                })}
              </FigureText>
              <ArrowRight size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            </Link>
          )}

          {/* The receptionist's own wording, reused rather than re-written: the
              contractor reads the same sentence here and on /app/receptionist,
              and one of two copies is always the one that rots. */}
          {upcoming.length > 0 && (
            <Link href="/app/appointments" className={LINE}>
              <CalendarClock size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <FigureText as="span">
                {t("app.receptionist.upcomingSummary", {
                  count: t("app.receptionist.upcomingCount", {
                    value: upcoming.length,
                  }),
                  when: formatDateTime(upcoming[0]),
                })}
              </FigureText>
              <ArrowRight size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
