// lib/receipts/prefill.js
//
// What a scanned receipt is allowed to write, and what it must leave alone.
//
// ══ One rule ═══════════════════════════════════════════════════════════════
//
// A person typing a cost outranks a model reading a photo. PREFILL, never
// replace.
//
// The target is JobMaterial — chosen because its own schema comment already
// asks for this ("`actualCost` is what the receipt said") and because
// `actualCost`, `supplier` and `purchasedAt` all exist, so nothing here needs a
// new column. `Expense` has no attachment column at all; see
// docs/construction/AUDIT-port-candidates.md.
//
// ══ Why this is a function and not an `if` in the route ════════════════════
//
// Because it has to hold in two places at once and they must not drift. The
// browser needs it to decide whether to show a field pre-filled or leave what
// the user typed; the ROUTE needs it because a browser that sends a cost for a
// line that already has one must be refused, not obeyed. Two copies of this
// rule is one copy that eventually stops matching — AGENTS.md failure class #4
// — so both sides call this.
//
// Pure. No imports, no database.

/**
 * The four fields a receipt may fill in on a JobMaterial.
 *
 * `actualQty` joined the list with the close-out calibration: a receipt that
 * prints "QTY 3" beside the one thing it was scanned against already answers
 * "how many did you buy", and throwing that away meant typing it a second
 * time. It is offered under exactly the same rule as the cost — never over a
 * number a person entered.
 */
export const PREFILLABLE = ["actualCost", "supplier", "purchasedAt", "actualQty"];

/**
 * The quantity a receipt suggests for the ONE line it was scanned against.
 *
 * Only when the receipt has exactly one priced line and that line prints a
 * plain positive number as its quantity. A two-line receipt — tape and a
 * roller — cannot say which quantity belongs to the line being ticked, and
 * guessing the first would be inventing a figure; null means "nothing to
 * offer", and the box stays at whatever the estimate said. "3 x" and "3 EA"
 * are read; "3.5 kg" is not a count of rolls and is left alone.
 */
export function suggestedQuantity(receipt) {
  const items = Array.isArray(receipt?.items) ? receipt.items : [];
  if (items.length !== 1) return null;
  const raw = String(items[0]?.quantity ?? "").trim();
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*(?:x|ea|each|pcs?|units?)?\.?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Has a person already stated this field?
 *
 * `null` and `""` are not statements — they are the absence of one, which is
 * exactly what a prefill is for. Zero IS a statement: somebody who typed 0.00
 * is saying this line was free (a warranty replacement, an offcut), and a
 * receipt must not overwrite that.
 */
export function isConfirmed(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

/**
 * Merge an extraction into an existing row, without ever overwriting.
 *
 * @param existing  the JobMaterial as stored: { actualCost, supplier, purchasedAt }
 * @param suggested what the scan produced, same keys. Any key may be null.
 *
 * @returns {{
 *   values: object,       what to show / what to write — existing values kept
 *   filled: string[],     fields the scan supplied that were empty
 *   kept: string[],       fields the scan had a value for and was REFUSED
 *   offered: object       what the scan wanted, for "use this instead?" copy
 * }}
 *
 * `kept` is returned rather than swallowed so the screen can say "you already
 * entered $412.90; the receipt reads $409.55" and let a person choose. Silently
 * discarding the scan's figure would be as dishonest as silently applying it.
 */
export function prefillMaterial(existing = {}, suggested = {}) {
  const values = {};
  const filled = [];
  const kept = [];
  const offered = {};

  for (const key of PREFILLABLE) {
    const current = existing?.[key] ?? null;
    const proposed = suggested?.[key] ?? null;

    if (isConfirmed(current)) {
      values[key] = current;
      if (isConfirmed(proposed)) {
        kept.push(key);
        offered[key] = proposed;
      }
      continue;
    }

    if (isConfirmed(proposed)) {
      values[key] = proposed;
      filled.push(key);
      offered[key] = proposed;
    } else {
      values[key] = current;
    }
  }

  return { values, filled, kept, offered };
}

/**
 * The server-side half: strip anything a caller is trying to overwrite.
 *
 * A route calls this with what the browser POSTed and what the row already
 * holds. Fields the row has already stated come back in `refused`, and the
 * route answers with them named rather than writing them — the same posture
 * app/api/jobs/[id]/materials/route.js already takes with a cost posted by
 * somebody who may not see costs: refused out loud, never dropped in silence.
 */
export function refuseOverwrites({ existing = {}, incoming = {}, source = "receipt" } = {}) {
  const write = {};
  const refused = [];

  for (const key of PREFILLABLE) {
    if (!Object.hasOwn(incoming, key)) continue;
    const proposed = incoming[key];
    if (!isConfirmed(proposed)) continue;

    if (isConfirmed(existing?.[key])) {
      refused.push(key);
      continue;
    }
    write[key] = proposed;
  }

  return {
    write,
    refused,
    error: refused.length
      ? `Someone has already entered ${refused.join(" and ")} on this line. A ${source} never replaces a figure a person typed — clear it first if you want the scanned one.`
      : null,
  };
}
