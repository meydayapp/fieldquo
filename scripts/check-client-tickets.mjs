// scripts/check-client-tickets.mjs
//
// Client tickets and "Request work" from the portal, executed against hostile
// input:
//
//   1. The closed sets and the status machine — a client can only reopen by
//      replying, never resolve or close; a closed ticket takes no reply; the
//      first staff reply stamps the response time.
//   2. Photos: only this company's own portal uploads survive, never a URL a
//      browser picked (another company's folder, another host, javascript:).
//   3. What reaches the client's browser: no assignee, no priority, no member
//      ids, staff as a first name only.
//   4. Every link a client attaches is re-found under THAT client and company
//      (stub db that answers only for the right scope), and a ticket read by
//      another household's token finds nothing.
//   5. The reply email: escaped, in every language, from the company, never
//      saying FieldQuo; a "repair" ticket becomes a "rework" callback job.
//   6. The routes keep their promises (read from source): portal routes are
//      rate-limited and token-scoped, the request route validates the service
//      against the company's own enabled list and never returns a rate.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-client-tickets.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "demo-cloud";

const {
  TICKET_TYPES,
  CLIENT_ISSUE_TYPES,
  normaliseType,
  decideStatus,
  afterReply,
  ownUploads,
  clientTicketView,
  jobDraftFromTicket,
  staffFirstName,
} = await import("@/lib/clientTickets/rules");
const { verifyClientLinks, clientReply, openTicket } = await import("@/lib/clientTickets/service");
const { buildTicketReplyEmail } = await import("@/lib/clientTickets/emails");
const { CLIENT_DOC_COPY, clientDocCopy } = await import("@/lib/i18n/clientDocCopy");
const { NOTIFICATION_TYPES } = await import("@/lib/notifications/catalog");
const { hrefFor } = await import("@/lib/notifications/render");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

let passed = 0;
let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const NOW = new Date("2026-09-24T15:00:00Z");
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;

// ── 1. Sets and the status machine ───────────────────────────────────────
{
  ok("the client's issue types are a subset of the ticket types", CLIENT_ISSUE_TYPES.every((t) => TICKET_TYPES.includes(t)));
  ok("a client cannot file a 'maintenance' through the issue form", normaliseType("maintenance", CLIENT_ISSUE_TYPES) === null);
  ok("an unknown type is refused", normaliseType("refund_me", TICKET_TYPES) === null);
  ok("types are case-folded", normaliseType(" Repair ", TICKET_TYPES) === "repair");
  const t = { status: "open", resolvedAt: null, firstResponseAt: null };
  ok("a client cannot change a status", !decideStatus({ ticket: t, to: "resolved", by: "client" }).ok);
  ok("a bogus status is refused", !decideStatus({ ticket: t, to: "deleted", by: "member" }).ok);
  const res = decideStatus({ ticket: t, to: "resolved", by: "member", now: NOW });
  ok("resolving stamps resolvedAt", res.ok && res.data.resolvedAt === NOW);
  ok("reopening clears resolvedAt", decideStatus({ ticket: { status: "resolved", resolvedAt: NOW }, to: "open", by: "member" }).data.resolvedAt === null);
  ok("a client reply reopens a resolved ticket", afterReply({ ticket: { status: "resolved" }, by: "client" }).data.status === "open");
  ok("a client reply reopens a waiting ticket", afterReply({ ticket: { status: "waiting_on_client" }, by: "client" }).data.status === "open");
  ok("a closed ticket takes no client reply", afterReply({ ticket: { status: "closed" }, by: "client" }).error === "closed");
  const first = afterReply({ ticket: { status: "open", firstResponseAt: null }, by: "member", now: NOW });
  ok("the first staff reply stamps the response time and picks it up", first.data.firstResponseAt === NOW && first.data.status === "in_progress");
  ok("a later staff reply keeps the first response time", !("firstResponseAt" in afterReply({ ticket: { status: "in_progress", firstResponseAt: NOW }, by: "member" }).data));
}

// ── 2. Photos: own uploads only ──────────────────────────────────────────
{
  const mine = `https://res.cloudinary.com/${CLOUD}/image/upload/v1/fieldquo/companies/co_A/portal/abc.jpg`;
  const list = [
    { url: mine, kind: "photo" },
    { url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/fieldquo/companies/co_B/portal/x.jpg`, kind: "photo" },
    { url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/fieldquo/companies/co_A/leads/y.jpg`, kind: "photo" },
    { url: "https://evil.example/fieldquo/companies/co_A/portal/z.jpg", kind: "photo" },
    { url: "javascript:alert(1)//fieldquo/companies/co_A/portal/", kind: "photo" },
    { url: `http://res.cloudinary.com/${CLOUD}/fieldquo/companies/co_A/portal/h.jpg` },
    { url: `${mine}" onerror="alert(1)` },
    "not an object",
  ];
  const kept = ownUploads(list, { companyId: "co_A" });
  ok("only this company's portal uploads survive", kept.length === 1 && kept[0].url === mine, JSON.stringify(kept));
  ok("no company, no photos", ownUploads(list, { companyId: "" }).length === 0);
  ok("at most six", ownUploads(Array.from({ length: 20 }, () => ({ url: mine })), { companyId: "co_A" }).length === 6);
}

// ── 3. The client's view ─────────────────────────────────────────────────
{
  const view = clientTicketView({
    id: "t1", type: "repair", subject: "Drip", body: "Leaks", status: "open", priority: "urgent",
    assignedToId: "user_secret", companyId: "co_A", clientId: "c1", createdAt: NOW, updatedAt: NOW,
    photos: [{ url: "https://x/1.jpg", kind: "photo", publicId: "SECRET-PID" }],
    messages: [{ id: "m1", author: "member", memberId: "mem_secret", authorName: "Dana Kowalski", body: "On it", createdAt: NOW }],
  });
  const json = JSON.stringify(view);
  ok("no assignee reaches the client", !json.includes("user_secret"));
  ok("no member id reaches the client", !json.includes("mem_secret"));
  ok("no priority reaches the client", !("priority" in view));
  ok("no Cloudinary public id reaches the client", !json.includes("SECRET-PID"));
  ok("staff are a first name", view.messages[0].name === "Dana" && !json.includes("Kowalski"));
  ok("first name of nothing is null", staffFirstName("  ") === null);
}

// ── 4. Links are re-found under the client and company ───────────────────
{
  const client = { id: "c1", companyId: "co_A", name: "Libby" };
  // A stub that answers only when the where names the right client AND company.
  const rightScope = (w) => (w.clientId === "c1" || w.job?.clientId === "c1") && (w.companyId === "co_A" || w.job?.companyId === "co_A");
  const row = (w, extra = {}) => (rightScope(w) && String(w.id).startsWith("mine_") ? { id: w.id, ...extra } : null);
  const db = {
    job: { findFirst: async ({ where }) => row(where) },
    jobVisit: { findFirst: async ({ where }) => row(where, { jobId: "mine_job" }) },
    invoice: { findFirst: async ({ where }) => row(where) },
    quote: { findFirst: async ({ where }) => row(where) },
    servicePlan: { findFirst: async ({ where }) => row(where) },
  };
  const good = await verifyClientLinks(db, client, { jobVisitId: "mine_v1", invoiceId: "mine_i1" });
  ok("the client's own links pass", good.ok && good.links.jobVisitId === "mine_v1" && good.links.invoiceId === "mine_i1");
  ok("a visit carries its job", good.links.jobId === "mine_job");
  ok("another household's job is refused", !(await verifyClientLinks(db, client, { jobId: "theirs_j" })).ok);
  ok("another company's plan is refused", !(await verifyClientLinks(db, { ...client, companyId: "co_B" }, { servicePlanId: "mine_p" })).ok);
  ok("an injection-shaped id is refused before any query", !(await verifyClientLinks(db, client, { quoteId: "x' OR '1'='1" })).ok);

  // Opening a ticket with a link that isn't the client's writes nothing.
  let created = 0;
  const writeDb = { ...db, clientTicket: { create: async () => { created += 1; return { id: "t" }; } } };
  const bad = await openTicket({ client, input: { type: "repair", subject: "s", body: "b", jobId: "theirs_job" }, db: writeDb });
  ok("a ticket about someone else's job is refused and not written", !bad.ok && created === 0);
  const badType = await openTicket({ client, input: { type: "maintenance", subject: "s", body: "b" }, allowedTypes: CLIENT_ISSUE_TYPES, db: writeDb });
  ok("a type outside the entry point's list is refused", !badType.ok && created === 0);
  const empty = await openTicket({ client, input: { type: "repair", subject: "   ", body: "b" }, db: writeDb });
  ok("an empty subject is refused", !empty.ok && created === 0);

  // Another household's token replying to this ticket id finds nothing.
  let replied = 0;
  const replyDb = {
    // Behaves like the table: the row is (t1, c1, co_A) and a where only
    // filters on what it names — so a where that FORGOT companyId would find
    // it, which is what this stub exists to catch.
    clientTicket: {
      findFirst: async ({ where }) => {
        const r = { id: "t1", clientId: "c1", companyId: "co_A", status: "open" };
        return Object.entries(where).every(([k, v]) => r[k] === v) ? r : null;
      },
      update: () => { replied += 1; },
    },
    clientTicketMessage: { create: () => { replied += 1; } },
    $transaction: async () => { replied += 1; },
  };
  const other = await clientReply({ client: { id: "c2", companyId: "co_A" }, ticketId: "t1", body: "hi", db: replyDb });
  ok("another household cannot reply on this ticket", !other.ok && other.status === 404 && replied === 0);
  const otherCo = await clientReply({ client: { id: "c1", companyId: "co_B" }, ticketId: "t1", body: "hi", db: replyDb });
  ok("the same client id under another company finds nothing", !otherCo.ok && replied === 0);
}

// ── 5. The reply email, and the job a ticket becomes ─────────────────────
{
  const company = { name: `Bob's <script>x</script> Paint`, brandColor: "#ffff00", email: "o@bob.example" };
  const mail = buildTicketReplyEmail({
    company,
    client: { name: "<b>Libby</b> A." },
    ticket: { subject: "Door <img src=x onerror=1>" },
    reply: "We'll come Tuesday.\n<script>alert(1)</script>",
    staffName: "Dana Kowalski",
    url: "https://app.example/portal/tok",
    language: "en",
  });
  ok("company name escaped", !mail.html.includes("<script>x</script>"));
  ok("subject escaped", !mail.html.includes("<img src=x"));
  ok("reply escaped", !mail.html.includes("<script>alert(1)</script>"));
  ok("staff first name only", mail.html.includes("Dana") && !mail.html.includes("Kowalski"));
  ok("never says FieldQuo", !/fieldquo/i.test(mail.html) && !/fieldquo/i.test(mail.subject));
  ok("links back to the portal", mail.html.includes("https://app.example/portal/tok"));
  for (const code of Object.keys(CLIENT_DOC_COPY)) {
    const m = buildTicketReplyEmail({ company: { name: "Acme" }, client: { name: "Ana" }, ticket: { subject: "S" }, reply: "R", url: "https://x/p", language: code });
    ok(`reply email builds in ${code}`, m.subject.includes("S") && !m.html.includes("undefined"));
    const t = CLIENT_DOC_COPY[code].portal.tickets;
    ok(`${code} names every ticket type and status`, TICKET_TYPES.every((k) => t.types[k]) && ["open", "in_progress", "waiting_on_client", "resolved", "closed"].every((k) => t.status[k]));
    ok(`${code} has the server-built subjects`, typeof CLIENT_DOC_COPY[code].portal.rescheduleSubject === "function" && typeof CLIENT_DOC_COPY[code].portal.maintenanceSubject === "function");
  }
  ok("fallback language is English", clientDocCopy("xx").portal.tickets.heading === "Your requests");

  const repair = jobDraftFromTicket({ ticket: { type: "repair", subject: "Drip" }, originalJob: { id: "j1", title: "Bathroom reno", siteAddress: "1 Elm" } });
  ok("a repair on a job becomes a rework callback", repair.originalJobId === "j1" && repair.callbackReason === "rework" && repair.siteAddress === "1 Elm");
  ok("a warranty on a job becomes a warranty callback", jobDraftFromTicket({ ticket: { type: "warranty", subject: "x" }, originalJob: { id: "j1", title: "t" } }).callbackReason === "warranty");
  ok("without an original job there is no callback half-fact", jobDraftFromTicket({ ticket: { type: "repair", subject: "Drip" } }).callbackReason === null);
  ok("a question never becomes a job", jobDraftFromTicket({ ticket: { type: "question", subject: "?" } }) === null);
}

// ── 6. Notifications and the routes' promises ────────────────────────────
{
  for (const type of ["client_ticket.opened", "client_ticket.replied"]) {
    ok(`${type} is in the catalog`, Boolean(NOTIFICATION_TYPES[type]));
    ok(`${type} opens the ticket`, hrefFor({ entityType: NOTIFICATION_TYPES[type]?.entityType, entityId: "t9" }) === "/app/tickets/t9");
    for (const code of Object.keys(APP_MESSAGES)) {
      ok(`${type} sentence in ${code}`, typeof APP_MESSAGES[code][`app.notif.type.${type}`] === "string");
    }
  }
  const tickets = read("app/api/portal/[token]/tickets/route.js");
  ok("portal ticket POST is rate-limited", /rateLimit\(request, "portal-ticket"/.test(tickets));
  // companyId is read only to tell a company's own service from the
  // catalogue's (lib/i18n/serviceName.js) — an owner id, not a rate.
  ok("services are names only — no rate column is read", /select: \{ category: \{ select: \{ id: true, label: true, labelTranslations: true(, companyId: true)? \} \} \}/.test(tickets) && !/defaultRate|price|amount/i.test(tickets.replace(/\/\/.*$/gm, "")));
  ok("maintenance must name one of the client's own active plans", /plans\.find\(\(p\) => p\.id === body\?\.servicePlanId\)/.test(tickets));
  const reply = read("app/api/portal/[token]/tickets/[id]/messages/route.js");
  ok("portal replies are rate-limited and token-scoped", /rateLimit\(request, "portal-ticket-reply"/.test(reply) && /portalToken/.test(reply));
  const upload = read("app/api/portal/[token]/upload/route.js");
  ok("uploads land in the one folder ownUploads accepts", /folder: `fieldquo\/companies\/\$\{client\.companyId\}\/portal`/.test(upload) && /rateLimit/.test(upload));
  const request = read("app/api/portal/[token]/request/route.js");
  ok("request work validates the service against the company's enabled list", /companyServiceCategory\.findFirst\(\{\s*where: \{ companyId: client\.companyId, enabled: true/.test(request));
  ok("request work keeps only own uploads", /ownUploads\(body\?\.photos, \{ companyId: client\.companyId \}\)/.test(request));
  ok("request work is rate-limited", /rateLimit\(request, "portal-request"/.test(request));
  const staff = read("lib/clientTickets/service.js");
  ok("staff reads are company-scoped", (staff.match(/companyId: member\.companyId/g) || []).length >= 5);
  ok("client reads are client AND company scoped", /where: \{ clientId: client\.id, companyId: client\.companyId \}/.test(staff) && /id: String\(ticketId \|\| ""\), clientId: client\.id, companyId: client\.companyId/.test(staff));
  ok("an assignee must be an active member of this company", /companyId: member\.companyId, userId: String\(patch\.assignedToId\), active: true/.test(staff));
  ok("conversion goes through the existing create-job path", /await createJob\(db, \{/.test(staff));
}

console.log(`check-client-tickets: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
