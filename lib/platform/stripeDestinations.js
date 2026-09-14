// lib/platform/stripeDestinations.js
//
// Are the two Stripe event destinations subscribed to the events the code
// handles, pointed at this host, enabled, and scoped to the platform account?
//
// ── Why the deployment checks this itself ───────────────────────────────────
//
// On 2026-09-12 the live billing destination was created with nine events,
// none of which a subscription produces. The required list was in
// docs/VERCEL.md; a person compared it against a paste; nobody caught it. The
// result was two days of ZERO webhook deliveries with no error anywhere — the
// existing "last event: never" line on /platform (lib/platform/webhookHealth.js)
// says a destination is not delivering, but not WHY, and "why" was a list of
// checkboxes in another company's dashboard.
//
// So the required list is no longer typed in docs. It is derived from the code
// that handles the events — BILLING_EVENTS next to the switch in
// lib/platform/stripeBilling.js, BILLING_ROUTE_EVENTS next to the dispatch in
// app/api/platform/billing/webhook/route.js, CONNECT_EVENTS next to the switch
// in app/api/stripe/webhook/route.js — and scripts/check-stripe-destinations.mjs
// asserts each constant equals the `case` labels it sits beside, both ways. A
// handler that grows a case without its entry fails the build. This file
// reads the live destinations back from Stripe and diffs them against those
// constants; /platform shows the diff, the six-hourly billing-sync cron files
// it as a platform error.
//
// ── Two API calls, on purpose ───────────────────────────────────────────────
//
// v1 `webhookEndpoints.list` gives url, enabled_events, status and api_version.
// It does NOT say whether a destination listens to "Your account" or to
// "Connected accounts" — the scope mistake that cost five bookings once (see
// the header of app/api/stripe/webhook/route.js). v2 `eventDestinations.list`
// carries that as `events_from` under the SAME id, so it is read second and
// merged in. The v2 call is best-effort: an account or SDK where it fails
// still gets the v1 audit, with scope reported as unknown rather than the
// whole check going dark.
//
// ── Pure comparison, separate from the fetch ────────────────────────────────
//
// compareDestinations() takes plain endpoint objects and returns the report;
// it touches neither Stripe nor the database, so the check executes it
// against fixtures (missing, extra, disabled, apex host, duplicates, wrong
// scope, wildcard). auditDestinations() is the fetch + cache + report wrapper
// around it, with its clients injectable for the same reason.
import { stripe as liveStripe } from "@/lib/stripe";
import { db as liveDb } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { BILLING_EVENTS } from "@/lib/platform/stripeBilling";
import { BILLING_ROUTE_EVENTS } from "@/app/api/platform/billing/webhook/route";
import { CONNECT_EVENTS } from "@/app/api/stripe/webhook/route";

export const DESTINATIONS = Object.freeze(["billing", "connect"]);

export const DESTINATION_LABELS = Object.freeze({
  billing: "Billing",
  connect: "Connect",
});

/** The route each destination must point at — path only; host is checked apart. */
export const DESTINATION_PATHS = Object.freeze({
  billing: "/api/platform/billing/webhook",
  connect: "/api/stripe/webhook",
});

/**
 * The one host a live destination may point at. The apex redirects to www,
 * and Stripe does not follow a redirect with the POST body — so a destination
 * at `fieldquo.com` delivers nothing and Stripe eventually disables it. A
 * preview host is a deployment with its own database and no live secrets.
 */
export const CANONICAL_HOST = "www.fieldquo.com";

const sortedUnique = (list) => Object.freeze([...new Set(list)].sort());

/**
 * Every event each destination must be subscribed to — the union of what the
 * handlers dispatch on. Nothing is typed here that is not typed beside a
 * `case` or an `event.type ===` in the handler it describes.
 */
export const REQUIRED_EVENTS = Object.freeze({
  billing: sortedUnique([...BILLING_EVENTS, ...BILLING_ROUTE_EVENTS]),
  connect: sortedUnique([...CONNECT_EVENTS]),
});

/**
 * Handled events whose ABSENCE from a destination is not a fault.
 *
 * `account.updated` for a contractor's Express account is a connected-account
 * event; a "Your account" destination never receives it whether or not the
 * box is ticked (docs/VERCEL.md), and `/api/stripe/connect/status` reads the
 * account directly instead. The Connect switch still handles it, so it is in
 * CONNECT_EVENTS; but a red line over a checkbox that changes nothing would
 * teach the owner to ignore the red line.
 */
export const OPTIONAL_EVENTS = Object.freeze({
  billing: Object.freeze([]),
  connect: Object.freeze(["account.updated"]),
});

/** The PlatformSetting row the last audit is cached in. */
export const AUDIT_SETTING_KEY = "stripe_destinations_audit";
/** How long a cached audit serves the dashboard before Stripe is asked again. */
export const AUDIT_TTL_MS = 10 * 60 * 1000;
/** How often a misconfigured destination is filed to /platform/errors. */
export const FLAG_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const MISCONFIGURED_CODE = "webhook_destination_misconfigured";
const ERROR_AREA = "billing";

/**
 * "live" | "test" | "unknown" from the key's prefix. Locally the key is
 * test-mode and the destinations listed are the test ones, which is a
 * different account from the one that matters; the report says which it saw.
 */
export function keyMode(key) {
  const k = typeof key === "string" ? key : "";
  if (/^[sr]k_live_/.test(k)) return "live";
  if (/^[sr]k_test_/.test(k)) return "test";
  return "unknown";
}

function parseUrl(url) {
  try {
    const u = new URL(String(url || ""));
    return { host: u.host.toLowerCase(), path: u.pathname.replace(/\/+$/, "") || "/" };
  } catch {
    return { host: null, path: null };
  }
}

/**
 * Which destination (if any) an endpoint's URL is for, by path. Host is judged
 * separately so a destination at the apex is reported as "wrong host", which
 * is actionable, rather than "not found", which is not.
 */
export function destinationForUrl(url) {
  const { host, path } = parseUrl(url);
  if (!path) return null;
  for (const name of DESTINATIONS) {
    if (path === DESTINATION_PATHS[name]) return { name, host, canonical: host === CANONICAL_HOST };
  }
  return null;
}

function emptyReport(name) {
  return {
    found: false,
    id: null,
    url: null,
    status: null,
    apiVersion: null,
    scope: null,
    wildcard: false,
    enabledCount: 0,
    missing: [],
    optionalMissing: [],
    extra: [],
    duplicates: [],
    problems: ["not_found"],
    ok: false,
    expectedUrl: `https://${CANONICAL_HOST}${DESTINATION_PATHS[name]}`,
    summary: "",
  };
}

/**
 * Diff a list of Stripe webhook endpoints against the required lists.
 *
 * @param {Array<{id, url, status, enabled_events, api_version, scope?}>} endpoints
 *   v1 webhook endpoint objects, optionally carrying `scope`
 *   ("self" | "other_accounts") merged from v2.
 * @returns {{ billing: object, connect: object }} one report per destination
 */
export function compareDestinations(endpoints, { required = REQUIRED_EVENTS, optional = OPTIONAL_EVENTS } = {}) {
  const list = Array.isArray(endpoints) ? endpoints : [];
  const byDestination = Object.fromEntries(DESTINATIONS.map((n) => [n, []]));
  for (const ep of list) {
    const match = destinationForUrl(ep?.url);
    if (match) byDestination[match.name].push({ ep, match });
  }

  const out = {};
  for (const name of DESTINATIONS) {
    const candidates = byDestination[name];
    const report = emptyReport(name);
    if (!candidates.length) {
      report.summary = describeDestination(name, report);
      out[name] = report;
      continue;
    }

    // Prefer the one that would actually work: canonical host first, enabled
    // first. Everything else is a duplicate — and two ENABLED endpoints on the
    // same route means every event is processed twice.
    const rank = ({ ep, match }) => (match.canonical ? 0 : 2) + (ep.status === "enabled" ? 0 : 1);
    candidates.sort((a, b) => rank(a) - rank(b));
    const [{ ep, match }, ...rest] = candidates;

    const enabled = Array.isArray(ep.enabled_events) ? ep.enabled_events : [];
    const wildcard = enabled.includes("*");
    const enabledSet = new Set(enabled);
    const requiredList = required[name] || [];
    const optionalList = new Set(optional[name] || []);
    const hardRequired = requiredList.filter((e) => !optionalList.has(e));

    report.found = true;
    report.id = ep.id || null;
    report.url = ep.url || null;
    report.status = ep.status || null;
    report.apiVersion = ep.api_version || null;
    report.scope = ep.scope === "self" || ep.scope === "other_accounts" ? ep.scope : null;
    report.wildcard = wildcard;
    report.enabledCount = wildcard ? requiredList.length : enabled.length;
    report.missing = wildcard ? [] : hardRequired.filter((e) => !enabledSet.has(e));
    report.optionalMissing = wildcard ? [] : requiredList.filter((e) => optionalList.has(e) && !enabledSet.has(e));
    report.extra = wildcard ? [] : enabled.filter((e) => !requiredList.includes(e)).sort();
    report.duplicates = rest.map((c) => ({ id: c.ep.id || null, url: c.ep.url || null, status: c.ep.status || null }));

    const problems = [];
    if (!match.canonical) problems.push("wrong_host");
    if (ep.status !== "enabled") problems.push("disabled");
    if (report.scope === "other_accounts") problems.push("wrong_scope");
    if (report.missing.length) problems.push("missing_events");
    if (report.duplicates.length) problems.push("duplicate");
    report.problems = problems;
    report.ok = problems.length === 0;
    report.summary = describeDestination(name, report);
    out[name] = report;
  }
  return out;
}

/**
 * One sentence per destination, the same one on /platform and in the error
 * row, so the cron and the dashboard cannot describe the same fault two ways.
 * Green: "Destination OK (15 events)". Red: what is wrong and where to fix it.
 */
export function describeDestination(name, report) {
  const label = DESTINATION_LABELS[name] || name;
  if (!report.found) {
    return `${label} destination not found at ${report.expectedUrl} — create it in Stripe (Workbench → Event destinations)`;
  }
  const faults = [];
  if (report.problems.includes("wrong_host")) {
    let host = "another host";
    try {
      host = new URL(report.url).host;
    } catch {
      /* unparsable url — "another host" is all that can be said */
    }
    faults.push(`points at ${host}, not ${CANONICAL_HOST}`);
  }
  if (report.problems.includes("disabled")) faults.push(`is ${report.status || "not enabled"}`);
  if (report.problems.includes("wrong_scope")) {
    faults.push('listens to "Connected accounts", not "Your account" — the destination charges are platform events');
  }
  if (report.problems.includes("missing_events")) faults.push(`is missing: ${report.missing.join(", ")}`);
  if (report.problems.includes("duplicate")) {
    faults.push(
      `has ${report.duplicates.length} duplicate${report.duplicates.length === 1 ? "" : "s"} on the same route (${report.duplicates
        .map((d) => `${d.id}${d.status === "enabled" ? "" : `, ${d.status}`}`)
        .join("; ")})`,
    );
  }
  if (!faults.length) {
    const n = report.wildcard ? "all" : String(report.enabledCount);
    return `Destination OK (${n} events)`;
  }
  return `${label} destination ${faults.join("; ")} — edit it in Stripe`;
}

/**
 * Read every endpoint from Stripe, with v2 scope merged in where it can be.
 * Throws on a v1 failure (the audit has nothing to say without it); swallows
 * a v2 failure (scope becomes null, the rest of the audit stands).
 */
export async function fetchDestinations(deps = {}) {
  const stripe = deps.stripe || liveStripe;
  const mode = keyMode(deps.secretKey ?? process.env.STRIPE_SECRET_KEY);
  const v1 = await stripe.webhookEndpoints.list({ limit: 100 });
  const endpoints = (v1?.data || []).map((e) => ({
    id: e.id,
    url: e.url,
    status: e.status,
    enabled_events: e.enabled_events || [],
    api_version: e.api_version || null,
    livemode: Boolean(e.livemode),
    scope: null,
  }));

  let scopeUnknown = false;
  try {
    const v2 = await stripe.v2.core.eventDestinations.list({ limit: 100 });
    const byId = new Map((v2?.data || []).map((d) => [d.id, d]));
    for (const ep of endpoints) {
      const d = byId.get(ep.id);
      const from = Array.isArray(d?.events_from) ? d.events_from : null;
      if (!from) continue;
      ep.scope = from.includes("other_accounts") ? "other_accounts" : from.includes("self") ? "self" : null;
    }
  } catch (err) {
    scopeUnknown = true;
    console.error("[stripeDestinations] v2 event destinations unavailable:", err?.message);
  }

  return { mode, endpoints, scopeUnknown };
}

function readCache(row) {
  const v = row?.value;
  if (!v || typeof v !== "object") return null;
  return {
    at: typeof v.at === "string" ? v.at : null,
    result: v.result && typeof v.result === "object" ? v.result : null,
    lastFlaggedAt: v.lastFlaggedAt && typeof v.lastFlaggedAt === "object" ? v.lastFlaggedAt : {},
  };
}

async function writeCache(db, value) {
  await db.platformSetting.upsert({
    where: { key: AUDIT_SETTING_KEY },
    update: { value },
    create: { key: AUDIT_SETTING_KEY, value },
  });
}

/**
 * The audit, cached for AUDIT_TTL_MS in PlatformSetting so the dashboard does
 * not call Stripe on every load. `force` skips the cache ("Re-check now", the
 * cron). `flag` files a platform error per misconfigured destination, at most
 * once per FLAG_INTERVAL_MS per destination — the cron passes it, the
 * dashboard does not, so a page refresh never spams the error log.
 *
 * Never throws: a Stripe outage becomes `{ error }` in the result, cached
 * like any other so a failing Stripe is not hit on every load either.
 *
 * @returns {Promise<{ at: string, mode: string, cached: boolean, error: string|null,
 *   scopeUnknown: boolean, billing: object|null, connect: object|null, flagged: string[] }>}
 */
export async function auditDestinations({ force = false, flag = false } = {}, deps = {}) {
  const db = deps.db || liveDb;
  const now = deps.now ? new Date(deps.now) : new Date();

  let cache = null;
  try {
    cache = readCache(await db.platformSetting.findUnique({ where: { key: AUDIT_SETTING_KEY } }));
  } catch (err) {
    console.error("[stripeDestinations] could not read the cached audit:", err?.message);
  }

  const fresh =
    !force && cache?.at && cache.result && now.getTime() - new Date(cache.at).getTime() < AUDIT_TTL_MS;
  if (fresh) return { ...cache.result, at: cache.at, cached: true, flagged: [] };

  let result;
  try {
    const { mode, endpoints, scopeUnknown } = await fetchDestinations(deps);
    result = { mode, scopeUnknown, error: null, ...compareDestinations(endpoints) };
  } catch (err) {
    result = {
      mode: keyMode(deps.secretKey ?? process.env.STRIPE_SECRET_KEY),
      scopeUnknown: true,
      error: `Stripe could not list the event destinations: ${err?.message || "unknown error"}`,
      billing: null,
      connect: null,
    };
  }

  const at = now.toISOString();
  const lastFlaggedAt = { ...(cache?.lastFlaggedAt || {}) };
  const flagged = [];
  if (flag && !result.error) {
    for (const name of DESTINATIONS) {
      const report = result[name];
      if (!report || report.ok) continue;
      const last = lastFlaggedAt[name] ? new Date(lastFlaggedAt[name]).getTime() : 0;
      if (now.getTime() - last < FLAG_INTERVAL_MS) continue;
      await recordError({
        area: ERROR_AREA,
        code: MISCONFIGURED_CODE,
        message: `Stripe ${report.summary} (${result.mode} mode). Until it is fixed this deployment receives none of the missing events and the affected rows drift until the next billing-sync.`,
        detail: {
          destination: name,
          id: report.id,
          url: report.url,
          status: report.status,
          scope: report.scope,
          problems: report.problems,
          missing: report.missing,
          duplicates: report.duplicates,
          apiVersion: report.apiVersion,
          mode: result.mode,
        },
      });
      lastFlaggedAt[name] = at;
      flagged.push(name);
    }
  }

  try {
    await writeCache(db, { at, result, lastFlaggedAt });
  } catch (err) {
    console.error("[stripeDestinations] could not cache the audit:", err?.message);
  }

  return { ...result, at, cached: false, flagged };
}
