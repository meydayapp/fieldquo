// lib/invoices/labourLine.js
//
// "Labour — 6.5 h × $85 · from today's clock-ins": the invoice line built
// from a job's TimeEntry rows.
//
// ── The browser never prices this ─────────────────────────────────────────
//
// The request carries `{ timeEntryIds, rateKey }` and nothing else. Hours are
// read off the entries the server loads; the rate is read off the company's
// own setting or price book (lib/invoices/labourRates.js). AGENTS.md
// non-negotiable #5 is about client-facing surfaces, and this is the
// contractor's own editor — but the offline queue replays this request hours
// after it was composed, from a phone whose cached rate may be stale, and a
// replayed amount is exactly the "money decided on the phone" the mockup says
// must not happen. So the server reprices at replay, always.
//
// Pure, so scripts/check-offline-invoicing.mjs can run it against hostile
// rows: open entries, negative hours, an entry already billed, a rate of 0.

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Which of a job's entries may be billed, and why the rest may not.
 *
 * Only CLOSED entries with finite booked hours count: an open entry's hours
 * are still moving, and billing a running clock puts a number on an invoice
 * that the clock-out will contradict. Already-billed entries are excluded so
 * two invoices for one job cannot both carry the same afternoon.
 *
 * @param {Array<{id, clockIn, clockOut, hours, status, billedInvoiceId, worker?:{name}}>} entries
 * @returns {{ billable: object[], skipped: Array<{id, reason}> }}
 */
export function partitionBillable(entries) {
  const billable = [];
  const skipped = [];
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || typeof e.id !== "string") continue;
    if (!e.clockOut) {
      skipped.push({ id: e.id, reason: "open" });
      continue;
    }
    if (e.billedInvoiceId) {
      skipped.push({ id: e.id, reason: "billed" });
      continue;
    }
    const hours = Number(e.hours);
    if (!Number.isFinite(hours) || hours <= 0) {
      skipped.push({ id: e.id, reason: "no_hours" });
      continue;
    }
    if (e.status === "rejected") {
      skipped.push({ id: e.id, reason: "rejected" });
      continue;
    }
    billable.push({ ...e, hours: round2(hours) });
  }
  return { billable, skipped };
}

/** Total billable hours, to two decimals — never NaN. */
export function sumHours(entries) {
  const { billable } = partitionBillable(entries);
  return round2(billable.reduce((s, e) => s + e.hours, 0));
}

/** "Marco 4.0 h · Dani 2.5 h" — per-person breakdown, in entry order. */
export function hoursByWorker(entries) {
  const { billable } = partitionBillable(entries);
  const map = new Map();
  for (const e of billable) {
    const name = e.worker?.name || e.workerName || "—";
    map.set(name, round2((map.get(name) || 0) + e.hours));
  }
  return [...map.entries()].map(([name, hours]) => ({ name, hours }));
}

/**
 * Build the line. Returns null — never a $0 line — when there is nothing to
 * bill or no usable rate, so a caller that forgets to check cannot append an
 * empty labour line to an invoice.
 *
 * @param {object} p
 * @param {object[]} p.entries   the rows the server loaded for the ids posted
 * @param {number}   p.rate      the sell rate the server resolved from rateKey
 * @param {string}   p.rateKey   recorded on the line so the office can see
 *                               where the price came from
 * @param {string}   [p.label]   the localised "Labour" word
 * @param {string}   [p.sourceNote] the localised "from clock-ins on <date>" note
 * @returns {null | { description, quantity, unit, rate, amount, labour: { timeEntryIds, rateKey, hours } }}
 */
export function buildLabourLine({ entries, rate, rateKey, label = "Labour", sourceNote = "" }) {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return null;
  const { billable } = partitionBillable(entries);
  if (!billable.length) return null;
  const hours = round2(billable.reduce((s, e) => s + e.hours, 0));
  if (hours <= 0) return null;
  const amount = round2(hours * r);
  const description = `${label} — ${hours} h × ${formatRate(r)}${sourceNote ? ` · ${sourceNote}` : ""}`;
  return {
    description,
    quantity: hours,
    unit: "hour",
    rate: r,
    amount,
    // The provenance travels ON the line so the office can see what it bills
    // and the idempotent replay can see it was already added.
    labour: { timeEntryIds: billable.map((e) => e.id), rateKey: String(rateKey || ""), hours },
  };
}

function formatRate(r) {
  // A bare number; the currency sign is the formatter's job on the document.
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

/**
 * Recompute an invoice's money after the server appended a line.
 *
 * The page posts subtotal/tax/total for what IT could see; once the server
 * adds a labour line those figures are stale, and re-deriving them here is
 * the only way the invoice and its lines agree. `taxRatePct` is a percentage
 * (a rate the user can see and edit), never a money amount; absent, the
 * caller resolves one from the company's tax settings.
 *
 * @returns {{ subtotal:number, tax:number, total:number }}
 */
export function retotal({ lineItems, discount = 0, taxEnabled = true, taxRatePct = 0 }) {
  const subtotal = round2(
    (Array.isArray(lineItems) ? lineItems : []).reduce((s, li) => {
      const a = Number(li?.amount);
      return s + (Number.isFinite(a) ? a : 0);
    }, 0),
  );
  const disc = Number(discount);
  const base = subtotal - (Number.isFinite(disc) && disc > 0 ? disc : 0);
  const pct = Number(taxRatePct);
  const tax = taxEnabled && Number.isFinite(pct) && pct > 0 ? round2((base * pct) / 100) : 0;
  return { subtotal, tax, total: round2(base + tax) };
}

/**
 * The shape the phone stores while offline and posts at replay. Everything
 * in it is an identifier or a text the person typed; nothing in it is a
 * price the server would trust. Asserted by the check script — a future
 * "just send the amount too" is what this exists to refuse.
 */
export function labourRequestFrom({ timeEntryIds, rateKey }) {
  const ids = Array.isArray(timeEntryIds)
    ? [...new Set(timeEntryIds.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 64))]
    : [];
  const key = typeof rateKey === "string" && /^[a-z]+(:[A-Za-z0-9_-]{1,64})?$/.test(rateKey) ? rateKey : null;
  if (!ids.length || !key) return null;
  return { timeEntryIds: ids.slice(0, 200), rateKey: key };
}
