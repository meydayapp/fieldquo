// lib/platform/costs/neonConsumption.js
//
// What the database used, per day, from Neon's consumption API — and what
// that costs ONLY where Neon publishes the rate.
//
// ══ Units are read; dollars are list price, or nothing ═══════════════════
//
// Neon has no billing endpoint that returns an invoice line per day. What
// it has is consumption history: per project, per day, compute seconds,
// active seconds, bytes written, and storage as byte-hours. Those units are
// stored verbatim. A dollar figure is attached to a unit ONLY when two things
// hold: the response names the plan (`period_plan`) and neon.com/pricing
// publishes a per-unit rate for that plan and that metric. Read 2026-09-19:
//
//   Launch   compute US$0.106 per CU-hour   storage US$0.35 per GB-month
//   Scale    compute US$0.222 per CU-hour   storage US$0.35 per GB-month
//   Free     nothing billed (the plan is capped, not metered)
//
// Anything else — an unnamed plan, an Enterprise contract, a metric with no
// published rate — is stored with `cents: null` and the page prints the
// units and says to enter Neon's invoice under Fixed bills. Data transfer,
// extra branches, instant restore and snapshots are billed by Neon and NOT
// in this API at all, so even a fully priced month is compute + storage at
// list price, never the invoice; the page says so and reconciles against
// the hand-entered bill when there is one.
//
// ══ The conversions, stated ══════════════════════════════════════════════
//
//   CU-hours   = compute_time_seconds ÷ 3,600 — Neon's compute seconds are
//                CU-seconds (a 0.25 CU endpoint running an hour is 900).
//   GB-month   = data_storage_bytes_hour ÷ 2^30 ÷ (hours in that month) —
//                Neon bills the average size over the month; a day's share
//                is its byte-hours over the month's hours. 1 GB is taken as
//                1,073,741,824 bytes; if Neon bills decimal gigabytes the
//                storage line reads 7% high, which the invoice reconciliation
//                will show.
//
// Docs read 2026-09-19 (api-docs.neon.tech, "Get consumption history per
// project"): GET https://console.neon.tech/api/v2/consumption_history/projects
// ?from=<RFC3339>&to=<RFC3339>&granularity=daily&metrics=…&limit=100
// &cursor=…, Bearer personal or organisation API key. Daily granularity
// reaches 60 days back. Response { projects: [ { project_id, periods: [ {
// period_plan, period_start, period_end, consumption: [ { timeframe_start,
// timeframe_end, active_time_seconds, compute_time_seconds,
// written_data_bytes, synthetic_storage_size_bytes, data_storage_bytes_hour,
// … } ] } ] } ], pagination: { cursor } }.
import { db } from "@/lib/db";
import { dayKey } from "./dailyLedger";
import { writeDailyRows } from "./ledgerWrite";

export const NEON_SOURCE = "neon_consumption_history";
export const NEON_ENDPOINT = "https://console.neon.tech/api/v2/consumption_history/projects";
/** Daily granularity reaches this far back — the API's own limit. */
export const NEON_DAILY_MAX_DAYS = 60;

/** neon.com/pricing, read 2026-09-19. Cents, so the arithmetic is on integers × units. */
export const NEON_LIST_RATES = Object.freeze({
  launch: { computeCentsPerCuHour: 10.6, storageCentsPerGbMonth: 35, source: "neon.com/pricing Launch plan, read 2026-09-19" },
  scale: { computeCentsPerCuHour: 22.2, storageCentsPerGbMonth: 35, source: "neon.com/pricing Scale plan, read 2026-09-19" },
  free: { computeCentsPerCuHour: 0, storageCentsPerGbMonth: 0, source: "neon.com/pricing Free plan, read 2026-09-19 — capped, nothing billed" },
});

/** The metrics asked for, and how each is stored. */
export const NEON_METRICS = Object.freeze([
  { key: "compute_time_seconds", unit: "CU-seconds", label: "Compute", priced: "compute" },
  { key: "data_storage_bytes_hour", unit: "byte-hours", label: "Storage", priced: "storage" },
  { key: "active_time_seconds", unit: "seconds", label: "Active time", priced: null },
  { key: "written_data_bytes", unit: "bytes", label: "Data written", priced: null },
  { key: "synthetic_storage_size_bytes", unit: "bytes", label: "Storage size at day end", priced: null },
]);

const GIB = 1024 ** 3;

export function neonConfigured() {
  return Boolean(process.env.NEON_API_KEY);
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
const r4 = (n) => Math.round(n * 10000) / 10000;

/** The plan key the rate table knows, from Neon's period_plan string. Null when it is not one of them. */
export function neonPlanKey(periodPlan) {
  const p = String(periodPlan || "").toLowerCase();
  if (/\blaunch\b/.test(p)) return "launch";
  if (/\bscale\b/.test(p)) return "scale";
  if (/\bfree\b/.test(p)) return "free";
  return null;
}

/** Hours in the UTC month a "YYYY-MM-DD" day belongs to. */
export function hoursInMonthOf(day) {
  const d = new Date(`${day}T00:00:00.000Z`);
  const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return days * 24;
}

/**
 * Price one metric for one day at list rate. PURE. Null when the plan or
 * the metric has no published rate.
 */
export function priceNeonMetric({ metric, units, day, planKey }) {
  const rate = planKey ? NEON_LIST_RATES[planKey] : null;
  const u = num(units);
  if (!rate || u === null) return null;
  if (metric === "compute_time_seconds") return r4((u / 3600) * rate.computeCentsPerCuHour);
  if (metric === "data_storage_bytes_hour") return r4((u / GIB / hoursInMonthOf(day)) * rate.storageCentsPerGbMonth);
  return null;
}

/** "proj_x/compute_time_seconds" — the project and the metric, verbatim. */
export function neonCategory(projectId, metric) {
  return `${projectId || "project"}/${metric}`;
}

export function splitNeonCategory(category) {
  const s = String(category || "");
  const i = s.lastIndexOf("/");
  return i < 0 ? { projectId: null, metric: s } : { projectId: s.slice(0, i), metric: s.slice(i + 1) };
}

/**
 * Consumption response → ledger rows. PURE.
 *
 * One row per (day, project, metric). `units` is the figure Neon gave;
 * `cents` is list price where the plan and metric have one, else null.
 * The plan is carried in `unit` after the metric's unit ("CU-seconds ·
 * launch") so the page can say which rate was applied. A timeframe with no
 * readable start is dropped and counted.
 *
 * @returns {{ rows: Array, dropped: number, plans: string[] }}
 */
export function normaliseNeonConsumption(body, { fetchedAt = new Date() } = {}) {
  const rows = [];
  const plans = new Set();
  let dropped = 0;
  const at = fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt);
  for (const p of Array.isArray(body?.projects) ? body.projects : []) {
    const projectId = typeof p?.project_id === "string" ? p.project_id : null;
    for (const period of Array.isArray(p?.periods) ? p.periods : []) {
      const planKey = neonPlanKey(period?.period_plan);
      if (period?.period_plan) plans.add(String(period.period_plan));
      for (const c of Array.isArray(period?.consumption) ? period.consumption : []) {
        const day = dayKey(c?.timeframe_start);
        if (!day) {
          dropped += 1;
          continue;
        }
        for (const m of NEON_METRICS) {
          const units = num(c?.[m.key]);
          if (units === null) continue;
          rows.push({
            day,
            provider: "neon",
            category: neonCategory(projectId, m.key),
            cents: m.priced ? priceNeonMetric({ metric: m.key, units, day, planKey }) : null,
            currency: "USD",
            units: r4(units),
            unit: `${m.unit}${planKey ? ` · ${planKey}` : period?.period_plan ? ` · ${String(period.period_plan).toLowerCase()}` : ""}`,
            count: null,
            source: NEON_SOURCE,
            fetchedAt: at,
          });
        }
      }
    }
  }
  return { rows, dropped, plans: [...plans] };
}

/**
 * Read the consumption API for [from, to] inclusive of days, following the
 * cursor. Returns one merged body.
 */
export async function fetchNeonConsumption({ from, to, apiKey = process.env.NEON_API_KEY, projectIds, orgId = process.env.NEON_ORG_ID, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error("NEON_API_KEY is not set");
  const projects = [];
  let cursor = null;
  for (let guard = 0; guard < 20; guard += 1) {
    const q = new URLSearchParams({
      from: `${dayKey(from)}T00:00:00Z`,
      to: `${dayKey(to)}T23:59:59Z`,
      granularity: "daily",
      limit: "100",
    });
    for (const m of NEON_METRICS) q.append("metrics", m.key);
    for (const id of Array.isArray(projectIds) ? projectIds : []) q.append("project_ids", id);
    if (orgId) q.set("org_id", orgId);
    if (cursor) q.set("cursor", cursor);
    // eslint-disable-next-line no-await-in-loop
    const res = await fetchImpl(`${NEON_ENDPOINT}?${q.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    // eslint-disable-next-line no-await-in-loop
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Neon consumption: ${body?.message || body?.error || `HTTP ${res.status}`}`);
    for (const p of Array.isArray(body?.projects) ? body.projects : []) projects.push(p);
    const next = body?.pagination?.cursor;
    if (!next || next === cursor || (body?.projects || []).length === 0) break;
    cursor = next;
  }
  return { projects };
}

/** The whole pull: fetch, normalise, write. Same shape as the other providers. */
export async function pullNeonConsumption({ from, to, client = db, now = new Date(), fetchImpl = fetch } = {}) {
  if (!neonConfigured()) return { ok: false, reason: "not_configured", records: 0, rows: 0, written: 0, dropped: 0 };
  const body = await fetchNeonConsumption({ from, to, fetchImpl });
  const { rows, dropped, plans } = normaliseNeonConsumption(body, { fetchedAt: now });
  const written = await writeDailyRows(rows, { client });
  return { ok: true, from: dayKey(from), to: dayKey(to), records: body.projects.length, rows: rows.length, written, dropped, plans };
}
