#!/usr/bin/env node
//
// scripts/check-demo-spend.mjs
//
// A sales demo must never spend real money.
//
// ══ Why this is a build check and not a code review note ═══════════════════
//
// Every one of these paths was correct for a real company and catastrophic for
// a demo, which is exactly the shape that survives review: nothing looks wrong
// in the diff, because nothing IS wrong for the caller the author had in mind.
// lib/voice/demoLine.js found this first on the Retell side and fixed it there;
// the identical hazard sat unguarded in crew texting and in both top-up routes
// for as long as those existed. A demo could buy a real, billable Twilio number
// that survived every reset, and a rep could open a real Stripe Checkout on a
// walkthrough.
//
// ══ Why ORDER is asserted, not just presence ═══════════════════════════════
//
// A demo check that runs after the vendor call is not a check. So each rule
// below asserts the guard appears BEFORE the spend. That is the property that
// actually holds the money, and it is the one a later refactor is most likely
// to break without noticing.
//
// ══ Why every rule is scoped to ONE function ═══════════════════════════════
//
// The first version of this file searched whole files, and mutation testing
// caught it passing when purchaseCrewLine's guard had been deleted outright —
// because claimCrewLine's guard, a few hundred lines earlier, matched the same
// string and satisfied the ordering. A check that cannot fail is worse than no
// check, since it reads as proof. So each rule names its function and only the
// text between that signature and the next top-level export is searched.
import { readFileSync } from "node:fs";

const RULES = [
  {
    file: "lib/crew/line.js",
    fn: "purchaseCrewLine",
    what: "purchaseCrewLine refuses before it reaches Twilio",
    guard: "isDemoCompany(companyId)",
    spend: "twilioRest.incomingPhoneNumbers.create(",
  },
  {
    file: "lib/crew/line.js",
    fn: "claimCrewLine",
    what: "claimCrewLine refuses before it inspects FieldQuo's own numbers",
    guard: "isDemoCompany(companyId)",
    spend: "twilioNumberState(normalised)",
  },
  {
    file: "app/api/settings/voice/topup/route.js",
    fn: "POST",
    what: "a voice top-up never reaches Stripe Checkout",
    guard: "company.isDemo",
    spend: "stripe.checkout.sessions.create(",
  },
  {
    file: "app/api/settings/ai/topup/route.js",
    fn: "POST",
    what: "an AI top-up never reaches Stripe Checkout",
    guard: "company.isDemo",
    spend: "stripe.checkout.sessions.create(",
  },
];

/**
 * The source of ONE exported function: from its signature to the next
 * top-level `export`, or end of file. Crude on purpose — this is a guard
 * check, not a parser, and every file it reads is one this repo controls.
 */
function functionSource(src, name, file) {
  const sig = new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`);
  const m = sig.exec(src);
  if (!m) return null;
  const start = m.index;
  const next = src.indexOf("\nexport ", start + m[0].length);
  return src.slice(start, next === -1 ? src.length : next);
}

// Presence-only rules: there is no "spend" line to order against, because the
// protection IS the query.
const PRESENT = [
  {
    file: "app/api/cron/voice-auto-topup/route.js",
    what: "the unattended auto-top-up cron cannot see a demo company",
    needle: "company: { isDemo: false }",
  },
  {
    file: "lib/demo/seedDemo.js",
    what: "a reset clears SIMULATED crew lines only, so no real number is orphaned",
    needle: 'db.crewInboxNumber.deleteMany({ where: { companyId, provider: "simulated" } })',
  },
  {
    file: "lib/crew/capability.js",
    what: 'a "simulated" provider has no path to sending a real text',
    needle: 'SMS_CAPABLE_PROVIDERS = new Set(["twilio"])',
  },
];

const failures = [];

for (const rule of RULES) {
  let src;
  try {
    src = readFileSync(rule.file, "utf8");
  } catch {
    failures.push(`${rule.file} — cannot be read. ${rule.what}`);
    continue;
  }
  const body = functionSource(src, rule.fn, rule.file);
  if (body === null) {
    failures.push(
      `${rule.file} — no exported function \`${rule.fn}\`. Renamed? This rule can no longer prove anything.`,
    );
    continue;
  }
  const g = body.indexOf(rule.guard);
  const s = body.indexOf(rule.spend);
  if (g === -1) {
    failures.push(`${rule.file} ${rule.fn}() — the demo guard \`${rule.guard}\` is gone. ${rule.what}`);
    continue;
  }
  if (s === -1) {
    // The spend moved or was renamed. That may be fine, but this check can no
    // longer prove the ordering, and silently passing would be worse than
    // failing: the whole point is that it holds when someone refactors.
    failures.push(
      `${rule.file} ${rule.fn}() — \`${rule.spend}\` is no longer here, so this check can't prove the demo guard still comes first. Re-point the rule.`,
    );
    continue;
  }
  if (g > s) {
    failures.push(
      `${rule.file} ${rule.fn}() — the demo guard runs AFTER \`${rule.spend}\`. That is not a guard. ${rule.what}`,
    );
  }
}

for (const rule of PRESENT) {
  let src;
  try {
    src = readFileSync(rule.file, "utf8");
  } catch {
    failures.push(`${rule.file} — cannot be read. ${rule.what}`);
    continue;
  }
  if (!src.includes(rule.needle)) {
    failures.push(`${rule.file} — missing: ${rule.needle}\n    ${rule.what}`);
  }
}

if (failures.length) {
  console.error("check:demo-spend FAILED\n");
  for (const f of failures) console.error("  ✗ " + f);
  console.error(
    "\nA demo account must never buy a number or reach Stripe. See lib/demo/simulatedSpend.js.",
  );
  process.exit(1);
}

console.log(
  `check:demo-spend passed — ${RULES.length} ordered guards, ${PRESENT.length} structural guarantees.`,
);
