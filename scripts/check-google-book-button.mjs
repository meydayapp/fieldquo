// scripts/check-google-book-button.mjs
//
//   npm run check:google-book-button
//
// The "Book" button on a company's Google Business Profile (Settings ›
// Booking Page) — EXECUTED, not read. The route runs as shipped, against the
// memory Prisma (scripts/fixtures/memoryPrisma.mjs), a scripted member
// (scripts/fixtures/currentMemberStub.mjs) and a stubbed global fetch that
// plays Google: the OAuth token endpoint and the Place Actions API, keeping
// a listing's links in memory. Nothing here reaches a network.
//
//   1. pure helpers against hostile input: the location → parent join, the
//      booking URL, the https-only rule, the same-page test, which links are
//      ours, and Google's refusals → sentences (API disabled, quota)
//   2. flag off: no automation offered, POST refused, Google never called
//   3. approved but not connected / no listing picked / page not bookable /
//      non-https origin: each refused with its own kind, Google never called
//   4. permission: nobody → 401, an employee → 403 on every verb, a
//      read-only support session → 403 on POST and DELETE
//   5. create: list first, then ONE create with exactly { uri, APPOINTMENT,
//      isPreferred } to the documented URL; a uri in the body is ignored
//   6. idempotent: a second POST lists, finds ours, creates nothing
//   7. remove: deletes ours and only ours — another booking tool's link and
//      an aggregator's survive; a second remove deletes nothing
//   8. Google's 403 "API has not been used … or it is disabled" → api_disabled
//   9. no DB write on any path (the connection row is byte-identical)
//  10. the card, rendered in every state, draws "Add it for me" only when the
//      server said canAutomate, never the booking link when the page is not
//      bookable, and every string resolves in all nine languages
//  11. the Booking Page mounts the card
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { register } from "node:module";

// The card imports next/link, and useTranslation reaches next/navigation.
// Next's package has no "exports" map, so bare node wants the ".js" spelling
// the bundler supplies; this resolves the two, and nothing else.
register(
  "data:text/javascript," +
    encodeURIComponent(
      "export async function resolve(s, c, n) { return /^next\\/(link|navigation)$/.test(s) ? n(s + '.js', c) : n(s, c); }",
    ),
);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret-for-the-check";
process.env.NEXT_PUBLIC_APP_URL = "https://www.fieldquo.com";
delete process.env.GOOGLE_BUSINESS_API_APPROVED;

let failures = 0;
let passes = 0;
function ok(cond, label) {
  if (cond) passes++;
  else {
    failures++;
    console.log(`  FAIL  ${label}`);
  }
}
function section(name) {
  console.log(`\n${name}`);
}

// ── Google, played by fetch ────────────────────────────────────────────────
const PA = "https://mybusinessplaceactions.googleapis.com/v1/";
const calls = [];
let links = [];
let seq = 0;
let failNextList = null; // { status, body }
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const method = (init.method || "GET").toUpperCase();
  calls.push({ url: u, method, body: init.body ?? null, auth: init.headers?.Authorization || init.headers?.authorization || null });
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (u.startsWith("https://oauth2.googleapis.com/token")) return json(200, { access_token: "at-test", expires_in: 3599 });
  if (!u.startsWith(PA)) throw new Error(`check: unexpected fetch ${method} ${u}`);
  const rest = u.slice(PA.length);
  if (method === "GET" && /^locations\/[^/]+\/placeActionLinks(\?|$)/.test(rest)) {
    if (failNextList) {
      const f = failNextList;
      failNextList = null;
      return json(f.status, f.body);
    }
    const parent = rest.split("/placeActionLinks")[0];
    const qs = new URL(u).searchParams;
    const filter = qs.get("filter");
    const type = filter ? /^placeActionType=(\w+)$/.exec(filter)?.[1] : null;
    return json(200, { placeActionLinks: links.filter((l) => l.name.startsWith(`${parent}/`) && (!type || l.placeActionType === type)) });
  }
  if (method === "POST" && /^locations\/[^/]+\/placeActionLinks$/.test(rest)) {
    const parent = rest.split("/placeActionLinks")[0];
    const body = JSON.parse(init.body);
    const dup = links.find((l) => l.name.startsWith(`${parent}/`) && l.uri === body.uri && l.placeActionType === body.placeActionType);
    if (dup) return json(200, dup);
    const link = { ...body, name: `${parent}/placeActionLinks/pal${++seq}`, providerType: "MERCHANT", isEditable: true, createTime: "2026-09-28T12:00:00Z" };
    links.push(link);
    return json(200, link);
  }
  if (method === "DELETE" && /^locations\/[^/]+\/placeActionLinks\/[^/]+$/.test(rest)) {
    const before = links.length;
    links = links.filter((l) => l.name !== rest);
    return before === links.length ? json(404, { error: { message: "not found", status: "NOT_FOUND" } }) : json(200, {});
  }
  throw new Error(`check: unexpected Google call ${method} ${u}`);
};
const googleCalls = () => calls.filter((c) => !c.url.startsWith("https://oauth2.googleapis.com/"));

// ── Product code ───────────────────────────────────────────────────────────
const { db } = await import("@/lib/db");
const { setCurrentMember } = await import("./fixtures/currentMemberStub.mjs");
const { encryptToken } = await import("../lib/meta/tokenCrypto.js");
const client = await import("../lib/reviews/googleBusiness/client.js");
const bb = await import("../lib/reviews/googleBusiness/bookButton.js");
const route = await import("../app/api/reviews/google/book-button/route.js");
const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");
const { BookButtonCard } = await import("../app/app/settings/booking-page/GoogleBookButton.js");

// ── 1. Pure helpers ────────────────────────────────────────────────────────
section("1. pure helpers");
ok(client.placeActionParent("locations/456") === "locations/456", "parent: bare location");
ok(client.placeActionParent("accounts/1/locations/456") === "locations/456", "parent: v4 full name");
for (const bad of [null, "", "accounts/1", "locations/", "locations/4/../x", "locations/4/placeActionLinks/9", "https://evil/locations/4", "locations/4?x=1"]) {
  ok(client.placeActionParent(bad) === null, `parent refuses ${JSON.stringify(bad)}`);
}
ok(bb.BOOK_ACTION_TYPE === "APPOINTMENT", "type is APPOINTMENT");
ok(bb.bookingPageUrl("https://www.fieldquo.com/", { slug: "cedar-co" }) === "https://www.fieldquo.com/book/cedar-co", "booking URL from slug");
ok(bb.bookingPageUrl("https://www.fieldquo.com", { slug: "cedar-co", bookingSlug: "book-cedar" }) === "https://www.fieldquo.com/book/book-cedar", "bookingSlug wins");
ok(bb.bookingPageUrl("https://www.fieldquo.com", { slug: "" }) === null, "no slug → null");
ok(bb.bookingPageUrl("", { slug: "x" }) === null, "no origin → null");
ok(bb.bookingPageUrl("https://a.com", { slug: "a/b?c" }) === "https://a.com/book/a%2Fb%3Fc", "slug is encoded");
ok(bb.pushableUrl("https://www.fieldquo.com/book/x") === true, "https public → pushable");
for (const bad of ["http://www.fieldquo.com/book/x", "https://localhost:3000/book/x", "https://127.0.0.1/book/x", "https://app.localhost/book/x", "https://shop.test/book/x", "javascript:alert(1)", "", null]) {
  ok(bb.pushableUrl(bad) === false, `not pushable: ${JSON.stringify(bad)}`);
}
ok(bb.sameUri("https://WWW.fieldquo.com/book/x/", "https://www.fieldquo.com/book/x"), "same page: host case, trailing slash");
ok(!bb.sameUri("https://www.fieldquo.com/book/x2", "https://www.fieldquo.com/book/x"), "different slug is not the same page");
ok(!bb.sameUri("http://www.fieldquo.com/book/x", "https://www.fieldquo.com/book/x"), "scheme matters");
ok(!bb.sameUri("", ""), "two blanks are not the same page");
const URL_OURS = "https://www.fieldquo.com/book/cedar-co";
const sample = [
  { name: "locations/456/placeActionLinks/a", uri: URL_OURS, placeActionType: "APPOINTMENT", isEditable: true },
  { name: "locations/456/placeActionLinks/b", uri: "https://calendly.com/cedar", placeActionType: "APPOINTMENT", isEditable: true },
  { name: "locations/456/placeActionLinks/c", uri: URL_OURS, placeActionType: "ONLINE_APPOINTMENT", isEditable: true },
  { name: "locations/456/placeActionLinks/d", uri: URL_OURS, placeActionType: "APPOINTMENT", isEditable: false, providerType: "AGGREGATOR_3P" },
  { name: "locations/999/placeActionLinks/e", uri: URL_OURS, placeActionType: "APPOINTMENT", isEditable: true },
  null,
  { uri: URL_OURS, placeActionType: "APPOINTMENT" },
];
const mine = bb.ourLinks(sample, { parent: "locations/456", bookingUrl: URL_OURS });
ok(mine.length === 1 && mine[0].name.endsWith("/a"), "ourLinks: only our APPOINTMENT link on this location, editable, named");
const disabled = bb.bookButtonMessage({ status: 403, message: "My Business Place Actions API has not been used in project 123 before or it is disabled.", reason: "PERMISSION_DENIED" });
ok(disabled.kind === "api_disabled" && disabled.message.includes("has not been used in project 123"), "403 API disabled → api_disabled, Google's words kept");
const quota = bb.bookButtonMessage({ status: 429, message: "Quota exceeded", reason: "RESOURCE_EXHAUSTED" });
ok(quota.kind === "quota" && !/paste your reviews/i.test(quota.message), "429 → quota, not the reviews advice");
ok(bb.bookButtonMessage({ status: 401, message: "invalid_grant" }).kind === "auth", "401 → auth (quotaMessage)");
ok(bb.bookButtonMessage({ status: 403, message: "The caller does not have permission" }).kind === "scope", "plain 403 → scope (quotaMessage)");

// ── Fixture company ────────────────────────────────────────────────────────
const company = await db.company.create({ data: { name: "Cedar & Co", slug: "cedar-co", bookingSlug: null } });
const other = await db.company.create({ data: { name: "Other", slug: "other-co" } });
const owner = { id: "m-owner", companyId: company.id, role: "owner", userId: "u1" };
const supervisor = { id: "m-sup", companyId: company.id, role: "supervisor", userId: "u2" };
const employee = { id: "m-emp", companyId: company.id, role: "employee", userId: "u3" };
await db.eventType.create({ data: { companyId: company.id, userId: "u1", name: "Consultation", slug: "consultation-u1", active: true } });
// Another company's hours must not make this one's page bookable.
await db.eventType.create({ data: { companyId: other.id, userId: "u9", name: "Other", slug: "o", active: true } });
await db.availabilitySchedule.create({ data: { userId: "u9", dayOfWeek: 1, startTime: "09:00", endTime: "17:00" } });

const req = (method, body) =>
  new Request("https://www.fieldquo.com/api/reviews/google/book-button", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined && method !== "GET" ? { body: JSON.stringify(body) } : {}),
  });
async function call(verb, body) {
  const handler = route[verb];
  const res = await handler(req(verb, body));
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

// ── 3a. Not bookable ───────────────────────────────────────────────────────
section("3. refusals before Google");
setCurrentMember(owner);
process.env.GOOGLE_BUSINESS_API_APPROVED = "1";
let r = await call("GET");
ok(r.status === 200 && r.json.bookingLive === false && r.json.bookingUrl === null, "no bookable hours → not live, no link handed out");
ok(r.json.google.canAutomate === false, "not live → no automation");
await db.availabilitySchedule.create({ data: { userId: "u1", dayOfWeek: 2, startTime: "09:00", endTime: "17:00" } });
r = await call("GET");
ok(r.json.bookingLive === true && r.json.bookingUrl === URL_OURS, "hours set → live, link is the server-built booking URL");
ok(r.json.google.available === true && r.json.google.connected === false && r.json.google.canAutomate === false, "approved, not connected → no automation");
calls.length = 0;
r = await call("POST", { preferred: true });
ok(r.status === 409 && r.json.kind === "not_connected", "POST not connected → 409 not_connected");
r = await call("DELETE");
ok(r.status === 409 && r.json.kind === "not_connected", "DELETE not connected → 409 not_connected");

await db.companyGoogleBusiness.create({
  data: { companyId: company.id, refreshTokenEnc: encryptToken("refresh-test"), email: "owner@cedar.test", accountName: "accounts/1", locationName: null, locationTitle: null },
});
r = await call("POST", {});
ok(r.status === 409 && r.json.kind === "no_location", "POST no listing picked → 409 no_location");
ok(googleCalls().length === 0 && calls.length === 0, "no Google call on any refusal so far");

await db.companyGoogleBusiness.update({ where: { companyId: company.id }, data: { locationName: "accounts/1/locations/456", locationTitle: "Cedar & Co — Main St" } });

// ── 2. Flag off ────────────────────────────────────────────────────────────
section("2. flag off");
delete process.env.GOOGLE_BUSINESS_API_APPROVED;
calls.length = 0;
r = await call("GET");
ok(r.json.google.available === false && r.json.google.canAutomate === false && r.json.google.onGoogle === null, "flag unset → not available, not asked");
r = await call("POST", { preferred: true });
ok(r.status === 409 && r.json.kind === "not_approved", "flag unset → POST 409 not_approved");
r = await call("DELETE");
ok(r.status === 409 && r.json.kind === "not_approved", "flag unset → DELETE 409 not_approved");
for (const spelling of ["true", "yes", "0", " 1x"]) {
  process.env.GOOGLE_BUSINESS_API_APPROVED = spelling;
  r = await call("POST", {});
  ok(r.status === 409 && r.json.kind === "not_approved", `flag "${spelling}" is not "1" → refused`);
}
ok(calls.length === 0, "flag off → Google never called (not even the token endpoint)");
process.env.GOOGLE_BUSINESS_API_APPROVED = "1";

// Non-https origin (a local dev server) is never pushed to a live listing.
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
calls.length = 0;
r = await call("GET");
ok(r.json.google.canAutomate === false, "http origin → no automation offered");
r = await call("POST", {});
ok(r.status === 409 && r.json.kind === "not_https", "http origin → POST 409 not_https");
ok(calls.length === 0, "http origin → Google never called");
process.env.NEXT_PUBLIC_APP_URL = "https://www.fieldquo.com";

// ── 4. Permission ──────────────────────────────────────────────────────────
section("4. permission");
setCurrentMember(null);
for (const verb of ["GET", "POST", "DELETE"]) ok((await call(verb, {})).status === 401, `nobody → ${verb} 401`);
setCurrentMember(employee);
for (const verb of ["GET", "POST", "DELETE"]) ok((await call(verb, {})).status === 403, `employee → ${verb} 403`);
setCurrentMember({ ...owner, impersonationMode: "read_only" });
ok((await call("POST", {})).status === 403, "read-only session → POST 403");
ok((await call("DELETE")).status === 403, "read-only session → DELETE 403");
ok(calls.length === 0, "refused members → Google never called");

// ── 5. Create ──────────────────────────────────────────────────────────────
section("5. create");
links = [
  { name: "locations/456/placeActionLinks/calendly", uri: "https://calendly.com/cedar", placeActionType: "APPOINTMENT", providerType: "MERCHANT", isEditable: true, isPreferred: true },
  { name: "locations/456/placeActionLinks/rwg", uri: "https://partner.example/cedar", placeActionType: "APPOINTMENT", providerType: "AGGREGATOR_3P", isEditable: false },
];
const before = JSON.stringify(await db.companyGoogleBusiness.findUnique({ where: { companyId: company.id } }));
setCurrentMember(supervisor); // user:manage — the Booking Page's own gate
calls.length = 0;
r = await call("GET");
ok(r.json.google.canAutomate === true && r.json.google.onGoogle === false, "connected + listing + live → canAutomate, not on Google yet");
ok(r.json.google.locationTitle === "Cedar & Co — Main St", "listing title passed through");
ok(googleCalls().every((c) => c.method === "GET"), "GET only lists");
calls.length = 0;
r = await call("POST", { preferred: true, uri: "https://evil.example/phish" });
ok(r.status === 200 && r.json.status === "created", "POST → created");
const gc = googleCalls();
ok(gc.length === 2 && gc[0].method === "GET" && gc[1].method === "POST", "list first, then exactly one create");
ok(gc[0].url === `${PA}locations/456/placeActionLinks?filter=placeActionType%3DAPPOINTMENT`, "list URL: v1 parent, APPOINTMENT filter");
ok(gc[1].url === `${PA}locations/456/placeActionLinks`, "create URL: documented path under locations/456");
ok(gc.every((c) => c.auth === "Bearer at-test"), "bearer token from the refresh on every call");
const sent = JSON.parse(gc[1].body);
ok(JSON.stringify(sent) === JSON.stringify({ uri: URL_OURS, placeActionType: "APPOINTMENT", isPreferred: true }), "create body is exactly { uri, APPOINTMENT, isPreferred } — the body's uri was ignored");
ok(links.length === 3, "one link added to the listing");
ok(r.json.link && r.json.link.uri === URL_OURS && r.json.link.isPreferred === true && !("name" in r.json.link), "answer: public shape, no resource name");

// ── 6. Idempotent ──────────────────────────────────────────────────────────
section("6. idempotent");
calls.length = 0;
r = await call("POST", { preferred: false });
ok(r.status === 200 && r.json.status === "already", "second POST → already on Google");
ok(googleCalls().length === 1 && googleCalls()[0].method === "GET", "second POST lists and creates nothing");
ok(links.length === 3, "no duplicate on the listing");
r = await call("GET");
ok(r.json.google.onGoogle === true && r.json.google.link.isPreferred === true, "GET now reports on Google, preferred");
// A link added by hand with the same address counts as ours for "already".
const handAdded = links.find((l) => l.uri === URL_OURS);
ok(Boolean(handAdded), "our link is on the listing");

// ── 7. Remove ──────────────────────────────────────────────────────────────
section("7. remove");
calls.length = 0;
r = await call("DELETE");
ok(r.status === 200 && r.json.status === "removed" && r.json.removed === 1, "DELETE → removed 1");
const dels = googleCalls().filter((c) => c.method === "DELETE");
ok(dels.length === 1 && dels[0].url === `${PA}${handAdded.name}`, "deleted exactly our link, by its name");
ok(links.some((l) => l.name.endsWith("/calendly")) && links.some((l) => l.name.endsWith("/rwg")), "another tool's link and the aggregator's survive");
calls.length = 0;
r = await call("DELETE");
ok(r.status === 200 && r.json.status === "not_found" && googleCalls().every((c) => c.method === "GET"), "second DELETE → not_found, nothing deleted");
// The aggregator's link at OUR address is still not ours to delete.
links.push({ name: "locations/456/placeActionLinks/rwg2", uri: URL_OURS, placeActionType: "APPOINTMENT", providerType: "AGGREGATOR_3P", isEditable: false });
calls.length = 0;
r = await call("DELETE");
ok(r.json.status === "not_found" && links.some((l) => l.name.endsWith("/rwg2")), "an uneditable aggregator link at our address is never deleted");
links = links.filter((l) => !l.name.endsWith("/rwg2"));

// ── 8. Google refusals ─────────────────────────────────────────────────────
section("8. Google refusals");
failNextList = { status: 403, body: { error: { code: 403, message: "My Business Place Actions API has not been used in project 123456 before or it is disabled. Enable it by visiting …", status: "PERMISSION_DENIED" } } };
r = await call("POST", {});
ok(r.status === 502 && r.json.kind === "api_disabled" && /project 123456/.test(r.json.error), "API not enabled → 502 api_disabled with Google's words");
failNextList = { status: 429, body: { error: { code: 429, message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" } } };
r = await call("GET");
ok(r.status === 200 && r.json.google.errorKind === "quota" && r.json.google.onGoogle === null, "GET lookup refused → sentence, status unknown (not 'false')");
ok(links.length === 2, "refusals changed nothing on the listing");

// ── 9. No DB write ─────────────────────────────────────────────────────────
section("9. no DB write");
const after = JSON.stringify(await db.companyGoogleBusiness.findUnique({ where: { companyId: company.id } }));
ok(before === after, "connection row unchanged by GET/POST/DELETE (nothing stored, nothing stamped)");

// ── 10. The card ───────────────────────────────────────────────────────────
section("10. the card, every state, every language");
function tFor(code) {
  const dict = APP_MESSAGES[code];
  return (key, a, b) => {
    const values = a && typeof a === "object" ? a : b;
    let s = dict[key] ?? APP_MESSAGES.en[key] ?? `[[${key}]]`;
    for (const [k, v] of Object.entries(values || {})) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}
const en = APP_MESSAGES.en;
const G = (over = {}) => ({ available: false, connected: false, locationTitle: null, canAutomate: false, onGoogle: null, link: null, error: null, ...over });
const render = (props, code = "en") =>
  renderToStaticMarkup(React.createElement(BookButtonCard, { t: tFor(code), copy: "", preferred: false, busy: false, result: null, onRetry() {}, onCopy() {}, onPreferred() {}, onAdd() {}, onRemove() {}, ...props }));
const has = (html, key) => html.includes(en[key].replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/&(?!quot;|#x27;)/g, "&amp;").split("{")[0]);
const ADD = en["app.setBooking.gbp.addForMe"];
const REMOVE = en["app.setBooking.gbp.remove"];

let html = render({ loadFailed: true, state: null });
ok(has(html, "app.setBooking.gbp.loadError") && !html.includes(ADD), "load failed → sentence + retry, no button");
html = render({ state: null });
ok(!html.includes(ADD) && !html.includes("business.google.com"), "loading → skeleton only");
html = render({ state: { bookingLive: false, bookingUrl: null, google: G({ available: true, connected: true, canAutomate: false }) } });
ok(has(html, "app.setBooking.gbp.notLive") && html.includes("/app/settings/availability#bookable"), "not bookable → set-up-first sentence + link to hours");
ok(!html.includes(ADD) && !html.includes("/book/") && !html.includes("business.google.com"), "not bookable → no link, no steps, no button");
html = render({ state: { bookingLive: true, bookingUrl: URL_OURS, google: G() } });
ok(html.includes(URL_OURS) && html.includes("https://business.google.com") && has(html, "app.setBooking.gbp.step2"), "flag off → link, copy, steps, business.google.com");
ok(!html.includes(ADD) && !html.includes(REMOVE) && !has(html, "app.setBooking.gbp.connectFirst"), "flag off → no automation, no connect nudge");
html = render({ state: { bookingLive: true, bookingUrl: URL_OURS, google: G({ available: true }) } });
ok(has(html, "app.setBooking.gbp.connectFirst") && html.includes('href="/app/settings/reviews"') && !html.includes(ADD), "approved, not connected → nudge to Settings › Reviews, no button");
html = render({ state: { bookingLive: true, bookingUrl: URL_OURS, google: G({ available: true, connected: true, canAutomate: true, onGoogle: false, locationTitle: "Main St" }) } });
ok(html.includes(ADD) && html.includes('type="checkbox"') && !html.includes(REMOVE) && html.includes("Main St"), "ready → Add it for me + preferred checkbox + listing");
html = render({ state: { bookingLive: true, bookingUrl: URL_OURS, google: G({ available: true, connected: true, canAutomate: true, onGoogle: true, link: { uri: URL_OURS, isPreferred: true } }) } });
ok(html.includes(REMOVE) && !html.includes(ADD) && has(html, "app.setBooking.gbp.onGooglePreferred"), "on Google → Remove, preferred wording, no Add");
html = render({ state: { bookingLive: true, bookingUrl: URL_OURS, google: G({ available: true, connected: true, canAutomate: true, error: "Google said: nope" }) } });
ok(html.includes("Google said: nope") && html.includes(ADD), "lookup error printed, Add still offered (it answers with the same sentence)");
html = render({ copy: "failed", state: { bookingLive: true, bookingUrl: URL_OURS, google: G() } });
ok(has(html, "app.setBooking.gbp.copyFailed"), "copy failed → says so");
html = render({ copy: "copied", state: { bookingLive: true, bookingUrl: URL_OURS, google: G() } });
ok(html.includes(en["app.action.copied"]), "copied → says so");
html = render({ result: { tone: "ok", text: en["app.setBooking.gbp.already"] }, state: { bookingLive: true, bookingUrl: URL_OURS, google: G({ available: true, connected: true, canAutomate: true, onGoogle: true }) } });
ok(has(html, "app.setBooking.gbp.already"), "already-on-Google result shown");

const gbpKeys = Object.keys(en).filter((k) => k.startsWith("app.setBooking.gbp."));
ok(gbpKeys.length >= 30, `card keys present in English (${gbpKeys.length})`);
const LANGS = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];
for (const code of LANGS) {
  const missing = gbpKeys.filter((k) => !(k in (APP_MESSAGES[code] || {})));
  ok(missing.length === 0, `${code}: every card key translated${missing.length ? ` (missing ${missing.join(", ")})` : ""}`);
  const steps = ["step2", "step3", "step4", "step5"].map((k) => APP_MESSAGES[code][`app.setBooking.gbp.${k}`] || "").join(" ");
  ok(["Booking", "Edit profile", "Add link", "Save", "Set preferred link"].every((l) => steps.includes(l)), `${code}: Google's labels kept in English`);
  for (const state of [
    { bookingLive: false, bookingUrl: null, google: G() },
    { bookingLive: true, bookingUrl: URL_OURS, google: G({ available: true }) },
    { bookingLive: true, bookingUrl: URL_OURS, google: G({ available: true, connected: true, canAutomate: true, onGoogle: false, locationTitle: "X" }) },
    { bookingLive: true, bookingUrl: URL_OURS, google: G({ available: true, connected: true, canAutomate: true, onGoogle: true, link: { isPreferred: false } }) },
  ]) {
    const out = render({ state, copy: "failed" }, code);
    ok(!out.includes("[[app."), `${code}: no unresolved key in a rendered state`);
  }
  for (const k of ["not_approved", "not_connected", "no_location", "not_live", "not_https"]) {
    ok(Boolean(APP_MESSAGES[code][`app.setBooking.gbp.err.${k}`]), `${code}: refusal ${k} worded`);
  }
}

// ── 11. Wiring ─────────────────────────────────────────────────────────────
section("11. wiring");
const page = fs.readFileSync(path.join(ROOT, "app/app/settings/booking-page/page.js"), "utf8");
ok(/import GoogleBookButton from "\.\/GoogleBookButton"/.test(page) && /<GoogleBookButton\s*\/>/.test(page), "Booking Page imports and renders the card");
const card = fs.readFileSync(path.join(ROOT, "app/app/settings/booking-page/GoogleBookButton.js"), "utf8");
ok(card.includes('"/api/reviews/google/book-button"'), "card calls the route that exists");
ok(typeof route.GET === "function" && typeof route.POST === "function" && typeof route.DELETE === "function", "route exports GET, POST, DELETE");
ok(!/uri\s*:/.test(card.slice(card.indexOf("async function addIt"), card.indexOf("async function removeIt"))), "the card never sends a uri");

globalThis.fetch = realFetch;
console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
