// lib/crew/attribution.js
//
// "Which job does this photo belong to?"
//
// ══ Why this file is the whole product ═════════════════════════════════════
//
// A crew member texts a photo. Before it can be filed, we have to know which
// job it's for — and getting that wrong is not a small bug. A $12k change-order
// photo filed against the wrong client is the moment the owner stops trusting
// the tool, goes back to phoning everyone, and cancels. The value proposition
// ("your crew just texts, it files correctly") lives or dies here.
//
// ══ Confidence tiers, and it NEVER guesses silently ════════════════════════
//
// The one rule that matters: a low-confidence attribution ASKS, it does not
// pick. The cost of asking is a five-second reply; the cost of a silent wrong
// guess is the relationship. Those aren't symmetric, so every ambiguous case
// resolves to "ask", with the candidates attached so the question can be a
// tap ("1 Oak St · 2 Maple Ave"), never free text.
//
//   explicit  the message names a job / client / address matching ONE job
//   gps       the photo's coordinates sit on ONE job's site, clearly nearest
//   only-one  the person has exactly one job on the clock — nowhere else it
//             could be
//   ask       anything else: several candidates, or none
//
// ══ Pure ═══════════════════════════════════════════════════════════════════
//
// The caller fetches the candidate jobs (the sender's scheduled visits for the
// day) and passes them in. This function decides. No database, so the decision
// runs against the cases that actually break it — the two "Johnson" jobs, the
// rotation across three sites, the photo about tomorrow's site sent from
// today's — without a fixture.
import { haversineKm, hasPoint } from "@/lib/booking/travel";

/** A GPS match must be at least this confident: on-site, and clearly nearest. */
const GPS_ONSITE_KM = 0.25; // 250m — a big lot plus phone drift, not the next street
const GPS_SEPARATION = 2; // nearest must be at least 2× closer than the runner-up

/** Lowercase, strip punctuation, collapse spaces — for loose text matching. */
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The distinctive tokens a candidate can be named by, from its own fields. */
function identifiers(candidate) {
  const out = new Set();
  const add = (s) => {
    for (const tok of norm(s).split(" ")) {
      // Two-plus chars, so "a"/"st" don't match everything. Street numbers
      // (which are distinctive) are kept.
      if (tok.length >= 2) out.add(tok);
    }
  };
  add(candidate.clientName);
  add(candidate.jobTitle);
  // From an address, the street number is the single most distinctive token —
  // "123" disambiguates two jobs on the same street where the name won't.
  const streetNumber = String(candidate.address || "").match(/\b(\d{1,6})\b/);
  if (streetNumber) out.add(streetNumber[1]);
  add(candidate.address);
  return out;
}

/**
 * Which candidates does the message text point at?
 *
 * A candidate is "named" if a distinctive token of its own appears in the
 * message. Returns every candidate that matches — TWO matches (both Johnsons)
 * is not a resolution, it's a narrower question, and the caller asks between
 * exactly those two rather than guessing.
 */
function textMatches(text, candidates) {
  const words = new Set(norm(text).split(" ").filter(Boolean));
  if (!words.size) return [];

  return candidates.filter((c) => {
    for (const id of identifiers(c)) {
      // Street numbers and multi-char name tokens both live in `words`.
      if (words.has(id)) return true;
    }
    return false;
  });
}

/**
 * Which candidate is the photo standing on?
 *
 * Nearest site within the on-site radius, AND clearly nearer than the next —
 * two jobs 100m apart can't be told apart by a phone's GPS, so that case
 * declines to a null (ask) rather than a coin-flip.
 *
 * @returns { candidate, km } or null
 */
function gpsMatch(point, candidates) {
  if (!hasPoint(point)) return null;

  const ranked = candidates
    .map((c) => ({ c, km: haversineKm(point, { lat: c.lat, lng: c.lng }) }))
    .filter((r) => r.km != null)
    .sort((a, b) => a.km - b.km);

  if (!ranked.length) return null;
  const [best, next] = ranked;
  if (best.km > GPS_ONSITE_KM) return null; // not on any site
  // Well-separated? If there's a runner-up, the best must be clearly closer.
  if (next && best.km * GPS_SEPARATION > next.km) return null;
  return { candidate: best.c, km: best.km };
}

/**
 * The decision.
 *
 * @param {Array}  candidates  the sender's plausible jobs — already narrowed by
 *                             the caller to their scheduled work for the day.
 *                             Each: { jobId, jobTitle, clientName, address, lat, lng }
 * @param {string} text        the message body (may be empty — a bare photo)
 * @param {object} point       { lat, lng } from photo EXIF, or null
 * @returns {{
 *   jobId: string|null,
 *   confidence: "high"|"none",
 *   reason: string,
 *   method: "explicit"|"gps"|"only-one"|"ask"|"none",
 *   needsConfirmation: boolean,
 *   candidates: Array   // whom to ask between, when confirmation is needed
 * }}
 */
export function attributeMessage({ candidates = [], text = "", point = null } = {}) {
  const list = Array.isArray(candidates) ? candidates.filter((c) => c && c.jobId) : [];

  if (list.length === 0) {
    return {
      jobId: null,
      confidence: "none",
      reason: "No job is on this person's schedule to file against.",
      method: "none",
      needsConfirmation: false,
      candidates: [],
    };
  }

  // ── 1. Explicit text ──────────────────────────────────────────────────────
  // A named job wins even when several are scheduled — the crew told us which.
  // But two names matched is a narrower question, not an answer.
  const named = textMatches(text, list);
  if (named.length === 1) {
    return {
      jobId: named[0].jobId,
      confidence: "high",
      reason: `The message names ${named[0].clientName || named[0].jobTitle || "this job"}.`,
      method: "explicit",
      needsConfirmation: false,
      candidates: [],
    };
  }
  if (named.length > 1) {
    return {
      jobId: null,
      confidence: "none",
      reason: "The message could be either of these jobs.",
      method: "ask",
      needsConfirmation: true,
      candidates: named,
    };
  }

  // ── 2. GPS ────────────────────────────────────────────────────────────────
  const gps = gpsMatch(point, list);
  if (gps) {
    return {
      jobId: gps.candidate.jobId,
      confidence: "high",
      reason: `The photo was taken at ${gps.candidate.clientName || gps.candidate.address || "this site"}.`,
      method: "gps",
      needsConfirmation: false,
      candidates: [],
    };
  }

  // ── 3. Only one place they could be ───────────────────────────────────────
  if (list.length === 1) {
    return {
      jobId: list[0].jobId,
      confidence: "high",
      reason: `It's the only job on their schedule right now.`,
      method: "only-one",
      needsConfirmation: false,
      candidates: [],
    };
  }

  // ── 4. Ask ────────────────────────────────────────────────────────────────
  // Several possible jobs and nothing to choose between them. This is the case
  // the whole file exists to handle correctly: don't pick, ask.
  return {
    jobId: null,
    confidence: "none",
    reason: "They're on more than one job today — which one is this?",
    method: "ask",
    needsConfirmation: true,
    candidates: list,
  };
}
