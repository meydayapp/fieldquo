// scripts/check-heycatch.mjs
//
//   npm run check:heycatch
//
// HeyCatch (FieldQuo's product analytics, 2026-10-15) — the three promises
// the owner made non-negotiable, executed rather than read:
//
//   1. It never runs on a page a homeowner sees, nor on a contractor's host.
//      The gate in lib/heycatch/gate.js is RUN over every client-facing route,
//      every FieldQuo-staff route and every foreign host; and every top-level
//      route under app/ must be classified, so a new token page cannot be
//      tracked by default. The SDK is imported in exactly one place, behind
//      the gate, and never statically.
//   2. Identity is the user id plus companyId, role and plan — no email, no
//      name, no phone — and nothing at all for a support session.
//   3. The /a-style short links redirect on FieldQuo's own hosts only, with a
//      302, and never on a letter FieldQuo already uses as a route.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyticsAllowed,
  isAnalyticsHost,
  identityPayload,
  ANALYTICS_PATH_PREFIXES,
  CLIENT_FACING_PREFIXES,
  UNTRACKED_OWN_PREFIXES,
} from "@/lib/heycatch/gate";
import {
  shortLinkRedirects,
  SHORT_LINK_CHARS,
  SHORT_LINK_HOST_PATTERN,
  USED_SINGLE_LETTER_ROUTES,
} from "@/lib/heycatch/shortLinks";
import { trackServerEvent, SERVER_EVENTS } from "@/lib/heycatch/server";
import nextConfig from "../next.config.mjs";
import { COMPARE_PAGES } from "@/app/(marketing)/compare/compareCopy";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
const failures = [];
function ok(name, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
    return true;
  }
  failures.push(`${name}${detail ? `  ${detail}` : ""}`);
  console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
  return false;
}
const section = (t) => console.log(`\n${t}`);
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const code = (rel) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

console.log("\nHeyCatch — never on a client's page, no PII, short links on our host only\n");

// ═══════════════════════════════════════════════════════════════════════════
section("1. The gate refuses every client-facing page and every foreign host");
// ═══════════════════════════════════════════════════════════════════════════
const WWW = "www.fieldquo.com";
for (const prefix of CLIENT_FACING_PREFIXES) {
  for (const path of [prefix, `${prefix}/abc123token`, `${prefix}/acme/thing?x=1`.split("?")[0]]) {
    ok(`refused on ${WWW}${path}`, analyticsAllowed({ hostname: WWW, pathname: path }) === false);
  }
}
for (const prefix of UNTRACKED_OWN_PREFIXES) {
  ok(`refused on ${WWW}${prefix}/x (FieldQuo staff or a token-bearing page)`, analyticsAllowed({ hostname: WWW, pathname: `${prefix}/x` }) === false);
}
ok("refused on an unknown path (allow-list, not deny-list)", analyticsAllowed({ hostname: WWW, pathname: "/brand-new-token-page/abc" }) === false);
ok("refused on a relative or empty path", analyticsAllowed({ hostname: WWW, pathname: "" }) === false);
ok("refused with no location at all", analyticsAllowed(null) === false);

const FOREIGN_HOSTS = [
  "sunset.fieldquo.com",
  "truefinish.fieldquo.com",
  "sunset.localhost",
  "help.fieldquo.com",
  "app.fieldquo.com.evil.com",
  "fieldquo-abc123-team.vercel.app",
  "www.sunsetspace.ca",
  "sunsetspace.ca",
  "203.0.113.7",
  "fieldquo.com.attacker.net",
];
for (const host of FOREIGN_HOSTS) {
  for (const path of ["/", "/pricing", "/app/quotes"]) {
    ok(`refused on ${host}${path}`, analyticsAllowed({ hostname: host, pathname: path }) === false);
  }
}
ok("a host with a port is judged by its name", isAnalyticsHost("localhost:3000") && !isAnalyticsHost("sunset.localhost:3000"));

for (const path of ["/", "/pricing", "/compare/fieldquo-vs-jobber", "/about", "/signup", "/login", "/app", "/app/quotes/123"]) {
  for (const host of ["www.fieldquo.com", "fieldquo.com", "localhost"]) {
    ok(`allowed on ${host}${path}`, analyticsAllowed({ hostname: host, pathname: path }) === true);
  }
}
ok("no allowed prefix overlaps a client-facing one", ANALYTICS_PATH_PREFIXES.every((a) => !CLIENT_FACING_PREFIXES.some((c) => a === c || a.startsWith(`${c}/`) || c.startsWith(`${a}/`))));

// ═══════════════════════════════════════════════════════════════════════════
section("2. Every top-level route under app/ is classified");
// ═══════════════════════════════════════════════════════════════════════════
function hasRoute(rel) {
  const abs = join(ROOT, rel);
  for (const e of readdirSync(abs)) {
    if (e === "page.js" || e === "route.js" || e === "page.jsx") return true;
    const child = join(abs, e);
    if (statSync(child).isDirectory() && hasRoute(join(rel, e))) return true;
  }
  return false;
}
const topLevel = [];
for (const e of readdirSync(join(ROOT, "app"))) {
  if (!statSync(join(ROOT, "app", e)).isDirectory()) continue;
  if (e.startsWith("(") && e.endsWith(")")) {
    for (const inner of readdirSync(join(ROOT, "app", e))) {
      if (statSync(join(ROOT, "app", e, inner)).isDirectory() && hasRoute(join("app", e, inner))) topLevel.push(`/${inner}`);
    }
    continue;
  }
  // Extension-named route folders (robots.txt, sitemap.xml, llms.txt) are
  // not pages anybody browses and never load the SDK.
  if (e.includes(".")) continue;
  if (hasRoute(join("app", e))) topLevel.push(`/${e}`);
}
const classified = new Set([...ANALYTICS_PATH_PREFIXES, ...CLIENT_FACING_PREFIXES, ...UNTRACKED_OWN_PREFIXES]);
const unclassified = topLevel.filter((p) => !classified.has(p));
ok(
  `all ${topLevel.length} top-level routes are allowed, client-facing or untracked`,
  unclassified.length === 0,
  `${unclassified.join(", ")} — add each to ANALYTICS_PATH_PREFIXES, CLIENT_FACING_PREFIXES or UNTRACKED_OWN_PREFIXES in lib/heycatch/gate.js, on purpose`,
);
// The one-letter routes must also be client-facing — they are all token or slug pages.
const oneLetter = topLevel.filter((p) => p.length === 2).map((p) => p.slice(1)).sort();
ok("every one-letter route is classified client-facing", oneLetter.every((l) => CLIENT_FACING_PREFIXES.includes(`/${l}`)), oneLetter.join(","));

// ═══════════════════════════════════════════════════════════════════════════
section("3. The SDK is loaded in one place, behind the gate, never statically");
// ═══════════════════════════════════════════════════════════════════════════
function walk(dir, out = []) {
  for (const e of readdirSync(join(ROOT, dir))) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const rel = join(dir, e);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(m?js|jsx)$/.test(e)) out.push(rel);
  }
  return out;
}
const sources = [...walk("app"), ...walk("lib"), ...walk("components"), "instrumentation-client.js", "middleware.js"].filter((f) => existsSync(join(ROOT, f)));
const browserImporters = sources.filter((f) => /["']@heycatch\/sdk["']/.test(code(f)));
ok("only lib/heycatch/client.js imports the browser SDK", browserImporters.length === 1 && browserImporters[0] === "lib/heycatch/client.js", browserImporters.join(", "));
const clientSrc = code("lib/heycatch/client.js");
ok("…and only as a dynamic import()", /import\(\s*["']@heycatch\/sdk["']\s*\)/.test(clientSrc) && !/^\s*import\s[^(]*["']@heycatch\/sdk["']/m.test(clientSrc));
ok("…after asking the gate", /if\s*\(\s*!analyticsAllowed\(/.test(clientSrc) && clientSrc.indexOf("analyticsAllowed(") < clientSrc.indexOf('import("@heycatch/sdk")'));
ok("every event is re-gated in beforeSend", /beforeSend:\s*\(event\)\s*=>\s*\(analyticsAllowed\(here\(\)\)\s*\?\s*event\s*:\s*null\)/.test(clientSrc));
ok("autocapture masks on-screen text and element attributes", /maskAllText:\s*true/.test(clientSrc) && /maskAllElementAttributes:\s*true/.test(clientSrc));
ok("the distinct id lives in local storage, not a .fieldquo.com cookie", /persistence:\s*"localStorage"/.test(clientSrc));
ok("no apiHost is passed", !/apiHost/.test(clientSrc));
ok("the project key is inlined once, in the gate", /hck_pk_W-R45Oqaf9dQ-LzAzfiSPDXf9K2lyGp-/.test(read("lib/heycatch/gate.js")));
const instr = code("instrumentation-client.js");
ok("instrumentation-client.js starts analytics through the gated loader", /startAnalytics\(\)/.test(instr) && !/@heycatch\/sdk/.test(instr));
const serverImporters = sources.filter((f) => /["']@heycatch\/sdk\/server["']/.test(code(f)));
ok("only lib/heycatch/server.js imports the server SDK", serverImporters.length === 1 && serverImporters[0] === "lib/heycatch/server.js", serverImporters.join(", "));

// ═══════════════════════════════════════════════════════════════════════════
section("4. Identity: the id and three company facts, never contact details");
// ═══════════════════════════════════════════════════════════════════════════
const member = {
  userId: "usr_123",
  companyId: "cmp_456",
  role: "owner",
  plan: "crew",
  email: "owner@example.com",
  name: "Jane Owner",
  phone: "+16135550100",
};
const payload = identityPayload(member);
ok("the id is the internal user id", payload?.id === "usr_123", JSON.stringify(payload));
ok("properties are exactly companyId, role and plan", JSON.stringify(Object.keys(payload?.properties || {}).sort()) === JSON.stringify(["companyId", "plan", "role"]));
const flat = JSON.stringify(payload);
ok("no email, name or phone anywhere in the payload", !/@|Jane|6135550100/.test(flat), flat);
ok("a support session is never identified", identityPayload({ ...member, impersonation: true }) === null);
ok("no user id, no identity", identityPayload({ companyId: "c" }) === null && identityPayload(null) === null);
const layout = code("app/app/layout.js");
ok("/app's layout builds the identity through identityPayload and mounts it", /identityPayload\(/.test(layout) && /<AnalyticsIdentity identity=\{analyticsIdentity\}/.test(layout));
ok("/app's layout skips impersonation before building it", /if\s*\(!member\?\.userId\s*\|\|\s*member\.impersonation\)\s*return null/.test(layout));
const identityComponent = code("app/components/analytics/AnalyticsIdentity.js");
ok("AnalyticsIdentity sends only id, companyId, role, plan", /setIdentity\(id,\s*\{\s*companyId,\s*role,\s*plan\s*\}\)/.test(identityComponent));
const signup = code("app/signup/page.js");
ok("signup identifies the new login by id only", /setIdentity\(newUserId,\s*\{\}\)/.test(signup) && !/setIdentity\([^)]*email/.test(signup));
ok("sign-out resets the identity", /resetAnalyticsIdentity\(\)/.test(code("lib/auth-client.js")));

// ═══════════════════════════════════════════════════════════════════════════
section("5. Server events: named, production-only, never throwing");
// ═══════════════════════════════════════════════════════════════════════════
const savedEnv = process.env.VERCEL_ENV;
delete process.env.VERCEL_ENV;
ok("nothing is sent outside production", (await trackServerEvent("trial_started", {}, { userId: "u" })) === false);
process.env.VERCEL_ENV = "production";
ok("an unknown event name is refused, even in production", (await trackServerEvent("made_up_event", {}, { userId: "u" })) === false);
ok("an event with no user is refused", (await trackServerEvent("trial_started", {}, {})) === false);
ok("a skipped (demo/test) company is refused", (await trackServerEvent("trial_started", {}, { userId: "u", skip: true })) === false);
if (savedEnv === undefined) delete process.env.VERCEL_ENV;
else process.env.VERCEL_ENV = savedEnv;
for (const [file, event] of [
  ["app/api/companies/route.js", "trial_started"],
  ["lib/billing/notify.js", "subscription_started"],
  ["lib/billing/notify.js", "plan_selected"],
  ["app/api/quotes/[id]/send/route.js", "first_quote_sent"],
]) {
  ok(`${event} is sent from ${file}`, SERVER_EVENTS.includes(event) && code(file).includes(`"${event}"`));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Short links: 302, FieldQuo's hosts only, no letter we already use");
// ═══════════════════════════════════════════════════════════════════════════
const appLetters = readdirSync(join(ROOT, "app")).filter((e) => e.length === 1 && statSync(join(ROOT, "app", e)).isDirectory()).sort();
ok("USED_SINGLE_LETTER_ROUTES is exactly the one-letter routes under app/", JSON.stringify([...USED_SINGLE_LETTER_ROUTES].sort()) === JSON.stringify(appLetters), `app/ has ${appLetters.join(",")}`);
ok("no short link uses a route letter", SHORT_LINK_CHARS.every((c) => !USED_SINGLE_LETTER_ROUTES.includes(c)));
ok("every other a–z / 0–9 is a short link", SHORT_LINK_CHARS.length === 36 - USED_SINGLE_LETTER_ROUTES.length);
const [rule] = shortLinkRedirects();
ok("one rule, status 302 exactly", shortLinkRedirects().length === 1 && rule.statusCode === 302 && rule.permanent === undefined);
ok("it lands on the homepage with the campaign", rule.destination === "/?utm_source=heycatch&utm_campaign=:l");
const host = (h) => new RegExp(`^${SHORT_LINK_HOST_PATTERN}$`).test(h);
for (const h of ["fieldquo.com", "www.fieldquo.com", "localhost"]) ok(`fires on ${h}`, host(h));
for (const h of ["sunset.fieldquo.com", "help.fieldquo.com", "fieldquo.com.evil.net", "evilfieldquo.com", "sunset.localhost", "x.vercel.app"]) {
  ok(`does not fire on ${h}`, !host(h));
}
const src = rule.source.match(/^\/:l\(([^)]+)\)$/);
const sourceChars = src ? src[1].split("|") : [];
ok("the source matches exactly the short-link characters", JSON.stringify(sourceChars) === JSON.stringify([...SHORT_LINK_CHARS]));
const all = await nextConfig.redirects();
const live = all.find((r) => r.destination?.includes("utm_source=heycatch"));
ok("next.config.mjs serves the rule", live && live.source === rule.source && live.has?.[0]?.value === SHORT_LINK_HOST_PATTERN);
ok("every next.config redirect is host-restricted (they run before middleware)", all.every((r) => Array.isArray(r.has) && r.has.some((h) => h.type === "host")));
for (const page of COMPARE_PAGES) {
  const short = page.slug.replace(/^fieldquo-vs-/, "");
  ok(`/vs/${short} → /compare/${page.slug}`, all.some((r) => r.source === `/vs/${short}` && r.destination === `/compare/${page.slug}` && r.permanent === true));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The privacy policy names it");
// ═══════════════════════════════════════════════════════════════════════════
const processors = read("lib/legal/processors.js");
ok("lib/legal/processors.js lists HeyCatch", /id:\s*"heycatch"/.test(processors));
ok("the privacy page says it is never on a client's page", /never\s+loaded on a quote, invoice, booking page, client portal/.test(read("app/(marketing)/privacy/page.js").replace(/\s+/g, " ")));

console.log("");
if (failures.length) {
  console.log(`FAILED — ${failures.length} problem(s), ${pass} passed\n`);
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log(`ALL PASS — ${pass} checks\n`);
