// lib/analytics/minimumPrice.js
// lib/analytics/minimumPrice.js
//
// The lowest price a job can go out at and still cover the business.
//
// ── Why capacity is not defaulted ───────────────────────────────────────────
//
// This read `forecast?.jobsPerWeekCapacity || 3`, and nothing in the product
// could set that field — there was no Forecast Settings screen, despite the
// error message below naming one. So every company's minimum price was computed
// against an invented capacity of three jobs a week.
//
// That is the worst version of padding absent data with a default: the output is
// a PRICE FLOOR. A contractor who priced a job against it was pricing against a
// number FieldQuo made up, and nothing on the way told them so.
//
// Capacity is now required. No capacity means no answer, and the caller says so.
import { db } from "@/lib/db";
import { calculateBurnRate } from "./burnRate";

export async function calculateMinimumPrice({ companyId, targetMargin = 0.2 }) {
  const [burn, forecast] = await Promise.all([
    calculateBurnRate({ companyId, cashOnHand: null }),
    db.forecastSettings.findUnique({ where: { companyId } }),
  ]);

  const capacity = Number(forecast?.jobsPerWeekCapacity || 0);
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return {
      needsCapacity: true,
      error:
        "Tell us how many jobs a week you can take on and we'll work out your minimum price. Without it there's nothing to divide your overhead by.",
    };
  }

  const jobsPerMonth = capacity * 4.33;

  if (jobsPerMonth <= 0) {
    return {
      needsCapacity: true,
      error:
        "Tell us how many jobs a week you can take on and we'll work out your minimum price.",
    };
  }

  const costPerJob = burn.totalMonthlyBurn / jobsPerMonth;
  const minimumPrice = costPerJob / (1 - targetMargin);

  return {
    monthlyFixedCosts: burn.totalMonthlyBurn,
    jobsPerMonth: Math.round(jobsPerMonth * 10) / 10,
    costPerJob: Math.round(costPerJob * 100) / 100,
    targetMargin,
    minimumPrice: Math.round(minimumPrice * 100) / 100,
  };
}
