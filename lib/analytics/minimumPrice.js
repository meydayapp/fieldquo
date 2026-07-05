// lib/analytics/minimumPrice.js
import { db } from "@/lib/db";
import { calculateBurnRate } from "./burnRate";

export async function calculateMinimumPrice({ companyId, targetMargin = 0.2 }) {
  const [burn, forecast] = await Promise.all([
    calculateBurnRate({ companyId, cashOnHand: null }),
    db.forecastSettings.findUnique({ where: { companyId } }),
  ]);

  const jobsPerMonth = (forecast?.jobsPerWeekCapacity || 3) * 4.33;

  if (jobsPerMonth <= 0) {
    return {
      error:
        "Set your expected jobs-per-week capacity in Forecast Settings first",
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
