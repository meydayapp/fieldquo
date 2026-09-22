// scripts/check-callback-rotation.mjs
//
//   npm run check:callback-rotation
//
// Executes the past-client callback rule against a hostile client book:
// the filters (months since the last job, minimum ticket, area by postcode,
// city or polygon), the exclusions (do-not-contact never, recently listed,
// call-back dates, not-interested), the weekly cap and order, the
// once-per-week build, the outcome validation, and the wiring that makes
// "do not call" reach the voice agent's consent ledger.

import { readFileSync } from "node:fs";
import { normaliseRule, isDue, weekOfKey, ymdInZone, pointInPolygon, inArea, selectCandidates, AREA_KINDS } from "../lib/callbacks/rules.js";
import { normaliseOutcome, OUTCOMES } from "../lib/callbacks/outcomes.js";
import { listScope } from "../lib/callbacks/scope.js";

let failures = 0;
let passes = 0;
function ok(name, cond, detail = "") {
  if (cond) {
    passes++;
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}`);
const NOW = new Date("2026-09-21T12:00:00Z"); // a Monday
const monthsAgo = (n) => new Date(NOW.getTime() - n * 30.4375 * 86400000).toISOString();

// ── 1. The rule ───────────────────────────────────────────────────────────
section("1. The rule normalises");
{
  const r = normaliseRule({ weekday: 1, monthsSinceJob: 10, minTicket: "1500", areaKind: "city", areaValue: "  Kanata ", weeklyCap: 8, assigneeMemberId: "m1" });
  ok("the mockup's sentence stores as given", r.weekday === 1 && r.monthsSinceJob === 10 && r.minTicket === 1500 && r.areaKind === "city" && r.areaValue === "Kanata" && r.weeklyCap === 8 && r.assigneeMemberId === "m1" && r.enabled);
  const junk = normaliseRule({ weekday: 9, monthsSinceJob: -3, minTicket: "lots", areaKind: "planet", areaValue: "Mars", weeklyCap: 0, assigneeMemberId: 42 });
  ok("junk falls back to the defaults, an unknown area kind to anywhere", junk.weekday === 1 && junk.monthsSinceJob === 10 && junk.minTicket === 0 && junk.areaKind === null && junk.areaValue === null && junk.weeklyCap === 8 && junk.assigneeMemberId === null);
  ok("an area kind with no value is anywhere", normaliseRule({ areaKind: "postcode", areaValue: "" }).areaKind === null);
  ok("AREA_KINDS are the three the sentence offers", AREA_KINDS.join() === "postcode,city,work_area");
}

// ── 2. Once a week ────────────────────────────────────────────────────────
section("2. Due on the weekday, once per week");
{
  const rule = normaliseRule({ weekday: 1 });
  ok("ymdInZone: a Monday noon UTC is Monday in Toronto", ymdInZone(NOW, "America/Toronto").weekday === 1);
  ok("weekOfKey is the Monday", weekOfKey(NOW, "America/Toronto") === "2026-09-21" && weekOfKey(new Date("2026-09-27T12:00:00Z"), "America/Toronto") === "2026-09-21");
  ok("due on its weekday with no list yet", isDue(rule, NOW, "America/Toronto", []).due === true);
  ok("not due on another weekday", isDue(rule, new Date("2026-09-22T12:00:00Z"), "America/Toronto", []).reason === "not_the_day");
  ok("not due twice in one week", isDue(rule, NOW, "America/Toronto", ["2026-09-21"]).reason === "already_built");
  ok("a disabled rule is never due", isDue(normaliseRule({ enabled: false }), NOW, "America/Toronto", []).reason === "disabled");
  ok("the weekday is the company's: 02:00Z Tuesday is still Monday in Toronto", isDue(rule, new Date("2026-09-22T02:00:00Z"), "America/Toronto", []).due === true);
  ok("…and is Tuesday in Berlin", isDue(rule, new Date("2026-09-22T02:00:00Z"), "Europe/Berlin", []).due === false);
}

// ── 3. Selection ──────────────────────────────────────────────────────────
section("3. Who is picked, who never is");
{
  const rule = normaliseRule({ monthsSinceJob: 10, minTicket: 1500, areaKind: "city", areaValue: "Kanata", weeklyCap: 3 });
  const c = (id, over = {}) => ({
    client: { id, name: id, phone: "+16135550100", city: "Kanata", postalCode: "K2K 1A1", doNotContactAt: null, ...(over.client || {}) },
    lastJob: over.lastJob === null ? null : { completedAt: monthsAgo(14), title: "Repaint", siteCity: "Kanata", sitePostalCode: "K2K 2B2", ...(over.lastJob || {}) },
    lastTicket: "lastTicket" in over ? over.lastTicket : 3900,
    history: over.history || [],
  });
  const candidates = [
    c("rita"),
    c("dnc", { client: { doNotContactAt: "2026-01-01T00:00:00Z" } }),
    c("nophone", { client: { phone: null } }),
    c("recent", { lastJob: { completedAt: monthsAgo(4) } }),
    c("small", { lastTicket: 900 }),
    c("noticket", { lastTicket: null }),
    c("elsewhere", { lastJob: { siteCity: "Nepean" }, client: { city: "Nepean" } }),
    c("nojob", { lastJob: null }),
    c("listed", { history: [{ listedAt: monthsAgo(2), outcome: null }] }),
    c("callback_future", { history: [{ listedAt: monthsAgo(12), outcome: "call_back", callBackOn: "2026-10-05" }] }),
    c("callback_past", { history: [{ listedAt: monthsAgo(12), outcome: "call_back", callBackOn: "2026-09-01" }], lastTicket: 2650 }),
    c("notinterested", { history: [{ listedAt: monthsAgo(12), outcome: "not_interested", outcomeAt: monthsAgo(5) }] }),
    c("notinterested_old", { history: [{ listedAt: monthsAgo(20), outcome: "not_interested", outcomeAt: monthsAgo(18) }], lastTicket: 1820 }),
    c("dnc_history", { history: [{ listedAt: monthsAgo(20), outcome: "do_not_contact", outcomeAt: monthsAgo(18) }] }),
    c("big", { lastTicket: 5600 }),
    c("big2", { lastTicket: 4200 }),
    null, {}, { client: null },
  ];
  const { picked, excluded } = selectCandidates({ rule, now: NOW, candidates });
  const reason = (id) => excluded.find((e) => e.clientId === id)?.reason;
  ok("do-not-contact is excluded — whatever else is true", reason("dnc") === "do_not_contact" && reason("dnc_history") === "do_not_contact");
  ok("no phone, a recent job, a small ticket, no ticket, another city, no job at all — all excluded with a reason", reason("nophone") === "no_phone" && reason("recent") === "recent_job" && reason("small") === "ticket_too_small" && reason("noticket") === "ticket_too_small" && reason("elsewhere") === "outside_area" && reason("nojob") === "no_job");
  ok("listed within the dormancy window → not again; a future call-back date → wait; not-interested this year → no", reason("listed") === "recently_listed" && reason("callback_future") === "call_back_later" && reason("notinterested") === "not_interested");
  ok("a past call-back date and an old not-interested come round again", !excluded.some((e) => e.clientId === "callback_past") && !excluded.some((e) => e.clientId === "notinterested_old"));
  ok("biggest ticket first, capped at the rule's weekly number", picked.map((p) => p.client.id).join() === "big,big2,rita" && picked.length === 3);
  ok("the cap is honoured with five eligible: three picked, two left for a later week (not marked excluded)", picked.length === rule.weeklyCap && excluded.length === 11 && !excluded.some((e) => e.clientId === "callback_past" || e.clientId === "notinterested_old"));

  const anywhere = normaliseRule({ monthsSinceJob: 10, minTicket: 0, weeklyCap: 50 });
  const all = selectCandidates({ rule: anywhere, now: NOW, candidates });
  ok("no area and no minimum: the other-city client and the small ticket are in; the exclusions still hold", all.picked.some((p) => p.client.id === "elsewhere") && all.picked.some((p) => p.client.id === "small") && !all.picked.some((p) => p.client.id === "dnc") && !all.picked.some((p) => p.client.id === "nophone"));

  const postcode = normaliseRule({ areaKind: "postcode", areaValue: "k2k" });
  ok("postcode prefix matches case- and space-insensitively on the site postcode, falling back to the client's", inArea(postcode, c("x")) && !inArea(postcode, c("y", { lastJob: { sitePostalCode: "K1A 0B1" }, client: { postalCode: "K1A 0B1" } })) && inArea(postcode, c("z", { lastJob: { sitePostalCode: null }, client: { postalCode: "K2K9Z9" } })));
  const poly = [{ lat: 45.30, lng: -75.95 }, { lat: 45.30, lng: -75.85 }, { lat: 45.36, lng: -75.85 }, { lat: 45.36, lng: -75.95 }];
  ok("pointInPolygon: inside, outside, degenerate", pointInPolygon({ lat: 45.33, lng: -75.90 }, poly) && !pointInPolygon({ lat: 45.40, lng: -75.90 }, poly) && !pointInPolygon({ lat: 45.33, lng: -75.90 }, poly.slice(0, 2)) && !pointInPolygon({ lat: "x", lng: -75.9 }, poly) && !pointInPolygon(null, poly));
  const area = normaliseRule({ areaKind: "work_area", areaValue: "wa1" });
  ok("work area: the last job's coordinates decide; no coordinates → outside", inArea(area, c("in", { lastJob: { siteLatitude: 45.33, siteLongitude: -75.9 } }), poly) && !inArea(area, c("out", { lastJob: { latitude: 45.5, longitude: -75.9 } }), poly) && !inArea(area, c("nocoords"), poly));
}

// ── 4. Outcomes ───────────────────────────────────────────────────────────
section("4. Outcomes");
{
  ok("the six outcomes", OUTCOMES.join() === "booked,call_back,not_now,not_interested,wrong_number,do_not_contact");
  ok("call_back needs a real date", normaliseOutcome({ outcome: "call_back" }).error && normaliseOutcome({ outcome: "call_back", callBackOn: "2026-02-31" }).error && normaliseOutcome({ outcome: "call_back", callBackOn: "2026-10-05" }).callBackOn.toISOString().startsWith("2026-10-05"));
  ok("an unknown outcome is refused; a note is trimmed and capped", normaliseOutcome({ outcome: "ghosted" }).error && normaliseOutcome({ outcome: "not_now", note: " x".repeat(600) }).note.length === 500);
  ok("listScope: owner/admin see the company, anyone else only their assigned rules", JSON.stringify(listScope({ role: "owner", companyId: "c", id: "m" })) === JSON.stringify({ companyId: "c" }) && JSON.stringify(listScope({ role: "employee", companyId: "c", id: "m" })) === JSON.stringify({ companyId: "c", rule: { assigneeMemberId: "m" } }));
}

// ── 5. Wiring ─────────────────────────────────────────────────────────────
section("5. Wiring");
{
  const outcomeRoute = readFileSync(new URL("../app/api/callbacks/entries/[id]/route.js", import.meta.url), "utf8");
  ok("do_not_contact marks the client AND opts the number out of the voice ledger", outcomeRoute.includes("doNotContactAt: new Date()") && outcomeRoute.includes("optOut({ companyId: member.companyId, phone: entry.client.phone"));
  ok("every outcome lands on the client's timeline", outcomeRoute.includes('entityType: "client"'));
  const build = readFileSync(new URL("../lib/callbacks/build.js", import.meta.url), "utf8");
  ok("the builder reads the client's doNotContactAt and the company's own rows only", build.includes("doNotContactAt: true") && build.includes("where: { companyId }") && !build.includes("findMany({\n      where: {}"));
  ok("the builder treats the (ruleId, weekOf) unique as the once-per-week lock", build.includes('err?.code === "P2002"') && build.includes('reason: "already_built"'));
  const cron = readFileSync(new URL("../app/api/cron/follow-ups/route.js", import.meta.url), "utf8");
  ok("the follow-ups cron runs the rotation, best-effort", cron.includes("runCallbackRotation({ now: new Date() })") && cron.includes("callback rotation failed"));
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  ok("CallbackList is unique per rule and week; CallbackRule has no AI assignee column", schema.includes("@@unique([ruleId, weekOf])") && !/model CallbackRule \{[\s\S]*?assignAi|aiAssignee[\s\S]*?\n\}/.test(schema));
  const settingsPage = readFileSync(new URL("../app/app/settings/follow-ups/past-clients/page.js", import.meta.url), "utf8");
  ok("the settings page offers people only and says why there is no AI option", settingsPage.includes("data.members.map") && settingsPage.includes('t("app.callbacks.noAiNote")'));
  const client = readFileSync(new URL("../app/app/clients/[id]/page.js", import.meta.url), "utf8");
  ok("Client.doNotContactAt is read on the client page", client.includes("client.doNotContactAt"));
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
