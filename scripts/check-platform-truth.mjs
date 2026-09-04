// scripts/check-platform-truth.mjs
//
// Three things the /platform console must not do, made impossible to
// reintroduce:
//
//   1. Answer "we don't know" with a number.
//   2. Send a request body that isn't a request body.
//   3. Draw a control the API will refuse.
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

const subs = stripComments(read("app/platform/billing/subscriptions/page.js"));
const mapBody = subs.match(/const STATUSES = \{([\s\S]*?)\n\};/)?.[1] || "";
const mapped = [...mapBody.matchAll(/^\s{2}([a-z_]+):\s*\{/gm)].map((m) => m[1]);

for (const m of members) {
  ok(`${m} has a human label and a colour`, mapped.includes(m));
}
ok("and the map invents no status the column cannot hold",
  mapped.every((m) => members.includes(m)),
  mapped.filter((m) => !members.includes(m)).join(", ") || "none");
ok("the badge renders the label, never the raw column value",
  /\{statusMeta\(r\.status\)\.label\}/.test(subs) && !/>\s*\{r\.status\}\s*</.test(subs));
ok("the filter buttons are built from the same table",
  /\.\.\.Object\.entries\(STATUSES\)/.test(subs));

console.log("\n── 5. Empty states wait for the server ────────────────────────");

// Rule 1 from scripts/check-empty-vs-error.mjs, applied to /platform, which
// that script's roster does not reach. A list whose state starts at [] is
// claiming "there are zero of these" before the server has said anything.
const LISTS = [
  ["app/platform/promo-codes/page.js", "codes"],
  ["app/platform/service-categories/page.js", "categories"],
  ["app/platform/team/page.js", "admins"],
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
];
for (const [file, phrase] of claims) {
  ok(`${file.replace("app/platform/", "")} separates "failed" from "none"`,
    read(file).includes(phrase));
}

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
