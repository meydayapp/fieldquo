// lib/ai/topupOffer.js
//
// Turning "you are $0.34 short" into an offer somebody can accept — the pure
// half of the in-place AI top-up.
//
// ══ Why the browser is never told a price, only a tier id ══════════════════
//
// AGENTS.md non-negotiable #5: the browser never sends money amounts. The
// existing settings screen posts `{ cents }` because a person typed a figure
// into a box on a page whose whole subject is "how much do you want to buy",
// and the server clamps it. THIS surface is different: a refusal dialog that
// pops up over a canvas, offering a preselected amount. There is nothing for a
// person to type, so there is nothing to clamp — which means the honest shape
// is a closed list of ids, priced server-side, and a POST that REFUSES a body
// carrying an amount at all rather than quietly ignoring it. A parameter that
// is accepted and ignored is indistinguishable from one that is accepted and
// used, to everyone except the person reading this file.
//
// So `publicTopupOffer` deliberately does not include `cents` in what it hands
// the browser. The label ("$20") is what a person reads; the id is what comes
// back; `tierCentsFor` is the only thing that turns an id into money, and it
// runs on the server. Sending cents down would work perfectly today and would
// be the first line of the diff that starts sending it back up.
//
// ══ One price list ═════════════════════════════════════════════════════════
//
// The tiers are DERIVED from lib/voice/credits.js's TOPUP_OPTIONS rather than
// re-typed here. The same four amounts appear on the AI credit settings page,
// on the voice credit page, and in the automatic top-up terms; a fifth copy is
// the one that would rot. Ids are derived from the amount for the same reason
// — a hand-written id map is a second thing to keep in step.
import { TOPUP_OPTIONS } from "@/lib/voice/credits";

/**
 * The closed list. `id` is stable across deploys because it is derived from
 * the amount, so a dialog opened before a deploy and confirmed after it still
 * names a tier the server recognises — or, if the amount was removed, is
 * refused outright rather than silently resolved to a neighbour.
 */
export const AI_TOPUP_TIERS = TOPUP_OPTIONS.map((t) => ({
  id: `topup_${t.cents}`,
  cents: t.cents,
  label: t.label,
}));

/**
 * What a tier id costs, or null.
 *
 * Null is a refusal and never a default. Falling back to the smallest tier on
 * an unrecognised id would charge a card for something nobody chose.
 */
export function tierCentsFor(id) {
  const tier = AI_TOPUP_TIERS.find((t) => t.id === id);
  return tier ? tier.cents : null;
}

/**
 * The smallest tier that actually covers the shortfall.
 *
 * "Never less than enough" is the whole point: offering $10 against a $12
 * shortfall produces a payment, a redirect, and a button that is still
 * disabled — which reads as the top-up having failed. When the shortfall
 * exceeds every tier, the LARGEST is offered and `covers` is false on it, so
 * the dialog can say so instead of implying one payment will do it.
 */
export function recommendedTierId(shortfallCents) {
  const need = Math.max(0, Math.round(Number(shortfallCents) || 0));
  const sorted = [...AI_TOPUP_TIERS].sort((a, b) => a.cents - b.cents);
  const enough = sorted.find((t) => t.cents >= need);
  return (enough || sorted[sorted.length - 1]).id;
}

/**
 * Everything the dialog needs, and nothing it could send back as money.
 *
 * @param {number} shortfallCents  how far short the balance is, from
 *                                 lib/voice/spendGate.js. Zero means nothing
 *                                 is short and the caller should not be
 *                                 opening a dialog at all.
 * @param {boolean} canBuy         may THIS member buy credit — see
 *                                 lib/permissions.js's "user:manage". A crew
 *                                 member can be inside the designer and
 *                                 unable to purchase; the dialog has to say
 *                                 "ask an owner" rather than render a button
 *                                 that 403s.
 * @returns {{ tiers: Array<{id: string, label: string, covers: boolean}>,
 *             recommendedId: string, canBuy: boolean }}
 */
export function publicTopupOffer(shortfallCents, canBuy = false) {
  const need = Math.max(0, Math.round(Number(shortfallCents) || 0));
  return {
    tiers: AI_TOPUP_TIERS.map((t) => ({
      id: t.id,
      label: t.label,
      covers: t.cents >= need,
    })),
    recommendedId: recommendedTierId(need),
    canBuy: Boolean(canBuy),
  };
}

/**
 * Does this request body try to name its own price?
 *
 * Checked as a PRESENCE test on the key, not a truthiness test on the value:
 * `{ cents: 0 }` and `{ cents: null }` are both somebody's serialiser sending
 * an amount, and the point is to refuse the shape rather than to sanitise it.
 * The alternative — ignore it — leaves a route whose contract nobody can read
 * off the wire.
 */
export function bodyNamesAnAmount(body) {
  if (!body || typeof body !== "object") return false;
  return ["cents", "amount", "amountCents", "unit_amount", "price"].some((k) =>
    Object.prototype.hasOwnProperty.call(body, k),
  );
}

/**
 * Where Stripe is allowed to send them back to.
 *
 * The dialog supplies this so a contractor lands back on the design they were
 * working on rather than on a settings page with their canvas behind them.
 * That makes it an open-redirect parameter, so it is validated as an ALLOW
 * list rather than sanitised: a path under /app/, made of characters a Next
 * route segment can contain, with no query, no fragment, no scheme, no
 * protocol-relative "//host", no "..". Anything else returns null and the
 * caller falls back to the AI credit page — which is a worse landing than the
 * canvas, and a much better one than an attacker's domain.
 *
 * @returns {string|null}
 */
export function safeReturnPath(value) {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path || path.length > 200) return null;
  if (!path.startsWith("/app/")) return null;
  // Rejects "//evil.com" (protocol-relative), "/app/..%2f", backslashes, and
  // anything carrying its own query or fragment — this function's caller
  // appends the session id itself and must be the only thing doing so.
  if (!/^\/app\/[A-Za-z0-9\-_/]*$/.test(path)) return null;
  if (path.includes("//")) return null;
  return path;
}
