// app/components/layout/TrialBadge.js
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
          urgent ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"
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
        urgent ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      Trial started · {remaining} day{remaining === 1 ? "" : "s"} left
    </Link>
  );
}
