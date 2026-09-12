// scripts/check-sales-checkin-materialise.mjs
//
//   npm run check:sales-checkin-materialise
//
// The check-in backlog: every company a rep signed up gets its day-1, day-7
// and milestone drafts written down, thread or no thread — and nothing gets
// sent.
//
// ══ The gap, measured ═════════════════════════════════════════════════════
//
// 2026-09-12, production: Easy Roofers Inc. — one rep's one signup, attributed
// through the link, activation earned — had no SalesCheckIn row and no lead
// pointing at it. The engine (lib/sales/checkin/signals.js) had been proven
// correct against thirty branches and produced a draft for nobody, because
// the only caller walked from a texts THREAD to a company, and a company that
// signed up straight from the link has no thread. The owner: "shouldn't it be
// somewhere so that I can see it in the demo".
//
// ══ What is executed, not read ════════════════════════════════════════════
//
//   §1  the planner (lib/sales/checkin/plan.js) on fixtures: day 0, 1, 2, 7,
//       8, 59, 61, a cancelled subscription, a missing snapshot, an existing
//       row in each status, an untouched earlier draft, no number
//   §2  the materialiser (lib/sales/checkin/materialise.js) against an
//       in-memory client: creates once, links a lead once, refreshes a stale
//       draft, repairs a numberless one, never writes a message row, never
//       writes for a demo company on the real path, dry-runs nothing
//   §3  the demo fixture: written once, marked in three places, never for a
//       non-demo, never with an attribution
//   §4  the cron: refuses without the secret; imports only the materialiser
//   §5  the screens: the companies route and the texts list carry it
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Five breaks made on disk in turn, each confirmed to fail here, each
// restored from a `cp` backup: the dedupe key made per-day instead of
// per-touchpoint (§2 second run created again); the demo path's isDemo
// re-read removed (§3 wrote for a non-demo); the `isDemo: false` narrowing
// dropped from the company query (§2 wrote for a demo); the number resolver
// returning the owner's phone before the company's (§1); and the lead's
// convertedCompanyId left off the insert (§2 lead not linked).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { register } from "node:module";

delete process.env.OPENAI_API_KEY;

import {
  planCheckIn,
  resolveCompanyNumber,
  scheduledDedupeKey,
  touchpointOf,
  touchpointOfKey,
  nextTouchpoint,
  checkInSummary,
  engineDedupeKey,
  PLAN_STATES,
  TOUCHPOINT_RETENTION,
} from "@/lib/sales/checkin/plan";
import {
  materialiseCheckInsForRep,
  materialiseDemoCheckIn,
  materialiseCheckInsForAllReps,
  companyTimeZone,
  MATERIALISE_WRITES,
  MATERIALISE_COMPANY_SELECT,
  DEMO_CHECKIN_E164,
  DEMO_ORIGIN,
} from "@/lib/sales/checkin/materialise";
import { SCHEDULED_CHECKIN_DAYS, RETENTION_NEAR_DAYS, checkInSignals } from "@/lib/sales/checkin/signals";
import { REP_COMPANY_SELECT } from "@/lib/sales/scope";
import { SALES_SMS_WINDOW } from "@/lib/sales/smsWindow";
import { localTimeIn } from "@/lib/sales/callingWindow";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass += 1;
    console.log(`  ok  ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${got !== undefined ? "  " + JSON.stringify(got) : ""}`);
  }
}
const section = (t) => console.log(`\n${t}`);

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-12T14:00:00.000Z"); // 10:00 in Toronto
const RETENTION = 60;

const company = (over = {}) => ({
  id: "co_easy",
  name: "Easy Roofers Inc.",
  signedUpAt: new Date(NOW.getTime() - 1 * DAY),
  isDemo: false,
  chargesEnabled: true,
  onboardingCompletedAt: null,
  subscriptionStatus: "active",
  ...over,
});
const atDay = (n, over = {}) => company({ signedUpAt: new Date(NOW.getTime() - n * DAY), ...over });
const setupDone = [{ key: "a", title: "A", done: true }, { key: "b", title: "B", done: true }];

// ═══════════════════════════════════════════════════════════════════════════
section("1. The planner, on fixtures");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("the plan states are a closed set", PLAN_STATES.join() === "due,refresh,open,settled,not_due,suppressed,no_signal", PLAN_STATES);
  const args = { retentionDays: RETENTION, timeZone: "America/Toronto", now: NOW, setup: setupDone };

  const d0 = planCheckIn({ ...args, company: atDay(0) });
  ok("day 0 → suppressed, too soon", d0.state === "suppressed" && d0.code === "too_soon", d0.state);
  ok("…and says day 1 is the next touchpoint", d0.upcoming?.touchpoint === 1, d0.upcoming);
  ok("…timed at the window's opening in their zone", d0.upcoming?.timed === true && localTimeIn("America/Toronto", d0.upcoming.at).minute >= SALES_SMS_WINDOW.startMinute, d0.upcoming);

  const d1 = planCheckIn({ ...args, company: atDay(1) });
  ok("day 1 → due, touchpoint 1", d1.state === "due" && d1.touchpoint === 1, d1);
  ok("…keyed scheduled:<company>:1", d1.dedupeKey === "scheduled:co_easy:1", d1.dedupeKey);
  ok("…aimed at now, because now is inside the window", d1.scheduledFor?.getTime() === NOW.getTime(), d1.scheduledFor);
  ok("…and day 7 is upcoming", d1.upcoming?.touchpoint === 7, d1.upcoming);
  ok("…with the engine's own reason on it (onboarding unfinished)", d1.decision.primary?.code === "onboarding_unfinished", d1.decision.primary);

  const d2 = planCheckIn({ ...args, company: atDay(2) });
  ok("day 2, nothing sent → still the day-1 touchpoint", d2.state === "due" && d2.touchpoint === 1, d2.touchpoint);

  const d7 = planCheckIn({ ...args, company: atDay(7) });
  ok("day 7 → due, touchpoint 7", d7.state === "due" && d7.touchpoint === 7, d7.touchpoint);
  const d8 = planCheckIn({ ...args, company: atDay(8) });
  ok("day 8, nothing sent → the LATEST touchpoint, 7, not 1", d8.state === "due" && d8.touchpoint === 7, d8.touchpoint);
  ok("…and the milestone approach is upcoming", d8.upcoming?.touchpoint === TOUCHPOINT_RETENTION, d8.upcoming);

  const d30 = planCheckIn({ ...args, company: atDay(30) });
  ok("day 30, nothing wrong → not due (past the grace, before the milestone)", d30.state === "not_due" || d30.state === "no_signal", d30.state);
  const d30bad = planCheckIn({ ...args, company: atDay(30, { subscriptionStatus: "past_due" }) });
  ok("day 30, card failing → the engine says due but it is not a touchpoint: not the backlog's to write",
    d30bad.decision.due === true && d30bad.state === "not_due" && touchpointOf(d30bad.decision) === null, d30bad.state);

  const d59 = planCheckIn({ ...args, company: atDay(59) });
  ok("day 59 → due for the milestone approach", d59.state === "due" && d59.touchpoint === TOUCHPOINT_RETENTION, d59);
  ok("…keyed scheduled:<company>:retention", d59.dedupeKey === "scheduled:co_easy:retention");
  const d50 = planCheckIn({ ...args, company: atDay(50, { chargesEnabled: false }) });
  ok("day 50 with payouts unconnected → still the retention touchpoint, wording led by payouts",
    d50.touchpoint === TOUCHPOINT_RETENTION && d50.decision.primary?.code === "payments_not_connected", d50.decision.primary);

  const d61 = planCheckIn({ ...args, company: atDay(61) });
  ok("day 61 → suppressed, milestone passed", d61.state === "suppressed" && d61.code === "milestone_passed", d61);
  ok("…with nothing upcoming", d61.upcoming === null, d61.upcoming);

  const cancelled = planCheckIn({ ...args, company: atDay(1, { subscriptionStatus: "canceled" }) });
  ok("a cancelled subscription → suppressed", cancelled.state === "suppressed" && cancelled.code === "subscription_ended");
  const demo = planCheckIn({ ...args, company: atDay(1, { isDemo: true }) });
  ok("a demo → suppressed as demo_company", demo.state === "suppressed" && demo.code === "demo_company");
  const noDate = planCheckIn({ ...args, company: atDay(1, { signedUpAt: null }) });
  ok("no signup date → suppressed, and no upcoming invented", noDate.state === "suppressed" && noDate.upcoming === null);

  const blind = planCheckIn({ ...args, setup: null, company: atDay(1, { onboardingCompletedAt: NOW }) });
  ok("a missing snapshot → still due on day 1, wording from unknown_state", blind.state === "due" && blind.decision.primary?.code === "unknown_state", blind.decision.primary);

  // Existing rows.
  const openRow = { id: "ck1", dedupeKey: "scheduled:co_easy:1", status: "draft", draftSource: "rule", sendingStartedAt: null, toE164: "+18192387263" };
  ok("day 1 with its row open → open", planCheckIn({ ...args, company: atDay(1), existing: [openRow] }).state === "open");
  ok("day 1 with its row sent → settled", planCheckIn({ ...args, company: atDay(1), existing: [{ ...openRow, status: "sent", sentAt: NOW }] }).state === "settled");
  ok("day 1 with its row dismissed → settled (not today means not this touchpoint)",
    planCheckIn({ ...args, company: atDay(1), existing: [{ ...openRow, status: "dismissed" }] }).state === "settled");
  const sentYesterday = planCheckIn({ ...args, company: atDay(2), lastCheckInAt: new Date(NOW.getTime() - 1 * DAY), existing: [{ ...openRow, status: "sent" }] });
  ok("day 2, day-1 text sent yesterday → suppressed as recently checked in", sentYesterday.state === "suppressed" && sentYesterday.code === "recently_checked_in", sentYesterday);

  const stale = planCheckIn({ ...args, company: atDay(7), existing: [openRow] });
  ok("day 7 with an untouched day-1 draft still open → refresh, not a second draft", stale.state === "refresh" && stale.touchpoint === 7 && stale.row?.id === "ck1", stale.state);
  const edited = planCheckIn({ ...args, company: atDay(7), existing: [{ ...openRow, draftSource: "rep" }] });
  ok("…but a draft the rep edited is left open as it is", edited.state === "open", edited.state);
  const midSend = planCheckIn({ ...args, company: atDay(7), existing: [{ ...openRow, sendingStartedAt: NOW }] });
  ok("…and one mid-send is left alone", midSend.state === "open", midSend.state);
  const manual = planCheckIn({ ...args, company: atDay(7), existing: [{ id: "m1", dedupeKey: null, status: "draft", draftSource: "rep", sendingStartedAt: null }] });
  ok("…as is the rep's own manual follow-up", manual.state === "open", manual.state);

  // Keys.
  ok("the touchpoint reads back off the key", touchpointOfKey("scheduled:co_easy:7") === 7 && touchpointOfKey("scheduled:co_easy:retention") === TOUCHPOINT_RETENTION);
  ok("…and not off a daily engine key", touchpointOfKey(engineDedupeKey({ companyId: "co_easy", now: NOW })) === null);
  ok("a bad touchpoint makes no key", scheduledDedupeKey({ companyId: "x", touchpoint: 0 }) === null && scheduledDedupeKey({ companyId: "x", touchpoint: "soon" }) === null);
  ok("the scheduled days the planner reads are the engine's", SCHEDULED_CHECKIN_DAYS.join() === "1,7");

  // Without a zone: due, but untimed.
  const noZone = planCheckIn({ ...args, timeZone: null, company: atDay(1) });
  ok("no zone → due with no scheduledFor, and an untimed upcoming", noZone.state === "due" && noZone.scheduledFor === null && noZone.upcoming?.timed === false);

  // The number.
  ok("the company's own phone wins", resolveCompanyNumber({ phone: "819-238-7263", members: [{ role: "owner", phone: "613-555-0100" }] }).e164 === "+18192387263");
  ok("…and says so", resolveCompanyNumber({ phone: "819-238-7263" }).source === "company");
  ok("an owner's phone next", JSON.stringify(resolveCompanyNumber({ phone: null, members: [{ role: "admin", phone: "613-555-0101" }, { role: "owner", phone: "613-555-0100" }] })) === '{"e164":"+16135550100","source":"owner"}');
  ok("an admin's after that", resolveCompanyNumber({ phone: "", members: [{ role: "admin", phone: "613-555-0101" }] }).source === "admin");
  ok("the rep's lead last", resolveCompanyNumber({ phone: "nope", members: [], leadPhone: "(514) 555-0134" }).e164 === "+15145550134");
  ok("nothing usable → null, never a guess", resolveCompanyNumber({ phone: "call the shop", members: [{ role: "owner", phone: null }] }).e164 === null);

  // nextTouchpoint directly, and the summary.
  const nt = nextTouchpoint({ signedUpAt: atDay(1).signedUpAt, dayInLife: 1, retentionDate: new Date(atDay(1).signedUpAt.getTime() + RETENTION * DAY), timeZone: "America/Toronto", now: NOW });
  ok("nextTouchpoint at day 1 is day 7", nt.touchpoint === 7);
  const ntr = nextTouchpoint({ signedUpAt: atDay(20).signedUpAt, dayInLife: 20, retentionDate: new Date(atDay(20).signedUpAt.getTime() + RETENTION * DAY), timeZone: "America/Toronto", now: NOW });
  ok("nextTouchpoint at day 20 is the milestone approach, RETENTION_NEAR_DAYS before the date",
    ntr.touchpoint === TOUCHPOINT_RETENTION && Math.round((ntr.at.getTime() - NOW.getTime()) / DAY) === RETENTION - 20 - RETENTION_NEAR_DAYS, ntr);
  const summary = checkInSummary({ plan: stale, existing: [openRow, { id: "s", status: "sent", sentAt: new Date(NOW.getTime() - 3 * DAY), dedupeKey: "engine:x" }], toE164: "+18192387263" });
  ok("the summary names the open draft, the last send and the touchpoint", summary.draft?.id === "ck1" && summary.touchpoint === 1 && summary.lastSentAt !== null && summary.noNumber === false, summary);
  ok("…and reads no number off the row when it has none", checkInSummary({ plan: d1, existing: [{ ...openRow, toE164: null }], toE164: null }).noNumber === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The materialiser, against an in-memory client");
// ═══════════════════════════════════════════════════════════════════════════

/** Enough of Prisma's where grammar for the queries this module makes. */
function matches(row, where = {}) {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return v.some((w) => matches(row, w));
    const actual = row?.[k];
    // A column never written is null in Postgres; in a plain object it is
    // undefined. The stand-in must not be stricter than the database.
    if (v === null) return actual === null || actual === undefined;
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("in" in v) return v.in.includes(actual);
      if ("not" in v) return actual !== v.not;
      if ("is" in v) return actual && matches(actual, v.is);
      if ("equals" in v) return actual === v.equals;
      return matches(actual || {}, v);
    }
    return actual === v;
  });
}

function memoryClient(seed) {
  const tables = { salesRep: [], company: [], salesCheckIn: [], salesLead: [], salesLeadLinkEvent: [], ...seed };
  const writes = [];
  let seq = 0;
  const model = (name, { unique = [] } = {}) => ({
    findUnique: async ({ where }) => tables[name].find((r) => matches(r, where)) || null,
    findFirst: async ({ where }) => tables[name].find((r) => matches(r, where)) || null,
    findMany: async ({ where = {}, take } = {}) => {
      const rows = tables[name].filter((r) => matches(r, where));
      return take ? rows.slice(0, take) : rows;
    },
    create: async ({ data }) => {
      for (const key of unique) {
        const cols = Array.isArray(key) ? key : [key];
        if (cols.some((c) => data[c] === null || data[c] === undefined)) continue;
        if (tables[name].some((r) => cols.every((c) => r[c] === data[c]))) {
          const err = new Error(`unique ${cols.join("+")}`);
          err.code = "P2002";
          throw err;
        }
      }
      const row = { id: `${name}_${++seq}`, createdAt: NOW, ...data };
      tables[name].push(row);
      writes.push({ model: name, op: "create", data });
      return row;
    },
    updateMany: async ({ where, data }) => {
      const hits = tables[name].filter((r) => matches(r, where));
      for (const r of hits) Object.assign(r, data);
      writes.push({ model: name, op: "updateMany", where, data, count: hits.length });
      return { count: hits.length };
    },
  });
  return {
    tables,
    writes,
    salesRep: model("salesRep"),
    company: model("company"),
    salesCheckIn: model("salesCheckIn", { unique: [["salesRepId", "dedupeKey"]] }),
    salesLead: model("salesLead", { unique: ["convertedCompanyId"] }),
    salesLeadLinkEvent: model("salesLeadLinkEvent"),
    // No salesSmsMessage at all: a write there throws, which is the assertion.
  };
}

const REP = { id: "rep_daniel", name: "Daniel", active: true, endedAt: null, demoCompanyId: "co_demo", commissionPlan: { retentionDays: RETENTION }, createdAt: NOW };
const attributed = (id, name, over = {}) => ({
  id,
  name,
  createdAt: new Date(NOW.getTime() - 1 * DAY),
  isDemo: false,
  stripeChargesEnabled: true,
  onboardingCompletedAt: null,
  subscription: { status: "active", trialEndsAt: new Date(NOW.getTime() + 29 * DAY) },
  salesAttribution: { salesRepId: "rep_daniel", capturedAt: new Date(NOW.getTime() - 1 * DAY), source: "link" },
  phone: null,
  email: null,
  province: null,
  country: null,
  timezone: "America/Toronto",
  members: [],
  ...over,
});

function seed() {
  return memoryClient({
    salesRep: [REP],
    // The owner's own situation: two older leads on the company's number,
    // one with a zone typed on it. Ontario is a split province, so the
    // company's draft is only timed because that zone is inherited.
    salesLead: [
      { id: "lead_loop", salesRepId: "rep_daniel", businessName: "Loop INc", phone: "8192387263", timeZone: "America/Toronto", province: "NY", country: "US", convertedCompanyId: null, updatedAt: NOW },
    ],
    company: [
      attributed("co_easy", "Easy Roofers Inc.", { phone: "819-238-7263", email: "sierra@example.com", province: "ON", country: "CA" }),
      attributed("co_owner", "Owner Phone Ltd", { members: [{ role: "owner", phone: "604-555-0170", active: true }], province: "BC", country: "CA", timezone: "America/Vancouver" }),
      attributed("co_none", "No Number Co", { province: "TX", country: "US" }),
      attributed("co_today", "Signed Up Today", { createdAt: NOW, phone: "416-555-0180", province: "ON", country: "CA" }),
      // A demo with an attribution row: must never happen, and must never be written for if it does.
      attributed("co_demo", "Cedar & Co. Flooring", { isDemo: true, phone: "613-555-0142" }),
      // Somebody else's company, with a phone: never considered.
      attributed("co_other", "Not Mine", { phone: "514-555-0199", salesAttribution: { salesRepId: "rep_other", capturedAt: NOW, source: "link" } }),
    ],
  });
}

{
  const client = seed();
  const setupCalls = [];
  const loadSetup = async (id) => {
    setupCalls.push(id);
    return setupDone;
  };
  const first = await materialiseCheckInsForRep({ salesRepId: REP.id, client, now: NOW, loadSetup, snapshotBudget: 10 });
  ok("the run reports ok", first.ok === true);
  ok("it considered this rep's four real companies and nothing else", first.considered === 4, first.considered);
  ok("it created three drafts — every day-1 company, with a number or without", first.created.length === 3, first.created.map((c) => c.name));
  ok("…and skipped the one that signed up today as too soon", first.skipped.some((s) => s.companyId === "co_today" && s.state === "suppressed" && s.code === "too_soon"), first.skipped);
  ok("…never touched the demo, even with an attribution row on it", !client.tables.salesCheckIn.some((r) => r.companyId === "co_demo"));
  ok("…never touched another rep's company", !client.tables.salesCheckIn.some((r) => r.companyId === "co_other"));

  const easy = client.tables.salesCheckIn.find((r) => r.companyId === "co_easy");
  ok("Easy Roofers' draft is a draft", easy?.status === "draft" && easy.origin === "engine" && easy.draftSource === "rule" && easy.degraded === true, easy);
  ok("…addressed to the company's own phone, normalised", easy?.toE164 === "+18192387263", easy?.toE164);
  ok("…keyed on the day-1 touchpoint", easy?.dedupeKey === "scheduled:co_easy:1", easy?.dedupeKey);
  ok("…aimed inside the texting window in Toronto — the zone the rep typed on the older lead at this number", easy?.scheduledFor && localTimeIn("America/Toronto", easy.scheduledFor).minute >= SALES_SMS_WINDOW.startMinute, easy?.scheduledFor);
  ok("…worded by the rule draft with the rep's and the company's names", /Daniel from FieldQuo, about Easy Roofers Inc\./.test(easy?.draftText || ""), easy?.draftText);
  ok("…with the engine's reason on it — onboarding, not the free month ending in 29 days", easy?.reasonCode === "onboarding_unfinished", easy?.reasonCode);
  ok("…and the setup snapshot was read for the wording", setupCalls.includes("co_easy"));

  const lead = client.tables.salesLead.find((l) => l.convertedCompanyId === "co_easy");
  ok("a lead was created for Easy Roofers", Boolean(lead) && lead.id !== "lead_loop", client.tables.salesLead.length);
  ok("…named after the company, signed, pointing at it, with the company's phone", lead?.businessName === "Easy Roofers Inc." && lead?.status === "signed" && lead?.phone === "+18192387263", lead);
  ok("…with the province copied, and the zone the rep had stated at this number carried over", lead?.province === "ON" && lead?.country === "CA" && lead?.timeZone === "America/Toronto", lead);
  ok("…and the draft hangs off it", easy?.leadId === lead?.id);
  const event = client.tables.salesLeadLinkEvent.find((e) => e.leadId === lead?.id);
  ok("…with a link event whose reason is signup", event?.action === "linked" && event?.reason === "signup" && event?.companyId === "co_easy", event);
  ok("the summary for Easy Roofers says the draft is ready", first.summaries.get("co_easy")?.draft?.id === easy?.id && first.summaries.get("co_easy")?.touchpoint === 1);

  const owner = client.tables.salesCheckIn.find((r) => r.companyId === "co_owner");
  ok("the owner's phone is used when the company has none", owner?.toE164 === "+16045550170", owner?.toE164);
  ok("…aimed in THEIR zone (Vancouver, from BC's single zone)", owner?.scheduledFor && localTimeIn("America/Vancouver", owner.scheduledFor).minute >= SALES_SMS_WINDOW.startMinute);

  const none = client.tables.salesCheckIn.find((r) => r.companyId === "co_none");
  ok("a company with no number still gets its row, with no number on it", none && none.toE164 === null, none);
  ok("…which the summary reports as no number", first.summaries.get("co_none")?.noNumber === true);
  ok("…Texas being a split state, its draft is untimed", none?.scheduledFor === null);

  ok("nothing was written to any message table", client.writes.every((w) => MATERIALISE_WRITES.includes(w.model)), client.writes.map((w) => w.model));
  ok("MATERIALISE_WRITES is exactly the three FieldQuo-side tables", MATERIALISE_WRITES.join() === "salesCheckIn,salesLead,salesLeadLinkEvent");

  // ── Second run: idempotent ─────────────────────────────────────────
  const before = client.writes.length;
  const second = await materialiseCheckInsForRep({ salesRepId: REP.id, client, now: new Date(NOW.getTime() + 3600 * 1000), loadSetup, snapshotBudget: 10 });
  ok("a second run creates nothing", second.created.length === 0 && second.leadsCreated.length === 0 && second.refreshed.length === 0, second);
  ok("…and writes nothing", client.writes.length === before, client.writes.length - before);
  ok("…reporting every company as open or suppressed", second.skipped.every((s) => ["open", "suppressed"].includes(s.state)), second.skipped);
  ok("…with the same summary", second.summaries.get("co_easy")?.draft?.id === easy?.id);

  // ── Day 7: the untouched day-1 draft is re-aimed, not joined ───────
  const day7 = new Date(NOW.getTime() + 6 * DAY);
  const third = await materialiseCheckInsForRep({ salesRepId: REP.id, client, now: day7, loadSetup, snapshotBudget: 10 });
  ok("on day 7 the three open day-1 drafts are refreshed, and one created (Signed Up Today's day 1)", third.refreshed.length === 3 && third.created.length === 1 && third.created[0].companyId === "co_today", { r: third.refreshed.length, c: third.created.length });
  ok("…Easy Roofers' row is now the day-7 touchpoint", client.tables.salesCheckIn.find((r) => r.companyId === "co_easy")?.dedupeKey === "scheduled:co_easy:7");
  ok("…still one row for the company", client.tables.salesCheckIn.filter((r) => r.companyId === "co_easy").length === 1);
  ok("Signed Up Today got its day-1 draft on the later run (the one creation)", client.tables.salesCheckIn.some((r) => r.companyId === "co_today" && r.dedupeKey === "scheduled:co_today:1"));

  // ── A rep-edited draft is not re-aimed ─────────────────────────────
  const ownerRow = client.tables.salesCheckIn.find((r) => r.companyId === "co_owner");
  ownerRow.draftSource = "rep";
  ownerRow.draftText = "my own words";
  const fourth = await materialiseCheckInsForRep({ salesRepId: REP.id, client, now: new Date(day7.getTime() + DAY), loadSetup, snapshotBudget: 10 });
  ok("a draft the rep rewrote keeps their words", ownerRow.draftText === "my own words" && !fourth.refreshed.some((r) => r.companyId === "co_owner"));

  // ── Repair: the rep adds a phone to the numberless lead ────────────
  //
  // On a fresh day-1 store, so the row is "open" rather than due for a
  // refresh (a refresh re-addresses it too, on its own path).
  const repairClient = seed();
  await materialiseCheckInsForRep({ salesRepId: REP.id, client: repairClient, now: NOW, loadSetup, snapshotBudget: 10 });
  const noneLead = repairClient.tables.salesLead.find((l) => l.convertedCompanyId === "co_none");
  ok("the numberless company still got a lead to put a number on", Boolean(noneLead) && noneLead.phone === null);
  noneLead.phone = "(512) 555-0142";
  const fifth = await materialiseCheckInsForRep({ salesRepId: REP.id, client: repairClient, now: new Date(NOW.getTime() + 3600 * 1000), loadSetup, snapshotBudget: 10 });
  const repaired = repairClient.tables.salesCheckIn.find((r) => r.companyId === "co_none");
  ok("a numberless row is re-addressed once the lead has a phone", fifth.repaired.length === 1 && repaired?.toE164 === "+15125550142", repaired?.toE164);
  ok("…and nothing else is created for it", repairClient.tables.salesCheckIn.filter((r) => r.companyId === "co_none").length === 1);
  ok("…the summary now says a draft is ready", fifth.summaries.get("co_none")?.noNumber === false && fifth.summaries.get("co_none")?.draft?.toE164 === "+15125550142");

  // ── Sent: the touchpoint settles and the next arrives on its own ───
  const easyRow = client.tables.salesCheckIn.find((r) => r.companyId === "co_easy");
  easyRow.status = "sent";
  easyRow.sentAt = day7;
  const sixth = await materialiseCheckInsForRep({ salesRepId: REP.id, client, now: new Date(day7.getTime() + DAY), loadSetup, snapshotBudget: 10 });
  ok("after a send the company reads as recently checked in and gets nothing new", sixth.skipped.some((s) => s.companyId === "co_easy" && s.code === "recently_checked_in") && !client.tables.salesCheckIn.some((r) => r.companyId === "co_easy" && r.status === "draft"));
  ok("…and the summary carries the send", sixth.summaries.get("co_easy")?.lastSentAt === day7);

  // ── Dry run writes nothing ─────────────────────────────────────────
  const dryClient = seed();
  const dry = await materialiseCheckInsForRep({ salesRepId: REP.id, client: dryClient, now: NOW, loadSetup, dryRun: true, snapshotBudget: 10 });
  ok("a dry run decides the same three drafts", dry.created.length === 3 && dry.created.every((c) => c.dryRun === true), dry.created.length);
  ok("…and the same lead", dry.leadsCreated.length === 3 && dry.leadsCreated.every((l) => l.dryRun === true));
  ok("…and writes nothing at all", dryClient.writes.length === 0 && dryClient.tables.salesCheckIn.length === 0 && dryClient.tables.salesLead.length === 1, dryClient.writes);

  // ── A lead another rep holds for the company is respected ──────────
  const foreign = seed();
  foreign.tables.salesLead.push({ id: "lead_theirs", salesRepId: "rep_other", convertedCompanyId: "co_easy", phone: "819-238-7263" });
  const f = await materialiseCheckInsForRep({ salesRepId: REP.id, client: foreign, now: NOW, loadSetup, snapshotBudget: 10 });
  ok("no second lead is created when another rep's lead already holds the company", foreign.tables.salesLead.filter((l) => l.convertedCompanyId === "co_easy").length === 1 && !f.leadsCreated.some((l) => l.companyId === "co_easy"), f.leadsCreated);
  ok("…and the draft is still written, unattached to their lead", foreign.tables.salesCheckIn.find((r) => r.companyId === "co_easy")?.leadId === null);

  // ── The snapshot budget bounds a request ───────────────────────────
  const budgeted = seed();
  const calls = [];
  await materialiseCheckInsForRep({ salesRepId: REP.id, client: budgeted, now: NOW, loadSetup: async (id) => { calls.push(id); return setupDone; }, snapshotBudget: 1 });
  ok("the snapshot budget is honoured", calls.length === 1, calls);
  ok("…and a company past it still gets its draft, worded from what is known", budgeted.tables.salesCheckIn.length === 3);

  // ── An unknown rep ─────────────────────────────────────────────────
  const nobody = await materialiseCheckInsForRep({ salesRepId: "rep_nobody", client: seed(), now: NOW, loadSetup });
  ok("an unknown rep is not ok and writes nothing", nobody.ok === false && nobody.created.length === 0);
}

{
  // The zone rule.
  ok("a lead's stated zone wins", companyTimeZone({ company: { province: "ON", country: "CA" }, lead: { timeZone: "America/Vancouver" } }).timeZone === "America/Vancouver");
  ok("the province derives it next", companyTimeZone({ company: { province: "NY", country: "US", timezone: "America/Toronto" } }).timeZone === "America/New_York");
  ok("Company.timezone counts only when changed from the default", companyTimeZone({ company: { province: "TX", country: "US", timezone: "America/Toronto" } }).timeZone === null);
  ok("…and is believed when it was", companyTimeZone({ company: { province: "TX", country: "US", timezone: "America/Chicago" } }).timeZone === "America/Chicago");
  ok("the select widens REP_COMPANY_SELECT by the address of the text and nothing about the business",
    Object.keys(MATERIALISE_COMPANY_SELECT).filter((k) => !(k in REP_COMPANY_SELECT)).sort().join() === "country,email,members,phone,province,timezone",
    Object.keys(MATERIALISE_COMPANY_SELECT));
  ok("…and REP_COMPANY_SELECT itself is untouched", !("phone" in REP_COMPANY_SELECT));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The demo fixture");
// ═══════════════════════════════════════════════════════════════════════════

{
  const client = seed();
  const one = await materialiseDemoCheckIn({ salesRepId: REP.id, client, now: NOW });
  ok("the demo draft is written", one.created === true, one);
  const row = client.tables.salesCheckIn.find((r) => r.companyId === "co_demo");
  ok("…as a draft, marked demo in its origin", row?.status === "draft" && row?.origin === DEMO_ORIGIN, row);
  ok("…keyed demo:<company>:1", row?.dedupeKey === "demo:co_demo:1", row?.dedupeKey);
  ok("…addressed to the fictional number", row?.toE164 === DEMO_CHECKIN_E164 && /^\+1\d{3}55501\d{2}$/.test(DEMO_CHECKIN_E164));
  ok("…worded like a real day-1 text, naming the demo company", /Daniel from FieldQuo, about Cedar & Co\. Flooring/.test(row?.draftText || ""), row?.draftText);
  ok("…with no lead", row?.leadId === null);
  ok("…and no attribution written", client.writes.every((w) => w.model !== "salesAttribution"));
  const two = await materialiseDemoCheckIn({ salesRepId: REP.id, client, now: new Date(NOW.getTime() + DAY) });
  ok("a second call finds it rather than adding one", two.created === false && two.reason === "exists" && client.tables.salesCheckIn.filter((r) => r.companyId === "co_demo").length === 1, two);
  ok("the engine itself would have refused this company", checkInSignals({ company: { id: "co_demo", isDemo: true, signedUpAt: NOW }, retentionDays: RETENTION, now: NOW }).suppressed?.code === "demo_company");

  const noDemo = seed();
  noDemo.tables.salesRep[0] = { ...REP, demoCompanyId: null };
  ok("a rep with no demo gets nothing", (await materialiseDemoCheckIn({ salesRepId: REP.id, client: noDemo, now: NOW })).created === false);

  const pointedAtReal = seed();
  pointedAtReal.tables.salesRep[0] = { ...REP, demoCompanyId: "co_easy" };
  const r = await materialiseDemoCheckIn({ salesRepId: REP.id, client: pointedAtReal, now: NOW });
  ok("a demoCompanyId pointing at a real company writes nothing (isDemo re-read from the row)", r.created === false && r.reason === "not_a_demo" && pointedAtReal.tables.salesCheckIn.length === 0, r);

  const dry = seed();
  const d = await materialiseDemoCheckIn({ salesRepId: REP.id, client: dry, now: NOW, dryRun: true });
  ok("a dry run says what it would write and writes nothing", d.wouldCreate?.dedupeKey === "demo:co_demo:1" && dry.tables.salesCheckIn.length === 0);
}

{
  // The whole-fleet loop the cron calls.
  const client = seed();
  client.tables.salesRep.push({ id: "rep_left", name: "Gone", active: false, endedAt: NOW, demoCompanyId: null, createdAt: NOW });
  const loadSetup = async () => setupDone;
  const report = await materialiseCheckInsForAllReps({ client, now: NOW, loadSetup });
  ok("the fleet run covers active reps only", report.reps === 1, report.reps);
  ok("…and counts what it did", report.created === 3 && report.leadsCreated === 3 && report.demoCreated === 1 && report.failed === 0, report);
  const again = await materialiseCheckInsForAllReps({ client, now: NOW, loadSetup });
  ok("…idempotently", again.created === 0 && again.leadsCreated === 0 && again.demoCreated === 0, again);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The cron");
// ═══════════════════════════════════════════════════════════════════════════

{
  const src = decomment(read("app/api/cron/sales-checkins/route.js"));
  ok("the cron calls requireCronSecret first", /requireCronSecret\(request\)/.test(src) && /if \(denied\) return denied/.test(src));
  ok("…never hand-compares the secret", !/process\.env\.CRON_SECRET/.test(src));
  ok("…and runs the fleet materialiser with the real client", /materialiseCheckInsForAllReps\(\{\s*client: db/.test(src));
  ok("…without a dry-run flag, so a scheduled tick writes", !/dryRun: true/.test(src));
  ok("…and answers with counts only, not the per-rep wording", /perRep: _perRep, \.\.\.counts/.test(src));

  // Executed: the route itself, with next/server stubbed the way
  // scripts/check-public-payload.mjs stubs it (bare node cannot resolve
  // it). A request with no header, and one with the wrong secret, both get
  // 401 from the route's own first line.
  register(
    `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") return { url: "fq-stub:next", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:next")
    return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => ({ status: init?.status ?? 200, body, json: async () => body }) };" };
  return nextLoad(url, context);
}`)}`,
  );
  const prev = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "check-sales-checkin-materialise-secret";
  try {
    const route = await import("@/app/api/cron/sales-checkins/route.js");
    const fake = (auth) => ({ headers: { get: (k) => (String(k).toLowerCase() === "authorization" ? auth : null) } });
    const none = await route.GET(fake(null));
    ok("an unauthenticated call is refused with 401", none?.status === 401, none?.status);
    const wrong = await route.GET(fake("Bearer nope"));
    ok("…and so is the wrong secret", wrong?.status === 401, wrong?.status);
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  }

  const vercel = JSON.parse(read("vercel.json"));
  const entry = vercel.crons.find((c) => c.path === "/api/cron/sales-checkins");
  ok("vercel.json schedules it daily at 07:00 UTC", entry?.schedule === "0 7 * * *", entry);
  ok("…and every other sales cron is still there", ["/api/cron/sales-retention", "/api/cron/sales-pipeline", "/api/cron/sales-payouts", "/api/cron/sales-queue-release"].every((p) => vercel.crons.some((c) => c.path === p)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Where the rep sees it");
// ═══════════════════════════════════════════════════════════════════════════

{
  const companies = decomment(read("app/api/sales/companies/route.js"));
  ok("the companies route materialises on the way in", /materialiseCheckInsForRep\(\{ salesRepId: rep\.id \}\)/.test(companies));
  ok("…and hands each company its summary", /checkIn: summaries \? summaries\.get\(c\.id\) \|\| null : null/.test(companies));
  ok("…failing soft into checkInError", /checkInError = /.test(companies) && /checkInError,\s*\}\)/.test(companies));
  ok("…still scoped by assignedCompanyWhere and REP_COMPANY_SELECT", /where: assignedCompanyWhere\(rep\.id\)/.test(companies) && /select: REP_COMPANY_SELECT/.test(companies));

  const page = decomment(read("app/sales/companies/page.js"));
  ok("the companies screen has a check-in column", /app\.salesPortal\.colCheckIn/.test(page) && /<CheckInCell/.test(page));
  ok("…that says due with a time, sent, upcoming, or no number", ["checkInDue", "checkInSent", "checkInUpcoming", "checkInNoNumber", "checkInRetentionDue"].every((k) => page.includes(`app.salesPortal.${k}`)));
  ok("…and links a ready draft into Texts by its number", /\/sales\/messages\?with=\$\{encodeURIComponent\(summary\.draft\.toE164\)\}/.test(page));
  ok("…and shows the backlog's own failure apart from the list's", /checkInError/.test(page) && /app\.salesPortal\.checkInUnreadable/.test(page));
  ok("…with the six suppressions as literal keys", (page.match(/app\.salesPortal\.checkInSuppressed[A-Za-z]+/g) || []).length === 6);

  const messages = decomment(read("app/api/sales/messages/route.js"));
  ok("the texts list materialises before it is drawn", /await materialiseCheckInsForRep\(\{ salesRepId: rep\.id \}\);\s*await materialiseDemoCheckIn/.test(messages));
  ok("…and lists a draft-only thread under its company's name", /draftOnly: true/.test(messages) && /name: draft\.name/.test(messages));

  const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
  const keys = [
    "app.salesText.draftWaitingSubtitle", "app.salesText.demoThreadNote", "app.salesText.firstContactSignedUp",
    "app.salesPortal.colCheckIn", "app.salesPortal.checkInDue", "app.salesPortal.checkInRetentionDue", "app.salesPortal.checkInDueUntimed",
    "app.salesPortal.checkInRetentionDueUntimed", "app.salesPortal.checkInNoNumber", "app.salesPortal.checkInSent", "app.salesPortal.checkInUpcoming",
    "app.salesPortal.checkInRetentionUpcoming", "app.salesPortal.checkInNone", "app.salesPortal.checkInUnreadable",
    "app.salesPortal.checkInSuppressedDemo", "app.salesPortal.checkInSuppressedNoDate", "app.salesPortal.checkInSuppressedEnded",
    "app.salesPortal.checkInSuppressedTooSoon", "app.salesPortal.checkInSuppressedRecent", "app.salesPortal.checkInSuppressedPassed",
  ];
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(`every check-in key is in ${lang}`, keys.every((k) => typeof APP_MESSAGES[lang][k] === "string" && APP_MESSAGES[lang][k].length > 0), keys.filter((k) => !APP_MESSAGES[lang][k]));
  }
  ok("the due sentence carries the day and the time", /\{day\}/.test(APP_MESSAGES.en["app.salesPortal.checkInDue"]) && /\{when\}/.test(APP_MESSAGES.en["app.salesPortal.checkInDue"]));

  const schema = read("prisma/schema.prisma");
  const model = schema.slice(schema.indexOf("model SalesCheckIn {"));
  const body = model.slice(0, model.indexOf("\n}\n") + 2);
  ok("SalesCheckIn.toE164 is nullable, for the numberless row and nothing else", /toE164 String\?/.test(body));
  ok("…and the schema says which writer", /materialise\.js/.test(body));
}

console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass + failures.length} assertions, ${failures.length} failures`);
for (const f of failures) console.log(`  · ${f}`);
process.exit(failures.length ? 1 : 0);
