// lib/tax/usRates.js
//
// The server side of the US rung: reads UsSalesTaxRate and hangs the row on
// the client object as `usTaxRate`, so the pure resolver — which also runs
// in the browser, inside the quote builder — never needs a database.
//
// ── Why the row rides on the client rather than being looked up in place ──
//
// resolveTaxRate() is called in three places that cannot reach Prisma: the
// quote builder's effect, the totals bar, and the client picker. It is called
// in six more that can. Rather than two resolvers, every server surface that
// hands a client to the browser (GET/POST /api/clients, the quote pages) or
// resolves tax itself (createEstimateQuote, the send gate, the invoice route)
// calls attachUsTaxRates() first, and the resolver reads `client.usTaxRate`
// wherever it runs. A client without the field — an older page, a row
// without a ZIP, a ZIP in a state the loader does not cover — resolves to the
// state floor with the sentence that says so. Tolerant by construction.
//
// ── The ZIP is read from postalCode, or from the address line ─────────────
//
// Client.postalCode is the column; the instant-quote funnel and the client
// form are being taught to fill it. Rows that predate it often carry the ZIP
// at the end of `address` ("1990 S 1st St, Austin, TX 78704"), and reading a
// five-digit group from there is a fact about the address, not a guess — it
// is what the estimator typed. Anything that is not a US five-digit ZIP is
// ignored; a Canadian postal code never reaches this table.

import { db } from "@/lib/db";
import { normaliseCountry } from "@/lib/tax/jurisdictions";

/** The five-digit ZIP a client record identifies, or null. */
export function zipFromClient(client) {
  if (!client || normaliseCountry(client.country) !== "US") return null;
  const fromColumn = String(client.postalCode || "").trim().match(/^(\d{5})(?:-\d{4})?$/);
  if (fromColumn) return fromColumn[1];
  // Last five-digit group on the address line, optionally ZIP+4, and only at
  // the end — "1555 Barton Springs Rd" must not yield "01555".
  const fromAddress = String(client.address || "").trim().match(/\b(\d{5})(?:-\d{4})?\s*(?:,?\s*(?:USA|US|United States))?\s*$/i);
  return fromAddress ? fromAddress[1] : null;
}

/** Prisma Decimals → numbers, dates → ISO strings: a row the browser can hold. */
function plainRow(row) {
  if (!row) return null;
  const num = (v) => (v == null ? null : Number(v));
  return {
    zip: row.zip,
    state: row.state,
    county: row.county || null,
    city: row.city || null,
    combinedRate: num(row.combinedRate),
    stateRate: num(row.stateRate),
    countyRate: num(row.countyRate),
    cityRate: num(row.cityRate),
    specialRate: num(row.specialRate),
    maxRate: num(row.maxRate),
    zipSpansRates: Boolean(row.zipSpansRates),
    effectiveFrom: row.effectiveFrom ? new Date(row.effectiveFrom).toISOString() : null,
    fetchedAt: row.fetchedAt ? new Date(row.fetchedAt).toISOString() : null,
    source: row.source || null,
    sourceKind: row.sourceKind || null,
  };
}

/**
 * Attaches `usTaxRate` to every US client in the list that has a ZIP the
 * table knows. One query for the whole list. Returns the same array with the
 * field added (null when there is nothing to add), so callers can spread it
 * into a response without a second shape.
 */
export async function attachUsTaxRates(clients) {
  const list = Array.isArray(clients) ? clients : [];
  const zips = [...new Set(list.map(zipFromClient).filter(Boolean))];
  if (!zips.length) return list.map((c) => (c && typeof c === "object" ? { ...c, usTaxRate: null } : c));
  const rows = await db.usSalesTaxRate.findMany({ where: { zip: { in: zips } } });
  const byZip = new Map(rows.map((r) => [r.zip, plainRow(r)]));
  return list.map((c) => {
    if (!c || typeof c !== "object") return c;
    const zip = zipFromClient(c);
    return { ...c, usTaxRate: zip ? byZip.get(zip) || null : null };
  });
}

/** One client. */
export async function attachUsTaxRate(client) {
  if (!client) return client;
  const [out] = await attachUsTaxRates([client]);
  return out;
}

/**
 * When the loaded table was last refreshed — for Settings → Tax's "rates as
 * of" line and the platform console. Null when the table is empty.
 *
 * @returns {{ fetchedAt: Date, states: number, rows: number }|null}
 */
export async function usRatesTableStatus() {
  const [agg, states] = await Promise.all([
    db.usSalesTaxRate.aggregate({ _max: { fetchedAt: true }, _count: { zip: true } }),
    db.usSalesTaxRate.findMany({ distinct: ["state"], select: { state: true } }),
  ]);
  if (!agg._count.zip) return null;
  return {
    fetchedAt: agg._max.fetchedAt,
    rows: agg._count.zip,
    states: states.map((s) => s.state).sort(),
  };
}
