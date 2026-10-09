// scripts/check-email-sender-status.mjs
//
//   npm run check:email-sender-status
//
// Settings › Email domain, after the owner's ask of 2026-10-09: "in the
// domains page we should know what is the company's email address so that
// outgoing emails point to that and not to the owner's log in email."
//
// Four claims, each EXECUTED rather than read:
//
//   1. "Clients see: From … · Replies to …" is what a send would use. The real
//      GET /api/settings/email-domain runs against the scripted db, and its
//      line is compared with the real resolveSender() (+ replyToHeader, + the
//      connected-mailbox lookup) for the same row — TrueFinish's real shape,
//      a blank email, hostile emails, a pending domain, a verified one, free
//      mailboxes and a sending mailbox.
//   2. The company email's local part is a SUGGESTION. Loading the page and
//      connecting the matching domain never write emailFromLocal; only the
//      one-tap PATCH does.
//   3. "Replies go to" saves through the one existing writer of Company.email
//      (PATCH /api/settings/business-info), which now refuses an address the
//      send path would refuse — and the email-domain route never writes it.
//   4. Every new label exists in every app locale.
//
// Run with the route stubs (lib/db and lib/apiMember scripted):
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/route-stub-loader.mjs scripts/check-email-sender-status.mjs

import { readFileSync } from "node:fs";

// Deterministic sender discovery: EMAIL_FROM short-circuits getPlatformFrom()
// exactly as it does in production when set. EMAIL_REPLY_TO is read once at
// module load by lib/email/resend.js, so it is cleared before any import.
process.env.EMAIL_FROM = "FieldQuo <quotes@fieldquo.com>";
delete process.env.EMAIL_REPLY_TO;
delete process.env.RESEND_API_KEY;
delete process.env.MAIL_CREDENTIALS_KEY;

const { rows, writes, resetDbStub } = await import("@/lib/db");
const { session } = await import("@/lib/apiMember");
const { resolveSender } = await import("@/lib/email/companySender");
const { senderFor, replyToHeader } = await import("@/lib/email/resend");
const { senderStatusFor } = await import("@/lib/email/senderStatus");
const {
  senderSuggestionFor,
  domainPrefillFor,
  shouldOfferLocal,
  isFreeMailboxDomain,
  FROM_LOCAL_PATTERN,
} = await import("@/lib/email/senderSuggestion");
const { saveCompanyEmail, COMPANY_EMAIL_WRITER } = await import("@/lib/email/companyReplyTo");
const emailDomainRoute = await import("@/app/api/settings/email-domain/route");
const businessInfoRoute = await import("@/app/api/settings/business-info/route");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages.js");

let pass = 0;
const failures = [];
function ok(label, cond, detail) {
  if (cond) pass++;
  else failures.push(`${label}${detail === undefined ? "" : `\n      ${JSON.stringify(detail)}`}`);
}
function section(t) {
  console.log(`\n${t}`);
}
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ── Fixture: TrueFinish as production holds it (2026-10-09, read-only) ──────
const OWNER_EMAIL = "owner.login@gmail.com";
let seq = 0;
function seed(over = {}) {
  resetDbStub();
  // ownerEmailFor caches per company id in-process, so every scenario gets a
  // fresh id — a cached owner from the last scenario must not answer this one.
  const id = `co_${++seq}`;
  const company = {
    id,
    name: "TrueFinish Cabinets Inc. ",
    email: "info@truefinishcabinets.com",
    emailDomain: null,
    emailDomainId: null,
    emailDomainStatus: "not_started",
    emailFromLocal: "quotes",
    emailDomainRecords: null,
    emailDomainCheckedAt: null,
    website: "https://www.truefinishcabinets.com",
    ...over,
  };
  rows.company = [company];
  rows.user = [{ id: `u_${id}`, email: OWNER_EMAIL, name: "Owner" }];
  rows.member = [{ id: `m_${id}`, companyId: id, userId: `u_${id}`, role: "owner", createdAt: new Date(0), user: { email: OWNER_EMAIL } }];
  session.member = { id: `m_${id}`, userId: `u_${id}`, companyId: id, role: "owner" };
  return company;
}
const req = (body) => ({ json: async () => body, headers: { get: () => null }, url: "http://x/api/settings/email-domain" });
async function get() {
  const res = await emailDomainRoute.GET(req({}));
  return { status: res.status, body: await res.json() };
}
const companyWrites = () => writes.filter((w) => w.model === "company" && w.action === "update");

// What a real send of this row would carry, through the send path's own
// functions — the oracle the page is compared with.
async function whatASendUses(company) {
  const s = await resolveSender(company, company.id);
  return { from: s.from, replyTo: replyToHeader(s.replyTo) || null };
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. The status line is the send path's answer");
// ═══════════════════════════════════════════════════════════════════════════
{
  const c = seed();
  const r = await get();
  const send = await whatASendUses(c);
  ok("GET answers 200", r.status === 200, r);
  ok("TrueFinish today: From is the company name on FieldQuo's sender", r.body.clientsSee?.from === "TrueFinish Cabinets Inc. <quotes@fieldquo.com>", r.body.clientsSee);
  ok("…Replies to the company email, not the owner's login", r.body.clientsSee?.replyTo === "info@truefinishcabinets.com" && r.body.clientsSee?.replyToSource === "company", r.body.clientsSee);
  ok("…and both equal what resolveSender gives a real send", r.body.clientsSee?.from === send.from && r.body.clientsSee?.replyTo === send.replyTo, { page: r.body.clientsSee, send });
  ok("the website stays out of the response", !("website" in r.body), Object.keys(r.body));
  ok("loading the page wrote nothing", companyWrites().length === 0, companyWrites());
}
{
  const c = seed({ email: "" });
  const r = await get();
  const send = await whatASendUses(c);
  ok("blank company email: Replies to the owner's login (resolveSender's fallback)", r.body.clientsSee?.replyTo === OWNER_EMAIL && r.body.clientsSee?.replyToSource === "owner", r.body.clientsSee);
  ok("…the same address a send uses", r.body.clientsSee?.replyTo === send.replyTo, { page: r.body.clientsSee, send });
  ok("…and the page is told the email is blank", r.body.companyEmail?.state === "blank", r.body.companyEmail);
}
{
  const c = seed({ email: null });
  const r = await get();
  ok("null company email behaves as blank", r.body.clientsSee?.replyTo === OWNER_EMAIL && r.body.companyEmail?.state === "blank", r.body);
  ok("…and proposes nothing from it", r.body.senderSuggestion === null && r.body.domainPrefill?.source === "website", r.body);
}

const HOSTILE = [
  "a@b.com, c@d.com",
  "info@truefinishcabinets.com\r\nBcc: spy@evil.example",
  "info@truefinishcabinets.com>",
  "Bob <bob@x.com>",
  "<script>alert(1)</script>@x.com",
  "a@@b.com",
  "no-at-sign",
  "x@localhost",
  "x@.com",
  "   ",
  `${"a".repeat(250)}@x.com`,
];
for (const hostile of HOSTILE) {
  const c = seed({ email: hostile });
  const r = await get();
  const send = await whatASendUses(c);
  const line = JSON.stringify(r.body.clientsSee);
  ok(`hostile ${JSON.stringify(hostile.slice(0, 40))}: never reaches Reply-To`, !line.includes(hostile.trim() || "\u0000") && r.body.clientsSee?.replyTo === OWNER_EMAIL, r.body.clientsSee);
  ok(`hostile ${JSON.stringify(hostile.slice(0, 40))}: page and send agree`, r.body.clientsSee?.replyTo === send.replyTo && r.body.clientsSee?.from === send.from, { page: r.body.clientsSee, send });
  ok(`hostile ${JSON.stringify(hostile.slice(0, 40))}: no suggestion built on it`, r.body.senderSuggestion === null, r.body.senderSuggestion);
  ok(`hostile ${JSON.stringify(hostile.slice(0, 40))}: flagged`, r.body.companyEmail?.state === (hostile.trim() ? "invalid" : "blank"), r.body.companyEmail);
}
{
  // senderFor itself, directly: the guard is on the SEND side, not the page.
  ok("senderFor drops a two-address Reply-To", senderFor({ name: "X", email: "a@b.com, c@d.com" }, "F <q@f.com>").replyTo === undefined);
  ok("senderFor keeps a valid one, trimmed", senderFor({ name: "X", email: " a@b.com " }, "F <q@f.com>").replyTo === "a@b.com");
}
{
  const c = seed({ emailDomain: "truefinishcabinets.com", emailDomainId: "d1", emailDomainStatus: "pending" });
  const r = await get();
  const send = await whatASendUses(c);
  ok("pending domain: the page does NOT claim the company's own address yet", r.body.clientsSee?.from === "TrueFinish Cabinets Inc. <quotes@fieldquo.com>", r.body.clientsSee);
  ok("…same as a send", r.body.clientsSee?.from === send.from);
}
{
  const c = seed({ emailDomain: "truefinishcabinets.com", emailDomainId: "d1", emailDomainStatus: "verified" });
  const r = await get();
  const send = await whatASendUses(c);
  ok("verified domain: From is quotes@ the domain, as stored", r.body.clientsSee?.from === "TrueFinish Cabinets Inc. <quotes@truefinishcabinets.com>", r.body.clientsSee);
  ok("…same as a send", r.body.clientsSee?.from === send.from && r.body.clientsSee?.replyTo === send.replyTo);
  ok("…and the suggestion's From line is senderFor's, for info@", r.body.senderSuggestion?.from === "TrueFinish Cabinets Inc. <info@truefinishcabinets.com>", r.body.senderSuggestion);
  ok("…the offer shows, because the connected domain is the email's", shouldOfferLocal({ suggestion: r.body.senderSuggestion, domain: r.body.emailDomain, emailFromLocal: r.body.emailFromLocal }) === true);
}
{
  const c = seed({ emailDomain: "fieldquo.com", emailDomainId: "dq", emailDomainStatus: "verified" });
  const r = await get();
  ok("a row claiming fieldquo.com still shows the platform sender (isPlatformEmailDomain read-side)", r.body.clientsSee?.from === (await whatASendUses(c)).from && r.body.clientsSee?.from.endsWith("<quotes@fieldquo.com>"), r.body.clientsSee);
}
{
  // The connected mailbox goes first for client mail (lib/mailbox/send.js).
  process.env.MAIL_CREDENTIALS_KEY = "a".repeat(64);
  const c = seed();
  const box = { id: "mb1", companyId: c.id, scope: "company", sendEnabled: true, status: "connected", secretEnc: "sealed", provider: "imap", smtpHost: "smtp.example.com", smtpPort: 587, address: "office@truefinishcabinets.com", sendEnabledAt: new Date() };
  rows.mailboxConnection = [box];
  let r = await get();
  ok("sending mailbox on: From is the mailbox, under the company name", r.body.clientsSee?.via === "mailbox" && r.body.clientsSee?.from === "TrueFinish Cabinets Inc. <office@truefinishcabinets.com>", r.body.clientsSee);
  ok("…replies reach the mailbox (Reply-To is left off there)", r.body.clientsSee?.replyTo === "office@truefinishcabinets.com");
  ok("…and the fallback sender is named", r.body.clientsSee?.fallbackFrom === "TrueFinish Cabinets Inc. <quotes@fieldquo.com>", r.body.clientsSee);
  rows.mailboxConnection = [{ ...box, sendEnabled: false }];
  r = await get();
  ok("mailbox with sending off: back to the Resend sender", r.body.clientsSee?.via === "resend" && r.body.clientsSee?.from === "TrueFinish Cabinets Inc. <quotes@fieldquo.com>", r.body.clientsSee);
  rows.mailboxConnection = [box];
  delete process.env.MAIL_CREDENTIALS_KEY;
  r = await get();
  ok("no mail key on the server: the mailbox can't send, and the page doesn't claim it", r.body.clientsSee?.via === "resend", r.body.clientsSee);
}
{
  // senderStatusFor directly = the route's view, minus the row.
  const c = seed();
  const direct = await senderStatusFor(c, c.id);
  const viaRoute = (await get()).body;
  ok("the route's clientsSee is senderStatusFor's", JSON.stringify(direct.clientsSee) === JSON.stringify(viaRoute.clientsSee));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Free mailboxes and the domain prefill");
// ═══════════════════════════════════════════════════════════════════════════
for (const free of ["bob@gmail.com", "bob@GMail.com", "bob@outlook.com", "bob@hotmail.com", "bob@hotmail.ca", "bob@yahoo.com", "bob@yahoo.co.uk", "bob@icloud.com", "bob@videotron.ca", "bob@live.ca"]) {
  const c = seed({ email: free, website: null });
  const r = await get();
  const send = await whatASendUses(c);
  ok(`${free}: flagged as a free mailbox`, r.body.senderSuggestion?.freeMailbox === true, r.body.senderSuggestion);
  ok(`${free}: never prefilled as a sending domain`, r.body.domainPrefill === null, r.body.domainPrefill);
  ok(`${free}: no local part offered`, shouldOfferLocal({ suggestion: r.body.senderSuggestion, domain: r.body.senderSuggestion?.domain, emailFromLocal: "quotes" }) === false);
  ok(`${free}: replies still go to it (it is a real inbox)`, r.body.clientsSee?.replyTo === free && r.body.clientsSee?.replyTo === send.replyTo, r.body.clientsSee);
}
{
  const c = seed({ email: "bob@gmail.com", website: "https://www.truefinishcabinets.com" });
  const r = await get();
  ok("free mailbox + a real website: prefill falls back to send.<website>", r.body.domainPrefill?.domain === "send.truefinishcabinets.com" && r.body.domainPrefill?.source === "website", r.body.domainPrefill);
}
{
  const r = (seed(), await get());
  ok("TrueFinish: the domain field opens on the company email's domain", r.body.domainPrefill?.domain === "truefinishcabinets.com" && r.body.domainPrefill?.source === "company_email", r.body.domainPrefill);
  ok("…with the From it would give once verified, as stored (quotes@)", r.body.senderSuggestion?.fromAsStored === "TrueFinish Cabinets Inc. <quotes@truefinishcabinets.com>", r.body.senderSuggestion);
}
{
  const c = seed({ emailDomain: "send.truefinishcabinets.com", emailDomainId: "d2", emailDomainStatus: "verified" });
  const r = await get();
  ok("a domain already started is never re-prefilled", r.body.domainPrefill === null, r.body.domainPrefill);
  ok("a send. subdomain is not the email's domain: no info@ offer there", shouldOfferLocal({ suggestion: r.body.senderSuggestion, domain: r.body.emailDomain, emailFromLocal: r.body.emailFromLocal }) === false);
  void c;
}
ok("fieldquo.com email: no proposal at all", senderSuggestionFor({ email: "info@fieldquo.com" }) === null && domainPrefillFor({ email: "x@send.fieldquo.com" }) === null);
ok("a local part the From PATCH refuses is not offered", senderSuggestionFor({ email: "john+quotes@acme.com" })?.local === null && !shouldOfferLocal({ suggestion: senderSuggestionFor({ email: "john+quotes@acme.com" }), domain: "acme.com", emailFromLocal: "quotes" }));
ok("an offered local always passes the PATCH's pattern", ["Info@acme.com", "o.k-1_x@acme.com", "A@acme.com"].every((e) => FROM_LOCAL_PATTERN.test(senderSuggestionFor({ email: e }).local)));
ok("case and a trailing dot don't defeat the match", shouldOfferLocal({ suggestion: senderSuggestionFor({ email: "Info@TrueFinishCabinets.com" }), domain: "truefinishcabinets.com.", emailFromLocal: "quotes" }) === true);
ok("isFreeMailboxDomain: a contractor's own domain is not free", !isFreeMailboxDomain("truefinishcabinets.com") && !isFreeMailboxDomain("livewire-electric.com") && !isFreeMailboxDomain(""));

// ═══════════════════════════════════════════════════════════════════════════
section("3. The suggestion never writes emailFromLocal on its own");
// ═══════════════════════════════════════════════════════════════════════════
{
  // Connect the matching domain through the real POST, Resend faked at fetch.
  const c = seed();
  process.env.RESEND_API_KEY = "re_test_check";
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("https://api.resend.com/domains") && init?.method === "POST") {
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: "dom_tf", name: body.name, status: "pending", records: [] }), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const res = await emailDomainRoute.POST(req({ domain: "truefinishcabinets.com" }));
    const body = await res.json();
    const w = companyWrites();
    ok("connecting truefinishcabinets.com answers 201", res.status === 201, body);
    ok("…writes emailFromLocal as it was (quotes), never the suggested info", w.length === 1 && w[0].data.emailFromLocal === "quotes", w.map((x) => x.data));
    ok("…and the response still carries the offer for the tap", body.senderSuggestion?.local === "info" && body.clientsSee?.from === (await whatASendUses({ ...c, ...w[0].data })).from, body);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
  }
}
{
  // A company that chose "hello" keeps it — the offer is shown, nothing more.
  const c = seed({ emailFromLocal: "hello", emailDomain: "truefinishcabinets.com", emailDomainId: "d1", emailDomainStatus: "verified" });
  const r = await get();
  ok("a chosen local part survives a page load", companyWrites().length === 0 && r.body.emailFromLocal === "hello" && r.body.clientsSee?.from === "TrueFinish Cabinets Inc. <hello@truefinishcabinets.com>", r.body);
  ok("…the offer is shown", shouldOfferLocal({ suggestion: r.body.senderSuggestion, domain: r.body.emailDomain, emailFromLocal: r.body.emailFromLocal }) === true);
  // The tap: the existing PATCH with the suggested local.
  const res = await emailDomainRoute.PATCH(req({ emailFromLocal: r.body.senderSuggestion.local }));
  const body = await res.json();
  const w = companyWrites();
  ok("the tap is the one write, and it writes info", res.status === 200 && w.length === 1 && w[0].data.emailFromLocal === "info", w.map((x) => x.data));
  rows.company[0] = { ...rows.company[0], ...w[0].data };
  const after = (await get()).body;
  ok("after the tap: From is info@, and the offer is gone", after.clientsSee?.from === "TrueFinish Cabinets Inc. <info@truefinishcabinets.com>" && !shouldOfferLocal({ suggestion: after.senderSuggestion, domain: after.emailDomain, emailFromLocal: after.emailFromLocal }), after.clientsSee);
  ok("…the PATCH response itself carries the recomputed line", body.clientsSee?.from === "TrueFinish Cabinets Inc. <info@truefinishcabinets.com>", body.clientsSee);
  void c;
}
{
  const page = read("app/app/settings/email-domain/page.js");
  const calls = page.match(/acceptSuggestedLocal\(/g) || [];
  ok("page: acceptSuggestedLocal is defined once and only called from onUse taps", calls.length === 3 && (page.match(/onUse=\{\(\) => acceptSuggestedLocal\(suggestion\.local\)\}/g) || []).length === 2, calls.length);
  ok("page: no effect writes emailFromLocal", !/useEffect\([\s\S]{0,400}emailFromLocal:/.test(page));
  ok("page: the local field starts from the stored value, never the suggestion", /setLocalInput\(json\.emailFromLocal \|\| "quotes"\)/.test(page) && !/setLocalInput\([^)]*suggestion/.test(page));
  ok("page: the status line prints the server's clientsSee, not its own From", /clientsSee\.from/.test(page) && !/`\$\{data\.emailFromLocal[^`]*clientsSee/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Replies go to: one writer");
// ═══════════════════════════════════════════════════════════════════════════
{
  const calls = [];
  const fake = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ email: "info@truefinishcabinets.com" }), { status: 200 });
  };
  const r = await saveCompanyEmail("  info@truefinishcabinets.com ", { fetchImpl: fake });
  ok("saveCompanyEmail PATCHes the business-info route", calls.length === 1 && calls[0].url === "/api/settings/business-info" && COMPANY_EMAIL_WRITER === "/api/settings/business-info" && calls[0].init.method === "PATCH", calls);
  ok("…with only { email }, trimmed", calls[0] && JSON.stringify(JSON.parse(calls[0].init.body)) === JSON.stringify({ email: "info@truefinishcabinets.com" }) && r.ok, calls[0]?.init.body);
  calls.length = 0;
  for (const h of HOSTILE) {
    const x = await saveCompanyEmail(h, { fetchImpl: fake });
    ok(`saveCompanyEmail refuses ${JSON.stringify(h.slice(0, 30))} before any request`, !x.ok && x.problem && calls.length === 0, x);
  }
}
{
  // The real business-info PATCH — the writer the profile already used.
  const patch = async (body) => {
    const res = await businessInfoRoute.PATCH(req(body));
    return { status: res.status, body: await res.json() };
  };
  seed();
  let r = await patch({ email: " office@truefinishcabinets.com " });
  let w = companyWrites();
  ok("business-info stores a valid email, trimmed", r.status === 200 && w.length === 1 && w[0].data.email === "office@truefinishcabinets.com", { r, w: w.map((x) => x.data) });
  for (const h of HOSTILE.filter((x) => x.trim())) {
    seed();
    r = await patch({ email: h });
    ok(`business-info refuses ${JSON.stringify(h.slice(0, 30))} and writes nothing`, r.status === 400 && r.body.code === "invalid_company_email" && companyWrites().length === 0, r);
  }
  seed();
  r = await patch({ email: "" });
  w = companyWrites();
  ok("blank still clears it (the owner fallback takes over)", r.status === 200 && w[0]?.data.email === "", w.map((x) => x.data));
  seed({ email: "legacy, value@x.com" });
  r = await patch({ email: "legacy, value@x.com", name: "TrueFinish Cabinets Inc." });
  ok("a stored legacy value sent back unchanged doesn't block an unrelated save", r.status === 200, r);
  seed({ email: "legacy, value@x.com" });
  r = await patch({ email: "other, bad@x.com" });
  ok("…but a CHANGED bad value is refused", r.status === 400, r);
  seed();
  r = await patch({ email: 42 });
  ok("a non-string email is refused", r.status === 400, r);
}
{
  const page = read("app/app/settings/email-domain/page.js");
  const modal = read("app/components/settings/ReplyToPromptModal.js");
  const route = read("app/api/settings/email-domain/route.js");
  ok("page saves Reply-To through saveCompanyEmail", /import \{ saveCompanyEmail \} from "@\/lib\/email\/companyReplyTo"/.test(page) && /saveCompanyEmail\(replyInput\)/.test(page));
  ok("page never fetches business-info itself", !/business-info/.test(page));
  ok("ReplyToPromptModal saves through the same function", /saveCompanyEmail\(email\)/.test(modal) && !/fetch\("\/api\/settings\/business-info",\s*\{\s*method: "PATCH"/.test(modal));
  // Every `data: { … }` an email-domain handler writes, scoped to the block.
  const dataBlocks = [...route.matchAll(/data:\s*\{([^}]*)\}/g)].map((m) => m[1]);
  ok("the email-domain route never writes Company.email", dataBlocks.length >= 4 && dataBlocks.every((b) => !/(^|[\s,{])email\s*[:,]/.test(b)), dataBlocks);
  ok("the email-domain PATCH reads only emailFromLocal from the body", /const \{ emailFromLocal \} = await request\.json\(\)/.test(route));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Wiring: one function per answer");
// ═══════════════════════════════════════════════════════════════════════════
{
  const status = read("lib/email/senderStatus.js");
  const resend = read("lib/email/resend.js");
  const mailbox = read("lib/mailbox/send.js");
  const route = read("app/api/settings/email-domain/route.js");
  ok("senderStatus resolves through resolveSender", /await resolveSender\(company, companyId\)/.test(status));
  ok("senderStatus applies the send's own Reply-To default", /replyToHeader\(sender\.replyTo\)/.test(status));
  ok("sendEmail sets Reply-To through replyToHeader", /\.\.\.\(replyToHeader\(replyTo\) && \{\s*replyTo: replyToHeader\(replyTo\),?\s*\}\)/.test(resend));
  ok("trySendThroughMailbox picks the mailbox through sendingMailboxFor", /const conn = await sendingMailboxFor\(db, companyId\);/.test(mailbox));
  ok("every email-domain handler answers with viewOf", (route.match(/NextResponse\.json\(await viewOf\(/g) || []).length === 5);
  ok("the From PATCH and the suggestion share FROM_LOCAL_PATTERN", /FROM_LOCAL_PATTERN\.test\(local\)/.test(route));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Every label in every app locale");
// ═══════════════════════════════════════════════════════════════════════════
{
  const KEYS = {
    clientsSee: ["{from}", "{replyTo}"],
    clientsSeeNoReplyTo: ["{from}"],
    viaMailbox: ["{fallback}"],
    repliesGoTo: [],
    repliesOwnerFallback: ["{owner}"],
    repliesNoCompanyEmail: [],
    repliesInvalid: ["{email}", "{owner}"],
    repliesInvalidNoOwner: ["{email}"],
    repliesHint: [],
    replyPlaceholder: [],
    replyInvalid: [],
    prefillFromEmail: ["{email}"],
    freeMailbox: ["{email}", "{domain}"],
    onceVerified: ["{from}"],
    suggestTitle: ["{address}"],
    suggestBody: [],
    suggestFromLine: ["{from}"],
    suggestUse: ["{address}"],
  };
  const page = read("app/app/settings/email-domain/page.js");
  for (const [code, dict] of Object.entries(APP_MESSAGES)) {
    for (const [k, vars] of Object.entries(KEYS)) {
      const v = dict[`app.setEmailDomain.${k}`];
      ok(`${code}: app.setEmailDomain.${k}`, typeof v === "string" && v.trim() && vars.every((x) => v.includes(x)), v);
    }
  }
  for (const k of Object.keys(KEYS)) ok(`page uses app.setEmailDomain.${k}`, page.includes(`"app.setEmailDomain.${k}"`));
  ok("en: the exact status label", APP_MESSAGES.en["app.setEmailDomain.clientsSee"] === "Clients see: From {from} · Replies to {replyTo}");
  ok("en: the exact blank-email label", APP_MESSAGES.en["app.setEmailDomain.repliesOwnerFallback"] === "Replies currently go to {owner} because no company email is set.");
}

console.log("");
if (failures.length) {
  console.error(`check:email-sender-status FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`check:email-sender-status passed — ${pass} assertions.`);
