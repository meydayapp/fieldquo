#!/usr/bin/env node
//
// scripts/check-sales-messages.mjs
//
//   npm run check:sales-messages
//
// Four promises about /sales/messages, none of which is visible in a diff and
// three of which fail silently.
//
// ══ 1. The thread groups the way a messenger groups ════════════════════════
//
// Grouping is what separates a conversation from a log file, and it is
// arithmetic on timestamps: a window measured in seconds, a day boundary
// measured in a zone, and an order that has to survive two rows sharing a
// millisecond. None of that is visible on a screen with four messages on it,
// which is why lib/sales/messages/grouping.js is pure and why every branch of
// it is EXECUTED here rather than read.
//
// ══ 2. A DRAFT NEVER SENDS ITSELF ══════════════════════════════════════════
//
// This is the promise the whole feature rests on. `SalesCheckIn.scheduledFor`
// is the rep's intention, not a trigger — and a column with that name is
// exactly the one that acquires a cron six months from now without anybody
// deciding to add one. So the send path is located by name and every
// scheduled surface in the repo is scanned for a reference to it: vercel.json's
// crons, app/api/cron, and the client screen itself.
//
// ══ 3. A suppressed conversation offers nothing, AND the server refuses ════
//
// Both halves, because either alone is a lie. A hidden button is not access
// control (AGENTS.md), and a server refusal the screen does not respect is a
// rep hammering a control that will never work.
//
// ══ 4. A time a rep picks has to be one a text could actually go at ════════
//
// parseScheduleRequest is executed against the window edges, an unknown zone,
// the past and the horizon.
//
// ══ Why the source assertions are decommented and brace-scoped ════════════
//
// Twice today a check in this repo matched its OWN header comment and passed
// over a deleted guard, and once a mutation crashed the runner so no failures
// printed at all — which reads exactly like a pass. So: comments are blanked
// before any text match, every ordered rule names one brace-matched function,
// and the runner exits non-zero on an uncaught throw as loudly as on a failed
// assertion. Judge this file by its EXIT CODE.
//
// ══ 5. Every text sent to a business ends up in ITS conversation ══════════
//
// The owner: "any texts sent to a company should also end up in SMS". §15
// drives each outbound path — the signup link, a link to the business's
// OTHER number, the engine's check-in on a company that signed up straight
// from the link, a typed reply, the demo's simulated send, a reply that
// arrives from a number nobody texted — over an in-memory client and asserts
// the row lands in ONE conversation per business, with the numbers listed
// inside it and a kind chip on every outbound bubble, and that a
// conversation with only our own words in it is listed at all.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// The grouping window, the day break, the draft-never-auto-sends rule and the
// suppression refusal were each broken in turn, the break confirmed present in
// the file, this script confirmed to exit non-zero, and the file restored from
// a `cp` backup taken first — never `git checkout`, which restores the commit
// and not the working copy.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, condition, detail = "") {
  if (condition) {
    pass += 1;
    return true;
  }
  failures.push(`${name}${detail ? `  — ${JSON.stringify(detail)}` : ""}`);
  console.log(`  ✗ ${name}${detail ? `  ${JSON.stringify(detail)}` : ""}`);
  return false;
}
const section = (t) => console.log(`\n${t}`);

/** Comments blanked, string literals kept. Same job as check-sales-auth's. */
function decomment(src) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && d === "*") { state = "block"; out += "  "; i += 2; continue; }
      if (c === '"' || c === "'" || c === "`") { state = c; out += c; i += 1; continue; }
      out += c; i += 1; continue;
    }
    if (state === "line") { out += c === "\n" ? "\n" : " "; if (c === "\n") state = "code"; i += 1; continue; }
    if (state === "block") {
      if (c === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
      out += c === "\n" ? "\n" : " "; i += 1; continue;
    }
    // Inside a string literal. Escapes are consumed whole so a \" does not end it.
    if (c === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
    out += c;
    if (c === state) state = "code";
    i += 1;
  }
  return out;
}

/** Index of the delimiter closing the one that opens at `start`. */
function matchDelims(src, start) {
  const pairs = { "(": ")", "{": "}", "[": "]" };
  const stack = [];
  for (let i = start; i < src.length; i += 1) {
    const c = src[i];
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === ")" || c === "}" || c === "]") {
      if (stack.pop() !== c) return -1;
      if (!stack.length) return i;
    }
  }
  return -1;
}

/** One named function's body, braces matched, parameters skipped. */
function functionSource(src, name) {
  const sig = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = sig.exec(src);
  if (!m) return null;
  const paramClose = matchDelims(src, m.index + m[0].length - 1);
  if (paramClose === -1) return null;
  const open = src.indexOf("{", paramClose);
  if (open === -1) return null;
  const close = matchDelims(src, open);
  return close === -1 ? null : src.slice(m.index, close + 1);
}

function walk(dir, out = []) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs)) {
    const rel = join(dir, entry);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(js|jsx|mjs|ts|tsx)$/.test(entry)) out.push(rel);
  }
  return out;
}

// ── A scriptable stand-in for Prisma ──────────────────────────────────────
//
// lib/sales/checkin/store.js has to be EXECUTED — the claim-before-send and
// the revert-on-refusal are properties of an UPDATE's WHERE clause, and a
// regex over the source proves neither. Importing the real @/lib/db builds a
// PrismaClient against Neon at module load, so the specifier is redirected.
//
// Every write is RECORDED rather than swallowed, for the reason
// scripts/fixtures/dbStub.mjs gives: "the row was claimed with
// sendingStartedAt: null in the WHERE" is a claim about an argument, and this
// is where the argument can be inspected.
// `db` is set by §15 for the one function that reaches for the module-level
// client (handleSalesInboundSms) and cleared again after; every other model
// keeps throwing, so a stray read is still a failure and not a silent null.
globalThis.__FQ_MSG = { rows: { salesCheckIn: [] }, writes: [], db: null };
const DB_HOOKS = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: "fq-stub:msg-db", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:msg-db")
    return { format: "module", shortCircuit: true, source:
      "export const db = new Proxy({}, { get: (_t, model) => { const real = globalThis.__FQ_MSG && globalThis.__FQ_MSG.db; if (real && real[model]) return real[model]; return new Proxy({}, { get: (_m, op) => async (args) => { throw new Error('the module-level db was used: ' + String(model) + '.' + String(op)); } }); } });" };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(DB_HOOKS)}`);

const {
  GROUPING_WINDOW_SECONDS,
  groupThread,
  isSequential,
  isGroupable,
  orderThread,
  speakerOf,
  startsNewDay,
  dayKey,
} = await import("@/lib/sales/messages/grouping");

const {
  MAX_HORIZON_DAYS,
  nextWindowOpening,
  parseScheduleRequest,
  defaultScheduleFor,
} = await import("@/lib/sales/checkin/schedule");

const { REP_CHECKIN_WRITES, CHECKIN_STATUSES, sendCheckIn, engineDedupeKey } = await import(
  "@/lib/sales/checkin/store"
);
const { salesSmsReadiness } = await import("@/lib/sales/salesSmsRules");
const { SALES_SMS_WINDOW } = await import("@/lib/sales/smsWindow");

// ═══════════════════════════════════════════════════════════════════════════
section("1. Grouping — executed, not read");
// ═══════════════════════════════════════════════════════════════════════════

const T0 = new Date("2026-09-10T14:00:00.000Z");
const at = (seconds) => new Date(T0.getTime() + seconds * 1000);
const msg = (id, direction, seconds, extra = {}) => ({
  id,
  direction,
  body: `#${id}`,
  at: at(seconds),
  kind: "message",
  status: "sent",
  ...extra,
});

// UTC throughout: the day boundary has to be pinned or this file passes or
// fails depending on which machine runs it.
const UTC = { timeZone: "UTC" };

ok("the window is 300 seconds", GROUPING_WINDOW_SECONDS === 300, GROUPING_WINDOW_SECONDS);

{
  // Same sender, 60s apart — one group.
  const a = msg("a", "out", 0);
  const b = msg("b", "out", 60);
  ok("same sender 60s apart is sequential", isSequential(b, a, UTC) === true);

  const rows = groupThread([a, b], UTC).filter((r) => r.kind === "message");
  ok("…so the sender is named once", rows.map((r) => r.showSender).join() === "true,false",
    rows.map((r) => r.showSender));
  ok("…and the timestamp belongs to the group", rows.map((r) => r.showTime).join() === "true,false");
  ok("…and only the last row of the group ends it", rows.map((r) => r.groupEnd).join() === "false,true");
}

{
  // Same sender, 301s apart — two groups. And the exact boundary.
  const a = msg("a", "out", 0);
  const b = msg("b", "out", 301);
  ok("same sender 301s apart is NOT sequential", isSequential(b, a, UTC) === false);
  const boundary = msg("c", "out", 300);
  ok("…and exactly 300s apart is not either — the comparison is <", isSequential(boundary, a, UTC) === false);
  const inside = msg("d", "out", 299);
  ok("…while 299s apart is", isSequential(inside, a, UTC) === true);

  const rows = groupThread([a, b], UTC).filter((r) => r.kind === "message");
  ok("…so both rows are named", rows.every((r) => r.showSender), rows.map((r) => r.showSender));
}

{
  // Different senders, one second apart.
  const a = msg("a", "out", 0);
  const b = msg("b", "in", 1);
  ok("a different sender never groups, however close", isSequential(b, a, UTC) === false);
  ok("speakerOf reads direction, not rep identity", speakerOf(a) === "us" && speakerOf(b) === "them");
}

{
  // Across midnight: 40 seconds apart, different days.
  const before = { id: "a", direction: "out", body: "x", at: new Date("2026-09-10T23:59:30.000Z"), kind: "message" };
  const after = { id: "b", direction: "out", body: "y", at: new Date("2026-09-11T00:00:10.000Z"), kind: "message" };
  ok("40 seconds is inside the window", after.at.getTime() - before.at.getTime() < 300 * 1000);
  ok("…but a new day breaks the group anyway", isSequential(after, before, UTC) === false);
  ok("startsNewDay says so directly", startsNewDay(after, before, "UTC") === true);

  const rows = groupThread([before, after], UTC);
  ok("…and a divider is emitted at the turn", rows.filter((r) => r.kind === "day").length === 2,
    rows.filter((r) => r.kind === "day").map((r) => r.dayKey));
  ok("…the first of which sits above the very first message", rows[0].kind === "day");
}

{
  // A single message, and an empty thread.
  const one = groupThread([msg("only", "in", 0)], UTC);
  ok("a single message yields one divider and one row", one.length === 2);
  ok("…and it starts and ends its own group",
    one[1].groupStart === true && one[1].groupEnd === true && one[1].showSender === true);

  ok("an empty thread yields nothing", groupThread([], UTC).length === 0);
  ok("…and so does rubbish", groupThread(null, UTC).length === 0 && groupThread(undefined).length === 0);
}

{
  // Out-of-order input.
  const a = msg("a", "out", 0);
  const b = msg("b", "out", 60);
  const c = msg("c", "out", 120);
  const shuffled = [c, a, b];
  ok("orderThread sorts oldest first", orderThread(shuffled).map((m) => m.id).join() === "a,b,c");
  const rows = groupThread(shuffled, UTC).filter((r) => r.kind === "message");
  ok("…so grouping sees them in order", rows.map((r) => r.item.id).join() === "a,b,c");
  ok("…and they are one group", rows.map((r) => r.showSender).join() === "true,false,false");

  // Two rows sharing an instant must not swap between renders.
  const tie1 = { ...msg("z", "out", 5), id: "zzz" };
  const tie2 = { ...msg("z", "out", 5), id: "aaa" };
  ok("a tie breaks deterministically on id",
    orderThread([tie1, tie2]).map((m) => m.id).join() === orderThread([tie2, tie1]).map((m) => m.id).join());
}

{
  // Undated rows are placed, never dated.
  const good = msg("a", "out", 0);
  const bad = { id: "b", direction: "out", body: "?", at: null, kind: "message" };
  const rows = groupThread([bad, good], UTC);
  const messages = rows.filter((r) => r.kind === "message");
  ok("an undated row sorts last", messages.map((r) => r.item.id).join() === "a,b");
  ok("…is marked undated", messages[1].undated === true);
  ok("…never groups", messages[1].showSender === true);
  ok("…and gets no invented day heading", rows.filter((r) => r.kind === "day").length === 1);
  ok("dayKey refuses an unreadable instant", dayKey(null) === null && dayKey("banana") === null);
}

{
  // A draft is not speech: it never groups and it never anchors a group.
  const a = msg("a", "out", 0);
  const draft = { id: "d", direction: "out", body: "draft", at: at(30), kind: "draft" };
  const b = msg("b", "out", 60);
  ok("a draft is not groupable", isGroupable(draft) === false);
  const rows = groupThread([a, draft, b], UTC).filter((r) => r.kind === "message");
  ok("…and the message after it starts a new group",
    rows.map((r) => `${r.item.id}:${r.showSender}`).join() === "a:true,d:true,b:true");

  // A failed send carries its own explanation and must not be tucked under a
  // previous message's header.
  const failed = msg("f", "out", 30, { status: "failed" });
  ok("a failed send is not groupable", isGroupable(failed) === false);
  ok("…and does not group with the message before it", isSequential(failed, a, UTC) === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. A draft never sends itself");
// ═══════════════════════════════════════════════════════════════════════════

const SEND_FN = "sendCheckIn";
const STORE = "lib/sales/checkin/store.js";
const SEND_ROUTE = "app/api/sales/checkins/[id]/send/route.js";

{
  const store = decomment(read(STORE));
  ok("the send path exists and is named", functionSource(store, SEND_FN) !== null);

  // Every file in the repo that mentions it, excluding node_modules and this
  // check. Exactly two: the definition and the one route behind the button.
  const trees = ["app", "lib", "scripts", "prisma"];
  const mentions = [];
  for (const tree of trees) {
    for (const file of walk(tree)) {
      if (file === `scripts${join("/", "check-sales-messages.mjs").slice(0)}`) continue;
      if (file.endsWith("check-sales-messages.mjs")) continue;
      if (new RegExp(`\\b${SEND_FN}\\b`).test(decomment(read(file)))) mentions.push(file);
    }
  }
  ok(
    `${SEND_FN} is referenced by its own module and by ONE route, and by nothing else`,
    mentions.length === 2 && mentions.includes(STORE) && mentions.includes(SEND_ROUTE),
    mentions,
  );

  // The scheduled surfaces, by name. A cron that grew a reference to the
  // check-in table would be the failure this section exists for, and it would
  // not show up as a reference to the function.
  const cronFiles = walk("app/api/cron");
  ok("there are cron routes to scan (the scan is not vacuous)", cronFiles.length > 3, cronFiles.length);
  // twilioClient is not on this list: tenant crons (appointment reminders)
  // text a contractor's CLIENTS on the contractor's own line, which is a
  // different sender, a different opt-out and a different table. The sales
  // send path is deliverReplySms in salesSms.js, and that is what no cron
  // may reach.
  const cronTouching = cronFiles.filter((f) => /salesCheckIn|checkin\/store|sendCheckIn|deliverReplySms|salesSms/.test(decomment(read(f))));
  ok("no cron route touches the check-in table directly or the sales send path", cronTouching.length === 0, cronTouching);

  // ── The ONE cron that may reach the check-in feature, and how far ──────
  //
  // app/api/cron/sales-checkins writes DRAFTS (the backlog: day 1, day 7,
  // the milestone approach) through lib/sales/checkin/materialise.js. It is
  // allowed to import that module and nothing else from the feature, and
  // that module is allowed to import nothing that sends. Asserted on the
  // import lines, not on prose.
  const BACKLOG_CRON = "app/api/cron/sales-checkins/route.js";
  const backlog = decomment(read(BACKLOG_CRON));
  const backlogImports = [...backlog.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
  ok("the backlog cron imports the materialiser", backlogImports.includes("@/lib/sales/checkin/materialise"), backlogImports);
  ok("…and no other module under lib/sales", backlogImports.filter((i) => /lib\/sales\//.test(i)).length === 1, backlogImports);
  ok("…and is guarded by requireCronSecret", /requireCronSecret\(request\)/.test(backlog) && /if \(denied\) return denied/.test(backlog));
  const materialise = decomment(read("lib/sales/checkin/materialise.js"));
  const materialiseImports = [...materialise.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
  ok("the materialiser imports neither store.js nor the sms path",
    materialiseImports.every((i) => !/checkin\/store|salesSms|twilio|sms\//.test(i)), materialiseImports);
  ok("…and writes only draft rows", /status: "draft"/.test(materialise) && !/status: "sent"/.test(materialise));
  ok("…and never marks anything sent", !/sentAt:\s*(now|new Date)/.test(materialise));
  const materialiseCronMentions = cronFiles.filter((f) => /checkin\/materialise/.test(decomment(read(f))));
  ok("exactly one cron reaches the materialiser", materialiseCronMentions.length === 1 && materialiseCronMentions[0] === BACKLOG_CRON, materialiseCronMentions);

  const vercel = read("vercel.json");
  ok("vercel.json schedules nothing under /api/sales", !/\/api\/sales/.test(vercel));
  const checkinSchedules = [...vercel.matchAll(/"path":\s*"([^"]*checkin[^"]*)"/gi)].map((m) => m[1]);
  ok("…and the only schedule named checkin is the backlog cron", checkinSchedules.length === 1 && checkinSchedules[0] === "/api/cron/sales-checkins", checkinSchedules);
  const schedule = /"\/api\/cron\/sales-checkins",\s*"schedule":\s*"([^"]+)"/.exec(vercel)?.[1];
  ok("…at 07:00 UTC daily, before any North American texting window opens", schedule === "0 7 * * *", schedule);
}

{
  // The client screen. No interval, no effect that sends: every path to the
  // carrier starts in an event handler.
  const page = decomment(read("app/sales/messages/page.js"));
  ok("the screen sets no interval", !/setInterval\s*\(/.test(page));
  // One setTimeout is allowed: the context pane's "Write a text" focuses
  // the box a tick after the phone sheet closes. It focuses; it sends
  // nothing — held to that by the assertion after it.
  const timeouts = [...page.matchAll(/setTimeout\s*\(/g)];
  ok("the screen sets no timeout, except the one that moves focus", timeouts.length === 1 && /document\.getElementById\("reply"\)/.test(page.slice(timeouts[0].index, timeouts[0].index + 400)) && !/fetchJson/.test(page.slice(timeouts[0].index, timeouts[0].index + 400)), timeouts.length);

  // The send URL appears, and only inside an onSend handler.
  ok("the screen knows the send route", /checkins\/\$\{[^}]+\}\/send/.test(page), "send URL");
  const effects = [...page.matchAll(/useEffect\s*\(/g)].map((m) => {
    const open = page.indexOf("(", m.index + m[0].length - 1);
    return page.slice(m.index, matchDelims(page, open) + 1);
  });
  ok("there are effects to scan", effects.length >= 2, effects.length);
  ok(
    "no effect reaches the send route",
    effects.every((e) => !/\/send/.test(e)),
    effects.filter((e) => /\/send/.test(e)).length,
  );

  const draftUi = decomment(read("app/sales/messages/CheckInDraft.js"));
  ok("the draft component fires its send from a click, not a mount",
    /onClick=\{\(\) => onSend\?\.\(\)\}/.test(draftUi));
  ok("…and has no effect that calls onSend", !/useEffect\([\s\S]{0,200}onSend/.test(draftUi));
}

{
  // The schema says the same thing in the place a future author will read it.
  const schema = read("prisma/schema.prisma");
  const model = schema.slice(schema.indexOf("model SalesCheckIn {"));
  const body = model.slice(0, model.indexOf("\n}\n") + 2);
  ok("the model exists", body.includes("scheduledFor"), body.length);
  ok("…and its status vocabulary has no 'scheduled' in it",
    !/status String @default\("scheduled"\)/.test(body) && !CHECKIN_STATUSES.includes("scheduled"),
    CHECKIN_STATUSES);
  ok("the three statuses are exactly draft, sent, dismissed",
    CHECKIN_STATUSES.join() === "draft,sent,dismissed", CHECKIN_STATUSES);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The claim before the send, and the revert after a refusal");
// ═══════════════════════════════════════════════════════════════════════════

/** A minimal Prisma stand-in that records every write. */
function stubClient(rows) {
  const writes = [];
  return {
    writes,
    salesCheckIn: {
      findFirst: async ({ where }) =>
        rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) || null,
      updateMany: async ({ where, data }) => {
        writes.push({ op: "updateMany", where, data });
        const hits = rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
        for (const row of hits) Object.assign(row, data);
        return { count: hits.length };
      },
      update: async ({ where, data }) => {
        writes.push({ op: "update", where, data });
        const row = rows.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    salesLead: { findMany: async () => [] },
    // The company row a draft is ABOUT, re-read by the send path so a demo
    // is refused on the row and not on a flag the request could carry.
    company: {
      findUnique: async ({ where }) => (where.id === "co_demo" ? { isDemo: true } : where.id ? { isDemo: false } : null),
    },
  };
}

const REP = { id: "rep_1", name: "Daniel", code: "DANIEL" };

{
  // A demo draft (the rows materialise.js writes on the rep's demo
  // company): SENT, simulated — decided on the company row re-read by the
  // send path, whatever the request says — with the same claim and the
  // same status flip as a real send, and NO carrier. The owner's ask on his
  // own demo thread: "the drafts that are created don't have a send button".
  const rows = [{ id: "ck_demo", salesRepId: "rep_1", companyId: "co_demo", origin: "demo", status: "draft", sendingStartedAt: null, toE164: "+16135550150", draftText: "Hi" }];
  const client = stubClient(rows);
  let delivered = 0;
  const result = await sendCheckIn({
    rep: REP, id: "ck_demo", client,
    deliver: async () => { delivered += 1; return { ok: true, messageId: "sms_never" }; },
  });
  ok("a demo company's draft is sent by the send path, marked as a demo", result.ok === true && result.demo === true, result);
  ok("…the row is marked sent", rows[0].status === "sent" && rows[0].sentAt instanceof Date, rows[0]);
  ok("…with NO message row to point at (nothing left the building)", rows[0].sentMessageId === null, rows[0].sentMessageId);
  ok("…the carrier stub was called ZERO times", delivered === 0, delivered);
  ok("…and the claim was taken first, as a compare-and-set",
    client.writes.some((w) => w.op === "updateMany" && w.where.sendingStartedAt === null && w.data.sendingStartedAt), client.writes);
  ok("…and nothing wrote a SalesSmsMessage", !("salesSmsMessage" in client));
  // A second press: already sent.
  const again = await sendCheckIn({ rep: REP, id: "ck_demo", client, deliver: async () => { delivered += 1; return { ok: true }; } });
  ok("a sent demo draft cannot be sent again", again.ok === false && again.status === 409 && delivered === 0, again);
}

{
  // The same simulated path when only the ORIGIN says demo — the company row
  // is what binds, but a row that calls itself a demo never reaches a carrier
  // either.
  const rows = [{ id: "ck_d2", salesRepId: "rep_1", companyId: "co_real", origin: "demo", status: "draft", sendingStartedAt: null, toE164: "+16135550150", draftText: "Hi" }];
  let delivered = 0;
  const result = await sendCheckIn({ rep: REP, id: "ck_d2", client: stubClient(rows), deliver: async () => { delivered += 1; return { ok: true }; } });
  ok("a row with origin demo is simulated even on a non-demo company id", result.ok === true && result.demo === true && delivered === 0, result);
}

{
  // The demo branch is decided on the ROW, not on anything the request
  // carries: the function takes no request, and the isDemo read is a fresh
  // findUnique on the company.
  const store = decomment(read(STORE));
  const fn = functionSource(store, SEND_FN);
  ok("the demo decision re-reads Company.isDemo", Boolean(fn) && /company\.findUnique\(\{ where: \{ id: row\.companyId \}, select: \{ isDemo: true \} \}\)/.test(fn));
  const sim = functionSource(store, "simulateDemoSend");
  ok("the simulated send exists", sim !== null);
  ok("…and never reaches deliverReplySms, sendSms or a message row",
    Boolean(sim) && !/deliverReplySms|sendSms|salesSmsMessage|twilio/i.test(sim), sim?.slice(0, 200));
}

{
  // A numberless draft (a company with no phone on record): refused in
  // words, with nothing claimed.
  const rows = [{ id: "ck_nn", salesRepId: "rep_1", companyId: "co_real", status: "draft", sendingStartedAt: null, toE164: null, draftText: "Hi" }];
  let delivered = 0;
  const result = await sendCheckIn({
    rep: REP, id: "ck_nn", client: stubClient(rows),
    deliver: async () => { delivered += 1; return { ok: true }; },
  });
  ok("a draft with no number is refused, naming the fix", result.ok === false && result.status === 409 && /number/i.test(result.error), result);
  ok("…without claiming the row", rows[0].sendingStartedAt === null);
  ok("…and without reaching the carrier", delivered === 0);
}

{
  const rows = [{ id: "ck_1", salesRepId: "rep_1", status: "draft", sendingStartedAt: null, toE164: "+15145550134", draftText: "Hi" }];
  const client = stubClient(rows);
  let delivered = 0;

  const result = await sendCheckIn({
    rep: REP,
    id: "ck_1",
    origin: "https://fieldquo.com",
    client,
    deliver: async () => {
      delivered += 1;
      // The claim must already be taken by the time the carrier is reached.
      ok("the row is claimed BEFORE anything leaves the building", rows[0].sendingStartedAt !== null);
      return { ok: true, messageId: "sms_1", sentAt: new Date() };
    },
  });

  ok("a good send succeeds", result.ok === true, result);
  ok("…the carrier was reached exactly once", delivered === 1, delivered);
  ok("…and the row is marked sent and linked to the message",
    rows[0].status === "sent" && rows[0].sentMessageId === "sms_1", rows[0]);

  // The claim is a compare-and-set, not a read-then-write.
  const claim = client.writes.find((w) => w.op === "updateMany" && w.data.sendingStartedAt);
  ok("the claim is a compare-and-set on an unclaimed draft",
    Boolean(claim) && claim.where.sendingStartedAt === null && claim.where.status === "draft",
    claim?.where);
}

{
  // Second press: the row is already sent.
  const rows = [{ id: "ck_1", salesRepId: "rep_1", status: "sent", sendingStartedAt: new Date(), toE164: "+15145550134", draftText: "Hi" }];
  let delivered = 0;
  const result = await sendCheckIn({
    rep: REP, id: "ck_1", client: stubClient(rows),
    deliver: async () => { delivered += 1; return { ok: true }; },
  });
  ok("a sent draft cannot be sent again", result.ok === false && result.status === 409, result);
  ok("…and the carrier was not reached", delivered === 0);
}

{
  // Two presses racing: the second finds the claim taken.
  const rows = [{ id: "ck_1", salesRepId: "rep_1", status: "draft", sendingStartedAt: new Date(), toE164: "+15145550134", draftText: "Hi" }];
  let delivered = 0;
  const result = await sendCheckIn({
    rep: REP, id: "ck_1", client: stubClient(rows),
    deliver: async () => { delivered += 1; return { ok: true }; },
  });
  ok("a draft already being sent refuses the second press", result.ok === false && result.status === 409, result);
  ok("…and sends nothing", delivered === 0);
}

{
  // The carrier refuses: the claim is handed back so the rep can retry.
  const rows = [{ id: "ck_1", salesRepId: "rep_1", status: "draft", sendingStartedAt: null, toE164: "+15145550134", draftText: "Hi" }];
  const result = await sendCheckIn({
    rep: REP, id: "ck_1", client: stubClient(rows),
    deliver: async () => ({ ok: false, status: 409, error: "They opted out.", suppressed: true }),
  });
  ok("a refused send is reported, not swallowed", result.ok === false && result.suppressed === true, result);
  ok("…the row is still a draft", rows[0].status === "draft", rows[0].status);
  ok("…and the claim was handed back", rows[0].sendingStartedAt === null, rows[0].sendingStartedAt);
}

{
  // Somebody else's draft.
  const rows = [{ id: "ck_1", salesRepId: "rep_OTHER", status: "draft", sendingStartedAt: null, toE164: "+1", draftText: "Hi" }];
  let delivered = 0;
  const result = await sendCheckIn({
    rep: REP, id: "ck_1", client: stubClient(rows),
    deliver: async () => { delivered += 1; return { ok: true }; },
  });
  ok("a draft belonging to another rep is not sendable", result.ok === false && result.status === 404, result);
  ok("…and nothing was sent", delivered === 0);
}

{
  // The send goes through the ONE function that carries every gate.
  const store = decomment(read(STORE));
  const fn = functionSource(store, SEND_FN);
  ok("the send path reaches the carrier through deliverReplySms",
    Boolean(fn) && /deliverReplySms/.test(fn), "deliverReplySms");
  ok("…and never calls sendSms itself", Boolean(fn) && !/\bsendSms\s*\(/.test(fn));
  ok("…re-reading the lead so the window is judged in the CONTRACTOR's zone",
    Boolean(fn) && /leadForThread\(/.test(fn));
  ok("…and never trusting a zone from the request", Boolean(fn) && !/request/.test(fn));

  // One engine draft per company per day.
  const key = engineDedupeKey({ companyId: "co_1", now: new Date("2026-09-10T23:00:00Z") });
  const same = engineDedupeKey({ companyId: "co_1", now: new Date("2026-09-10T01:00:00Z") });
  const next = engineDedupeKey({ companyId: "co_1", now: new Date("2026-09-11T01:00:00Z") });
  ok("the dedupe key is one per company per day", key === same && key !== next, [key, next]);
  ok("…and is null without a company", engineDedupeKey({}) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Suppression — the screen offers nothing and the server refuses");
// ═══════════════════════════════════════════════════════════════════════════

{
  // The readiness the GET renders from, executed with a suppressed contact.
  const suppressed = salesSmsReadiness({
    repName: "Daniel",
    signupLink: "https://fieldquo.com/signup?sales=DANIEL",
    fromNumber: "+15145550000",
    mailingAddress: "1 Rue Test, Montréal QC",
    twilioConfigured: true,
    leadPhone: "+15145550134",
    leadTimeZone: "America/Toronto",
    suppression: { suppressed: true, hit: { kind: "phone", value: "+15145550134" }, reason: "They replied STOP." },
    now: new Date("2026-09-10T15:00:00Z"),
  });
  ok("a suppressed contact cannot be sent to", suppressed.canSend === false);
  ok("…and the blocker is named 'suppressed'",
    suppressed.blockers.some((b) => b.code === "suppressed"), suppressed.blockers.map((b) => b.code));

  // An unreadable list is NOT "not suppressed".
  const unknown = salesSmsReadiness({
    repName: "Daniel", signupLink: "x", fromNumber: "+15145550000",
    mailingAddress: "1 Rue Test", twilioConfigured: true,
    leadPhone: "+15145550134", leadTimeZone: "America/Toronto",
    suppression: null, now: new Date("2026-09-10T15:00:00Z"),
  });
  ok("an unreadable do-not-contact list blocks the send too", unknown.canSend === false, unknown.blockers.map((b) => b.code));
}

{
  const page = decomment(read("app/sales/messages/page.js"));
  ok("the screen reads the server's suppression verdict",
    /const suppressed = Boolean\(thread\?\.suppressed\)/.test(page));

  // The composer lives in the ELSE branches of that ternary. Located by
  // brace matching rather than by "does the string appear", because the
  // whole point is WHERE it appears. The screen is a chat client now, so
  // the box is the kit's <Composer>, and an EMPTY thread gets the
  // signup-link panel instead (the reply route refuses a first contact by
  // design) — three branches, and the suppressed one is still the first
  // and still has no box of any kind in it.
  const marker = page.indexOf("{suppressed ? (");
  ok("the suppression branch is present", marker > 0, marker);
  const close = matchDelims(page, marker);
  ok("…and closes", close > marker);
  const ternary = page.slice(marker, close + 1);
  const split = ternary.indexOf(") : ");
  ok("…and has both halves", split > 0);
  const suppressedHalf = ternary.slice(0, split);
  const otherwiseHalf = ternary.slice(split);

  ok("a suppressed conversation renders NO compose box", !/<textarea/.test(suppressedHalf) && !/<Composer/.test(suppressedHalf));
  ok("…and no send control", !/onSend/.test(suppressedHalf) && !/<SignupLinkSms/.test(suppressedHalf));
  // The sentence moved into app/i18n/appMessages.js when the sales portal was
  // translated, so this matches the KEY the screen renders. The words are
  // still asserted — scripts/check-sales-portal-i18n.mjs section 6 holds the
  // English catalogue value to them, which is where they now live.
  ok("…and says why instead", /app\.salesText\.suppressed(Title|Body)/.test(suppressedHalf));
  ok("the compose box exists in the other half", /<Composer/.test(otherwiseHalf) && /textareaId="reply"/.test(otherwiseHalf));
  ok("…wired to the one send function", /onSend=\{send\}/.test(otherwiseHalf));
  ok("…as does the manual follow-up control", /app\.salesText\.parkOpen/.test(otherwiseHalf));
  // ── The first message is the rep's to pick (2026-09-18) ──────────────
  //
  // Until then an EMPTY thread got the signup-link panel and NOTHING that
  // took free text — the reply route refused a first contact. A company
  // that said "text me instead" needs a free-form first message, so the
  // route's rule is now "a lead behind the number" (asserted below on the
  // route) and the screen offers three: the signup link (the same panel,
  // capped and scrollable so its Send is never clipped), "as discussed"
  // and write-your-own (the ordinary composer, pre-focused). A number on
  // NOBODY's lead of the rep's gets the reason printed, never a box.
  ok("an empty thread on the rep's lead is a first contact", /const firstContact = Boolean\(\s*thread && thread\.lead && !\(thread\.messages \|\| \[\]\)\.length && !thread\.company && !thread\.draftCompany && !demoThread,?\s*\)/.test(page));
  ok("…with a picker of three, one of them write-your-own", /data-first-contact-picker=\{firstKind\}/.test(otherwiseHalf) && /\["own", PenLine/.test(otherwiseHalf) && /\["discussed", MessageSquare/.test(otherwiseHalf) && /\["signup", ExternalLink/.test(otherwiseHalf));
  ok("…the signup pick is the lead screen's own panel, in a capped scroller", /firstContact && firstKind === "signup" \? \(/.test(otherwiseHalf) && /max-h-\[70%\] shrink-0 overflow-y-auto[^>]*data-first-contact="signup"/.test(otherwiseHalf) && /<SignupLinkSms leadId=\{thread\.lead\.id\} inThread/.test(otherwiseHalf) && /import SignupLinkSms from "\.\.\/leads\/SignupLinkSms"/.test(page));
  ok("…and the other two picks are the ONE composer, wired to the one send", /autoFocus=\{firstContact\}/.test(otherwiseHalf) && (otherwiseHalf.match(/<Composer/g) || []).length === 1);
  ok("?compose=own opens on write-your-own, and the choice never survives into the URL", /composeParam === "own" \|\| composeParam === "discussed" \? composeParam : "signup"/.test(page) && /next\.delete\("compose"\)/.test(page));
  ok("\"as discussed\" loads the server's canned sentence into the box", /const entry = \(thread\?\.canned \|\| \[\]\)\.find\(\(c\) => c\.id === "discussed"\)/.test(page));
  // The no-lead branch: the reason, and the two ways in — never a box.
  const noLeadAt = otherwiseHalf.indexOf("length === 0 && !thread.lead ? (");
  const noLeadBranch = noLeadAt >= 0 ? otherwiseHalf.slice(noLeadAt, otherwiseHalf.indexOf(") : (", noLeadAt + 10)) : "";
  ok("a thread on nobody's lead of the rep's prints the reason and holds no box", noLeadBranch.length > 0 && !/<Composer/.test(noLeadBranch) && !/<textarea/.test(noLeadBranch) && /app\.salesText\.noLeadHeldBy/.test(noLeadBranch) && /app\.salesText\.noLeadNobody/.test(noLeadBranch), noLeadBranch.slice(0, 80));
  ok("…another rep's number says whose, from the server's holder read", /thread\.holder\?\.kind === "other"/.test(noLeadBranch) && /thread\.holder\.name/.test(noLeadBranch));
  ok("the save-as-lead href comes from the import-free builder, never callerLinks (which reaches lib/db)", /from "@\/lib\/sales\/calls\/callerHrefs"/.test(page) && !/callerLinks/.test(page) && !/^import/m.test(read("lib/sales/calls/callerHrefs.js")));
  ok("…nobody's offers \"Text this number now\" (startTextThread's door) and \"Save as a new lead\" (the leads page's ?new=1&phone= door)", /onClick=\{claimAndCompose\}/.test(noLeadBranch) && /href=\{newLeadHref\(openWith\)\}/.test(noLeadBranch) && /fetchJson\("\/api\/sales\/messages\/start", \{ method: "POST", body: \{ phone: openWith \} \}\)/.test(page));
  // The zone row: the readiness's own blocker answered in place, written
  // by Send through the lead route (never a second zone list here).
  ok("the time-zone blocker is answered by a row above the box, over the server's list", /const zoneAsked = Boolean\(zoneBlocker && thread\?\.lead\?\.id && Array\.isArray\(thread\?\.timeZones\)\)/.test(page) && /data-thread-zone-select/.test(otherwiseHalf) && /\(thread\.timeZones \|\| \[\]\)\.map/.test(otherwiseHalf));
  ok("…pre-filled with the area code's suggestion, said as a suggestion", /setZoneChoice\(\(current\) => current \|\| thread\?\.suggestedTimeZone\?\.timeZone \|\| ""\)/.test(page) && /app\.salesText\.zoneSuggested/.test(otherwiseHalf));
  ok("…and Send writes it on the lead BEFORE the text goes", (() => { const fn = page.slice(page.indexOf("async function send()")); const z = fn.indexOf("method: \"PATCH\",\n          body: { timeZone: zoneChoice }"); const p = fn.indexOf("fetchJson(\"/api/sales/messages\", {"); return z > 0 && p > z; })());

  // And the draft's own send button is withheld the same way — for a
  // suppressed thread only. A demo thread KEEPS its Send (the send path
  // simulates it), which is the whole point of the demo.
  ok("drafts are told whether a send is possible", /canSend=\{!suppressed\}/.test(page));
  ok("…and a demo thread is not what withholds it", !/canSend=\{!suppressed && !demoThread\}/.test(page));
  const draftUi = decomment(read("app/sales/messages/CheckInDraft.js"));
  ok("…and the draft withholds the button rather than disabling it",
    /canSend \? \(/.test(draftUi) && /app\.salesText\.sendNow/.test(draftUi));
}

{
  // ── The reply route's first-contact rule: a lead, not the link ────────
  //
  // Executed on the source, since the handler reaches the database: the
  // refusal fires only when the thread is empty AND no lead of the rep's
  // stands behind the number, after the lead lookup, with the one sentence
  // START_REFUSALS names — and the first text still goes through
  // deliverReplySms, whose body is replySmsBody's (the footer on every
  // message; asserted in check-sales-sms.mjs).
  const route = decomment(read("app/api/sales/messages/route.js"));
  const post = functionSource(route, "POST");
  ok("the reply route exports POST", post !== null);
  const leadAt = post.indexOf("const lead =");
  const refuseAt = post.indexOf("if (!existing.length && !lead) {");
  ok("a first text is refused only with no lead behind the number, decided AFTER the lead lookup", leadAt > 0 && refuseAt > leadAt, { leadAt, refuseAt });
  ok("…with START_REFUSALS.no_lead and its code, as a 409", /error: START_REFUSALS\.no_lead,\s*code: "no_lead",/.test(post) && /\{ status: 409 \}/.test(post.slice(refuseAt, refuseAt + 400)));
  ok("…and the old \"you have not texted this number before\" refusal is gone", !/not texted this number before/.test(route));
  const { START_REFUSALS: refusals } = await import("@/lib/sales/messages/startThread");
  ok("the sentence says what to do: save it as a lead", /Save it as a lead first/.test(refusals.no_lead));
  ok("a first text to a lead's number is delivered through deliverReplySms, whose body carries the footer", post.indexOf("await deliverReplySms({") > refuseAt);
}

{
  // The create route refuses a draft for a suppressed contact BEFORE writing.
  const route = decomment(read("app/api/sales/checkins/route.js"));
  const post = functionSource(route, "POST");
  ok("the create route exports POST", post !== null);

  // The GUARD, not the word. An earlier version of this assertion searched the
  // handler for "suppressed" and passed with the guard deleted, because
  // `fresh.decision?.suppressed?.text` a few lines further down satisfied the
  // match — the exact false-pass class this file's header warns about, caught
  // by mutation-testing rather than by reading.
  const guardAt = post.indexOf('b.code === "suppressed"');
  const returnAt = post.indexOf("suppressed: true }, { status: 409 }");
  const createAt = post.indexOf("createCheckIn(");
  ok("…and looks the contact up on the do-not-contact list", guardAt > 0, guardAt);
  ok("…and refuses with a 409 when it finds them", returnAt > 0, returnAt);
  ok(
    "…both BEFORE it writes a row",
    guardAt > 0 && returnAt > guardAt && createAt > returnAt,
    { guardAt, returnAt, createAt },
  );
  ok("…through the same readiness the send uses", /salesSmsStatus\(/.test(post));
  ok("…and re-decides the engine draft server-side rather than trusting the body",
    /suggestionForThread\(/.test(post));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The rep picks the moment, inside the texting window");
// ═══════════════════════════════════════════════════════════════════════════

const NOW = new Date("2026-09-10T15:00:00.000Z"); // 11:00 in Toronto
const TZ = "America/Toronto";

{
  const good = parseScheduleRequest({ raw: "2026-09-12T18:00:00.000Z", timeZone: TZ, now: NOW });
  ok("a Thursday afternoon is accepted", good.ok === true, good);

  const early = parseScheduleRequest({ raw: "2026-09-12T09:00:00.000Z", timeZone: TZ, now: NOW });
  ok("05:00 in their zone is refused", early.ok === false && early.code === "outside_window", early);
  ok("…with the next opening suggested", early.suggestion instanceof Date, early.suggestion);

  const late = parseScheduleRequest({ raw: "2026-09-13T02:30:00.000Z", timeZone: TZ, now: NOW });
  ok("22:30 in their zone is refused", late.ok === false && late.code === "outside_window", late);

  const past = parseScheduleRequest({ raw: "2026-09-09T18:00:00.000Z", timeZone: TZ, now: NOW });
  ok("a moment already gone is refused", past.ok === false && past.code === "in_past", past);

  const far = parseScheduleRequest({
    raw: new Date(NOW.getTime() + (MAX_HORIZON_DAYS + 1) * 86400000).toISOString(),
    timeZone: TZ, now: NOW,
  });
  ok("past the horizon is refused", far.ok === false && far.code === "too_far", far);

  const noZone = parseScheduleRequest({ raw: "2026-09-12T18:00:00.000Z", timeZone: null, now: NOW });
  ok("an unknown zone is refused, not guessed", noZone.ok === false && noZone.code === "zone_unknown", noZone);
  ok("…and no time is suggested for it", noZone.suggestion === null);

  const junk = parseScheduleRequest({ raw: "next tuesday-ish", timeZone: TZ, now: NOW });
  ok("rubbish is refused", junk.ok === false && junk.code === "unreadable", junk);

  // The boundary itself: 08:00 opens, 21:00 closes.
  const opens = parseScheduleRequest({ raw: "2026-09-12T12:00:00.000Z", timeZone: TZ, now: NOW });
  ok("08:00 exactly is inside the window", opens.ok === true, opens);
  const closes = parseScheduleRequest({ raw: "2026-09-13T01:00:00.000Z", timeZone: TZ, now: NOW });
  ok("21:00 exactly is outside it", closes.ok === false, closes);
  ok("the window this is judged against is the SMS one",
    SALES_SMS_WINDOW.startMinute === 8 * 60 && SALES_SMS_WINDOW.endMinute === 21 * 60, SALES_SMS_WINDOW);
}

{
  // The suggested default.
  const inside = defaultScheduleFor({ timeZone: TZ, now: NOW });
  ok("a due check-in inside the window is aimed at now", inside?.getTime() === NOW.getTime(), inside);

  const night = new Date("2026-09-11T05:00:00.000Z"); // 01:00 in Toronto
  const later = defaultScheduleFor({ timeZone: TZ, now: night });
  ok("…and one at one in the morning waits for the window", later > night, later);
  ok("…landing exactly at the opening", nextWindowOpening(night, TZ)?.getTime() === later?.getTime());

  ok("no zone means no suggested time, rather than a guessed one",
    defaultScheduleFor({ timeZone: null, now: NOW }) === null);
  ok("…and nextWindowOpening agrees", nextWindowOpening(NOW, null) === null);

  // A zone with no daylight saving, so the arithmetic cannot lean on an offset.
  const phoenixNight = new Date("2026-09-11T09:00:00.000Z"); // 02:00 in Phoenix
  const phoenix = nextWindowOpening(phoenixNight, "America/Phoenix");
  ok("a non-DST zone opens at its own 08:00", phoenix instanceof Date && phoenix > phoenixNight, phoenix);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The fence: which tables a rep's check-in routes may write");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("REP_CHECKIN_WRITES names exactly one model",
    Array.isArray(REP_CHECKIN_WRITES) && REP_CHECKIN_WRITES.length === 1 && REP_CHECKIN_WRITES[0] === "salesCheckIn",
    REP_CHECKIN_WRITES);

  const WRITE_OPS = "create|createMany|update|updateMany|upsert|delete|deleteMany";
  const WRITE_RE = new RegExp(`\\b(?:db|client|tx|prisma)\\.(\\w+)\\.(${WRITE_OPS})\\b`, "g");
  const written = new Set();
  for (const m of decomment(read(STORE)).matchAll(WRITE_RE)) written.add(m[1]);
  ok("the store writes only the model it declares",
    [...written].every((m) => REP_CHECKIN_WRITES.includes(m)), [...written]);
  ok("…and it does write it (the declaration is not stale)", written.has("salesCheckIn"));

  // The routes themselves write nothing directly — everything goes through the
  // store, which is where the fence is.
  for (const file of [
    "app/api/sales/checkins/route.js",
    "app/api/sales/checkins/[id]/route.js",
    SEND_ROUTE,
  ]) {
    const stray = [...decomment(read(file)).matchAll(WRITE_RE)].map((m) => `${m[1]}.${m[2]}`);
    ok(`${file} writes nothing directly`, stray.length === 0, stray);
    ok(`${file} goes through requireSmsRep`, /requireSmsRep\(request\)/.test(decomment(read(file))));
  }

  // The blanket rule is untouched.
  const gate = functionSource(decomment(read("lib/sales/gate.js")), "requireSalesRep");
  ok("lib/sales/gate.js still refuses every non-GET",
    Boolean(gate) && /isReadOnly\(request\.method\)/.test(gate));

  // And the neighbouring fence was not widened to make room.
  const { REP_SMS_WRITES } = await import("@/lib/sales/smsGate");
  ok("REP_SMS_WRITES was not widened to carry this feature",
    REP_SMS_WRITES.length === 2 && !REP_SMS_WRITES.includes("salesCheckIn"), REP_SMS_WRITES);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The lead behind a thread is matched on the NUMBER");
// ═══════════════════════════════════════════════════════════════════════════

{
  // The bug this replaced: the route asked for the rep's most recently updated
  // lead with any phone and then discarded it, so `lead` — and with it the
  // prospect's time zone — was almost always null, and the window check
  // refused nearly every send.
  const route = decomment(read("app/api/sales/messages/route.js"));
  const get = functionSource(route, "GET");
  const post = functionSource(route, "POST");
  ok("the messages route exports GET and POST", get !== null && post !== null);
  ok("GET no longer runs the phone-blind lead query",
    !/salesLead\.findFirst/.test(get), "salesLead.findFirst");
  ok("POST no longer runs it either", !/salesLead\.findFirst/.test(post));
  ok("GET resolves the thread through threadContext", /threadContext\(/.test(get));
  ok("POST resolves the lead through leadForThread", /leadForThread\(/.test(post));

  const store = decomment(read(STORE));
  const lookup = functionSource(store, "leadForThread");
  ok("…which compares NORMALISED numbers", Boolean(lookup) && /normalisePhone\(lead\.phone\) === other/.test(lookup));
  ok("…and is scoped to the rep", Boolean(lookup) && /salesRepId/.test(lookup));

  // The company behind a thread is re-checked against the rep's own book.
  const context = functionSource(store, "threadContext");
  ok("a thread's company is re-checked through assignedCompanyWhere",
    Boolean(context) && /assignedCompanyWhere\(salesRepId\)/.test(context));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Escalation renders only where a ticket could be raised");
// ═══════════════════════════════════════════════════════════════════════════

{
  const page = decomment(read("app/sales/messages/page.js"));
  const panel = functionSource(page, "EscalatePanel");
  ok("the escalation control is on the thread", panel !== null);
  ok("…and renders NOTHING without a company", Boolean(panel) && /if \(!company\) return null;/.test(panel));
  ok("…using the shared client rather than a hand-written fetch",
    Boolean(panel) && /raiseSupportTicket\(/.test(panel) && !/fetch\(/.test(panel));
  ok("…and shows the route's own status sentence, not an invented one",
    Boolean(panel) && /statusLine/.test(panel));
  ok("the panel is only given a company the server resolved",
    /company=\{thread\?\.company \|\| null\}/.test(page));

  // The GET only ever emits a company the rep is attributed to.
  const get = functionSource(decomment(read("app/api/sales/messages/route.js")), "GET");
  ok("…and the GET emits a company only from threadContext",
    /company: company \? \{ id: company\.id, name: company\.name \} : null/.test(get));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Absent is not empty");
// ═══════════════════════════════════════════════════════════════════════════

{
  const get = functionSource(decomment(read("app/api/sales/messages/route.js")), "GET");
  ok("the drafts read starts at null, not []", /let checkIns = null;/.test(get));
  ok("…and a failure leaves it null with a sentence beside it",
    /checkInError =/.test(get) && /catch \(err\)/.test(get));

  const page = decomment(read("app/sales/messages/page.js"));
  ok("the screen shows that sentence rather than an empty thread",
    /thread\?\.checkInError \?/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. Mobile and motion");
// ═══════════════════════════════════════════════════════════════════════════

{
  // check:mobile enforces the touch floor across app/sales at its strict tier;
  // this is the narrower promise the brief asked for, and the one it cannot
  // make: every spinner respects a reader who asked for less motion.
  for (const file of [
    "app/sales/messages/page.js",
    "app/sales/messages/MessageThread.js",
    "app/sales/messages/CheckInDraft.js",
  ]) {
    const src = decomment(read(file));
    const spinners = [...src.matchAll(/animate-spin[^"']*/g)].map((m) => m[0]);
    ok(`${file}: every spinner honours prefers-reduced-motion`,
      spinners.every((s) => s.includes("motion-reduce:animate-none")), spinners);
  }

  // The one input type that trips the iOS zoom rule if it is undersized.
  const draftUi = read("app/sales/messages/CheckInDraft.js");
  const dateInputs = [...draftUi.matchAll(/type="datetime-local"[\s\S]{0,300}?className="([^"]+)"/g)].map((m) => m[1]);
  ok("every datetime picker is at least 44px and 16px", dateInputs.length > 0 &&
    dateInputs.every((c) => c.includes("min-h-[44px]") && c.includes("text-base")), dateInputs);
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. A chat client, drawn with the kit");
// ═══════════════════════════════════════════════════════════════════════════

{
  const page = decomment(read("app/sales/messages/page.js"));
  for (const part of ["ChatLayout", "RoomList", "Thread", "Composer", "ContextBar"]) {
    ok(`the screen renders the kit's ${part}`, new RegExp(`<${part}[\\s>]`).test(page));
  }
  ok("…imported from the shared kit, not redrawn", /from "@\/app\/components\/chat"/.test(page));
  ok("the tour anchor survived the rebuild", /data-tour="sales-texts"/.test(page));
  ok("the list is bucketed by the pure grouping function", /groupConversations\(list \|\| \[\]\)/.test(page));
  ok("the thread rows come from layoutThread", /layoutThread\(\[\.\.\.messages, \.\.\.drafts, \.\.\.system, \.\.\.inFlight\]/.test(page));
  ok("…with the unread line drawn from the read instant BEFORE the read was recorded", /lastReadAt: openedReadAt/.test(page));
  ok("a deep link selects a thread", /params\.get\("thread"\)/.test(page));
  ok("…and a lead link resolves through the contacts route", /\/api\/sales\/messages\/contacts\?leadId=/.test(page));
  ok("the STOP tag is drawn from the server's verdict only", /\{suppressed && \([\s\S]{0,200}data-tag="stop"/.test(page));
  ok("the texting window tag is the server's, in their zone", /data-tag="window"/.test(page) && /thread\?\.window/.test(page));
  ok("the Call action opens the lead's gated dial region rather than a tel: link", /#lead-call/.test(page) && !/tel:/.test(page));
  ok("…and the lead screen has that anchor", /id="lead-call"/.test(decomment(read("app/sales/leads/[id]/page.js"))));
  ok("Mark done and Reopen go through the read route", /\/api\/sales\/messages\/read"[\s\S]{0,80}done/.test(page));
  ok("the composer's catalogue is the server's, titled in the rep's language", /thread\?\.canned/.test(page) && /t\(c\.titleKey, c\.title\)/.test(page));
  ok("Tab loads the pending draft into the box", /onHintAccept=/.test(page) && /setLoadedDraftId\(pendingDraft\.id\)/.test(page));
  ok("…and sending it then goes through the draft's OWN send route", /checkins\/\$\{loadedDraftId\}\/send/.test(page));
  ok("the New message picker exists", /function NewMessagePicker/.test(page) && /data-new-message-button/.test(page));
  ok("…searches the contacts route", /\/api\/sales\/messages\/contacts\?q=/.test(page));
  ok("…and starts a typed number through the start route", /\/api\/sales\/messages\/start/.test(page));

  // The one timer is in its own file, and it reads.
  const hook = decomment(read("app/sales/messages/useThreadRefresh.js"));
  ok("the refresh hook sets an interval", /setInterval\(/.test(hook));
  ok("…and clears it", /clearInterval\(/.test(hook));
  ok("…stops while the tab is hidden", /visibilityState === "visible"/.test(hook));
  ok("…never fetches, posts or names a route itself", !/fetch/.test(hook) && !/POST/.test(hook) && !/\/api\//.test(hook) && !/send/i.test(hook.replace(/\/\/.*$/gm, "")));
  const refreshCall = page.match(/useThreadRefresh\(openWith, \(\) => \{[\s\S]{0,200}?\}\);/);
  ok("the screen hands it a GET and nothing else", Boolean(refreshCall) && /loadThread\(openWith, \{ quiet: true \}\)/.test(refreshCall[0]) && !/send|POST|checkins/.test(refreshCall[0]), refreshCall?.[0]);

  // The kit's own check runs in check:all.
  const pkg = read("package.json");
  ok("check:chat-kit is wired into check:all", /npm run check:chat-kit/.test(pkg));
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. The four groups, executed");
// ═══════════════════════════════════════════════════════════════════════════

{
  const { groupConversations, groupOf, GROUP_ORDER, isThreadDone } = await import("@/lib/sales/messages/rooms");
  ok("the order is needs a reply · waiting · drafts · done", GROUP_ORDER.join() === "needsReply,waiting,drafts,done", GROUP_ORDER);
  const theirs = { e164: "+1", lastDirection: "in", lastInboundAt: "2026-09-11T10:00:00Z", openDrafts: 0, readState: null, lastAt: "2026-09-11T10:00:00Z" };
  const ours = { e164: "+2", lastDirection: "out", lastInboundAt: "2026-09-10T10:00:00Z", openDrafts: 0, readState: null, lastAt: "2026-09-11T09:00:00Z" };
  const drafted = { ...ours, e164: "+3", openDrafts: 1 };
  const filed = { ...theirs, e164: "+4", readState: { readAt: "2026-09-11T11:00:00Z", doneAt: "2026-09-11T11:00:00Z" } };
  const revived = { ...filed, e164: "+5", lastInboundAt: "2026-09-11T12:00:00Z", lastAt: "2026-09-11T12:00:00Z" };
  ok("their last word → needs a reply", groupOf(theirs) === "needsReply");
  ok("our last word → waiting", groupOf(ours) === "waiting");
  ok("our last word with a draft → drafts due", groupOf(drafted) === "drafts");
  ok("their last word with a draft → still needs a reply (a person outranks a draft)", groupOf({ ...theirs, openDrafts: 1 }) === "needsReply");
  ok("filed after their last word → done", groupOf(filed) === "done");
  ok("…and a reply after the filing brings it back", groupOf(revived) === "needsReply");
  ok("done with a draft is still done", groupOf({ ...filed, openDrafts: 2 }) === "done");
  ok("isThreadDone with no filing is false", isThreadDone(null, "2026-09-11T10:00:00Z") === false);
  ok("isThreadDone with a filing and no inbound ever is true", isThreadDone({ doneAt: "2026-09-11T11:00:00Z" }, null) === true);
  const groups = groupConversations([ours, theirs, drafted, filed, revived, null]);
  ok("every bucket is present even when empty", Object.keys(groups).join() === GROUP_ORDER.join());
  ok("rubbish rows are dropped, not crashed on", groups.needsReply.length === 2 && groups.waiting.length === 1);
  ok("newest activity first inside a bucket", groups.needsReply.map((c) => c.e164).join() === "+5,+1");
  ok("null unread stays null through the route's shaping (absence, not zero)",
    /unread: readStates \? 0 : null/.test(decomment(read("lib/sales/salesSms.js"))));

  // ── A thread that exists only as a draft ────────────────────────────
  //
  // The shape app/api/sales/messages/route.js builds for a company the
  // backlog drafted for and nobody has texted (Easy Roofers Inc. on
  // 2026-09-12): no message rows, `lastDirection: "out"`, one open draft.
  // It must land in "Drafts due" and nowhere else — a company nobody has
  // written to is not waiting on a reply from anybody.
  const draftOnly = { e164: "+6", lastDirection: "out", lastInboundAt: null, openDrafts: 1, readState: null, lastAt: "2026-09-12T13:00:00Z", draftOnly: true, name: "Easy Roofers Inc." };
  ok("a draft-only thread files under drafts due", groupOf(draftOnly) === "drafts");
  ok("…not under needs a reply", groupOf(draftOnly) !== "needsReply");
  const route = decomment(read("app/api/sales/messages/route.js"));
  ok("the list route adds a conversation for every open draft whose number has no message row",
    /for \(const \[e164, draft\] of drafts\)/.test(route) && /if \(seen\.has\(e164\)\) continue/.test(route) && /draftOnly: true/.test(route));
  ok("…with lastDirection out, so the rooms rule cannot read it as theirs", /lastDirection: "out",\s*leadId: null/.test(route));
  ok("…and named by the draft's company or lead", /name: draft\.name/.test(route));
  ok("the list runs the backlog before it is drawn", /await materialiseCheckInsForRep\(\{ salesRepId: rep\.id \}\)/.test(route));
  ok("…and the demo fixture beside it", /await materialiseDemoCheckIn\(\{ salesRepId: rep\.id \}\)/.test(route));
  ok("…failing soft into draftsError, not into a 500", /backlogError = /.test(route) && /draftsError: draftsError \|\| backlogError/.test(route));
  ok("the thread refuses the composer on a demo", /canSend: demoThread \? false/.test(route));
  const byThread = decomment(read("lib/sales/checkin/store.js"));
  ok("a numberless draft never becomes a thread", /if \(!r\.toE164\) continue/.test(byThread));
  const page = decomment(read("app/sales/messages/page.js"));
  ok("the screen never prints \"You:\" over a draft-only thread", /c\.draftOnly\s*\?\s*t\("app\.salesText\.draftWaitingSubtitle"\)/.test(page));
  ok("…marks a demo thread as one in the list", /c\.isDemo \? t\("app\.salesPortal\.demoBadge"\)/.test(page));
  ok("…and offers Send on a demo draft (simulated by the send path)", (page.match(/canSend=\{!suppressed\}/g) || []).length === 2);
  // The demo marker rides under the body the kind chip draws (bodyWithKind),
  // so one renderBody serves both: the chip above, the "demo" line below.
  ok("…marks a demo's sent bubble as one, in words", /app\.salesText\.demoSentMarker/.test(page) && /renderBody=\{\(m\) =>\s*bodyWithKind\(\s*m,\s*m\.demo \?/.test(page));
  ok("…and never draws the free-text composer on a demo thread", /thread && demoThread \? \(/.test(page));
  // The thread keeps saying it is a demo AFTER the send, when no draft is
  // left to say so — read off the sent rows.
  ok("the route reads demo-ness off sent rows too", /\(pastCheckIns \|\| \[\]\)\.some\(\(c\) => c\.origin === "demo"\)/.test(route));
  ok("…and draws the sent demo check-ins as the thread's messages", /sentDemoCheckIns\(/.test(route) && /messages: threadMessages/.test(route));
  ok("…and keeps the demo thread in the list after its send", /sentDemoByThread\(/.test(route));
  ok("…and does not offer the signup link to a company that already signed up",
    /thread\.company \|\| thread\.draftCompany\) \? \(/.test(page) && page.indexOf("thread.draftCompany) ? (") < page.indexOf("&& !thread.lead ? (") && /!thread\.company && !thread\.draftCompany && !demoThread/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
section("13. Read markers: the rep's own table, behind the outreach gate");
// ═══════════════════════════════════════════════════════════════════════════

{
  const { REP_THREAD_READ_WRITES } = await import("@/lib/sales/messages/readState");
  ok("the read store declares one model", REP_THREAD_READ_WRITES.join() === "salesSmsThreadRead");
  const store = decomment(read("lib/sales/messages/readState.js"));
  const written = new Set([...store.matchAll(/client\.([a-zA-Z]+)\.(create|update|updateMany|upsert|delete|deleteMany|createMany)\b/g)].map((m) => m[1]));
  ok("…and writes only that model", [...written].every((m) => REP_THREAD_READ_WRITES.includes(m)), [...written]);
  ok("…never deleting", !/\.delete/.test(store));
  ok("the clock is the server's, never the request's", /at = new Date\(\)/.test(store));
  const route = decomment(read("app/api/sales/messages/read/route.js"));
  ok("the read route exports POST behind requireOutreachRep", /export async function POST/.test(route) && /requireOutreachRep\(request\)/.test(route));
  ok("…goes through the store", /markThreadRead\(/.test(route) && /markThreadDone\(/.test(route));
  ok("…and writes nothing directly", !/\bdb\.[a-zA-Z]+\.(create|update|upsert|delete)/.test(route));
  ok("…and sends nothing", !/sendSms|deliver|twilio/i.test(route));
  ok("the schema has the table, keyed by rep and number", /model SalesSmsThreadRead \{[\s\S]*?@@unique\(\[salesRepId, e164\]\)/.test(read("prisma/schema.prisma")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("14. New text to a number: Canada and the US, nobody else's, no duplicate");
// ═══════════════════════════════════════════════════════════════════════════

{
  const { judgeNewTextNumber, startTextThread, START_REFUSALS } = await import("@/lib/sales/messages/startThread");
  ok("+1 514 (Montréal) is accepted as CA", judgeNewTextNumber("+1 514 555 0134").ok === true && judgeNewTextNumber("+1 514 555 0134").country === "CA");
  ok("+1 405 (Oklahoma) is accepted as US", judgeNewTextNumber("(405) 555-0132").country === "US");
  ok("+1 787 (Puerto Rico) is accepted as US", judgeNewTextNumber("+17875550100").country === "US");
  ok("+1 809 (Dominican Republic) is refused", judgeNewTextNumber("+1 809 555 0123").code === "outside_us_ca");
  ok("+1 876 (Jamaica) is refused", judgeNewTextNumber("+18765550100").code === "outside_us_ca");
  ok("+44 is refused", judgeNewTextNumber("+44 20 7946 0958").ok === false && /Canadian and US/.test(judgeNewTextNumber("+44 20 7946 0958").error));
  ok("rubbish is refused, not guessed", judgeNewTextNumber("call me").code === "unreadable" && judgeNewTextNumber("").ok === false);
  ok("the refusal sentence is the owner's", START_REFUSALS.outside_us_ca === "Texting is available for Canadian and US numbers only.");

  // A fake client, in memory, so the rules are EXECUTED: suppression first
  // and no row on a refusal; another rep's number refused; one lead per
  // unknown number.
  const fake = ({ suppressed = [], leads = [], prospects = [], numbers = [] } = {}) => {
    const created = [];
    return {
      created,
      leads,
      salesSuppression: {
        findMany: async ({ where }) => suppressed.filter((s) => where.OR.some((k) => k.kind === s.kind && k.value === s.value)),
      },
      salesLead: {
        findMany: async ({ where }) => leads.filter((l) => (l.phone || "").includes(where.phone.contains)),
        create: async ({ data }) => { const row = { id: `lead${created.length + 1}`, ...data }; created.push(row); leads.push({ ...row, salesRep: { name: "Me" } }); return row; },
      },
      prospect: { findFirst: async ({ where }) => prospects.find((p) => p.phoneE164 === where.phoneE164) || null },
      salesContactNumber: { findMany: async ({ where }) => numbers.filter((n) => n.e164 === where.e164) },
      salesRep: { findUnique: async ({ where }) => ({ name: where.id === "rep_b" ? "Priya N." : "Me" }) },
    };
  };
  const rep = { id: "rep_a", name: "Rachel" };

  {
    const client = fake({ suppressed: [{ kind: "phone", value: "+15145550134", channels: ["sms", "phone"], source: "sms_stop", removedAt: null, retainUntil: new Date(Date.now() + 1e9) }] });
    const r = await startTextThread(client, { rep, raw: "+1 514 555 0134" });
    ok("a suppressed number is refused", r.ok === false && r.code === "suppressed", r);
    ok("…before any lead is created", client.created.length === 0);
  }
  {
    const client = fake({ leads: [{ id: "L9", phone: "(514) 555-0199", salesRepId: "rep_b", businessName: "Theirs", salesRep: { name: "Priya N." } }] });
    const r = await startTextThread(client, { rep, raw: "+15145550199" });
    ok("a number on another rep's lead is refused, naming them", r.ok === false && r.code === "held_by_other" && /Priya N\./.test(r.error), r);
    ok("…and no lead is created", client.created.length === 0);
  }
  {
    const client = fake({ prospects: [{ id: "P1", phoneE164: "+15145550177", businessName: "Claimed Co", assignedRepId: "rep_b" }] });
    const r = await startTextThread(client, { rep, raw: "+15145550177" });
    ok("a number on a prospect claimed by another rep is refused too", r.ok === false && r.code === "held_by_other" && /Priya N\./.test(r.error), r);
  }
  {
    const client = fake({ leads: [{ id: "L1", phone: "514-555-0134", salesRepId: "rep_a", businessName: "Mine", salesRep: { name: "Me" } }] });
    const r = await startTextThread(client, { rep, raw: "+1 (514) 555-0134" });
    ok("the rep's own lead opens its thread", r.ok === true && r.leadId === "L1" && r.created === false, r);
  }
  {
    const client = fake();
    const first = await startTextThread(client, { rep, raw: "+1 514 555 0134" });
    ok("an unknown number creates one lead, owned by the rep, with only the number", first.ok === true && first.created === true && client.created.length === 1 && client.created[0].salesRepId === "rep_a" && client.created[0].phone === "+15145550134" && client.created[0].businessName === "" && client.created[0].country === "CA", client.created[0]);
    const second = await startTextThread(client, { rep, raw: "514 555 0134" });
    ok("…and a second attempt reuses it", second.ok === true && second.created === false && second.leadId === first.leadId && client.created.length === 1, second);
  }
  {
    const client = fake();
    const r = await startTextThread(client, { rep, raw: "+1 809 555 0123" });
    ok("a Dominican number never reaches the database", r.ok === false && client.created.length === 0);
  }

  const route = decomment(read("app/api/sales/messages/start/route.js"));
  ok("the start route exports POST behind requireOutreachRep", /export async function POST/.test(route) && /requireOutreachRep\(request\)/.test(route));
  ok("…decides through startTextThread and writes nothing itself", /startTextThread\(db, \{ rep, raw, leadId \}\)/.test(route) && !/\bdb\.[a-zA-Z]+\./.test(route));
  ok("…and the leadId hint is an id off the body, re-read against the rep inside startTextThread", /const leadId = typeof body\?\.leadId === "string"/.test(route) && /where: \{ id: leadId, salesRepId: rep\.id \}/.test(read("lib/sales/messages/startThread.js")));
  ok("…and sends nothing", !/sendSms|deliver/.test(route));
  const lib = decomment(read("lib/sales/messages/startThread.js"));
  ok("the lead is created through the shared create", /createSalesLead\(client/.test(lib) && !/salesLead\.create/.test(lib));
  ok("…which the leads route uses too", /createSalesLead\(db/.test(decomment(read("app/api/sales/leads/route.js"))));
  const contacts = decomment(read("app/api/sales/messages/contacts/route.js"));
  ok("the picker's search is scoped to the rep's leads", /salesRepId: rep\.id/.test(contacts));
  ok("…and to prospects they hold, through queueWhere", /queueWhere\(rep\.id\)/.test(contacts));
  ok("…and never returns a do-not-contact business", /doNotContactAt: null/.test(contacts));
}


// ═══════════════════════════════════════════════════════════════════════════
section("15. Every text sent to a business ends up in its conversation");
// ═══════════════════════════════════════════════════════════════════════════

{
  const { salesConversations, salesThread, handleSalesInboundSms, deliverReplySms } = await import("@/lib/sales/salesSms");
  const { businessKeyOf, mergeThreadsByBusiness, mergeReadStates, leadsOnNumber } = await import("@/lib/sales/messages/business");
  const { resolveBusiness } = await import("@/lib/sales/messages/businessResolve");
  const { outboundKind, MESSAGE_KIND_LABEL_KEYS, KIND_SIGNUP_LINK, KIND_CHECKIN, KIND_REPLY, KIND_SIGNUP_NUDGE } = await import("@/lib/sales/messages/messageKind");
  const { sentDemoCheckIns } = await import("@/lib/sales/checkin/store");
  const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");

  const T0 = new Date("2026-09-14T14:00:00Z");
  const later = (m) => new Date(T0.getTime() + m * 60_000);
  const normalise = (v) => String(v || "").replace(/\D/g, "").replace(/^1?(\d{10})$/, "+1$1");

  /** Matches Prisma's `{ in }`, `{ not }`, `{ contains }` and equality for the fields these reads use. */
  const hit = (row, where) => {
    if (!where) return true;
    for (const [k, v] of Object.entries(where)) {
      if (k === "OR") { if (!v.some((w) => hit(row, w))) return false; continue; }
      if (k === "AND") { if (!v.every((w) => hit(row, w))) return false; continue; }
      const actual = row[k];
      if (v && typeof v === "object" && !(v instanceof Date)) {
        if ("in" in v && !v.in.includes(actual)) return false;
        if ("not" in v && (v.not === null ? actual == null : actual === v.not)) return false;
        if ("contains" in v && !String(actual || "").includes(v.contains)) return false;
        continue;
      }
      if (actual !== v) return false;
    }
    return true;
  };
  const sortBy = (rows, orderBy) => {
    if (!orderBy) return rows;
    const [[field, dir]] = Object.entries(orderBy);
    return [...rows].sort((a, b) => (dir === "desc" ? 1 : -1) * (new Date(b[field] || 0) - new Date(a[field] || 0)));
  };

  /** An in-memory Prisma for the four tables a conversation is read from. */
  function fakeDb({ leads = [], messages = [], checkIns = [], contactNumbers = [], numbers = [] } = {}) {
    const leadById = (id) => leads.find((l) => l.id === id) || null;
    const withLead = (m) => ({ ...m, lead: m.leadId ? leadById(m.leadId) : null, checkIn: checkIns.find((c) => c.sentMessageId === m.id) || null });
    let seq = 0;
    const db = {
      leads, messages, checkIns, contactNumbers,
      writes: [],
      salesLead: {
        findMany: async ({ where, orderBy, take }) => sortBy(leads.filter((l) => hit(l, where)), orderBy).slice(0, take || 999),
        findFirst: async ({ where, orderBy }) => sortBy(leads.filter((l) => hit(l, where)), orderBy)[0] || null,
      },
      salesSmsMessage: {
        findMany: async ({ where, orderBy, take }) => sortBy(messages.filter((m) => hit(m, where)), orderBy).slice(0, take || 999).map(withLead),
        findFirst: async ({ where, orderBy }) => { const r = sortBy(messages.filter((m) => hit(m, where)), orderBy)[0]; return r ? withLead(r) : null; },
        create: async ({ data }) => { const row = { id: `m${++seq}`, sentAt: data.sentAt || later(seq), ...data }; messages.push(row); db.writes.push({ op: "create", data }); return row; },
        updateMany: async ({ where, data }) => { const rows = messages.filter((m) => hit(m, where)); for (const r of rows) Object.assign(r, data); db.writes.push({ op: "updateMany", where, data }); return { count: rows.length }; },
      },
      salesCheckIn: {
        findMany: async ({ where, orderBy }) => sortBy(checkIns.filter((c) => hit(c, where)), orderBy),
        findFirst: async ({ where, orderBy }) => sortBy(checkIns.filter((c) => hit(c, where)), orderBy)[0] || null,
      },
      salesContactNumber: {
        findMany: async ({ where }) => contactNumbers.filter((n) => hit(n, where)),
        findFirst: async ({ where }) => contactNumbers.find((n) => hit(n, where)) || null,
      },
      platformSmsNumber: { findFirst: async ({ where }) => numbers.find((n) => hit(n, where)) || null },
      salesRep: { findMany: async () => [] },
    };
    return db;
  }

  const REP_A = "rep_a";
  // One contractor, two numbers: the lead's own (the shop) and the owner's
  // cell a rep was given on a call, stored as a SalesContactNumber.
  const SHOP = "+15145550134";
  const CELL = "+15145550199";
  const LEAD = { id: "L1", salesRepId: REP_A, businessName: "Loop Inc", contactName: "Marc", phone: "(514) 555-0134", convertedCompanyId: null, prospectId: "P1", province: "QC", country: "CA", timeZone: null, status: "contacted", email: null, updatedAt: T0 };

  // ── 1. The signup link, and the link to their OTHER number ──────────────
  {
    const db = fakeDb({
      leads: [LEAD],
      contactNumbers: [{ id: "n1", salesLeadId: "L1", prospectId: null, e164: CELL, kind: "mobile", canText: true }],
      messages: [
        { id: "m1", direction: "out", salesRepId: REP_A, leadId: "L1", fromE164: "+15145550111", toE164: SHOP, body: "Hi, it is Rachel from FieldQuo. Here is the link to get started: https://fieldquo.com/signup?sales=RACHEL", sentAt: later(0) },
        { id: "m2", direction: "out", salesRepId: REP_A, leadId: "L1", fromE164: "+15145550111", toE164: CELL, body: "Hi, it is Rachel from FieldQuo. Here is the link to get started: https://fieldquo.com/signup?sales=RACHEL", sentAt: later(5) },
      ],
    });
    const list = await salesConversations({ salesRepId: REP_A, client: db });
    ok("PATH 1 · the signup link and the link to a different number are ONE conversation for the business",
      list.length === 1 && list[0].name === "Loop Inc", list.map((c) => [c.e164, c.name]));
    ok("…with both numbers listed inside it, latest first",
      list[0]?.numbers?.map((n) => n.e164).join(",") === `${CELL},${SHOP}`, list[0]?.numbers);
    ok("…keyed on the business, not the number", list[0]?.businessKey === "prospect:P1", list[0]?.businessKey);
    ok("…and its message count is both texts", list[0]?.count === 2, list[0]?.count);
    // Opened from EITHER number, the thread is the whole conversation.
    const fromCell = await resolveBusiness({ salesRepId: REP_A, withE164: CELL, client: db });
    ok("…opened from the cell, the business resolves to the lead and both numbers", fromCell.lead?.id === "L1" && fromCell.numbers.includes(SHOP) && fromCell.numbers.includes(CELL), fromCell);
    const thread = await salesThread({ salesRepId: REP_A, withE164: CELL, numbers: fromCell.numbers, client: db });
    ok("…and the thread read from the cell holds the shop-line text too", thread.length === 2, thread.map((m) => m.toE164));
    ok("…each bubble chipped as the signup link", thread.every((m) => m.kind === KIND_SIGNUP_LINK && m.kindLabelKey === "app.salesText.cannedSignupTitle"), thread.map((m) => m.kind));
    // The write itself: the signup-link send files the row on the lead, and
    // the route hands the chosen number to it with the lead intact.
    const smsLib = decomment(read("lib/sales/salesSms.js"));
    const signup = functionSource(smsLib, "deliverSignupLinkSms");
    ok("…because deliverSignupLinkSms writes leadId: lead.id on the row", Boolean(signup) && /leadId: lead\.id/.test(signup));
    const smsRoute = decomment(read("app/api/sales/sms/route.js"));
    ok("…and the send route keeps the lead and swaps only the number", /lead: \{ \.\.\.lead, phone: chosen\.e164 \}/.test(smsRoute));
  }

  // ── 2. The engine's check-in on a company that signed up from the link ──
  {
    // The company's lead (materialise.js ensureLead wrote it, named after the
    // company, pointing at it) carries the cell; the backlog aimed the day-1
    // draft at the company's own shop line. No lead matches the SHOP number.
    const COMPANY_LEAD = { ...LEAD, id: "L_co", phone: CELL, businessName: "Easy Roofers Inc", convertedCompanyId: "co_1", prospectId: null, updatedAt: later(1) };
    const rows = [{ id: "ck1", salesRepId: REP_A, companyId: "co_1", leadId: "L_co", origin: "engine", status: "draft", sendingStartedAt: null, toE164: SHOP, draftText: "Day 1 — any questions?", dedupeKey: "scheduled:co_1:1" }];
    const db = fakeDb({ leads: [COMPANY_LEAD], checkIns: rows });
    db.salesCheckIn.updateMany = async ({ where, data }) => { const hits = rows.filter((r) => hit(r, where)); for (const r of hits) Object.assign(r, data); return { count: hits.length }; };
    db.salesCheckIn.update = async ({ where, data }) => { const r = rows.find((x) => x.id === where.id); Object.assign(r, data); return r; };
    db.company = { findUnique: async () => ({ isDemo: false }) };
    let handed = null;
    const result = await sendCheckIn({
      rep: { id: REP_A, name: "Rachel" }, id: "ck1", client: db, now: T0,
      deliver: async (args) => {
        handed = args;
        const row = await db.salesSmsMessage.create({ data: { direction: "out", salesRepId: REP_A, leadId: args.lead?.id || null, fromE164: "+15145550111", toE164: args.lead.phone, body: args.text, sentAt: T0 } });
        return { ok: true, messageId: row.id, sentAt: T0 };
      },
    });
    ok("PATH 2 · a company check-in whose number is on no lead still sends with the ROW's lead", result.ok === true && handed?.lead?.id === "L_co", { result, lead: handed?.lead });
    ok("…to the draft's number, judged in the lead's province", handed?.lead?.phone === SHOP && handed?.lead?.province === "QC", handed?.lead);
    ok("…and the sent row points at the message", rows[0].status === "sent" && rows[0].sentMessageId === "m1", rows[0]);
    const list = await salesConversations({ salesRepId: REP_A, client: db });
    ok("…so the conversation exists, named after the company, keyed on it", list.length === 1 && list[0].name === "Easy Roofers Inc" && list[0].businessKey === "company:co_1", list);
    const thread = await salesThread({ salesRepId: REP_A, withE164: SHOP, numbers: [SHOP, CELL], client: db });
    ok("…and the bubble is chipped \"Day 1 check-in\"", thread[0]?.kind === KIND_CHECKIN && thread[0]?.kindLabelKey === "app.salesCheckin.touchpoint.day" && thread[0]?.kindParams?.day === 1, thread[0]);
    // Every kind the engine can produce has a label in every catalogue.
    for (const lang of Object.keys(APP_MESSAGES)) {
      ok(`…every kind label exists in ${lang}`, MESSAGE_KIND_LABEL_KEYS.every((k) => typeof APP_MESSAGES[lang][k] === "string" && APP_MESSAGES[lang][k].length > 0), MESSAGE_KIND_LABEL_KEYS.filter((k) => !APP_MESSAGES[lang][k]));
    }
    ok("…the day-7 key, the milestone, the signup nudge and a manual follow-up each get their own chip",
      outboundKind({ direction: "out", body: "x", checkIn: { dedupeKey: "scheduled:c:7" } }).params.day === 7 &&
      outboundKind({ direction: "out", body: "x", checkIn: { dedupeKey: "scheduled:c:retention" } }).labelKey === "app.salesCheckin.touchpoint.retention" &&
      outboundKind({ direction: "out", body: "x https://fieldquo.com/signup?sales=R", checkIn: { dedupeKey: "signup:p:2h" } }).kind === KIND_SIGNUP_NUDGE &&
      outboundKind({ direction: "out", body: "x", checkIn: { dedupeKey: null, origin: "manual" } }).labelKey === "app.salesCheckin.touchpoint.manual");
    ok("…and an inbound row has no kind of ours", outboundKind({ direction: "in", body: "STOP" }) === null);
    // The materialiser gives a company with no lead one, named after it.
    const mat = decomment(read("lib/sales/checkin/materialise.js"));
    const ensure = functionSource(mat, "ensureLead");
    ok("…the backlog creates the company's lead (businessName: company.name, convertedCompanyId)", Boolean(ensure) && /businessName: company\.name/.test(ensure) && /convertedCompanyId: company\.id/.test(ensure));
    const store = decomment(read(STORE));
    const send = functionSource(store, SEND_FN);
    ok("…and sendCheckIn falls back to the row's leadId, scoped to the rep", Boolean(send) && /where: \{ id: row\.leadId, salesRepId: rep\.id \}/.test(send));
  }

  // ── 3. A reply typed in the composer ────────────────────────────────────
  {
    const db = fakeDb({
      leads: [LEAD],
      messages: [
        { id: "m1", direction: "out", salesRepId: REP_A, leadId: "L1", fromE164: "+15145550111", toE164: SHOP, body: "link https://fieldquo.com/signup?sales=RACHEL", sentAt: later(0) },
        { id: "m2", direction: "in", salesRepId: REP_A, leadId: "L1", fromE164: SHOP, toE164: "+15145550111", body: "sure, Thursday", sentAt: later(3) },
        { id: "m3", direction: "out", salesRepId: REP_A, leadId: "L1", fromE164: "+15145550111", toE164: SHOP, body: "Thursday it is. Reply STOP to opt out.", sentAt: later(4) },
      ],
    });
    const thread = await salesThread({ salesRepId: REP_A, withE164: SHOP, client: db });
    ok("PATH 3 · a typed reply threads into the same conversation, oldest first", thread.map((m) => m.id).join(",") === "m1,m2,m3");
    ok("…chipped as a plain reply — carried in data, drawn as no chip", thread[2].kind === KIND_REPLY && thread[2].kindLabelKey === "app.salesText.kindReply", thread[2]);
    const page = decomment(read("app/sales/messages/page.js"));
    ok("…which the screen honours: KindChip draws nothing for `reply`", /function KindChip/.test(page) && /item\.textKind === "reply"\) return null/.test(page));
    // The kit's own `kind` ("message" | "draft" | "system") drives grouping;
    // the text's kind rides under another name so the two never collide —
    // check:undef caught the first draft of this doing exactly that.
    ok("…and the text's kind never shadows the kit's row kind", /textKind: m\.kind \|\| null/.test(page) && !/kind: m\.kind/.test(page));
    ok("…and every other kind is drawn from its catalogue key", /t\(item\.kindLabelKey, item\.kindParams/.test(page));
    // deliverReplySms files the row on the lead it was handed and claims the
    // floor's rows for the number.
    const smsLib = decomment(read("lib/sales/salesSms.js"));
    const reply = functionSource(smsLib, "deliverReplySms");
    ok("…deliverReplySms writes leadId from the lead it was handed", Boolean(reply) && /leadId: lead\?\.id \|\| null/.test(reply));
    ok("…and claims unowned inbound rows on that number (attribution only)", Boolean(reply) && /updateMany\(\{\s*where: \{ direction: "in", salesRepId: null, fromE164: status\.to \}/.test(reply));
  }

  // ── 4. The demo's simulated send ────────────────────────────────────────
  {
    const DEMO = "+16135550150";
    const db = fakeDb({
      checkIns: [{ id: "ckd", salesRepId: REP_A, companyId: "co_demo", origin: "demo", status: "sent", toE164: DEMO, draftText: "Demo day 1", dedupeKey: "demo:co_demo:1", sentAt: later(2), sentMessageId: null }],
    });
    const rows = await sentDemoCheckIns({ salesRepId: REP_A, toE164: DEMO, client: db });
    ok("PATH 4 · the demo's simulated send is drawn as an OUTBOUND bubble, marked demo", rows.length === 1 && rows[0].direction === "out" && rows[0].demo === true && rows[0].body === "Demo day 1", rows);
    ok("…chipped \"Day 1 check-in\" by the same function a real send uses", rows[0]?.kind === KIND_CHECKIN && rows[0]?.kindParams?.day === 1, rows[0]);
    ok("…and no SalesSmsMessage was needed for it", db.messages.length === 0);
    const route = decomment(read("app/api/sales/messages/route.js"));
    ok("…the list keeps the demo thread from sentDemoByThread with lastDirection \"out\"", /for \(const \[e164, sent\] of demoSent\)/.test(route) && /lastDirection: "out",\s*leadId: null,\s*name: sent\.name,\s*isDemo: true/.test(route));
  }

  // ── 5. An inbound text: matched by number, or filed to the floor ────────
  {
    const SALES = "+15145550111";
    const db = fakeDb({
      numbers: [{ e164: SALES, purpose: "sales", active: true }],
      leads: [LEAD, { ...LEAD, id: "L9", salesRepId: "rep_b", businessName: "Somebody Else", phone: "613-555-0177", prospectId: "P9", updatedAt: later(9) }],
      contactNumbers: [{ id: "n1", salesLeadId: "L1", prospectId: null, e164: CELL }],
    });
    globalThis.__FQ_MSG.db = db;
    const noop = () => {};
    try {
      // (a) From the lead's own number, nobody has texted it yet: matched on
      // the NORMALISED phone — the lead's is stored "(514) 555-0134" — and
      // NOT on "the most recently updated lead", which is rep_b's.
      const a = await handleSalesInboundSms({ to: SALES, from: SHOP, body: "hi, is this FieldQuo?", schedule: noop });
      const rowA = db.messages.find((m) => m.direction === "in" && m.fromE164 === SHOP);
      ok("PATH 5 · a text from a lead's number, never texted, is filed to that lead's rep", a.handled === true && rowA?.salesRepId === REP_A && rowA?.leadId === "L1", rowA);
      // (b) From the owner's cell — a stored contact number on the lead.
      await handleSalesInboundSms({ to: SALES, from: CELL, body: "it's Marc on my cell", schedule: noop });
      const rowB = db.messages.find((m) => m.direction === "in" && m.fromE164 === CELL);
      ok("…a text from the lead's OTHER number (a stored contact number) lands on the same lead", rowB?.salesRepId === REP_A && rowB?.leadId === "L1", rowB);
      const list = await salesConversations({ salesRepId: REP_A, client: db });
      ok("…and the two arrive in ONE conversation, needing a reply, with both numbers", list.length === 1 && list[0].unanswered === true && list[0].numbers.length === 2 && list[0].name === "Loop Inc", list);
      // (c) From a number nobody holds: stored with no rep, never dropped —
      // and listed to the rep as the floor's, as a stranger's number.
      const STRANGER = "+14165550100";
      const c = await handleSalesInboundSms({ to: SALES, from: STRANGER, body: "who is this?", schedule: noop });
      const rowC = db.messages.find((m) => m.direction === "in" && m.fromE164 === STRANGER);
      ok("…a text from a number nobody holds is STORED, with no rep and no lead invented", c.action === "stored" && rowC && rowC.salesRepId === null && rowC.leadId === null, rowC);
      const floor = await salesConversations({ salesRepId: REP_A, client: db });
      const stranger = floor.find((x) => x.e164 === STRANGER);
      ok("…and reaches the floor: listed to the rep as an unowned conversation named by its number", Boolean(stranger) && stranger.unowned === true && stranger.name === null && stranger.lastDirection === "in", stranger);
      ok("…while the lead's own conversation is not marked unowned", floor.find((x) => x.name === "Loop Inc")?.unowned === false);
      const forB = await salesConversations({ salesRepId: "rep_b", client: db });
      ok("…rep_b sees the stranger too, and NOT rep_a's conversation", forB.length === 1 && forB[0].e164 === STRANGER, forB.map((x) => x.e164));
      // (d) The rep who texted a number last owns its replies, over the lead's own rep.
      db.messages.push({ id: "mx", direction: "out", salesRepId: "rep_b", leadId: "L9", fromE164: SALES, toE164: SHOP, body: "hello from rep b", sentAt: later(20) });
      await handleSalesInboundSms({ to: SALES, from: SHOP, body: "hey rep b", schedule: noop });
      const rowD = db.messages.filter((m) => m.direction === "in" && m.fromE164 === SHOP).pop();
      ok("…the rep who texted the number LAST owns the reply, whatever lead carries the number", rowD?.salesRepId === "rep_b" && rowD?.leadId === "L9", rowD);
      // (e) A reply from the floor claims the stranger's rows for the rep.
      const claim = await db.salesSmsMessage.updateMany({ where: { direction: "in", salesRepId: null, fromE164: STRANGER }, data: { salesRepId: REP_A } });
      ok("…and a reply's claim (the updateMany deliverReplySms issues) gives the stranger's rows to the rep who answered", claim.count === 1 && rowC.salesRepId === REP_A, claim);
      const afterClaim = await salesConversations({ salesRepId: "rep_b", client: db });
      ok("…after which the other reps no longer see it", !afterClaim.some((x) => x.e164 === STRANGER), afterClaim.map((x) => x.e164));
    } finally {
      globalThis.__FQ_MSG.db = null;
    }
    const inbound = functionSource(decomment(read("lib/sales/salesSms.js")), "handleSalesInboundSms");
    ok("…the inbound handler matches leads through leadsOnNumber, never \"most recently updated lead with any phone\"", Boolean(inbound) && /leadsOnNumber\(db, fromE164\)/.test(inbound) && !/phone: \{ not: null \}/.test(inbound));
    ok("…and asks the stored contact numbers", Boolean(inbound) && /salesContactNumber/.test(inbound));
    const matched = await leadsOnNumber(fakeDb({ leads: [LEAD] }), "514 555 0134");
    ok("…leadsOnNumber compares normalised, narrowing on the last four digits", matched.length === 1 && matched[0].id === "L1");
  }

  // ── 6. A conversation with only OUR words in it is listed ───────────────
  {
    const db = fakeDb({
      leads: [LEAD],
      messages: [{ id: "m1", direction: "out", salesRepId: REP_A, leadId: "L1", fromE164: "+15145550111", toE164: SHOP, body: "link https://fieldquo.com/signup?sales=RACHEL", sentAt: later(0) }],
    });
    const list = await salesConversations({ salesRepId: REP_A, client: db, readStates: new Map() });
    ok("PATH 6 · a freshly texted link with no reply yet is a listed conversation", list.length === 1 && list[0].lastDirection === "out" && list[0].count === 1 && list[0].unanswered === false, list);
    ok("…with zero unread when the markers could be read, and null when they could not", list[0]?.unread === 0 && (await salesConversations({ salesRepId: REP_A, client: db }))[0]?.unread === null);
    const { groupOf } = await import("@/lib/sales/messages/rooms");
    ok("…filed under \"Waiting on them\"", groupOf(list[0]) === "waiting", groupOf(list[0]));
    const conv = functionSource(decomment(read("lib/sales/salesSms.js")), "salesConversations");
    ok("…because the list query has no direction filter of its own", Boolean(conv) && !/direction: "out"/.test(conv) && /\{ salesRepId \}, \{ salesRepId: null, direction: "in" \}/.test(conv));
  }

  // ── The fold itself, on hostile shapes ──────────────────────────────────
  {
    ok("businessKeyOf prefers company, then prospect, then the lead", businessKeyOf({ id: "L", prospectId: "P", convertedCompanyId: "C" }) === "company:C" && businessKeyOf({ id: "L", prospectId: "P" }) === "prospect:P" && businessKeyOf({ id: "L" }) === "lead:L" && businessKeyOf(null) === null && businessKeyOf({}) === null);
    const merged = mergeThreadsByBusiness([
      { e164: "+1a", businessKey: "lead:L", lastAt: later(1), lastDirection: "out", count: 2, unread: 1, readState: { readAt: later(0), doneAt: later(0) }, lastInboundAt: later(0), leadId: "L", name: null, triage: { kind: "fine" }, unowned: false },
      { e164: "+1b", businessKey: "lead:L", lastAt: later(5), lastDirection: "in", count: 1, unread: 1, readState: null, lastInboundAt: later(5), leadId: null, name: "Named", triage: { kind: "question" }, unowned: false },
      { e164: "+1c", businessKey: null, lastAt: later(3), lastDirection: "in", count: 1, unread: null, readState: null, lastInboundAt: later(3), leadId: null, name: null, triage: null, unowned: true },
      null,
    ]);
    ok("two numbers of one business fold; a stranger's stays its own", merged.length === 2 && merged[0].e164 === "+1b" && merged[0].numbers.length === 2 && merged[1].e164 === "+1c");
    ok("…sums count and unread, keeps the name any number offers, the latest inbound, the latest reply's chip", merged[0].count === 3 && merged[0].unread === 2 && merged[0].name === "Named" && merged[0].leadId === "L" && merged[0].triage?.kind === "question" && merged[0].triage?.open === true);
    ok("…a filing older than the other number's reply does not make the conversation done", merged[0].readState?.doneAt?.getTime() === later(0).getTime() && merged[0].lastInboundAt.getTime() === later(5).getTime());
    ok("…an uncountable number makes the whole conversation uncountable, not zero", merged[1].unread === null && merged[1].unowned === true);
    ok("mergeReadStates takes the latest of each and null for none", mergeReadStates([null, { readAt: later(1), doneAt: null }, { readAt: later(0), doneAt: later(2) }])?.doneAt?.getTime() === later(2).getTime() && mergeReadStates([null]) === null);
    const readRoute = decomment(read("app/api/sales/messages/read/route.js"));
    ok("the read route marks EVERY number of the business", /resolveBusiness\(/.test(readRoute) && /numbers\.map\(\(e164\) =>/.test(readRoute));
    const route = decomment(read("app/api/sales/messages/route.js"));
    ok("the thread route reads messages, drafts, calls, STOPs and demo sends across the business's numbers",
      /salesThread\(\{ salesRepId: rep\.id, withE164, numbers \}\)/.test(route) && /openCheckIns\(\{ salesRepId: rep\.id, toE164: withE164, numbers \}\)/.test(route) && /toE164: \{ in: numbers \}/.test(route) && /numbers\.map\(\(n\) => findSuppressions/.test(route) && /sentDemoCheckIns\(\{ salesRepId: rep\.id, toE164: withE164, numbers \}\)/.test(route));
    ok("…and returns the numbers for the context bar", /numbers: numberRows,/.test(route));
    const page = decomment(read("app/sales/messages/page.js"));
    ok("the screen lists every number in the conversation and highlights the room by any of them", /thread\?\.numbers \|\| \[\]/.test(page) && /\(c\.numbers \|\| \[\]\)\.some\(\(n\) => n\.e164 === openWith\)/.test(page));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass} assertions, ${failures.length} failures`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
