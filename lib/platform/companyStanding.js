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
//   · everything else kept onboardingStatus — superseded the next day, see
//     below.
//
// Server-side only (access.js reads the database for its other exports);
// the routes attach `standing` to the rows they return and the pages print
// it, so a client page never re-derives it.

//
// ══ 2026-09-25: the card-backed half, too ══════════════════════════════════
//
// "Everything else keeps onboardingStatus" printed "active" over TrueFinish
// and Sunset Space, two companies inside a Stripe trial that had paid
// nothing — the same column, the same trap, on the other half of the book.
// Every company's word now comes from its bucket (lib/platform/
// trialCounting.js subscriberBucket), the one the dashboard tiles count, so
// the row a tile's number points at says the same thing the tile does.
// onboardingStatus survives only as a suffix when the console marked a
// company churned or suspended by hand while its subscription says
// otherwise — shown, never silently dropped.

import { trialAccessFor } from "@/lib/billing/access";
import { subscriberBucket } from "@/lib/platform/trialCounting";

const days = (n) => `${n} ${n === 1 ? "day" : "days"}`;
const DAY = 24 * 60 * 60 * 1000;

function shortDate(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * @param company { isDemo, onboardingStatus, trialEndsAt,
 *                  subscription: {...} | null } — `subscription` and
 *                  `trialEndsAt` must be loaded (the abandoned.js predicates
 *                  throw otherwise, rather than print a guess).
 * @returns {{ key, label, tone, bucket, daysLeft? }}
 *   key   "demo" | "trial_no_plan" | "trial_ended_no_plan" |
 *         "trial_locked_no_plan" | "incomplete" | "trial_with_plan" |
 *         "paying" | "past_due" | "locked" | "cancelled" | "unknown"
 *   tone  "trial" | "warning" | "muted" | "active" | "churned", for the
 *         page's own palette
 */
export function companyStanding(company, now = new Date()) {
  if (!company) return { key: "unknown", label: "—", tone: "muted", bucket: null };
  const bucket = subscriberBucket(company, now);
  const sub = company.subscription;
  const out = (key, label, tone, extra = {}) => {
    // A hand-set churned/suspended that the subscription contradicts.
    const marked =
      (company.onboardingStatus === "churned" || company.onboardingStatus === "suspended") &&
      bucket !== "cancelled" && bucket !== "demo" && bucket !== "incomplete"
        ? ` · marked ${company.onboardingStatus}`
        : "";
    return { key, label: `${label}${marked}`, tone, bucket, ...extra };
  };

  switch (bucket) {
    case "demo":
      return out("demo", "Demo", "muted");
    case "incomplete":
      return out("incomplete", "Never finished signup", "muted");
    case "trial_no_plan": {
      const t = trialAccessFor(company, now);
      return out("trial_no_plan", `Trialing · no plan yet · ${days(t.daysLeft)} left`, "trial", { daysLeft: t.daysLeft });
    }
    case "trial_ended": {
      const t = trialAccessFor(company, now);
      return out("trial_ended_no_plan", `Trial ended · no plan · read-only ${days(t.daysLeft)} more`, "warning", { daysLeft: t.daysLeft });
    }
    case "trial_with_plan": {
      const ends = sub?.trialEndsAt ? new Date(sub.trialEndsAt) : null;
      const left = ends && !Number.isNaN(ends.getTime()) ? Math.ceil((ends.getTime() - now.getTime()) / DAY) : null;
      const plan = sub?.plan?.name ? ` · ${sub.plan.name}` : "";
      const when =
        left === null ? "" : left >= 0 ? ` · ${days(left)} left` : ` · trial end passed ${shortDate(ends)}`;
      return out("trial_with_plan", `Trialing${plan}${when}`, left !== null && left < 0 ? "warning" : "trial", { daysLeft: left });
    }
    case "paying": {
      const plan = sub?.plan?.name ? ` · ${sub.plan.name}` : "";
      const ends = sub?.cancelAtPeriodEnd ? shortDate(sub.cancelAt || sub.currentPeriodEnd) : null;
      return out("paying", `Paying${plan}${sub?.cancelAtPeriodEnd ? ` · cancels ${ends || "at period end"}` : ""}`, "active");
    }
    case "past_due":
      return out("past_due", "Past due · payment failed", "warning");
    case "locked":
      if (sub === null) return out("trial_locked_no_plan", "Trial ended · no plan · locked", "warning", { daysLeft: 0 });
      return out("locked", sub?.accessLockedAt ? "Locked by FieldQuo" : "Locked · payment grace over", "churned");
    case "cancelled":
      return out("cancelled", `Cancelled${sub?.canceledAt ? ` ${shortDate(sub.canceledAt)}` : ""}`, "churned");
    default:
      return out("unknown", `Unrecognised subscription status: ${sub?.status ?? "none"}`, "warning");
  }
}
