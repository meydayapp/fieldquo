// scripts/check-platform-truth.mjs
//
// Three things the /platform console must not do, made impossible to
// reintroduce:
//
//   1. Answer "we don't know" with a number.
//   2. Send a request body that isn't a request body.
//   3. Draw a control the API will refuse.
//   4. Turn a cleared number box into a zero somebody did not type.
//   5. Print a raw enum, or a promise the code underneath breaks.
//
//   npm run check:platform-truth
//
// ── What is executed and what is only read ─────────────────────────────────
//
// The first two are EXECUTED, because that is the only way to prove them. The
// formatter is imported and called against every hostile input — a text scan
// for `|| 0` would pass the moment somebody wrote `?? 0` instead, and would
// say nothing at all about the returned string. fetchJson is run against a
// real HTTP server on a real socket, and the check asserts on the bytes that
// arrived: the bug it exists to prevent produced a perfectly successful
// request, so nothing short of reading the wire proves anything.
//
// The third is structural and says so. It cannot prove a control is hidden —
// only a browser can. What it proves is that each screen with a restricted
// write imports the shared gate and names the same permission its route
// enforces, which is the mechanical precondition the four broken screens all
// failed. Treat a pass as "the known failure shape is absent".
//
// ── Traps deliberately avoided ────────────────────────────────────────────
//
// - `ok()` here is (label, condition), and every call passes a real boolean.
//   A reversed pair would make a non-empty string the condition and could
//   never fail.
// - The subscription status list is READ OUT OF prisma/schema.prisma, not
//   typed here. A hardcoded copy passes forever after somebody adds a member
//   to the enum, which is exactly the bug it would be checking for.
// - Sources are comment-stripped before any grep, so a comment quoting the
//   thing it forbids does not match as the thing.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { centsOrNull, count, money, UNKNOWN } from "../lib/platform/metricFormat.js";
import { numberOrNull } from "../lib/platform/numericField.js";
import { planMoney } from "../lib/pricing/ladder.js";
import { STATUSES } from "../lib/platform/subscriptionStatus.js";
import { fetchJson } from "../lib/fetchJson.js";
import {
  PLATFORM_PERMISSIONS,
  SUPERADMIN_ONLY_PERMISSIONS,
} from "../lib/platform/permissions.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(label, condition, detail = "") {
  checks++;
  if (!condition) failures++;
  console.log(
    `  ${condition ? "ok  " : "FAIL"} ${label}${detail ? `  ${detail}` : ""}`,
  );
}

/**
 * Line and block comments removed, string literals preserved.
 *
 * Every file below carries long comments that quote the exact code they
 * replaced ("`Number(value || 0)`", "`if (res.ok)`"). Grepping the raw source
 * finds the explanation and calls it the offence.
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      if (c === "\\") {
        out += c + (next ?? "");
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      out += c;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

console.log("\n── 1. Absent is not zero (executed) ───────────────────────────");

// The whole point: a real zero and a missing field must not produce the same
// string. Asserted in both directions so a formatter that returned UNKNOWN for
// everything would fail just as loudly as the old one that returned $0.00.
ok("money(0) is a real zero", money(0) === "$0.00", money(0));
ok("count(0) is a real zero", count(0) === "0", count(0));
ok("money(1234.5) still formats", money(1234.5) === "$1,234.50", money(1234.5));

for (const [name, value] of [
  ["undefined", undefined],
  ["null", null],
  ["empty string", ""],
  ["NaN", NaN],
  ["Infinity", Infinity],
  ["a word", "not a number"],
  ["an object", {}],
  ["an array", []],
]) {
  // [] is worth a word: Number([]) is 0, so an empty array used to render as
  // "$0.00" — a fabricated zero from a value that is not a number at all.
  ok(`money(${name}) says unknown`, money(value) === UNKNOWN, String(money(value)));
  ok(`count(${name}) says unknown`, count(value) === UNKNOWN, String(count(value)));
}

// The plans screen writes its own money, because a plan's price is in the
// plan's own currency and money() is en-CA/CAD. Same rule, separately proved:
// this was `Number(value || 0)` on the screen the public pricing page repeats.
ok("planMoney(129) formats in the plan's own currency",
  planMoney(129, "USD") === "US$129.00", planMoney(129, "USD"));
ok("planMoney(0) is a real free plan", planMoney(0, "CAD") === "CA$0.00",
  planMoney(0, "CAD"));
for (const [name, value] of [
  ["undefined", undefined],
  ["null", null],
  ["empty string", ""],
  ["false", false],
  ["an array", []],
  ["a word", "free"],
]) {
  ok(`planMoney(${name}) does not invent a price`, planMoney(value, "CAD") === UNKNOWN,
    String(planMoney(value, "CAD")));
}

// /platform/sales/performance formats the COMMISSION ledger's cents, so it
// cannot use money() (en-CA/CAD) and wrote its own — reproducing the exact bug
// this section exists for, `Number(cents) || 0`, on the four tiles that say
// what FieldQuo owes its own reps. The test it needed is exported now so it
// can be run rather than grepped for.
ok("centsOrNull(0) is a real zero", centsOrNull(0) === 0);
ok("centsOrNull(-4500) keeps a reversal negative", centsOrNull(-4500) === -4500);
for (const [name, value] of [
  ["undefined", undefined],
  ["null", null],
  ["empty string", ""],
  ["an array", []],
  ["an object", {}],
  ["a word", "owed"],
  ["NaN", NaN],
]) {
  ok(`centsOrNull(${name}) is not a commission of zero`, centsOrNull(value) === null,
    String(centsOrNull(value)));
}
const performance = stripComments(read("app/platform/sales/performance/page.js"));
ok("the commission screen uses it rather than its own coalesce",
  performance.includes("centsOrNull(cents)") && !/Number\(cents\) \|\| 0/.test(performance));
ok("and prints a past-due company as past due, not as `past_due`",
  performance.includes("statusMeta(a.subscriptionStatus)"));

// Absence must be visible as FORM, not only as a glyph: an em dash in the same
// heavy black as a real figure still reads as a number at a glance.
const metricCard = stripComments(read("app/components/platform/MetricCard.js"));
ok(
  "MetricCard renders an unknown value differently from a real one",
  /const unknown = value === UNKNOWN/.test(metricCard) &&
    /unknown\s*\?\s*"text-muted-foreground"/.test(metricCard),
);
ok(
  "and says so in words rather than only dimming it",
  /Didn&apos;t load — not zero\./.test(metricCard),
);

console.log("\n── 2. fetchJson sends a body (executed over a socket) ─────────");

const seen = [];
const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    seen.push({ ct: req.headers["content-type"] || null, raw });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

await fetchJson(`${base}/object`, { method: "PATCH", body: { active: true } });
await fetchJson(`${base}/array`, { method: "POST", body: [1, 2] });
await fetchJson(`${base}/string`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ already: "stringified" }),
});
await fetchJson(`${base}/params`, {
  method: "POST",
  body: new URLSearchParams({ x: "1" }),
});
await fetchJson(`${base}/none`, { method: "GET" });
server.close();

const [obj, arr, str, params, none] = seen;

// The bug: fetch calls String() on an object, so the wire carried the nine
// characters "[object Object]" under text/plain and every route parsed it as
// {}. Asserted on the bytes, because the request itself succeeded.
ok(
  "a plain object arrives as JSON, not as [object Object]",
  obj.raw === '{"active":true}' && obj.ct === "application/json",
  `${obj.ct} ${obj.raw}`,
);
ok("no request body anywhere still says [object Object]",
  !seen.some((s) => s.raw.includes("[object Object]")));
ok("an array is serialised too", arr.raw === "[1,2]", arr.raw);
ok(
  "an already-stringified body is left exactly as it was",
  str.raw === '{"already":"stringified"}' && str.ct === "application/json",
  `${str.ct} ${str.raw}`,
);
// The one that would break file uploads and form posts if the helper got
// greedy: fetch sets its own Content-Type for these, and overriding it is how
// a multipart boundary goes missing.
ok(
  "URLSearchParams keeps its own encoding and content type",
  params.raw === "x=1" &&
    String(params.ct).startsWith("application/x-www-form-urlencoded"),
  `${params.ct} ${params.raw}`,
);
ok("a request with no body still has none", none.raw === "" && none.ct === null);

console.log("\n── 3. Restricted writes are gated before the click ────────────");

// Each entry: the screen, the permission its route actually enforces, and the
// flag the screen derives. Kept as data so adding a screen is one line.
const GATED = [
  {
    file: "app/platform/ai-usage/page.js",
    route: "app/api/platform/ai-usage/route.js",
    superadminOnly: true,
  },
  {
    file: "app/platform/promo-codes/page.js",
    route: "app/api/platform/promo-codes/route.js",
    superadminOnly: true,
  },
  {
    file: "app/platform/companies/[id]/CompanyActions.js",
    route: "app/api/platform/companies/[id]/extend-trial/route.js",
    permission: "billing:manage",
  },
  {
    file: "app/platform/service-categories/page.js",
    route: "app/api/platform/service-categories/route.js",
    permission: "service_category:manage",
  },
  // The second pass. Each of these drew a complete editor and let the API
  // refuse it after the click.
  {
    file: "app/platform/billing/plans/page.js",
    route: "app/api/platform/billing/plans/route.js",
    permission: "plan:manage",
  },
  {
    file: "app/platform/billing/promotions/page.js",
    route: "app/api/platform/billing/promotions/route.js",
    permission: "plan:manage",
  },
  {
    file: "app/platform/features/page.js",
    route: "app/api/platform/features/route.js",
    permission: "plan:manage",
  },
  {
    // The PATCH picks its permission from the status being written — see the
    // `needed` ternary — so the route is asserted to name company:suspend
    // rather than to enforce it unconditionally.
    file: "app/platform/companies/[id]/CompanyDetail.js",
    route: "app/api/platform/companies/[id]/route.js",
    permission: "company:suspend",
  },
  {
    file: "app/platform/companies/[id]/CompanyDisputeEvidence.js",
    route: "app/api/platform/companies/[id]/dispute-evidence/route.js",
    permission: "billing:manage",
  },
  // The third pass, and the one that matters most: the migration console is
  // the only screen in the product that creates rows inside a company's own
  // tenant (non-negotiable #3's sanctioned exception). It hand-rolled
  // `me?.role === "superadmin"` after a fetch, so a failed identity call drew
  // NO quote form, NO write panel and NO cancel, with nothing said, to a real
  // superadmin. Three entries because its three actions go through three
  // different permissions, and a screen that collapsed them into one would
  // stop matching its routes the day one of them is delegated.
  {
    file: "app/platform/migrations/[id]/MigrationDetail.js",
    route: "app/api/platform/migrations/[id]/quote/route.js",
    permission: "migration:quote",
  },
  {
    file: "app/platform/migrations/[id]/MigrationDetail.js",
    route: "app/api/platform/migrations/[id]/writes/clients/route.js",
    permission: "migration:write",
  },
  {
    file: "app/platform/migrations/[id]/MigrationDetail.js",
    route: "app/api/platform/migrations/[id]/cancel/route.js",
    permission: "migration:cancel",
  },
];

// The /platform/sales editors gate on the ROLE rather than on a matrix
// permission — their routes go through superadminOrRefusal in
// lib/sales/intel/configAdmin.js, which is a literal `admin.role !==
// "superadmin"`. All six hand-rolled it, and all six made the same mistake: a
// failed /api/platform/me left `me` null, `isSuperadmin` false, and a real
// superadmin was shown a refusal for a power they hold.
const SALES_GATED = [
  "app/platform/sales/capabilities/page.js",
  "app/platform/sales/confidence/page.js",
  "app/platform/sales/playbooks/page.js",
  "app/platform/sales/reps/page.js",
  "app/platform/sales/rules/page.js",
  "app/platform/sales/signatures/page.js",
];

for (const entry of GATED) {
  const page = stripComments(read(entry.file));
  const route = stripComments(read(entry.route));
  const name = entry.file.replace("app/platform/", "");

  ok(`${name} uses the shared gate`,
    page.includes("usePlatformAdmin") && page.includes("PlatformWriteGate"));

  if (entry.superadminOnly) {
    // Proved against the route, not assumed: this is an inline role check
    // rather than a matrix permission, so requirePlatformPermission is absent
    // and only the literal comparison shows the rule.
    ok(`${entry.route} really is superadmin-only`,
      /role\s*!==\s*"superadmin"/.test(route));
    ok(`${name} derives its flag from the role, not from a guess`,
      page.includes("isSuperadmin"));
  } else {
    ok(`${entry.route} really enforces ${entry.permission}`,
      route.includes(`"${entry.permission}"`));
    ok(`${name} asks for the same permission the route enforces`,
      page.includes(`can("${entry.permission}")`));
  }
}

// The mistake every hand-rolled copy makes. A gate that cannot tell "failed to
// ask" from "asked and was refused" shows a real superadmin a refusal for a
// permission they hold — never-loaded rendered as restricted.
const gate = stripComments(read("app/components/platform/PlatformWriteGate.js"));
ok('the gate has a "failed" state distinct from a refusal',
  /status === "failed"/.test(gate) && /status === "loading"/.test(gate));
ok("it renders nothing at all while the role is still unknown",
  /if \(status === "loading"\) return null;/.test(gate));
ok("can() is false unless the role was actually read",
  /status === "ready" &&/.test(gate));
ok("the refusal is one block, not a sentence over a greyed-out form",
  /if \(allowed\) return children;/.test(gate));
// One company page mounts three gates and the plans page mounts one per card.
// Three /api/platform/me calls can disagree, which would hide one control and
// show another on the same screen. A rejected promise must NOT be cached, or a
// single flaky request pins every gate to "couldn't check" until a reload.
ok("the identity call is shared across every gate on a page",
  /let mePromise = null;/.test(gate) && /if \(!mePromise\)/.test(gate));
ok("and a failure is not cached",
  /mePromise = null;\s*\n\s*throw err;/.test(gate));

// The six sales editors. `usePlatformAdmin` is the whole assertion: the hook is
// the only thing on these pages that can tell "we could not ask" from "we asked
// and the answer was no", and the hand-rolled `.catch(() => null)` they all had
// could not. Its absence is asserted too, so reintroducing the old shape fails.
const configAdmin = stripComments(read("lib/sales/intel/configAdmin.js"));
ok('superadminOrRefusal really is a literal role check',
  /admin\.role !== "superadmin"/.test(configAdmin));

for (const file of SALES_GATED) {
  const page = stripComments(read(file));
  const name = file.replace("app/platform/sales/", "");
  ok(`sales/${name} asks the shared hook who is signed in`,
    page.includes("usePlatformAdmin()"));
  ok(`sales/${name} renders its refusal through the shared gate`,
    page.includes("<PlatformWriteGate"));
  ok(`sales/${name} no longer swallows a failed /api/platform/me`,
    !/fetchJson\("\/api\/platform\/me"\)\.catch/.test(page) &&
      !page.includes("setMe("),
  );
}

console.log("\n── 4. Status labels match the enum, not a memory of it ────────");

// Read out of the schema. A list typed here would keep passing after somebody
// adds a member — which is the failure this exists to catch.
const schema = read("prisma/schema.prisma");
const enumBody = schema.match(/enum SubscriptionStatus \{([^}]*)\}/)?.[1];
ok("SubscriptionStatus was found in the schema", Boolean(enumBody));
const members = (enumBody || "")
  .split("\n")
  .map((l) => l.replace(/\/\/.*$/, "").trim())
  .filter(Boolean);
ok("it has members to check", members.length > 0, members.join(", "));

// The table is IMPORTED now rather than parsed out of one page's source. It
// moved to lib/platform/subscriptionStatus.js when /platform/companies and
// /platform/companies/[id] turned out to be printing the same enum raw — one
// table fixed and two copies of the bug still live is exactly AGENTS.md's
// failure class 4.
const mapped = Object.keys(STATUSES);
for (const m of members) {
  ok(`${m} has a human label and a colour`,
    mapped.includes(m) &&
      typeof STATUSES[m].label === "string" &&
      STATUSES[m].label !== m &&
      typeof STATUSES[m].className === "string" &&
      STATUSES[m].className.length > 0,
    STATUSES[m] ? STATUSES[m].label : "missing");
}
ok("and the map invents no status the column cannot hold",
  mapped.every((m) => members.includes(m)),
  mapped.filter((m) => !members.includes(m)).join(", ") || "none");

// Executed, not grepped: statusMeta must NAME an unknown value rather than
// dropping it or echoing it bare.
const { statusMeta } = await import("../lib/platform/subscriptionStatus.js");
ok("an unrecognised status says it is unrecognised",
  statusMeta("something_new").label.includes("something_new") &&
    statusMeta("something_new").label !== "something_new",
  statusMeta("something_new").label);
ok("a missing status is not blank either",
  statusMeta(null).label === "No status" && statusMeta(null).className.length > 0);

// Every screen that shows a SubscriptionStatus to a person goes through it.
// The two below the money screen are the ones that were still raw: support
// opens them with a contractor on the phone.
for (const file of [
  "app/platform/billing/subscriptions/page.js",
  "app/platform/companies/page.js",
  "app/platform/companies/[id]/CompanyDetail.js",
]) {
  const page = stripComments(read(file));
  ok(`${file.replace("app/platform/", "")} labels the status instead of printing it`,
    page.includes("statusMeta(") &&
      !/\{\s*(?:c\.subscription|sub)\.status\s*\}/.test(page) &&
      !/value=\{sub\.status\}/.test(page));
}

const subs = stripComments(read("app/platform/billing/subscriptions/page.js"));
ok("the badge renders the label, never the raw column value",
  /\{statusMeta\(r\.status\)\.label\}/.test(subs) && !/>\s*\{r\.status\}\s*</.test(subs));
ok("the filter buttons are built from the same table",
  /\.\.\.Object\.entries\(STATUSES\)/.test(subs));

console.log("\n── 4b. A cleared number box is not a zero (executed) ──────────");

// Same class as section 1 and the opposite direction: there, a missing value
// became a confident 0 on a READ; here, a blank field became a confident 0 on a
// WRITE. Executed, because a text scan for `Number(` says nothing about what
// comes back, and because Number() is 0 for six different kinds of nothing.
ok("numberOrNull(0) is a real zero", numberOrNull(0) === 0);
ok('numberOrNull("0") is a real zero', numberOrNull("0") === 0);
ok('numberOrNull("1.5") parses', numberOrNull("1.5") === 1.5);
ok('numberOrNull("  7 ") parses', numberOrNull("  7 ") === 7);
for (const [name, value] of [
  ["empty string", ""],
  ["whitespace", "   "],
  ["a lone minus", "-"],
  ["undefined", undefined],
  ["null", null],
  ["false", false],
  ["an empty array", []],
  ["an object", {}],
  ["a word", "high"],
  ["NaN", NaN],
  ["Infinity", Infinity],
]) {
  // Number() is 0 for the first eight of these. Every one of them is a way an
  // absent value reaches an Int column looking like somebody's decision.
  ok(`numberOrNull(${name}) is null, not 0`, numberOrNull(value) === null,
    String(numberOrNull(value)));
}

// The four editors, and the exact expressions that produced the bug. Asserted
// as absences as well as presences: importing the helper and still calling
// Number() on the field would otherwise pass.
const NUMERIC_EDITORS = [
  ["app/platform/sales/capabilities/page.js", /salesPriority:\s*Number\(/],
  ["app/platform/sales/confidence/page.js", /weight:\s*Number\(weight\)/],
  ["app/platform/sales/rules/page.js", /priority:\s*Number\(draft\.priority\)/],
  ["app/platform/sales/playbooks/page.js", /priority:\s*Number\(d\.priority\)/],
];
for (const [file, oldShape] of NUMERIC_EDITORS) {
  const page = stripComments(read(file));
  const name = file.replace("app/platform/sales/", "sales/");
  ok(`${name} parses its number field with numberOrNull`,
    page.includes("numberOrNull("));
  ok(`${name} no longer substitutes Number("") for a cleared field`,
    !oldShape.test(page));
  // A parser that returns null and a save that posts it anyway is no better
  // than Number(): the routes accept null-shaped bodies by validating them
  // away. The save has to refuse, by name.
  ok(`${name} refuses the save rather than posting a blank`,
    page.includes("blankNumberMessage("));
}

const blankMsg = (await import("../lib/platform/numericField.js")).blankNumberMessage(
  "Priority",
);
ok("the refusal names the field and says blank is not zero",
  blankMsg.startsWith("Priority") && /not the same as 0/.test(blankMsg),
  blankMsg);

console.log("\n── 4c. The seed says what the seed does ───────────────────────");

// ── Why this is derived rather than a phrase match ────────────────────────
//
// The capabilities screen's seed button promised "no priority, switch or
// talking point you had edited was reset". True of capabilities, false in
// spirit: seedIntelConfig's OpportunityRule upsert overwrites `name`,
// `capabilityCode`, `conditions` and `reasonTemplate` from the code on every
// run — the four fields /platform/sales/rules exists to edit.
//
// So the fields are READ OUT OF the seed's own update block. A list typed here
// would keep passing the day somebody adds a fifth field to the upsert, which
// is the drift this exists to catch. Each field must be named in the warning
// through an explicit phrase; a field with no phrase fails loudly rather than
// silently going unmentioned.
const dbSrc = read("lib/sales/intel/db.js");
const ruleLoop = dbSrc.slice(dbSrc.indexOf("for (const r of seedOpportunityRules("));
const ruleUpdate = ruleLoop.match(/update:\s*\{([\s\S]*?)\n\s{6}\},/)?.[1];
ok("the rule upsert's update block was found in the seed", Boolean(ruleUpdate));

const overwritten = [...(ruleUpdate || "").matchAll(/^\s*([a-zA-Z]+):/gm)].map((m) => m[1]);
ok("it overwrites at least one field", overwritten.length > 0, overwritten.join(", "));

// field → the words the warning must use for it. Prose, because
// "reasonTemplate" is not a sentence and an operator should not have to read
// the schema to understand what is about to be thrown away.
const WARNING_WORDS = {
  name: "name",
  capabilityCode: "capability",
  conditions: "conditions",
  reasonTemplate: "reason",
};
const capsPage = read("app/platform/sales/capabilities/page.js");
const warning = capsPage.slice(capsPage.indexOf("async function runSeed"));
for (const field of overwritten) {
  const phrase = WARNING_WORDS[field];
  ok(`the seed rewrites "${field}" and the warning has words for it`, Boolean(phrase),
    phrase ? "" : "add it to WARNING_WORDS and to the confirm text");
  if (phrase)
    ok(`the warning names "${phrase}"`, warning.includes(phrase));
}

// The promise itself. It was retracted after the click; a warning underneath a
// button that has already run is not a warning.
ok("the warning is shown BEFORE the seed runs, not after",
  warning.indexOf("confirm(") < warning.indexOf("fetchJson("));
ok("the old blanket promise is gone",
  !capsPage.includes("no priority, switch or talking point you had edited was reset"));
ok("and the result reports the rules it rewrote, not only the ones it added",
  /counts\.rules\.updated/.test(stripComments(capsPage)));
// The version point, which is the part that outlives the screen: three of the
// four overwritten fields are SEMANTIC_FIELDS, so a stored ruleVersion goes on
// citing a v1 that changed underneath it.
const versioning = read("lib/sales/intel/versioning.js");
const semantic = versioning.match(/opportunityRule:\s*\[([^\]]*)\]/)?.[1] || "";
const semanticFields = [...semantic.matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]);
ok("SEMANTIC_FIELDS.opportunityRule was found", semanticFields.length > 0,
  semanticFields.join(", "));
const silentlyChanged = overwritten.filter((f) => semanticFields.includes(f));
ok("the warning says the version does not move when a semantic field is rewritten",
  silentlyChanged.length === 0 || /version/i.test(warning),
  silentlyChanged.join(", ") || "none overwritten");

console.log("\n── 5. Empty states wait for the server ────────────────────────");

// Rule 1 from scripts/check-empty-vs-error.mjs, applied to /platform, which
// that script's roster does not reach. A list whose state starts at [] is
// claiming "there are zero of these" before the server has said anything.
const LISTS = [
  ["app/platform/promo-codes/page.js", "codes"],
  ["app/platform/service-categories/page.js", "categories"],
  ["app/platform/team/page.js", "admins"],
  // The second pass. Each of these sentences is a claim about FieldQuo's own
  // business — how many customers it has, what it sells, and what everyone is
  // being charged — printed under the red banner saying the request failed.
  ["app/platform/companies/page.js", "companies"],
  ["app/platform/billing/plans/page.js", "plans"],
  ["app/platform/billing/promotions/page.js", "promotions"],
  // The third pass. This one is the worst of the set: /platform/suppressions
  // started at [], so a failed search printed "Nobody is on the list yet" on
  // FieldQuo's own do-not-contact list — a sentence that reads as permission
  // to contact everybody, produced by a request that never arrived.
  ["app/platform/suppressions/page.js", "rows"],
];
for (const [file, state] of LISTS) {
  const src = stripComments(read(file));
  const init = src.match(
    new RegExp(`const \\[${state}, set\\w+\\] = useState\\(([^)]*)\\)`),
  )?.[1];
  ok(`${file.replace("app/platform/", "")}: ${state} starts unknown, not empty`,
    init === "null", `useState(${init})`);
}

// The specific sentences that used to fire on a failed request. Each is a
// claim about FieldQuo's business, and each now has a failure branch that says
// nothing was deleted.
// Matched on a fragment that cannot straddle a JSX line break — the assertion
// is that the failure branch exists and says so, not that the sentence is
// wrapped at any particular column.
const claims = [
  ["app/platform/billing/subscriptions/page.js", "nothing has been cancelled"],
  ["app/platform/promo-codes/page.js", "not an empty ledger"],
  ["app/platform/service-categories/page.js", "says nothing about what"],
  ["app/platform/team/page.js", "No account has been removed"],
  ["app/platform/companies/page.js", "no company has been"],
  ["app/platform/billing/plans/page.js", "not an empty rate card"],
  ["app/platform/billing/promotions/page.js", "no promotion has been switched off"],
  // The third pass. Seven more, each a claim about something a person was
  // about to act on: an audit log with nothing in it, a support queue with
  // nothing open, nobody waiting on Jennifer, nobody on the do-not-contact
  // list, no demo accounts (under instructions to re-run the seed), nobody
  // available to run a demo, and no company waiting on a paid migration.
  ["app/platform/audit-log/page.js", "This is not an empty"],
  ["app/platform/feedback/page.js", "not an empty queue"],
  ["app/platform/jennifer/page.js", "nothing has been resolved or removed"],
  ["app/platform/suppressions/page.js", "not an empty list and it is not a clearance"],
  ["app/platform/demo/page.js", "Do not run the seed script"],
  ["app/platform/demo-availability/page.js", "empty calendar — whatever is stored"],
  ["app/platform/migrations/page.js", "nothing has been cancelled"],
  ["app/platform/demos/page.js", "check again before telling anyone their slot is gone"],
];
for (const [file, phrase] of claims) {
  ok(`${file.replace("app/platform/", "")} separates "failed" from "none"`,
    read(file).includes(phrase));
}

// The migration write panel had the fourth state wrong the other way round: a
// failed client list left `clients` null, which IS the loading state, so the
// picker on the one screen that writes into a tenant sat on "Loading clients…"
// for ever with no error and no retry.
const migration = stripComments(read("app/platform/migrations/[id]/MigrationDetail.js"));
const loaderBody = migration.slice(
  migration.indexOf("const loadClients = useCallback"),
  migration.indexOf("useEffect(() => {\n    loadClients();"),
);
ok("the migration client list has an error state distinct from loading",
  migration.includes("Clients didn't load") && /setClientsError\(/.test(loaderBody),
);
ok("and it offers a retry rather than only a sentence",
  /onRetryClients/.test(migration));
ok("the bare `if (res.ok) setClients` shape is gone",
  !/if \(res\.ok\) setClients/.test(migration));

console.log("\n── 6. Role descriptions come from the matrix ──────────────────");

const team = stripComments(read("app/platform/team/page.js"));
ok("the team page reads the real permission matrix",
  team.includes("PLATFORM_PERMISSIONS") &&
    team.includes("SUPERADMIN_ONLY_PERMISSIONS"));
ok("descriptions are derived rather than three typed sentences",
  /function roleDescription\(role\)/.test(team) &&
    /PLATFORM_PERMISSIONS\[role\]/.test(team));

// Every permission the matrix grants must have wording, or the screen prints a
// raw code at the person choosing a role. Derived from the matrix so a new
// permission fails here rather than appearing untranslated on the page.
const wordsBody = team.match(/const PERMISSION_WORDS = \{([\s\S]*?)\n\};/)?.[1] || "";
const worded = new Set(
  [...wordsBody.matchAll(/^\s{2}"?([a-z_:]+)"?:/gm)].map((m) => m[1]),
);
const granted = new Set(
  [
    ...Object.values(PLATFORM_PERMISSIONS).flat(),
    ...SUPERADMIN_ONLY_PERMISSIONS,
  ].filter((p) => p !== "*"),
);
for (const p of granted) {
  ok(`"${p}" is described in words`, worded.has(p));
}

// The omission that mattered: "Everything, including creating other staff
// accounts" named the least consequential superadmin power and left out the
// one that writes inside a tenant.
ok("the superadmin description names the tenant-write power",
  worded.has("migration:write") &&
    /migration:write[\s\S]{0,200}sanctioned exception/.test(team));

console.log("\n── 7. The audit log names what the product writes ─────────────");

// ── Why this is scanned and not listed ────────────────────────────────────
//
// /platform/audit-log carried a five-entry ACTION_META keyed on `impersonate`,
// a value NOTHING in this codebase has ever written — lib/platform/impersonate.js
// writes `impersonation_started` and `impersonation_ended`. So the one class of
// entry the screen's own header calls "the ones that matter most" rendered in
// the neutral grey fallback for the life of the page, and thirty-six other
// actions had no wording at all.
//
// A hand-typed list of expected actions in this file would have been written by
// reading the same page and would have contained the same wrong key. So the
// actions are EXTRACTED from every `platformAuditLog.create` in the repo — the
// literals and both arms of each ternary — and matched against the module in
// both directions. Adding a write with no wording fails here; so does keeping
// wording for a write that no longer exists.
const { AUDIT_ACTIONS, describeAuditAction } = await import(
  "../lib/platform/auditActions.js"
);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    const stat = fs.statSync(path.join(ROOT, rel));
    if (stat.isDirectory()) walk(rel, out);
    else if (name.endsWith(".js")) out.push(rel);
  }
  return out;
}

// ── How the scan avoids three traps it walked straight into first ─────────
//
// 1. It reads FILES that write audit rows, not the create call sites: two
//    routes build their entries into an array first and spread them into
//    `data`, so nothing near `platformAuditLog.create` names the action.
// 2. It advances by indexOf rather than a global regex with a fixed window.
//    A 240-character window consumed by one match swallowed the NEXT
//    `action:` in the same object — sales_rep_work_mailbox_set went missing
//    exactly that way, which is the "lazy window reaching a field further
//    down" trap this file's header warns about.
// 3. It takes only the literals in an action POSITION — straight after
//    `action:`, or after a ternary's `?` / `:`. Reading every string in the
//    span picked up "suspended" out of the CONDITION
//    `onboardingStatus === "suspended"` and reported it as an action.
const AUDIT_FILES = [...walk("app/api"), ...walk("lib")].filter((f) =>
  read(f).includes("platformAuditLog.create"),
);
const written = new Set();
for (const file of AUDIT_FILES) {
  const src = stripComments(read(file));
  let from = src.indexOf("action:");
  while (from !== -1) {
    const slice = src.slice(from + "action:".length, from + 247);
    const stop = slice.search(/\n\s*(?:[a-zA-Z_$][\w$]*\s*:\s|\}|\))/);
    const seg = stop === -1 ? slice : slice.slice(0, stop);
    for (const lit of seg.matchAll(/(?:^|[?:])\s*"([a-z_]+)"/g)) written.add(lit[1]);
    from = src.indexOf("action:", from + 1);
  }
}
const writeSites = AUDIT_FILES.length;

// A scan that finds nothing passes every "is it described?" loop below without
// running one, so the scan itself is asserted first.
ok("the audit writers were found at all", writeSites > 20, `${writeSites} files`);
ok("and their action names were readable", written.size > 40, `${written.size} actions`);

// The regression itself, named: this key is what the screen used to look for.
ok('nothing writes the action "impersonate"', !written.has("impersonate"));
ok("and the real impersonation actions are written",
  written.has("impersonation_started") && written.has("impersonation_ended"));

for (const action of [...written].sort()) {
  ok(`"${action}" has wording on the audit log`, Boolean(AUDIT_ACTIONS[action]));
}
for (const action of Object.keys(AUDIT_ACTIONS)) {
  ok(`"${action}" is an action something actually writes`, written.has(action));
}

// Impersonation is the class the page's header singles out. It must be its own
// tone, not folded into the ordinary edits, or the sentence is false again.
ok("impersonation reads as access, not as an ordinary edit",
  AUDIT_ACTIONS.impersonation_started.tone === "access" &&
    AUDIT_ACTIONS.impersonation_ended.tone === "access");
// Writing inside a tenant is the other class worth seeing without reading.
ok("the migration rows are toned apart from ordinary console edits",
  AUDIT_ACTIONS.migration_quoted.tone === "tenant");

ok("an unrecognised action says it is unrecognised",
  describeAuditAction("something_new").label.includes("Unrecognised") &&
    describeAuditAction("something_new").known === false);

const auditPage = stripComments(read("app/platform/audit-log/page.js"));
ok("the page reads the shared vocabulary",
  auditPage.includes("describeAuditAction"));
// The fallback that hid the bug: replacing underscores made an unhandled action
// look handled, which is why nobody noticed the amber rule never fired.
ok("and no longer tidies an unknown action into a sentence",
  !/action\.replace\(/.test(auditPage));
for (const tone of new Set(Object.values(AUDIT_ACTIONS).map((a) => a.tone))) {
  ok(`the page has a treatment for the "${tone}" tone`,
    new RegExp(`\\b${tone}:\\s*\\{`).test(auditPage));
}

console.log("\n── 8. The migration console asks the state machine ────────────");

// Non-negotiable #3's one sanctioned exception. This screen decides whether to
// DRAW the controls that write inside a company's tenant; the routes decide
// whether to honour them. Both must be answering out of lib/migrations/state.js
// — the screen used to carry four hand-copied Sets of the same states, which is
// the copy that rots, on the one page where rotting means the console offers a
// write the route will refuse (or, worse, stops offering one it would allow).
const migrationDetail = stripComments(
  read("app/platform/migrations/[id]/MigrationDetail.js"),
);
for (const fn of ["canWrite", "canQuote", "canCancel", "canComplete", "describeStatus"]) {
  ok(`MigrationDetail imports ${fn} rather than re-deriving it`,
    new RegExp(`\\b${fn}\\b`).test(
      migrationDetail.slice(0, migrationDetail.indexOf("export default")),
    ));
}
for (const set of ["WRITABLE", "QUOTABLE", "CANCELLABLE", "COMPLETABLE"]) {
  ok(`the hand-copied ${set} set is gone`,
    !new RegExp(`const ${set}\\s*=`).test(migrationDetail));
}

// ── The prompt that cancelled on Cancel ───────────────────────────────────
//
// `window.prompt("Reason for cancelling (optional):") || ""` and then POST
// regardless. window.prompt returns null when a person presses Escape or the
// dialog's own Cancel — so backing out of the prompt cancelled the migration,
// on the action that revokes a paid-for write window and issues no refund.
ok("cancelling no longer runs through a browser prompt",
  !/window\.prompt/.test(migrationDetail));
ok("and the consequence is named before the click, not after it",
  /does not issue a refund automatically/.test(read(
    "app/platform/migrations/[id]/MigrationDetail.js",
  )));
ok("both terminal actions confirm rather than firing on the first press",
  /setConfirming\("cancel"\)/.test(migrationDetail) &&
    /setConfirming\("complete"\)/.test(migrationDetail));

// The tenant's own currency, on the form that writes a total into their books.
// A Quote row has no currency of its own — every surface renders it in the
// COMPANY's — so "Total ($)" named the wrong money for a euro contractor.
ok("the historical-quote total is labelled in the company's currency",
  /Total \(\$\{companyCurrency\}\)/.test(migrationDetail) ||
    /`Total \(\$\{companyCurrency\}\)`/.test(migrationDetail));
ok("and the detail route actually sends that currency",
  /currency: true/.test(stripComments(read("app/api/platform/migrations/[id]/route.js"))));
ok("an absent currency is named rather than assumed to be CAD",
  /currency not recorded/.test(migrationDetail) &&
    !/currency \|\| "CAD"/.test(migrationDetail));

// The list beside it: nine statuses typed out where the state machine already
// holds them, and `status.replace("_", " ")` standing in for a label.
const migrationList = stripComments(read("app/platform/migrations/page.js"));
ok("the status filters are built from MIGRATION_STATUSES",
  /MIGRATION_STATUSES\.map/.test(migrationList));
ok("and a row's status is described, not underscore-swapped",
  /describeStatus\(r\.status\)/.test(migrationList) &&
    !/status\.replace\(/.test(migrationList));
// Green means canWrite() on this list, and nothing else. `completed` shared it
// for a while, which is the one distinction the screen exists to make.
ok("only the writable statuses are green",
  /completed: "bg-slate/.test(migrationList));

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
