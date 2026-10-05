// scripts/check-inbox-autolink.mjs
//
//   npm run check:inbox-autolink
//
// "Link conversations to clients automatically" and "which job is this
// message about" (owner, 2026-10-05; lib/conversations/autoLink.js),
// EXECUTED against an in-memory database holding two companies
// (scripts/fixtures/fakePrisma.mjs evaluates every where, so a dropped
// companyId returns the other tenant's rows and this file says so):
//
//   · one client holds the phone → linked, recorded in ThreadClientMatch,
//     and "Not this client" (the existing undo) takes it off;
//   · two clients share the phone → not linked;
//   · an undone pair → never re-linked, by arrival, by the backfill, by the
//     brought-number linker;
//   · another company's client with the same phone → never;
//   · a homeowner with one active job → the message is tagged with it;
//   · two jobs, a date that one of them contains → the right one (in the
//     company's own calendar day, not UTC's);
//   · two overlapping jobs → "Which job?";
//   · a contractor with one job and a message outside its window → asked,
//     not tagged; inside it → tagged by date;
//   · the switch off → nothing automatic at all;
//   · the person's "Which job?" route, executed: this company's job of this
//     client only, a person's choice is never overwritten, crew and support
//     refused;
//   · the job page's timeline places a tagged message by its tag.
//
// Plus the wiring (ingest, mailbox, brought number, the thread route, the
// Messages chip, the setting) read from source, and the tenant fence over
// every recorded query.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";
import { FakePrisma } from "./fixtures/fakePrisma.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  ✗ ${name}${extra !== undefined ? `  — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}`);
const src = (p) => readFileSync(join(ROOT, p), "utf8");

// ── "@/lib/db" and the session, swapped for this check's own ───────────────
globalThis.__FQ_DB = null;
globalThis.__FQ_SESSION = null;
const HOOKS = `
const STUBS = { "@/lib/db": "fq-stub:db", "@/lib/currentMember": "fq-stub:member", "next/server": "fq-stub:next" };
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") return { format: "module", shortCircuit: true, source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  if (url === "fq-stub:member") return { format: "module", shortCircuit: true, source: "export const getCurrentMember = async () => globalThis.__FQ_SESSION;" };
  if (url === "fq-stub:next") return { format: "module", shortCircuit: true, source: "export class NextResponse { constructor(body, init) { this.body = body; this.status = init?.status ?? 200; } static json(body, init) { const r = new NextResponse(body, init); r.json = async () => body; return r; } }" };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const {
  exactClientMatch,
  decideThreadClient,
  activeJobsAt,
  jobContains,
  decideMessageJob,
  autoLinkOnArrival,
  autoLinkThreadClient,
  autoTagMessageJob,
  backfillCompany,
  pairRefused,
  JOB_LINKED_BY,
  AUTO_LINK_PLATFORMS,
} = await import("@/lib/conversations/autoLink");
const { undoWebMatch, rejectClientMatch } = await import("@/lib/aiEmployee/webChatMatch");
const { linkThreadByPhone } = await import("@/lib/businessNumber/conversation");
const { loadClientTimeline } = await import("@/lib/conversations/clientTimeline");
const { PERMISSION_PRESETS } = await import("@/lib/permissions");

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const CO = "coA";
const OTHER = "coB";
const d = (s) => new Date(s);
const DAY = 24 * 3600 * 1000;

function world({ autoLink = true } = {}) {
  const client = (id, companyId, name, phone = null, email = null, type = "individual") => ({ id, companyId, name, phone, email, type, address: null, city: null, province: null, country: null, language: null, createdAt: d("2025-01-01") });
  const ch = (platform) => ({ platform, name: platform });
  const thread = (id, companyId, platform, pe, extra = {}) => ({
    id, companyId, channel: ch(platform), participantExternalId: pe, participantName: null, clientId: null, jobId: null, quoteId: null, leadId: null, lastMessageAt: d("2026-10-01"), ...extra,
  });
  const msg = (id, threadId, at, extra = {}) => ({ id, threadId, direction: "in", private: false, body: `body ${id}`, sentAt: d(at), jobId: null, jobLinkedBy: null, activity: null, ...extra });
  const job = (id, companyId, clientId, status, extra = {}) => ({ id, companyId, clientId, status, title: `Job ${id}`, archivedAt: null, createdAt: d("2026-09-01"), completedAt: null, startDate: null, endDate: null, recurring: false, quoteId: null, ...extra });

  const tables = {
    company: [
      { id: CO, timezone: "America/Toronto", autoLinkConversations: autoLink },
      { id: OTHER, timezone: "America/Toronto", autoLinkConversations: true },
    ],
    client: [
      client("cHome", CO, "Hanna Home", "+1 (514) 555-0101", "Hanna@Example.com"),
      client("cAnn", CO, "Ann Lee", "514-555-0303"),
      client("cMark", CO, "Mark Lee", "(514) 555-0303"),
      client("cGC", CO, "Bigbuild Contractors", "514-555-0505", "office@bigbuild.test", "company"),
      client("cTwo", CO, "Tess Two", "514-555-0606"),
      client("cOver", CO, "Olly Over", "514-555-0707"),
      client("cNoJob", CO, "Nora None", "514-555-0808"),
      // Another company holds the SAME phone as cHome and an only-theirs one.
      client("cB", OTHER, "Hanna Home", "5145550101"),
      client("cBonly", OTHER, "Only B", "514-555-0909"),
    ],
    job: [
      job("jHome", CO, "cHome", "scheduled"),
      job("jHomeOld", CO, "cHome", "completed", { completedAt: d("2026-01-01") }),
      job("jHomeCancel", CO, "cHome", "cancelled"),
      job("jGC", CO, "cGC", "scheduled", { startDate: d("2026-10-06T00:00:00Z"), endDate: d("2026-10-08T00:00:00Z") }),
      job("jT1", CO, "cTwo", "scheduled", { startDate: d("2026-10-06T00:00:00Z"), endDate: d("2026-10-06T00:00:00Z") }),
      job("jT2", CO, "cTwo", "in_progress"),
      job("jO1", CO, "cOver", "scheduled", { startDate: d("2026-10-05T00:00:00Z"), endDate: d("2026-10-09T00:00:00Z") }),
      job("jO2", CO, "cOver", "scheduled", { startDate: d("2026-10-06T00:00:00Z"), endDate: d("2026-10-07T00:00:00Z") }),
      job("jB", OTHER, "cB", "scheduled"),
    ],
    jobVisit: [
      // jT2 has a visit on Oct 10 (Toronto) — 14:00 UTC is 10:00 local.
      { id: "v1", jobId: "jT2", scheduledAt: d("2026-10-10T14:00:00Z"), status: "scheduled" },
      { id: "v2", jobId: "jT2", scheduledAt: d("2026-10-06T14:00:00Z"), status: "cancelled" },
    ],
    quote: [],
    leadRequest: [
      { id: "lFb", companyId: CO, name: "Hanna", email: "hanna@example.com", phone: null },
    ],
    messageThread: [
      thread("tHome", CO, "sms", "+15145550101"),
      thread("tShared", CO, "sms", "+15145550303"),
      thread("tGC", CO, "sms", "+15145550505"),
      thread("tTwo", CO, "whatsapp", "15145550606"),
      thread("tOver", CO, "sms", "+15145550707"),
      thread("tNoJob", CO, "sms", "+15145550808"),
      thread("tEmail", CO, "email", "HANNA@example.COM"),
      thread("tFb", CO, "facebook", "psid_1", { leadId: "lFb" }),
      thread("tWeb", CO, "web", "visitor_1", { leadId: "lFb" }),
      thread("tOnlyB", CO, "sms", "+15145550909"),
      thread("tLinkedByPerson", CO, "sms", "+15145550101", { clientId: "cTwo" }),
      thread("tB", OTHER, "sms", "+15145550101"),
    ],
    message: [
      msg("mHome", "tHome", "2026-10-05T15:00:00Z"),
      msg("mShared", "tShared", "2026-10-05T15:00:00Z"),
      msg("mGCin", "tGC", "2026-10-07T02:00:00Z"), // Oct 6, 22:00 Toronto — inside Oct 6–8
      msg("mGCout", "tGC", "2026-10-12T15:00:00Z"), // after the window
      msg("mGCbefore", "tGC", "2026-10-06T02:00:00Z"), // Oct 5, 22:00 Toronto — the day BEFORE (UTC says Oct 6)
      msg("mT1", "tTwo", "2026-10-06T18:00:00Z"),
      msg("mT2", "tTwo", "2026-10-10T20:00:00Z"),
      msg("mTnone", "tTwo", "2026-10-15T20:00:00Z"),
      msg("mOver", "tOver", "2026-10-06T16:00:00Z"),
      msg("mNoJob", "tNoJob", "2026-10-06T16:00:00Z"),
      msg("mEmail", "tEmail", "2026-10-05T16:00:00Z"),
      msg("mFb", "tFb", "2026-10-05T16:00:00Z"),
      msg("mWeb", "tWeb", "2026-10-05T16:00:00Z"),
      msg("mOnlyB", "tOnlyB", "2026-10-05T16:00:00Z"),
      msg("mOut", "tHome", "2026-10-05T16:00:00Z", { direction: "out" }),
      msg("mB", "tB", "2026-10-05T16:00:00Z"),
    ],
    threadClientMatch: [],
    member: [],
    user: [],
    invoice: [],
    activityLog: [],
    voiceCall: [],
    clientTicket: [],
    clientTicketMessage: [],
    smsDelivery: [],
    sentEmail: [],
  };
  const db = new FakePrisma(tables, {
    messageThread: { channel: [(r) => r.channel || null, "messagingChannel"] },
    message: {
      thread: [(r, db) => db.t.messageThread.find((t) => t.id === r.threadId) || null, "messageThread"],
      email: [() => null, "emailMessage"],
    },
    job: {
      quote: [(r, db) => db.t.quote.find((q) => q.id === r.quoteId) || null, "quote"],
      visits: [(r, db) => db.t.jobVisit.filter((v) => v.jobId === r.id), "jobVisit"],
    },
    leadRequest: { quote: [() => null, "quote"] },
    clientTicketMessage: { ticket: [() => null, "clientTicket"] },
  });
  globalThis.__FQ_DB = db;
  return db;
}
const thr = (db, id) => db.t.messageThread.find((t) => t.id === id);
const mrow = (db, id) => db.t.message.find((m) => m.id === id);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The client: exactly one, or nobody (pure)");
// ═══════════════════════════════════════════════════════════════════════════
{
  const clients = world().t.client;
  ok("one client holds the phone → client", exactClientMatch({ companyId: CO, identity: { phone: "+15145550101" }, clients }).clientId === "cHome");
  ok("two clients share the phone → ambiguous", exactClientMatch({ companyId: CO, identity: { phone: "+15145550303" }, clients }).kind === "ambiguous");
  ok("another company's client never counts", exactClientMatch({ companyId: CO, identity: { phone: "+15145550909" }, clients }).kind === "none");
  ok("email in another case → the same client", exactClientMatch({ companyId: CO, identity: { email: "HANNA@EXAMPLE.COM" }, clients }).clientId === "cHome");
  ok("phone of one client + email of another → ambiguous", exactClientMatch({ companyId: CO, identity: { phone: "+15145550606", email: "hanna@example.com" }, clients }).kind === "ambiguous");
  const t = { id: "t", companyId: CO, clientId: null, channel: { platform: "sms" }, participantExternalId: "+15145550101" };
  ok("decide: links", decideThreadClient({ companyId: CO, thread: t, clients }).link === true);
  ok("decide: a person's link stands", decideThreadClient({ companyId: CO, thread: { ...t, clientId: "cTwo" }, clients }).why === "already_linked");
  ok("decide: undone pair → never", decideThreadClient({ companyId: CO, thread: t, clients, history: [{ threadId: "t", clientId: "cHome", status: "undone" }] }).why === "undone");
  ok("decide: a live row whose link was removed by hand → never", decideThreadClient({ companyId: CO, thread: t, clients, history: [{ threadId: "t", clientId: "cHome", status: "linked" }] }).why === "undone");
  ok("decide: web chat is webChatMatch's, never this file's", decideThreadClient({ companyId: CO, thread: { ...t, channel: { platform: "web" } }, clients }).why === "not_eligible");
  ok("decide: another company's thread → refused", decideThreadClient({ companyId: CO, thread: { ...t, companyId: OTHER }, clients }).link === false);
  let threw = false;
  try { decideThreadClient({ thread: t, clients }); } catch { threw = true; }
  ok("decide: companyId is required", threw);
  ok("the platforms: sms, whatsapp, email, facebook, instagram — not web", AUTO_LINK_PLATFORMS.join() === "sms,whatsapp,email,facebook,instagram");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. On arrival — one match linked and recorded; undo; never re-linked");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = world();
  const r = await autoLinkOnArrival(db, { companyId: CO, threadId: "tHome", messageId: "mHome" });
  ok("one match → thread.clientId", thr(db, "tHome").clientId === "cHome", r);
  const rec = db.t.threadClientMatch.find((m) => m.threadId === "tHome");
  ok("recorded in ThreadClientMatch (linked, certain, on phone)", rec && rec.status === "linked" && rec.confidence === "certain" && rec.matchedOn.includes("phone") && rec.companyId === CO);
  ok("a 'Client linked' line in the conversation", db.t.message.some((m) => m.threadId === "tHome" && m.direction === "activity" && m.activity?.type === "linked" && m.activity?.kind === "client"));
  ok("…and the message tagged with the homeowner's only active job", mrow(db, "mHome").jobId === "jHome" && mrow(db, "mHome").jobLinkedBy === JOB_LINKED_BY.ONLY_JOB);

  // "Not this client" — the existing undo, unchanged.
  const undo = await undoWebMatch({ prisma: db, companyId: CO, threadId: "tHome", matchId: rec.id, userId: "u1" });
  ok("undo: clientId back to null", undo.ok && undo.unlinked && thr(db, "tHome").clientId === null);
  ok("undo: the row is undone", rec.status === "undone");
  db.t.message.push({ id: "mHome2", threadId: "tHome", direction: "in", private: false, body: "again", sentAt: d("2026-10-06T15:00:00Z"), jobId: null, jobLinkedBy: null });
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tHome", messageId: "mHome2" });
  ok("an undone pair is never re-linked on the next message", thr(db, "tHome").clientId === null);
  const bf = await backfillCompany(db, { companyId: CO, apply: true });
  ok("…nor by the backfill", thr(db, "tHome").clientId === null && bf.threads.undone >= 1, bf.threads);
  await linkThreadByPhone(db, { companyId: CO, threadId: "tHome", phone: "+15145550101", body: "hi" });
  ok("…nor by the brought-number linker", thr(db, "tHome").clientId === null);
  ok("pairRefused reads it", (await pairRefused(db, { companyId: CO, threadId: "tHome", clientId: "cHome" })) === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Shared phone, another company, person's link, web, Meta, email");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = world();
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tShared", messageId: "mShared" });
  ok("two clients share the phone → not linked", thr(db, "tShared").clientId === null && !db.t.threadClientMatch.some((m) => m.threadId === "tShared"));
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tOnlyB", messageId: "mOnlyB" });
  ok("a phone only ANOTHER company holds → not linked", thr(db, "tOnlyB").clientId === null);
  await autoLinkOnArrival(db, { companyId: OTHER, threadId: "tB", messageId: "mB" });
  ok("company B's thread → company B's client, never A's", thr(db, "tB").clientId === "cB");
  ok("B's link never touched A's thread with the same phone", thr(db, "tHome").clientId === null);
  const cross = await autoLinkThreadClient(db, { companyId: OTHER, threadId: "tHome" });
  ok("company B cannot link company A's thread", cross.linked === false && thr(db, "tHome").clientId === null);
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tLinkedByPerson", messageId: null });
  ok("a person's link to another client stands", thr(db, "tLinkedByPerson").clientId === "cTwo");
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tWeb", messageId: "mWeb" });
  ok("a website chat is left to webChatMatch", thr(db, "tWeb").clientId === null);
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tFb", messageId: "mFb" });
  ok("a Messenger thread links on its lead's email", thr(db, "tFb").clientId === "cHome");
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tEmail", messageId: "mEmail" });
  ok("an email thread links on its address, any case", thr(db, "tEmail").clientId === "cHome");
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tTwo", messageId: "mT1" });
  ok("a WhatsApp wa_id (digits, no +) links", thr(db, "tTwo").clientId === "cTwo");
  db.t.message.find((m) => m.id === "mOut").threadId = "tHome";
  const out = await autoTagMessageJob(db, { companyId: CO, threadId: "tHome", messageId: "mOut", assumeClientId: "cHome" });
  ok("an OUTBOUND message is never tagged", out.tagged === false && out.reason === "not_inbound");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The job — homeowner, two jobs, overlap, contractor (pure + executed)");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = world();
  const jobsOf = (cid) => db.t.job.filter((j) => j.clientId === cid && j.status !== "cancelled").map((j) => db.shape("job", j));
  const client = (cid) => db.t.client.find((c) => c.id === cid);
  const TZ = "America/Toronto";

  ok("active: scheduled yes, cancelled no, completed 9 months ago no", activeJobsAt(jobsOf("cHome"), d("2026-10-05T15:00:00Z")).map((j) => j.id).join() === "jHome");
  ok("active: completed 29 days ago yes", activeJobsAt([{ id: "x", status: "completed", completedAt: d("2026-09-06T00:00:00Z"), createdAt: d("2026-08-01") }], d("2026-10-05T00:00:00Z")).length === 1);
  ok("active: completed 31 days ago no", activeJobsAt([{ id: "x", status: "completed", completedAt: d("2026-09-04T00:00:00Z"), createdAt: d("2026-08-01") }], d("2026-10-05T00:00:00Z")).length === 0);
  ok("active: a job whose quote did not exist yet → no", activeJobsAt([{ id: "x", status: "scheduled", createdAt: d("2026-10-01"), quote: { createdAt: d("2026-10-01") } }], d("2026-09-20")).length === 0);
  ok("active: archived → no", activeJobsAt([{ id: "x", status: "scheduled", archivedAt: d("2026-10-01"), createdAt: d("2026-01-01") }], d("2026-10-05")).length === 0);

  ok("homeowner, one active job → that job (only_job)", (() => { const r = decideMessageJob({ client: client("cHome"), jobs: jobsOf("cHome"), at: d("2026-10-05T15:00:00Z"), timeZone: TZ }); return r.kind === "link" && r.jobId === "jHome" && r.rule === "auto_only_job"; })());
  const t1 = decideMessageJob({ client: client("cTwo"), jobs: jobsOf("cTwo"), at: d("2026-10-06T18:00:00Z"), timeZone: TZ });
  ok("two jobs, the message inside jT1's day → jT1 by date", t1.kind === "link" && t1.jobId === "jT1" && t1.rule === "auto_date", t1);
  const t2 = decideMessageJob({ client: client("cTwo"), jobs: jobsOf("cTwo"), at: d("2026-10-10T20:00:00Z"), timeZone: TZ });
  ok("two jobs, the message on jT2's visit day → jT2 by date", t2.kind === "link" && t2.jobId === "jT2", t2);
  const tCancelledVisit = decideMessageJob({ client: client("cTwo"), jobs: jobsOf("cTwo").filter((j) => j.id === "jT2").concat([{ id: "jZ", status: "scheduled", createdAt: d("2026-01-01") }]), at: d("2026-10-06T20:00:00Z"), timeZone: TZ });
  ok("a CANCELLED visit's day contains nothing", tCancelledVisit.kind === "ask", tCancelledVisit);
  const tn = decideMessageJob({ client: client("cTwo"), jobs: jobsOf("cTwo"), at: d("2026-10-15T20:00:00Z"), timeZone: TZ });
  ok("two jobs, neither contains the day → ask", tn.kind === "ask" && tn.jobIds.length === 2, tn);
  const ov = decideMessageJob({ client: client("cOver"), jobs: jobsOf("cOver"), at: d("2026-10-06T16:00:00Z"), timeZone: TZ });
  ok("two jobs overlapping that day → ask (overlapping)", ov.kind === "ask" && ov.why === "overlapping", ov);
  const gin = decideMessageJob({ client: client("cGC"), jobs: jobsOf("cGC"), at: d("2026-10-07T02:00:00Z"), timeZone: TZ });
  ok("contractor, one job, message inside its window (Toronto day) → by date", gin.kind === "link" && gin.rule === "auto_date", gin);
  const gout = decideMessageJob({ client: client("cGC"), jobs: jobsOf("cGC"), at: d("2026-10-12T15:00:00Z"), timeZone: TZ });
  ok("contractor, one job, message OUTSIDE its window → ask, never 'only job'", gout.kind === "ask" && gout.why === "contractor_outside_window", gout);
  const gbefore = decideMessageJob({ client: client("cGC"), jobs: jobsOf("cGC"), at: d("2026-10-06T02:00:00Z"), timeZone: TZ });
  ok("the company's calendar day, not UTC's (Oct 5 22:00 Toronto is outside Oct 6–8)", gbefore.kind === "ask", gbefore);
  ok("no active job → none (no picker)", decideMessageJob({ client: client("cNoJob"), jobs: [], at: d("2026-10-06"), timeZone: TZ }).kind === "none");
  ok("jobContains: a start with no end is that one day", jobContains({ startDate: d("2026-10-06T00:00:00Z") }, d("2026-10-06T20:00:00Z"), TZ) && !jobContains({ startDate: d("2026-10-06T00:00:00Z") }, d("2026-10-08T20:00:00Z"), TZ));
  ok("jobContains: a recurring job with no end runs on", jobContains({ startDate: d("2026-10-06T00:00:00Z"), recurring: true }, d("2026-12-08T20:00:00Z"), TZ));

  // Executed: link + tag on arrival.
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tTwo", messageId: "mT1" });
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tTwo", messageId: "mT2" });
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tTwo", messageId: "mTnone" });
  ok("executed: two jobs + date window → the right job on each message", mrow(db, "mT1").jobId === "jT1" && mrow(db, "mT2").jobId === "jT2");
  ok("executed: outside both windows → untagged (left for 'Which job?')", mrow(db, "mTnone").jobId === null && mrow(db, "mTnone").jobLinkedBy === null);
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tOver", messageId: "mOver" });
  ok("executed: overlapping → untagged", mrow(db, "mOver").jobId === null && thr(db, "tOver").clientId === "cOver");
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tGC", messageId: "mGCout" });
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tGC", messageId: "mGCin" });
  ok("executed: contractor outside the window → NOT auto-tagged", mrow(db, "mGCout").jobId === null);
  ok("executed: contractor inside the window → tagged by date", mrow(db, "mGCin").jobId === "jGC" && mrow(db, "mGCin").jobLinkedBy === "auto_date");
  ok("executed: the thread itself is never filed to a job by this", thr(db, "tGC").jobId === null && thr(db, "tTwo").jobId === null);

  // A person's decision is never overwritten.
  const m = mrow(db, "mT1");
  m.jobId = "jT2";
  m.jobLinkedBy = "person";
  const again = await autoTagMessageJob(db, { companyId: CO, threadId: "tTwo", messageId: "mT1" });
  ok("a person's pick is never overwritten", again.tagged === false && m.jobId === "jT2" && m.jobLinkedBy === "person");
  const none = mrow(db, "mTnone");
  none.jobLinkedBy = "person";
  const noneAgain = await autoTagMessageJob(db, { companyId: CO, threadId: "tTwo", messageId: "mTnone" });
  ok("'Not about a job' stays decided", none.jobId === null && none.jobLinkedBy === "person");
  ok("…refused before any decision is made (not only by the write's guard)", noneAgain.reason === "decided", noneAgain);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The switch off → nothing automatic");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = world({ autoLink: false });
  const before = db.writes.length;
  const r = await autoLinkOnArrival(db, { companyId: CO, threadId: "tHome", messageId: "mHome" });
  ok("arrival: switched off, nothing written", r.ran === false && r.reason === "switched_off" && db.writes.length === before && thr(db, "tHome").clientId === null && mrow(db, "mHome").jobId === null);
  const bf = await backfillCompany(db, { companyId: CO, apply: true });
  ok("backfill: switched off, nothing written", bf.switchedOff === true && db.writes.length === before);
  const bn = await linkThreadByPhone(db, { companyId: CO, threadId: "tHome", phone: "+15145550101" });
  ok("brought-number linker: switched off, nothing written", bn.linked === false && thr(db, "tHome").clientId === null);
  db.t.company[0].autoLinkConversations = true;
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tHome", messageId: "mHome" });
  ok("switched back on → links", thr(db, "tHome").clientId === "cHome");
  // A company read that fails is "off", never a guess that writes.
  const broken = world();
  broken.company.findFirst = async () => { throw new Error("P1001"); };
  const rb = await autoLinkOnArrival(broken, { companyId: CO, threadId: "tHome", messageId: "mHome" });
  ok("an unreadable switch is off", rb.ran === false && thr(broken, "tHome").clientId === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The one-time backfill — dry run writes nothing; apply links");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = world();
  const before = db.writes.length;
  const dry = await backfillCompany(db, { companyId: CO });
  ok("dry run: no write at all", db.writes.length === before, db.writes.slice(before));
  ok("dry run: reports links (tHome, tGC, tTwo, tOver, tNoJob, tEmail, tFb)", dry.threads.linked === 7, dry.threads);
  ok("dry run: reports the shared number", dry.threads.ambiguous === 1, dry.threads);
  ok("dry run: messages counted against the would-be client", dry.messages.onlyJob >= 2 && dry.messages.byDate >= 3 && dry.messages.ask >= 3, dry.messages);
  const live = await backfillCompany(db, { companyId: CO, apply: true });
  ok("apply: the same links", live.threads.linked === 7 && thr(db, "tGC").clientId === "cGC" && thr(db, "tShared").clientId === null, live.threads);
  ok("apply: each recorded", db.t.threadClientMatch.filter((m) => m.companyId === CO && m.status === "linked").length === 7);
  ok("apply: never touched company B", thr(db, "tB").clientId === null && mrow(db, "mB").jobId === null);
  const second = await backfillCompany(db, { companyId: CO, apply: true });
  ok("a second run finds nothing new to link", second.threads.linked === 0, second.threads);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. 'Which job?' — the person's route, executed");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = world();
  thr(db, "tTwo").clientId = "cTwo";
  db.t.member.push(
    { id: "m_owner", userId: "u_owner", role: "owner", companyId: CO, permissions: null },
    { id: "m_crew", userId: "u_crew", role: "employee", companyId: CO, permissions: { ...PERMISSION_PRESETS.worker.values } },
  );
  const route = await import("../app/api/messaging/threads/[id]/messages/[messageId]/job/route.js");
  const post = (threadId, messageId, body) =>
    route.POST(new Request("http://x.test/", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({ id: threadId, messageId }) });

  globalThis.__FQ_SESSION = { id: "m_owner", userId: "u_owner", role: "owner", companyId: CO };
  let r = await post("tTwo", "mTnone", { jobId: "jT1" });
  ok("owner picks this client's job → 200, person", r.status === 200 && mrow(db, "mTnone").jobId === "jT1" && mrow(db, "mTnone").jobLinkedBy === "person", r.status);
  r = await post("tTwo", "mTnone", { jobId: "jHome" });
  ok("another client's job → 400, nothing changed", r.status === 400 && mrow(db, "mTnone").jobId === "jT1");
  r = await post("tTwo", "mTnone", { jobId: "jB" });
  ok("another company's job → refused, nothing changed", r.status >= 400 && r.status < 500 && mrow(db, "mTnone").jobId === "jT1", r.status);
  r = await post("tB", "mB", { jobId: null });
  ok("another company's thread → 404", r.status === 404 && mrow(db, "mB").jobLinkedBy === null);
  r = await post("tTwo", "mTnone", { jobId: null });
  ok("'Not about a job' → jobId null, decided", r.status === 200 && mrow(db, "mTnone").jobId === null && mrow(db, "mTnone").jobLinkedBy === "person");
  r = await post("tTwo", "mTnone", { jobId: 42 });
  ok("a malformed jobId → 400", r.status === 400);
  r = await post("tShared", "mShared", { jobId: "jHome" });
  ok("a thread with no client → 409 (link the client first)", r.status === 409);

  globalThis.__FQ_SESSION = { id: "m_crew", userId: "u_crew", role: "employee", companyId: CO };
  r = await post("tTwo", "mT1", { jobId: "jT1" });
  ok("crew → 403, nothing written", r.status === 403 && mrow(db, "mT1").jobLinkedBy === null);
  globalThis.__FQ_SESSION = { id: "m_owner", userId: "u_owner", role: "owner", companyId: CO, impersonation: { mode: "read_only" } };
  r = await post("tTwo", "mT1", { jobId: "jT1" });
  ok("support session → 403", r.status === 403 && mrow(db, "mT1").jobLinkedBy === null);
  globalThis.__FQ_SESSION = null;
  r = await post("tTwo", "mT1", { jobId: "jT1" });
  ok("nobody → 401", r.status === 401);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The job page's timeline places a message by its tag");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = world();
  thr(db, "tTwo").clientId = "cTwo";
  // jT1's window: created Aug 1, completed Oct 1 → open to Oct 31. mT1
  // (Oct 6) is INSIDE that window but tagged to jT2: the tag must keep it
  // off jT1's narrowed timeline. mOld (Jul 1) is BEFORE the window but
  // tagged to jT1: the tag must put it on.
  mrow(db, "mT1").jobId = "jT2";
  mrow(db, "mT2").jobId = "jT1";
  db.t.job.find((j) => j.id === "jT1").completedAt = d("2026-10-01T00:00:00Z");
  db.t.job.find((j) => j.id === "jT1").createdAt = d("2026-08-01T00:00:00Z");
  db.t.message.push({ id: "mOld", threadId: "tTwo", direction: "in", private: false, body: "old", sentAt: d("2026-07-01T00:00:00Z"), jobId: "jT1", jobLinkedBy: "person" });
  const job = (id) => { const j = db.t.job.find((x) => x.id === id); return { id: j.id, clientId: j.clientId, quoteId: j.quoteId, createdAt: j.createdAt, completedAt: j.completedAt }; };
  const access = { read: true, contacts: true, calls: false, support: false, reply: false, link: false };
  const onT1 = await loadClientTimeline(db, { companyId: CO, clientId: "cTwo", job: job("jT1"), access });
  const keys1 = onT1.entries.map((e) => e.key);
  ok("a message tagged to this job shows, even outside its window", keys1.includes("m:mOld") && keys1.includes("m:mT2"), keys1);
  ok("…and it is marked explicit", onT1.entries.find((e) => e.key === "m:mOld")?.explicit === true);
  ok("a message tagged to ANOTHER job does not show on this job's narrowed timeline", !keys1.includes("m:mT1"), keys1);
  const all = await loadClientTimeline(db, { companyId: CO, clientId: "cTwo", job: job("jT1"), scope: "all", access });
  ok("'All of this client's messages' still shows everything", ["m:mT1", "m:mT2", "m:mOld"].every((k) => all.entries.some((e) => e.key === k)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The tenant fence — every query a company-scoped read names companyId");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = world();
  await backfillCompany(db, { companyId: CO, apply: true });
  await autoLinkOnArrival(db, { companyId: CO, threadId: "tGC", messageId: "mGCin" });
  const SCOPED = new Set(["client", "messageThread", "job", "threadClientMatch", "leadRequest", "company"]);
  const unfenced = db.calls.filter((c) => SCOPED.has(c.model) && c.op !== "update" && !JSON.stringify(c.where).includes(c.model === "company" ? '"id"' : '"companyId"'));
  ok("every read of a company-scoped model names its company", unfenced.length === 0, unfenced.slice(0, 3));
  const msgReads = db.calls.filter((c) => c.model === "message" && (c.op === "findMany" || c.op === "findFirst"));
  ok("every message read goes through its thread's company", msgReads.length > 0 && msgReads.every((c) => JSON.stringify(c.where).includes('"thread":{"companyId"') || JSON.stringify(c.where).includes('"companyId"')), msgReads.slice(0, 2));
  const raw = db.calls.filter((c) => c.raw);
  ok("the phone pre-filter SQL is fenced", raw.length > 0 && raw.every((c) => c.where.companyId === CO));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The wiring — read from source");
// ═══════════════════════════════════════════════════════════════════════════
{
  const ingest = src("lib/messaging/ingest.js");
  ok("ingest calls autoLinkOnArrival", /await autoLinkOnArrival\(db, \{ companyId, threadId: thread\.id, messageId: stored\?\.id \|\| null \}\)/.test(ingest));
  ok("…only for a new inbound message that is not history", /if \(created && event\.direction === "in" && !history\) \{\s*await autoLinkOnArrival/.test(ingest));
  ok("…after lead capture (a Messenger thread's email exists only then)", ingest.indexOf("captureLeadFromConversation({") < ingest.indexOf("await autoLinkOnArrival("));
  const mail = src("lib/mailbox/file.js");
  ok("mailbox: an undone pair is not re-filled", mail.includes("pairRefused(db,") && mail.includes("!thread.clientId && !refused && match.kind === \"client\""));
  ok("mailbox: the link is recorded, the message tagged", mail.includes("recordAutoLink(db,") && mail.includes("autoLinkOnArrival(db,"));
  const bn = src("lib/businessNumber/conversation.js");
  ok("brought number: switch, undone pair, recorded, contractor not filed by 'open job'", bn.includes("autoLinkEnabled(prisma, companyId)") && bn.includes("pairRefused(prisma,") && bn.includes("recordAutoLink(prisma,") && bn.includes("isContractorClient(client)"));
  const route = src("app/api/messaging/threads/[id]/route.js");
  ok("thread route: jobId / jobLinkedBy selected and jobChoices returned", route.includes("jobLinkedBy: true") && route.includes("jobChoices: jobs?.choices || null") && route.includes("jobAsk: Boolean(jobs?.asks.has(m.id))"));
  ok("thread route: no choices for a member scoped to their own jobs", /hasLevel\(full, "jobs", "view_only"\) \|\| seesOnlyAssignedJobs\(full\)\) return null/.test(route));
  const page = src("app/app/messages/page.js");
  ok("Messages draws the chip under a message", page.includes("<MessageJobChip item={item} thread={thread} canEdit={canEdit} onChanged={onChanged} t={t} />"));
  const chip = src("app/components/messaging/MessageJobChip.js");
  ok("the chip posts to the per-message job route", chip.includes("/messages/${encodeURIComponent(item.id)}/job`") && chip.includes('value === "none" ? null : value'));
  ok("the chip's controls are tall enough to tap", (chip.match(/min-h-\[(32|36|44)px\]/g) || []).length >= 4);
  const bar = src("app/components/messaging/WebMatchBar.js");
  ok("'Not this client' in Messages for every automatic link, not only the web chat", bar.includes("const eligible = Boolean(thread?.clientId);") && bar.includes("app.messages.autoLink.line"));
  const respond = src("lib/aiEmployee/respond.js");
  ok("the assistant treats a Messenger/Instagram auto-link as typed (privacy note)", respond.includes('["web", "facebook", "instagram"].includes(thread?.channel?.platform)'));
  const setting = src("app/app/settings/messages/page.js");
  ok("the setting is on the Client messages page and writes through its route", setting.includes("<ConversationLinking />") && setting.includes('"/api/settings/conversation-linking"') && setting.includes('role="switch"'));
  const sroute = src("app/api/settings/conversation-linking/route.js");
  ok("the setting's write: owners/admins, never a support session, logged", sroute.includes('requirePermission(member.role, "user:manage")') && sroute.includes("member.impersonation") && sroute.includes("recordActivity("));
  const schema = src("prisma/schema.prisma");
  ok("schema: Company.autoLinkConversations default true", /autoLinkConversations Boolean @default\(true\)/.test(schema));
  ok("schema: Message.jobId / jobLinkedBy, indexed", /\n  jobId       String\?\n/.test(schema) && /\n  jobLinkedBy String\?\n/.test(schema) && schema.includes("@@index([jobId])"));
  const lib = src("lib/conversations/autoLink.js");
  ok("the switch is read by every automatic path in autoLink.js", (lib.match(/autoLinkEnabled\(db, companyId\)/g) || []).length >= 2);

  const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");
  const keys = [...new Set([...chip.matchAll(/"(app\.messages\.jobTag\.[A-Za-z]+)"/g), ...setting.matchAll(/"(app\.setMessages\.autoLink\.[A-Za-z]+)"/g), ...bar.matchAll(/"(app\.messages\.autoLink\.[A-Za-z]+)"/g)].map((m) => m[1]))];
  ok("the new keys were found", keys.length >= 15, keys.length);
  for (const [lang, table] of Object.entries(APP_MESSAGES)) {
    const missing = keys.filter((k) => typeof table[k] !== "string" || !table[k].trim());
    ok(`${lang}: every new key`, missing.length === 0, missing);
  }
  const pkg = JSON.parse(src("package.json"));
  ok("package.json: check:all runs check:inbox-autolink", pkg.scripts["check:all"].includes("check:inbox-autolink"));
}

console.log(`\ncheck-inbox-autolink: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
