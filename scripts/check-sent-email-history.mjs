// scripts/check-sent-email-history.mjs
//
//   npm run check:sent-email-history
//
// The "History" tab — every document email kept as it was sent (owner,
// 2026-10-05; lib/email/sentEmailHistory.js) — EXECUTED against an in-memory
// database holding two companies (scripts/fixtures/fakePrisma.mjs):
//
//   · recordSentEmail keeps the subject, body, recipients, sender and time —
//     and keeps NOTHING for a send that failed or was skipped, and never
//     throws into a send;
//   · every send path hands it the very subject / html / text it handed to
//     sendEmail, after the refusal returns (read from source — a payload
//     diff, not a vibe);
//   · the client page's and the job page's History, executed through their
//     routes: kept sends with "View email", pre-feature sends with the honest
//     "wasn't kept before …" line, a kept send's log row not listed twice;
//   · who reads what: the crew (scoped to their own jobs) get a 403; an
//     office member without showPricing sees what went and when but no
//     subject and no text (the viewer answers 403 money_hidden); without
//     invoices, no invoice email at all; another company's row, never;
//   · the Conversation timeline links a kept send's "View email" and says
//     an old one's text was not kept;
//   · the viewer draws the email in an EMPTY sandbox.

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

const H = await import("@/lib/email/sentEmailHistory");
const { recordSentEmail, historyAccess, loadEmailHistory, loadSentEmail, SENT_EMAIL_HISTORY_SINCE, kindCategory, legacyKind } = H;
const { hasLevel, hasToggle, seesOnlyAssignedJobs } = await import("@/lib/permissions/enforce");
const { PERMISSION_PRESETS } = await import("@/lib/permissions");
const { loadClientTimeline } = await import("@/lib/conversations/clientTimeline");

const CO = "coA";
const OTHER = "coB";
const d = (s) => new Date(s);

function world() {
  const tables = {
    company: [{ id: CO }, { id: OTHER }],
    client: [
      { id: "cJane", companyId: CO, name: "Jane", email: "jane@x.test", phone: null, type: "individual" },
      { id: "cB", companyId: OTHER, name: "B", email: "b@x.test", phone: null, type: "individual" },
    ],
    quote: [
      { id: "q1", companyId: CO, clientId: "cJane", quoteNumber: "Q-2026-0001", createdAt: d("2026-09-01") },
      { id: "q2", companyId: CO, clientId: "cJane", quoteNumber: "Q-2026-0002", createdAt: d("2026-09-15") },
    ],
    invoice: [
      { id: "i1", companyId: CO, clientId: "cJane", invoiceNumber: "INV-1", jobId: "j1", quoteId: "q1" },
      { id: "i2", companyId: CO, clientId: "cJane", invoiceNumber: "INV-2", jobId: "j2", quoteId: "q2" },
    ],
    job: [
      { id: "j1", companyId: CO, clientId: "cJane", quoteId: "q1", createdAt: d("2026-09-02"), completedAt: null, status: "scheduled" },
      { id: "j2", companyId: CO, clientId: "cJane", quoteId: "q2", createdAt: d("2026-09-16"), completedAt: null, status: "scheduled" },
    ],
    activityLog: [
      // Before the text was kept.
      { id: "alOld", companyId: CO, action: "quote.sent", entityType: "quote", entityId: "q1", actorName: "Dana", metadata: { to: "jane@x.test", total: 1200 }, createdAt: d("2026-09-03T12:00:00Z") },
      { id: "alOldInv", companyId: CO, action: "invoice.sent", entityType: "invoice", entityId: "i1", actorName: "Dana", metadata: { to: "jane@x.test", total: 1200 }, createdAt: d("2026-09-20T12:00:00Z") },
      // A kept send's own log row — must not be listed twice.
      { id: "alKept", companyId: CO, action: "invoice.sent", entityType: "invoice", entityId: "i2", actorName: "Dana", metadata: { to: "jane@x.test", sentEmailId: "se_inv2" }, createdAt: d("2026-10-06T12:00:00Z") },
      // Another company's log about our quote id — never.
      { id: "alB", companyId: OTHER, action: "quote.sent", entityType: "quote", entityId: "q1", actorName: "Eve", metadata: { to: "x@x" }, createdAt: d("2026-10-01") },
    ],
    sentEmail: [
      { id: "se_inv2", companyId: CO, clientId: "cJane", jobId: "j2", quoteId: "q2", invoiceId: "i2", kind: "invoice", subject: "Invoice INV-2 from Co — $2,400.00", html: "<p>Pay $2,400.00</p><script>alert(1)</script>", text: "Pay $2,400.00", toAddresses: "jane@x.test", ccAddresses: null, fromAddress: "Co <billing@co.test>", replyTo: "office@co.test", attachments: null, sentByUserId: "u_owner", sentByName: "Dana", via: "resend", providerId: "re_1", language: "en", createdAt: d("2026-10-06T12:00:00Z") },
      { id: "se_q2", companyId: CO, clientId: "cJane", jobId: null, quoteId: "q2", invoiceId: null, kind: "quote", subject: "Your quote Q-2026-0002 — $2,400.00", html: "<p>Quote</p>", text: "Quote", toAddresses: "jane@x.test", ccAddresses: null, fromAddress: "Co <q@co.test>", replyTo: null, attachments: [{ filename: "Quote-Q-2026-0002.pdf" }], sentByUserId: "u_owner", sentByName: "Dana", via: "resend", providerId: "re_2", language: "en", createdAt: d("2026-10-05T12:00:00Z") },
      { id: "se_rem", companyId: CO, clientId: "cJane", jobId: "j1", quoteId: "q1", invoiceId: "i1", kind: "reminder", subject: "Reminder: $1,200.00 for INV-1", html: "<p>r</p>", text: "r", toAddresses: "jane@x.test", ccAddresses: null, fromAddress: null, replyTo: null, attachments: null, sentByUserId: null, sentByName: null, via: "resend", providerId: null, language: "en", createdAt: d("2026-10-07T12:00:00Z") },
      // Another company's row claiming our client — never shown.
      { id: "se_B", companyId: OTHER, clientId: "cJane", jobId: null, quoteId: "q1", invoiceId: null, kind: "quote", subject: "LEAK", html: "LEAK", text: "LEAK", toAddresses: "x", createdAt: d("2026-10-08T12:00:00Z") },
    ],
    member: [
      { id: "m_owner", userId: "u_owner", role: "owner", companyId: CO, permissions: null },
      { id: "m_crew", userId: "u_crew", role: "employee", companyId: CO, permissions: { ...PERMISSION_PRESETS.worker.values } },
      { id: "m_nomoney", userId: "u_nm", role: "employee", companyId: CO, permissions: { ...PERMISSION_PRESETS.dispatcher.values, quotes: "view_only", invoices: "view_only", jobs: "view_create_edit", clientsProperties: "full_view", showPricing: false } },
      { id: "m_noinv", userId: "u_ni", role: "employee", companyId: CO, permissions: { ...PERMISSION_PRESETS.estimator.values, quotes: "view_only", invoices: "none", jobs: "view_create_edit", clientsProperties: "full_view", showPricing: true } },
    ],
    user: [{ id: "u_owner", name: "Dana", email: "dana@co.test" }],
    messageThread: [],
    message: [],
    leadRequest: [],
    threadClientMatch: [],
    voiceCall: [],
    clientTicket: [],
    clientTicketMessage: [],
    smsDelivery: [],
  };
  const db = new FakePrisma(tables, {
    messageThread: { channel: [(r) => r.channel || null, "messagingChannel"] },
    leadRequest: { quote: [() => null, "quote"] },
    clientTicketMessage: { ticket: [() => null, "clientTicket"] },
    message: { email: [() => null, "emailMessage"] },
  });
  globalThis.__FQ_DB = db;
  return db;
}

const accessFor = (db, memberId, extra = {}) => {
  const full = db.t.member.find((m) => m.id === memberId);
  return historyAccess({ member: { ...full, ...extra }, full, hasLevel, hasToggle, seesOnlyAssignedJobs });
};

// ═══════════════════════════════════════════════════════════════════════════
section("1. recordSentEmail — what a send keeps, and when it keeps nothing");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = world();
  const mail = { to: "jane@x.test", from: "Co <q@co.test>", replyTo: "office@co.test", subject: "Your quote Q-1", html: "<p>Hello</p>", text: "Hello", attachments: [{ filename: "Quote-Q-1.pdf", content: Buffer.from("PDFBYTES") }] };
  const id = await recordSentEmail(db, { companyId: CO, kind: "quote", clientId: "cJane", quoteId: "q1", mail, result: { id: "re_9" }, sentByUserId: "u_owner", sentByName: "Dana", language: "fr" });
  const row = db.t.sentEmail.find((r) => r.id === id);
  ok("a quote send stores its subject, html and text", row && row.subject === mail.subject && row.html === mail.html && row.text === mail.text);
  ok("…its recipients, sender and reply-to", row.toAddresses === "jane@x.test" && row.fromAddress === mail.from && row.replyTo === mail.replyTo);
  ok("…who sent it and the provider id", row.sentByUserId === "u_owner" && row.sentByName === "Dana" && row.providerId === "re_9" && row.via === "resend");
  ok("…the attachment's NAME, never its bytes", JSON.stringify(row.attachments) === JSON.stringify([{ filename: "Quote-Q-1.pdf" }]));
  ok("…the document's language and its company", row.language === "fr" && row.companyId === CO);
  const n = db.t.sentEmail.length;
  ok("a refused send keeps nothing", (await recordSentEmail(db, { companyId: CO, kind: "quote", mail, result: { error: "rejected" } })) === null && db.t.sentEmail.length === n);
  ok("a skipped send (no mail configured) keeps nothing", (await recordSentEmail(db, { companyId: CO, kind: "quote", mail, result: { skipped: true } })) === null && db.t.sentEmail.length === n);
  ok("an unknown kind keeps nothing", (await recordSentEmail(db, { companyId: CO, kind: "marketing", mail, result: {} })) === null);
  ok("no company keeps nothing", (await recordSentEmail(db, { kind: "quote", mail, result: {} })) === null);
  const mbox = await recordSentEmail(db, { companyId: CO, kind: "invoice", mail, result: { id: "m1", via: "mailbox" } });
  ok("a send through the company's own mailbox says so", db.t.sentEmail.find((r) => r.id === mbox).via === "mailbox");
  const demo = await recordSentEmail(db, { companyId: CO, kind: "invoice", mail, result: { simulated: true } });
  ok("a demo's simulated send says so", db.t.sentEmail.find((r) => r.id === demo).via === "demo");
  const broken = world();
  broken.sentEmail.create = async () => { throw new Error("P1001"); };
  let threw = false;
  try { ok("a failed write returns null", (await recordSentEmail(broken, { companyId: CO, kind: "quote", mail, result: {} })) === null); } catch { threw = true; }
  ok("…and never throws into the send", !threw);
  ok("kinds map to their permission", kindCategory("quote_follow_up") === "quotes" && kindCategory("receipt") === "invoices" && kindCategory("deposit") === "invoices" && kindCategory("job_follow_up") === "jobs");
  ok("old log actions map to kinds", legacyKind("invoice.chased") === "reminder" && legacyKind("quote.followed_up") === "quote_follow_up");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Every send path keeps exactly what it sent, after it was accepted");
// ═══════════════════════════════════════════════════════════════════════════
{
  const PATHS = [
    ["app/api/quotes/[id]/send/route.js", /isFollowUp \? "quote_follow_up" : "quote"/, "mail: { to, from, replyTo, subject, html, text, attachments }", "result,", /if \(result\?\.error\) \{/],
    ["app/api/invoices/[id]/send/route.js", /ask\.stage \? "deposit" : "invoice"/, "mail: { to, from, replyTo, subject, html, text }", "result,", /if \(result\?\.error\) \{/],
    ["app/api/invoices/[id]/request-payment/route.js", /kind: mode === "balance" \? "reminder" : mode === "next_stage" \? "deposit" : "invoice"/, "mail: { to: invoice.client.email, from, replyTo, subject, html, text }", "result,", /if \(result\?\.error\) \{/],
    ["app/api/cron/follow-ups/route.js", /quote: "quote_follow_up", invoice: "reminder", job: "job_follow_up"/, "mail: { to, subject, html, text, from: sender?.from || null, replyTo: sender?.replyTo || null }", "result,", /if \(outcome\.ok\) \{/],
    ["lib/paymentSchedule/run.js", /kind: "deposit"/, "mail: { to: client.email, from, replyTo, subject, html, text }", "result: sent,", /if \(sent\?\.error \|\| sent\?\.skipped\) \{/],
    ["lib/servicePlans/run.js", /kind: kind === "paid" \? "receipt" : "invoice"/, "mail: { to: client.email, from, replyTo, subject, html, text }", "result: sent,", /if \(sent\?\.error \|\| sent\?\.skipped\) \{/],
    ["app/api/public/quotes/[token]/route.js", /kind: "quote_signed_copy"/, "mail: { to: clientTo, from, replyTo, subject: signedSubject, html, text, attachments }", "result: signedResult,", /const signedResult = await sendEmail\(/],
  ];
  for (const [p, kindRe, mailLine, resultLine, guardRe] of PATHS) {
    const s = src(p);
    const at = s.indexOf("recordSentEmail(");
    const call = at >= 0 ? s.slice(at, at + 900) : "";
    ok(`${p}: calls recordSentEmail`, at >= 0);
    ok(`${p}: the right kind`, kindRe.test(call) || kindRe.test(s.slice(Math.max(0, at - 400), at + 900)), call.slice(0, 200));
    ok(`${p}: hands it what it handed sendEmail`, call.includes(mailLine), call.slice(0, 400));
    ok(`${p}: and sendEmail's own answer`, call.includes(resultLine));
    const guard = s.search(guardRe);
    ok(`${p}: only after the send's failure path`, guard >= 0 && guard < at);
  }
  const q = src("app/api/quotes/[id]/send/route.js");
  ok("quote send: the log row carries sentEmailId", q.includes("...(sentEmailId ? { sentEmailId } : {})"));
  ok("quote send: sendEmail was given the same subject/html/text", q.includes("sendEmail({ companyId: member.companyId, to, subject, html, text, from, replyTo, attachments, clientMail: true })"));
  const inv = src("app/api/invoices/[id]/send/route.js");
  ok("invoice send: sendEmail was given the same subject/html/text", inv.includes("sendEmail({ companyId: member.companyId, to, subject, html, text, from, replyTo, clientMail: true })") && inv.includes("...(sentEmailId ? { sentEmailId } : {})"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. History renders — the routes, executed");
// ═══════════════════════════════════════════════════════════════════════════
const clientRoute = await import("../app/api/clients/[id]/email-history/route.js");
const jobRoute = await import("../app/api/jobs/[id]/email-history/route.js");
const viewRoute = await import("../app/api/sent-emails/[id]/route.js");
const get = async (route, id) => {
  const r = await route.GET(new Request("http://x.test/"), { params: Promise.resolve({ id }) });
  return { status: r.status, body: await r.json() };
};
{
  const db = world();
  globalThis.__FQ_SESSION = { id: "m_owner", userId: "u_owner", role: "owner", companyId: CO };
  const r = await get(clientRoute, "cJane");
  const keys = r.body.entries?.map((e) => e.key) || [];
  ok("owner → 200", r.status === 200, r.status);
  ok("kept sends listed, newest first", keys[0] === "se:se_rem" && keys.includes("se:se_inv2") && keys.includes("se:se_q2"), keys);
  ok("a kept send's log row is not listed twice", !keys.includes("al:alKept"), keys);
  ok("pre-feature sends listed from the log", keys.includes("al:alOld") && keys.includes("al:alOldInv"), keys);
  ok("another company's rows never", !keys.includes("se:se_B") && !keys.includes("al:alB") && !JSON.stringify(r.body).includes("LEAK"));
  const old = r.body.entries.find((e) => e.key === "al:alOld");
  ok("a pre-feature send: kept false, before keeping, with the date the text began to be kept", old.kept === false && old.beforeKeeping === true && new Date(old.keptSince).getTime() === SENT_EMAIL_HISTORY_SINCE.getTime());
  ok("…and when and to whom it went", old.to === "jane@x.test" && old.by === "Dana" && new Date(old.at).getTime() === d("2026-09-03T12:00:00Z").getTime() && old.number === "Q-2026-0001");
  const inv2 = r.body.entries.find((e) => e.key === "se:se_inv2");
  ok("a kept send: subject, number, sender, id to open", inv2.kept && inv2.subject.includes("$2,400.00") && inv2.number === "INV-2" && inv2.by === "Dana" && inv2.id === "se_inv2");
  ok("an automatic send says so", r.body.entries.find((e) => e.key === "se:se_rem").automatic === true);
  ok("the list never carries a body", !JSON.stringify(r.body).includes("<p>Pay"));
  ok("can.readText true for the owner", r.body.can?.readText === true);

  const v = await get(viewRoute, "se_inv2");
  ok("view: the whole email for the owner", v.status === 200 && v.body.email.html.includes("Pay $2,400.00") && v.body.email.text === "Pay $2,400.00" && v.body.email.from === "Co <billing@co.test>" && v.body.email.to === "jane@x.test");
  const vB = await get(viewRoute, "se_B");
  ok("view: another company's row → 404", vB.status === 404 && !JSON.stringify(vB.body).includes("LEAK"));

  const j = await get(jobRoute, "j1");
  const jk = j.body.entries?.map((e) => e.key) || [];
  ok("job page: its own quote's / invoice's sends only", j.status === 200 && jk.includes("se:se_rem") && jk.includes("al:alOld") && jk.includes("al:alOldInv") && !jk.includes("se:se_inv2") && !jk.includes("se:se_q2"), jk);
  const j2 = await get(jobRoute, "j2");
  const jk2 = j2.body.entries.map((e) => e.key);
  ok("job 2: its quote email and its invoice", jk2.includes("se:se_q2") && jk2.includes("se:se_inv2") && !jk2.includes("se:se_rem"), jk2);
  const jx = await get(jobRoute, "nope");
  ok("an unknown job → 404", jx.status === 404);
  const cx = await get(clientRoute, "cB");
  ok("another company's client → 404", cx.status === 404);
  // The fence in the QUERY, not only the JS re-check behind it.
  const scoped = db.calls.filter((c) => ["sentEmail", "activityLog", "quote", "invoice", "client", "job"].includes(c.model));
  const unfenced = scoped.filter((c) => !JSON.stringify(c.where).includes('"companyId"'));
  ok("every History read names the company", scoped.length > 10 && unfenced.length === 0, unfenced.slice(0, 3));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Who may read what — crew, no prices, no invoices, support");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = world();
  globalThis.__FQ_SESSION = { id: "m_crew", userId: "u_crew", role: "employee", companyId: CO };
  ok("crew is scoped to their own jobs (fixture sanity)", seesOnlyAssignedJobs(db.t.member.find((m) => m.id === "m_crew")) === true);
  const c1 = await get(clientRoute, "cJane");
  const c2 = await get(jobRoute, "j1");
  const c3 = await get(viewRoute, "se_inv2");
  ok("crew → client History 403", c1.status === 403 && c1.body.reason === "no_history_access");
  ok("crew → job History 403", c2.status === 403);
  ok("crew → cannot read the invoice email (no amount reaches them)", c3.status === 403 && !JSON.stringify(c3.body).includes("2,400"));

  globalThis.__FQ_SESSION = { id: "m_nomoney", userId: "u_nm", role: "employee", companyId: CO };
  const nm = await get(clientRoute, "cJane");
  ok("office, prices hidden → 200 (what went, when, to whom)", nm.status === 200 && nm.body.entries.length >= 4, nm.status);
  ok("…no subject on any row (the subject names the amount)", nm.body.entries.every((e) => e.subject === null) && !JSON.stringify(nm.body).includes("2,400"));
  ok("…and the row says why", nm.body.entries.filter((e) => e.kept).every((e) => e.textHidden === true) && nm.body.can.readText === false);
  const nv = await get(viewRoute, "se_inv2");
  ok("…the invoice email itself → 403 money_hidden, no amount", nv.status === 403 && nv.body.reason === "money_hidden" && !JSON.stringify(nv.body).includes("2,400"));

  globalThis.__FQ_SESSION = { id: "m_noinv", userId: "u_ni", role: "employee", companyId: CO };
  const ni = await get(clientRoute, "cJane");
  const nik = ni.body.entries.map((e) => e.key);
  ok("no invoices access → no invoice email listed, quote emails are", ni.status === 200 && !nik.includes("se:se_inv2") && !nik.includes("se:se_rem") && !nik.includes("al:alOldInv") && nik.includes("se:se_q2") && nik.includes("al:alOld"), nik);
  const niv = await get(viewRoute, "se_inv2");
  ok("…and opening one by id → 404", niv.status === 404);

  globalThis.__FQ_SESSION = { id: "m_owner", userId: "u_owner", role: "owner", companyId: CO, impersonation: { mode: "read_only" } };
  const sup = await get(clientRoute, "cJane");
  ok("a support session reads (the console views everything)", sup.status === 200 && sup.body.entries.length >= 5);
  globalThis.__FQ_SESSION = null;
  ok("nobody → 401", (await get(clientRoute, "cJane")).status === 401);

  const a = accessFor(db, "m_nomoney");
  ok("historyAccess: office, quotes, invoices, no money", a.read && a.office && a.quotes && a.invoices && !a.money);
  const own = await loadSentEmail(db, { companyId: CO, id: "se_q2", access: accessFor(db, "m_owner") });
  ok("loadSentEmail: attachment names come back", own.email.attachments[0].filename === "Quote-Q-2026-0002.pdf");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The Conversation timeline links a kept send, and says an old one wasn't kept");
// ═══════════════════════════════════════════════════════════════════════════
{
  const db = world();
  const access = { read: true, contacts: true, calls: false, support: false, reply: false, link: false };
  const tl = await loadClientTimeline(db, { companyId: CO, clientId: "cJane", access });
  const kept = tl.entries.find((e) => e.key === "se:se_inv2");
  ok("a kept send is an entry with its emailId", kept && kept.emailId === "se_inv2" && kept.kept === true && kept.labelKey === "app.conversation.doc.invoiceSent" && kept.labelParams.number === "INV-2");
  ok("a reminder has its own label", tl.entries.find((e) => e.key === "se:se_rem")?.labelKey === "app.conversation.doc.reminderSent");
  const old = tl.entries.find((e) => e.key === "doc:alOld");
  ok("an old send: no emailId, kept false, before keeping", old && old.emailId === null && old.kept === false && old.beforeKeeping === true);
  ok("a kept send's log row is not a second entry", !tl.entries.some((e) => e.key === "doc:alKept"));
  ok("another company's kept row never", !tl.entries.some((e) => e.key === "se:se_B"));
  ok("the email chip is offered", tl.channels.includes("email"));
  // j1's window: its quote's creation (Sep 1) to completion + 30 days —
  // completed Sep 4, so it closes Oct 4. Its own reminder (Oct 7) still
  // shows; INV-2's email (Oct 6, job 2) does not.
  const tj = await loadClientTimeline(db, { companyId: CO, clientId: "cJane", job: { id: "j1", clientId: "cJane", quoteId: "q1", createdAt: d("2026-09-02T00:00:00Z"), completedAt: d("2026-09-04T00:00:00Z") }, access });
  ok("job page: its own kept send is explicit, whatever its date", tj.entries.find((e) => e.key === "se:se_rem")?.explicit === true);
  ok("job page: another job's kept send outside the window is not shown", !tj.entries.some((e) => e.key === "se:se_inv2"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The screens — read from source");
// ═══════════════════════════════════════════════════════════════════════════
{
  const viewer = src("app/components/conversations/SentEmailViewer.js");
  ok("the viewer draws the HTML in an EMPTY sandbox (no script, no navigation)", /<iframe[\s\S]{0,200}sandbox=""[\s\S]{0,60}srcDoc=\{email\.html\}/.test(viewer));
  ok("the viewer reads one kept email by its route", viewer.includes("/api/sent-emails/${encodeURIComponent(emailId)}`"));
  ok("the viewer shows the route's refusal sentence", viewer.includes("setError(err.message"));
  const hist = src("app/components/conversations/EmailHistory.js");
  ok("History says an old send's text wasn't kept, with the date", hist.includes('t("app.emailHistory.notKept", { date:'));
  ok("History offers 'View email' only for a kept, readable send", hist.includes("e.kept && !e.textHidden && e.id ?"));
  ok("History hides itself on a refusal and tells the tabs", hist.includes("err.status === 403 || err.status === 404") && hist.includes("onHidden?.()"));
  const tabs = src("app/components/conversations/ConversationTabs.js");
  ok("the tabs: Conversation and History, a refused one dropped", tabs.includes("<EmailHistory clientId={clientId} jobId={jobId} onHidden={hideHist} />") && tabs.includes("if (convHidden && histHidden) return null;") && tabs.includes('role="tablist"'));
  ok("the client page renders the tabs", src("app/app/clients/[id]/page.js").includes("<ConversationTabs clientId={client.id} />"));
  ok("the job page renders the tabs", src("app/app/jobs/[id]/JobDetail.js").includes("<ConversationTabs jobId={job.id} />"));
  const cc = src("app/components/conversations/ClientConversation.js");
  ok("the timeline opens a kept send ('View email')", cc.includes('t("app.conversation.doc.viewEmail")') && cc.includes("<SentEmailViewer emailId={viewEmail}"));
  ok("the timeline says an old send's text wasn't kept", cc.includes('t("app.conversation.doc.notKept")'));
  for (const p of ["app/api/clients/[id]/email-history/route.js", "app/api/jobs/[id]/email-history/route.js", "app/api/sent-emails/[id]/route.js"]) {
    const s = src(p);
    ok(`${p}: params awaited, graded member, historyAccess`, s.includes("const { id } = await params;") && s.includes("loadEnforceableMember(db, member.id)") && s.includes("historyAccess({ member, full, hasLevel, hasToggle, seesOnlyAssignedJobs })"));
  }
  const schema = src("prisma/schema.prisma");
  ok("schema: SentEmail with companyId-first indexes", /model SentEmail \{[\s\S]*@@index\(\[companyId, clientId, createdAt\]\)[\s\S]*@@index\(\[companyId, jobId, createdAt\]\)/.test(schema));

  const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");
  const keys = [...new Set([
    ...hist.matchAll(/"(app\.emailHistory\.[A-Za-z.]+)"/g),
    ...viewer.matchAll(/"(app\.emailHistory\.[A-Za-z.]+)"/g),
    ...tabs.matchAll(/"(app\.emailHistory\.[A-Za-z.]+)"/g),
  ].map((m) => m[1]))];
  for (const k of H.SENT_EMAIL_KINDS) keys.push(`app.emailHistory.kind.${k}`);
  ok("the History keys were found", keys.length >= 30, keys.length);
  for (const [lang, table] of Object.entries(APP_MESSAGES)) {
    const missing = keys.filter((k) => typeof table[k] !== "string" || !table[k].trim());
    ok(`${lang}: every History key`, missing.length === 0, missing);
  }
  for (const lang of ["en", "fr", "es"]) {
    const help = src(`content/help/${lang}/clients.js`);
    ok(`help article (${lang}): sent-email-history and conversations-linked-to-clients-automatically`, help.includes('"sent-email-history": {') && help.includes('"conversations-linked-to-clients-automatically": {'));
  }
  ok("help tree lists both articles", src("lib/help/tree.js").includes('A("sent-email-history"') && src("lib/help/tree.js").includes('A("conversations-linked-to-clients-automatically"'));
  const pkg = JSON.parse(src("package.json"));
  ok("package.json: check:all runs check:sent-email-history", pkg.scripts["check:all"].includes("check:sent-email-history"));
}

console.log(`\ncheck-sent-email-history: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
