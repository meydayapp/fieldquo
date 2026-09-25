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
import { resolveServiceContent } from "@/lib/documents/serviceContent";
import { gutterFlags } from "@/lib/measure/gutterMeasurement";
import { unfinishedTemplateLines } from "@/lib/quotes/serviceTemplateLines";

/**
 * The scope paragraph the client reads under a service's name, or "" when
 * there is none. Two shapes, one answer: the builder's draft group carries
 * `categoryKey` + `override` (what the company saved in Settings → Services),
 * the stored row carries `category.key` + `category.companySettings[0]`.
 * Same resolver the PDF and the client page use, so this judges the document
 * the client actually gets rather than a guess about it. Pure — serviceContent
 * is data and string work, which is why ScopeGroupCard already imports it
 * client-side.
 */
/**
 * Does the document print more than a name and a number around this one
 * line? True when the line's service card carries a scope paragraph, an
 * inclusions list or process steps (lib/documents/serviceContent.js), or the
 * line's own detail says what is done. Legacy quotes with no groups are
 * judged by the line's detail alone — there is no card to carry them.
 */
function singleLineIsCarried(quote, line) {
  if ((line?.detail || "").trim().length >= 12) return true;
  const groups = Array.isArray(quote?.scopeGroups) ? quote.scopeGroups : [];
  const group =
    groups.find((g) => Array.isArray(g.lineItems) && g.lineItems.includes(line)) ||
    (groups.length === 1 ? groups[0] : null);
  if (!group) return false;
  const key = group?.category?.key || group?.categoryKey || null;
  const override = group?.category?.companySettings?.[0] || group?.override || null;
  // The trade's own paragraph, or inclusions / process steps the company
  // wrote for it. The catalogue's GENERIC inclusions and steps print on any
  // card as a fallback and deliberately do not count — they are not about
  // this job, and a made-up trade with only those under it is still one line.
  const content = resolveServiceContent(key, override, group?.takeoff || null);
  const own = (v) => Array.isArray(v) && v.some((x) => String(x?.text ?? x ?? "").trim());
  return Boolean(
    (content.description || "").trim() || own(override?.includedItems) || own(override?.processSteps),
  );
}

function groupScopeParagraph(group) {
  const key = group?.category?.key || group?.categoryKey || null;
  const override = group?.category?.companySettings?.[0] || group?.override || null;
  return resolveServiceContent(key, override, group?.takeoff || null).description || "";
}

const num = (v) => Number(v ?? 0);

// Line descriptions a client cannot judge. "Labour — $2,400" tells somebody
// nothing about what they are buying, so they fall back to comparing the only
// thing they understand, which is the total.
// Exported so the invoice's own checks (lib/invoices/completeness.js) judge a
// line by the same words — an invoice mirrors the quote, and so must what is
// said about its lines.
export const VAGUE_PATTERNS =
  /^(labou?r|materials?|misc\.?|miscellaneous|parts|supplies|work|service|job|other|extras?|sundries|allowance)\b/i;

/**
 * @param quote  { validUntil, processNotes, clientPhotos, discount, subtotal,
 *                 scopeGroups, client } — a saved row OR an unsaved draft.
 * @param items  every line item across the scope groups.
 * @returns [{ id, severity, title, detail }]
 */
/**
 * The "what happens next" text the client will actually see: the quote's own
 * words, else the company's default. The ONE definition — the document route
 * resolves it the same way and says so, and scripts/check-addon-descriptions
 * holds the two together.
 *
 * `defaultProcessNotes` on the quote object, or `company.defaultProcessNotes`
 * when the caller loaded the relation. Both spellings, because the builder
 * has a flat bootstrap and the server has a Prisma row, and making either one
 * reshape itself for this check would be the copy that rots.
 */
export function effectiveProcessNotes(quote) {
  const own = quote?.processNotes?.trim();
  if (own) return own;
  const fallback = (quote?.defaultProcessNotes ?? quote?.company?.defaultProcessNotes)?.trim();
  return fallback || "";
}

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
  } else if (items.length === 1 && !singleLineIsCarried(quote, items[0])) {
    // Judged the way the CLIENT reads the document, like the bare-line rule
    // below. One line item under a service card that prints its scope
    // paragraph, its "what's included" list and the numbered process steps
    // is not "one line" to the homeowner — they read a page. The owner, on
    // seeing this fire on exactly such a quote: "I'm assuming it was not
    // reading the process and all the information the client gets." Only a
    // lone line with nothing printed around it is a single figure.
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

  // Lines with nothing under the name — judged the way the CLIENT reads the
  // document, not line by line. A service card prints its scope paragraph
  // and "what's included" list under the name (lib/documents/serviceContent
  // .js); "Cabinet Refinishing" over the paragraph that says the doors are
  // degreased, sanded, primed and sprayed is a clear line, and this check
  // used to flag it anyway because it only ever looked at the line's own
  // `detail`. The owner: "it should see the quote in a holistic way". So a
  // bare line inside a group that carries a scope paragraph is fine; only a
  // bare line with NO paragraph above it — a custom group, or a category the
  // catalogue has no wording for — leaves the client with just a name. Legacy
  // quotes with lineItems but no groups are judged the old way, because
  // there is no paragraph anywhere to carry them.
  const groups = Array.isArray(quote.scopeGroups) ? quote.scopeGroups : [];
  const grouped = new Set(groups.flatMap((g) => (Array.isArray(g.lineItems) ? g.lineItems : [])));
  const uncovered = groups
    .filter((g) => !groupScopeParagraph(g).trim())
    .flatMap((g) => (Array.isArray(g.lineItems) ? g.lineItems : []))
    .concat(items.filter((li) => !grouped.has(li)));
  const bare = uncovered.filter(
    (li) => (li.description || "").trim() && !(li.detail || "").trim(),
  );
  if (bare.length) {
    const named = bare.slice(0, 3).map((v) => `"${v.description}"`).join(", ");
    add(
      "no_detail",
      "low",
      `${bare.length} line${bare.length > 1 ? "s have" : " has"} no description`,
      `${named}${bare.length > 3 ? ` and ${bare.length - 3} more` : ""} — only the name reaches the client, and there is no scope paragraph above it to say what is done. A sentence on what is done, per what unit, is what they judge the price against.`,
    );
  }

  // ── What the CLIENT will read, not what this row stores ────────────────
  //
  // app/api/quotes/[id]/document/route.js prints
  // `quote.processNotes || company.defaultProcessNotes`, and the invoice
  // document does the same — so a company that wrote its wording once in
  // Settings has a "what happens next" section on every quote whether or not
  // the quote's own column was filled in. This check read the column alone
  // and told those companies, on every single quote, that they had said
  // nothing about what happens next. It was reading the storage; the advice
  // is about the document.
  //
  // `defaultProcessNotes` is passed beside the quote by every caller (the
  // builder from its bootstrap, the AI review from the company relation);
  // absent, this is exactly the old behaviour, so a company that has written
  // no default is still told — which is the case the advice was written for.
  if (!effectiveProcessNotes(quote)) {
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

  // ── A gutter run measured from the sky ───────────────────────────────
  //
  // The gutter takeoff can be filled from Google's roof model, and the
  // measurement panel writes what it doubted onto the takeoff: a run under
  // 40 ft, a pin off the building, imagery older than five years. The panel
  // shows those once, to whoever clicked. This is the second reading — at
  // review time, on the stored row — so a quote that went out with "7 ft of
  // gutter" on it is caught by the reviewer and not by the homeowner.
  //
  // Two sources, deliberately: the flags the panel STORED, plus a fresh
  // judgement of the numbers as they are NOW. The stored list catches what
  // the API said (stale imagery, a street pin) that the numbers alone cannot;
  // the fresh pass catches a run somebody typed over into nonsense — 6
  // downspouts on 60 ft — which a stored list from before the edit would not.
  for (const g of groups) {
    const key = g?.category?.key || g?.categoryKey || null;
    if (key !== "gutter_services") continue;
    const takeoff = g?.takeoff && typeof g.takeoff === "object" ? g.takeoff : null;
    if (!takeoff || takeoff.measuredFrom !== "satellite") continue;
    const stored = Array.isArray(takeoff.measuredFlags) ? takeoff.measuredFlags : [];
    const fresh = gutterFlags({
      gutterFt: takeoff.gutterFt,
      downspouts: Math.max(num(takeoff.downspoutsInstalled), num(takeoff.downspoutsFlushed)),
      imageryDate: takeoff.measuredImagery?.year ? { year: takeoff.measuredImagery.year } : null,
      imageryQuality: takeoff.measuredImagery?.quality || null,
    }).flags;
    const seen = new Set();
    const flags = [...stored, ...fresh].filter((f) => {
      if (!f?.code || seen.has(f.code)) return false;
      seen.add(f.code);
      return true;
    });
    if (!flags.length) continue;
    const severe = flags.some((f) => f.severe);
    add(
      "gutter_measure_flagged",
      severe ? "high" : "medium",
      severe
        ? "The satellite gutter measurement does not look like a house"
        : "The satellite gutter measurement carries a caveat",
      flags.map((f) => f.text).join(" ") +
        (severe ? " Book an on-site measure before this goes out." : " Say so on the visit, or measure on site."),
    );
  }

  // ── A service template expanded with a measurement still missing ─────
  //
  // "Add with its template lines" (lib/quotes/serviceTemplateLines.js) opens
  // a measured line whose figure the quote does not hold at quantity 0 —
  // never at the template's fallback of 1 sq ft — and a line the template
  // had no price for at $0. Both are honest on the builder and wrong on a
  // client's document, so they are named here until somebody fills them.
  const unfinished = unfinishedTemplateLines(items);
  if (unfinished.length) {
    const named = unfinished.slice(0, 3).map((v) => `"${v.description}"`).join(", ");
    add(
      "template_lines_unfinished",
      "high",
      `${unfinished.length} template line${unfinished.length > 1 ? "s are" : " is"} still at $0`,
      `${named}${unfinished.length > 3 ? ` and ${unfinished.length - 3} more` : ""} — added from a service template without a measurement or a price. Measure it, type the quantity or the rate, or remove the line before this goes out.`,
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
