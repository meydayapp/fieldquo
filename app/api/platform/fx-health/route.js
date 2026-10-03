// app/api/platform/fx-health/route.js
//
// Is the pinned exchange rate still fresh enough to convert with?
//
// ── Why this is a platform check ─────────────────────────────────────────────
//
// lib/marketing/fx.js holds ONE hand-read USD/CAD rate. Every company whose
// Meta ad account reports in another currency has its spend converted with it
// (lib/analytics/spendCurrency.js), and the public comparison pages convert
// competitors' USD prices with it. It is re-read by hand, on purpose — see
// that file's header for why it is not fetched — and past its 45-day window
// it REFUSES, which quietly drops converted spend out of every affected
// company's marketing totals at once.
//
// The only reminder used to be a warning printed by scripts/check-fx.mjs,
// which reaches whoever happens to run it. In October 2026 the first place
// the rate's age surfaced was a customer's monthly summary email ("rate 34
// days old"). This puts it on /platform beside the email and AI banners.
//
// Pure arithmetic on a constant: no database, no vendor call, nothing to fail
// but the admin gate.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { rateHealth } from "@/lib/marketing/fx";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rates = rateHealth(new Date());
  const attention = rates.filter((r) => r.state !== "fresh");
  return NextResponse.json({
    healthy: attention.length === 0,
    rates,
    // One sentence per rate that needs a human, built here so the banner
    // renders words rather than assembling them from fields.
    problems: attention.map((r) =>
      r.state === "refused"
        ? `${r.pair} is ${r.ageDays} days old and no longer converts. Spend in that currency is being left out of every affected company's marketing totals until it is re-read.`
        : `${r.pair} (${r.rate}, for ${r.rateDate}) is ${r.ageDays} days old. It stops converting on ${r.stopsOn}.`,
    ),
    // What to do, said once: the rate lives in source, so the fix is a commit.
    remedy:
      "Re-read the rate from the source below and update rate, rateDate, readOn and readBy in lib/marketing/fx.js (and TODAY in scripts/check-fx.mjs).",
  });
}
