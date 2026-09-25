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
  resumeEmailKeys,
  signupFact,
  signupLeadFinished,
  stalledDecision,
  unfinishedSignupLeadWhere,
  unplacedSignupWhere,
  worthCapturing,
} from "@/lib/signup/leads";
import { captureBodyFor } from "@/lib/signup/leadCapture";
import { normaliseWebsiteUrl, readWebsiteAnswer } from "@/lib/signup/website";
import {
  assignSignupToRep,
  assignSignupForCallback,
  ensureSignupProspect,
  promoteOneSignupLead,
  setSignupTrade,
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
import {
  dismissSignupRow,
  isDismissed,
  notDismissedWhere,
  prospectNotDismissedClauses,
  readDismissTarget,
  restoreSignupRow,
} from "@/lib/signup/dismissal";

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
  ok("GET requires a resume token or a session, never an email in the URL", /params\.get\("token"\)/.test(route) && !/params\.get\("email"\)/.test(route));
  ok("the route is rate-limited", /rateLimit\(request, "signup-lead"/.test(route));

  const page = read("app/signup/page.js");
  ok("the page posts a JSON body to the capture endpoint", /fetch\(CAPTURE_ENDPOINT, \{\s*method: "POST"/.test(page) && /body: JSON\.stringify\(body\)/.test(page));
  ok("the page never puts the email in the capture URL", !/CAPTURE_ENDPOINT\}\?email=/.test(page) && !/\/api\/signup\/lead\?email/.test(page));
  ok("the page waits CAPTURE_DEBOUNCE_MS after the last change", /setTimeout\(send, CAPTURE_DEBOUNCE_MS\)/.test(page));
  ok("the page posts at once when the step moves", /if \(stepMoved\) send\(\);/.test(page));
  ok("the page keeps the furthest step at the Stripe handoff", /captureBodyFor\(form, "checkout"/.test(page));
  ok("the page uses keepalive so a handoff post still leaves", /keepalive: true,\s*\}\)\.catch/.test(page.split("function postSignupCapture")[1] || ""));
  ok("the resume link is read as a token", /URLSearchParams\(window\.location\.search\)\.get\("resume"\)/.test(page));
  ok("the resume prefill fills only what is still empty", /if \(next\[key\] \|\| !value\) return;/.test(page) && /put\("email", p\.email\)/.test(page));
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
section("2b. A signed-in return puts the row back — the owner's 2026-09-21 bug");
// ═══════════════════════════════════════════════════════════════════════════
//
// He signed back into a company he had taken to Plan, from a fresh session,
// and was shown the business step with every box empty under a banner that
// said nothing was lost. Three things were missing: the address and the
// service picks were never captured, so even a token resume could not get
// past step one; and a signed-in return never asked for the row at all,
// because the only read was by resume token.
{
  // The two answers the resume could not put back are captured now.
  const body = captureBodyFor(
    { email: "d@x.com", password: "hunter22", firstName: "Dave", address: "12 Elm St", city: "Ottawa", companyName: "Martin Painting" },
    "services",
    { selectedIndustries: ["painting"], selectedCategoryIds: ["cmr8n30vx0000uot61rlzeadg", "<script>", 42] },
  );
  ok("the page's body carries the street address", body?.address === "12 Elm St");
  ok("…and the ticked quote types, as ids", Array.isArray(body?.serviceCategoryIds) && body.serviceCategoryIds.length === 2 && body.serviceCategoryIds[0] === "cmr8n30vx0000uot61rlzeadg");
  const parsed = normaliseCapture({ ...body });
  ok("the server keeps the address and drops what is not a catalogue id", parsed.lead?.address === "12 Elm St" && parsed.lead?.serviceCategoryIds?.length === 1);
  ok("markup in the address is refused, not repaired", normaliseCapture({ ...body, address: "<b>12 Elm</b>" }).error === "address");
  const kept = planCaptureWrite({
    existing: { ...parsed.lead, stepReached: "plan" },
    incoming: { emailKey: "d@x.com", email: "d@x.com", stepReached: "account", address: null, serviceCategoryIds: [] },
    now: NOW,
  });
  ok("a later capture without them does not erase the address or the picks", kept.data.address === "12 Elm St" && kept.data.serviceCategoryIds.length === 1);

  // The read by the address a session proves — the same function, a second key.
  resetDbStub();
  await captureSignupLead({ client: db, body: { ...body, email: "Dave@x.com", step: "plan" }, now: NOW });
  const mine = await signupLeadForResume({ client: db, email: "dave@X.com" });
  ok("the resume read answers by normalised email", mine?.address === "12 Elm St" && mine.serviceCategoryIds.length === 1 && mine.stepReached === "plan");
  ok("…and by neither key when both are absent", (await signupLeadForResume({ client: db })) === null);

  const route = read("app/api/signup/lead/route.js");
  ok("?mine=1 takes the address from the SESSION, never the query string", /params\.get\("mine"\) === "1"/.test(route) && /auth\.api\.getSession\(\{ headers: request\.headers \}\)/.test(route) && !/searchParams\.get\("email"\)/.test(route));
  ok("…and a signed-out caller gets the same 404 as an unknown token", /if \(!email && !userId\) return NextResponse\.json\(\{ error: "Not found" \}, \{ status: 404 \}\);/.test(route));

  const page = read("app/signup/page.js");
  const signedIn = page.split("setResumedSignup(true);")[1]?.split("} catch {")[0] || "";
  ok("the signed-in branch asks for the row before entryChecked flips", /CAPTURE_ENDPOINT\}\?mine=1/.test(signedIn) && /applyLeadPrefill\(p\)/.test(signedIn) && /leadStepRef\.current = p\.stepReached/.test(signedIn));
  ok("the resume judges the further of the draft's step and the row's", /further\(draftStepRef\.current, leadStepRef\.current\)/.test(page));
  ok("the prefill puts back the address and the service picks", /put\("address", p\.address\)/.test(page) && /setSelectedCategoryIds\(p\.serviceCategoryIds\)/.test(page));
  ok("the banner claims a restore only when fields the person can see were put back", /const names = restoredFieldNames\(restoredLead\?\.fields, t\);\s*const kept = names\.length > 0;/.test(page) && /"app\.signup\.resumed\.bodyRestoredFields"/.test(page) && !/nothing you've already entered is lost/.test(page));
  ok("the capture posts the picks on every step and at the handoff", (page.match(/selectedCategoryIds,\s*salesCode/g) || []).length >= 3);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2c. The owner's SECOND return, same day — the row the cron had matched to another company");
// ═══════════════════════════════════════════════════════════════════════════
//
// The production row, read back on 2026-09-21 after the fix above shipped:
// Test Company Inc · Ottawa, ON, CA · trades [cleaning] · EN · phone ·
// stepReached "plan" · NO address and NO serviceCategoryIds (captured before
// those columns existed) · completedCompanyId = a company he had set up a
// week earlier under a DIFFERENT email, stamped skipReason "company_exists"
// by the promotion cron's phone match. The auth user has no membership
// anywhere. The page read `completed: true`, put nothing back, showed the
// "carry on below" banner over an empty business form, and had no sign-out.
{
  const OWNER_ROW = {
    id: "owner_row", emailKey: "castes-query.8v@icloud.com", email: "castes-query.8v@icloud.com",
    firstName: "emilio", lastName: "boves", companyName: "Test Company Inc",
    phoneE164: "+18192387263", phoneRaw: "819-238-7263", country: "CA", province: "ON", city: "Ottawa",
    trades: ["cleaning"], language: "en", address: null, serviceCategoryIds: [],
    salesCode: null, referralCode: null, stepReached: "plan", resumeToken: "o".repeat(43),
    startedAt: minutesAgo(60), lastSeenAt: minutesAgo(55), consentAt: minutesAgo(59),
    completedCompanyId: "other_company_of_his", prospectId: null, promotedAt: null, skipReason: "company_exists",
    authUserId: null,
  };

  // ── The rule, executed on that shape ────────────────────────────────────
  ok("a cron dedupe link is NOT a finished signup", signupLeadFinished(OWNER_ROW) === false);
  ok("…a real completion is", signupLeadFinished({ completedCompanyId: "c1", skipReason: null }) === true);
  ok("…and no link is not", signupLeadFinished({ completedCompanyId: null, skipReason: "company_exists" }) === false);
  ok("the query-side twin admits the dedupe-linked row", unfinishedSignupLeadWhere().OR.length === 2);
  ok("the promotion verdict still skips a real completion", decideSignupLeadPromotion({ lead: { ...OWNER_ROW, skipReason: null }, now: NOW }).reason === "completed");
  ok("…and a dedupe-linked row stays skipped as company_exists, never 'completed'", decideSignupLeadPromotion({ lead: OWNER_ROW, now: NOW }).reason === "company_exists");

  // ── The resume read, by the session's address ──────────────────────────
  resetDbStub();
  rows.signupLead = [{ ...OWNER_ROW }];
  const back = await signupLeadForResume({ client: db, email: "castes-query.8v@icloud.com", userId: "IvBY_user" });
  ok("the row comes back for the signed-in session", Boolean(back));
  ok("…flagged NOT completed", back?.completed === false);
  ok("…matched by email", back?.matchedBy === "email");
  const prefillFields = ["companyName", "phone", "city", "province", "country", "language"].filter((k) => back?.[k]);
  ok("…with every first-step field the row has", prefillFields.length === 6, prefillFields.join(","));
  ok("…and its trade, and the furthest step it reached", back?.trades?.[0] === "cleaning" && back?.stepReached === "plan");
  ok("…and nothing invented for the columns it predates", back?.address === null && Array.isArray(back?.serviceCategoryIds) && back.serviceCategoryIds.length === 0);

  // ── The session's spelling differs only by case (and, at gmail, dots) ───
  const byCase = await signupLeadForResume({ client: db, email: "Castes-Query.8V@iCloud.com" });
  ok("a session address that differs only by case still matches", byCase?.companyName === "Test Company Inc");
  ok("icloud dots are NOT collapsed — a dotted and an undotted icloud address are two people", resumeEmailKeys("castes-query.8v@icloud.com").length === 1 && (await signupLeadForResume({ client: db, email: "castesquery8v@icloud.com" })) === null);
  ok("gmail dots and plus tags are collapsed, exact key first", JSON.stringify(resumeEmailKeys("D.Martin+fq@Gmail.com")) === JSON.stringify(["d.martin+fq@gmail.com", "d.martin@gmail.com", "dmartin@gmail.com"]));
  rows.signupLead.push({ ...OWNER_ROW, id: "gmail_row", emailKey: "dmartin@gmail.com", email: "dmartin@gmail.com", resumeToken: "g".repeat(43), completedCompanyId: null, skipReason: null, companyName: "Martin Painting" });
  ok("a gmail session with dots and a tag finds the undotted row", (await signupLeadForResume({ client: db, email: "D.Martin+fq@gmail.com" }))?.companyName === "Martin Painting");
  ok("no email, no user → null", (await signupLeadForResume({ client: db })) === null);

  // ── The user-id fallback ───────────────────────────────────────────────
  rows.signupLead.push({ ...OWNER_ROW, id: "renamed_row", emailKey: "old@x.com", email: "old@x.com", resumeToken: "r".repeat(43), completedCompanyId: null, skipReason: null, companyName: "Renamed Co", authUserId: "user_42" });
  const byUser = await signupLeadForResume({ client: db, email: "new@x.com", userId: "user_42" });
  ok("a login whose address no longer spells the key is found by its user id", byUser?.companyName === "Renamed Co" && byUser.matchedBy === "user");
  ok("a user id nobody's row carries → null (no guessing)", (await signupLeadForResume({ client: db, email: "nobody@x.com", userId: "user_none" })) === null);

  // ── The capture stores the user id only for the session's OWN address ──
  resetDbStub();
  const captureBody = { email: "Dave@x.com", step: "business", firstName: "Dave", companyName: "Martin Painting" };
  await captureSignupLead({ client: db, body: captureBody, now: NOW, session: { userId: "user_dave", email: "dave@X.com" } });
  const created = writes.find((w) => w.model === "signupLead" && w.action === "create");
  ok("a capture on the address's own session stores the user id", created?.data?.authUserId === "user_dave", JSON.stringify(created?.data?.authUserId));
  resetDbStub();
  await captureSignupLead({ client: db, body: { ...captureBody, email: "stranger@x.com" }, now: NOW, session: { userId: "user_dave", email: "dave@x.com" } });
  const strangers = writes.find((w) => w.model === "signupLead" && w.action === "create");
  ok("…and NOT for a stranger's address typed while signed in", strangers && !("authUserId" in strangers.data));
  const bodyPlan = planCaptureWrite({ existing: null, incoming: { emailKey: "d@x.com", email: "d@x.com", stepReached: "account", authUserId: "u1" }, now: NOW });
  ok("planCaptureWrite carries the id when the capture has it", bodyPlan.data.authUserId === "u1");
  ok("…and leaves the column alone when it does not", !("authUserId" in planCaptureWrite({ existing: { authUserId: "u1" }, incoming: { emailKey: "d@x.com", email: "d@x.com", stepReached: "account" }, now: NOW }).data));

  // ── The dedupe-linked row keeps taking captures ────────────────────────
  ok("the capture lock ignores a dedupe link", !planCaptureWrite({ existing: OWNER_ROW, incoming: { emailKey: OWNER_ROW.emailKey, email: OWNER_ROW.email, stepReached: "plan", address: "1 Main St" }, now: NOW }).refusal);
  ok("…and still refuses a real completion", planCaptureWrite({ existing: { ...OWNER_ROW, skipReason: null }, incoming: { emailKey: OWNER_ROW.emailKey, email: OWNER_ROW.email, stepReached: "plan" }, now: NOW }).refusal === "locked");
  resetDbStub();
  rows.signupLead = [{ ...OWNER_ROW }];
  const later = await captureSignupLead({ client: db, body: { email: OWNER_ROW.email, step: "plan", companyName: "Test Company Inc", address: "1 Main St" }, now: NOW });
  ok("…so his next capture (with the address, at last) is written", later.ok === true && later.reason === "updated", later.reason);

  // ── When the company IS created, the guess becomes the fact ────────────
  resetDbStub();
  rows.signupLead = [{ ...OWNER_ROW }];
  rows.prospect = [];
  await recordSignupCompletion({ client: db, company: { id: "test_company_inc", isDemo: false, email: OWNER_ROW.email, name: "Test Company Inc" }, ownerEmail: OWNER_ROW.email, referred: true, now: NOW });
  const relinked = writes.find((w) => w.model === "signupLead" && w.action === "updateMany");
  ok("completing the signup relinks the row to the company it created and clears the stamp", relinked?.data?.completedCompanyId === "test_company_inc" && relinked.data.skipReason === null && relinked.data.stepReached === "checkout");

  // ── The routes and the page ─────────────────────────────────────────────
  const route = read("app/api/signup/lead/route.js");
  ok("the capture route reads the session from the cookie and hands it to captureSignupLead", /const session = await auth\.api\.getSession\(\{ headers: request\.headers \}\)\.catch\(\(\) => null\);\s*const who = session\?\.user\?\.id/.test(route) && /captureSignupLead\(\{ client: db, body, now: new Date\(\), session: who \}\)/.test(route));
  ok("?mine=1 passes the user id as well as the address", /signupLeadForResume\(\{ client: db, token: token \|\| undefined, email, userId \}\)/.test(route));
  ok("…and logs a signed-in return with no row, by user id only", /console\.info\("\[signup\/lead\] signed-in return with no SignupLead", \{ userId \}\)/.test(route) && !/console\.info\([^)]*email/.test(route));
  const platform = read("app/api/platform/signups/route.js");
  ok("/platform/signups lists the dedupe-linked row as unfinished", /where: unfinishedSignupLeadWhere\(\)/.test(platform) && /signedIn: Boolean\(r\.authUserId\)/.test(platform));
  const platformPage = read("app/platform/signups/page.js");
  ok("…and says 'signed in, no company yet' on it", /signed in, no company yet/.test(platformPage));

  const page = read("app/signup/page.js");
  const signedIn = page.split("setResumedSignup(true);")[1]?.split("} catch {")[0] || "";
  ok("the page restores when the server says not completed, and seeds from the session otherwise", /if \(p && !p\.completed\)/.test(signedIn) && /applyLeadPrefill\(\{ email: session\.user\.email, \.\.\.splitName\(session\.user\.name\) \}\)/.test(signedIn));
  ok("the banner names the fields it put back — never the account-step ones a login is not shown", /app\.signup\.resumed\.bodyRestoredFields/.test(page) && /\{ fields: names \}/.test(page) && !/email: \(\) => t\("app\.signup\.field\.email"/.test(page));
  ok("Not you? Sign out clears the tab draft before reloading", /sessionStorage\.removeItem\(DRAFT_KEY\);[\s\S]{0,200}window\.location\.href = to;/.test(page));
  ok("…and says when the missing address is what held the step back", /app\.signup\.resumed\.addressMissing/.test(page) && /!form\.address\.trim\(\)/.test(page));
  ok("the resumed banner has 'Not you? Sign out' that reloads THIS page", /data-resumed-sign-out/.test(page) && /handleSignOut\(window\.location\.pathname \+ window\.location\.search\)/.test(page) && /app\.signup\.resumed\.signOut/.test(page));
  for (const lang of Object.keys(APP_MESSAGES)) {
    const dict = APP_MESSAGES[lang];
    ok(`${lang}: the five banner keys exist`, ["app.signup.resumed.bodyRestoredFields", "app.signup.resumed.addressMissing", "app.signup.resumed.signOut", "app.signup.resumed.field.trades", "app.signup.resumed.field.services"].every((k) => typeof dict[k] === "string" && dict[k]));
    ok(`${lang}: the restored sentence carries both placeholders`, /\{email\}/.test(dict["app.signup.resumed.bodyRestoredFields"] || "") && /\{fields\}/.test(dict["app.signup.resumed.bodyRestoredFields"] || ""));
  }

  // The landing step for that row, through the same clamp the page uses:
  // the furthest step reached is Plan, but without an address the company
  // cannot be created, so the clamp lands on Business — with the form full
  // and the banner saying the address is what is missing.
  const { resumeStep } = await import("@/lib/signup/funnel");
  ok("the owner's row lands on Business (no address), not on an empty account step", resumeStep("plan", { accountExists: true, companyReady: false, hasIndustries: true, hasServices: false }) === "business");
  ok("…and with an address it lands on Services (no picks were ever captured), the step after the one he had answers for", resumeStep("plan", { accountExists: true, companyReady: true, hasIndustries: true, hasServices: false }) === "services");
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
section("6b. Assign for callback from /platform/signups — the row is written the cron's way, then handed over");
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner's 2026-09-21 complaint: a started signup showed its raw trade
// word and had no way to be handed to somebody for a call back. The assign
// finds or WRITES the Prospect through the same promotion the cron runs
// (immediate — the two waits are the cron's patience, not a rule), and then
// through the one assign write above. A referred signup goes to its rep and
// nobody else.
{
  const admin = { id: "adm1", email: "emilio@fieldquo.com" };
  const ann = { id: "rep_ann", name: "Ann", email: "ann@x", active: true, sellsIn: ["en"] };
  const bob = { id: "rep_bob", name: "Bob", email: "bob@x", active: true, endedAt: null, sellsIn: ["en"], code: "bob-1" };
  const notify = { push: async () => null, appSentence: async (l, k) => k };
  const leadRow = (over = {}) => ({ id: "lead1", emailKey: "t@x.com", email: "t@x.com", firstName: "Tess", companyName: "Test Company inc.", phoneE164: "+16135550142", trades: ["painting"], stepReached: "plan", lastSeenAt: minutesAgo(2), completedCompanyId: null, prospectId: null, promotedAt: null, promotedLeadId: null, skipReason: null, salesCode: null, referredRepId: null, province: "ON", country: "CA", resumeToken: "tok", ...over });
  const seed = (over = {}) => {
    resetDbStub();
    rows.platformAdmin.push({ id: "adm1", email: "emilio@fieldquo.com" });
    rows.salesRep.push({ ...bob });
    rows.signupLead.push(leadRow(over));
  };

  // The rule, immediate: the waits are skipped, the refusals are not.
  const lead = leadRow();
  ok("the cron would wait — two minutes quiet", decideSignupLeadPromotion({ lead, now: NOW }).action === "wait");
  ok("a human asking now is not made to wait", decideSignupLeadPromotion({ lead, now: NOW, immediate: true }).action === "prospect");
  ok("…nor for a phone", decideSignupLeadPromotion({ lead: leadRow({ phoneE164: null }), now: NOW, immediate: true }).action === "prospect");
  ok("…but a completed row is still a customer", decideSignupLeadPromotion({ lead: leadRow({ completedCompanyId: "c" }), now: NOW, immediate: true }).action === "skip");
  ok("…and a suppressed one is still refused", decideSignupLeadPromotion({ lead, now: NOW, immediate: true, suppressed: true }).reason === "suppressed");

  // Executed: a two-minute-old lead, assigned now.
  seed();
  let r = await assignSignupForCallback({ client: db, admin, rep: ann, leadId: "lead1", now: NOW, notify });
  ok("the lead becomes a hot Prospect on the spot", r.assigned === 1 && rows.prospect.length === 1 && rows.prospect[0].signupKind === "abandoned" && rows.prospect[0].hot === true);
  ok("…with the trade its own word maps to", rows.prospect[0].tradeKey === "painting");
  ok("…linked from the lead, promoted, stopped-at recorded", rows.signupLead[0].prospectId === rows.prospect[0].id && rows.signupLead[0].promotedAt && /Stopped at Plan/.test(rows.prospect[0].signupStateReason));
  ok("…and handed to Ann with the same lease and claim row as the review folder", rows.prospect[0].assignedRepId === "rep_ann" && rows.salesQueueClaim.length === 1 && rows.salesQueueClaim[0].mode === "admin");
  ok("…the audit row says how", rows.platformAuditLog[0]?.details?.how === "signup_callback");
  ok("the answer names the rep and the row", r.rep?.name === "Ann" && r.prospectId === rows.prospect[0].id);
  r = await assignSignupForCallback({ client: db, admin, rep: ann, leadId: "lead1", now: NOW, notify });
  ok("a second press is refused — already Ann's — and writes nothing more", r.refused && rows.salesQueueClaim.length === 1 && rows.prospect.length === 1);

  // Through the cron's own loop the same row is a no-op (promoted already).
  const cron = await promoteSignupLeads({ client: db, now: NOW });
  ok("the cron later finds nothing to do with it", cron.written.length === 0 && rows.prospect.length === 1);

  // Referred: goes to Bob whoever was picked.
  seed({ salesCode: "bob-1" });
  r = await assignSignupForCallback({ client: db, admin, rep: ann, leadId: "lead1", now: NOW, notify });
  ok("a signup on Bob's link is refused for Ann, naming Bob", r.refused && /Bob/.test(r.error) && r.referredRepId === "rep_bob");
  ok("…and is Bob's already: his SalesLead, the Prospect handed to him, no claim row", rows.prospect[0]?.assignedRepId === "rep_bob" && rows.salesLead.length === 1 && rows.salesQueueClaim.length === 0);
  r = await assignSignupForCallback({ client: db, admin, rep: bob, leadId: "lead1", now: NOW, notify });
  ok("pressing it for Bob himself says so rather than writing a second claim", r.alreadyTheirs === true && rows.salesQueueClaim.length === 0);

  // No phone: still assignable by hand (the rep can write).
  seed({ phoneE164: null });
  r = await assignSignupForCallback({ client: db, admin, rep: ann, leadId: "lead1", now: NOW, notify });
  ok("a lead with no phone can still be handed out by a human", r.assigned === 1 && rows.prospect[0].phoneE164 === null);

  // Set trade on a row whose words mapped to nothing.
  seed({ trades: ["something-odd"] });
  ok("an unknown word maps to no trade", prospectFromSignupLead(leadRow({ trades: ["something-odd"] })).tradeKey === null);
  r = await setSignupTrade({ client: db, leadId: "lead1", tradeKey: "roofing", now: NOW });
  ok("set trade writes the Prospect (creating it the cron's way) and the trade", r.ok && rows.prospect.length === 1 && rows.prospect[0].tradeKey === "roofing" && rows.signupLead[0].prospectId === rows.prospect[0].id);
  ok("…the raw word is kept as the source category", rows.prospect[0].sourceCategories?.[0] === "something-odd");
  r = await setSignupTrade({ client: db, leadId: "lead1", tradeKey: "not-a-trade", now: NOW });
  ok("a made-up trade key is refused", /Not a trade/.test(r.error));

  // A company row with no floor row gets the welcome row, then the hand-over.
  resetDbStub();
  rows.platformAdmin.push({ id: "adm1", email: "emilio@fieldquo.com" });
  rows.company.push({ id: "c1", name: "Card Screen Co", email: "c@x.com", phone: "613-555-0100", city: "Ottawa", province: "ON", country: "CA", industries: ["cleaning"], defaultLanguage: "en", createdAt: minutesAgo(30), isDemo: false, subscription: null, salesAttribution: null, referredByCode: null, quotes: [], signupProspects: [], members: [] });
  r = await assignSignupForCallback({ client: db, admin, rep: ann, companyId: "c1", now: NOW, notify });
  ok("a card-screen company gets its welcome row written and handed over", r.assigned === 1 && rows.prospect.length === 1 && rows.prospect[0].companyId === "c1" && rows.prospect[0].signupKind === "new");
  ok("…hot, because the owner asked for a callback", rows.prospect[0].hot === true && rows.prospect[0].tradeKey === "house_cleaning");
  ok("…and the badge on the rep's card agrees", signupFact({ kind: "new", hot: true, company: { createdAt: minutesAgo(30), subscription: null, industries: ["cleaning"] } }, { now: NOW }).badge === "hot");
  rows.company[0].subscription = { id: "sub" };
  r = await ensureSignupProspect({ client: db, companyId: "c1", now: NOW });
  ok("a company that paid is a customer — no floor row for it", r.error && r.reason === "completed" || r.prospectId === rows.prospect[0].id);
  rows.company.push({ id: "c2", name: "Referred Co", email: "r@x.com", industries: [], createdAt: minutesAgo(30), isDemo: false, subscription: null, salesAttribution: { salesRepId: "rep_bob" }, referredByCode: null, quotes: [], signupProspects: [], members: [] });
  r = await assignSignupForCallback({ client: db, admin, rep: ann, companyId: "c2", now: NOW, notify });
  ok("a company on a rep's link is theirs — refused for anyone else, no row written", r.refused && r.referredRepId === "rep_bob" && rows.prospect.length === 1);

  // The route and the screen.
  const assignRoute = read("app/api/platform/signups/assign/route.js");
  ok("the write route is superadmin-only and separate from the read-only list", /admin\.role !== "superadmin"/.test(assignRoute) && !/export async function (GET|PATCH|DELETE)/.test(assignRoute));
  ok("…and goes through the one function, never a second assign", /assignSignupForCallback\(/.test(assignRoute) && !/salesQueueClaim\.create/.test(assignRoute) && !/prospect\.update/.test(assignRoute));
  ok("…and never touches a Company", !/db\.company\./.test(assignRoute));
  const listRoute = read("app/api/platform/signups/route.js");
  ok("every row carries the trade its own words map to — the promotion's mapping", /tradeKeyForIndustries\(/.test(listRoute) && /trade: tradeOf\(/.test(listRoute) && (listRoute.match(/trade: tradeOf\(/g) || []).length === 2);
  ok("…and which follow-ups went out, from the log", /db\.signupNudge\.findMany/.test(listRoute) && (listRoute.match(/nudges: nudgesFor\(/g) || []).length === 2);
  const page = read("app/platform/signups/page.js");
  ok("the screen posts to the write route", page.includes("/api/platform/signups/assign"));
  ok("the screen has the four filters and sorts by last seen", /key: "phone"/.test(page) && /key: "unassigned"/.test(page) && /key: "assigned"/.test(page) && /new Date\(b\.lastSeenAt \|\| 0\) - new Date\(a\.lastSeenAt \|\| 0\)/.test(page));
  ok("the screen has the sticky bulk bar with a rep picker and a per-row assign", /data-bulk-bar/.test(page) && /data-bulk-rep/.test(page) && /data-assign-callback/.test(page) && /data-set-trade/.test(page));
  ok("a referred, held or removed row is never tickable", /const tickable = isSuperadmin && !r\.referred\?\.id && !r\.assignedTo && !r\.doNotContact && !r\.dismissed;/.test(page));
  ok("the screen prints the follow-ups sent", /Follow-up sent/.test(page) && /data-followups/.test(page));
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
  ok("an unselected trialEndsAt throws rather than reads as 'no trial'", (() => { try { stalledDecision({ company: { createdAt: daysAgo(1), subscription: null }, now: NOW, checkoutGraceMs: CHECKOUT_GRACE_MS }); return false; } catch { return true; } })());
  ok("no card and no trial date after the grace → stalled (no_card)", stalledDecision({ company: { createdAt: minutesAgo(90), subscription: null, trialEndsAt: null, firstQuoteSentAt: null }, now: NOW, checkoutGraceMs: CHECKOUT_GRACE_MS }).reason === "no_card");
  ok("no card inside the grace → not stalled", stalledDecision({ company: { createdAt: minutesAgo(10), subscription: null, trialEndsAt: null, firstQuoteSentAt: null }, now: NOW, checkoutGraceMs: CHECKOUT_GRACE_MS }).stalled === false);
  // jaspedo, 2026-09-25: a card-free trial (no Subscription row, a trial date)
  // was flipped to "Stalled — no card" an hour in. Signup took no card; it
  // finished. Only the no-quote leg may stall it.
  const TRIAL_ENDS = new Date(NOW.getTime() + 29 * 86400000);
  ok("a card-free trial after the grace is NOT stalled for lacking a card", stalledDecision({ company: { createdAt: minutesAgo(90), subscription: null, trialEndsAt: TRIAL_ENDS, firstQuoteSentAt: null }, now: NOW, checkoutGraceMs: CHECKOUT_GRACE_MS }).stalled === false);
  ok("…but a card-free trial with no quote for 8 days IS stalled (no_quote)", stalledDecision({ company: { createdAt: daysAgo(8), subscription: null, trialEndsAt: TRIAL_ENDS, firstQuoteSentAt: null }, now: NOW, checkoutGraceMs: CHECKOUT_GRACE_MS }).reason === "no_quote");
  ok("a card and no quote for 8 days → stalled (no_quote)", stalledDecision({ company: { createdAt: daysAgo(8), subscription: { id: "s" }, trialEndsAt: null, firstQuoteSentAt: null }, now: NOW, checkoutGraceMs: CHECKOUT_GRACE_MS }).reason === "no_quote");
  ok("a card and a quote → clear", stalledDecision({ company: { createdAt: daysAgo(30), subscription: { id: "s" }, trialEndsAt: null, firstQuoteSentAt: daysAgo(20) }, now: NOW, checkoutGraceMs: CHECKOUT_GRACE_MS }).stalled === false);
  ok("the floor's company read selects the trial date stalledDecision needs", /trialEndsAt: true/.test(read("lib/signup/salesFloor.js")) && /trialEndsAt: company\.trialEndsAt/.test(read("lib/signup/salesFloor.js")));
  ok("…and so do the rep's list and the reps screen, the other two stalledDecision callers",
    /trialEndsAt: true/.test(read("app/api/sales/signups/route.js")) && /trialEndsAt: true/.test(read("app/api/platform/sales/reps/route.js")));
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
  ok("the playbook route sends the signup block and the rep's PUBLIC name (work name, else first name)", /signup,\n/.test(read("app/api/sales/playbook/route.js")) && /repName: repPublicName\(rep\)/.test(read("app/api/sales/playbook/route.js")));
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
  const co = { id: "c1", name: "Martin", createdAt: minutesAgo(120), isDemo: false, subscription: null, trialEndsAt: null, quotes: [], industries: [], city: "X", defaultLanguage: "en" };
  rows.company.push({ ...co, referredByCode: null, _count: { signupProspects: 1 } });
  rows.prospect.push({ id: "p1", signupKind: "new", signupStateReason: "Signed up", companyId: "c1", company: co });
  out = await sweepSignupProspects({ client: db, now: NOW });
  ok("no card after the grace → flipped to stalled (no_card)", out.flippedStalled === 1 && rows.prospect[0].signupKind === "stalled" && rows.prospect[0].signupStateReason === "no_card");
  rows.prospect[0].company = { ...co, subscription: { id: "s" }, quotes: [{ sentAt: NOW }] };
  out = await sweepSignupProspects({ client: db, now: NOW });
  ok("a card and a quote → cleared back to new", out.cleared === 1 && rows.prospect[0].signupKind === "new");
  out = await sweepSignupProspects({ client: db, now: NOW });
  ok("unchanged when nothing moved", out.unchanged === 1 && out.flippedStalled === 0 && out.cleared === 0);
  // A row the OLD rule flipped to stalled for a card-free trial flips back on
  // the next sweep, by the fixed rule — no hand edit of the live rows.
  rows.prospect[0].signupKind = "stalled";
  rows.prospect[0].signupStateReason = "no_card";
  rows.prospect[0].company = { ...co, trialEndsAt: new Date(NOW.getTime() + 29 * 86400000) };
  out = await sweepSignupProspects({ client: db, now: NOW });
  ok("an existing 'stalled — no card' row for a card-free trial is cleared back to new by the next sweep", out.cleared === 1 && rows.prospect[0].signupKind === "new");
  ok("the cron is registered every fifteen minutes", /"path": "\/api\/cron\/signup-leads",\s*"schedule": "7,22,37,52 \* \* \* \*"/.test(read("vercel.json")));
  const cron = read("app/api/cron/signup-leads/route.js");
  ok("the cron runs the promotion and the sweep behind the cron secret", /requireCronSecret\(request\)/.test(cron) && /promoteSignupLeads\(/.test(cron) && /sweepSignupProspects\(/.test(cron));
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. The recovery email skips a signup a rep holds");
// ═══════════════════════════════════════════════════════════════════════════
{
  const company = { id: "c1", isDemo: false, createdAt: daysAgo(2), email: "dave@x.com", subscription: null, trialEndsAt: null, signupNudgeSentAt: null, memberCount: 1 };
  ok("held by a rep → no letter, reason held_by_rep", decideSignupNudge({ company, heldByRep: true, now: NOW }).reason === "held_by_rep");
  ok("not held → due as before", decideSignupNudge({ company, heldByRep: false, now: NOW }).send === true);
  ok("a completed signup is still refused first, held or not", decideSignupNudge({ company: { ...company, subscription: { id: "s" } }, heldByRep: true, now: NOW }).reason === "completed_checkout");
  const plan = planSignupNudges({ companies: [company, { ...company, id: "c2", email: "other@x.com" }], heldCompanyIds: new Set(["c1"]), now: NOW });
  ok("planSignupNudges drops the held company and keeps the other", plan.sends.length === 1 && plan.sends[0].company.id === "c2" && plan.skipped.some((s) => s.companyId === "c1" && s.reason === "held_by_rep"));
  ok("…and does not stamp the held one", !plan.sends[0].stampCompanyIds.includes("c1"));
  const cron = read("app/api/cron/signup-recovery/route.js");
  ok("the recovery cron reads the held rows and passes them to the plan", /assignedRepId: \{ not: null \}/.test(cron) && /planSignupNudges\(\{ companies, suppressedAddresses, heldCompanyIds, dismissedCompanyIds, now \}\)/.test(cron));
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

// ═══════════════════════════════════════════════════════════════════════════
section("14. Remove from list — hidden everywhere, deleted nowhere");
// ═══════════════════════════════════════════════════════════════════════════
{
  // The pure half, against hostile shapes.
  ok("isDismissed: an active dismissal", isDismissed({ signupDismissal: { dismissedAt: NOW, restoredAt: null } }) === true);
  ok("…a restored one is not", isDismissed({ signupDismissal: { dismissedAt: NOW, restoredAt: NOW } }) === false);
  ok("…no row, a null relation, undefined, garbage — not", [{}, { signupDismissal: null }, null, undefined, "x", { signupDismissal: {} }].every((r) => isDismissed(r) === false));
  ok("readDismissTarget takes exactly one id", JSON.stringify(readDismissTarget({ leadId: "l1" })) === '{"leadId":"l1"}' && JSON.stringify(readDismissTarget({ companyId: " c1 " })) === '{"companyId":"c1"}');
  ok("…refuses both, neither, blanks and non-strings", [{ leadId: "l", companyId: "c" }, {}, { leadId: "" }, { companyId: 7 }, null, "l1"].every((t) => readDismissTarget(t) === null));
  ok("notDismissedWhere is a NOT on the active dismissal (composes with a caller's OR)",
    JSON.stringify(notDismissedWhere()) === JSON.stringify({ NOT: { signupDismissal: { is: { restoredAt: null } } } }));
  const unplaced = unplacedSignupWhere(NOW);
  ok("the review folder's WHERE refuses a removed lead's or company's row, in an AND beside the lease OR",
    Array.isArray(unplaced.OR) && JSON.stringify(unplaced.AND) === JSON.stringify(prospectNotDismissedClauses()) &&
      JSON.stringify(unplaced.AND).includes('"signupLead"') && JSON.stringify(unplaced.AND).includes('"company"'));

  // The write, executed against the stub.
  resetDbStub();
  rows.signupLead.push({ id: "l1", emailKey: "junk@x.com", email: "junk@x.com" });
  rows.company.push({ id: "c9", name: "Demo", isDemo: true });
  rows.company.push({ id: "c1", name: "Test Test", isDemo: false });
  const admin = { id: "a1", role: "superadmin" };
  let r = await dismissSignupRow({ client: db, admin, target: { leadId: "l1" }, now: NOW });
  ok("remove writes one SignupDismissal and an audit line", r.ok && rows.signupDismissal.length === 1 && rows.signupDismissal[0].signupLeadId === "l1" && rows.signupDismissal[0].dismissedById === "a1" && rows.platformAuditLog.some((a) => a.action === "signup_dismissed"));
  r = await dismissSignupRow({ client: db, admin, target: { leadId: "l1" }, now: NOW });
  ok("…removing it again is a no-op", r.already === true && rows.signupDismissal.length === 1);
  r = await restoreSignupRow({ client: db, admin, target: { leadId: "l1" }, now: NOW });
  ok("restore stamps restoredAt and KEEPS the row (history, not a delete)", r.ok && rows.signupDismissal.length === 1 && rows.signupDismissal[0].restoredAt === NOW && rows.signupDismissal[0].restoredById === "a1");
  r = await dismissSignupRow({ client: db, admin, target: { leadId: "l1" }, now: NOW });
  ok("…and a second remove re-stamps the same row, clearing the restore", r.ok && rows.signupDismissal.length === 1 && rows.signupDismissal[0].restoredAt === null);
  ok("a demo company is refused", (await dismissSignupRow({ client: db, admin, target: { companyId: "c9" }, now: NOW })).error);
  ok("an id nobody has is refused", (await dismissSignupRow({ client: db, admin, target: { leadId: "nope" }, now: NOW })).error);
  const before = JSON.stringify(rows.company);
  r = await dismissSignupRow({ client: db, admin, target: { companyId: "c1" }, now: NOW });
  ok("removing a company writes nothing to the Company (non-negotiable #3)", r.ok && JSON.stringify(rows.company) === before && !writes.some((w) => w.model === "company" || w.model === "signupLead"));
  ok("the writes never call delete", !writes.some((w) => /delete/i.test(w.action)));
  ok("the write functions throw without a client or an admin", await (async () => { try { await dismissSignupRow({ admin, target: { leadId: "l1" } }); return false; } catch { return true; } })() && await (async () => { try { await restoreSignupRow({ client: db, target: { leadId: "l1" } }); return false; } catch { return true; } })());

  // "Assign for callback" on a removed row is refused with the reason.
  resetDbStub();
  rows.signupLead.push({ id: "l2", emailKey: "x@x.com", email: "x@x.com", signupDismissal: { dismissedAt: NOW, restoredAt: null } });
  const placed = await ensureSignupProspect({ client: db, leadId: "l2", now: NOW });
  ok("ensureSignupProspect refuses a removed lead", placed.reason === "dismissed", JSON.stringify(placed));

  // Every reader spreads it — written AND read (AGENTS.md failure class 1).
  const floor = read("lib/signup/salesFloor.js");
  ok("promoteSignupLeads never promotes a removed lead", /completedCompanyId: null, promotedAt: null, skipReason: null, phoneE164: \{ not: null \}, \.\.\.notDismissedWhere\(\)/.test(floor));
  ok("the welcome backfill never writes a row for a removed company", /signupProspects: \{ none: \{\} \}, \.\.\.notDismissedWhere\(\)/.test(floor));
  const cron = read("app/api/cron/signup-recovery/route.js");
  ok("both letters read the dismissal (leads, companies, the 24-hour rows, both fresh re-reads)", (cron.match(/DISMISSAL_SELECT/g) || []).length >= 6 && /dismissedCompanyIds/.test(cron) && /isDismissed\(freshLead\)/.test(cron) && /isDismissed\(freshCompany\)/.test(cron) && /isDismissed\(fresh\)/.test(cron));
  const route = read("app/api/platform/signups/dismiss/route.js");
  ok("the dismiss route is superadmin-only, checked server-side", /admin\.role !== "superadmin"/.test(route) && /status: 403/.test(route));
  ok("…and has no DELETE handler and no delete call", !/export async function DELETE/.test(route) && !/\.delete(Many)?\(/.test(route) && !/\.delete(Many)?\(/.test(read("lib/signup/dismissal.js")));
  const api = read("app/api/platform/signups/route.js");
  ok("the list returns removed rows flagged, for Show removed / Restore", (api.match(/dismissed: dismissalOf\(/g) || []).length === 2 && /\.\.\.DISMISSAL_SELECT/.test(api));
  const page = read("app/platform/signups/page.js");
  ok("the page hides removed rows unless asked, and offers Restore", /data-show-removed/.test(page) && /Show removed \(\$\{removedCount\}\)/.test(page) && /"Restore"/.test(page) && /"Remove from list"/.test(page) && /\/api\/platform\/signups\/dismiss/.test(page));
  ok("the schema's dismissal is its own table keyed on the lead or the company", /model SignupDismissal \{[\s\S]*signupLeadId String\?\s+@unique[\s\S]*companyId\s+String\?\s+@unique/.test(read("prisma/schema.prisma")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("15. A finished card-free trial on /platform/signups — what it is, never 'got as far as Checkout'");
// ═══════════════════════════════════════════════════════════════════════════
{
  const api = read("app/api/platform/signups/route.js");
  ok("the incomplete list is incompleteSignupWhere (no row AND no trial date); trials come back as their own array",
    /where: \{ isDemo: false, \.\.\.incompleteSignupWhere\(\) \}/.test(api) && /where: \{ isDemo: false, \.\.\.cardFreeTrialWhere\(\) \}/.test(api) && /\n    trials,\n/.test(api));
  ok("a finished row carries no step and the trial state from trialAccessFor", /stepLabel: finished \? null/.test(api) && /trialAccessFor\(c, now\)/.test(api));
  const page = read("app/platform/signups/page.js");
  ok("the page splits 'Signed up — on free trial' from 'Incomplete signups — never finished'", /Signed up — on free trial/.test(page) && /Incomplete signups — never finished/.test(page));
  ok("a trial row reads 'Signed up · free trial, N days left · no plan chosen yet'", /Signed up · free trial, \$\{days\} left · no plan chosen yet/.test(page));
  ok("…and 'got as far as' is only printed for an unfinished row", /r\.section === "trial" \? ` · \$\{trialLine\(r\.trial\)\}` : r\.stepLabel \? ` · got as far as/.test(page));
  // The section lists every card-free trial whatever its day (cardFreeTrialWhere),
  // so its link lands on `card_free`, which the route resolves with the same
  // isCardFreeTrial predicate — not on the Trialing·no-plan BUCKET, which
  // holds only the ones still inside their thirty days.
  ok("the trial section links to the companies list filtered to the same population", /\/platform\/companies\?status=card_free/.test(page) && /status === "card_free"\) return \(c\) => isCardFreeTrial\(c\)/.test(read("app/api/platform/companies/route.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("16. \"Do you have a website?\" — kept on the draft row, put back on resume");
// ═══════════════════════════════════════════════════════════════════════════
{
  // The reader, against hostile input.
  ok("a bare domain gains https://", normaliseWebsiteUrl(" Shop.Example.ca ") === "https://shop.example.ca");
  ok("javascript:, data:, mailto:, localhost, an IP, credentials, spaces — all refused",
    ["javascript:alert(1)", "data:text/html,x", "mailto:a@b.co", "localhost:3000", "10.0.0.1", "https://u:p@x.com", "not a site", "x", "", null, 7].every((v) => normaliseWebsiteUrl(v) === null));
  ok("readWebsiteAnswer: yes + an address", JSON.stringify(readWebsiteAnswer({ hasWebsite: true, website: "abc.ca" })) === '{"hasWebsite":true,"website":"https://abc.ca"}');
  ok("…yes + garbage is an error, never a repaired guess", readWebsiteAnswer({ hasWebsite: true, website: "nope" }).error === "website");
  ok("…no drops whatever was typed", JSON.stringify(readWebsiteAnswer({ hasWebsite: false, website: "abc.ca" })) === '{"hasWebsite":false,"website":null}');
  ok("…'true', 1, 'yes' and absence are unanswered, not a yes", ["true", 1, "yes", undefined].every((v) => readWebsiteAnswer({ hasWebsite: v, website: "abc.ca" }).hasWebsite === null));

  // The capture: the page's body carries it, the normaliser keeps it.
  const base = { email: "w@x.com", firstName: "W", companyName: "W Co", password: "secret" };
  const bodyNo = captureBodyFor({ ...base, hasWebsite: false, website: "leftover.com" }, "account");
  ok("the capture body carries a No, and no address with it", bodyNo.hasWebsite === false && bodyNo.website === null);
  const bodyYes = captureBodyFor({ ...base, hasWebsite: true, website: "shop.example.ca" }, "account");
  ok("…and a Yes with its address", bodyYes.hasWebsite === true && bodyYes.website === "shop.example.ca");
  ok("…and an unanswered question as null", captureBodyFor(base, "account").hasWebsite === null);
  ok("the password is still never in the body", !JSON.stringify(bodyYes).includes("secret"));
  const readYes = normaliseCapture(bodyYes);
  ok("normaliseCapture keeps the yes and the normalised address", readYes.lead.hasWebsite === true && readYes.lead.website === "https://shop.example.ca");
  const half = normaliseCapture({ ...bodyYes, website: "shop" });
  ok("…a half-typed address keeps the yes and drops the address (a draft, not a refusal)", half.lead.hasWebsite === true && half.lead.website === null && !half.error);
  ok("…a hostile hasWebsite is unanswered", normaliseCapture({ ...bodyYes, hasWebsite: "true" }).lead.hasWebsite === null);

  // The write: a later "no" clears the address; an unanswered capture keeps the answer.
  const existing = { stepReached: "account", hasWebsite: true, website: "https://shop.example.ca", trades: [], serviceCategoryIds: [] };
  const toNo = planCaptureWrite({ existing, incoming: normaliseCapture(bodyNo).lead, now: NOW });
  ok("a later No clears the stored address", toNo.data.hasWebsite === false && toNo.data.website === null);
  const silent = planCaptureWrite({ existing, incoming: normaliseCapture(captureBodyFor(base, "account")).lead, now: NOW });
  ok("a capture that does not answer keeps the stored answer and address", silent.data.hasWebsite === true && silent.data.website === "https://shop.example.ca");

  // The resume puts it back.
  resetDbStub();
  rows.signupLead.push({ id: "lw", emailKey: "w@x.com", email: "w@x.com", resumeToken: "tok-w", stepReached: "industry", hasWebsite: false, website: null, trades: [], serviceCategoryIds: [] });
  const prefill = await signupLeadForResume({ client: db, token: "tok-w" });
  ok("the resume prefill carries the No", prefill?.hasWebsite === false);
  const page = read("app/signup/page.js");
  ok("the page puts a stored answer back only while its own is empty", /if \(next\.hasWebsite == null && \(p\.hasWebsite === true \|\| p\.hasWebsite === false\)\)/.test(page));
  ok("the tab's draft keeps it (the whole form is saved, minus the password)", /hasWebsite: null,\n\s+website: "",/.test(page) && /const \{ password, \.\.\.safeForm \} = form;/.test(page));
  ok("the company is created with it, re-read server-side", /readWebsiteAnswer\(\{ hasWebsite, website \}\)/.test(read("app/api/companies/route.js")) && /website: websiteAnswer\.website,\n\s+hasWebsite: websiteAnswer\.hasWebsite,/.test(read("app/api/companies/route.js")));
  ok("the schema carries the answer on the company and the draft row", /hasWebsite\s+Boolean\?/.test(read("prisma/schema.prisma")) && /model SignupLead \{[\s\S]*hasWebsite Boolean\?\n\s+website\s+String\?/.test(read("prisma/schema.prisma")));
}

console.log(`\n${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
