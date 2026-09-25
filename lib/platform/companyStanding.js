// lib/platform/companyStanding.js
//
// The one word (or line) the platform console prints as a company's status —
// on the companies list, the company detail header and the subscriptions
// page — DERIVED, never stored.
//
// ══ Why derived ════════════════════════════════════════════════════════════
//
// Those screens printed Company.onboardingStatus, which flips to "active"
// only at checkout.session.completed (lib/platform/trialCounting.js has the
// history). Since 38d3308d a new company takes no card and has no checkout,
// so every one of them read "pending" — jaspedo on 2026-09-25, a company on
// day one of its free month, looked on /platform/companies/[id] exactly like
// somebody who closed the Stripe tab in July. Writing onboardingStatus to
// fix the word would be the console editing a customer's row (non-negotiable
// #3) and would still be wrong the day the trial ends, so the status is read
// off the rows that decide it, in one place:
//
//   · a card-free trial (lib/signup/abandoned.js isCardFreeTrial) reads what
//     lib/billing/access.js trialAccessFor says — the function behind the
//     banner the company's own owner sees — "Trialing · no plan yet · N days
//     left", then "Trial ended · no plan · read-only N more days", then
//     "Trial ended · no plan · locked";
//   · a company that never finished signing up (no row, no trial date)
//     reads "Never finished signup";
//   · everything else keeps onboardingStatus, unchanged — a card-backed
//     company's lifecycle word is still the column's to give.
//
// Server-side only (access.js reads the database for its other exports);
// the routes attach `standing` to the rows they return and the pages print
// it, so a client page never re-derives it.

import { hasFinishedSignup, isCardFreeTrial } from "@/lib/signup/abandoned";
import { trialAccessFor } from "@/lib/billing/access";

const days = (n) => `${n} ${n === 1 ? "day" : "days"}`;

/**
 * @param company { isDemo, onboardingStatus, trialEndsAt,
 *                  subscription: {...} | null } — `subscription` and
 *                  `trialEndsAt` must be loaded (the abandoned.js predicates
 *                  throw otherwise, rather than print a guess).
 * @returns {{ key, label, tone, daysLeft? }}
 *   key   "demo" | "trial_no_plan" | "trial_ended_no_plan" |
 *         "trial_locked_no_plan" | "incomplete" | onboardingStatus
 *   tone  "trial" | "warning" | "muted" | the onboardingStatus word, for the
 *         page's own palette
 */
export function companyStanding(company, now = new Date()) {
  if (!company) return { key: "unknown", label: "—", tone: "muted" };
  if (company.isDemo) return { key: "demo", label: "Demo", tone: "muted" };
  if (isCardFreeTrial(company)) {
    const t = trialAccessFor(company, now);
    if (t?.level === "full") {
      return { key: "trial_no_plan", label: `Trialing · no plan yet · ${days(t.daysLeft)} left`, tone: "trial", daysLeft: t.daysLeft };
    }
    if (t?.level === "readonly") {
      return { key: "trial_ended_no_plan", label: `Trial ended · no plan · read-only ${days(t.daysLeft)} more`, tone: "warning", daysLeft: t.daysLeft };
    }
    return { key: "trial_locked_no_plan", label: "Trial ended · no plan · locked", tone: "warning", daysLeft: 0 };
  }
  if (!hasFinishedSignup(company)) return { key: "incomplete", label: "Never finished signup", tone: "muted" };
  const status = company.onboardingStatus || "unknown";
  return { key: status, label: status, tone: status };
}
