// scripts/check-signup-leads.mjs
//
//   npm run check:signup-leads
//
// A signup kept as it is typed, and the rules that make one a lead on the
// sales floor — executed, not read.
//
// ══ What is being defended ═════════════════════════════════════════════════
//
//   capture     the browser posts a JSON body, never a query string; waits
//               CAPTURE_DEBOUNCE_MS after the last change; drops the
//               password; a capture at an address a Company completed or a
//               rep holds writes NOTHING; the endpoint answers 204 whatever
//               happened (a stranger learns nothing about another visitor).
//   promotion   thirty quiet minutes, a phone number, never a completed
//               signup, never a do-not-contact person, one row per email or
//               phone (link, don't duplicate), the referring rep's own lead
//               when the link carried their code — and NO SalesQueueClaim
//               written by any of it.
//   the floor   status "signup" is invisible to the cold-call dispatcher and
//               to the review folder's trade bulks; the ONE way to a rep's
//               queue is assignSignupToRep, which writes exactly one claim
//               and refuses do-not-contact, held and language-mismatched rows.
//   the rep     hot rows first inside their window group and never across
//               one; the signup fact, the opener and the intro email variant
//               in en / fr / es; the badge in all nine catalogues.
//   the letter  the recovery email skips a signup a rep holds.
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-signup-leads.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { db, resetDbStub, rows, writes } from "./fixtures/dbStub.mjs";
import {
  CAPTURE_DEBOUNCE_MS,
  CAPTURE_ENDPOINT,
  PROMOTE_AFTER_MS,
  SIGNUP_STATUS,
  STALLED_NO_QUOTE_DAYS,
  decideSignupLeadPromotion,
  hoistHot,
  normaliseCapture,
  planCaptureWrite,
  prospectFromSignupLead,
  signupFact,
  stalledDecision,
  unplacedSignupWhere,
  worthCapturing,
} from "@/lib/signup/leads";
import { captureBodyFor } from "@/lib/signup/leadCapture";
import {
  assignSignupToRep,
  captureSignupLead,
  promoteSignupLeads,
  recordSignupCompletion,
  signupLeadForResume,
  signupStateOf,
  sweepSignupProspects,
} from "@/lib/signup/salesFloor";
import { CLAIMABLE_STATUSES, claimCandidateWhere } from "@/lib/sales/prospectView";
import { REVIEW_STATUSES } from "@/lib/sales/discovery/reviewFolder";
import { decideSignupNudge, planSignupNudges } from "@/lib/signup/abandoned";
import { SIGNUP_OPENERS, signupOpenerFor } from "@/lib/sales/playbook/signupOpener";
import { INTRO_VARIANTS, SIGNUP_INTRO_COPY, buildIntroEmail } from "@/lib/sales/outreach/introEmail";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { defaultScriptLanguage } from "@/lib/sales/intel/callScript";
import { CHECKOUT_GRACE_MS } from "@/lib/signup/setupGate";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// The badge component is JSX ("use client"), which bare node cannot load;
// its keys are read off the source and held to this list.
const SIGNUP_BADGE_KEYS = { hot: "app.signupLead.badge.hot", new: "app.signupLead.badge.new", stalled: "app.signupLead.badge.stalled" };

let checks = 0;
let failures = 0;
function ok(name, pass, detail = "") {
  checks += 1;
  if (pass) return;
  failures += 1;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}
function section(title) {
  console.log(`\n${title}`);
}

const NOW = new Date("2026-09-21T15:00:00Z");
const minutesAgo = (n) => new Date(NOW.getTime() - n * 60 * 1000);
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The capture — what a browser may post, and what is kept");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("no email → refused", normaliseCapture({ step: "account" }).error === "email");
  ok("not an email → refused", normaliseCapture({ email: "dave", step: "account" }).error === "email");
  ok("an unknown step → refused", normaliseCapture({ email: "d@x.com", step: "profit" }).error === "step");
  ok("markup in a name → refused", normaliseCapture({ email: "d@x.com", step: "account", firstName: "<b>Dave" }).error === "firstName");
  const r = normaliseCapture({
    email: "  Dave@Example.COM ",
    step: "industry",
    firstName: "Dave",
    lastName: "Martin",
    companyName: "Martin Painting",
    phone: "613-555-0142",
    country: "ca",
    language: "FR",
    trades: ["painting", "<x>", "not a slug!!", "painting"],
    utm: { utm_source: "facebook", utm_medium: "<script>" },
    salesCode: "  RACHEL-1 ",
    visitorId: "abcdefghijklmnopqrst",
  });
  ok("email key lower-cased and trimmed", r.lead?.emailKey === "dave@example.com");
  ok("phone normalised to E.164", r.lead?.phoneE164 === "+16135550142", r.lead?.phoneE164);
  ok("country upper-cased when offered", r.lead?.country === "CA");
  ok("language lower-cased when supported", r.lead?.language === "fr");
  ok("trades deduped and slug-only", JSON.stringify(r.lead?.trades) === '["painting"]', JSON.stringify(r.lead?.trades));
  ok("utm keeps clean tags, drops markup", r.lead?.utm?.utm_source === "facebook" && !r.lead?.utm?.utm_medium);
  ok("sales code read through readSalesCode (lower-cased)", r.lead?.salesCode === "rachel-1");
  ok("visitor id kept when well-formed", r.lead?.visitorId === "abcdefghijklmnopqrst");
  ok("an email alone is not worth a row", !worthCapturing(normaliseCapture({ email: "d@x.com", step: "account" }).lead));
  ok("an email plus a phone is", worthCapturing(normaliseCapture({ email: "d@x.com", step: "account", phone: "613-555-0142" }).lead));
  ok("a bad phone is kept raw, not as E.164", (() => { const x = normaliseCapture({ email: "d@x.com", step: "account", phone: "call me" }); return x.lead.phoneRaw === "call me" && x.lead.phoneE164 === null; })());

  // planCaptureWrite: the step never regresses, consent is stamped once, a
  // blank does not erase, a locked row refuses.
  const first = planCaptureWrite({ existing: null, incoming: { emailKey: "d@x.com", email: "d@x.com", stepReached: "industry", phoneE164: "+16135550142", firstName: "Dave", trades: ["painting"] }, now: NOW });
  ok("first capture creates", first.create === true && first.data.stepReached === "industry");
  ok("consentAt stamped when the phone arrives", first.data.consentAt?.getTime?.() === NOW.getTime());
  const later = planCaptureWrite({
    existing: { ...first.data, stepReached: "services", consentAt: minutesAgo(10) },
    incoming: { emailKey: "d@x.com", email: "d@x.com", stepReached: "account", phoneE164: null, firstName: null, trades: [] },
    now: NOW,
  });
  ok("the step never moves backwards", later.data.stepReached === "services", later.data.stepReached);
  ok("a blank does not erase the phone", later.data.phoneE164 === "+16135550142");
  ok("a blank does not erase the name", later.data.firstName === "Dave");
  ok("a blank does not erase the trades", later.data.trades.length === 1);
  ok("consentAt is set once and never moved", later.data.consentAt.getTime() === minutesAgo(10).getTime());
  ok("a completed row refuses a capture", planCaptureWrite({ existing: { completedCompanyId: "c1" }, incoming: { emailKey: "d@x.com" } }).refusal === "locked");
  ok("a promoted row refuses a capture", planCaptureWrite({ existing: { promotedAt: NOW }, incoming: { emailKey: "d@x.com" } }).refusal === "locked");
  ok("no email → refusal", planCaptureWrite({ existing: null, incoming: {} }).refusal === "email");

  // The browser half.
  const body = captureBodyFor({ email: "d@x.com", password: "hunter22", firstName: "Dave", phone: "613-555-0142", companyName: "", country: "", language: "en" }, "account", { selectedIndustries: ["painting"], salesCode: "rachel-1" });
  ok("the page's body never carries the password", body && !("password" in body) && !JSON.stringify(body).includes("hunter22"));
  ok("the page's body carries the trades and the code", body?.trades?.[0] === "painting" && body?.salesCode === "rachel-1");
  ok("an email alone produces no body", captureBodyFor({ email: "d@x.com" }, "account") === null);
  ok("an unknown step produces no body", captureBodyFor({ email: "d@x.com", firstName: "D" }, "nope") === null);
  ok("the debounce is a named constant of at least a second", CAPTURE_DEBOUNCE_MS >= 1000);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The capture route — 204, JSON body, no PII in a URL, cross-visitor isolation");
// ═══════════════════════════════════════════════════════════════════════════
{
  const route = read("app/api/signup/lead/route.js");
  ok("POST answers 204 with no body", /new NextResponse\(null, \{ status: 204 \}\)/.test(route));
  ok("POST never returns row data (no NextResponse.json after the capture)", !/captureSignupLead[\s\S]*NextResponse\.json\(\{ (lead|prefill|signup)/.test(route.split("export async function GET")[0]));
  ok("GET requires a resume token, not an email", /searchParams\.get\("token"\)/.test(route) && !/searchParams\.get\("email"\)/.test(route));
  ok("the route is rate-limited", /rateLimit\(request, "signup-lead"/.test(route));

  const page = read("app/signup/page.js");
  ok("the page posts a JSON body to the capture endpoint", /fetch\(CAPTURE_ENDPOINT, \{\s*method: "POST"/.test(page) && /body: JSON\.stringify\(body\)/.test(page));
  ok("the page never puts the email in the capture URL", !/CAPTURE_ENDPOINT\}\?email=/.test(page) && !/\/api\/signup\/lead\?email/.test(page));
  ok("the page waits CAPTURE_DEBOUNCE_MS after the last change", /setTimeout\(send, CAPTURE_DEBOUNCE_MS\)/.test(page));
  ok("the page posts at once when the step moves", /if \(stepMoved\) send\(\);/.test(page));
  ok("the page keeps the furthest step at the Stripe handoff", /captureBodyFor\(form, "checkout"/.test(page));
  ok("the page uses keepalive so a handoff post still leaves", /keepalive: true,\s*\}\)\.catch/.test(page.split("function postSignupCapture")[1] || ""));
  ok("the resume link is read as a token", /URLSearchParams\(window\.location\.search\)\.get\("resume"\)/.test(page));
  ok("the resume prefill fills only what is still empty", /email: f\.email \|\| p\.email/.test(page));
  ok("a signed-in owner adding a business is never captured", /if \(!hydrated \|\| !entryChecked \|\| alreadyOnFieldquo \|\| finishCheckout\) return;/.test(page));

  // Executed against the stub: create, update, lock.
  resetDbStub();
  let r = await captureSignupLead({ client: db, body: { email: "Dave@x.com", step: "account", firstName: "Dave", phone: "613-555-0142" }, now: NOW });
  ok("first capture creates a row", r.ok && r.reason === "created" && rows.signupLead.length === 1);
  ok("the row has a resume token", typeof rows.signupLead[0].resumeToken === "string" && rows.signupLead[0].resumeToken.length >= 40);
  ok("the row's consentAt is the phone's first capture", rows.signupLead[0].consentAt?.getTime?.() === NOW.getTime());
  r = await captureSignupLead({ client: db, body: { email: "dave@x.com", step: "industry", firstName: "Dave", companyName: "Martin Painting", trades: ["painting"] }, now: minutesAgo(-1) });
  ok("second capture at the same address updates the one row", r.ok && r.reason === "updated" && rows.signupLead.length === 1);
  ok("the step advanced and the phone survived a capture without one", rows.signupLead[0].stepReached === "industry" && rows.signupLead[0].phoneE164 === "+16135550142");
  r = await captureSignupLead({ client: db, body: { email: "dave@x.com", step: "account" }, now: NOW });
  ok("an email-only capture writes nothing", r.reason === "nothing_yet");
  // Cross-visitor: a different browser at the same address after the row is
  // finished business cannot rewrite it under a rep.
  rows.signupLead[0].promotedAt = NOW;
  const before = JSON.stringify(rows.signupLead[0]);
  r = await captureSignupLead({ client: db, body: { email: "dave@x.com", step: "account", phone: "555-000-0000", firstName: "Mallory" }, now: NOW });
  ok("a promoted row refuses a later capture (locked)", r.ok === false && r.reason === "locked");
  ok("…and nothing on it changed", JSON.stringify(rows.signupLead[0]) === before);
  rows.signupLead[0].promotedAt = null;
  rows.signupLead[0].completedCompanyId = "c1";
  r = await captureSignupLead({ client: db, body: { email: "dave@x.com", step: "account", phone: "555-000-0000" }, now: NOW });
  ok("a completed row refuses a later capture (locked)", r.ok === false && r.reason === "locked");
  // The resume read hands back what the person typed, and only that.
  const prefill = await signupLeadForResume({ client: db, token: rows.signupLead[0].resumeToken });
  ok("the resume read returns the typed fields", prefill?.email?.toLowerCase() === "dave@x.com" && prefill.firstName === "Dave" && prefill.trades?.[0] === "painting");
  ok("the resume read never returns the row id, the codes or the token", prefill && !("id" in prefill) && !("salesCode" in prefill) && !("resumeToken" in prefill));
  ok("the resume read says the account already exists past step one", prefill?.accountExists === true);
  ok("an unknown token is null", (await signupLeadForResume({ client: db, token: "nope" })) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The promotion rule — thirty minutes, a phone, never a customer, never DNC");
// ═══════════════════════════════════════════════════════════════════════════
{
  const base = { id: "l1", email: "d@x.com", emailKey: "d@x.com", phoneE164: "+16135550142", lastSeenAt: minutesAgo(45) };
  const d = (lead, extra = {}) => decideSignupLeadPromotion({ lead, now: NOW, ...extra });
  ok("thirty quiet minutes with a phone → a hot prospect", d(base).action === "prospect" && d(base).reason === "due");
  ok("PROMOTE_AFTER_MS is thirty minutes", PROMOTE_AFTER_MS === 30 * 60 * 1000);
  ok("29 minutes → wait", d({ ...base, lastSeenAt: minutesAgo(29) }).action === "wait");
  ok("exactly 30 minutes → due", d({ ...base, lastSeenAt: minutesAgo(30) }).action === "prospect");
  ok("no phone → wait, not skip", d({ ...base, phoneE164: null }).action === "wait" && d({ ...base, phoneE164: null }).final === false);
  ok("a completed signup is NEVER promoted", d({ ...base, completedCompanyId: "c1" }).action === "skip" && d({ ...base, completedCompanyId: "c1" }).reason === "completed");
  ok("…even with a phone, a referrer and a match", d({ ...base, completedCompanyId: "c1" }, { referredRep: { id: "r" }, matchingProspect: { id: "p" } }).action === "skip");
  ok("already promoted → skip", d({ ...base, promotedAt: NOW }).action === "skip");
  ok("do-not-contact → skip, final", d(base, { suppressed: true }).action === "skip" && d(base, { suppressed: true }).reason === "suppressed" && d(base, { suppressed: true }).final);
  ok("an email or phone already on a Company → link the company, never a lead", d(base, { matchingCompany: { id: "c9" } }).action === "link_company" && d(base, { matchingCompany: { id: "c9" } }).companyId === "c9");
  ok("a Company match wins over a referring rep", d(base, { matchingCompany: { id: "c9" }, referredRep: { id: "r" } }).action === "link_company");
  ok("an email or phone already on a Prospect → link, don't duplicate", d(base, { matchingProspect: { id: "p7" } }).action === "link_prospect" && d(base, { matchingProspect: { id: "p7" } }).prospectId === "p7");
  ok("DNC beats a prospect match", d(base, { suppressed: true, matchingProspect: { id: "p7" } }).action === "skip");
  ok("a referring rep gets the lead", d(base, { referredRep: { id: "r1" } }).action === "rep_lead" && d(base, { referredRep: { id: "r1" } }).salesRepId === "r1");
  ok("no last-seen date → wait", d({ ...base, lastSeenAt: null }).action === "wait");
  ok("a stamped skip reason stays final", d({ ...base, skipReason: "suppressed" }).action === "skip");

  const p = prospectFromSignupLead({ id: "l1", email: "d@x.com", companyName: "Martin Painting", phoneE164: "+16135550142", trades: ["painting"], stepReached: "industry", lastSeenAt: NOW }, { now: NOW });
  ok("the prospect is status 'signup' and hot", p.status === SIGNUP_STATUS && p.hot === true && p.signupKind === "abandoned");
  ok("the prospect's trade is the first mapped industry", p.tradeKey === "painting", p.tradeKey);
  ok("the prospect is keyed on the lead id for idempotence", p.sourceProvider === "signup" && p.sourceRecordId === "l1");
  ok("the state reason names the step", /Trades/.test(p.signupStateReason));
  const noName = prospectFromSignupLead({ id: "l2", email: "d@x.com", firstName: "Dave", lastName: "Martin", phoneE164: "+1", trades: [] });
  ok("no company name → the contact's name, never blank", noName.businessName === "Dave Martin");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The promotion, executed — and no claim row anywhere in it");
// ═══════════════════════════════════════════════════════════════════════════
{
  const lead = (over = {}) => ({
    id: `l_${Math.random().toString(36).slice(2, 7)}`, emailKey: "d@x.com", email: "d@x.com", firstName: "Dave", lastName: "Martin", companyName: "Martin Painting",
    phoneE164: "+16135550142", phoneRaw: "613-555-0142", trades: ["painting"], language: "fr", stepReached: "industry", province: "QC", country: "CA",
    startedAt: minutesAgo(50), lastSeenAt: minutesAgo(45), consentAt: minutesAgo(50), completedCompanyId: null, promotedAt: null, skipReason: null,
    prospectId: null, promotedLeadId: null, salesCode: null, referredRepId: null, resumeToken: "t".repeat(43), ...over,
  });

  // (a) the folder
  resetDbStub();
  rows.signupLead.push(lead());
  let out = await promoteSignupLeads({ client: db, now: NOW });
  ok("a due lead becomes one Prospect", rows.prospect.length === 1 && out.written.length === 1 && out.written[0].action === "prospect");
  ok("…hot, status signup, unassigned", rows.prospect[0].hot === true && rows.prospect[0].status === SIGNUP_STATUS && !rows.prospect[0].assignedRepId);
  ok("…the lead is linked and stamped", rows.signupLead[0].prospectId === rows.prospect[0].id && rows.signupLead[0].promotedAt);
  ok("…no SalesLead, no claim", rows.salesLead.length === 0 && rows.salesQueueClaim.length === 0);
  out = await promoteSignupLeads({ client: db, now: NOW });
  ok("a second run writes nothing (already promoted)", rows.prospect.length === 1 && out.written.length === 0);

  // (b) the referring rep
  resetDbStub();
  rows.salesRep.push({ id: "rep_rachel", code: "rachel", name: "Rachel", active: true, endedAt: null, sellsIn: ["en", "fr"], language: "en" });
  rows.signupLead.push(lead({ salesCode: "rachel" }));
  out = await promoteSignupLeads({ client: db, now: NOW });
  ok("a lead on a rep's link becomes that rep's SalesLead", rows.salesLead.length === 1 && rows.salesLead[0].salesRepId === "rep_rachel" && out.written[0]?.action === "rep_lead");
  ok("…with the Prospect handed to the rep outright (no expiry)", rows.prospect.length === 1 && rows.prospect[0].assignedRepId === "rep_rachel" && rows.prospect[0].claimExpiresAt === null);
  ok("…hot, so it sorts first in their queue", rows.prospect[0].hot === true);
  ok("…the SalesLead points at the prospect", rows.salesLead[0].prospectId === rows.prospect[0].id);
  ok("…and NO SalesQueueClaim was written (the owner did not assign it)", rows.salesQueueClaim.length === 0);
  ok("…the lead records the rep", rows.signupLead[0].referredRepId === "rep_rachel" && rows.signupLead[0].promotedLeadId === rows.salesLead[0].id);

  // (c) a deactivated rep's code → the folder
  resetDbStub();
  rows.salesRep.push({ id: "rep_old", code: "old", name: "Old", active: false, endedAt: daysAgo(3), sellsIn: ["en"] });
  rows.signupLead.push(lead({ salesCode: "old" }));
  await promoteSignupLeads({ client: db, now: NOW });
  ok("a deactivated rep's code does not take the lead — it goes to the folder", rows.salesLead.length === 0 && rows.prospect.length === 1 && !rows.prospect[0].assignedRepId);

  // (d) do-not-contact
  resetDbStub();
  rows.salesSuppression.push({ id: "s1", kind: "phone", value: "+16135550142", channels: ["phone", "sms", "email"], removedAt: null, retainUntil: daysAgo(-999), requestedAt: daysAgo(2), source: "call" });
  rows.signupLead.push(lead());
  out = await promoteSignupLeads({ client: db, now: NOW });
  ok("a do-not-contact phone is never promoted", rows.prospect.length === 0 && rows.signupLead[0].skipReason === "suppressed");
  ok("…and the reason is counted", out.counts.suppressed === 1);

  // (e) a completed signup, even with everything else in place
  resetDbStub();
  rows.signupLead.push(lead({ completedCompanyId: "c_done" }));
  out = await promoteSignupLeads({ client: db, now: NOW });
  ok("a completed signup is never promoted (query excludes it)", rows.prospect.length === 0 && out.considered === 0);

  // (f) completed BETWEEN the list read and the write: the guard on the write
  resetDbStub();
  const racing = lead();
  rows.signupLead.push(racing);
  const origCreate = db.prospect.upsert;
  // Simulate the race: the Company lands while the prospect is being written.
  const patched = { ...db, prospect: { ...db.prospect, upsert: async (args) => { racing.completedCompanyId = "c_race"; return origCreate(args); } } };
  patched.$transaction = async (fn) => fn(patched);
  out = await promoteSignupLeads({ client: patched, now: NOW });
  ok("a signup completed between the read and the write is not linked as promoted", racing.promotedAt == null && racing.prospectId == null && out.counts.completed_before_write === 1);

  // (g) dedupe: an existing Prospect with the phone → linked, flagged hot, not duplicated
  resetDbStub();
  rows.prospect.push({ id: "p_existing", sourceProvider: "rbq", phoneE164: "+16135550142", businessName: "Martin Peinture", status: "discovered", mergedIntoId: null, assignedRepId: null, hot: false });
  rows.signupLead.push(lead());
  out = await promoteSignupLeads({ client: db, now: NOW });
  ok("an existing Prospect with the phone is linked, not duplicated", rows.prospect.length === 1 && rows.signupLead[0].prospectId === "p_existing" && out.written[0]?.action === "link_prospect");
  ok("…and flagged hot with the signup kind", rows.prospect[0].hot === true && rows.prospect[0].signupKind === "abandoned");

  // (h) dedupe: an existing Company with the email → linked as the customer, no lead
  resetDbStub();
  rows.company.push({ id: "c_dave", name: "Dave's", email: "D@X.COM", phone: "613-555-0142", isDemo: false });
  rows.signupLead.push(lead());
  out = await promoteSignupLeads({ client: db, now: NOW });
  ok("an existing Company with the email is linked as completed — no lead", rows.prospect.length === 0 && rows.signupLead[0].completedCompanyId === "c_dave" && rows.signupLead[0].skipReason === "company_exists");

  // (i) too recent → untouched
  resetDbStub();
  rows.signupLead.push(lead({ lastSeenAt: minutesAgo(5) }));
  out = await promoteSignupLeads({ client: db, now: NOW });
  ok("a lead quiet for five minutes is left alone", rows.prospect.length === 0 && !rows.signupLead[0].promotedAt && out.counts.too_recent === 1);

  // The library writes claims in exactly one function.
  const floor = read("lib/signup/salesFloor.js");
  const claimWrites = (floor.match(/salesQueueClaim\.create/g) || []).length;
  ok("lib/signup/salesFloor.js writes SalesQueueClaim in exactly one place", claimWrites === 1, String(claimWrites));
  const assignFn = floor.slice(floor.indexOf("export async function assignSignupToRep"));
  ok("…and that place is assignSignupToRep", /salesQueueClaim\.create/.test(assignFn));
  ok("lib/signup/leads.js writes nothing", !/\.(create|update|upsert|delete)(Many)?\(/.test(read("lib/signup/leads.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The dispatcher and the folder's bulks never see a signup row");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("'signup' is not a claimable status", !CLAIMABLE_STATUSES.includes(SIGNUP_STATUS));
  ok("'signup' is not a review-folder status", !REVIEW_STATUSES.includes(SIGNUP_STATUS));
  resetDbStub();
  rows.prospect.push({ ...prospectFromSignupLead({ id: "l9", email: "d@x.com", companyName: "X", phoneE164: "+16135550142", trades: ["painting"], stepReached: "plan", lastSeenAt: NOW }), id: "p_signup", assignedRepId: null, mergedIntoId: null, doNotContactAt: null, exhaustedAt: null, nextAttemptAt: null });
  rows.prospect.push({ id: "p_pool", status: "discovered", tradeKey: "painting", assignedRepId: null, mergedIntoId: null, doNotContactAt: null, exhaustedAt: null, nextAttemptAt: null });
  const rep = { id: "r", sellsIn: ["en", "fr"] };
  const picked = await db.prospect.findMany({ where: claimCandidateWhere({ tradeKey: "painting", now: NOW, rep }) });
  ok("claimCandidateWhere (the batch claim) never picks the signup row", picked.length === 1 && picked[0].id === "p_pool", picked.map((p) => p.id).join(","));
  const unplaced = await db.prospect.findMany({ where: unplacedSignupWhere(NOW) });
  ok("unplacedSignupWhere (the folder's section) lists exactly the signup row", unplaced.length === 1 && unplaced[0].id === "p_signup");
  ok("the review folder's SQL still names only its own statuses", /Prisma\.join\(REVIEW_STATUSES\)/.test(read("lib/sales/discovery/reviewFolder.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The owner's assign — one claim, the same shape as the hand-pick, with refusals");
// ═══════════════════════════════════════════════════════════════════════════
{
  const admin = { id: "adm1", email: "emilio@fieldquo.com" };
  const rep = { id: "rep_ann", name: "Ann", email: "ann@x", active: true, sellsIn: ["en"] };
  const notify = { push: async () => null, appSentence: async (l, k) => k };
  const seed = (over = {}) => {
    resetDbStub();
    rows.platformAdmin.push({ id: "adm1", email: "emilio@fieldquo.com" });
    rows.prospect.push({ id: "p1", businessName: "Martin Painting", status: SIGNUP_STATUS, signupKind: "abandoned", hot: true, province: "ON", country: "CA", assignedRepId: null, claimExpiresAt: null, doNotContactAt: null, mergedIntoId: null, tradeKey: "painting", ...over });
  };
  seed();
  let r = await assignSignupToRep({ client: db, admin, rep, prospectId: "p1", now: NOW, notify });
  ok("assign hands the row to the rep", r.assigned === 1 && rows.prospect[0].assignedRepId === "rep_ann");
  ok("…with the 48-hour lease the hand-pick writes", rows.prospect[0].claimExpiresAt?.getTime?.() === NOW.getTime() + 48 * 60 * 60 * 1000);
  ok("…exactly one claim row, mode admin, batch names the admin", rows.salesQueueClaim.length === 1 && rows.salesQueueClaim[0].mode === "admin" && /^assigned_by:adm1:/.test(rows.salesQueueClaim[0].batchId));
  ok("…an audit row", rows.platformAuditLog.length === 1 && rows.platformAuditLog[0].action === "leads_assigned" && rows.platformAuditLog[0].details.how === "signup");
  ok("…and the row has left the folder", (await db.prospect.findMany({ where: unplacedSignupWhere(NOW) })).length === 0);
  r = await assignSignupToRep({ client: db, admin, rep, prospectId: "p1", now: NOW, notify });
  ok("assigning it again is refused (already theirs)", r.refused && /Already/.test(r.error) && rows.salesQueueClaim.length === 1);
  seed({ doNotContactAt: daysAgo(1) });
  r = await assignSignupToRep({ client: db, admin, rep, prospectId: "p1", now: NOW, notify });
  ok("do-not-contact is refused", r.refused && /Do not contact/.test(r.error) && rows.salesQueueClaim.length === 0);
  seed({ province: "QC" });
  r = await assignSignupToRep({ client: db, admin, rep, prospectId: "p1", now: NOW, notify });
  ok("a Quebec row to a rep without French is refused", r.refused && /French/.test(r.error) && rows.salesQueueClaim.length === 0);
  r = await assignSignupToRep({ client: db, admin, rep: { ...rep, sellsIn: ["fr"] }, prospectId: "p1", now: NOW, notify });
  ok("…and accepted by one with French", r.assigned === 1);
  seed({ assignedRepId: "rep_other", claimExpiresAt: daysAgo(-1) });
  rows.salesRep.push({ id: "rep_other", name: "Bob" });
  r = await assignSignupToRep({ client: db, admin, rep, prospectId: "p1", now: NOW, notify });
  ok("a row another rep holds is refused, naming them", r.refused && /Bob/.test(r.error));
  seed({ signupKind: null, status: "discovered" });
  r = await assignSignupToRep({ client: db, admin, rep, prospectId: "p1", now: NOW, notify });
  ok("a non-signup row is refused here (the prospects list assigns those)", r.refused && /prospects list/.test(r.error));
  r = await assignSignupToRep({ client: db, admin, rep: { ...rep, active: false }, prospectId: "p1", now: NOW, notify });
  ok("a deactivated rep is refused", /deactivated/.test(r.error));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Hot sorts first — inside its window group, never across one");
// ═══════════════════════════════════════════════════════════════════════════
{
  const windows = {
    groups: [
      { key: "now", kind: "now", ids: ["a", "b", "hot1", "c"] },
      { key: "opens", kind: "opens", ids: ["d", "hot2"] },
    ],
    order: ["a", "b", "hot1", "c", "d", "hot2"],
    byId: {},
  };
  const out = hoistHot(windows, new Set(["hot1", "hot2"]));
  ok("hot row first in 'callable now'", out.groups[0].ids.join(",") === "hot1,a,b,c", out.groups[0].ids.join(","));
  ok("hot row first in its own later group, not moved into 'now'", out.groups[1].ids.join(",") === "hot2,d");
  ok("the flat order follows the groups", out.order.join(",") === "hot1,a,b,c,hot2,d");
  ok("no hot ids → untouched", hoistHot(windows, new Set()) === windows);
  const queue = read("app/api/sales/queue/route.js");
  ok("the queue route hoists hot rows after the retry regroup", /hoistHot\(\s*regroupForRetry\(/.test(queue));
  ok("the queue row carries hot and the signup state", /hot: p\.hot === true,/.test(queue) && /signup: signupStateOf\(p, \{ now \}\)/.test(queue));
  ok("the card puts the signup fact first", /view\.facts = \[signupState\.fact, \.\.\.\(view\.facts \|\| \[\]\)\]/.test(queue));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The badge and the fact in all nine catalogues");
// ═══════════════════════════════════════════════════════════════════════════
{
  const langs = Object.keys(APP_MESSAGES);
  ok("nine catalogues", langs.length === 9, langs.join(","));
  const keys = [
    ...Object.values(SIGNUP_BADGE_KEYS),
    "app.signupLead.ago.minutes", "app.signupLead.ago.hours", "app.signupLead.ago.days",
    "app.signupLead.card.added", "app.signupLead.card.notYet", "app.signupLead.quote.sent", "app.signupLead.quote.notYet",
    "app.salesIntel.fact.signup.label", "app.salesIntel.fact.signup.abandoned", "app.salesIntel.fact.signup.new",
    "app.salesIntel.fact.signup.stalledNoCard", "app.salesIntel.fact.signup.stalledNoQuote",
    "app.signupLead.opener.heading", "app.signupLead.opener.englishFallback",
    "app.signupLead.yours.title", "app.signupLead.yours.intro", "app.signupLead.yours.empty", "app.signupLead.yours.openLead", "app.signupLead.yours.openCompany",
  ];
  for (const l of langs) {
    for (const k of keys) ok(`${l} has ${k}`, typeof APP_MESSAGES[l][k] === "string" && APP_MESSAGES[l][k].trim().length > 0);
  }
  for (const l of langs.filter((x) => x !== "en")) {
    for (const k of Object.values(SIGNUP_BADGE_KEYS)) {
      ok(`${l} badge "${k}" is not the English echo`, APP_MESSAGES[l][k] !== APP_MESSAGES.en[k], APP_MESSAGES[l][k]);
    }
    ok(`${l} abandoned fact keeps every placeholder`, ["{ago}", "{step}", "{trade}", "{language}"].every((p) => APP_MESSAGES[l]["app.salesIntel.fact.signup.abandoned"].includes(p)));
    ok(`${l} new fact keeps every placeholder`, ["{ago}", "{trade}", "{city}", "{language}", "{card}", "{quote}"].every((p) => APP_MESSAGES[l]["app.salesIntel.fact.signup.new"].includes(p)));
    ok(`${l} stalled-no-quote fact keeps {days}`, APP_MESSAGES[l]["app.salesIntel.fact.signup.stalledNoQuote"].includes("{days}"));
    for (const u of ["minutes", "hours", "days"]) ok(`${l} ago.${u} keeps {n}`, APP_MESSAGES[l][`app.signupLead.ago.${u}`].includes("{n}"));
  }
  ok("no translator marker left behind", !/TODO-TRANSLATE/.test(read("app/i18n/appMessages.js")));
  ok("the badge component reads its words through the catalogue", /t\(key\)/.test(read("app/components/sales/SignupBadge.js")));
  ok("the badge component names the same three keys", Object.values(SIGNUP_BADGE_KEYS).every((k) => read("app/components/sales/SignupBadge.js").includes(`"${k}"`)));
  ok("the review folder's section draws the shared badge", /SignupBadge kind=\{r\.signup\?\.badge\}/.test(read("app/platform/sales/review/SignupsSection.js")));
  ok("the queue list draws the badge", /SignupBadge kind=\{item\.signup\.badge\} compact/.test(read("app/sales/queue/page.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The rep's facts, the opener and the intro email variant — en / fr / es");
// ═══════════════════════════════════════════════════════════════════════════
{
  const abandoned = signupFact({ kind: "abandoned", lead: { stepReached: "industry", trades: ["painting"], language: "fr", lastSeenAt: minutesAgo(40) } }, { now: NOW });
  ok("the abandoned fact reads 'Started signup 40 minutes ago — got as far as Trades; trade Painting; language FR'", abandoned.text === "Started signup 40 minutes ago — got as far as Trades; trade Painting; language FR", abandoned.text);
  ok("…keyed for the catalogues with the numbers as params", abandoned.textKey === "app.salesIntel.fact.signup.abandoned" && abandoned.params.n === 40 && abandoned.params.unit === "minutes" && abandoned.badge === "hot");
  const fresh = signupFact({ kind: "new", company: { createdAt: minutesAgo(3 * 60), subscription: { id: "s" }, firstQuoteSentAt: null, city: "Gatineau", industries: ["painting"], defaultLanguage: "fr" } }, { now: NOW });
  ok("the new fact reads card added / first quote not yet", fresh.text === "Signed up 3 hours ago — Painting, Gatineau, FR; card added; first quote not yet", fresh.text);
  ok("…carries the booleans the catalogue words turn on", fresh.params.cardAdded === true && fresh.params.quoteSent === false && fresh.badge === "new");
  const stalled = signupFact({ kind: "stalled", stateReason: "no_quote", company: { createdAt: daysAgo(9), subscription: { id: "s" }, firstQuoteSentAt: null, city: "Ottawa", industries: [], defaultLanguage: "en" } }, { now: NOW });
  ok("the stalled fact names the reason", /Stalled: no quote sent in 7 days$/.test(stalled.text) && stalled.badge === "stalled" && stalled.textKey === "app.salesIntel.fact.signup.stalledNoQuote");
  ok("no kind → no fact", signupFact({ kind: null }) === null);
  ok("a card-less state throws rather than reads as 'no card'", (() => { try { stalledDecision({ company: { createdAt: daysAgo(1) }, now: NOW, checkoutGraceMs: CHECKOUT_GRACE_MS }); return false; } catch { return true; } })());
  ok("no card after the grace → stalled (no_card)", stalledDecision({ company: { createdAt: minutesAgo(90), subscription: null, firstQuoteSentAt: null }, now: NOW, checkoutGraceMs: CHECKOUT_GRACE_MS }).reason === "no_card");
  ok("no card inside the grace → not stalled", stalledDecision({ company: { createdAt: minutesAgo(10), subscription: null, firstQuoteSentAt: null }, now: NOW, checkoutGraceMs: CHECKOUT_GRACE_MS }).stalled === false);
  ok("a card and no quote for 8 days → stalled (no_quote)", stalledDecision({ company: { createdAt: daysAgo(8), subscription: { id: "s" }, firstQuoteSentAt: null }, now: NOW, checkoutGraceMs: CHECKOUT_GRACE_MS }).reason === "no_quote");
  ok("a card and a quote → clear", stalledDecision({ company: { createdAt: daysAgo(30), subscription: { id: "s" }, firstQuoteSentAt: daysAgo(20) }, now: NOW, checkoutGraceMs: CHECKOUT_GRACE_MS }).stalled === false);
  ok("STALLED_NO_QUOTE_DAYS is seven", STALLED_NO_QUOTE_DAYS === 7);

  // signupStateOf: the block every screen reads.
  const state = signupStateOf({ businessName: "Martin Painting", hot: true, signupKind: "abandoned", signupStateReason: "Stopped at Trades", signupLead: { firstName: "Dave", stepReached: "industry", trades: ["painting"], language: "fr", lastSeenAt: minutesAgo(40), resumeToken: "tok" }, company: null }, { now: NOW });
  ok("signupStateOf carries the badge, the language, the step label, the token and the fact", state.badge === "hot" && state.language === "fr" && state.stepLabel === "Trades" && state.resumeToken === "tok" && state.fact?.textKey);
  ok("signupStateOf is null on a discovered prospect", signupStateOf({ signupKind: null }) === null);
  ok("the signup's own language sets the script default (between Quebec and the rep)", defaultScriptLanguage({ prospect: { province: "ON", statedLanguage: "es" }, rep: { language: "fr" } }) === "es");
  ok("…Quebec still wins", defaultScriptLanguage({ prospect: { province: "QC", statedLanguage: "es" }, rep: { language: "en" } }) === "fr");

  // The opener.
  for (const lang of ["en", "fr", "es"]) {
    for (const kind of ["abandoned", "new", "stalled"]) {
      const o = signupOpenerFor({ kind, language: lang, first: "Dave", business: "Martin Painting", rep: "Ann", step: "Trades", at: minutesAgo(30), stalledReason: "no_card", now: NOW });
      ok(`${lang} ${kind} opener has no unfilled field`, o && !/\{[a-z]+\}/.test(o.say + o.ask), o?.say);
      ok(`${lang} ${kind} opener names the rep and the business`, o.say.includes("Ann") && o.say.includes("Martin Painting"));
      ok(`${lang} ${kind} opener is not the fallback`, o.fallback === false && o.language === lang);
      const plain = signupOpenerFor({ kind, language: lang, first: null, business: "Martin Painting", rep: "Ann", step: "Trades", at: NOW, stalledReason: "no_quote", now: NOW });
      ok(`${lang} ${kind} opener without a first name is still a sentence`, !/\{[a-z]+\}/.test(plain.say) && !/^Hi  /.test(plain.say));
    }
  }
  ok("the English abandoned opener is the owner's sentence", /You started setting up FieldQuo for X this morning and got as far as Trades — can I get you the rest of the way\?/.test(signupOpenerFor({ kind: "abandoned", language: "en", first: "Dave", business: "X", rep: "Ann", step: "Trades", at: NOW, now: NOW }).say));
  ok("the English welcome opener is onboarding, not selling", /I'm here to get your first quote out today; got fifteen minutes\?/.test(signupOpenerFor({ kind: "new", language: "en", first: "Dave", business: "X", rep: "Ann", at: NOW, now: NOW }).say));
  ok("the stalled opener names what stalled", /never got a card/.test(signupOpenerFor({ kind: "stalled", language: "en", first: "Dave", business: "X", rep: "Ann", at: NOW, stalledReason: "no_card", now: NOW }).say) && /no quote has gone out/.test(signupOpenerFor({ kind: "stalled", language: "en", first: "Dave", business: "X", rep: "Ann", at: NOW, stalledReason: "no_quote", now: NOW }).say));
  ok("an unknown language falls back to English and says so", signupOpenerFor({ kind: "new", language: "de", business: "X", rep: "A" }).fallback === true);
  ok("an unknown kind is null", signupOpenerFor({ kind: "cold", language: "en" }) === null);
  ok("the call screen draws the opener above the script", /<SignupOpener signup=\{data\.prospect\.signup\}/.test(read("app/components/sales/CallPlaybook.js")));
  ok("the playbook route sends the signup block and the rep's name", /signup,\n/.test(read("app/api/sales/playbook/route.js")) && /repName: rep\.name/.test(read("app/api/sales/playbook/route.js")));
  ok("SIGNUP_OPENERS has the three kinds in the three languages", ["en", "fr", "es"].every((l) => ["abandoned", "new", "stalled"].every((k) => SIGNUP_OPENERS[l][k]?.named && SIGNUP_OPENERS[l][k]?.plain)));

  // The intro email variants.
  const attr = (u) => u.replace(/&/g, "&amp;");
  const common = {
    rep: { name: "Ann Lee", email: "ann@fieldquo.com", phone: "+1 613 555 0100" }, business: "Martin Painting", contactName: "Dave Martin", tradeKey: "painting", country: "CA",
    signupLink: "https://fieldquo.com/signup?sales=ann&link=abc", callbackUrl: "https://fieldquo.com/i/cb", demoUrl: "https://fieldquo.com/d/ann?t=x",
    unsubscribeUrl: "https://fieldquo.com/i/un", screenshotUrl: "https://fieldquo.com/shots/quote-phone.png", mailingAddress: "1 Rue Principale, Gatineau QC", replyToken: "ref123",
  };
  ok("INTRO_VARIANTS are the three signup kinds", INTRO_VARIANTS.join(",") === "signup_abandoned,signup_new,signup_stalled");
  for (const lang of ["en", "fr", "es"]) {
    const resumeUrl = "https://fieldquo.com/signup?sales=ann&link=abc&resume=tok43";
    const a = buildIntroEmail({ ...common, language: lang, variant: "signup_abandoned", resumeUrl, stepLabel: "Trades" });
    ok(`${lang} abandoned: the primary button is the resume link`, a.html.includes(`href="${attr(resumeUrl)}"`) && a.text.includes(`: ${resumeUrl}`));
    ok(`${lang} abandoned: the cold signup link is not the primary`, !a.html.includes(`href="${attr(common.signupLink)}"`));
    ok(`${lang} abandoned: subject is the variant's`, a.subject === SIGNUP_INTRO_COPY[lang].signup_abandoned.subject.replace("{business}", "Martin Painting"), a.subject);
    ok(`${lang} abandoned: no field left unfilled`, !/\{[a-z]+\}/.test(a.html) && !/\{[a-z]+\}/.test(a.text), (a.text.match(/\{[a-z]+\}/g) || []).join(","));
    ok(`${lang} abandoned: the step is named`, a.text.includes("Trades"));
    ok(`${lang} abandoned: the demo button still stands as a secondary`, a.html.includes(`href="${common.demoUrl}"`));
    const n = buildIntroEmail({ ...common, language: lang, variant: "signup_new" });
    ok(`${lang} new: the primary button is the 15-minute setup call (demo link)`, n.html.includes(`href="${common.demoUrl}"`) && n.text.includes(`${SIGNUP_INTRO_COPY[lang].signup_new.cta}: ${common.demoUrl}`));
    ok(`${lang} new: the signup link is gone (they have used it)`, !n.html.includes(common.signupLink) && !n.text.includes(common.signupLink));
    ok(`${lang} new: the demo link appears once as a button, not twice`, (n.html.match(new RegExp(`href="${common.demoUrl.replace(/[?.]/g, "\\$&")}"`, "g")) || []).length === 1);
    ok(`${lang} new: no field left unfilled`, !/\{[a-z]+\}/.test(n.text));
    const s = buildIntroEmail({ ...common, language: lang, variant: "signup_stalled", stalledReason: "no_quote" });
    ok(`${lang} stalled: names what stalled`, s.text.includes(SIGNUP_INTRO_COPY[lang].signup_stalled.noQuote) && !/\{[a-z]+\}/.test(s.text));
    ok(`${lang} stalled: no-card wording when that is the reason`, buildIntroEmail({ ...common, language: lang, variant: "signup_stalled", stalledReason: "no_card" }).text.includes(SIGNUP_INTRO_COPY[lang].signup_stalled.noCard));
    ok(`${lang}: the cold email is unchanged (primary is the signup link)`, buildIntroEmail({ ...common, language: lang }).html.includes(`href="${attr(common.signupLink)}"`));
  }
  ok("an unknown variant throws rather than sending the cold email", (() => { try { buildIntroEmail({ ...common, language: "en", variant: "signup_x" }); return false; } catch { return true; } })());
  ok("the abandoned variant without a resume link throws", (() => { try { buildIntroEmail({ ...common, language: "en", variant: "signup_abandoned" }); return false; } catch { return true; } })());
  const send = read("lib/sales/outreach/introSend.js");
  ok("introSend picks the variant from the lead's prospect signup state", /variant: signup \? `signup_\$\{signup\.kind\}` : null/.test(send));
  ok("introSend builds the resume link off the rep's signup link with the token, never the email", /resumeUrl: signup\?\.kind === "abandoned" && signup\.resumeToken \? `\$\{signupLink\}&resume=\$\{encodeURIComponent\(signup\.resumeToken\)\}` : null/.test(send) && !/resume=\$\{.*email/.test(send));
  ok("the rep's own list is scoped by attribution and the referring rep", /assignedCompanyWhere\(rep\.id\)/.test(read("app/api/sales/signups/route.js")) && /referredRepId: rep\.id/.test(read("app/api/sales/signups/route.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. A company is created — the floor hears; referred means no folder row");
// ═══════════════════════════════════════════════════════════════════════════
{
  const company = { id: "c1", name: "Martin Painting", email: "info@martin.ca", phone: "613-555-0142", city: "Gatineau", province: "QC", country: "CA", industries: ["painting"], createdAt: NOW, isDemo: false };
  // (a) unreferred → welcome row
  resetDbStub();
  let r = await recordSignupCompletion({ client: db, company, ownerEmail: "dave@x.com", ownerName: "Dave Martin", referred: false, now: NOW });
  ok("an unreferred company gets a welcome-call row in the folder", r.reason === "welcome" && rows.prospect.length === 1 && rows.prospect[0].signupKind === "new" && rows.prospect[0].companyId === "c1" && rows.prospect[0].hot === false && rows.prospect[0].status === SIGNUP_STATUS);
  ok("…which says who to ask for", /Dave Martin/.test(rows.prospect[0].signupStateReason));
  ok("…and no claim, no SalesLead", rows.salesQueueClaim.length === 0 && rows.salesLead.length === 0);
  r = await recordSignupCompletion({ client: db, company, ownerEmail: "dave@x.com", referred: false, now: NOW });
  ok("running it again writes no second row", rows.prospect.length === 1);
  // (b) referred → nothing in the folder
  resetDbStub();
  r = await recordSignupCompletion({ client: db, company, ownerEmail: "dave@x.com", referred: true, now: NOW });
  ok("a rep-referred company gets NO folder row", r.reason === "referred" && rows.prospect.length === 0);
  // (c) demo → nothing
  resetDbStub();
  r = await recordSignupCompletion({ client: db, company: { ...company, isDemo: true }, referred: false, now: NOW });
  ok("a demo company gets nothing", r.reason === "demo" && rows.prospect.length === 0);
  // (d) the typed lead is linked as completed; a hot row it already became turns into the welcome row
  resetDbStub();
  rows.signupLead.push({ id: "l1", emailKey: "dave@x.com", email: "dave@x.com", completedCompanyId: null, prospectId: "p_hot", promotedAt: minutesAgo(60) });
  rows.prospect.push({ id: "p_hot", hot: true, signupKind: "abandoned", status: SIGNUP_STATUS, businessName: "Dave", sourceRecordId: "l1" });
  r = await recordSignupCompletion({ client: db, company, ownerEmail: "Dave@X.com", referred: false, now: NOW });
  ok("the SignupLead is linked to the company (never promoted again)", rows.signupLead[0].completedCompanyId === "c1" && rows.signupLead[0].stepReached === "checkout");
  ok("the hot row became the welcome row — hot off, company linked", r.reason === "hot_completed" && rows.prospect[0].hot === false && rows.prospect[0].signupKind === "new" && rows.prospect[0].companyId === "c1");
  // (e) referred with a hot row already written: closed off
  resetDbStub();
  rows.signupLead.push({ id: "l1", emailKey: "dave@x.com", email: "dave@x.com", completedCompanyId: null, prospectId: "p_hot", promotedAt: minutesAgo(60) });
  rows.prospect.push({ id: "p_hot", hot: true, signupKind: "abandoned", status: SIGNUP_STATUS, businessName: "Dave" });
  r = await recordSignupCompletion({ client: db, company, ownerEmail: "dave@x.com", referred: true, now: NOW });
  ok("a referred completion closes off the hot row so nobody rings a rep's customer", rows.prospect[0].hot === false && rows.prospect[0].signupKind === null);
  // (f) a failing client never throws
  const broken = { signupLead: { findFirst: async () => { throw new Error("boom"); } } };
  r = await recordSignupCompletion({ client: broken, company, ownerEmail: "dave@x.com", referred: false, now: NOW });
  ok("a database failure is reported, never thrown at the signup", r.reason === "failed" && /boom/.test(r.error));

  const companies = read("app/api/companies/route.js");
  const at = companies.indexOf("recordSignupCompletion({");
  ok("the companies route calls recordSignupCompletion after the org exists", at > companies.indexOf("data: { authOrgId: org.id }"));
  ok("…with referred = a rep attribution or a referral", /referred: Boolean\(attributedRepId\) \|\| Boolean\(referral\)/.test(companies));
  ok("…and reports a failure to the error log", /signup_completion_not_recorded/.test(companies));
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. The sweep — stalled ⇄ new, and the 30-day welcome backfill");
// ═══════════════════════════════════════════════════════════════════════════
{
  resetDbStub();
  rows.company.push({ id: "c_new", name: "Fresh Co", createdAt: minutesAgo(20), isDemo: false, subscription: null, quotes: [], referredByCode: null, industries: [], _count: { signupProspects: 0 } });
  rows.company.push({ id: "c_old", name: "Old Customer", createdAt: daysAgo(90), isDemo: false, subscription: { id: "s" }, quotes: [], referredByCode: null, industries: [], _count: { signupProspects: 0 } });
  rows.company.push({ id: "c_ref", name: "Referred", createdAt: daysAgo(2), isDemo: false, subscription: { id: "s" }, quotes: [], referredByCode: "friend", industries: [], _count: { signupProspects: 0 } });
  let out = await sweepSignupProspects({ client: db, now: NOW });
  ok("the backfill writes a welcome row for the recent unreferred company only", out.backfilled === 1 && rows.prospect.length === 1 && rows.prospect[0].companyId === "c_new");
  ok("…not for a customer older than 30 days, not for a referred one", !rows.prospect.some((p) => p.companyId === "c_old" || p.companyId === "c_ref"));
  // Stalled flips on the company facts, and clears.
  resetDbStub();
  const co = { id: "c1", name: "Martin", createdAt: minutesAgo(120), isDemo: false, subscription: null, quotes: [], industries: [], city: "X", defaultLanguage: "en" };
  rows.company.push({ ...co, referredByCode: null, _count: { signupProspects: 1 } });
  rows.prospect.push({ id: "p1", signupKind: "new", signupStateReason: "Signed up", companyId: "c1", company: co });
  out = await sweepSignupProspects({ client: db, now: NOW });
  ok("no card after the grace → flipped to stalled (no_card)", out.flippedStalled === 1 && rows.prospect[0].signupKind === "stalled" && rows.prospect[0].signupStateReason === "no_card");
  rows.prospect[0].company = { ...co, subscription: { id: "s" }, quotes: [{ sentAt: NOW }] };
  out = await sweepSignupProspects({ client: db, now: NOW });
  ok("a card and a quote → cleared back to new", out.cleared === 1 && rows.prospect[0].signupKind === "new");
  out = await sweepSignupProspects({ client: db, now: NOW });
  ok("unchanged when nothing moved", out.unchanged === 1 && out.flippedStalled === 0 && out.cleared === 0);
  ok("the cron is registered every fifteen minutes", /"path": "\/api\/cron\/signup-leads",\s*"schedule": "7,22,37,52 \* \* \* \*"/.test(read("vercel.json")));
  const cron = read("app/api/cron/signup-leads/route.js");
  ok("the cron runs the promotion and the sweep behind the cron secret", /requireCronSecret\(request\)/.test(cron) && /promoteSignupLeads\(/.test(cron) && /sweepSignupProspects\(/.test(cron));
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. The recovery email skips a signup a rep holds");
// ═══════════════════════════════════════════════════════════════════════════
{
  const company = { id: "c1", isDemo: false, createdAt: daysAgo(2), email: "dave@x.com", subscription: null, signupNudgeSentAt: null, memberCount: 1 };
  ok("held by a rep → no letter, reason held_by_rep", decideSignupNudge({ company, heldByRep: true, now: NOW }).reason === "held_by_rep");
  ok("not held → due as before", decideSignupNudge({ company, heldByRep: false, now: NOW }).send === true);
  ok("a completed signup is still refused first, held or not", decideSignupNudge({ company: { ...company, subscription: { id: "s" } }, heldByRep: true, now: NOW }).reason === "completed_checkout");
  const plan = planSignupNudges({ companies: [company, { ...company, id: "c2", email: "other@x.com" }], heldCompanyIds: new Set(["c1"]), now: NOW });
  ok("planSignupNudges drops the held company and keeps the other", plan.sends.length === 1 && plan.sends[0].company.id === "c2" && plan.skipped.some((s) => s.companyId === "c1" && s.reason === "held_by_rep"));
  ok("…and does not stamp the held one", !plan.sends[0].stampCompanyIds.includes("c1"));
  const cron = read("app/api/cron/signup-recovery/route.js");
  ok("the recovery cron reads the held rows and passes them to the plan", /assignedRepId: \{ not: null \}/.test(cron) && /planSignupNudges\(\{ companies, suppressedAddresses, heldCompanyIds, now \}\)/.test(cron));
  ok("/platform/signups labels the held state", /held_by_rep:/.test(read("app/platform/signups/page.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("13. What the owner sees");
// ═══════════════════════════════════════════════════════════════════════════
{
  const signupsApi = read("app/api/platform/signups/route.js");
  ok("/api/platform/signups returns the started-never-finished rows", /started,\n/.test(signupsApi) && /db\.signupLead\.findMany/.test(signupsApi));
  ok("…and each incomplete company's floor row with who holds it", /lead,\n/.test(signupsApi) && /assignedTo: live \?/.test(signupsApi));
  const signupsPage = read("app/platform/signups/page.js");
  ok("/platform/signups draws 'hot lead assigned to {rep} / unassigned'", /assigned to \$\{state\.rep\?\.name/.test(signupsPage) && /unassigned, in the review folder/.test(signupsPage));
  ok("…and links the incomplete company's row to the reps page or the folder", /\/platform\/sales\/review\?signups=all/.test(signupsPage));
  const section_ = read("app/platform/sales/review/SignupsSection.js");
  ok("the review folder's section assigns ONE row to ONE rep", /body: \{ prospectId, salesRepId \}/.test(section_) && !/bulk/i.test(section_.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => /fetchJson/.test(l)).join("\n")));
  ok("…and honours ?signups=hot", /v === "hot" \|\| v === "all"/.test(section_));
  const reviewApi = read("app/api/platform/sales/review/signups/route.js");
  ok("the section's API is superadmin-only", /admin\.role !== "superadmin"/.test(reviewApi));
  ok("…and its POST is the one assign", /assignSignupToRep\(\{ client: db, admin, rep, prospectId/.test(reviewApi));
  const analytics = read("app/platform/analytics/page.js");
  ok("the funnel names the SignupLeads behind the drop with a link to the hot ones", /data-funnel-signup-leads/.test(analytics) && /reviewHref/.test(analytics));
  ok("the funnel API counts them", /db\.signupLead\.count/.test(read("app/api/platform/analytics/product/route.js")) && /\/platform\/sales\/review\?signups=hot/.test(read("app/api/platform/analytics/product/route.js")));
  const reps = read("app/platform/sales/reps/page.js");
  ok("/platform/sales/reps says 'referred by {rep}' with the state, never an assign", /referred by \{rep\.name\}/.test(reps) && !/assignSignup/.test(reps));
  ok("the privacy page says a started signup is kept so we can follow up", /If you start the signup form and do not finish it/.test(read("app/(marketing)/privacy/page.js")));
  ok("the Today screen has 'Your signups'", /<YourSignupsCard \/>/.test(read("app/sales/page.js")));
}

console.log(`\n${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
