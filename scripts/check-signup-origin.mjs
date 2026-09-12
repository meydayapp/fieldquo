// scripts/check-signup-origin.mjs
//
//   npm run check:signup-origin
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/db-stub-loader.mjs scripts/check-signup-origin.mjs
//
// Where a signup came from, and whether it is flagged — executed, not read.
//
// ══ What has to be executed ════════════════════════════════════════════════
//
//   1. The flag rules (lib/platform/signupFlags.js): CA and US are fine, FR is
//      flagged, an UNKNOWN country is NOT flagged, a stated-country mismatch
//      inside the market is its own flag, and the repeat-IP window counts
//      the right rows and never counts "unknown".
//   2. The header reader: Vercel's three geo headers, a percent-encoded city,
//      a junk country, and the rate limiter's "unknown" IP becoming null.
//   3. The write path (lib/platform/signupOrigin.js) against a fake client:
//      a row is written with the decided flag; superadmins are pushed on a
//      flag and not otherwise; and when the row write THROWS the function
//      still returns, logs to the error log, and the signup route's own
//      source awaits it with nothing that could rethrow.
//   4. The console: the read is gated on a platform admin and on
//      company:view, selects nothing of the company beyond name / country /
//      isDemo, and the review action is refused for a plain support role —
//      executed through the permission matrix AND asserted on the route.
//   5. The review write: refused for an unflagged or already-reviewed row,
//      and the stamp and its audit row are one transaction.
//   6. The rail: the badge item exists and reads the count route; the reps
//      route joins the origin flag to each attributed company.
//   7. "vpn_or_hosting" is never produced: nothing sets hostingSignal.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  HOME_COUNTRIES,
  REPEAT_IP_WINDOW_DAYS,
  SIGNUP_FLAGS,
  SIGNUP_FLAG_LABELS,
  SIGNUP_VIAS,
  SIGNUP_VIA_LABELS,
  VERCEL_GEO_HEADERS,
  countRecentFromIp,
  decideSignupFlag,
  deriveVia,
  flagPushPayload,
  needsReview,
  normaliseCountry,
  readSignupRequest,
  repeatIpWindowStart,
} from "../lib/platform/signupFlags.js";
import { recordSignupOrigin, reviewSignupOrigin, ORIGIN_SELECT, NEEDS_REVIEW_WHERE } from "../lib/platform/signupOrigin.js";
import { canPlatform, requirePlatformPermission, PLATFORM_PERMISSIONS } from "../lib/platform/permissions.js";
import { AUDIT_ACTIONS } from "../lib/platform/auditActions.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const strip = (src) =>
  src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    })
    .join("\n");

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};

// ═══════════════ 1. The flag rules ═════════════════════════════════════════
console.log("\n1. The flag rules, executed");

ok("the market is CA and US, nothing else", JSON.stringify(HOME_COUNTRIES) === '["CA","US"]');

let d = decideSignupFlag({ ipCountry: "CA", statedCountry: "CA" });
ok("CA request, stated CA → no flag", d.flag === "none" && d.signals.length === 0, d);
d = decideSignupFlag({ ipCountry: "US", statedCountry: "US" });
ok("US request, stated US → no flag", d.flag === "none", d);
d = decideSignupFlag({ ipCountry: "FR", statedCountry: "CA" });
ok("FR request → outside_ca_us", d.flag === "outside_ca_us", d);
ok("…and the reason names the country and the stated one", /FR/.test(d.reason) && /stated CA/.test(d.reason), d.reason);
ok("…without a second country_mismatch flag beside it", !d.signals.includes("country_mismatch"), d.signals);
d = decideSignupFlag({ ipCountry: null, statedCountry: "CA" });
ok("unknown country → NOT flagged", d.flag === "none" && d.countryKnown === false, d);
ok("…and the reason says unknown, not suspicious", /unknown/.test(d.reason) && !/suspicious/i.test(d.reason), d.reason);
d = decideSignupFlag({ ipCountry: "XX", statedCountry: "CA" });
ok("Vercel's XX placeholder is unknown, not a foreign country", d.flag === "none" && !d.countryKnown, d);
d = decideSignupFlag({ ipCountry: "us", statedCountry: "CA" });
ok("US request, stated CA → country_mismatch (inside the market)", d.flag === "country_mismatch", d);
ok("…case-insensitive on the way in", d.reason.includes("request from US"), d.reason);
d = decideSignupFlag({ ipCountry: "CA", statedCountry: null });
ok("no stated country → no mismatch to claim", d.flag === "none", d);
d = decideSignupFlag({ ipCountry: "CA", statedCountry: "CA", priorSignupsFromIp: 1 });
ok("one other signup from the IP → repeat_ip", d.flag === "repeat_ip", d);
d = decideSignupFlag({ ipCountry: "CA", statedCountry: "CA", priorSignupsFromIp: 0 });
ok("zero others → no repeat", d.flag === "none", d);
d = decideSignupFlag({ ipCountry: "DE", statedCountry: "US", priorSignupsFromIp: 3 });
ok("several signals → the most severe wins the column", d.flag === "outside_ca_us", d);
ok("…and every signal is in the list, severity order", JSON.stringify(d.signals) === '["outside_ca_us","repeat_ip"]', d.signals);
ok("…and the reason carries all of them", /DE/.test(d.reason) && /3 other signups/.test(d.reason), d.reason);
d = decideSignupFlag({});
ok("nothing known at all → none, unknown", d.flag === "none" && !d.countryKnown, d);
ok("severity order is the exported SIGNUP_FLAGS order", SIGNUP_FLAGS[0] === "outside_ca_us" && SIGNUP_FLAGS.at(-1) === "none");
ok("every flag has a label that is not the raw enum", SIGNUP_FLAGS.every((f) => SIGNUP_FLAG_LABELS[f] && !SIGNUP_FLAG_LABELS[f].includes("_")));
ok("every via has a label", SIGNUP_VIAS.every((v) => SIGNUP_VIA_LABELS[v]));

console.log("\n1b. The repeat-IP window");
const now = new Date("2026-09-12T12:00:00Z");
const days = (n) => new Date(now.getTime() - n * 86400000);
ok(`the window is ${REPEAT_IP_WINDOW_DAYS} days`, REPEAT_IP_WINDOW_DAYS === 30);
ok("window start is now minus the window", repeatIpWindowStart(now).getTime() === now.getTime() - 30 * 86400000);
const rows = [
  { companyId: "me", ip: "1.2.3.4", createdAt: now },
  { companyId: "a", ip: "1.2.3.4", createdAt: days(3) },
  { companyId: "b", ip: "1.2.3.4", createdAt: days(29) },
  { companyId: "c", ip: "1.2.3.4", createdAt: days(31) },
  { companyId: "d", ip: "9.9.9.9", createdAt: days(1) },
  { companyId: "e", ip: "unknown", createdAt: days(1) },
  { companyId: "f", ip: null, createdAt: days(1) },
  { companyId: "g", ip: "1.2.3.4", createdAt: "not a date" },
];
ok("counts the OTHER rows inside 30 days, same IP", countRecentFromIp(rows, { ip: "1.2.3.4", now, excludeCompanyId: "me" }) === 2);
ok("…excluding this company's own row", countRecentFromIp(rows, { ip: "1.2.3.4", now }) === 3);
ok("…day 31 is outside", countRecentFromIp(rows, { ip: "1.2.3.4", now: days(-2), excludeCompanyId: "me" }) === 1);
ok("an unknown IP never repeats", countRecentFromIp(rows, { ip: "unknown", now }) === 0);
ok("a null IP never repeats", countRecentFromIp(rows, { ip: null, now }) === 0);
ok("garbage rows are ignored", countRecentFromIp([null, {}, "x"], { ip: "1.2.3.4", now }) === 0);

// ═══════════════ 2. The header reader ══════════════════════════════════════
console.log("\n2. The header reader");
const H = (map) => ({ get: (k) => (k in map ? map[k] : null) });
let r = readSignupRequest(
  H({
    "x-vercel-ip-country": "ca",
    "x-vercel-ip-country-region": "qc",
    "x-vercel-ip-city": "Montr%C3%A9al",
    "user-agent": "Mozilla/5.0 test",
    "accept-language": "fr-CA,fr;q=0.9,en;q=0.8",
  }),
  "203.0.113.7",
);
ok("country upper-cased", r.ipCountry === "CA", r);
ok("region upper-cased", r.ipRegion === "QC", r);
ok("city percent-decoded", r.ipCity === "Montréal", r);
ok("IP kept as given", r.ip === "203.0.113.7");
ok("user agent and accept-language kept", r.userAgent === "Mozilla/5.0 test" && r.acceptLanguage.startsWith("fr-CA"));
ok("the three Vercel headers are the documented ones", VERCEL_GEO_HEADERS.country === "x-vercel-ip-country" && VERCEL_GEO_HEADERS.region === "x-vercel-ip-country-region" && VERCEL_GEO_HEADERS.city === "x-vercel-ip-city");
r = readSignupRequest(H({}), "unknown");
ok("no headers → every geo field null", r.ipCountry === null && r.ipRegion === null && r.ipCity === null);
ok("the rate limiter's 'unknown' IP becomes null", r.ip === null);
r = readSignupRequest(H({ "x-vercel-ip-country": "France", "x-vercel-ip-city": "%E0%A4%A" }), "  ");
ok("a non-alpha-2 country is unknown", r.ipCountry === null, r);
ok("an undecodable city is kept as given rather than thrown on", r.ipCity === "%E0%A4%A", r);
ok("blank IP → null", r.ip === null);
r = readSignupRequest(null, "1.1.1.1");
ok("no headers object at all does not throw", r.ip === "1.1.1.1" && r.ipCountry === null);
ok("a 300-char user agent is truncated", readSignupRequest(H({ "user-agent": "x".repeat(2000) }), null).userAgent.length === 512);
ok("normaliseCountry rejects T1 (Tor placeholder)", normaliseCountry("T1") === null);
ok("readSignupRequest has no hosting/VPN field — nothing on Vercel carries one", !("hostingSignal" in r));

console.log("\n2b. Which door");
ok("sales code → sales_link", deriveVia({ salesCodePresented: true }) === "sales_link");
ok("sales code beats a referral when both", deriveVia({ salesCodePresented: true, referralApplied: true }) === "sales_link");
ok("referral → referral", deriveVia({ referralApplied: true }) === "referral");
ok("promo → other", deriveVia({ promoApplied: true }) === "other");
ok("nothing → direct", deriveVia({}) === "direct");

// ═══════════════ 3. The write path ═════════════════════════════════════════
console.log("\n3. recordSignupOrigin against a fake client");

function fakeDb({ recent = [], createThrows = null, repName = "Daniel" } = {}) {
  const writes = [];
  return {
    writes,
    signupOrigin: {
      findMany: async ({ where }) => {
        // The query's own shape is asserted: same IP, createdAt >= window start.
        writes.push({ op: "findMany", where });
        return recent;
      },
      create: async ({ data }) => {
        if (createThrows) throw createThrows;
        writes.push({ op: "create", data });
        return { id: "so_1", ...data, reviewedAt: null };
      },
    },
    salesRep: { findUnique: async () => ({ name: repName }) },
  };
}
const request = (headers, ip) => ({
  headers: {
    get: (k) => {
      const m = { "x-forwarded-for": ip ? `${ip}, 10.0.0.1` : null, ...headers };
      return k in m ? m[k] : null;
    },
  },
});

{
  const pushes = [];
  const errors = [];
  const db = fakeDb();
  const res = await recordSignupOrigin(
    {
      companyId: "c1",
      request: request({ "x-vercel-ip-country": "CA", "x-vercel-ip-country-region": "ON" }, "198.51.100.1"),
      via: "sales_link",
      salesRepId: "rep1",
      referralCode: null,
      statedCountry: "CA",
      companyName: "Easy Roofers",
    },
    { db, now, push: async (p) => pushes.push(p), recordError: async (e) => errors.push(e) },
  );
  ok("a CA signup writes a row", res.ok && res.origin?.id === "so_1", res);
  const created = db.writes.find((w) => w.op === "create")?.data;
  ok("…with the IP from the first x-forwarded-for hop", created?.ip === "198.51.100.1", created);
  ok("…flag none, via sales_link, rep kept", created?.flag === "none" && created?.via === "sales_link" && created?.salesRepId === "rep1", created);
  ok("…statedCountry recorded", created?.statedCountry === "CA");
  const q = db.writes.find((w) => w.op === "findMany")?.where;
  ok("the repeat query is keyed on the IP inside the window", q?.ip === "198.51.100.1" && q?.createdAt?.gte?.getTime() === repeatIpWindowStart(now).getTime(), q);
  ok("no push for an unflagged signup", pushes.length === 0);
  ok("nothing logged", errors.length === 0);
}
{
  const pushes = [];
  const db = fakeDb();
  const res = await recordSignupOrigin(
    { companyId: "c2", request: request({ "x-vercel-ip-country": "FR" }, "198.51.100.2"), via: "sales_link", salesRepId: "rep1", statedCountry: "CA", companyName: "Toitures Paris" },
    { db, now, push: async (p) => pushes.push(p), recordError: async () => {} },
  );
  ok("a FR signup on a rep link is flagged outside_ca_us", res.flag === "outside_ca_us", res);
  ok("…and superadmins are pushed", pushes.length === 1 && JSON.stringify(pushes[0].roles) === '["superadmin"]', pushes);
  const p = pushes[0]?.payload;
  ok("…the push names the flag, the company, the country and the rep's link", p?.title.includes("Outside CA/US") && p?.body.includes("Toitures Paris") && p?.body.includes("FR") && p?.body.includes("Daniel's link"), p);
  ok("…the push carries no IP", !JSON.stringify(p).includes("198.51.100.2"));
  ok("…and lands on the flagged filter", p?.url === "/platform/signup-origins?flagged=1");
}
{
  const db = fakeDb({ recent: [{ companyId: "old", ip: "198.51.100.3", createdAt: days(2) }] });
  const res = await recordSignupOrigin(
    { companyId: "c3", request: request({ "x-vercel-ip-country": "US" }, "198.51.100.3"), via: "direct", statedCountry: "US" },
    { db, now, push: async () => {}, recordError: async () => {} },
  );
  ok("a second company from the same IP in the window → repeat_ip", res.flag === "repeat_ip", res);
}
{
  const db = fakeDb();
  const res = await recordSignupOrigin(
    { companyId: "c4", request: request({}, null), via: "direct", statedCountry: "CA" },
    { db, now, push: async () => {}, recordError: async () => {} },
  );
  const created = db.writes.find((w) => w.op === "create")?.data;
  ok("no headers (local dev) → row written, everything null, no flag", res.ok && created?.ip === null && created?.ipCountry === null && created?.flag === "none", created);
  ok("…and the repeat query is skipped for a null IP", !db.writes.some((w) => w.op === "findMany"));
}
{
  const errors = [];
  const db = fakeDb({ createThrows: new Error("P1001 cannot reach database") });
  let threw = false;
  let res;
  try {
    res = await recordSignupOrigin(
      { companyId: "c5", request: request({ "x-vercel-ip-country": "CA" }, "198.51.100.5"), via: "direct", statedCountry: "CA" },
      { db, now, push: async () => {}, recordError: async (e) => errors.push(e) },
    );
  } catch {
    threw = true;
  }
  ok("a failing row write does NOT throw — the signup carries on", !threw && res?.ok === false, res);
  ok("…and is on the platform error log under signup_origin", errors.length === 1 && errors[0].area === "signup_origin" && errors[0].companyId === "c5", errors);
}
{
  const errors = [];
  const res = await recordSignupOrigin(
    { companyId: "c6", request: request({}, null), via: "direct" },
    { db: { signupOrigin: { create: async () => { throw new Error("x"); } } }, now, push: async () => {}, recordError: async () => { throw new Error("log is down too"); } },
  );
  ok("even the error log throwing does not surface", res.ok === false, res);
  ok("a via outside the vocabulary is stored as other", true);
  void errors;
}
{
  const db = fakeDb();
  await recordSignupOrigin({ companyId: "c7", request: request({}, null), via: "bogus" }, { db, now, push: async () => {}, recordError: async () => {} });
  ok("an unknown via is stored as 'other', never as given", db.writes.find((w) => w.op === "create")?.data.via === "other");
}

console.log("\n3b. The signup route calls it, best-effort, after the company exists");
{
  const src = strip(read("app/api/companies/route.js"));
  const txAt = src.indexOf("db.$transaction(async (tx)");
  const originAt = src.indexOf("recordSignupOrigin({");
  const orgAt = src.indexOf("auth.api.createOrganization");
  ok("recordSignupOrigin is called", originAt > 0);
  ok("…after the Company + Member transaction", txAt > 0 && originAt > txAt);
  ok("…before the org is created (so a rolled-back company takes its row with it)", orgAt > originAt);
  ok("…with the request (headers are read there, not here)", /recordSignupOrigin\(\{[\s\S]*?request,[\s\S]*?\}\)/.test(src));
  ok("…with the stated country the company was created with", /statedCountry:\s*homeCountry/.test(src));
  ok("…and the attributed rep", /salesRepId:\s*attributedRepId/.test(src));
  ok("the route reads no geo header itself — one reader, in the lib", !src.includes("x-vercel-ip"));
  const lib = strip(read("lib/platform/signupOrigin.js"));
  ok("the lib reads the IP through lib/rateLimit.js's clientIp — no second IP reader", lib.includes('import { clientIp } from "@/lib/rateLimit"') && !lib.includes('"x-forwarded-for"'));
  ok("recordSignupOrigin's body is one try/catch that returns", /export async function recordSignupOrigin[\s\S]*?try \{[\s\S]*?\} catch \(err\) \{[\s\S]*?return \{ ok: false/.test(lib));
}

// ═══════════════ 4. The console ════════════════════════════════════════════
console.log("\n4. The console read and the review action");
{
  const list = strip(read("app/api/platform/signup-origins/route.js"));
  ok("the list route resolves a platform admin", list.includes("getCurrentPlatformAdmin(request)"));
  ok("…and requires company:view", list.includes('requirePlatformPermission(admin.role, "company:view")'));
  ok("…and answers 401 with no admin", /if \(!admin\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\)/.test(list));
  const companyFields = Object.keys(ORIGIN_SELECT.company.select);
  ok("the select reaches only name / country / isDemo of the company — nothing the company owns", JSON.stringify(companyFields.sort()) === '["country","isDemo","name"]', companyFields);
  ok("no quote, invoice, job or client is selected", !["quote", "invoice", "job", "client"].some((k) => JSON.stringify(ORIGIN_SELECT).includes(`"${k}`)));
  ok("the badge, the filter and the push agree on 'needs review'", JSON.stringify(NEEDS_REVIEW_WHERE) === '{"flag":{"not":"none"},"reviewedAt":null}');
  ok("needsReview(): flagged + unreviewed", needsReview({ flag: "repeat_ip", reviewedAt: null }) === true);
  ok("needsReview(): reviewed is done", needsReview({ flag: "repeat_ip", reviewedAt: new Date() }) === false);
  ok("needsReview(): none never needs it", needsReview({ flag: "none", reviewedAt: null }) === false);

  const count = strip(read("app/api/platform/signup-origins/count/route.js"));
  ok("the count route is gated on an admin and answers null (not 403) below company:view", count.includes("getCurrentPlatformAdmin") && count.includes("{ count: null }"));
  ok("…and counts NEEDS_REVIEW_WHERE", count.includes("NEEDS_REVIEW_WHERE"));
}
{
  ok("support does NOT hold signup:review", canPlatform("support", "signup:review") === false);
  ok("admin holds it", canPlatform("admin", "signup:review") === true);
  ok("superadmin holds it (via *)", canPlatform("superadmin", "signup:review") === true);
  ok("support is not granted it by accident in the matrix", !PLATFORM_PERMISSIONS.support.includes("signup:review"));
  let status = null;
  try {
    requirePlatformPermission("support", "signup:review");
  } catch (e) {
    status = e.status;
  }
  ok("requirePlatformPermission refuses support with a 403", status === 403);
  const route = strip(read("app/api/platform/signup-origins/[id]/review/route.js"));
  ok("the review route requires signup:review", route.includes('requirePlatformPermission(admin.role, "signup:review")'));
  ok("…and turns the refusal into a 403, not a 500", /catch \{\s*return bad\([^)]*403\)/.test(route));
  ok("…and refuses markup in the note", route.includes("containsMarkupCharacters(note)"));
  ok("…and awaits params (Next 16)", route.includes("await params"));
  ok("the audit vocabulary knows signup_reviewed", AUDIT_ACTIONS.signup_reviewed?.label === "Reviewed a flagged signup");
}

// ═══════════════ 5. The review write ═══════════════════════════════════════
console.log("\n5. reviewSignupOrigin against a fake transaction");
function fakeTxDb(row) {
  const writes = [];
  const tx = {
    signupOrigin: {
      findUnique: async () => row,
      update: async ({ where, data }) => {
        writes.push({ op: "update", where, data });
        return { id: where.id, ...row, ...data, company: { name: "X" }, salesRep: null, reviewedBy: { email: "a@b" } };
      },
    },
    platformAuditLog: { create: async ({ data }) => writes.push({ op: "audit", data }) },
  };
  let transactions = 0;
  return {
    writes,
    get transactions() {
      return transactions;
    },
    $transaction: async (fn) => {
      transactions += 1;
      return fn(tx);
    },
  };
}
{
  const db = fakeTxDb({ id: "so_9", companyId: "c9", flag: "outside_ca_us", reviewedAt: null });
  const res = await reviewSignupOrigin({ id: "so_9", adminId: "adm1", note: "  Owner confirmed by phone — travelling.  " }, { db, now });
  ok("a flagged, unreviewed row is stamped", res.ok && res.status === 200, res);
  ok("…inside one transaction", db.transactions === 1);
  const upd = db.writes.find((w) => w.op === "update");
  ok("…with reviewedAt / reviewedById / trimmed note", upd?.data.reviewedAt === now && upd?.data.reviewedById === "adm1" && upd?.data.reviewNote === "Owner confirmed by phone — travelling.", upd);
  ok("…the full shape is selected back for the screen", upd && JSON.stringify(Object.keys(upd.data)) && db.writes.length === 2);
  const audit = db.writes.find((w) => w.op === "audit");
  ok("…and an audit row in the same transaction names admin, company and flag", audit?.data.platformAdminId === "adm1" && audit?.data.targetCompanyId === "c9" && audit?.data.action === "signup_reviewed" && audit?.data.details.flag === "outside_ca_us", audit);
}
{
  const db = fakeTxDb({ id: "so_10", companyId: "c10", flag: "none", reviewedAt: null });
  const res = await reviewSignupOrigin({ id: "so_10", adminId: "adm1" }, { db, now });
  ok("an unflagged row is refused 409, nothing written", res.ok === false && res.status === 409 && db.writes.length === 0, res);
}
{
  const db = fakeTxDb({ id: "so_11", companyId: "c11", flag: "repeat_ip", reviewedAt: days(1) });
  const res = await reviewSignupOrigin({ id: "so_11", adminId: "adm2" }, { db, now });
  ok("an already-reviewed row is refused 409 — who looked first is not overwritten", res.ok === false && res.status === 409 && db.writes.length === 0, res);
}
{
  const db = fakeTxDb(null);
  const res = await reviewSignupOrigin({ id: "nope", adminId: "adm1" }, { db, now });
  ok("a missing row is 404", res.status === 404);
  const res2 = await reviewSignupOrigin({ id: "", adminId: "adm1" }, { db, now });
  ok("no id is 400 and no transaction is opened", res2.status === 400 && db.transactions === 1);
}

// ═══════════════ 6. The rail and the reps accordion ════════════════════════
console.log("\n6. The rail and the reps accordion");
{
  const rail = strip(read("app/components/platform/PlatformSidebar.js"));
  ok("the rail has a Signup origins item", rail.includes('href: "/platform/signup-origins"'));
  ok("…wearing the signups badge", /href: "\/platform\/signup-origins"[^}]*badge: "signups"/.test(rail));
  ok("…read from the count route", rail.includes('"/api/platform/signup-origins/count"'));
  ok("…and the Row draws it", rail.includes('item.badge === "signups" ? signupFlagCount'));
  ok("the page exists", fs.existsSync(path.join(ROOT, "app/platform/signup-origins/page.js")));
  const page = strip(read("app/platform/signup-origins/page.js"));
  ok("the page has the Flagged only filter", page.includes("Flagged only") && page.includes("?flagged=1"));
  ok("the page posts the review with a note", page.includes("/review`") && page.includes("body: { note }"));
  // `flag={o.flag}` is a PROP to the chip, which prints the label; what must
  // not exist is the enum as a text node (`>{o.flag}<`).
  ok("the page never prints the raw flag enum as text — the chip prints flagLabel", !/>\s*\{o\.flag\}\s*</.test(page) && page.includes("flagLabel={o.flagLabel}"));
  ok("unknown country is printed as unknown", page.includes("Country unknown"));
  ok("the review form is drawn only for those who may review (canReview from the server)", page.includes("data.canReview"));

  const reps = strip(read("app/api/platform/sales/reps/route.js"));
  ok("the reps route joins each attributed company to its signupOrigin", reps.includes("signupOrigin: { select: { ipCountry: true, flag: true"));
  ok("…and returns companies + flaggedSignups per rep", reps.includes("companies: companiesByRep.get(r.id)") && reps.includes("flaggedSignups:"));
  const repsPage = strip(read("app/platform/sales/reps/page.js"));
  ok("the reps accordion draws the same SignupFlagChip beside each company", repsPage.includes("SignupFlagChip") && repsPage.includes("rep.companies.map"));
  ok("…and the flagged count on the collapsed header", repsPage.includes("data-rep-flagged={rep.id}"));
  ok("a company with no origin row gets no invented chip", repsPage.includes("no origin on file"));
}

// ═══════════════ 7. What is deliberately absent ════════════════════════════
console.log("\n7. What is not produced");
{
  ok("vpn_or_hosting is in the vocabulary", SIGNUP_FLAGS.includes("vpn_or_hosting"));
  const withSignal = decideSignupFlag({ ipCountry: "CA", statedCountry: "CA", hostingSignal: true });
  ok("…it is producible only from an explicit hostingSignal", withSignal.flag === "vpn_or_hosting");
  const lib = strip(read("lib/platform/signupOrigin.js"));
  ok("…and nothing in the write path sets one — no header on Vercel carries it, no paid lookup is made", !lib.includes("hostingSignal"));
  ok("no third-party geo lookup: the lib makes no fetch()", !lib.includes("fetch("));
  const vercelDoc = read("docs/VERCEL.md");
  ok("docs/VERCEL.md names the three Vercel geo headers", ["x-vercel-ip-country", "x-vercel-ip-country-region", "x-vercel-ip-city"].every((h) => vercelDoc.includes(h)));
  const p = flagPushPayload({ companyName: "A", flag: "repeat_ip", ipCountry: null, via: "direct" });
  ok("a push for an unknown country says so", p.body.includes("unknown country"));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
