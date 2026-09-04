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
import { count, money, UNKNOWN } from "../lib/platform/metricFormat.js";
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

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
