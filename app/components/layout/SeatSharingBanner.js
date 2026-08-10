"use client";

// app/components/layout/SeatSharingBanner.js
//
// "We've noticed this login being used on a lot of different devices."
//
// Two states, and the difference between them is the whole point:
//
//   A strike, still active  — a quiet, dismissible note. This detector is a
//   heuristic over a coarse device fingerprint and it WILL be wrong about some
//   honest customer, so the copy says "noticed", not "caught", offers the
//   remedy, and gets out of the way when they wave it off.
//
//   under_review            — stays put, because support is about to get in
//   touch and being told that afterwards is worse than being told now.
//
// NEITHER blocks anything. No overlay, no disabled buttons, nothing hidden.
// The account keeps working in both states; a person decides what happens
// next. If someone later wants this to gate access, that is a product
// decision and not a CSS change.
//
// Renders nothing at all for the overwhelming majority of companies, which
// have no strikes — no strip of chrome for people who've done nothing.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, X, UserPlus } from "lucide-react";

export default function SeatSharingBanner() {
  const [account, setAccount] = useState(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let live = true;
    fetch("/api/ui-state")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d?.account) return;
        setAccount(d.account);
        const seen = Array.isArray(d.dismissedNotices) ? d.dismissedNotices : [];
        setDismissed(Boolean(d.account.noticeKey) && seen.includes(d.account.noticeKey));
      })
      // Silent. A banner that appears because a status check failed would
      // accuse a paying customer of cheating on the strength of a 500.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!account) return null;

  // "restricted" deliberately renders NOTHING. It is a reserved value that only
  // a human sets, and no restriction is implemented behind it — a banner
  // announcing a restriction that isn't in force would be the dead control
  // this codebase keeps getting bitten by. Whoever builds the restriction
  // builds its message with it.
  const underReview = account.status === "under_review";
  if (!underReview && (dismissed || !account.noticeKey)) return null;

  function dismiss() {
    // Optimistic: the banner goes now, and the write is what makes it stay
    // gone on their other devices. A failed write means it comes back on the
    // next load, which is the safe direction for a notice about a warning.
    setDismissed(true);
    fetch("/api/ui-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismiss: account.noticeKey }),
    }).catch(() => {});
  }

  return (
    <div
      role="status"
      className={`px-4 py-3 text-sm border-b ${
        underReview
          ? "bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-900"
          : "bg-muted text-foreground border-border"
      }`}
    >
      <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-2">
        <Users size={17} className="shrink-0" />

        <p className="flex-1 min-w-[16rem]">
          {underReview ? (
            <>
              <strong>This account is under review.</strong> One login here has
              been used on an unusual number of devices, so we&apos;ve flagged it
              for someone to look at. Nothing has changed and nothing is blocked
              — we&apos;ll be in touch. If your crew is sharing a login, giving
              each person their own sorts it out.
            </>
          ) : (
            <>
              <strong>
                We&apos;ve noticed this login being used on an unusual number of
                devices.
              </strong>{" "}
              Using it on your own phone and laptop is completely fine. Sharing
              one login across the crew isn&apos;t — everyone needs their own, so
              their work is theirs and you can see who did what.
            </>
          )}
        </p>

        <Link
          href="/app/settings/team"
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
            underReview
              ? "bg-amber-900 text-white dark:bg-amber-200 dark:text-amber-950"
              : "bg-foreground text-background"
          }`}
        >
          <UserPlus size={15} /> Invite someone
        </Link>

        {/* Only the soft warning can be waved away. See the header. */}
        {!underReview && (
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
