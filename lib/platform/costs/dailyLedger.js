// lib/platform/costs/dailyLedger.js
//
// The pure half of /platform/costs: a provider's usage records become
// PlatformCostDaily rows, and rows become the figures a page prints.
//
// ══ Idempotent by construction ═══════════════════════════════════════════
//
// A row is identified by (day, provider, category) and nothing else. Pulling
// the same day twice — which the hourly pull does on purpose, because Twilio
// revises a day for a few days after it ends — REPLACES the row, never adds
// to it. applyDailyRows() is that rule on a Map, and the database writer is
// the same rule as an upsert on the unique index; scripts/check-sales-costs.mjs
// applies a pull twice and asserts the ledger is unchanged.
//
// ══ The provider's category names are kept verbatim ══════════════════════
//
// "calls-outbound", "calls-client", "phonenumbers" — Twilio's own keys, so a
// figure on the page can be found on the invoice. TWILIO_CATEGORY_LABELS
// says what each one is in English; the key is what is stored.

/**
 * The Twilio usage categories the pull asks for, and why each one.
 *
 * "calls" and "sms" are Twilio's PARENT categories and are not pulled: they
 * are the sum of the children below, and storing both would double a total
 * that summed the table. "totalprice" IS pulled, as its own line, because it
 * is the one figure that catches a category this list does not name — if
 * the sum of the lines here falls short of it, the difference is printed as
 * "other Twilio charges", never hidden.
 */
export const TWILIO_USAGE_CATEGORIES = Object.freeze([
  "calls-outbound",
  "calls-inbound",
  "calls-client",
  "recordings",
  "recordingstorage",
  "transcriptions",
  "phonenumbers",
  "sms-outbound",
  "sms-inbound",
  "totalprice",
]);

export const TWILIO_CATEGORY_LABELS = Object.freeze({
  "calls-outbound": "Calls out — the PSTN leg to the contractor",
  "calls-inbound": "Calls in — contractors ringing FieldQuo's numbers",
  "calls-client": "Browser legs — a rep's headset to Twilio",
  recordings: "Call recording",
  recordingstorage: "Recording storage",
  transcriptions: "Twilio transcription (not used; Whisper is)",
  phonenumbers: "Number rent",
  "sms-outbound": "SMS out",
  "sms-inbound": "SMS in",
  totalprice: "Everything Twilio billed the account",
});

/** The one category that is a total of the others, not a line among them. */
export const TWILIO_TOTAL_CATEGORY = "totalprice";

export const TWILIO_SOURCE = "twilio_usage_records";

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** "YYYY-MM-DD" for a Date or a date-ish string, in UTC. Null for garbage. */
export function dayKey(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}

/** The Date for a "YYYY-MM-DD" key, at UTC midnight. */
export function dayDate(key) {
  const k = dayKey(key);
  return k ? new Date(`${k}T00:00:00.000Z`) : null;
}

export const rowKey = (r) => `${r.day}|${r.provider}|${r.category}`;

/**
 * Twilio daily usage records → ledger rows.
 *
 * A record is one category for one day: `{ category, startDate, price,
 * priceUnit, usage, usageUnit, count }`. Price is a STRING in the account's
 * currency and is what the account owes (positive). Records with no
 * category or no readable day are dropped and counted, never invented.
 *
 * @returns {{ rows: Array, dropped: number }}
 */
export function normaliseTwilioUsage(records, { fetchedAt = new Date() } = {}) {
  const rows = [];
  let dropped = 0;
  for (const rec of Array.isArray(records) ? records : []) {
    const category = typeof rec?.category === "string" ? rec.category.trim() : "";
    const day = dayKey(rec?.startDate ?? rec?.start_date);
    const dollars = num(rec?.price);
    if (!category || !day || dollars === null) {
      dropped += 1;
      continue;
    }
    rows.push({
      day,
      provider: "twilio",
      category,
      cents: Math.round(dollars * 100 * 10000) / 10000,
      currency: typeof rec?.priceUnit === "string" && rec.priceUnit ? rec.priceUnit.toUpperCase() : "USD",
      units: num(rec?.usage),
      unit: typeof rec?.usageUnit === "string" && rec.usageUnit ? rec.usageUnit : null,
      count: num(rec?.count) === null ? null : Math.round(num(rec.count)),
      source: TWILIO_SOURCE,
      fetchedAt: fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt),
    });
  }
  return { rows, dropped };
}

/**
 * Apply rows to a ledger keyed by (day, provider, category). Replaces;
 * never accumulates. Returns the same Map for chaining.
 */
export function applyDailyRows(ledger, rows) {
  const map = ledger instanceof Map ? ledger : new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r?.day || !r?.provider || !r?.category) continue;
    map.set(rowKey(r), { ...r });
  }
  return map;
}

/**
 * Bucket rows by period.
 *
 * @param granularity "day" | "week" | "month"
 * @returns Map<bucketKey, rows[]>, keys sorted ascending
 */
export function bucketRows(rows, granularity = "day") {
  const out = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const key = bucketKey(r.day, granularity);
    if (!key) continue;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(r);
  }
  return new Map([...out.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
}

/** ISO week Monday for "week", "YYYY-MM" for "month", the day itself otherwise. */
export function bucketKey(day, granularity) {
  const d = dayDate(day);
  if (!d) return null;
  if (granularity === "month") return d.toISOString().slice(0, 7);
  if (granularity === "week") {
    const monday = new Date(d);
    const dow = (d.getUTCDay() + 6) % 7;
    monday.setUTCDate(d.getUTCDate() - dow);
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Sum a set of Twilio rows into lines the page prints: one per category in
 * TWILIO_USAGE_CATEGORIES order (absent categories are absent, not zero),
 * the account total, and the difference between the two.
 */
export function summariseTwilio(rows) {
  const byCat = new Map();
  let oldest = null;
  let newest = null;
  let fetched = null;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r.provider !== "twilio") continue;
    const cur = byCat.get(r.category) || { category: r.category, cents: 0, units: null, unit: r.unit || null, count: null, days: 0, currency: r.currency || "USD" };
    cur.cents += num(r.cents) || 0;
    if (num(r.units) !== null) cur.units = (cur.units || 0) + num(r.units);
    if (num(r.count) !== null) cur.count = (cur.count || 0) + num(r.count);
    cur.days += 1;
    byCat.set(r.category, cur);
    if (!oldest || r.day < oldest) oldest = r.day;
    if (!newest || r.day > newest) newest = r.day;
    const f = r.fetchedAt ? new Date(r.fetchedAt).getTime() : NaN;
    if (Number.isFinite(f) && (fetched === null || f < fetched)) fetched = f;
  }
  const lines = TWILIO_USAGE_CATEGORIES.filter((c) => c !== TWILIO_TOTAL_CATEGORY && byCat.has(c)).map((c) => ({
    ...byCat.get(c),
    label: TWILIO_CATEGORY_LABELS[c] || c,
    cents: Math.round(byCat.get(c).cents * 10000) / 10000,
  }));
  // Categories the pull did not name but the table holds — a future pull may
  // add some; they are listed rather than dropped.
  for (const [c, v] of byCat) {
    if (c === TWILIO_TOTAL_CATEGORY || TWILIO_USAGE_CATEGORIES.includes(c)) continue;
    lines.push({ ...v, label: TWILIO_CATEGORY_LABELS[c] || c, cents: Math.round(v.cents * 10000) / 10000 });
  }
  const linesCents = Math.round(lines.reduce((s, l) => s + l.cents, 0) * 10000) / 10000;
  const total = byCat.get(TWILIO_TOTAL_CATEGORY);
  const totalCents = total ? Math.round(total.cents * 10000) / 10000 : null;
  return {
    lines,
    linesCents,
    /** Twilio's own account total for the days present, or null when it was never pulled. */
    totalCents,
    /** What the total holds that no line names. Null without a total. */
    otherCents: totalCents === null ? null : Math.round((totalCents - linesCents) * 10000) / 10000,
    days: { from: oldest, to: newest },
    /** The OLDEST fetch among the rows — the age a reader has to assume. */
    fetchedAt: fetched === null ? null : new Date(fetched),
    source: TWILIO_SOURCE,
  };
}
