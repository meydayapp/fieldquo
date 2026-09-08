// scripts/check-setup-steps.mjs
//
//   npm run check:setup-steps
//
// The dashboard's "Additional set-up steps" card (lib/setupSteps.js).
//
// ══ What is EXECUTED ═══════════════════════════════════════════════════════
//
//   1. stepsFor() against fixtures. A snapshot with nothing in it leaves all
//      ten steps undone; each signal, set on its own, flips exactly ITS step
//      and no other; a dismissed key hides its step and an unknown key is
//      dropped; a done step is removed from what the card shows; an absent or
//      null signal (the import column before `prisma generate`) is NOT done;
//      a signal that throws is not done. The owner's rule — removed when
//      measured, never ticked — lives in these assertions.
//   2. withSetupParam(): the query lands BEFORE the fragment, or both halves
//      of every link die at once (see the function's comment).
//
// ══ What is read from source, and why that is enough here ════════════════
//
//   3. Every href's `#anchor` names an id that exists in the target page —
//      the difference between "takes them to that section" and "opens the
//      page". A link to /app/jobs/import with no page behind it fails too.
//   4. Every target page imports AND renders <BackToHome />.
//   5. The routes are gated (`user:manage`, the same rule the settings screens
//      they lead to enforce) and write only to the caller's own company. The
//      handlers use the shared helpers whose refusals are executed elsewhere
//      (scripts/check-ungated-routes.mjs, check-tenant-scope.mjs); what this
//      file asserts is that THESE two files go through them.
//   6. The dashboard draws the card behind the same gate, under the
//      onboarding card.
//   7. Every app.setup.* key the card, the link and the step titles ask for
//      exists in all nine language blocks.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-setup-steps.mjs

import { readFileSync, existsSync } from "node:fs";
import {
  SETUP_STEPS,
  SETUP_STEP_KEYS,
  stepsFor,
  remainingSteps,
  normaliseDismissed,
  withSetupParam,
  isUntouchedStandardAddOn,
} from "@/lib/setupSteps";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const failures = [];
const ok = (label, condition, detail) => {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
  }
};
const source = (p) => readFileSync(p, "utf8");
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. stepsFor(), executed\n");

const EXPECTED_KEYS = [
  "overhead",
  "payment_schedule",
  "quote_process",
  "ai_credits",
  "instant_quotes",
  "availability",
  "materials",
  "add_ons",
  "emails",
  "import_jobs",
];
ok(
  "the ten steps, in the owner's order",
  JSON.stringify(SETUP_STEP_KEYS) === JSON.stringify(EXPECTED_KEYS),
  SETUP_STEP_KEYS.join(","),
);

const EMPTY = {
  dismissed: null,
  overheadFixedCosts: 0,
  overheadSalaries: 0,
  overheadDebts: 0,
  overheadAssets: 0,
  paymentScheduleStages: 0,
  enabledCategories: [],
  aiCreditCents: 0,
  aiCreditBundle: false,
  instantQuotesEnabled: 0,
  bookableScheduleRows: 0,
  materialRecipeSettings: 0,
  products: [],
  emailDomainVerified: false,
  editedEmailTemplates: 0,
  quoteEmailSectionsOn: false,
  historicalImports: 0,
};

{
  const steps = stepsFor(EMPTY);
  ok("an empty company has all ten steps undone", steps.every((s) => !s.done && !s.dismissed));
  ok("…and all ten on the card", remainingSteps(steps).length === 10);
  ok("a snapshot with NOTHING in it (every signal absent) is also all-undone", stepsFor({}).every((s) => !s.done));
  ok("a null snapshot does not throw", (() => { try { return stepsFor(undefined).length === 10; } catch { return false; } })());
}

// Each signal on its own flips exactly one step. The table is the contract:
// a new signal that flips two steps, or none, fails here.
const FLIPS = [
  ["overheadFixedCosts", 1, "overhead"],
  ["overheadSalaries", 1, "overhead"],
  ["overheadDebts", 1, "overhead"],
  ["overheadAssets", 1, "overhead"],
  ["paymentScheduleStages", 1, "payment_schedule"],
  ["enabledCategories", [{ processSteps: [{ title: "Prep", body: "Mask and sand" }] }], "quote_process"],
  ["enabledCategories", [{ includedItems: ["Two coats"] }], "quote_process"],
  ["enabledCategories", [{ scopeDescription: "Full refinish" }], "quote_process"],
  ["aiCreditCents", 500, "ai_credits"],
  ["aiCreditBundle", true, "ai_credits"],
  ["instantQuotesEnabled", 1, "instant_quotes"],
  ["bookableScheduleRows", 1, "availability"],
  ["materialRecipeSettings", 1, "materials"],
  ["enabledCategories", [{ rates: { perDoor: 120 } }], "materials"],
  ["products", [{ name: "Site clean-up", unitPrice: 150, active: true }], "add_ons"],
  ["emailDomainVerified", true, "emails"],
  ["editedEmailTemplates", 1, "emails"],
  ["quoteEmailSectionsOn", true, "emails"],
  ["historicalImports", 3, "import_jobs"],
];
for (const [field, value, expectKey] of FLIPS) {
  const steps = stepsFor({ ...EMPTY, [field]: value });
  const done = steps.filter((s) => s.done).map((s) => s.key);
  ok(
    `${field}=${JSON.stringify(value).slice(0, 40)} flips only "${expectKey}"`,
    done.length === 1 && done[0] === expectKey,
    done.join(",") || "nothing",
  );
}

// The signals that must NOT count, each for a stated reason.
{
  let s = stepsFor({ ...EMPTY, enabledCategories: [{ processSteps: [], includedItems: [], scopeDescription: "  ", rates: null }] });
  ok("empty wording overrides are not a review", !s.find((x) => x.key === "quote_process").done);
  ok("a null rate card is not a saved override", !s.find((x) => x.key === "materials").done);

  s = stepsFor({ ...EMPTY, products: [{ name: "Soft-Close Hinges", unitPrice: 35, active: true }] });
  ok("a seeded standard add-on, untouched, does not count as reviewed", !s.find((x) => x.key === "add_ons").done);
  s = stepsFor({ ...EMPTY, products: [{ name: "Soft-Close Hinges", unitPrice: 40, active: true }] });
  ok("…the same add-on REPRICED does", s.find((x) => x.key === "add_ons").done);
  s = stepsFor({ ...EMPTY, products: [{ name: "Soft-Close Hinges", unitPrice: 35, active: false }] });
  ok("…and switched off does", s.find((x) => x.key === "add_ons").done);
  ok("isUntouchedStandardAddOn is false for a name not in the catalogue", !isUntouchedStandardAddOn({ name: "Nothing like this", unitPrice: 35 }));

  s = stepsFor({ ...EMPTY, historicalImports: null });
  ok("historicalImports=null (column not generated yet) is NOT done — absence is not a statement", !s.find((x) => x.key === "import_jobs").done);

  s = stepsFor({ ...EMPTY, aiCreditCents: -200 });
  ok("a negative AI balance is not credit", !s.find((x) => x.key === "ai_credits").done);

  s = stepsFor({ ...EMPTY, aiCreditCents: "lots" });
  ok("a non-numeric signal is not done", !s.find((x) => x.key === "ai_credits").done);

  // A signal that throws inside doneWhen must land as "not done", not crash
  // the route. Simulated with a getter that throws.
  const hostile = { ...EMPTY };
  Object.defineProperty(hostile, "paymentScheduleStages", { get() { throw new Error("boom"); } });
  let threw = false;
  let hostileSteps = [];
  try { hostileSteps = stepsFor(hostile); } catch { threw = true; }
  ok("a throwing signal does not take the card down", !threw && hostileSteps.length === 10);
  ok("…and its step is not done", !hostileSteps.find((x) => x.key === "payment_schedule")?.done);
}

// Dismissed hides; done removes; both are reported.
{
  const steps = stepsFor({ ...EMPTY, dismissed: ["emails", "bogus", "emails"], overheadAssets: 2 });
  const emails = steps.find((s) => s.key === "emails");
  const overhead = steps.find((s) => s.key === "overhead");
  ok("a dismissed step is still returned, flagged dismissed", emails && emails.dismissed === true && emails.done === false);
  ok("a done step is still returned, flagged done", overhead && overhead.done === true);
  const shown = remainingSteps(steps).map((s) => s.key);
  ok("the card shows neither the dismissed nor the done step", !shown.includes("emails") && !shown.includes("overhead"));
  ok("…and shows the other eight", shown.length === 8, shown.length);
  ok("normaliseDismissed drops unknown keys and duplicates", JSON.stringify(normaliseDismissed(["emails", "bogus", "emails", 7, null])) === JSON.stringify(["emails"]));
  ok("normaliseDismissed of garbage is []", normaliseDismissed("emails").length === 0 && normaliseDismissed(null).length === 0);
  ok("done beats dismissed: a step both done and dismissed is simply gone", remainingSteps(stepsFor({ ...EMPTY, dismissed: ["overhead"], overheadDebts: 1 })).length === 9);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. The link carries ?from=setup before the #anchor\n");

ok("path#hash → path?from=setup#hash", withSetupParam("/app/settings/overhead#fixed-costs") === "/app/settings/overhead?from=setup#fixed-costs");
ok("path → path?from=setup", withSetupParam("/app/jobs/import") === "/app/jobs/import?from=setup");
ok("path?x=1#h → path?x=1&from=setup#h", withSetupParam("/app/x?x=1#h") === "/app/x?x=1&from=setup#h");
for (const s of stepsFor(EMPTY)) {
  ok(`${s.key}: href is ${s.href}`, /\?(?:[^#]*&)?from=setup(?:#|$)/.test(s.href) && !/#.*\?/.test(s.href), s.href);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. Every anchor names an id in the target page\n");

function pageFileFor(href) {
  const path = href.split(/[?#]/)[0];
  return `app${path}/page.js`;
}

const TARGET_PAGES = new Map();
for (const step of SETUP_STEPS) {
  const file = pageFileFor(step.href);
  TARGET_PAGES.set(file, step.key);
  const exists = existsSync(file);
  ok(`${step.key}: ${file} exists`, exists);
  if (!exists) continue;
  const src = stripComments(source(file));
  const anchor = step.href.includes("#") ? step.href.split("#")[1] : null;
  if (!anchor) {
    ok(`${step.key}: no anchor — the page IS the section`, true);
    continue;
  }
  // id="anchor", or id={cond ? "anchor" : undefined} — the id must be the
  // thing being assigned, not a string that merely appears somewhere.
  const re = new RegExp(`\\bid=(?:"${anchor}"|\\{[^}]{0,80}"${anchor}"[^}]*\\})`);
  ok(`${step.key}: #${anchor} is an id in ${file}`, re.test(src));
}

// The services page: the wording panel is collapsed by default, so the anchor
// alone would land on a closed heading. The fragment has to open it.
{
  const src = stripComments(source("app/app/settings/services/page.js"));
  ok("services: #quote-wording opens the wording panel (defaultOpen from the hash)", /window\.location\.hash === "#quote-wording"/.test(src) && /defaultOpen=\{openWording\}/.test(src));
  ok("services: the id is on ONE category, not every card", /id=\{c\.id === firstEnabledId \? "quote-wording" : undefined\}/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. Every target page renders <BackToHome />\n");

for (const [file, key] of TARGET_PAGES) {
  if (!existsSync(file)) {
    ok(`${key}: ${file} imports BackToHome`, false, "file missing");
    continue;
  }
  const src = stripComments(source(file));
  ok(`${key}: ${file} imports BackToHome`, /import BackToHome from "@\/app\/components\/BackToHome"/.test(src));
  ok(`${key}: …and renders it`, /<BackToHome\s*\/>/.test(src));
}

{
  const src = stripComments(source("app/components/BackToHome.js"));
  ok("BackToHome reads ?from=setup itself", /useSearchParams\(\)/.test(src) && /get\(BACK_TO_HOME_PARAM\) === BACK_TO_HOME_VALUE/.test(src) && /BACK_TO_HOME_PARAM = "from"/.test(src) && /BACK_TO_HOME_VALUE = "setup"/.test(src));
  ok("…renders null otherwise", /if \(!fromSetup\) return null;/.test(src));
  ok("…links to /app", /href="\/app"/.test(src));
  ok("…wraps useSearchParams in Suspense", /<Suspense fallback=\{null\}>/.test(src));
  ok("…scrolls to the fragment once the card exists (pages fetch before they render their sections)", /getElementById\(id\)/.test(src) && /scrollIntoView/.test(src));
  ok("…takes no props (the shared contract)", /export default function BackToHome\(\)/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. The routes: gated, tenant-scoped, additive\n");

{
  const get = stripComments(source("app/api/setup-steps/route.js"));
  ok("GET goes through memberOrRefusal", /const \{ member, response \} = await memberOrRefusal\(request\);\s*if \(response\) return response;/.test(get));
  ok("GET requires user:manage (impersonation may look)", /requirePermission\(member\.role, "user:manage"\)/.test(get) && /if \(!member\.impersonation\)/.test(get));
  ok("GET reads the caller's company only", /loadSetupSnapshot\(member\.companyId\)/.test(get) && !/companyId\s*=\s*body|searchParams\.get\("companyId"\)/.test(get));

  const post = stripComments(source("app/api/setup-steps/dismiss/route.js"));
  ok("POST goes through memberOrRefusal", /const \{ member, response \} = await memberOrRefusal\(request\);\s*if \(response\) return response;/.test(post));
  ok("POST requires user:manage, unconditionally", /requirePermission\(member\.role, "user:manage"\)/.test(post) && !/if \(!member\.impersonation\)/.test(post));
  ok("POST writes only where id = member.companyId", (post.match(/where: \{ id: member\.companyId \}/g) || []).length === 2 && !/body\.companyId|body\?\.companyId/.test(post));
  ok("POST refuses a key outside the catalogue", /SETUP_STEP_KEYS\.includes\(key\)/.test(post) && /status: 400/.test(post));
  ok("POST merges inside a transaction (read + write, never a blind overwrite)", /\$transaction\(async \(tx\)/.test(post) && /normaliseDismissed\(\[\.\.\.\(company\.setupStepsDismissed \|\| \[\]\), key\]\)/.test(post));
  ok("POST never removes a key (additive only)", !/filter\(/.test(post) && !/setupStepsDismissed: \[\]/.test(post) && !/setupStepsDismissed: null/.test(post));

  const snap = stripComments(source("lib/setupStepsSnapshot.js"));
  const scoped = (snap.match(/where: \{ companyId/g) || []).length + (snap.match(/some: \{ companyId, active: true \}/g) || []).length + (snap.match(/where: \{ id: companyId \}/g) || []).length;
  ok("every read in the snapshot is tenant-scoped", scoped >= 12, scoped);
  ok("the import column is read on its own, under try/catch, and reports null (not 0) when absent", /historicalImportedAt: \{ not: null \}/.test(snap) && /return null;/.test(snap));
  ok("the pure file never imports the database", !/@\/lib\/db/.test(source("lib/setupSteps.js")));

  const schema = source("prisma/schema.prisma");
  ok("Company.setupStepsDismissed Json? exists in the schema", /^\s*setupStepsDismissed\s+Json\?/m.test(schema));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. The dashboard draws the card behind the same gate\n");

{
  const page = stripComments(source("app/app/page.js"));
  ok("the dashboard imports SetupSteps", /import SetupSteps from "@\/app\/components\/dashboard\/SetupSteps"/.test(page));
  ok("…and gates it on can(role, \"user:manage\")", /const canManageSetup = can\(role, "user:manage"\);/.test(page) && /\{canManageSetup && <SetupSteps \/>\}/.test(page));
  const onboardingAt = page.indexOf("<OnboardingProgress");
  const setupAt = page.indexOf("<SetupSteps");
  ok("…under the onboarding card", onboardingAt >= 0 && setupAt >= 0 && onboardingAt < setupAt, `${onboardingAt} then ${setupAt}`);

  const card = stripComments(source("app/components/dashboard/SetupSteps.js"));
  ok("the card shows only what remainingSteps() returns — no tick state", /remainingSteps\(data\?\.steps\)/.test(card) && !/CheckCircle|line-through/.test(card));
  ok("a row is removed locally only after the server confirmed the dismissal", /if \(!res\.ok\) \{[\s\S]*?return;[\s\S]*?\}\s*setSteps\(\(prev\)/.test(card));
  ok("the card renders nothing when nothing is left", /if \(!steps \|\| steps\.length === 0\) return null;/.test(card));
  ok("collapsed by default under three", /COLLAPSE_BELOW = 3/.test(card) && /remaining\.length >= COLLAPSE_BELOW/.test(card));
  ok("no typed currency symbol on the card", !/\$\{?\s*[a-z]/.test(card.replace(/\$\{/g, "")) && !card.includes("\"$\""));
  ok("touch targets are at least 36px (min-h-9 on the link and the hide button)", (card.match(/min-h-9/g) || []).length >= 2);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. Every app.setup.* key exists in all nine languages\n");

{
  const wanted = new Set(SETUP_STEPS.map((s) => s.titleKey));
  // The link's key is the shared component's own (app.backToHome), so the scan
  // takes every app.* literal these two files ask for, not one prefix.
  for (const file of ["app/components/dashboard/SetupSteps.js", "app/components/BackToHome.js"]) {
    for (const m of source(file).matchAll(/t\(\s*"(app\.[A-Za-z0-9_.]+)"/g)) wanted.add(m[1]);
  }
  ok("the card and link ask for at least seven catalogue keys", wanted.size >= 17, wanted.size);
  const langs = Object.keys(APP_MESSAGES);
  ok("nine language blocks", langs.length === 9, langs.join(","));
  for (const key of wanted) {
    const missing = langs.filter((code) => typeof APP_MESSAGES[code]?.[key] !== "string" || !APP_MESSAGES[code][key].trim());
    ok(`${key} in all nine`, missing.length === 0, `missing: ${missing.join(",")}`);
  }
  // Each step's titleKey resolves to the English the step carries as fallback.
  for (const s of SETUP_STEPS) {
    ok(`${s.key}: English catalogue entry matches the fallback`, APP_MESSAGES.en[s.titleKey] === s.title, APP_MESSAGES.en[s.titleKey]);
  }
  ok("{n} survives translation of app.setup.left", langs.every((code) => APP_MESSAGES[code]["app.setup.left"].includes("{n}")));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
