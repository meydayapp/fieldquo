"use client";

import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";

// Shown on Team + New User when the company is out of licensed seats.
//
// This used to be SeatUpgradePanel: a number field where a company typed an
// arbitrary employee count and posted it to /api/platform/billing/checkout,
// which minted a "Custom (N employees)" Plan at $45/licence
// (calculatePricing + findOrCreateCustomPlan). The owner retired that pricing
// model 2026-08-31 — the four-tier seat ladder (lib/pricing/ladder.js) is the
// pricing now, and there is no "type a number, get a price" between its four
// rungs. See docs/PRICING-CLEANUP.md.
//
// So this no longer takes money-shaped input at all. It names the next tier
// that fits (or says to talk to us, when none does — the ladder tops out at
// Scale) and sends an owner/admin to Account & Billing to choose it, which is
// the same "choose a tier" flow every other plan change already goes through.
// This is deliberately the same information the Manage Team page already
// shows next to its own seat/crew cap ("seats.nextTier" from
// lib/pricing/seatLimit.js) — one seat-cap upgrade prompt, not two.
export default function SeatCapUpgradeNotice({
  used,
  limit,
  nextTier,
  className = "",
}) {
  const { t } = useTranslation();
  return (
    <div
      id="seat-upgrade"
      className={`bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-5 space-y-2 ${className}`}
    >
      <p className="text-sm font-semibold text-foreground">
        {t("app.setTeam.upgradeTitle", { used, limit })}
      </p>
      <p className="text-sm text-muted-foreground">
        {nextTier
          ? t("app.setTeam.capUpgrade", {
              what: t("app.setTeam.capSeats"),
              tier: nextTier.label,
              seats: nextTier.seats,
              crew: nextTier.crewSeats,
            })
          : t("app.setTeam.capTalkToUs")}{" "}
        <Link
          href="/app/settings/account-billing"
          className="font-semibold underline underline-offset-2"
        >
          {t("app.setTeam.capUpgradeCta")}
        </Link>
      </p>
    </div>
  );
}
