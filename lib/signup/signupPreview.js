// lib/signup/signupPreview.js
//
// The pure half of the reactive signup panel (app/components/auth/AuthAside.js):
// the closed lists the Team and Goals steps offer, what a team-size band says
// about the plan rung, what the calendar preview should draw for it, and the
// tax line the business step can honestly print for an address.
//
// ══ Why the answers are bands and not numbers ══════════════════════════════
//
// The owner watched Housecall Pro and Jobber ask "how many employees" and saw
// the calendar beside the question change shape with the answer. Neither asks
// for a headcount — a band is faster to tap on a phone in a driveway, and it
// is honest about how much a stranger knows on day one. The band is stored on
// the company as the words they picked (Company.teamSizeBand), never expanded
// into a headcount column somebody would later mistake for the roster.
//
// ══ What a band is allowed to decide ═══════════════════════════════════════
//
// One thing: which card the trial banner's "Choose a plan" opens on, and only
// when the pricing-page link named nothing (Company.signupTierKey, read by
// lib/billing/recommendedTier.js's callers). It is the smallest rung the
// stated number of people fits, counting everyone but the owner as crew —
// the cheapest reading of the answer. A seat holder among them raises the
// rung, and the banner recomputes from the REAL roster (countSeats + tierFor)
// once people are invited, so a wrong first guess costs a click, not money.
//
// Nothing here touches React, the network or the database, so
// scripts/check-signup-aside.mjs executes every function against hostile input.

import { tierFor } from "@/lib/pricing/ladder";
import { normaliseProvince, normaliseUsState } from "@/lib/tax/addressRegion";
import { lookupCanadianRate, lookupUsStateBase, normaliseCountry } from "@/lib/tax/jurisdictions";
import { taxLineHeadline } from "@/lib/tax/taxLine";

/**
 * "How many people work with you (including you)?" — the chips, in order.
 *
 * `people` is the number the band STATES: its upper bound, or for the open
 * band its lower one, because "16+" promises sixteen and nothing more. Used
 * only for the plan-rung reading above; the calendar preview reads `shape`.
 */
export const TEAM_SIZE_BANDS = Object.freeze([
  Object.freeze({ key: "1", people: 1, shape: "week", rows: 1, labelKey: "app.signup.team.band.1", label: "Just me" }),
  Object.freeze({ key: "2-5", people: 5, shape: "day", rows: 3, labelKey: "app.signup.team.band.2-5", label: "2–5" }),
  Object.freeze({ key: "6-10", people: 10, shape: "board", rows: 6, labelKey: "app.signup.team.band.6-10", label: "6–10" }),
  Object.freeze({ key: "11-15", people: 15, shape: "board", rows: 6, labelKey: "app.signup.team.band.11-15", label: "11–15" }),
  Object.freeze({ key: "16+", people: 16, shape: "grouped", rows: 8, labelKey: "app.signup.team.band.16+", label: "16+" }),
]);

/** "Years in business" — the chips, in order. Stored as the words picked. */
export const YEARS_BANDS = Object.freeze([
  Object.freeze({ key: "<1", labelKey: "app.signup.team.years.lt1", label: "Less than a year" }),
  Object.freeze({ key: "1-2", labelKey: "app.signup.team.years.1-2", label: "1–2 years" }),
  Object.freeze({ key: "3-5", labelKey: "app.signup.team.years.3-5", label: "3–5 years" }),
  Object.freeze({ key: "6-10", labelKey: "app.signup.team.years.6-10", label: "6–10 years" }),
  Object.freeze({ key: "10+", labelKey: "app.signup.team.years.10+", label: "More than 10 years" }),
]);

/**
 * "What's top of mind?" — four goals, one pick. Each names the panel the
 * aside shows for it (AuthAside's GoalPreview), so the picture beside the
 * chip is the part of the product that answers the goal, not a generic one.
 */
export const SIGNUP_GOALS = Object.freeze([
  Object.freeze({ key: "look_professional", labelKey: "app.signup.goals.goal.look_professional", label: "Look professional to my clients" }),
  Object.freeze({ key: "feel_in_control", labelKey: "app.signup.goals.goal.feel_in_control", label: "Feel in control of the business" }),
  Object.freeze({ key: "win_more_jobs", labelKey: "app.signup.goals.goal.win_more_jobs", label: "Win more jobs" }),
  Object.freeze({ key: "exploring", labelKey: "app.signup.goals.goal.exploring", label: "Just exploring" }),
]);

/** The longest "how did you hear about us" the company row keeps. */
export const SIGNUP_SOURCE_MAX = 200;

const has = (list, key) => typeof key === "string" && list.some((b) => b.key === key);

/** One of TEAM_SIZE_BANDS' keys, or null. Never a default. */
export function cleanTeamSizeBand(value) {
  return has(TEAM_SIZE_BANDS, value) ? value : null;
}

/** One of YEARS_BANDS' keys, or null. Never a default. */
export function cleanYearsBand(value) {
  return has(YEARS_BANDS, value) ? value : null;
}

/** One of SIGNUP_GOALS' keys, or null. Never a default. */
export function cleanSignupGoal(value) {
  return has(SIGNUP_GOALS, value) ? value : null;
}

/**
 * Free text, trimmed, control characters removed, capped. Empty → null so a
 * skipped question is stored as unanswered, not as "".
 */
export function cleanSignupSource(value) {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const s = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, SIGNUP_SOURCE_MAX).trim();
  return s ? s : null;
}

/** The band's definition, or null. */
export function teamSizeBand(key) {
  return TEAM_SIZE_BANDS.find((b) => b.key === key) || null;
}

/**
 * The rung a band starts the trial banner on — see the header. Null for no
 * band (nothing was said) and for a company bigger than the ladder sells to.
 */
export function recommendedTierKeyForBand(bandKey) {
  const band = teamSizeBand(bandKey);
  if (!band) return null;
  const tier = tierFor({ seats: 1, crew: Math.max(0, band.people - 1) });
  return tier?.tierKey || null;
}

/**
 * What the calendar preview draws for a band:
 *
 *   week      one person's week — seven columns, their own name on the jobs
 *   day       a day with a named column per person (the two-to-five shape)
 *   board     the dispatch board, a row per person, an hour per column
 *   grouped   the same board with rows under crew headings
 *
 * No band yet → "week", the smallest honest picture, and the chips change it.
 */
export function calendarShapeForBand(bandKey) {
  return teamSizeBand(bandKey)?.shape || "week";
}

/**
 * The tax line the booking-page preview can print for an address, as the
 * app's own tax line prints it ("HST 13% (Ontario)", "Texas sales tax 6.25%"),
 * through the same lookups the quote builder uses.
 *
 * Returns { key, params, cautionKey } for t(), or NULL when the address does
 * not resolve to a jurisdiction we hold a rate for. Null is the whole point:
 * an incomplete address prints nothing, never a guess (AGENTS.md failure
 * class 5). The US line carries the state-base caution because county and
 * city rates are not in the table — the same caution the builder shows.
 */
export function taxPreviewFor(place, lang = "en") {
  // Coalesced, not defaulted: a default parameter fires on undefined only,
  // and the form hands this `null` while the address is being typed.
  const { country, province } = place && typeof place === "object" ? place : {};
  const iso = normaliseCountry(country);
  if (iso === "CA") {
    const code = normaliseProvince(province);
    if (!code) return null;
    const r = lookupCanadianRate(code, new Date(), lang);
    if (r.status !== "known") return null;
    const line = taxLineHeadline({ source: "jurisdiction_ca", rate: r.rate, label: r.label, components: r.components }, lang);
    return line ? { ...line, cautionKey: null } : null;
  }
  if (iso === "US") {
    const code = normaliseUsState(province);
    if (!code) return null;
    const r = lookupUsStateBase(code, lang);
    if (r.status === "unknown" || !(Number(r.rate) >= 0)) return null;
    const line = taxLineHeadline({ source: "jurisdiction_us", rate: r.rate, label: r.label }, lang);
    return line ? { ...line, cautionKey: r.cautionKey || null } : null;
  }
  return null;
}
