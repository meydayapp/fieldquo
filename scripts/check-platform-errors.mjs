// scripts/check-platform-errors.mjs
//
//   npm run check:platform-errors
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/db-stub-loader.mjs scripts/check-platform-errors.mjs
//
// The platform errors queue's reviewed state — executed where it can be.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// The owner: "if it is fixed why do I see the errors?" The answer is a
// reviewed state with a note, and the ways it goes wrong are the usual ones:
// a count that keeps counting reviewed rows (the complaint, back), a bulk
// route with no cap, a stamp with no audit row, an unmark that leaves the old
// note standing, a cron that quietly reviews things on the owner's behalf.
//
// ══ What has to be executed ════════════════════════════════════════════════
//
//   1. reviewErrors (lib/platform/errorLog.js) against a fake transaction:
//      empty ids and >200 ids are refused BEFORE any write; ids are de-duped;
//      marking writes the three fields and ONE audit row through the same tx;
//      the note is trimmed and capped; unmarking clears all three and writes
//      the reversal action, and ignores any note.
//   2. Both audit actions have wording (lib/platform/auditActions.js).
//   3. The routes, on the source: both PATCHes refuse unauthenticated before
//      touching the helper, gate on company:view (the read permission), reject
//      markup in the note, and `reviewed` defaults to true so the older
//      `{ ids }` body keeps its meaning. Every count the GET returns is of
//      UNREVIEWED rows, except the archive size behind the toggle.
//   4. The page: hides reviewed by default, has the toggle with its count, a
//      per-row Mark reviewed / Unmark, a checkbox batch, and prints who / when
//      / why on a reviewed row. Every existing filter survived.
//   5. Nothing reviews automatically: reviewErrors is called from the two
//      routes and nowhere else, and no cron writes resolvedAt on the model.
//   6. The schema carries resolvedNote, and the check is wired.
//   7. The dashboard's "phone pool needs attention" bullet
//      (lib/voice/webhookAttention.js, executed): one old refusal with a
//      newer accepted delivery is quiet; a refusal in the last 24 h is red; a
//      refusal newer than the last accepted delivery is red; a refusal with
//      NO accepted delivery ever is red; every refusal reviewed is quiet.
//      The route reads unreviewed rows only and excludes rescued calls from
//      "accepted"; the page prints count, date, accepted-since and links.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { reviewErrors, REVIEW_BULK_MAX, REVIEW_NOTE_MAX } from "../lib/platform/errorLog.js";
import { AUDIT_ACTIONS } from "../lib/platform/auditActions.js";
import { webhookAttention, refusedPhrase, refusalReason, ATTENTION_WINDOW_MS } from "../lib/voice/webhookAttention.js";

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

// ═══════════════ 1. reviewErrors against a fake transaction ════════════════
console.log("\n1. reviewErrors, executed");

function fakeDb({ matched = (ids) => ids.length } = {}) {
  const updates = [];
  const audits = [];
  let txCalls = 0;
  const tx = {
    platformErrorLog: {
      updateMany: async (args) => {
        updates.push(args);
        return { count: matched(args.where.id.in) };
      },
    },
    platformAuditLog: {
      create: async (args) => {
        audits.push(args.data);
        return args.data;
      },
    },
  };
  return {
    updates,
    audits,
    get txCalls() {
      return txCalls;
    },
    $transaction: async (fn) => {
      txCalls++;
      return fn(tx);
    },
    // Reaching for the client OUTSIDE the transaction is the split this check
    // exists to catch, so it throws by name.
    platformErrorLog: new Proxy({}, { get: (_, k) => () => { throw new Error(`platformErrorLog.${String(k)} outside tx`); } }),
    platformAuditLog: new Proxy({}, { get: (_, k) => () => { throw new Error(`platformAuditLog.${String(k)} outside tx`); } }),
  };
}

{
  const db = fakeDb();
  let r = await reviewErrors({ ids: [], adminId: "adm_1" }, { db });
  ok("empty ids → 400, nothing written", r.ok === false && r.status === 400 && db.txCalls === 0, r);
  r = await reviewErrors({ ids: ["e1"], adminId: "" }, { db });
  ok("no adminId → 400, nothing written", r.ok === false && r.status === 400 && db.txCalls === 0, r);
  r = await reviewErrors({ ids: [1, null, "", "e1"], adminId: "adm_1" }, { db });
  ok("non-string ids are dropped, not written", r.ok && db.updates[0].where.id.in.length === 1, db.updates[0]?.where);
}

{
  ok("the bulk cap is 200", REVIEW_BULK_MAX === 200, REVIEW_BULK_MAX);
  const db = fakeDb();
  const many = Array.from({ length: REVIEW_BULK_MAX + 1 }, (_, i) => `e${i}`);
  const r = await reviewErrors({ ids: many, adminId: "adm_1" }, { db });
  ok("201 ids → refused with a 400 BEFORE any write", r.ok === false && r.status === 400 && db.txCalls === 0, r);
  ok("…and the refusal says the cap and the count", /200/.test(r.error) && /201/.test(r.error), r.error);
  const exact = many.slice(0, REVIEW_BULK_MAX);
  const r2 = await reviewErrors({ ids: exact, adminId: "adm_1" }, { db });
  ok("exactly 200 → accepted", r2.ok && r2.count === 200, r2);
  const dup = await reviewErrors({ ids: [...exact, ...exact], adminId: "adm_1" }, { db: fakeDb() });
  ok("400 ids that are 200 distinct → de-duped, accepted", dup.ok && dup.count === 200, dup);
}

{
  const db = fakeDb();
  const now = new Date("2026-09-14T10:00:00Z");
  const r = await reviewErrors(
    { ids: ["e1", "e2", "e1"], reviewed: true, note: "  key rotated, see #123  ", adminId: "adm_7" },
    { db, now },
  );
  ok("mark → ok with the matched count", r.ok && r.count === 2 && r.reviewed === true, r);
  ok("…one transaction", db.txCalls === 1, db.txCalls);
  const u = db.updates[0];
  ok("…de-duped ids in the where", JSON.stringify(u.where) === '{"id":{"in":["e1","e2"]}}', u.where);
  ok(
    "…writes resolvedAt / resolvedBy(admin id) / resolvedNote",
    u.data.resolvedAt === now && u.data.resolvedBy === "adm_7" && u.data.resolvedNote === "key rotated, see #123",
    u.data,
  );
  const a = db.audits[0];
  ok("…and ONE audit row, error_reviewed, in the same tx", db.audits.length === 1 && a.action === "error_reviewed", a);
  ok(
    "…attributed to the admin with the ids, count and note",
    a.platformAdminId === "adm_7" && JSON.stringify(a.details.errorIds) === '["e1","e2"]' && a.details.count === 2 && a.details.note === "key rotated, see #123",
    a.details,
  );
}

{
  const db = fakeDb();
  const r = await reviewErrors({ ids: ["e1"], reviewed: true, note: "x".repeat(REVIEW_NOTE_MAX + 50), adminId: "adm_7" }, { db });
  ok(`a long note is capped at ${REVIEW_NOTE_MAX}`, r.ok && db.updates[0].data.resolvedNote.length === REVIEW_NOTE_MAX);
  const db2 = fakeDb();
  await reviewErrors({ ids: ["e1"], reviewed: true, note: "   ", adminId: "adm_7" }, { db: db2 });
  ok("a blank note is stored as null, not as spaces", db2.updates[0].data.resolvedNote === null, db2.updates[0].data);
  const db3 = fakeDb();
  await reviewErrors({ ids: ["e1"], reviewed: true, note: { evil: 1 }, adminId: "adm_7" }, { db: db3 });
  ok("a non-string note is null", db3.updates[0].data.resolvedNote === null, db3.updates[0].data);
}

{
  const db = fakeDb();
  const r = await reviewErrors({ ids: ["e1", "e2"], reviewed: false, note: "should be ignored", adminId: "adm_7" }, { db });
  ok("unmark → ok", r.ok && r.reviewed === false, r);
  const u = db.updates[0];
  ok(
    "…clears all three fields (a stale note must not outlive its review)",
    u.data.resolvedAt === null && u.data.resolvedBy === null && u.data.resolvedNote === null,
    u.data,
  );
  const a = db.audits[0];
  ok("…and writes error_unreviewed with no note", a.action === "error_unreviewed" && a.details.note === null, a);
}

{
  const db = fakeDb({ matched: () => 0 });
  const r = await reviewErrors({ ids: ["nope"], adminId: "adm_7" }, { db });
  ok("an id that matches nothing reports count 0 (the [id] route turns that into a 404)", r.ok && r.count === 0, r);
}

// ═══════════════ 2. Audit wording ══════════════════════════════════════════
console.log("\n2. Audit wording");
ok("error_reviewed has wording", Boolean(AUDIT_ACTIONS.error_reviewed?.label), AUDIT_ACTIONS.error_reviewed);
ok("error_unreviewed has wording", Boolean(AUDIT_ACTIONS.error_unreviewed?.label), AUDIT_ACTIONS.error_unreviewed);
ok(
  "…and the reversal does not read as a review",
  /unmark/i.test(AUDIT_ACTIONS.error_unreviewed?.label || "") && !/^Marked errors reviewed/.test(AUDIT_ACTIONS.error_unreviewed?.label || ""),
  AUDIT_ACTIONS.error_unreviewed?.label,
);

// ═══════════════ 3. The routes ═════════════════════════════════════════════
console.log("\n3. The routes, on the source");

const COLLECTION = "app/api/platform/errors/route.js";
const SINGLE = "app/api/platform/errors/[id]/route.js";
const collection = strip(read(COLLECTION));
const single = strip(read(SINGLE));

for (const [name, src] of [
  [COLLECTION, collection],
  [SINGLE, single],
]) {
  const patchStart = src.indexOf("export async function PATCH");
  ok(`${name} has a PATCH`, patchStart !== -1);
  const patch = src.slice(patchStart);
  const authAt = patch.indexOf("getCurrentPlatformAdmin(");
  const refuseAt = patch.indexOf("401");
  const helperAt = patch.indexOf("reviewErrors(");
  ok(`…refuses unauthenticated with a 401 BEFORE calling the helper`, authAt !== -1 && refuseAt > authAt && helperAt > refuseAt, { authAt, refuseAt, helperAt });
  ok(`…gated on company:view — the permission that reads the queue`, /requirePlatformPermission\(admin\.role,\s*"company:view"\)/.test(patch));
  ok(`…rejects < and > in the note`, patch.includes("containsMarkupCharacters(note)"));
  ok(`…\`reviewed\` defaults to true (only an explicit false unmarks)`, patch.includes("body?.reviewed !== false"));
  ok(`…writes through the shared helper, never platformErrorLog directly`, !patch.includes("platformErrorLog.update"));
  ok(`…and passes the admin's id, not email, as the reviewer`, patch.includes("adminId: admin.id"));
}
ok("the [id] route turns count 0 into a 404", /result\.count === 0[\s\S]{0,40}404/.test(single));
ok("the [id] route awaits params (Next 16)", single.includes("await params"));

const get = collection.slice(collection.indexOf("export async function GET"), collection.indexOf("export async function PATCH"));
ok("GET's unresolvedCount counts resolvedAt: null", /count\(\{\s*where:\s*\{\s*resolvedAt:\s*null\s*\}\s*\}\)/.test(get));
ok("GET's area chips count resolvedAt: null", /groupBy\(\{[\s\S]*?where:\s*\{\s*resolvedAt:\s*null\s*\}/.test(get));
ok("GET returns reviewedCount, the archive behind the toggle", /reviewedCount/.test(get) && /NOT:\s*\{\s*resolvedAt:\s*null\s*\}/.test(get));
ok("…under the same area/company filter as the list", /count\(\{\s*where:\s*\{\s*\.\.\.filters,\s*NOT:/.test(get));
ok("the default list is the UNREVIEWED rows; ?resolved=1 is the archive", get.includes('searchParams.get("resolved") === "1"') && get.includes("resolved ? { NOT: { resolvedAt: null } } : { resolvedAt: null }"));
ok("GET resolves the reviewer id to an email for the screen", get.includes("platformAdmin.findMany") && get.includes("resolvedByEmail"));
ok("…and shows an unknown reviewer string as written rather than dropping it", /reviewerById\.get\(e\.resolvedBy\)\s*\|\|\s*e\.resolvedBy/.test(get));

// ═══════════════ 4. The page ═══════════════════════════════════════════════
console.log("\n4. The page");
const PAGE = "app/platform/errors/page.js";
const page = strip(read(PAGE));
ok("the page is English-only (platform console): no t()", !/[^a-zA-Z_.]t\(/.test(page));
ok("loads /api/platform/errors and only asks for the archive when the toggle is on", /if \(showReviewed\) qs\.set\("resolved", "1"\)/.test(page));
ok("the toggle reads 'Show reviewed' with the archive count", page.includes("Show reviewed") && page.includes("data.reviewedCount"));
ok("the header badge counts unreviewed", page.includes("{data.unresolvedCount} unreviewed"));
ok("per-row Mark reviewed opens the note prompt", page.includes("Mark reviewed") && page.includes("setNoteFor(e.id)"));
ok("per-row Unmark on a reviewed row", page.includes("Unmark") && page.includes("review([e.id], false)"));
ok("a single row goes through the [id] route", page.includes("`/api/platform/errors/${ids[0]}`"));
ok("a batch goes through the collection route with ids", page.includes('fetchJson("/api/platform/errors", { method: "PATCH", body: { ids, reviewed, note } })'));
ok("there is a checkbox per row and a select-all", page.includes("checked={selected.has(e.id)}") && page.includes("checked={allSelected}"));
ok("the batch button says how many", page.includes("Mark {selectedIds.length} reviewed"));
ok("a reviewed row prints who, when and why", page.includes("Reviewed by {e.resolvedByEmail") && page.includes("when(e.resolvedAt)") && page.includes("e.resolvedNote"));
ok("the note is one line, capped like the server", page.includes("maxLength={300}") && REVIEW_NOTE_MAX === 300);
ok("selection is cleared on every reload", /setData\(json\);\s*setSelected\(new Set\(\)\)/.test(page));
ok("the area filter survived", page.includes('qs.set("area", area)') && page.includes("setArea(a.area)"));
ok("the empty state still distinguishes the archive from a clean queue", page.includes('"Nothing reviewed yet." : "Nothing is broken."'));
ok("nothing on the page still says Acknowledge", !/acknowledg/i.test(page));
ok("the page uses fetchJson, not bare res.ok", page.includes("fetchJson(") && !page.includes("res.ok"));

// ═══════════════ 5. Nothing reviews automatically ══════════════════════════
console.log("\n5. Nothing reviews automatically");
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(p, out);
    } else if (/\.(js|mjs)$/.test(entry.name)) out.push(p);
  }
  return out;
}
const sources = [...walk("app"), ...walk("lib")];
const callers = sources.filter((f) => strip(read(f)).includes("reviewErrors("));
ok(
  "reviewErrors is called from the two routes and nowhere else (no cron, no sync)",
  callers.length === 3 && callers.includes(COLLECTION) && callers.includes(SINGLE) && callers.includes("lib/platform/errorLog.js"),
  callers,
);
const stampers = sources.filter((f) => {
  if (f === "lib/platform/errorLog.js") return false;
  const src = strip(read(f));
  return /platformErrorLog\.update(Many)?\(/.test(src) && /resolvedAt/.test(src);
});
ok("no other file writes resolvedAt on PlatformErrorLog", stampers.length === 0, stampers);
const billingSync = strip(read("app/api/cron/billing-sync/route.js"));
ok("the billing sync files drift and never reviews the earlier drift row", !/resolvedAt|reviewErrors/.test(billingSync));

// ═══════════════ 6. Schema and wiring ══════════════════════════════════════
console.log("\n6. Schema and wiring");
const schema = read("prisma/schema.prisma");
const model = schema.slice(schema.indexOf("model PlatformErrorLog {"));
const modelBody = model.slice(0, model.indexOf("\n}"));
ok("PlatformErrorLog has resolvedAt / resolvedBy / resolvedNote", /resolvedAt\s+DateTime\?/.test(modelBody) && /resolvedBy\s+String\?/.test(modelBody) && /resolvedNote\s+String\?/.test(modelBody));
ok("…and the comment says why not delete", /never deletes/.test(modelBody));
const pkg = JSON.parse(read("package.json"));
ok("package.json wires check:platform-errors", typeof pkg.scripts["check:platform-errors"] === "string" && pkg.scripts["check:platform-errors"].includes("check-platform-errors.mjs"));
ok("…and check:all runs it", pkg.scripts["check:all"].includes("npm run check:platform-errors"));

// ═══════════════ 7. The dashboard's refused-deliveries bullet ══════════════
console.log("\n7. webhookAttention, executed");
{
  const H = 60 * 60 * 1000;
  const now = new Date("2026-09-14T12:00:00Z").getTime();
  const at = (hoursAgo) => new Date(now - hoursAgo * H);
  const refusal = (hoursAgo, extra = {}) => ({ code: "webhook_rejected_no_signature", createdAt: at(hoursAgo), resolvedAt: null, ...extra });

  ok("the window is 24 h", ATTENTION_WINDOW_MS === 24 * H);
  ok("refusalReason strips the prefix", refusalReason("webhook_rejected_no_signature") === "no_signature" && refusalReason("other") === "other");
  ok("refusedPhrase pluralises", refusedPhrase(1) === "1 refused delivery" && refusedPhrase(3) === "3 refused deliveries");

  // The owner's card: one refusal from 8 days ago, 62 minutes of calls since.
  let a = webhookAttention({ refusals: [refusal(8 * 24)], lastAcceptedAt: at(2), acceptedSince: 14, now });
  ok("one old refusal + newer accepted delivery → quiet", a.level === "quiet", a);
  ok("…with the count, the reason, the time and the accepted-since for the muted line",
    a.refused === 1 && a.refused24h === 0 && a.refusedSinceAccepted === 0 && a.lastRefusal.reason === "no_signature" && a.acceptedSince === 14 && a.lastRefusal.at === at(8 * 24).toISOString(), a);

  a = webhookAttention({ refusals: [refusal(8 * 24), refusal(3)], lastAcceptedAt: at(1), acceptedSince: 2, now });
  ok("a refusal in the last 24 h → red, even with an accepted delivery after it", a.level === "red" && a.refused24h === 1 && a.refused === 2, a);
  ok("…and lastRefusal is the newest, whatever order the rows came in", a.lastRefusal.at === at(3).toISOString(), a.lastRefusal);

  a = webhookAttention({ refusals: [refusal(40)], lastAcceptedAt: at(50), acceptedSince: 0, now });
  ok("a refusal older than 24 h but newer than the last accepted delivery → red", a.level === "red" && a.refused24h === 0 && a.refusedSinceAccepted === 1, a);

  a = webhookAttention({ refusals: [refusal(40)], lastAcceptedAt: null, acceptedSince: 0, now });
  ok("a refusal with no accepted delivery EVER → red (every refusal is newer than none)", a.level === "red" && a.refusedSinceAccepted === 1, a);

  a = webhookAttention({ refusals: [refusal(1, { resolvedAt: at(0.5) }), refusal(30, { resolvedAt: at(0.5) })], lastAcceptedAt: null, acceptedSince: 0, now });
  ok("every refusal reviewed → nothing, even inside the window and with no accepted delivery", a.level === "none" && a.refused === 0 && a.lastRefusal === null, a);

  a = webhookAttention({ refusals: [refusal(1, { resolvedAt: at(0.5) }), refusal(8 * 24)], lastAcceptedAt: at(2), acceptedSince: 9, now });
  ok("a reviewed recent refusal does not contribute; the old one alone is quiet", a.level === "quiet" && a.refused === 1, a);

  a = webhookAttention({ refusals: [], lastAcceptedAt: at(2), acceptedSince: 0, now });
  ok("no refusals → none", a.level === "none" && a.lastRefusal === null, a);
  a = webhookAttention({});
  ok("no input at all → none, not a throw", a.level === "none");
  a = webhookAttention({ refusals: [{ code: "webhook_rejected_x", createdAt: "garbage" }], lastAcceptedAt: at(1), now });
  ok("an unparseable time is dropped rather than counted", a.level === "none", a);
  a = webhookAttention({ refusals: [refusal(1)], lastAcceptedAt: at(2).toISOString(), acceptedSince: "3", now: new Date(now) });
  ok("ISO strings and a Date `now` are accepted; acceptedSince is coerced", a.level === "red" && a.acceptedSince === 3 && a.lastAcceptedAt === at(2).toISOString(), a);
}

console.log("\n   …and the route and page that use it");
{
  const route = strip(read("app/api/platform/voice-health/route.js"));
  ok("the route reads UNREVIEWED refusal rows only", /code:\s*\{\s*startsWith:\s*"webhook_rejected_"\s*\},\s*resolvedAt:\s*null/.test(route));
  ok("…newest first, more rows than a day of hourly throttling", /orderBy:\s*\{\s*createdAt:\s*"desc"\s*\},\s*take:\s*50/.test(route));
  ok("'accepted' excludes calls the reconciler rescued (recoveredAt null)", (route.match(/recoveredAt:\s*null/g) || []).length >= 2);
  ok("…for the last-accepted stamp AND the accepted-since count", /findFirst\(\{\s*where:\s*\{\s*recoveredAt:\s*null\s*\}/.test(route) && /count\(\{\s*where:\s*\{\s*recoveredAt:\s*null,\s*createdAt:\s*\{\s*gt:\s*refusals\[0\]\.createdAt/.test(route));
  ok("the alert is raised only on red", /if \(attention\.level === "red"\)/.test(route));
  ok("…as critical, with the remedy link and the rows link", /level:\s*"critical",\s*code:\s*"webhook_rejected"/.test(route) && route.includes('href: "/platform/voice-webhooks"') && route.includes("rowsHref: `/platform/errors?area=${WEBHOOK_AREA}`"));
  ok("the whole verdict is returned for the muted line", route.includes("webhookAttention: attention"));
  ok("the old single-row alert is gone", !route.includes("if (rejects)"));
  ok("the route stays read-only", !/\.(update|create|delete|upsert)\(/.test(route));

  const dash = strip(read("app/platform/page.js"));
  ok("the dashboard prints count, last time and accepted-since under the bullet", dash.includes("refusedPhrase(attention.refused)") && dash.includes("relativeTime(attention.lastRefusal.at)") && dash.includes("accepted since"));
  ok("…links the bullet to the remedy", dash.includes("<Link href={a.href}"));
  ok("…and the rows to the errors queue", dash.includes("<Link href={a.rowsHref}"));
  ok("…with a heading that names refused deliveries rather than concurrency", dash.includes('"Call events are being refused"'));
  ok("the quiet state is a muted footer line with a review link, never the red card", dash.includes('attention?.level === "quiet"') && dash.includes('href="/platform/errors?area=voice_webhook"'));
  const errorsPage = strip(read(PAGE));
  ok("/platform/errors honours ?area= from that link", errorsPage.includes('get("area")'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
