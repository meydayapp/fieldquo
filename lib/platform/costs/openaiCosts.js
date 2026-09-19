// lib/platform/costs/openaiCosts.js
//
// What OpenAI BILLED, beside what FieldQuo computed.
//
// ══ Two figures, deliberately kept apart ═════════════════════════════════
//
// The two AI ledgers (PlatformAiUsage, AiUsage) price the vendor's token
// counts through lib/ai/usage.js's table. That table is typed in by hand and
// drifts — its own header says so — so the figure it produces is COMPUTED,
// never billed. This module reads the other one: the organisation Costs
// endpoint, which returns the dollars OpenAI actually charged, per UTC day,
// per project and per line item ("gpt-5-mini, input_tokens"). The two land
// on /platform/costs side by side with a reconciliation line, so a stale
// price table shows as a percentage rather than as a number nobody
// questions.
//
// ══ An ADMIN key, not the API key ════════════════════════════════════════
//
// The Costs endpoint refuses an ordinary project key. It wants an
// organisation admin key (platform.openai.com → Settings → Organization →
// Admin keys), held here as OPENAI_ADMIN_API_KEY and read nowhere else. That
// key can list every project's spend and every member; it is never handed
// to lib/ai/provider.js, and provider.js's key is never sent here.
//
// Docs read 2026-09-19 from openai/openai-openapi (master), operation
// `usage-costs`: GET /v1/organization/costs?start_time=<unix, inclusive>
// &end_time=<unix, exclusive>&bucket_width=1d&group_by=project_id,line_item
// &limit=<1..180>&page=<cursor>. Response `{ object: "page", data: [ {
// object: "bucket", start_time, end_time, results: [ { amount: { value,
// currency }, line_item, project_id, api_key_id, quantity, quantity_unit } ]
// } ], has_more, next_page }`.
import { db } from "@/lib/db";
import { dayKey } from "./dailyLedger";
import { writeDailyRows } from "./ledgerWrite";

export const OPENAI_COSTS_SOURCE = "openai_organization_costs";
export const OPENAI_COSTS_ENDPOINT = "https://api.openai.com/v1/organization/costs";
/** The one category that is a day's sum, kept so a day with no spend still has a row. */
export const OPENAI_TOTAL_CATEGORY = "total";
/** The endpoint's own ceiling on buckets per page. */
const PAGE_LIMIT = 180;

export function openaiAdminConfigured() {
  return Boolean(process.env.OPENAI_ADMIN_API_KEY);
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
const r4 = (n) => Math.round(n * 10000) / 10000;

/** "proj_abc/gpt-5-mini, input_tokens" — the project and the line, verbatim. */
export function openaiCategory(projectId, lineItem) {
  return `${projectId || "org"}/${lineItem || "all"}`;
}

/** The inverse of openaiCategory, for the page. */
export function splitOpenaiCategory(category) {
  const s = String(category || "");
  const i = s.indexOf("/");
  if (i < 0) return { projectId: null, lineItem: s };
  return { projectId: s.slice(0, i) === "org" ? null : s.slice(0, i), lineItem: s.slice(i + 1) === "all" ? null : s.slice(i + 1) };
}

/**
 * Costs buckets → ledger rows. PURE.
 *
 * One row per (day, project, line item) with the billed amount in cents,
 * the quantity and its unit as OpenAI names them, plus one OPENAI_TOTAL_CATEGORY
 * row per bucket holding the day's sum — 0 when the bucket has no results,
 * so "no spend that day" and "never pulled" stay distinguishable. A result
 * with an unreadable amount, or a bucket with an unreadable start, is
 * dropped and counted, never guessed.
 *
 * @returns {{ rows: Array, dropped: number }}
 */
export function normaliseOpenaiCosts(buckets, { fetchedAt = new Date() } = {}) {
  const rows = [];
  let dropped = 0;
  const at = fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt);
  for (const b of Array.isArray(buckets) ? buckets : []) {
    const start = num(b?.start_time);
    const day = start === null ? null : dayKey(new Date(start * 1000));
    if (!day) {
      dropped += 1;
      continue;
    }
    let total = 0;
    let currency = "USD";
    const byCat = new Map();
    for (const r of Array.isArray(b?.results) ? b.results : []) {
      const dollars = num(r?.amount?.value);
      if (dollars === null) {
        dropped += 1;
        continue;
      }
      const cents = r4(dollars * 100);
      const cat = openaiCategory(r?.project_id, r?.line_item);
      const cur = byCat.get(cat) || { cents: 0, units: null, unit: null };
      cur.cents = r4(cur.cents + cents);
      const q = num(r?.quantity);
      if (q !== null) cur.units = r4((cur.units || 0) + q);
      if (typeof r?.quantity_unit === "string" && r.quantity_unit) cur.unit = r.quantity_unit;
      byCat.set(cat, cur);
      total = r4(total + cents);
      if (typeof r?.amount?.currency === "string" && r.amount.currency) currency = r.amount.currency.toUpperCase();
    }
    for (const [category, v] of byCat) {
      rows.push({ day, provider: "openai", category, cents: v.cents, currency, units: v.units, unit: v.unit, count: null, source: OPENAI_COSTS_SOURCE, fetchedAt: at });
    }
    rows.push({ day, provider: "openai", category: OPENAI_TOTAL_CATEGORY, cents: total, currency, units: null, unit: null, count: byCat.size, source: OPENAI_COSTS_SOURCE, fetchedAt: at });
  }
  return { rows, dropped };
}

/**
 * Computed against billed, for the days both exist. PURE.
 *
 * "computed $41.20 / billed $43.05 — 4% under; price table may be stale".
 * Compared over the days OpenAI has billed only, so a period whose last
 * day has not been pulled yet is not reported as the price table being
 * wrong. Null billed → no percentage, and the statement says what is
 * missing rather than printing 0%.
 */
export function reconcileOpenai({ computedCents, billedCents, daysBilled = 0, daysInPeriod = 0 } = {}) {
  const c = num(computedCents);
  const b = num(billedCents);
  const money = (cents) => `$${(cents / 100).toFixed(2)}`;
  if (b === null) {
    return {
      computedCents: c,
      billedCents: null,
      pct: null,
      statement: c === null ? "Neither figure is known." : `computed ${money(c)} — nothing billed has been pulled for this period yet`,
    };
  }
  if (c === null) return { computedCents: null, billedCents: b, pct: null, statement: `billed ${money(b)} — nothing computed for these days` };
  const coverage = daysInPeriod > daysBilled ? ` over the ${daysBilled} of ${daysInPeriod} days OpenAI has billed` : "";
  if (b === 0) {
    return { computedCents: c, billedCents: 0, pct: null, statement: `computed ${money(c)} / billed $0.00${coverage}${c > 0 ? " — OpenAI shows nothing billed; check the admin key sees the right organisation" : ""}` };
  }
  const pct = Math.round(((c - b) / b) * 1000) / 10;
  const dir = pct > 0 ? "over" : pct < 0 ? "under" : "level";
  const note = Math.abs(pct) >= 2 ? "; price table may be stale" : "";
  return {
    computedCents: c,
    billedCents: b,
    pct,
    statement: `computed ${money(c)} / billed ${money(b)}${coverage} — ${dir === "level" ? "level" : `${Math.abs(pct)}% ${dir}`}${note}`,
  };
}

/**
 * Read the Costs endpoint for [from, to] inclusive of days, following
 * `next_page` until `has_more` is false. Returns the buckets.
 *
 * @param fetchImpl  injectable for the check script
 */
export async function fetchOpenaiCosts({ from, to, apiKey = process.env.OPENAI_ADMIN_API_KEY, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error("OPENAI_ADMIN_API_KEY is not set");
  const startTime = Math.floor(new Date(`${dayKey(from)}T00:00:00.000Z`).getTime() / 1000);
  const endTime = Math.floor(new Date(`${dayKey(to)}T00:00:00.000Z`).getTime() / 1000) + 86_400;
  const buckets = [];
  let page = null;
  for (let guard = 0; guard < 20; guard += 1) {
    const q = new URLSearchParams({ start_time: String(startTime), end_time: String(endTime), bucket_width: "1d", limit: String(PAGE_LIMIT) });
    q.append("group_by", "project_id");
    q.append("group_by", "line_item");
    if (page) q.set("page", page);
    // eslint-disable-next-line no-await-in-loop
    const res = await fetchImpl(`${OPENAI_COSTS_ENDPOINT}?${q.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    });
    // eslint-disable-next-line no-await-in-loop
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = body?.error?.message || `HTTP ${res.status}`;
      throw new Error(`OpenAI costs: ${msg}`);
    }
    for (const b of Array.isArray(body?.data) ? body.data : []) buckets.push(b);
    if (!body?.has_more || !body?.next_page) break;
    page = body.next_page;
  }
  return buckets;
}

/**
 * The whole pull: fetch, normalise, write. Same shape as pullTwilioUsage so
 * the cron and the page treat every provider alike.
 */
export async function pullOpenaiCosts({ from, to, client = db, now = new Date(), fetchImpl = fetch } = {}) {
  if (!openaiAdminConfigured()) return { ok: false, reason: "not_configured", records: 0, rows: 0, written: 0, dropped: 0 };
  const buckets = await fetchOpenaiCosts({ from, to, fetchImpl });
  const { rows, dropped } = normaliseOpenaiCosts(buckets, { fetchedAt: now });
  const written = await writeDailyRows(rows, { client });
  return { ok: true, from: dayKey(from), to: dayKey(to), records: buckets.length, rows: rows.length, written, dropped };
}
