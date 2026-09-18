// lib/sales/intel/apify.js
//
// The one file that talks to Apify. Start a run, read a run, read its
// dataset, meter what it cost. Nothing vendor-specific about BBB or Google
// Maps lives here — bbbApify.js and mapsApify.js say what to send and how
// to read a row; apifyRuns.js drives the pairs.
//
// ══ The key ═══════════════════════════════════════════════════════════════
//
// `APIFY_TOKEN`, read the way GOOGLE_MAPS_SERVER_KEY and the Twilio keys
// are: from the environment at call time, never at import, so a build
// without it builds and a call without it says so. Documented in
// docs/VERCEL.md. Without it every orchestration returns
// { skipped: "no_token" } and the console prints the variable's name.
//
// ══ Money ═════════════════════════════════════════════════════════════════
//
// Both actors are pay-per-event: a start event plus one event per record,
// no platform-usage charge. A finished run's own record carries
// `usageTotalUsd`; that number is what is metered, at cents, into
// PlatformCostDaily under provider "apify" and the actor's category. When
// the run record does not carry it (an older API shape, a failed read) the
// list price times the rows is metered instead and `costSource` on the
// ApifyRun says which — the ledger never silently under-reports.
import { db as defaultDb } from "@/lib/db";

export const APIFY_API = "https://api.apify.com/v2";
export const APIFY_COST_PROVIDER = "apify";
export const APIFY_ENV_VAR = "APIFY_TOKEN";

export function apifyToken() {
  const t = process.env.APIFY_TOKEN;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

export function apifyConfigured() {
  return Boolean(apifyToken());
}

/** The sentence the console prints when there is no key. */
export function apifyEnableInstructions() {
  return `Set ${APIFY_ENV_VAR} in Vercel (an Apify API token from https://console.apify.com/account/integrations). Until it is set, no bulk BBB or Google Maps run starts and nothing is charged.`;
}

async function call(path, { method = "GET", body = null, token = apifyToken(), fetchImpl = fetch } = {}) {
  if (!token) return { ok: false, code: "no_token", status: 0, message: apifyEnableInstructions(), fatal: true };
  const url = `${APIFY_API}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  let res;
  try {
    res = await fetchImpl(url, {
      method,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { ok: false, code: "network", status: 0, message: err?.message || String(err), fatal: false };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = data?.error?.message || `Apify answered ${res.status}`;
    // 401/403: the token is wrong — every later call would fail the same way.
    return { ok: false, code: data?.error?.type || `http_${res.status}`, status: res.status, message, fatal: res.status === 401 || res.status === 403 };
  }
  return { ok: true, status: res.status, data: data?.data ?? data };
}

/** Start an actor. `actor` is "user~name". Returns the run record. */
export async function startActorRun({ actor, input, deps = {} } = {}) {
  const r = await call(`/acts/${encodeURIComponent(actor)}/runs`, { method: "POST", body: input, ...deps });
  if (!r.ok) return r;
  const run = r.data || {};
  return { ok: true, run: { id: run.id, status: run.status, datasetId: run.defaultDatasetId || null, startedAt: run.startedAt || null } };
}

/** One run's current state, including its cost when finished. */
export async function getActorRun({ runId, deps = {} } = {}) {
  const r = await call(`/actor-runs/${encodeURIComponent(runId)}`, deps);
  if (!r.ok) return r;
  const run = r.data || {};
  const usd = Number(run.usageTotalUsd);
  return {
    ok: true,
    run: {
      id: run.id,
      status: run.status,
      datasetId: run.defaultDatasetId || null,
      finishedAt: run.finishedAt || null,
      usageTotalUsd: Number.isFinite(usd) ? usd : null,
      chargedEventCounts: run.chargedEventCounts || null,
      statusMessage: run.statusMessage || null,
    },
  };
}

export const APIFY_FINISHED = Object.freeze(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

/** Every item of a dataset. */
export async function fetchDatasetItems({ datasetId, limit = 5000, deps = {} } = {}) {
  const r = await call(`/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&limit=${limit}`, deps);
  if (!r.ok) return r;
  return { ok: true, items: Array.isArray(r.data) ? r.data : [] };
}

function utcDay(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * One run's cost onto today's PlatformCostDaily row for its actor. Never
 * throws: metering must not take down the thing it measures.
 *
 * @param cents    what the run cost
 * @param rows     the records it returned (the `units`)
 * @param source   "apify_run_usage" | "list_price_estimate"
 */
export async function meterApifyRun({ db = defaultDb, now = new Date(), category, cents, rows = 0, source } = {}) {
  try {
    if (typeof db.platformCostDaily?.upsert !== "function") return null;
    return await db.platformCostDaily.upsert({
      where: { day_provider_category: { day: utcDay(now), provider: APIFY_COST_PROVIDER, category } },
      create: { day: utcDay(now), provider: APIFY_COST_PROVIDER, category, cents, currency: "USD", units: rows, unit: "records", count: 1, source, fetchedAt: now },
      update: { cents: { increment: cents }, units: { increment: rows }, count: { increment: 1 }, fetchedAt: now },
    });
  } catch (err) {
    console.error("[apify] run not metered:", err?.message);
    return null;
  }
}

/** This month's Apify spend per category, from the ledger. */
export async function apifySpendThisMonth({ db = defaultDb, now = new Date() } = {}) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  try {
    const rows = await db.platformCostDaily.groupBy({
      by: ["category"],
      where: { provider: APIFY_COST_PROVIDER, day: { gte: from } },
      _sum: { cents: true, count: true, units: true },
    });
    return Object.fromEntries(rows.map((r) => [r.category, { cents: Number(r._sum.cents || 0), runs: Number(r._sum.count || 0), rows: Number(r._sum.units || 0) }]));
  } catch {
    return {};
  }
}
