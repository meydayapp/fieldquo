"use client";

// app/components/dashboard/NeedsYou.js
//
// What the automation did while nobody was looking, and what is left for a
// person to do about it.
//
// Three things arrive without anybody pressing anything — a quote the software
// priced, a call the receptionist took, a slot the receptionist booked — and
// each of them lands on a different screen. A contractor who opens /app and
// sees the money panels has no reason to suspect any of them exist. This is the
// one place that says so.
//
// ── Why it summarises rather than lists ────────────────────────────────────
//
// The rows already have homes: /app/estimate-reviews, /app/receptionist,
// /app/appointments. Reproducing them here would give the same call two places
// to be triaged and one of them would go stale. So each line is a count and a
// link, and the screen that owns the work stays the screen that owns it.
//
// ── Why it renders itself away ─────────────────────────────────────────────
//
// A banner that is present on a quiet day is a banner people stop reading, and
// "0 calls waiting" is a sentence nobody needs. Each line is independently
// absent, and with all three absent the component returns null — same rule as
// AwaitingPayment beside it.
//
// ── Why a failed load is also nothing ──────────────────────────────────────
//
// Both endpoints refuse a member who may not see what they carry:
// /api/quotes/estimate-reviews wants quotes:view_only, /api/voice/calls wants
// the call-audio level. A refusal is a boundary working as designed — there is
// nothing to apologise for and nothing to retry — so it renders as the absence
// of that line, never as a zero and never as a banner. Same reasoning as the
// "$0 revenue was a 403 wearing a number" comment in app/app/page.js: a count
// only ever comes from a body the server actually sent, which is why both
// states start at null rather than [].

import { useState, useEffect } from "react";
import Link from "next/link";
import { BadgeCheck, Headset, CalendarClock, ArrowRight } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";

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

export default function NeedsYou() {
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
  const openCalls = calls
    ? calls.filter((c) => !c.archived && !c.quote).length
    : 0;
  const upcoming = upcomingBookings(calls);

  if (reviewCount === 0 && openCalls === 0 && upcoming.length === 0) return null;

  const line = "flex items-start gap-2 text-sm text-muted-foreground hover:text-foreground";

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground text-sm">
        {t("app.dash.needs.title")}
      </h2>

      <div className="mt-2 space-y-1.5">
        {/* The one with money attached, so it goes first. */}
        {reviewCount > 0 && (
          <Link href="/app/estimate-reviews" className={line}>
            <BadgeCheck size={15} className="mt-0.5 shrink-0" />
            <span>
              {t("app.dash.needs.quotes", {
                count: t("app.dash.needs.quotesCount", { value: reviewCount }),
              })}
            </span>
            <ArrowRight size={14} className="mt-0.5 shrink-0" />
          </Link>
        )}

        {openCalls > 0 && (
          <Link href="/app/receptionist" className={line}>
            <Headset size={15} className="mt-0.5 shrink-0" />
            <span>
              {t("app.dash.needs.calls", {
                count: t("app.dash.needs.callsCount", { value: openCalls }),
              })}
            </span>
            <ArrowRight size={14} className="mt-0.5 shrink-0" />
          </Link>
        )}

        {/* The receptionist's own wording, reused rather than re-written: the
            contractor reads the same sentence here and on /app/receptionist,
            and one of two copies is always the one that rots. */}
        {upcoming.length > 0 && (
          <Link href="/app/appointments" className={line}>
            <CalendarClock size={15} className="mt-0.5 shrink-0" />
            <span>
              {t("app.receptionist.upcomingSummary", {
                count: t("app.receptionist.upcomingCount", {
                  value: upcoming.length,
                }),
                when: formatDateTime(upcoming[0]),
              })}
            </span>
            <ArrowRight size={14} className="mt-0.5 shrink-0" />
          </Link>
        )}
      </div>
    </div>
  );
}
