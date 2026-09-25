// scripts/check-client-portal.mjs
//
// The client-portal upgrade — plans, visits, the reschedule/skip request, and
// "Client login" on the company's website — executed against hostile input
// rather than read.
//
// What it proves:
//   1. A plan's dates come from the same anchor series the billing engine
//      uses, and a cancelled / finished / malformed plan shows none.
//   2. Nothing leaves lib/portal/view.js that was not named: no authToken, no
//      collection mode, no visit notes, no return-reason code, no full crew
//      name — and a row from ANOTHER company or ANOTHER client is dropped even
//      when the query that fetched it was wrong.
//   3. A change request can't carry a date to move to, can't "skip" a one-off
//      visit, and the key it is filed under is the key the portal reads back.
//   4. "Client login" sends only to the company the site belongs to, sends
//      nothing for a stranger's address, and its email is escaped, measured
//      and never says FieldQuo.
//   5. The route and the site page keep the three promises the feature rests
//      on: one neutral answer, the send after the response, and no /client
//      page or link unless the company switched it on.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-client-portal.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  upcomingPlanDates,
  shapePlanForPortal,
  shapeVisits,
  parseChangeRequest,
  changeRequestPrefix,
  canRequestChange,
  normaliseLoginEmail,
  isoDay,
  firstName,
  HIDDEN_PHOTO_STAGES,
} from "@/lib/portal/view";
import { buildPortalLinkEmail } from "@/lib/portal/loginEmail";
import { sendPortalLinks } from "@/lib/portal/loginLink";
import { CLIENT_DOC_COPY, clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { SITE_COPY } from "@/lib/site/siteCopy";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { documentTheme, fillPair, washPair } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

let failed = 0;
let passed = 0;
function ok(name, cond, detail = "") {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const NOW = new Date("2026-09-24T15:00:00Z");
const basePlan = {
  id: "plan_1",
  name: "Spring & Fall gutters",
  serviceName: "Gutter cleaning",
  status: "active",
  frequency: "semiannual",
  startDate: new Date("2026-04-15T00:00:00Z"),
  endMode: "open",
  occurrenceCount: null,
  endDate: null,
  amountPerOccurrence: "200.00",
  discountPct: "10",
  taxRatePct: "13",
  cancelledAt: null,
  completedAt: null,
  // Fields the portal must never forward:
  authToken: "SECRET-AUTH",
  collectionMode: "automatic",
  createdAt: new Date("2026-04-01T00:00:00Z"),
};

// ── 1. Plan dates ────────────────────────────────────────────────────────
{
  const d = upcomingPlanDates(basePlan, { now: NOW });
  ok("open plan lists 3 dates", d.length === 3, String(d.length));
  ok("semiannual dates follow the anchor", d.map(isoDay).join() === "2026-10-15,2027-04-15,2027-10-15", d.map(isoDay).join());
  ok("cancelled plan lists nothing", upcomingPlanDates({ ...basePlan, status: "cancelled" }, { now: NOW }).length === 0);
  ok("cancelledAt alone lists nothing", upcomingPlanDates({ ...basePlan, cancelledAt: NOW }, { now: NOW }).length === 0);
  ok("malformed frequency lists nothing", upcomingPlanDates({ ...basePlan, frequency: "hourly" }, { now: NOW }).length === 0);
  ok("unparseable start lists nothing", upcomingPlanDates({ ...basePlan, startDate: "not a date" }, { now: NOW }).length === 0);
  const future = upcomingPlanDates({ ...basePlan, startDate: new Date("2027-01-31T00:00:00Z"), frequency: "monthly" }, { now: NOW });
  ok("a plan that hasn't started still shows its dates", future.map(isoDay).join() === "2027-01-31,2027-02-28,2027-03-31", future.map(isoDay).join());
  const count = upcomingPlanDates({ ...basePlan, endMode: "count", occurrenceCount: 2 }, { now: NOW });
  ok("a 2-visit plan shows only the visit it has left", count.map(isoDay).join() === "2026-10-15", count.map(isoDay).join());
  ok("a finished count plan shows nothing", upcomingPlanDates({ ...basePlan, endMode: "count", occurrenceCount: 1 }, { now: NOW }).length === 0);
  ok("an until-plan past its end shows nothing", upcomingPlanDates({ ...basePlan, endMode: "until", endDate: new Date("2026-09-01T00:00:00Z") }, { now: NOW }).length === 0);
  const today = upcomingPlanDates({ ...basePlan, startDate: new Date("2026-09-24T00:00:00Z"), frequency: "weekly" }, { now: NOW });
  ok("today's plan date still counts as upcoming all day", isoDay(today[0]) === "2026-09-24", isoDay(today[0]));
  ok("null plan is empty", upcomingPlanDates(null).length === 0);
}

// ── 2. Plan shape: allow-list and money ──────────────────────────────────
{
  const p = shapePlanForPortal(basePlan, { now: NOW });
  const allowed = new Set(["id", "name", "serviceName", "frequency", "next", "perVisit", "discountPct", "taxIncluded", "endsOn", "visitsSold"]);
  ok("plan shape has only named keys", Object.keys(p).every((k) => allowed.has(k)), Object.keys(p).join());
  ok("plan shape never carries the auth token", !JSON.stringify(p).includes("SECRET-AUTH"));
  // 200 − 10% = 180, + 13% tax = 203.40
  ok("per-visit is what each invoice will say", p.perVisit === 203.4, String(p.perVisit));
  ok("member discount is stated", p.discountPct === 10);
  ok("tax flagged as included", p.taxIncluded === true);
  ok("no-tax plan does not claim tax", shapePlanForPortal({ ...basePlan, taxRatePct: null }, { now: NOW }).taxIncluded === false);
  ok("cancelled plan is not shown", shapePlanForPortal({ ...basePlan, status: "cancelled" }, { now: NOW }) === null);
  ok("completed plan is not shown", shapePlanForPortal({ ...basePlan, completedAt: NOW }, { now: NOW }) === null);
  ok("hostile discount clamps", shapePlanForPortal({ ...basePlan, discountPct: "250" }, { now: NOW }).discountPct === 100);
}

// ── 3. Visits: tenancy, allow-list, split, photos ────────────────────────
{
  const client = { id: "cli_A", companyId: "co_A", type: "individual", address: "12 Elm St", city: "Ottawa", province: "ON", postalCode: "K1A 0A1" };
  const job = { title: "Interior repaint", siteAddress: null, clientId: "cli_A", companyId: "co_A" };
  const H = 3600000;
  const visits = [
    { id: "v_past", scheduledAt: new Date(NOW - 48 * H), status: "completed", returnReason: null, assignedTo: { name: "Dan Kowalski" }, job, notes: "SECRET-NOTE" },
    { id: "v_soon", scheduledAt: new Date(+NOW + 5 * H), status: "scheduled", returnReason: null, assignedTo: { name: "Chris" }, job },
    { id: "v_later", scheduledAt: new Date(+NOW + 72 * H), status: "scheduled", returnReason: "warranty", assignedTo: null, job: { ...job, siteAddress: "99 Site Rd" } },
    { id: "v_cancel", scheduledAt: new Date(+NOW + 96 * H), status: "canceled", job },
    // Another company's visit, as if a where clause had been wrong.
    { id: "v_other_co", scheduledAt: new Date(+NOW + 24 * H), status: "scheduled", job: { ...job, companyId: "co_B" } },
    // Another household at the same company.
    { id: "v_other_cli", scheduledAt: new Date(+NOW + 30 * H), status: "scheduled", job: { ...job, clientId: "cli_Z" } },
  ];
  const appointments = [
    { id: "a_call", clientId: "cli_A", companyId: "co_A", scheduledAt: new Date(+NOW + 100 * H), status: "scheduled", location: "12 Elm St", assignedTo: { name: "Pat Lee" }, job: null, booking: { startTime: new Date(+NOW + 100 * H), endTime: new Date(+NOW + 101 * H), mode: "call", status: "confirmed" } },
    { id: "a_other_co", clientId: "cli_A", companyId: "co_B", scheduledAt: new Date(+NOW + 50 * H), status: "scheduled" },
    { id: "a_cancel_booking", clientId: "cli_A", companyId: "co_A", scheduledAt: new Date(+NOW + 60 * H), status: "scheduled", booking: { status: "cancelled", mode: "visit" } },
  ];
  const photos = [
    { id: "ph1", url: "https://img/1.jpg", jobVisitId: "v_past" },
    { id: "ph_future", url: "https://img/f.jpg", jobVisitId: "v_soon" },
  ];
  const requested = new Set([changeRequestPrefix({ kind: "visit", id: "v_later" })]);
  const out = shapeVisits({ visits, appointments, photos, client, company: { arrivalWindowMinutes: 30 }, requested, now: NOW });
  const all = [...out.upcoming, ...out.past];
  const ids = all.map((v) => v.id);
  ok("another company's visit is dropped", !ids.includes("v_other_co"));
  ok("another household's visit is dropped", !ids.includes("v_other_cli"));
  ok("another company's appointment is dropped", !ids.includes("a_other_co"));
  ok("cancelled visit (either spelling) is dropped", !ids.includes("v_cancel"));
  ok("cancelled booking's appointment is dropped", !ids.includes("a_cancel_booking"));
  ok("next visit is the soonest upcoming", out.next?.id === "v_soon", out.next?.id);
  ok("upcoming in time order", out.upcoming.map((v) => v.id).join() === "v_soon,v_later,a_call", out.upcoming.map((v) => v.id).join());
  ok("past holds the completed visit", out.past.map((v) => v.id).join() === "v_past");
  ok("crew is a first name only", out.past[0].crew === "Dan" && !JSON.stringify(out).includes("Kowalski"));
  ok("visit notes never leave", !JSON.stringify(out).includes("SECRET-NOTE"));
  ok("return reason code never leaves", !JSON.stringify(out).includes("warranty"));
  ok("a return visit is labelled as one", out.upcoming.find((v) => v.id === "v_later").type === "return");
  ok("site address wins over home", out.upcoming.find((v) => v.id === "v_later").address === "99 Site Rd");
  ok("home address when the job has no site", out.next.address === "12 Elm St, Ottawa, ON, K1A 0A1", out.next.address);
  ok("a phone call has no address", out.upcoming.find((v) => v.id === "a_call").address === null);
  ok("a phone call has no invented window", out.upcoming.find((v) => v.id === "a_call").windowStart === null);
  ok("arrival window is ± the company setting", new Date(out.next.windowEnd) - new Date(out.next.windowStart) === 60 * 60000);
  ok("photos only on past visits", out.past[0].photos.length === 1 && out.next.photos.length === 0);
  ok("inside 24h cannot be asked about by message", out.next.canRequest === false);
  ok("3 days out can be asked about", out.upcoming.find((v) => v.id === "v_later").canRequest === true);
  ok("an open request is marked", out.upcoming.find((v) => v.id === "v_later").requested === true);
  const allowed = new Set(["kind", "id", "at", "windowStart", "windowEnd", "type", "title", "crew", "address", "photos", "requested", "canRequest"]);
  ok("visit items carry only named keys", all.every((v) => Object.keys(v).every((k) => allowed.has(k))), all.map((v) => Object.keys(v).join("|"))[0]);
  const companyClient = shapeVisits({ visits: [visits[1]], client: { ...client, type: "company" }, now: NOW });
  ok("a company client's office is never offered as a visit address", companyClient.next.address === null);
  ok("no client → nothing", shapeVisits({ visits, now: NOW }).upcoming.length === 0);
  ok("issue photos are the stage kept off the page", HIDDEN_PHOTO_STAGES.includes("issue") && !HIDDEN_PHOTO_STAGES.includes("after"));
  ok("first name of nothing is null", firstName("   ") === null);
}

// ── 4. Change requests ───────────────────────────────────────────────────
{
  ok("reschedule a visit parses", parseChangeRequest({ kind: "visit", id: "v_1", action: "reschedule" }).ok);
  ok("skipping a one-off visit is refused", !parseChangeRequest({ kind: "visit", id: "v_1", action: "skip" }).ok);
  ok("skip a plan date parses", parseChangeRequest({ kind: "plan", id: "p_1", action: "skip", occurrence: "2026-10-15" }).ok);
  ok("plan without a date is refused", !parseChangeRequest({ kind: "plan", id: "p_1", action: "skip" }).ok);
  ok("plan with a junk date is refused", !parseChangeRequest({ kind: "plan", id: "p_1", action: "skip", occurrence: "next tuesday" }).ok);
  ok("unknown kind refused", !parseChangeRequest({ kind: "invoice", id: "x", action: "reschedule" }).ok);
  ok("injection-shaped id refused", !parseChangeRequest({ kind: "visit", id: "v_1' OR 1=1", action: "reschedule" }).ok);
  const parsed = parseChangeRequest({ kind: "visit", id: "v_1", action: "reschedule", newDate: "2026-12-25", companyId: "co_B", message: "  Tuesday?\u0000\u0007 ".padEnd(3000, "x") });
  ok("a date to move to is never taken from the browser", !("newDate" in parsed.value) && !("companyId" in parsed.value));
  ok("message is capped and control-stripped", parsed.value.message.length === 1000 && !/[\u0000\u0007]/.test(parsed.value.message));
  const prefix = changeRequestPrefix({ kind: "plan", id: "p_1", occurrence: "2026-10-15" });
  const stored = `${prefix}${Date.now()}`;
  ok("the key the portal reads back is the key filed", stored.replace(/\d+$/, "") === prefix);
  ok("plan prefix needs a real date", changeRequestPrefix({ kind: "plan", id: "p_1", occurrence: "x" }) === null);
  ok("unparseable time cannot be requested", canRequestChange("garbage", { now: NOW }) === false);
}

// ── 5. Login email address ───────────────────────────────────────────────
{
  ok("email trimmed and lowered", normaliseLoginEmail("  Libby@Example.COM ") === "libby@example.com");
  for (const bad of ["", "no-at-sign", "a@b", "<script>@x.com", "a b@c.com", "x".repeat(300) + "@a.com", null, { toString: () => "a@b.co" }.toString === 1]) {
    ok(`hostile email refused: ${String(bad).slice(0, 20)}`, normaliseLoginEmail(bad) === null);
  }
}

// ── 6. The email: escaped, measured, white-label, every language ─────────
{
  const hostileBrands = ["#ffff00", "#ffffff", "#808080", "#000000", "#39ff14", "not-a-colour"];
  for (const brandColor of hostileBrands) {
    const theme = documentTheme({ brandColor });
    const fill = fillPair(theme);
    ok(`email button measures 4.5:1 on ${brandColor}`, contrastRatio(fill.fg, fill.bg) >= 4.5, contrastRatio(fill.fg, fill.bg).toFixed(2));
    const wash = washPair(theme);
    ok(`next-visit panel ink 4.5:1 on ${brandColor}`, contrastRatio(wash.ink, wash.bg) >= 4.5 && contrastRatio(wash.muted, wash.bg) >= 4.5 && contrastRatio(wash.accent, wash.bg) >= 4.5);
    ok(`plan kicker 4.5:1 on white for ${brandColor}`, contrastRatio(theme.accentText, "#ffffff") >= 4.5);
  }
  // #2d2520 at 72% over white — the muted text PlansAndVisits uses.
  const mix = (a, alpha) => {
    const n = parseInt(a.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c * alpha + 255 * (1 - alpha)));
    return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  };
  ok("portal muted text measures 4.5:1", contrastRatio(mix("#2d2520", 0.72), "#ffffff") >= 4.5, contrastRatio(mix("#2d2520", 0.72), "#ffffff").toFixed(2));
  ok("portal muted text on the request panel measures 4.5:1", contrastRatio(mix("#2d2520", 0.72), "#faf8f5") >= 4.5);

  const company = { name: `Bob's <b>Paint</b> & "Co"`, brandColor: "#ffff00", email: "office@bob.example", phone: "555-0100" };
  const client = { name: "<img src=x onerror=alert(1)> Libby" };
  const e = buildPortalLinkEmail({ company, client, url: "https://bob.fieldquo.com/portal/abc?x=1&y=\"2\"", language: "en" });
  ok("company name escaped in the email", !e.html.includes("<b>Paint</b>") && e.html.includes("&lt;b&gt;Paint&lt;/b&gt;"));
  ok("client name escaped in the email", !e.html.includes("<img src=x"));
  ok("link attribute escaped", !e.html.includes('y="2"'));
  ok("the email never says FieldQuo", !/fieldquo/i.test(e.html.replace(/https:\/\/bob\.fieldquo\.com[^"]*/g, "")) && !/fieldquo/i.test(e.subject));
  ok("login email says 'ignore if you didn't ask'", e.text.includes(clientDocCopy("en").portal.loginEmailIgnore));
  const office = buildPortalLinkEmail({ company, client, url: "https://x/portal/t", language: "en", requested: false });
  ok("office-sent email does not tell them to ignore it", !office.text.includes(clientDocCopy("en").portal.loginEmailIgnore));
  for (const code of Object.keys(CLIENT_DOC_COPY)) {
    const m = buildPortalLinkEmail({ company: { name: "Acme" }, client: { name: "Ana" }, url: "https://x/portal/t", language: code });
    ok(`email builds in ${code}`, m.subject.includes("Acme") && m.html.includes("https://x/portal/t") && !m.html.includes("undefined"));
    const c = CLIENT_DOC_COPY[code].portal;
    ok(`${code} names every plan cadence`, ["weekly", "monthly", "quarterly", "semiannual", "annual"].every((f) => c.frequency[f]));
  }
  for (const code of Object.keys(SITE_COPY)) {
    ok(`site copy ${code} has Client login`, Boolean(SITE_COPY[code].clientLogin && SITE_COPY[code].clientLoginSent));
  }
  const appKeys = ["app.portalRequest.rescheduleTitle", "app.portalRequest.skipTitle", "app.portalRequest.desc", "app.setWebsite.clientPortal.title", "app.clientDetail.portal.copy", "app.clientDetail.portal.send"];
  for (const code of Object.keys(APP_MESSAGES)) {
    ok(`app messages ${code} carry the portal keys`, appKeys.every((k) => typeof APP_MESSAGES[code][k] === "string"));
  }
  // The neutral login sentence may not hint at a result.
  ok("neutral sentence does not claim a match", !/found|we have|your account exists/i.test(SITE_COPY.en.clientLoginSent));
}

// ── 7. Sending: one company only, nothing for a stranger ─────────────────
{
  const sends = [];
  const send = async (m) => {
    sends.push(m);
    return { id: "sent" };
  };
  const resolveSender = async (company) => ({ from: `${company.name} <quotes@x>`, replyTo: company.email });
  const rows = {
    co_A: [{ id: "c1", name: "Libby Angelos", email: "Libby@example.com", language: "fr", companyId: "co_A" }],
    co_B: [{ id: "c9", name: "Libby Angelos", email: "libby@example.com", language: "en", companyId: "co_B" }],
  };
  let lastWhere = null;
  const tokens = {};
  const stubDb = (leak = false) => ({
    client: {
      findMany: async ({ where }) => {
        lastWhere = where;
        // `leak` simulates a broken where that returns every company's rows.
        return leak ? [...rows.co_A, ...rows.co_B] : rows[where.companyId] || [];
      },
      findFirst: async ({ where }) => {
        const all = [...rows.co_A, ...rows.co_B];
        const c = all.find((r) => r.id === where.id && (!where.companyId || r.companyId === where.companyId));
        return c ? { id: c.id, portalToken: tokens[c.id] || null } : null;
      },
      update: async ({ where, data }) => {
        tokens[where.id] = data.portalToken;
        return {};
      },
    },
    company: { findUnique: async ({ where }) => ({ id: where.id, name: where.id === "co_A" ? "Alpha Painting" : "Beta Roofing", email: "o@x", brandColor: "#123456" }) },
  });

  const r1 = await sendPortalLinks({ companyId: "co_A", email: "libby@example.com", origin: "https://alpha.fieldquo.com", db: stubDb(), send, resolveSender });
  ok("the lookup is scoped to the site's company", lastWhere?.companyId === "co_A" && lastWhere?.email?.mode === "insensitive");
  ok("a client of the site's company gets one link", r1.sent === 1 && sends.length === 1);
  ok("the link is on the company's own host", sends[0].html.includes("https://alpha.fieldquo.com/portal/") && sends[0].text.includes("https://alpha.fieldquo.com/portal/"));
  ok("it goes to the address on file", sends[0].to === "Libby@example.com");
  ok("in the client's language", sends[0].subject === clientDocCopy("fr").portal.loginEmailSubject("Alpha Painting"));
  ok("from the company", sends[0].from.startsWith("Alpha Painting") && !/Beta/.test(sends[0].html));

  sends.length = 0;
  const r2 = await sendPortalLinks({ companyId: "co_A", email: "libby@example.com", origin: "https://alpha.fieldquo.com", db: stubDb(true), send, resolveSender });
  ok("a leaking query still sends only the site's company's link", r2.sent === 1 && sends.every((m) => !/Beta Roofing/.test(m.html) && m.from.startsWith("Alpha")));
  ok("the other company's client token was never minted", !tokens.c9);
  ok("the other company's row is dropped before any token is looked at", r2.matched === 1 && r2.failed === 0, JSON.stringify(r2));

  sends.length = 0;
  const r3 = await sendPortalLinks({ companyId: "co_C", email: "libby@example.com", origin: "https://gamma.fieldquo.com", db: stubDb(), send, resolveSender });
  ok("an address that exists only at another company sends nothing", r3.sent === 0 && sends.length === 0);
  const r4 = await sendPortalLinks({ companyId: "", email: "libby@example.com", origin: "x", db: stubDb(), send, resolveSender });
  ok("no company, no lookup", r4.matched === 0 && sends.length === 0);
}

// ── 8. The promises in the route and the site page ───────────────────────
{
  const route = read("app/api/portal-login/route.js");
  ok("login route answers with one neutral body", (route.match(/NextResponse\.json\(NEUTRAL\)/g) || []).length === 2);
  ok("login route sends after the response", /after\(async \(\) =>[\s\S]*sendPortalLinks/.test(route));
  ok("login route requires the switch AND a published site", /!site\.published \|\| !site\.clientPortalEnabled/.test(route));
  ok("login route is rate-limited per connection and per address", /rateLimit\(request, "portal-login"/.test(route) && /hit\(`portal-login-email:\$\{site\.companyId\}/.test(route));
  ok("login route never takes a company id from the body", !/body\??\.companyId/.test(route));
  ok("login link host is compared, not trusted", /host === real/.test(route));

  const page = read("app/site/[subdomain]/page.js");
  ok("/client exists only while the switch is on", /pageSlugParam === CLIENT_LOGIN_SLUG && Boolean\(site\.clientPortalEnabled\)/.test(page));
  ok("no Client login link unless the switch is on", /const clientLoginHref = site\.clientPortalEnabled\s*\?/.test(page));
  const blocks = read("app/site/[subdomain]/SiteBlocks.js");
  ok("header, menu and footer all gate on the href", (blocks.match(/\{clientLoginHref && \(/g) || []).length === 3);

  const portalRoute = read("app/api/portal/[token]/route.js");
  ok("portal plans are scoped by client and company", /const scope = \{ clientId: client\.id, companyId: client\.companyId \}/.test(portalRoute));
  ok("portal visits are scoped through the job", /job: \{ \.\.\.scope, archivedAt: null \}/.test(portalRoute));
  ok("portal photos exclude issue, incident evidence and hidden steps", /stage: \{ notIn: HIDDEN_PHOTO_STAGES \}/.test(portalRoute) && /safetyIncidentId: null/.test(portalRoute) && /task: \{ clientVisible: true \}/.test(portalRoute));
  ok("arrival-window setting is stripped from the company payload", /arrivalWindowMinutes: _arrivalWindowMinutes/.test(portalRoute));

  const change = read("lib/portal/changeRequest.js");
  ok("change requests re-find every target under client AND company", (change.match(/companyId: client\.companyId/g) || []).length >= 4);
  ok("change requests never update a visit, appointment or plan", !/(jobVisit|appointment|servicePlan)\.(update|delete)/.test(change));
}

console.log(`check-client-portal: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
