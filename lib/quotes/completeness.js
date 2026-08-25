// lib/quotes/completeness.js
//
// What is missing from a quote, worked out WITHOUT a model and without a
// database.
//
// ── Why this is its own file ────────────────────────────────────────────────
//
// These checks lived inside lib/ai/quoteReview.js, which imports the Prisma
// client and the model provider. That made them unreachable from the builder:
// importing them client-side would have dragged Prisma into the browser
// bundle. So the only way to learn a quote had no expiry date was to save it
// and spend a model call — on a question that is a null check.
//
// Split out, the same rules run live while somebody types, for nothing. The
// AI half stays where it was and still owns the judgement calls it is actually
// good at: whether the price fits this company's own history, and which add-ons
// this client is likely to want.
//
// PURE. No clock, no I/O. Give it a quote-shaped object and it returns what is
// missing — which is why the builder can run it on an unsaved draft and the
// server can run it on a stored row and get the same answer.

import { countMediaKinds } from "@/lib/media/validate";

const num = (v) => Number(v ?? 0);

// Line descriptions a client cannot judge. "Labour — $2,400" tells somebody
// nothing about what they are buying, so they fall back to comparing the only
// thing they understand, which is the total.
const VAGUE_PATTERNS =
  /^(labou?r|materials?|misc\.?|miscellaneous|parts|supplies|work|service|job|other|extras?|sundries|allowance)\b/i;

/**
 * @param quote  { validUntil, processNotes, clientPhotos, discount, subtotal,
 *                 scopeGroups, client } — a saved row OR an unsaved draft.
 * @param items  every line item across the scope groups.
 * @returns [{ id, severity, title, detail }]
 */
export function completenessChecks(quote, items) {
  const checks = [];

  const add = (id, severity, title, detail) =>
    checks.push({ id, severity, title, detail });

  if (!quote.validUntil) {
    add(
      "no_expiry",
      "high",
      "No expiry date",
      "A quote that never expires is a quote with no reason to answer today. Two to four weeks is normal, and it also protects you when material prices move.",
    );
  } else if (new Date(quote.validUntil) < new Date()) {
    add(
      "expired",
      "high",
      "Already expired",
      "The valid-until date has passed. The client can't approve this — push the date out before sending.",
    );
  }

  if (!quote.client?.email) {
    add(
      "no_client_email",
      "high",
      "Client has no email address",
      "Without one there's nothing to send the approval link to, and no record of when they opened it.",
    );
  }

  if (items.length === 0) {
    add(
      "no_items",
      "high",
      "No line items",
      "There's nothing here to price. Add the work before sending.",
    );
  } else if (items.length === 1) {
    add(
      "single_line",
      "medium",
      "The whole job is one line",
      "A single figure invites haggling over the figure. Broken into three or four lines, the conversation becomes which parts to keep — a much better conversation to be having.",
    );
  }

  const vague = items.filter(
    (li) =>
      VAGUE_PATTERNS.test((li.description || "").trim()) ||
      (li.description || "").trim().length < 12,
  );
  if (vague.length) {
    add(
      "vague_items",
      "medium",
      `${vague.length} line${vague.length > 1 ? "s" : ""} the client won't understand`,
      `${vague.map((v) => `"${v.description}"`).join(", ")} — a client can't judge whether that's good value, so they judge on price alone.`,
    );
  }

  if (!quote.processNotes?.trim()) {
    add(
      "no_process",
      "medium",
      "Nothing about what happens next",
      "Timeline, site access, payment schedule, warranty, who to call. This is the most common reason a fairly-priced quote goes unanswered — the price was fine, they just didn't know what they were agreeing to.",
    );
  }

  // Counted by kind rather than by array length. `clientPhotos` can now hold a
  // client's PDF plan, and a plan is not a photo of the job: a quote carrying
  // only a plan still has nothing showing the estimator stood in the room, which
  // is exactly what this advice is about. Counting length would have seen one
  // entry, decided there were photos, and silently withheld the advice from the
  // quotes most likely to need it.
  const { visual: siteMediaCount } = countMediaKinds(quote.clientPhotos);
  if (siteMediaCount === 0) {
    add(
      "no_photos",
      "low",
      "No photos",
      "A photo of the actual job shows you were there and looked properly. Optional, but it separates you from whoever quoted over the phone.",
    );
  }

  if (num(quote.discount) > num(quote.subtotal) * 0.2) {
    add(
      "deep_discount",
      "medium",
      "Discount is over 20%",
      "A discount that large reads as either a padded starting price or desperation. Consider dropping scope instead, so the price reflects the work.",
    );
  }

  return checks;
}

/**
 * The checks as a single readable state, for a live indicator.
 *
 * Deliberately NOT a percentage or a mark out of ten. A quote is not 73% good,
 * and a number invites gaming the number — somebody adding a photo to move a
 * score rather than because the job needed one. What a person can act on is
 * "two things worth fixing before this goes out", so that is what this says.
 *
 * `ready` means nothing HIGH or MEDIUM is outstanding. Low-severity notes stay
 * visible and never block: a quote with no photos is worse, not wrong.
 */
export function completenessSummary(checks = []) {
  const list = Array.isArray(checks) ? checks.filter(Boolean) : [];
  const bySeverity = (s) => list.filter((c) => c.severity === s).length;
  const high = bySeverity("high");
  const medium = bySeverity("medium");
  return {
    checks: list,
    high,
    medium,
    low: bySeverity("low"),
    blocking: high + medium,
    ready: high + medium === 0,
  };
}
