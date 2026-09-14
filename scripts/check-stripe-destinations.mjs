// scripts/check-stripe-destinations.mjs
//
//   npm run check:stripe-destinations
//
// The two Stripe event destinations are checked by the deployment, against
// the events the code handles — never against a list a person typed.
//
// ══ The bug this guards ════════════════════════════════════════════════════
//
// 2026-09-12: the live billing destination was created with nine events,
// none of which a subscription produces. The required list was a table in
// docs/VERCEL.md; the owner compared it to a paste; nobody caught it; zero
// webhooks arrived for two days. The fix is not a better table. It is that
// the list is derived from the handlers and the deployment diffs Stripe's
// destinations against it (lib/platform/stripeDestinations.js).
//
// ══ What is EXECUTED ═══════════════════════════════════════════════════════
//
//   1. the `case "…"` labels of both handler switches, parsed from the
//      source, equal BILLING_EVENTS / CONNECT_EVENTS exactly — both ways;
//      every `event.type === "…"` literal in the billing route's POST is on
//      one of the billing lists, and every BILLING_ROUTE_EVENTS entry is
//      matched by such a literal
//   2. compareDestinations against fixtures: a correct pair, missing events,
//      extra events, disabled, apex host, preview host, duplicates, wrong
//      scope, wildcard, not found, unparsable url
//   3. auditDestinations against the db stub and a fake Stripe: cache hit
//      inside ten minutes, miss after, force bypass, a Stripe failure that
//      becomes `error` rather than a throw, the error row filed once per 24 h
//      per destination and only when flag is passed, v2 scope merged by id,
//      v2 failure tolerated
//   4. the billing-sync cron route runs the audit forced and flagged, and
//      answers it
//
// Source pins cover the rest: the health route serves GET cached / POST
// forced, the dashboard renders the second line and the Re-check button,
// the package script is wired, and docs/VERCEL.md says the list is derived.
//
// No billing-stub-loader: the Connect route's import graph reaches exports the
// Stripe stub does not carry, and none is needed — the real `@/lib/stripe` is
// lazy and every Stripe call here goes through an injected fake.
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs \
//           scripts/check-stripe-destinations.mjs

import { readFileSync } from "node:fs";
import {
  REQUIRED_EVENTS,
  OPTIONAL_EVENTS,
  DESTINATION_PATHS,
  CANONICAL_HOST,
  AUDIT_SETTING_KEY,
  AUDIT_TTL_MS,
  FLAG_INTERVAL_MS,
  MISCONFIGURED_CODE,
  keyMode,
  destinationForUrl,
  compareDestinations,
  describeDestination,
  fetchDestinations,
  auditDestinations,
} from "@/lib/platform/stripeDestinations";
import { BILLING_EVENTS } from "@/lib/platform/stripeBilling";
import { BILLING_ROUTE_EVENTS } from "@/app/api/platform/billing/webhook/route";
import { CONNECT_EVENTS } from "@/app/api/stripe/webhook/route";
import { rows, writes, resetDbStub } from "./fixtures/dbStub.mjs";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sameSet = (a, b) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);
const diff = (a, b) => ({ onlyInFirst: a.filter((x) => !b.includes(x)), onlyInSecond: b.filter((x) => !a.includes(x)) });

/**
 * The body of ONE function, brace-matched from its `function name(` — so a
 * `case` in a neighbouring function, or in the comment explaining why a case
 * must not exist, cannot satisfy or fail the assertion.
 */
function functionBody(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function ${name} not found`);
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`function ${name} never closes`);
}
const caseLabels = (body) => [...body.matchAll(/case "([a-z_.]+)":/g)].map((m) => m[1]);
const typeLiterals = (body) => [...body.matchAll(/event\.type === "([a-z_.]+)"/g)].map((m) => m[1]);

// ── 1. The constants ARE the switches ───────────────────────────────────────
console.log("\n── 1. the exported lists equal the handlers' case labels ───────");
{
  const billingSrc = stripComments(read("lib/platform/stripeBilling.js"));
  const billingCases = [...new Set(caseLabels(functionBody(billingSrc, "syncSubscriptionFromStripeEvent")))];
  ok("BILLING_EVENTS is non-empty and frozen", BILLING_EVENTS.length > 0 && Object.isFrozen(BILLING_EVENTS));
  ok("every case in syncSubscriptionFromStripeEvent is in BILLING_EVENTS, and vice versa", sameSet(billingCases, [...BILLING_EVENTS]), diff(billingCases, [...BILLING_EVENTS]));

  const connectSrc = stripComments(read("app/api/stripe/webhook/route.js"));
  const connectCases = [...new Set(caseLabels(functionBody(connectSrc, "POST")))];
  ok("CONNECT_EVENTS is non-empty and frozen", CONNECT_EVENTS.length > 0 && Object.isFrozen(CONNECT_EVENTS));
  ok("every case in the Connect POST is in CONNECT_EVENTS, and vice versa", sameSet(connectCases, [...CONNECT_EVENTS]), diff(connectCases, [...CONNECT_EVENTS]));

  const routeSrc = stripComments(read("app/api/platform/billing/webhook/route.js"));
  const routeLiterals = [...new Set(typeLiterals(functionBody(routeSrc, "POST")))];
  const billingUnion = [...BILLING_EVENTS, ...BILLING_ROUTE_EVENTS];
  ok("BILLING_ROUTE_EVENTS is non-empty and frozen", BILLING_ROUTE_EVENTS.length > 0 && Object.isFrozen(BILLING_ROUTE_EVENTS));
  ok("every `event.type ===` literal in the billing POST is on a billing list", routeLiterals.every((t) => billingUnion.includes(t)), routeLiterals.filter((t) => !billingUnion.includes(t)));
  ok("every BILLING_ROUTE_EVENTS entry is matched by a literal in the billing POST", BILLING_ROUTE_EVENTS.every((t) => routeLiterals.includes(t)), BILLING_ROUTE_EVENTS.filter((t) => !routeLiterals.includes(t)));
  ok("BILLING_ROUTE_EVENTS does not repeat BILLING_EVENTS", BILLING_ROUTE_EVENTS.every((t) => !BILLING_EVENTS.includes(t)));

  ok("REQUIRED_EVENTS.billing is the union, sorted, unique", sameSet(REQUIRED_EVENTS.billing, [...new Set(billingUnion)]) && REQUIRED_EVENTS.billing.join() === [...REQUIRED_EVENTS.billing].sort().join());
  ok("REQUIRED_EVENTS.connect is CONNECT_EVENTS, sorted", sameSet(REQUIRED_EVENTS.connect, [...CONNECT_EVENTS]));
  ok("every optional event is a required one (an exemption, not a third list)", Object.entries(OPTIONAL_EVENTS).every(([k, list]) => list.every((e) => REQUIRED_EVENTS[k].includes(e))));
  ok("15 billing events, 10 connect — what docs/VERCEL.md used to type by hand", REQUIRED_EVENTS.billing.length === 15 && REQUIRED_EVENTS.connect.length === 10, { b: REQUIRED_EVENTS.billing.length, c: REQUIRED_EVENTS.connect.length });
}

// ── 2. compareDestinations against fixtures ─────────────────────────────────
console.log("\n── 2. compareDestinations ──────────────────────────────────────");
const BILLING_URL = `https://${CANONICAL_HOST}${DESTINATION_PATHS.billing}`;
const CONNECT_URL = `https://${CANONICAL_HOST}${DESTINATION_PATHS.connect}`;
const good = (over = {}) => [
  { id: "we_b", url: BILLING_URL, status: "enabled", enabled_events: [...REQUIRED_EVENTS.billing], api_version: "2026-06-24.dahlia", scope: "self", ...over.billing },
  { id: "we_c", url: CONNECT_URL, status: "enabled", enabled_events: [...REQUIRED_EVENTS.connect], api_version: "2026-06-24.dahlia", scope: "self", ...over.connect },
];
{
  ok("keyMode: sk_live_ → live", keyMode("sk_live_abc") === "live");
  ok("keyMode: sk_test_ → test", keyMode("sk_test_abc") === "test");
  ok("keyMode: rk_live_ (restricted) → live", keyMode("rk_live_abc") === "live");
  ok("keyMode: unset → unknown", keyMode(undefined) === "unknown" && keyMode("") === "unknown");

  ok("destinationForUrl: canonical billing", JSON.stringify(destinationForUrl(BILLING_URL)) === JSON.stringify({ name: "billing", host: CANONICAL_HOST, canonical: true }));
  ok("destinationForUrl: apex is the destination, not canonical", destinationForUrl(`https://fieldquo.com${DESTINATION_PATHS.connect}`)?.canonical === false);
  ok("destinationForUrl: trailing slash tolerated", destinationForUrl(`${BILLING_URL}/`)?.name === "billing");
  ok("destinationForUrl: another route is nobody's", destinationForUrl("https://www.fieldquo.com/api/webhooks/resend-inbound") === null);
  ok("destinationForUrl: garbage is nobody's", destinationForUrl("not a url") === null && destinationForUrl(null) === null);

  const r = compareDestinations(good());
  ok("correct pair: both ok, no problems", r.billing.ok && r.connect.ok && r.billing.problems.length === 0 && r.connect.problems.length === 0, r);
  ok("correct pair: green sentence carries the count", r.billing.summary === "Destination OK (15 events)" && r.connect.summary === "Destination OK (10 events)", [r.billing.summary, r.connect.summary]);
  ok("correct pair: id, url, status, apiVersion, scope reported", r.billing.id === "we_b" && r.billing.url === BILLING_URL && r.billing.status === "enabled" && r.billing.apiVersion === "2026-06-24.dahlia" && r.billing.scope === "self");

  // The real 2026-09-12 shape: six subscription-ish events, nothing else.
  const owner = compareDestinations(good({ billing: { enabled_events: ["checkout.session.completed", "customer.subscription.created", "customer.subscription.deleted", "customer.subscription.updated", "invoice.payment_succeeded", "invoice.payment_failed"] } }));
  ok("missing: found, not ok, problem is missing_events", owner.billing.found && !owner.billing.ok && sameSet(owner.billing.problems, ["missing_events"]), owner.billing.problems);
  ok("missing: lists exactly the nine absent events, sorted", sameSet(owner.billing.missing, ["charge.dispute.closed", "charge.dispute.created", "charge.dispute.updated", "charge.refunded", "checkout.session.async_payment_failed", "checkout.session.async_payment_succeeded", "subscription_schedule.canceled", "subscription_schedule.completed", "subscription_schedule.released"]), owner.billing.missing);
  ok("missing: the sentence names them and says where to fix it", /^Billing destination is missing: charge\.dispute\.closed, .* — edit it in Stripe$/.test(owner.billing.summary), owner.billing.summary);
  ok("missing: the other destination is untouched", owner.connect.ok);

  const extra = compareDestinations(good({ connect: { enabled_events: [...REQUIRED_EVENTS.connect, "payout.paid", "balance.available"] } }));
  ok("extra: still ok — an ignored event is noise, not a fault", extra.connect.ok && sameSet(extra.connect.extra, ["balance.available", "payout.paid"]), extra.connect);
  ok("extra: count is what Stripe sends, not what we need", extra.connect.enabledCount === 12);

  const disabled = compareDestinations(good({ billing: { status: "disabled" } }));
  ok("disabled: problem is disabled, sentence says so", sameSet(disabled.billing.problems, ["disabled"]) && /Billing destination is disabled — edit it in Stripe/.test(disabled.billing.summary), disabled.billing);

  const apex = compareDestinations([{ ...good()[0], url: `https://fieldquo.com${DESTINATION_PATHS.billing}` }, good()[1]]);
  ok("apex host: found (not 'not found'), problem is wrong_host", apex.billing.found && sameSet(apex.billing.problems, ["wrong_host"]), apex.billing.problems);
  ok("apex host: the sentence names both hosts", /points at fieldquo\.com, not www\.fieldquo\.com/.test(apex.billing.summary), apex.billing.summary);

  const preview = compareDestinations([good()[0], { ...good()[1], url: `https://fieldquo-git-main-x.vercel.app${DESTINATION_PATHS.connect}` }]);
  ok("preview host: wrong_host", sameSet(preview.connect.problems, ["wrong_host"]) && /vercel\.app/.test(preview.connect.summary), preview.connect.summary);

  const dup = compareDestinations([...good(), { id: "we_b2", url: BILLING_URL, status: "enabled", enabled_events: ["checkout.session.completed"], api_version: "2020-08-27", scope: "self" }]);
  ok("duplicate: the complete, canonical one is primary", dup.billing.id === "we_b" && dup.billing.missing.length === 0);
  ok("duplicate: the other is listed and flagged", sameSet(dup.billing.problems, ["duplicate"]) && dup.billing.duplicates.length === 1 && dup.billing.duplicates[0].id === "we_b2", dup.billing);
  ok("duplicate: the sentence names the duplicate's id", /has 1 duplicate on the same route \(we_b2\)/.test(dup.billing.summary), dup.billing.summary);

  const dupApex = compareDestinations([...good(), { id: "we_apex", url: `https://fieldquo.com${DESTINATION_PATHS.billing}`, status: "disabled", enabled_events: [], api_version: null, scope: null }]);
  ok("duplicate at the apex, disabled: canonical stays primary, the apex is the duplicate", dupApex.billing.id === "we_b" && dupApex.billing.duplicates[0].id === "we_apex" && /we_apex, disabled/.test(dupApex.billing.summary), dupApex.billing.summary);

  const scope = compareDestinations(good({ connect: { scope: "other_accounts" } }));
  ok("wrong scope: the five-bookings mistake is a problem", sameSet(scope.connect.problems, ["wrong_scope"]) && /"Connected accounts", not "Your account"/.test(scope.connect.summary), scope.connect.summary);
  const noScope = compareDestinations(good({ connect: { scope: null } }));
  ok("unknown scope: not a problem (v2 unavailable is not a misconfiguration)", noScope.connect.ok && noScope.connect.scope === null);

  const wild = compareDestinations(good({ billing: { enabled_events: ["*"] } }));
  ok("wildcard: ok, nothing missing, sentence says all", wild.billing.ok && wild.billing.wildcard && wild.billing.missing.length === 0 && wild.billing.summary === "Destination OK (all events)", wild.billing);

  const optional = compareDestinations(good({ connect: { enabled_events: REQUIRED_EVENTS.connect.filter((e) => e !== "account.updated") } }));
  ok("optional: a Connect destination without account.updated is ok, and says which it lacks", optional.connect.ok && sameSet(optional.connect.optionalMissing, ["account.updated"]) && optional.connect.missing.length === 0, optional.connect);

  const none = compareDestinations([]);
  ok("not found: both reported absent with the expected url", !none.billing.found && !none.connect.found && sameSet(none.billing.problems, ["not_found"]) && none.billing.expectedUrl === BILLING_URL, none.billing);
  ok("not found: the sentence says where to create it", /Billing destination not found at https:\/\/www\.fieldquo\.com\/api\/platform\/billing\/webhook — create it in Stripe/.test(none.billing.summary), none.billing.summary);
  const onlyBilling = compareDestinations([good()[0]]);
  ok("one of two: the present one ok, the absent one not_found", onlyBilling.billing.ok && !onlyBilling.connect.found);

  const junk = compareDestinations([{ id: "we_x", url: "://nope", status: "enabled", enabled_events: [] }, { id: "we_y", url: "https://www.fieldquo.com/somewhere/else", status: "enabled", enabled_events: ["*"] }, null, undefined]);
  ok("hostile input: junk urls, nulls and unrelated routes match nothing and throw nothing", !junk.billing.found && !junk.connect.found);
  ok("hostile input: a non-array answers not_found rather than throwing", !compareDestinations(undefined).billing.found && !compareDestinations("x").connect.found);

  const multi = compareDestinations(good({ billing: { status: "disabled", enabled_events: ["invoice.paid"], scope: "other_accounts" }, connect: {} }));
  ok("several faults at once: all listed, one sentence", sameSet(multi.billing.problems, ["disabled", "wrong_scope", "missing_events"]) && /is disabled; listens to .*; is missing: /.test(multi.billing.summary), multi.billing.summary);
  ok("describeDestination is what compare wrote", describeDestination("billing", multi.billing) === multi.billing.summary);
}

// ── 3. auditDestinations: fetch, cache, flag ────────────────────────────────
console.log("\n── 3. auditDestinations against a fake Stripe and the db stub ──");
function fakeStripe({ v1, v2, v1Throws, v2Throws } = {}) {
  const calls = [];
  return {
    calls,
    webhookEndpoints: {
      list: async (params) => {
        calls.push(["v1", params]);
        if (v1Throws) throw new Error(v1Throws);
        return { data: v1 || [], has_more: false };
      },
    },
    v2: {
      core: {
        eventDestinations: {
          list: async (params) => {
            calls.push(["v2", params]);
            if (v2Throws) throw new Error(v2Throws);
            return { data: v2 || [] };
          },
        },
      },
    },
  };
}
const v1Good = () => good().map(({ scope, ...e }) => ({ ...e, livemode: true, object: "webhook_endpoint" }));
const v2Good = () => [
  { id: "we_b", events_from: ["self"], event_payload: "snapshot" },
  { id: "we_c", events_from: ["self"], event_payload: "snapshot" },
];
const T0 = new Date("2026-09-14T12:00:00Z");
const errorRows = () => writes.filter((w) => w.model === "platformErrorLog" && w.action === "create");
const settingWrites = () => writes.filter((w) => w.model === "platformSetting");
const cacheRow = () => rows.platformSetting.find((r) => r.key === AUDIT_SETTING_KEY);
{
  resetDbStub();
  const stripe = fakeStripe({ v1: v1Good(), v2: v2Good() });
  const f = await fetchDestinations({ stripe, secretKey: "sk_live_x" });
  ok("fetch: v1 asked with limit 100", stripe.calls[0][0] === "v1" && stripe.calls[0][1]?.limit === 100, stripe.calls);
  ok("fetch: mode from the key prefix", f.mode === "live");
  ok("fetch: v2 scope merged by id", f.endpoints.every((e) => e.scope === "self") && f.scopeUnknown === false, f.endpoints);

  const other = fakeStripe({ v1: v1Good(), v2: [{ id: "we_c", events_from: ["other_accounts"] }] });
  const f2 = await fetchDestinations({ stripe: other, secretKey: "sk_test_x" });
  ok("fetch: other_accounts lands on the right endpoint, the unmatched one stays null", f2.endpoints.find((e) => e.id === "we_c").scope === "other_accounts" && f2.endpoints.find((e) => e.id === "we_b").scope === null && f2.mode === "test");

  const v2Down = fakeStripe({ v1: v1Good(), v2Throws: "v2 not enabled" });
  const f3 = await fetchDestinations({ stripe: v2Down, secretKey: "sk_live_x" });
  ok("fetch: a v2 failure is tolerated — endpoints still listed, scopeUnknown true", f3.endpoints.length === 2 && f3.scopeUnknown === true && f3.endpoints.every((e) => e.scope === null));

  let threw = null;
  try {
    await fetchDestinations({ stripe: fakeStripe({ v1Throws: "no key" }), secretKey: "" });
  } catch (err) {
    threw = err.message;
  }
  ok("fetch: a v1 failure throws (nothing to audit without it)", threw === "no key", threw);

  // Cold: no cache → Stripe is called, result cached, nothing flagged.
  resetDbStub();
  const cold = fakeStripe({ v1: v1Good(), v2: v2Good() });
  const a1 = await auditDestinations({}, { stripe: cold, db: (await import("./fixtures/dbStub.mjs")).db, now: T0, secretKey: "sk_live_x" });
  ok("audit cold: not cached, Stripe called, both ok", a1.cached === false && cold.calls.length === 2 && a1.billing.ok && a1.connect.ok && a1.error === null, a1);
  ok("audit cold: at is the injected clock, mode live", a1.at === T0.toISOString() && a1.mode === "live");
  ok("audit cold: written to PlatformSetting under the documented key", cacheRow()?.value?.at === T0.toISOString() && cacheRow()?.value?.result?.billing?.ok === true, cacheRow());
  ok("audit cold: no error row without flag", errorRows().length === 0);

  // Warm, 9 minutes later: served from cache, Stripe NOT called.
  const { db } = await import("./fixtures/dbStub.mjs");
  const warm = fakeStripe({ v1: [], v2: [] });
  const a2 = await auditDestinations({}, { stripe: warm, db, now: new Date(T0.getTime() + 9 * 60 * 1000), secretKey: "sk_live_x" });
  ok("audit warm: cached, Stripe not called, the cached answer (ok) served", a2.cached === true && warm.calls.length === 0 && a2.billing.ok && a2.at === T0.toISOString(), a2);

  // Forced at the same instant: Stripe called again despite the cache.
  const forced = fakeStripe({ v1: [], v2: [] });
  const a3 = await auditDestinations({ force: true }, { stripe: forced, db, now: new Date(T0.getTime() + 9 * 60 * 1000), secretKey: "sk_live_x" });
  ok("audit forced: cache bypassed, the new (empty) answer wins", a3.cached === false && forced.calls.length === 2 && !a3.billing.found, a3.billing);

  // Stale, 11 minutes after the forced one: Stripe called.
  const stale = fakeStripe({ v1: v1Good(), v2: v2Good() });
  const a4 = await auditDestinations({}, { stripe: stale, db, now: new Date(T0.getTime() + 20 * 60 * 1000 + 1), secretKey: "sk_live_x" });
  ok("audit stale: cache older than AUDIT_TTL_MS is refreshed", a4.cached === false && stale.calls.length === 2 && a4.billing.ok, { ttl: AUDIT_TTL_MS, a4 });

  // Stripe down: error in the answer, not a throw; cached like any other.
  const down = fakeStripe({ v1Throws: "Invalid API Key provided" });
  const a5 = await auditDestinations({ force: true, flag: true }, { stripe: down, db, now: new Date(T0.getTime() + 30 * 60 * 1000), secretKey: "sk_live_x" });
  ok("audit down: error sentence, null destinations, nothing flagged", /Stripe could not list the event destinations: Invalid API Key/.test(a5.error) && a5.billing === null && a5.connect === null && a5.flagged.length === 0 && errorRows().length === 0, a5);
  ok("audit down: cached so a failing Stripe is not hit on every load", cacheRow()?.value?.result?.error === a5.error);

  // Flag: misconfigured + flag → one error row per bad destination, stamped.
  resetDbStub();
  const bad = () => fakeStripe({
    v1: [
      { ...v1Good()[0], enabled_events: ["checkout.session.completed", "customer.subscription.created", "customer.subscription.deleted", "customer.subscription.updated", "invoice.payment_succeeded", "invoice.payment_failed"] },
      { ...v1Good()[1], status: "disabled" },
    ],
    v2: v2Good(),
  });
  const b1 = await auditDestinations({ force: true, flag: true }, { stripe: bad(), db, now: T0, secretKey: "sk_live_x" });
  ok("flag: both destinations flagged, two error rows", sameSet(b1.flagged, ["billing", "connect"]) && errorRows().length === 2, { flagged: b1.flagged, rows: errorRows().length });
  const row = errorRows()[0].data;
  ok("flag: area billing, the documented code, the same sentence the dashboard shows", row.area === "billing" && row.code === MISCONFIGURED_CODE && row.message.includes(b1.billing.summary) && /live mode/.test(row.message), row);
  ok("flag: detail carries destination, id, url, problems, missing", row.detail.destination === "billing" && row.detail.id === "we_b" && row.detail.url === BILLING_URL && sameSet(row.detail.problems, ["missing_events"]) && row.detail.missing.length === 9, row.detail);
  ok("flag: lastFlaggedAt stamped per destination in the SAME setting", cacheRow()?.value?.lastFlaggedAt?.billing === T0.toISOString() && cacheRow()?.value?.lastFlaggedAt?.connect === T0.toISOString(), cacheRow()?.value);

  // Six hours later, still broken: the cron runs again, no new row.
  const b2 = await auditDestinations({ force: true, flag: true }, { stripe: bad(), db, now: new Date(T0.getTime() + 6 * 3600 * 1000), secretKey: "sk_live_x" });
  ok("flag: six hours on, still broken, NOT filed again", b2.flagged.length === 0 && errorRows().length === 2 && !b2.billing.ok, b2.flagged);
  ok("flag: …but the audit itself is fresh and cached", b2.cached === false && cacheRow()?.value?.at === new Date(T0.getTime() + 6 * 3600 * 1000).toISOString());

  // 24 h + 1 ms later: filed again.
  const b3 = await auditDestinations({ force: true, flag: true }, { stripe: bad(), db, now: new Date(T0.getTime() + FLAG_INTERVAL_MS + 1), secretKey: "sk_live_x" });
  ok("flag: after FLAG_INTERVAL_MS it is filed again", sameSet(b3.flagged, ["billing", "connect"]) && errorRows().length === 4);

  // Connect fixed, billing not: only billing refiles next day.
  const halfFixed = fakeStripe({ v1: [{ ...v1Good()[0], enabled_events: ["checkout.session.completed"] }, v1Good()[1]], v2: v2Good() });
  const b4 = await auditDestinations({ force: true, flag: true }, { stripe: halfFixed, db, now: new Date(T0.getTime() + 2 * FLAG_INTERVAL_MS + 2), secretKey: "sk_live_x" });
  ok("flag: a fixed destination is not filed; the broken one still is", sameSet(b4.flagged, ["billing"]) && b4.connect.ok && errorRows().length === 5, b4.flagged);

  // Dashboard path: flag false → never files, even when broken and stale.
  resetDbStub();
  const b5 = await auditDestinations({ force: true, flag: false }, { stripe: bad(), db, now: T0, secretKey: "sk_live_x" });
  ok("dashboard path (flag false): broken, but no error row and no stamp", !b5.billing.ok && b5.flagged.length === 0 && errorRows().length === 0 && Object.keys(cacheRow()?.value?.lastFlaggedAt || {}).length === 0);

  // A corrupt cache row is ignored, not fatal.
  resetDbStub();
  rows.platformSetting.push({ key: AUDIT_SETTING_KEY, value: "garbage" });
  const c1 = await auditDestinations({}, { stripe: fakeStripe({ v1: v1Good(), v2: v2Good() }), db, now: T0, secretKey: "sk_live_x" });
  ok("corrupt cache: treated as absent, Stripe asked, row rewritten", c1.cached === false && c1.billing.ok && cacheRow()?.value?.at === T0.toISOString() && settingWrites().length === 1);
}

// ── 4. The callers ──────────────────────────────────────────────────────────
console.log("\n── 4. the cron, the health route, the dashboard, the docs ──────");
{
  const cron = stripComments(read("app/api/cron/billing-sync/route.js"));
  ok("billing-sync cron runs the audit forced AND flagged, after the drift loop", /auditDestinations\(\{ force: true, flag: true \}\)/.test(cron) && cron.indexOf("auditDestinations(") > cron.indexOf("for (const row of rows)"));
  ok("…and answers it", /destinations \}\);/.test(cron) || /\.\.\.summary, destinations/.test(cron));

  const health = stripComments(read("app/api/platform/webhook-health/route.js"));
  ok("webhook-health GET serves the cache, POST forces; neither flags", /GET\(request\)[\s\S]*force: false/.test(health) && /POST\(request\)[\s\S]*force: true/.test(health) && /flag: false/.test(health) && !/flag: true/.test(health));
  ok("webhook-health still requires a platform admin", /getCurrentPlatformAdmin\(request\)/.test(health) && /status: 401/.test(health));
  ok("webhook-health answers `destinations`", /destinations,?\s*\}\)/.test(health) || /destinations\s*,/.test(health));

  const dash = read("app/platform/page.js");
  ok("the dashboard renders the destination summary per endpoint", /webhookHealth\.destinations/.test(dash) && /d\.summary/.test(dash));
  ok("the dashboard's Re-check now POSTs the health route", /fetch\("\/api\/platform\/webhook-health", \{ method: "POST" \}\)/.test(dash) && /Re-check now/.test(dash));
  ok("the dashboard goes red on a bad destination, not only on 'never'", /webhookHealth\.healthy && destinationsOk/.test(dash));
  ok("the dashboard says when the key is test-mode", /Test-mode key — this is not the live account/.test(dash));

  const pkg = JSON.parse(read("package.json"));
  ok("package.json wires check:stripe-destinations with the alias and db-stub loaders", /alias-loader\.mjs.*db-stub-loader\.mjs.*check-stripe-destinations\.mjs/.test(pkg.scripts["check:stripe-destinations"] || ""), pkg.scripts["check:stripe-destinations"]);

  const docs = read("docs/VERCEL.md");
  ok("docs/VERCEL.md says the events are derived from code and verified on /platform", /derived from code/i.test(docs) && /verified on `?\/platform`?/i.test(docs));
  ok("docs/VERCEL.md no longer carries the hand-typed billing list as the source", !/\| Events \| `checkout\.session\.completed`, `checkout\.session\.async_payment_succeeded`/.test(docs));
  ok("docs/VERCEL.md names the error code", new RegExp(MISCONFIGURED_CODE).test(docs));
}

console.log(`\n${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  ✗ ${f}`);
process.exit(fails.length ? 1 : 0);
