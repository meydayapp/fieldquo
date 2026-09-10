// scripts/check-instant-quote-services.mjs
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-instant-quote-services.mjs
//
// "The instant quote is the reflection of pricing and offering in Services."
//
// It was not. Selling a trade created nothing, and the screen told the owner
// his two lists disagreed:
//
//   "You sell Roofing and can quote it instantly, but you never set it up."
//
// The fix is auto-provisioning, and auto-provisioning is one bad boundary away
// from the worst bug this codebase can ship: a homeowner quoted a price the
// contractor never set. AGENTS.md non-negotiable #4 and failure class #5. So
// the point of this file is NOT "does it switch things on" — that is one
// assertion. It is "what does it refuse to switch on", which is most of them.
//
// Everything here EXECUTES the shipped decision function against hostile input
// rather than reading the source and hoping. The two source assertions at the
// end are about wiring that has no pure entry point.

import { readFileSync } from "node:fs";
import {
  planInstantAutoEnable,
  instantAutoEnablePlan,
  seedIsCompanyStated,
} from "@/lib/estimate/instantQuoteProvision";
import { defaultDerivedSeed, seedInputsFor, deriveInstantSeed } from "@/lib/estimate/instantSeed";
import { applyDerivedSeed } from "@/lib/estimate/instantSeed";
import { INSTANT_ESTIMATE_DEFAULTS } from "@/lib/estimate/instantEstimate";
import { instantQuoteReadiness } from "@/lib/estimate/instantQuoteReadiness";

let pass = 0;
const failures = [];
// Label FIRST. Reversed, a non-empty string becomes the condition and nothing
// in this file could ever fail — the trap scripts/check-settings-load-guards
// documents.
const ok = (label, cond, detail) =>
  cond ? (pass++, undefined) : failures.push(detail === undefined ? label : `${label} — ${JSON.stringify(detail)}`);

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/* ══ 1. The refusals ══════════════════════════════════════════════════════ */

// A trade the company does not sell is never provisioned, however well it
// prices. This is the direction that costs money — quoting work nobody does.
ok(
  "a trade that is not one of their services is never auto-enabled",
  planInstantAutoEnable({
    trade: "cabinet_refinishing",
    offeredAsService: false,
    hasSavedRow: false,
    config: INSTANT_ESTIMATE_DEFAULTS.cabinet_refinishing,
    derived: { perDoor: 999 },
  }).enable === false,
);

// A row that exists is a decision already taken — including a row the owner
// deliberately switched OFF. Auto-provisioning must never undo it.
ok(
  "an existing row is left alone, enabled or not",
  planInstantAutoEnable({
    trade: "cabinet_refinishing",
    offeredAsService: true,
    hasSavedRow: true,
    config: INSTANT_ESTIMATE_DEFAULTS.cabinet_refinishing,
    derived: { perDoor: 999 },
  }).reason === "already_decided",
);

// ── The one that matters ──────────────────────────────────────────────────
//
// `deriveInstantSeed` runs over the company's rates merged onto FieldQuo's
// reference book, so it ALWAYS returns numbers. A company that has saved
// nothing derives ours. Publishing that would put FieldQuo's rate card in
// front of a stranger under the contractor's name.
for (const trade of ["cabinet_refinishing", "painting"]) {
  const reference = defaultDerivedSeed(trade);
  ok(`${trade}: the reference derivation exists (fixture is meaningful)`, Boolean(reference));
  ok(
    `${trade}: FieldQuo's own reference figures are NOT treated as the company's`,
    seedIsCompanyStated(trade, reference) === false,
  );
  const base = INSTANT_ESTIMATE_DEFAULTS[trade] ?? null;
  const asConfig = reference && base ? applyDerivedSeed(trade, base, reference) : base;
  // And it prices — so readiness alone would have said yes. The refusal above
  // is doing real work, not riding on a config that was broken anyway.
  ok(
    `${trade}: the reference config DOES price, so only the ownership test stops it`,
    instantQuoteReadiness(trade, asConfig).ok === true,
  );
  ok(
    `${trade}: a company that stated nothing is not auto-published`,
    planInstantAutoEnable({
      trade,
      offeredAsService: true,
      hasSavedRow: false,
      config: asConfig,
      derived: reference,
    }).reason === "no_own_price",
  );
}

// No derivation at all — roofing, stair, junk and the rest have no price book
// derivation, so nothing of the company's can be read. Never auto-published.
ok(
  "a trade with no derivation is never auto-enabled",
  planInstantAutoEnable({
    trade: "roofing",
    offeredAsService: true,
    hasSavedRow: false,
    config: INSTANT_ESTIMATE_DEFAULTS.roofing,
    derived: null,
  }).reason === "no_own_price",
);

// Stated their own price, but it does not produce a number. The shipped pricer
// gets the last word, so a green switch is always a promise the public route
// can keep.
{
  const trade = "cabinet_refinishing";
  const base = INSTANT_ESTIMATE_DEFAULTS[trade];
  const theirs = { ...base, perDoor: 0, perDrawer: 0, minCharge: 0 };
  const plan = planInstantAutoEnable({
    trade,
    offeredAsService: true,
    hasSavedRow: false,
    config: theirs,
    derived: { perDoor: 0, perDrawer: 0, minCharge: 0 },
  });
  ok("their own price that prices nothing is refused", plan.enable === false);
  ok(
    "and the refusal carries the readiness code, not a generic one",
    plan.reason === "no_per_door",
    plan,
  );
}

// Hostile input: nothing here may throw. This runs on every load of the
// settings screen for every company.
for (const bad of [null, undefined, {}, { trade: "nope" }, { trade: null, offeredAsService: true }]) {
  let threw = null;
  try {
    planInstantAutoEnable(bad);
  } catch (e) {
    threw = e?.message || String(e);
  }
  ok(`planInstantAutoEnable survives ${JSON.stringify(bad)}`, threw === null, threw);
}
for (const bad of [null, undefined, "nope", 7, [null, undefined, 3, "x"]]) {
  let threw = null;
  let out = null;
  try {
    out = instantAutoEnablePlan(bad);
  } catch (e) {
    threw = e?.message || String(e);
  }
  ok(`instantAutoEnablePlan survives ${JSON.stringify(bad)}`, threw === null, threw);
  ok(`instantAutoEnablePlan returns a list for ${JSON.stringify(bad)}`, Array.isArray(out));
}

/* ══ 2. The one case that SHOULD publish ══════════════════════════════════ */
//
// A company with its own per-door rate saved under Services & Pricing. Built
// through the real seeding path — seedInputsFor over a CompanyServiceCategory
// row carrying that company's `rates` — so this is the production pipeline,
// not a hand-made config.
{
  const trade = "cabinet_refinishing";
  // `perDoor` is the price book's own field name (cabinetFields() in
  // app/data/tradePriceBooks.js) — the same box the owner types into under
  // Services & Pricing. Written as `pricePerDoor` first, and this file caught
  // it: the derivation quietly returned FieldQuo's $150 and the plan refused,
  // which is the correct behaviour for a rate the company never saved.
  const rows = [{ key: "cabinet_refinishing", rates: { perDoor: 210 } }];
  const derived = deriveInstantSeed(trade, seedInputsFor(trade, rows));
  ok("a company's saved rate reaches the derivation", Boolean(derived));
  ok(
    "and is recognised as theirs, not ours",
    seedIsCompanyStated(trade, derived) === true,
  );
  const config = applyDerivedSeed(trade, INSTANT_ESTIMATE_DEFAULTS[trade], derived);
  const plan = planInstantAutoEnable({
    trade,
    offeredAsService: true,
    hasSavedRow: false,
    config,
    derived,
  });
  ok("a service they sell, priced with their own rate, goes live unasked", plan.enable === true, plan);
  ok(
    "and the config that would be saved carries THEIR number",
    Number(config?.perDoor) === 210,
    config?.perDoor,
  );
  // The whole-pass entry point agrees with the per-trade one.
  const batch = instantAutoEnablePlan([
    { trade, offeredAsService: true, hasSavedRow: false, config, derived },
    { trade: "roofing", offeredAsService: true, hasSavedRow: false, config: INSTANT_ESTIMATE_DEFAULTS.roofing, derived: null },
  ]);
  ok("the batch plan returns exactly the priceable one", batch.length === 1 && batch[0].trade === trade, batch);
}

/* ══ 3. Wiring with no pure entry point ═══════════════════════════════════ */

{
  const route = stripComments(read("app/api/settings/instant-quote/route.js"));

  ok(
    "the settings route runs the plan",
    /instantAutoEnablePlan\s*\(/.test(route),
  );
  // Non-negotiable #3: the platform console views everything and edits
  // nothing. A support session must not create a row in a customer's tenant.
  ok(
    "provisioning is closed to an impersonating session",
    /!member\.impersonation\s*&&\s*isPricingAdmin\(member\.role\)/.test(route),
  );
  // Created ENABLED is the whole point — a row created disabled would silence
  // the "needs your price" finding while changing nothing a homeowner sees.
  ok(
    "provisioned rows are created enabled",
    /instantQuoteConfig[\s\S]{0,200}?enabled:\s*true/.test(route),
  );
  // A client-facing change nobody clicked has to be findable afterwards.
  ok(
    "and the automatic switch-on is written to the activity log",
    /recordActivity\([\s\S]{0,120}?instant_quote_auto_enabled/.test(route),
  );
}

{
  const page = stripComments(read("app/app/settings/instant-quotes/page.js"));

  // The old screen folded both findings into "your lists don't match" and sent
  // the owner to Services. The "sold, not quoted" half is now a missing number
  // with a home, so it must link at the CARD.
  ok(
    "the sold-not-quoted finding links at the trade's own card",
    /href=\{`#trade-\$\{f\.trade\}`\}/.test(page),
  );
  // ...and that anchor has to exist, or it is a dead control.
  ok(
    "and the card carries that anchor",
    /id=\{`trade-\$\{trade\.trade\}`\}/.test(page),
  );
  // The reconciliation instruction must no longer be attached to the
  // sold-not-quoted rows.
  ok(
    "the two findings render as two separate panels",
    /quotedNotSold/.test(page) && /needsYourPrice/.test(page),
  );
}

console.log(
  `check-instant-quote-services: ${pass} passed, ${failures.length} failed`,
);
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
