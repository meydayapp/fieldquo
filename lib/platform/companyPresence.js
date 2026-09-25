// lib/platform/companyPresence.js
//
// "Is this company actually inside the product?" — the words the platform
// console prints, and the rule that decides them. Pure: no database, no
// clock of its own, so scripts can execute it against hostile input.
//
// ══ Borrowed from the sales floor, on purpose ═════════════════════════════
//
// The reps already have a presence system (lib/sales/calls/agentState.js,
// presenceHeadline; app/platform/sales/reps/page.js, presenceSentence). Its
// rules carry over unchanged, because they are the rules that made the
// floor board stop lying:
//
//   · Presence is DERIVED from a keepalive's age, never declared. A company
//     is "Online now" because a member's stamp is fresh, and stops being so
//     on its own when the stamps stop — nobody has to press anything.
//   · Two tones, the reps page's two: "live" (emerald) for the one state that
//     means a person is there right now, "muted" for everything else. No red:
//     a company that has not been in for a week is information, not an alarm.
//   · "Never" is said only when it is true, and in the words of what we can
//     actually see. The reps page says "Never signed in to the sales portal";
//     this says "Never signed in since signup", and only when no sign-in
//     after the company's creation exists.
//
// ══ Two sources, never blended ════════════════════════════════════════════
//
//   lastActiveAt  Member.lastActiveAt — a visible /app tab with a person
//                 using it (POST /api/presence). This is ACTIVITY.
//   signedInAt    evidence of a signed-in session, from before the stamp
//                 existed: the newest of Session.createdAt (Better Auth writes
//                 it at login and never again) and AccountDevice.lastSeenAt
//                 (the seat-sharing sampler, lib/security/deviceGuard.js,
//                 which records a real session's requests at most every 30
//                 minutes and is unreachable for a support session). It is
//                 printed as "Signed in <when>" — they were signed in then —
//                 and never as "Active" or "Online now": a request is not a
//                 person, and a 30-minute sample cannot say "now".
//                 Session.updatedAt is deliberately not used: it moves only on
//                 a session refresh, so it can neither say "online" nor
//                 "gone".
//
// The stamp arrived on 2026-09-24. Every company that has not opened the app
// since has only the second source, which is why the fallback exists at all.
//
// ══ Why AccountDevice is in the fallback — measured, not assumed ══════════
//
// Session rows alone were tried first and read the live database wrong: a
// Session is DELETED when its owner signs out, so the owner's own company
// (in the app for an hour on the day it signed up, and since) read "Never
// signed in since signup". The device sampler keeps its rows through a
// sign-out, so it is the better witness of "they came back" for history.
//
// ══ What counts as "since signup" ═════════════════════════════════════════
//
// Signup creates the account (and its session) BEFORE it creates the company
// (app/signup → POST /api/companies), then lands the new owner in /app, where
// the device sampler records them. So evidence inside the signup visit —
// anything up to SIGNUP_VISIT_MS after Company.createdAt — is the signup
// itself, not somebody coming back. jaspedo on 2026-09-24 is the case this
// exists for: company created 23:44:27, the owner's browser last seen
// 23:46:24, nothing since. That company has not been back, and the badge
// says so. Absence of evidence is still weaker than evidence — the company
// page says so under its list.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A member stamped within this long is "Online now".
 *
 * Five minutes, against a stamp that is rewritten at most every two
 * (ACTIVE_STAMP_REFRESH_MS) from a beat every minute: a present person's
 * stamp is at most ~3 minutes old, so five leaves room for one missed beat
 * without flickering them offline, and still drops someone who closed the
 * laptop within five. The reps' window is two because their beat is the
 * dialler's; this one only has to answer "are they in?".
 */
export const ONLINE_WINDOW_MS = 5 * MINUTE;

/**
 * How far in the future a timestamp may be and still be read as "now".
 *
 * Every stamp is the server's clock, and the console corrects for the
 * viewer's own clock (see skewCorrectedNow), so a future value should not
 * happen. When a small one does — two database hosts a few seconds apart —
 * it is the present. A large one is corrupt, and a corrupt stamp must not
 * become "Online now" forever: it is ignored and the next source answers.
 */
export const FUTURE_TOLERANCE_MS = 2 * MINUTE;

/**
 * How long after Company.createdAt a sign-in is still the signup visit.
 *
 * Thirty minutes: the signup flow ends in /app, and a new owner poking at
 * the dashboard before closing the tab is still the one visit. It only
 * governs the FALLBACK — a company whose owner uses the app for twenty
 * minutes after signing up gets activity stamps, and "Active …" beats this
 * rule entirely.
 */
export const SIGNUP_VISIT_MS = 30 * MINUTE;

/** A Date for anything date-shaped, or null. Never throws. */
export function toDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  const t = d.getTime();
  return Number.isFinite(t) ? d : null;
}

/** The latest of several date-shaped values, ignoring anything unreadable. */
export function latestOf(values) {
  let best = null;
  for (const v of Array.isArray(values) ? values : []) {
    const d = toDate(v);
    if (d && (!best || d.getTime() > best.getTime())) best = d;
  }
  return best;
}

/**
 * The viewer's clock, pulled onto the server's.
 *
 * The API answers with its own `serverNow`; the page records its own clock
 * when the answer arrived. Any difference is the viewer's clock being wrong,
 * and without this a laptop five minutes fast would print every company
 * online as "Active 5 min ago". Falls back to the viewer's clock on bad input.
 */
export function skewCorrectedNow(serverNow, receivedAt, clientNow = Date.now()) {
  const s = toDate(serverNow);
  const r = Number(receivedAt);
  const c = Number(clientNow);
  if (!s || !Number.isFinite(r) || !Number.isFinite(c)) {
    return Number.isFinite(c) ? new Date(c) : new Date();
  }
  return new Date(s.getTime() + (c - r));
}

/**
 * Age in ms of `at` as seen from `now`, or null when `at` cannot be used:
 * unreadable, or further in the future than the tolerance. A small future
 * value reads as zero.
 */
function ageOf(at, now) {
  const d = toDate(at);
  if (!d) return null;
  const age = now.getTime() - d.getTime();
  if (age < -FUTURE_TOLERANCE_MS) return null;
  return Math.max(0, age);
}

/** "Sep 24", or "Sep 24, 2025" when it is not this year. */
function dayLabel(at, now, timeZone) {
  const opts = { month: "short", day: "numeric", ...(timeZone ? { timeZone } : {}) };
  const yearOf = (d) =>
    Number(new Intl.DateTimeFormat("en-US", { year: "numeric", ...(timeZone ? { timeZone } : {}) }).format(d));
  if (yearOf(at) !== yearOf(now)) opts.year = "numeric";
  return new Intl.DateTimeFormat("en-US", opts).format(at);
}

/**
 * "3 min ago" / "2 h ago" inside a day, else null (the caller prints a date).
 * Never "0 min": anything under a minute is "just now".
 */
function recentPhrase(ageMs) {
  if (ageMs < MINUTE) return "just now";
  if (ageMs < HOUR) return `${Math.floor(ageMs / MINUTE)} min ago`;
  if (ageMs < DAY) return `${Math.floor(ageMs / HOUR)} h ago`;
  return null;
}

/**
 * The badge for one company — or, with `memberCount` left at 1, for one
 * member.
 *
 * @param {object} p
 * @param {*}      p.lastActiveAt      newest Member.lastActiveAt
 * @param {*}      p.signedInAt        newest sign-in evidence (Session.createdAt,
 *                                     AccountDevice.lastSeenAt — see the header)
 * @param {*}      p.companyCreatedAt  Company.createdAt, for "since signup"
 * @param {number} p.memberCount       members on the company (0 → "No members yet")
 * @param {*}      p.now               skew-corrected now (see skewCorrectedNow)
 * @param {string} p.timeZone          for tests; the viewer's own by default
 * @param {string} p.subject           "company" (default) or "member" — only
 *                                     changes the never-signed-in wording
 * @returns {{ code: string, text: string, tone: "live"|"muted", at: Date|null, title: string }}
 *   code is one of online · active · last_active · signed_in · never · no_members
 */
export function presenceBadge({
  lastActiveAt = null,
  signedInAt = null,
  companyCreatedAt = null,
  memberCount = 1,
  now = new Date(),
  timeZone,
  subject = "company",
} = {}) {
  const at = toDate(now) || new Date();

  // ── Activity: the stamp ────────────────────────────────────────────────
  const activeAge = ageOf(lastActiveAt, at);
  if (activeAge !== null) {
    const stamp = toDate(lastActiveAt);
    if (activeAge <= ONLINE_WINDOW_MS) {
      return {
        code: "online",
        text: "Online now",
        tone: "live",
        at: stamp,
        title: "Using FieldQuo in a visible tab within the last 5 minutes.",
      };
    }
    const recent = recentPhrase(activeAge);
    return {
      code: recent ? "active" : "last_active",
      text: recent ? `Active ${recent}` : `Last active ${dayLabel(stamp, at, timeZone)}`,
      tone: "muted",
      at: stamp,
      title: "Last time someone was using FieldQuo in a visible tab.",
    };
  }

  // ── No members: nobody who COULD sign in ───────────────────────────────
  //
  // Checked after the stamp (a stamp proves a member existed, whatever the
  // count says) and before the sessions: a company created by hand in the
  // console has no owner account yet, and "never signed in" would blame
  // someone who does not exist.
  const members = Number(memberCount);
  if (Number.isFinite(members) && members <= 0) {
    return {
      code: "no_members",
      text: "No members yet",
      tone: "muted",
      at: null,
      title: "No one has an account on this company yet.",
    };
  }

  // ── Sign-in: the fallback, and said as one ─────────────────────────────
  const signAge = ageOf(signedInAt, at);
  const signed = signAge !== null ? toDate(signedInAt) : null;
  const created = toDate(companyCreatedAt);
  // Anything up to the end of the signup visit is the signup itself (see
  // SIGNUP_VISIT_MS). With no creation date to compare against, the evidence
  // is taken at its word.
  const afterSignup =
    signed && (!created || signed.getTime() > created.getTime() + SIGNUP_VISIT_MS);
  if (afterSignup) {
    const recent = recentPhrase(signAge);
    return {
      code: "signed_in",
      text: recent ? `Signed in ${recent}` : `Signed in ${dayLabel(signed, at, timeZone)}`,
      tone: "muted",
      at: signed,
      title:
        "The last time we can see someone signed in. Not activity: there is no record of them using the app since that tracking began on Sep 24, 2026.",
    };
  }

  return {
    code: "never",
    text: subject === "member" ? "Never signed in since joining" : "Never signed in since signup",
    tone: "muted",
    at: null,
    title:
      "Nothing after the signup visit: no sign-in, no request from a signed-in browser, no activity stamp. This is what we can see, not proof.",
  };
}

/** How many of these rows are online now — the one number the list headline prints. */
export function countOnline(rows, now) {
  let n = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || r.isDemo) continue;
    if (presenceBadge({ ...r, now }).code === "online") n++;
  }
  return n;
}

/**
 * A sort key: newest evidence first. Activity outranks a sign-in of the same
 * moment only by being checked first — both are real times, and "most
 * recently seen" is the question the sort answers.
 */
export function presenceSortKey(row, now) {
  const b = presenceBadge({ ...(row || {}), now });
  return b.at ? b.at.getTime() : -Infinity;
}
