// lib/estimate/instantQuoteProvision.js
//
// "The instant quote is the reflection of pricing and offering in Services."
//
// It wasn't. Switching a service on under Settings › Services created nothing
// here, so the instant-quote screen compared the two lists and told the owner
// they disagreed:
//
//   "Your instant quotes and your services don't match.
//    You sell Roofing and can quote it instantly, but you never set it up."
//
// That is a true sentence and a bad screen. It hands a contractor a
// reconciliation chore between two lists FieldQuo already holds, and the fix it
// suggests — go to Services, come back, find the card, switch it on — is four
// steps to restate something he already said by selling the trade.
//
// ── What this does instead, and the line it will not cross ─────────────────
//
// A service the company sells, whose estimator this build ships, and whose
// price this company has STATED IN THEIR OWN RATE CARD, publishes its instant
// quote by itself. No second screen, no confirmation.
//
// A service whose price they have NOT stated does not. Nothing is created for
// it, nothing is published, and no figure is invented. That is non-negotiable
// #4 and failure class #5 in AGENTS.md: absence of a statement is not a
// statement, and a homeowner must never be quoted a number the contractor
// never chose. The screen says which price is missing and links to the box.
//
// ── How "their own price" is decided, precisely ────────────────────────────
//
// `deriveInstantSeed` reads the company's price book, which is THEIR saved
// rates merged over FIELDQUO'S reference book. So a derivation always returns
// numbers — the question is whose. The test is a comparison against
// `defaultDerivedSeed`, the same derivation run over the reference book alone:
//
//   derived === reference  →  the company has stated nothing that moves this
//                             price. Publishing it would publish OUR rate card
//                             under their name. Refuse.
//   derived !== reference  →  the numbers that price this job came from them.
//                             Publish.
//
// A company whose real rate happens to equal the reference figure exactly is
// refused too, and has to press the switch once. That is the safe direction to
// be wrong in: the cost of a false refusal is one click, and the cost of a
// false publish is a stranger holding a quote at a price nobody set.
//
// ── Why nothing here ever turns a card OFF ─────────────────────────────────
//
// Same reason lib/trades/catalog.js reports and does not repair: a row the
// company saved is their decision. This only ever CREATES a row for a trade
// that has none, which is the one state that means "never considered". A
// disabled row, a differently-priced row and a row whose rates went stale are
// all untouched.

import { instantQuoteReadiness } from "@/lib/estimate/instantQuoteReadiness";
import { defaultDerivedSeed } from "@/lib/estimate/instantSeed";

/**
 * Order-independent structural comparison.
 *
 * `JSON.stringify` would nearly work — both sides come out of the same
 * `derive()` and so carry the same key order — but "nearly" is how a
 * publish-prices decision should not be made. Sorting the keys costs nothing
 * on objects this size and removes the question.
 */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Did the numbers in this derivation come from the company, or from us?
 *
 * @param trade    estimator key
 * @param derived  deriveInstantSeed(trade, seedInputsFor(trade, theirRows))
 * @returns true only when the company's own rate card moved the figure.
 */
export function seedIsCompanyStated(trade, derived) {
  if (!derived) return false;
  const reference = defaultDerivedSeed(trade);
  // No reference derivation exists for this trade, yet a derivation was
  // produced: there is nothing of ours in it to mistake for theirs.
  if (!reference) return true;
  return stable(derived) !== stable(reference);
}

/**
 * Should this trade's instant quote be created and switched on, unasked?
 *
 * Pure, and deliberately conjunctive — every clause is a separate reason to
 * refuse, and the caller gets the reason so a screen can say it.
 *
 * @param trade             estimator key
 * @param offeredAsService  is one of the trade's catalogue categories enabled?
 * @param hasSavedRow       does an InstantQuoteConfig row already exist?
 * @param config            the config that would be saved (seed + derivation)
 * @param derived           the derivation, or null when no price book states it
 *
 * @returns {{ enable: boolean, reason: string }}
 *   reason is one of:
 *     not_offered      they don't sell it
 *     already_decided  a row exists — theirs, untouched
 *     no_config        this build ships no seed for the trade
 *     no_own_price     nothing of theirs prices it (the honest ask)
 *     <readiness code> their price is stated but does not produce a number
 *     ready            enable
 */
export function planInstantAutoEnable(candidate) {
  // Not a destructuring default: that only covers `undefined`, and this runs
  // over whatever the settings route built. A null must refuse, not throw.
  const { trade, offeredAsService, hasSavedRow, config, derived } =
    candidate && typeof candidate === "object" ? candidate : {};

  if (!offeredAsService) return { enable: false, reason: "not_offered" };
  if (hasSavedRow) return { enable: false, reason: "already_decided" };
  if (!config) return { enable: false, reason: "no_config" };
  if (!seedIsCompanyStated(trade, derived)) {
    return { enable: false, reason: "no_own_price" };
  }

  // Last, and never skipped: the shipped pricer has to produce a number from
  // this exact config. `instantQuoteReadiness` dry-runs the real estimator, so
  // passing here means the public route can keep the promise this switch makes.
  const readiness = instantQuoteReadiness(trade, config);
  if (!readiness.ok) return { enable: false, reason: readiness.code || "not_ready" };

  return { enable: true, reason: "ready" };
}

/**
 * The whole pass. Feed it what the settings route already computed per trade;
 * get back the rows to create.
 *
 * @param candidates [{ trade, offeredAsService, hasSavedRow, config, derived }]
 * @returns [{ trade, config }] — every one of them to be created ENABLED.
 */
export function instantAutoEnablePlan(candidates = []) {
  const out = [];
  for (const c of Array.isArray(candidates) ? candidates : []) {
    if (!c || typeof c !== "object") continue;
    const plan = planInstantAutoEnable(c);
    if (plan.enable) out.push({ trade: c.trade, config: c.config });
  }
  return out;
}
