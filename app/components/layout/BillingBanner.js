"use client";

// app/components/layout/BillingBanner.js
//
// "Your payment failed. You have N days."
//
// Mounted once in the app layout, above everything, on every screen. Not on the
// billing page alone — someone whose card expired is not looking at the billing
// page, they're looking at tomorrow's jobs, and a warning they have to go and
// find is a warning nobody sees until they're locked out.
//
// ── Why it can't be dismissed ──────────────────────────────────────────────
//
// A dismissible warning about losing access to your business is a warning that
// gets dismissed on day one and remembered on day eight. It stays, it counts
// down, and it gets louder in the last two days.
//
// It is NOT rendered at all when the account is healthy, which is the common
// case — no strip of chrome for the ~99% of companies who have paid.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CreditCard } from "lucide-react";

export default function BillingBanner() {
  const [state, setState] = useState(null);

  useEffect(() => {
    let live = true;
    fetch("/api/settings/subscription/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setState(d))
      // Silent on failure. A banner that appears because a status check 500'd
      // would tell a paying customer their account is about to be cut off.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!state || state.level === "full") return null;

  const locked = state.level === "locked";
  // Cancelling is a DECISION, not a failure. Red chrome and "payment didn't go
  // through" would send someone to check a card that's perfectly fine, and
  // shouting at somebody who chose to leave is the surest way to make sure they
  // don't come back.
  const cancelled = state.reason === "canceled" || state.reason === "canceled_expired";
  const urgent = !cancelled && (locked || state.daysLeft <= 2);

  return (
    <div
      role="alert"
      className={`px-4 py-3 text-sm ${
        urgent
          ? "bg-red-600 text-white"
          : "bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900"
      }`}
    >
      <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-2">
        <AlertTriangle size={17} className="shrink-0" />

        <p className="flex-1 min-w-[14rem]">
          {cancelled ? (
            locked ? (
              <>
                <strong>Your plan is cancelled.</strong> Start it again to pick
                up where you left off — everything is still here.
              </>
            ) : (
              <>
                <strong>
                  Your plan is cancelled — {state.daysLeft} day
                  {state.daysLeft === 1 ? "" : "s"} of read-only left.
                </strong>{" "}
                You can still look at everything and download what you need.
                Start the plan again any time.
              </>
            )
          ) : locked ? (
            <>
              <strong>Your account is locked.</strong> Update your card to get
              back in — nothing has been deleted.
            </>
          ) : (
            <>
              <strong>
                Your payment didn&apos;t go through
                {state.daysLeft === 1
                  ? " — 1 day left"
                  : ` — ${state.daysLeft} days left`}
                .
              </strong>{" "}
              You can still see everything, but you can&apos;t create or send
              until it&apos;s sorted. After that the account locks.
            </>
          )}
        </p>

        <Link
          href="/app/settings/account-billing"
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
            urgent
              ? "bg-white text-red-700"
              : "bg-amber-900 text-white dark:bg-amber-200 dark:text-amber-950"
          }`}
        >
          <CreditCard size={15} /> {cancelled ? "Start again" : "Update card"}
        </Link>
      </div>
    </div>
  );
}
