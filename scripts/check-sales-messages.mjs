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
globalThis.__FQ_MSG = { rows: { salesCheckIn: [] }, writes: [] };
const DB_HOOKS = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: "fq-stub:msg-db", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:msg-db")
    return { format: "module", shortCircuit: true, source:
      "export const db = new Proxy({}, { get: (_t, model) => new Proxy({}, { get: (_m, op) => async (args) => { throw new Error('the module-level db was used: ' + String(model) + '.' + String(op)); } }) });" };
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
  const cronTouching = cronFiles.filter((f) => /salesCheckIn|checkin\/store|sendCheckIn/.test(decomment(read(f))));
  ok("no cron route touches the check-in table or its send path", cronTouching.length === 0, cronTouching);

  const vercel = read("vercel.json");
  ok("vercel.json schedules nothing under /api/sales", !/\/api\/sales/.test(vercel));
  ok("…and nothing named checkin", !/checkin/i.test(vercel));
}

{
  // The client screen. No interval, no effect that sends: every path to the
  // carrier starts in an event handler.
  const page = decomment(read("app/sales/messages/page.js"));
  ok("the screen sets no interval", !/setInterval\s*\(/.test(page));
  ok("the screen sets no timeout", !/setTimeout\s*\(/.test(page));

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
  };
}

const REP = { id: "rep_1", name: "Daniel", code: "DANIEL" };

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
  ok("an EMPTY thread gets the signup-link panel, not a free-text box",
    /\(thread\.messages \|\| \[\]\)\.length === 0 && thread\.lead \? \(/.test(otherwiseHalf) && /<SignupLinkSms leadId=\{thread\.lead\.id\} inThread/.test(otherwiseHalf));
  ok("…and that panel is the lead screen's own component", /import SignupLinkSms from "\.\.\/leads\/SignupLinkSms"/.test(page));
  // The empty-thread branch, on its own: the introduction and NOTHING that
  // takes free text. A composer beside the panel would post a first contact
  // into the reply route's 409.
  const emptyAt = otherwiseHalf.indexOf("length === 0 && thread.lead ? (");
  const emptyBranch = emptyAt >= 0 ? otherwiseHalf.slice(emptyAt, otherwiseHalf.indexOf(") : ", emptyAt + 10)) : "";
  ok("the empty-thread branch holds no free-text box", emptyBranch.length > 0 && !/<Composer/.test(emptyBranch) && !/<textarea/.test(emptyBranch), emptyBranch.slice(0, 80));

  // And the draft's own send button is withheld the same way.
  ok("drafts are told whether a send is possible", /canSend=\{!suppressed\}/.test(page));
  const draftUi = decomment(read("app/sales/messages/CheckInDraft.js"));
  ok("…and the draft withholds the button rather than disabling it",
    /canSend \? \(/.test(draftUi) && /app\.salesText\.sendNow/.test(draftUi));
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
  ok("…decides through startTextThread and writes nothing itself", /startTextThread\(db, \{ rep, raw \}\)/.test(route) && !/\bdb\.[a-zA-Z]+\./.test(route));
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
console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass} assertions, ${failures.length} failures`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
