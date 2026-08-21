// app/components/layout/TrialBadge.js
//
// The trial countdown in the sidebar.
//
// Renders for whoever the API is willing to tell. That used to be every
// signed-in member, so an employee saw "Trial started · 48 days left" on every
// screen — their employer's commercial position, on a badge whose only action
// they cannot take. /api/settings/subscription now returns nulls to anyone who
// isn't a billing admin, and the existing `sub?.status !== "trialing"` guard
// below turns that into rendering nothing.
//
// Deliberately NOT a second role check here. One place decides, and it is the
// server — a client-side role test would be a second source of truth that can
// drift from the payload, and the payload is the one that matters.
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

function daysLeft(trialEndsAt) {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default function TrialBadge({ collapsed = false }) {
  const [sub, setSub] = useState(null);

  useEffect(() => {
    fetch("/api/settings/subscription")
      .then((r) => r.json())
      .then(setSub)
      .catch(() => setSub(null));
  }, []);

  if (!sub?.status || sub.status !== "trialing") return null;

  const remaining = daysLeft(sub.trialEndsAt);
  if (remaining === null) return null;

  const urgent = remaining <= 3;

  if (collapsed) {
    return (
      <Link
        href="/app/settings/account-billing"
        title={`Trial: ${remaining} day${remaining === 1 ? "" : "s"} left`}
        className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold mx-auto ${
          urgent ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400" : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
        }`}
      >
        {remaining}
      </Link>
    );
  }

  return (
    <Link
      href="/app/settings/account-billing"
      className={`block rounded-lg px-3 py-2 text-xs font-medium ${
        urgent ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300" : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
      }`}
    >
      Trial started · {remaining} day{remaining === 1 ? "" : "s"} left
    </Link>
  );
}
