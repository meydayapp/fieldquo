// scripts/check-signup-assignment.mjs
//
//   npm run check:signup-assignment
//
// Who holds a signup row, how it got there, and the two console actions
// that change it — executed against the scripted db, not read.
//
// ══ What is being defended (the owner, 2026-09-24, /platform/signups) ══════
//
//   do not contact  a row FieldQuo's do-not-contact LIST closes (not only the
//                   Prospect's own flag) is never in the review folder, never
//                   counted as waiting, never assigned, never reassigned, and
//                   reads "Do not contact — {reason}" — Luma Painting
//                   (cmuexlkrx000g04l31cjjldy5) is the fixture, shaped from
//                   the live rows. The two letters refuse it too.
//   holder          rep / Platform (in the folder or not) / unassigned /
//                   a rep's own link.
//   history         oldest first; a move's release sorts before the new
//                   assignment it caused and reads as one line; a take-back
//                   names the admin from the audit row; a lease nobody
//                   closed reads as lapsed.
//   take back       releases the lease through unassignFromRep (reason
//                   "admin"), audits, pushes the rep; a second press writes
//                   nothing; a worked row and a rep's own lead are refused.
//   reassign        compare-and-set on the old holder, one claim closed and
//                   one opened (mode admin, the admin in its batch), audit,
//                   both reps pushed; every assign refusal applies.
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-signup-assignment.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { db, reads, resetDbStub, rows, writes } from "./fixtures/dbStub.mjs";
import {
  dncSentence,
  loadSignupHistories,
  reassignSignup,
  signupAssignmentHistory,
  signupDncFrom,
  signupDoNotContact,
  signupHolderOf,
  signupSuppressions,
  takeBackSignup,
} from "@/lib/signup/assignment";
import { assignSignupForCallback, assignSignupToRep, countUnplacedSignups, listUnplacedSignups } from "@/lib/signup/salesFloor";
import { SIGNUP_STATUS } from "@/lib/signup/leads";
import { decideSignupNudge } from "@/lib/signup/abandoned";
import { decideEarlyNudge } from "@/lib/signup/earlyNudge";
import { AUDIT_ACTIONS } from "@/lib/platform/auditActions";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

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

// releaseUntouched asks `typeof db.salesSmsMessage?.findMany` — the stub's
// Proxy throws on any model it does not script, so the one table the
// release reads optionally is answered "not here" (the real client has it;
// the release then keeps a texted row, which is not what is under test).
const client = new Proxy(db, { get: (t, p) => (p === "salesSmsMessage" ? undefined : t[p]) });

const NOW = new Date("2026-09-25T12:00:00Z");
const at = (iso) => new Date(iso);
const hoursAgo = (n) => new Date(NOW.getTime() - n * 3600 * 1000);
const admin = { id: "adm1", email: "emilio.boves@gmail.com" };
const ann = { id: "rep_ann", name: "Ann", email: "ann@x", active: true, endedAt: null, sellsIn: ["en"] };
const bob = { id: "rep_bob", name: "Bob", email: "bob@x", active: true, endedAt: null, sellsIn: ["en"] };
const pushes = [];
const notify = { push: async (args) => { pushes.push({ ids: args.salesRepIds, payload: await args.payload("en") }); return null; }, appSentence: async (l, k, p = {}) => `${k}|${JSON.stringify(p)}` };

// Luma Painting as the live database holds it (read 2026-09-25): a trial
// company, its welcome row, the do-not-contact row its unsubscribe wrote,
// and the one claim — assigned by the console at 22:32 after the
// unsubscribe at 15:28, released by the rep's "Release the rest" at 23:38.
const LUMA = {
  company: { id: "cmuexlkrx000g04l31cjjldy5", name: "Luma Painting ", email: "si.nowhere.universe@gmail.com", phone: "645-234-6616", isDemo: false, referredByCode: null, salesAttribution: null, trialEndsAt: at("2026-10-24T06:47:20.671Z"), createdAt: at("2026-09-24T06:47:20.685Z"), subscription: null, industries: ["painting"], quotes: [], members: [{ user: { email: "si.nowhere.universe@gmail.com", name: "Luma" } }], signupProspects: [{ id: "cmuexlkza000j04l3bq77mr0l", assignedRepId: null }] },
  prospect: { id: "cmuexlkza000j04l3bq77mr0l", businessName: "Luma Painting ", status: SIGNUP_STATUS, signupKind: "new", hot: false, companyId: "cmuexlkrx000g04l31cjjldy5", email: "si.nowhere.universe@gmail.com", phoneE164: "+16452346616", province: "FL", country: "US", tradeKey: "painting", assignedRepId: null, assignedAt: null, claimExpiresAt: null, doNotContactAt: null, doNotContactReason: null, mergedIntoId: null, signupStateAt: at("2026-09-25T06:37:23.261Z") },
  suppression: { id: "cmufg7cwj001304kwgxx3ee0s", kind: "email", value: "si.nowhere.universe@gmail.com", channels: ["email", "phone", "sms"], source: "form", reason: "Unsubscribed from a FieldQuo signup follow-up email (incomplete signup).", removedAt: null, requestedAt: at("2026-09-24T15:28:10.003Z"), createdAt: at("2026-09-24T15:28:10.003Z") },
  claim: { id: "cmufvdblw000f04l5yko2p81r", salesRepId: "rep_ali", prospectId: "cmuexlkza000j04l3bq77mr0l", claimedAt: at("2026-09-24T22:32:42.455Z"), mode: "admin", batchId: "assigned_by:adm1:mufvdbkn", position: 25, repTimeZone: "Asia/Karachi", localDate: "2026-09-24", workedAt: null, releasedAt: at("2026-09-24T23:38:56.219Z"), releaseReason: "rest" },
};

function seedLuma() {
  resetDbStub();
  pushes.length = 0;
  rows.platformAdmin.push({ id: "adm1", email: admin.email });
  rows.salesRep.push({ id: "rep_ali", name: "Ali", active: true, endedAt: null, sellsIn: ["en"] }, { ...ann }, { ...bob });
  rows.company.push({ ...LUMA.company });
  rows.prospect.push({ ...LUMA.prospect });
  rows.salesSuppression.push({ ...LUMA.suppression });
  rows.salesQueueClaim.push({ ...LUMA.claim });
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. Do not contact — the list, not only the flag");
// ═══════════════════════════════════════════════════════════════════════════
{
  const live = { kind: "email", value: "a@x.com", channels: ["email"], source: "form", reason: "Unsubscribed.", removedAt: null };
  ok("an email-only opt-out is do-not-contact on the floor too", signupDncFrom({ rows: [live] }).dnc === true);
  ok("…with the stored reason, full stop trimmed", signupDncFrom({ rows: [live] }).reason === "Unsubscribed");
  ok("a phone opt-out is do-not-contact", signupDncFrom({ rows: [{ ...live, kind: "phone", value: "+16135550142", channels: ["phone"] }] }).dnc);
  ok("a REMOVED suppression does not count", signupDncFrom({ rows: [{ ...live, removedAt: NOW }] }).dnc === false);
  ok("the Prospect's own flag counts, with its reason", signupDncFrom({ rows: [], prospect: { doNotContactAt: NOW, doNotContactReason: "Asked on the phone" } }).reason === "Asked on the phone");
  ok("nothing on file → not do-not-contact", signupDncFrom({}).dnc === false);
  ok("the sentence is 'Do not contact — {reason}'", dncSentence({ dnc: true, reason: "Unsubscribed" }) === "Do not contact — Unsubscribed");

  resetDbStub();
  rows.salesSuppression.push({ ...live, kind: "email", value: "a@x.com" }, { ...live, kind: "phone", value: "+16135550142", channels: ["phone"] });
  const map = await signupSuppressions({
    client,
    contacts: [
      { key: "byEmail", emails: ["A@X.com"], phones: [] },
      { key: "byPhone", emails: ["other@y.com"], phones: ["613-555-0142"] },
      { key: "clean", emails: ["c@z.com"], phones: ["613-555-0199"] },
      { key: "nothing", emails: [null], phones: [undefined] },
    ],
  });
  ok("batch: an address matched case-insensitively", map.get("byEmail").dnc);
  ok("batch: a typed phone matched to its E.164 key", map.get("byPhone").dnc);
  ok("batch: an unlisted row is clear", map.get("clean").dnc === false && map.get("nothing").dnc === false);
  ok("batch: ONE read of the list for all four rows, and no write", reads.filter((x) => x.model === "salesSuppression").length === 1 && writes.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Luma Painting — out of the folder, out of every assign path, and says why");
// ═══════════════════════════════════════════════════════════════════════════
{
  seedLuma();
  // A second, clean unplaced signup row beside it: the folder is not empty
  // by accident.
  rows.prospect.push({ ...LUMA.prospect, id: "p_clean", companyId: "c_clean", email: "clean@x.com", phoneE164: "+16135550100", businessName: "Clean Co", hot: true });
  const listed = await listUnplacedSignups({ client, now: NOW });
  ok("the review folder's section lists the clean row and NOT Luma", listed.length === 1 && listed[0].id === "p_clean", listed.map((r) => r.id).join(","));
  ok("the funnel's count agrees with the list", (await countUnplacedSignups({ client, now: NOW })) === 1);
  ok("…and the hot-only count too", (await countUnplacedSignups({ client, now: NOW, hotOnly: true })) === 1);

  const before = rows.salesQueueClaim.length;
  let r = await assignSignupToRep({ client, admin, rep: ann, prospectId: LUMA.prospect.id, now: NOW, notify });
  ok("the review folder's assign refuses Luma, with the sentence", r.refused && r.error === "Do not contact — Unsubscribed from a FieldQuo signup follow-up email (incomplete signup)", r.error);
  ok("…and writes no claim and no holder", rows.salesQueueClaim.length === before && rows.prospect[0].assignedRepId === null);
  r = await assignSignupForCallback({ client, admin, rep: ann, companyId: LUMA.company.id, now: NOW, notify });
  ok("/platform/signups' Assign for callback refuses Luma too", r.refused && /^Do not contact — /.test(r.error), r.error);
  ok("…still no claim", rows.salesQueueClaim.length === before);

  // Held by a rep AND do-not-contact: the rep can be relieved of it, but it
  // is never moved to another.
  rows.prospect[0].assignedRepId = "rep_ann";
  rows.prospect[0].assignedAt = hoursAgo(1);
  rows.prospect[0].claimExpiresAt = new Date(NOW.getTime() + 47 * 3600 * 1000);
  r = await reassignSignup({ client, admin, rep: bob, companyId: LUMA.company.id, now: NOW, notify });
  ok("reassign refuses a do-not-contact row and says take it back instead", r.refused && r.doNotContact && /Take it back/.test(r.error));
  ok("…and moved nothing", rows.prospect[0].assignedRepId === "rep_ann");
  rows.prospect[0].assignedRepId = null;
  rows.prospect[0].assignedAt = null;
  rows.prospect[0].claimExpiresAt = null;

  // The fresh read beats the screen: an opt-out that lands between the
  // folder's list and the press.
  resetDbStub();
  rows.platformAdmin.push({ id: "adm1", email: admin.email });
  rows.prospect.push({ ...LUMA.prospect, id: "p2", email: "late@x.com", phoneE164: "+16135550111" });
  ok("a row not yet opted out is listed", (await listUnplacedSignups({ client, now: NOW })).length === 1);
  rows.salesSuppression.push({ kind: "phone", value: "+16135550111", channels: ["phone", "sms"], source: "call", reason: "Asked on the phone", removedAt: null });
  r = await assignSignupToRep({ client, admin, rep: ann, prospectId: "p2", now: NOW, notify });
  ok("an opt-out that arrived after the list was read still wins the assign", r.refused && /Asked on the phone/.test(r.error) && rows.salesQueueClaim.length === 0);

  // The letters: both refuse a suppressed person (they already did — held
  // here so the claim "every path" is executed, not assumed).
  ok("the 24-hour letter refuses a suppressed company", decideSignupNudge({ company: { id: "c", email: "a@x.com", isDemo: false, subscription: null, trialEndsAt: null, createdAt: hoursAgo(30), memberCount: 1 }, suppressed: true, now: NOW }).send === false);
  ok("the five-minute letter refuses a suppressed person", decideEarlyNudge({ person: { email: "a@x.com", lastActivityAt: hoursAgo(1) }, suppressed: true, now: NOW }).reason === "suppressed");
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Luma renders as what it is");
// ═══════════════════════════════════════════════════════════════════════════
{
  seedLuma();
  const dnc = await signupDoNotContact({ client, emails: [LUMA.company.email], phones: [LUMA.company.phone], prospect: LUMA.prospect });
  const holder = signupHolderOf({ prospect: LUMA.prospect, dnc, repName: new Map([["rep_ali", "Ali"]]), now: NOW });
  ok("holder: the Platform's, kept out of the review folder", holder.kind === "platform" && holder.inFolder === false && /kept out of the review folder/.test(holder.text), holder.text);
  ok("never 'in the review folder'", !/in the review folder/.test(holder.text));
  const { histories } = await loadSignupHistories({ client, prospects: [LUMA.prospect], repName: new Map(), now: NOW });
  const h = histories.get(LUMA.prospect.id) || [];
  ok("history: two lines, assigned then released", h.length === 2 && h[0].type === "assigned" && h[1].type === "released", JSON.stringify(h.map((e) => e.text)));
  ok("…'Assigned to Ali' by the admin the batch names", h[0]?.text === "Assigned to Ali" && h[0]?.by === admin.email);
  ok("…'Ali released the rest of their queue'", h[1]?.text === "Ali released the rest of their queue" && h[1]?.by === null);
  ok("…in time order", h[0]?.at < h[1]?.at);

  const api = read("app/api/platform/signups/route.js");
  ok("the list API asks the do-not-contact LIST for every row, both kinds", /signupSuppressions\(\{/.test(api) && /key: `company:\$\{c\.id\}`/.test(api) && /key: `lead:\$\{r\.id\}`/.test(api));
  ok("…and every row carries holder, history and actions", (api.match(/\bholder,\n/g) || []).length === 2 && (api.match(/actions: actionsFor\(/g) || []).length === 2 && (api.match(/\.\.\.dncFields\(dncRow\)/g) || []).length === 2);
  ok("…a do-not-contact row is never offered an assign or a move", /reassign: heldByRep && !dnc\.dnc/.test(api) && /assign: !heldByRep && [^\n]*!dnc\.dnc/.test(api));
  const page = read("app/platform/signups/page.js");
  ok("the page's floor line is do-not-contact first, whatever else is true", /function floorLine\(row, otherwise\) \{\n\s+if \(row\.doNotContact\) return dncState\(row\);/.test(page));
  ok("…both kinds of row go through it", (page.match(/floorText: floorLine\(/g) || []).length === 2);
  ok("the review-folder link is drawn only when the API says the folder offers the row", /\{r\.holder\?\.inFolder && !r\.assignedTo \? \(\n\s+<Link href="\/platform\/sales\/review\?signups=all"/.test(page));
  ok("a started row's do-not-contact is no longer hard-coded false", !/doNotContact: false,/.test(page));
  ok("the page draws the holder, the history, take back and reassign", /data-holder=/.test(page) && /data-assignment-history/.test(page) && /data-take-back/.test(page) && /data-reassign/.test(page));
  ok("no Assign for callback on a do-not-contact row", /isSuperadmin && !r\.doNotContact && !r\.dismissed \? \(/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. History — ordering, moves, take-backs, lapses");
// ═══════════════════════════════════════════════════════════════════════════
{
  const repName = new Map([["rep_ann", "Ann"], ["rep_bob", "Bob"]]);
  const adminName = new Map([["adm1", "emilio.boves@gmail.com"]]);
  const t = (h) => new Date(NOW.getTime() - h * 3600 * 1000);
  // Out of order on purpose: the reader sorts.
  const claims = [
    { salesRepId: "rep_bob", claimedAt: t(5), mode: "admin", batchId: "assigned_by:adm1:x2", workedAt: null, releasedAt: t(2), releaseReason: "admin" },
    { salesRepId: "rep_ann", claimedAt: t(30), mode: "admin", batchId: "assigned_by:adm1:x1", workedAt: null, releasedAt: t(5), releaseReason: "reassigned" },
  ];
  const audits = [
    { action: "leads_unassigned", platformAdminId: "adm1", createdAt: new Date(t(2).getTime() + 300), details: { repId: "rep_bob", prospectIds: ["p"], at: t(2).toISOString() } },
    // Another prospect's take-back at the same moment: not ours.
    { action: "leads_unassigned", platformAdminId: "adm_other", createdAt: t(2), details: { repId: "rep_bob", prospectIds: ["q"] } },
  ];
  const h = signupAssignmentHistory({ claims, audits, prospectId: "p", prospect: { assignedRepId: null }, repName, adminName, now: NOW });
  ok("oldest first", h.every((e, i) => i === 0 || h[i - 1].at <= e.at), h.map((e) => e.at.toISOString()).join(" "));
  ok("three lines: assigned, reassigned, taken back", h.length === 3 && h.map((e) => e.type).join(",") === "assigned,reassigned,released", h.map((e) => e.type).join(","));
  ok("the move is ONE line naming both reps and the admin", h[1].text === "Reassigned from Ann to Bob" && h[1].by === "emilio.boves@gmail.com");
  ok("the take-back names the admin from ITS audit row, not a neighbour's", h[2].text === "Taken back from Bob to Platform" && h[2].by === "emilio.boves@gmail.com");

  // Same instant, no merge (the new claim is in hand but a different
  // prospect's) — a release still sorts before an assignment at one instant.
  const same = signupAssignmentHistory({
    claims: [
      { salesRepId: "rep_bob", claimedAt: t(3), mode: "admin", batchId: null, releasedAt: null, workedAt: null },
      { salesRepId: "rep_ann", claimedAt: t(10), mode: "admin", batchId: null, releasedAt: t(3), releaseReason: "rep" },
    ],
    prospectId: "p",
    prospect: { assignedRepId: "rep_bob", claimExpiresAt: new Date(NOW.getTime() + 3600e3) },
    repName,
    now: NOW,
  });
  ok("at one instant a release reads before the assignment after it", same.map((e) => e.type).join(",") === "assigned,released,assigned" && same[1].text === "Ann gave it back");
  ok("…a live lease adds no 'lapsed' line", !same.some((e) => /lapsed/.test(e.text)));

  const lapsed = signupAssignmentHistory({
    claims: [{ salesRepId: "rep_ann", claimedAt: t(60), mode: "admin", batchId: null, releasedAt: null, workedAt: null }],
    prospectId: "p",
    prospect: { assignedRepId: "rep_ann", claimExpiresAt: t(12) },
    repName,
    now: NOW,
  });
  ok("a lease nobody closed reads as lapsed, at its 48-hour mark", lapsed.length === 2 && lapsed[1].text === "Ann's 48-hour lease lapsed" && lapsed[1].at.getTime() === t(12).getTime());

  const worked = signupAssignmentHistory({
    claims: [{ salesRepId: "rep_ann", claimedAt: t(10), mode: "admin", batchId: null, releasedAt: null, workedAt: t(9) }],
    prospectId: "p",
    prospect: { assignedRepId: "rep_ann", claimExpiresAt: null },
    repName,
    now: NOW,
  });
  ok("a worked claim says so, and is not lapsed", worked.length === 2 && worked[1].type === "worked" && !worked.some((e) => /lapsed/.test(e.text)));

  const referred = signupAssignmentHistory({ referred: { rep: { id: "rep_bob", name: "Bob" }, at: t(40) }, claims: [], prospectId: "p", now: NOW });
  ok("a rep's own lead opens with the link it came in on", referred.length === 1 && referred[0].text === "Came in on Bob's link — theirs");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Take back to the platform — once, logged, the rep told");
// ═══════════════════════════════════════════════════════════════════════════
{
  const seed = (over = {}) => {
    resetDbStub();
    pushes.length = 0;
    rows.platformAdmin.push({ id: "adm1", email: admin.email });
    rows.salesRep.push({ ...ann }, { ...bob });
    rows.company.push({ id: "c1", name: "Held Co", email: "held@x.com", phone: "613-555-0123", isDemo: false, referredByCode: null, salesAttribution: null, members: [] });
    rows.prospect.push({ id: "p1", businessName: "Held Co", status: SIGNUP_STATUS, signupKind: "new", hot: true, companyId: "c1", email: "held@x.com", phoneE164: "+16135550123", province: "ON", country: "CA", tradeKey: "painting", assignedRepId: "rep_ann", assignedAt: hoursAgo(2), claimExpiresAt: new Date(NOW.getTime() + 46 * 3600e3), doNotContactAt: null, mergedIntoId: null, ...over });
    rows.salesQueueClaim.push({ id: "k1", salesRepId: "rep_ann", prospectId: "p1", claimedAt: hoursAgo(2), mode: "admin", batchId: "assigned_by:adm1:a", position: 0, localDate: "2026-09-25", workedAt: null, releasedAt: null, releaseReason: null });
  };
  seed();
  let r = await takeBackSignup({ client, admin, companyId: "c1", now: NOW, notify });
  ok("take back releases Ann's lease", r.takenBack === 1 && rows.prospect[0].assignedRepId === null && rows.prospect[0].claimExpiresAt === null, JSON.stringify(r));
  ok("…closes her claim with reason 'admin'", rows.salesQueueClaim[0].releaseReason === "admin" && rows.salesQueueClaim[0].releasedAt?.getTime() === NOW.getTime());
  const audit = rows.platformAuditLog.filter((a) => a.action === "leads_unassigned");
  ok("…one audit row naming the admin, the rep, the row, how and when", audit.length === 1 && audit[0].platformAdminId === "adm1" && audit[0].details.repId === "rep_ann" && audit[0].details.prospectIds[0] === "p1" && audit[0].details.how === "signup_take_back" && audit[0].details.at === NOW.toISOString());
  ok("…and pushes Ann, naming the business", pushes.length === 1 && pushes[0].ids[0] === "rep_ann" && /takenBackLine/.test(pushes[0].payload.body) && /Held Co/.test(pushes[0].payload.body) && /Emilio Boves/.test(pushes[0].payload.body));
  ok("…and never touches the Company", !writes.some((w) => w.model === "company"));
  const writesAfterFirst = writes.length;
  r = await takeBackSignup({ client, admin, companyId: "c1", now: new Date(NOW.getTime() + 1000), notify });
  ok("a second press is a no-op: already the platform's", r.already === true && r.takenBack === 0);
  ok("…with not one more write, audit or push", writes.length === writesAfterFirst && rows.platformAuditLog.length === 1 && pushes.length === 1);
  ok("…and the row is back in the review folder", (await listUnplacedSignups({ client, now: NOW })).map((p) => p.id).join(",") === "p1");

  // The history reads it back with the admin's name. (createdAt is the
  // column's @default(now()) in Postgres; the stub's create writes only what
  // it is given, so the default is applied here, as the database would.)
  for (const a of rows.platformAuditLog) a.createdAt ??= new Date(NOW.getTime() + 200);
  const { histories } = await loadSignupHistories({ client, prospects: [rows.prospect[0]], repName: new Map(), now: NOW });
  const h = histories.get("p1");
  ok("the history ends 'Taken back from Ann to Platform · by the admin'", h.at(-1)?.text === "Taken back from Ann to Platform" && h.at(-1)?.by === admin.email, JSON.stringify(h));

  seed({ claimExpiresAt: null });
  r = await takeBackSignup({ client, admin, companyId: "c1", now: NOW, notify });
  ok("a WORKED row is refused — a conversation is not a lease", r.refused && r.worked && rows.prospect[0].assignedRepId === "rep_ann" && pushes.length === 0);

  seed({ assignedRepId: null, claimExpiresAt: null });
  r = await takeBackSignup({ client, admin, companyId: "c1", now: NOW, notify });
  ok("a row nobody holds: already the platform's, nothing written", r.already && writes.length === 0);

  seed({ claimExpiresAt: hoursAgo(1) });
  r = await takeBackSignup({ client, admin, companyId: "c1", now: NOW, notify });
  ok("a lapsed lease is nobody's: nothing to take back", r.already && writes.length === 0);

  seed();
  rows.company[0].salesAttribution = { salesRepId: "rep_bob" };
  r = await takeBackSignup({ client, admin, companyId: "c1", now: NOW, notify });
  ok("a signup on a rep's link is refused — theirs by attribution", r.refused && /Bob's link/.test(r.error) && writes.length === 0);

  resetDbStub();
  r = await takeBackSignup({ client, admin, companyId: "nope", now: NOW, notify });
  ok("an unknown row is refused, nothing written", r.refused && writes.length === 0);
  let threw = false;
  try { await takeBackSignup({ client, admin: null, companyId: "c1", now: NOW }); } catch { threw = true; }
  ok("no admin, no take-back", threw);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Reassign — straight from one rep to another");
// ═══════════════════════════════════════════════════════════════════════════
{
  const seed = (over = {}) => {
    resetDbStub();
    pushes.length = 0;
    rows.platformAdmin.push({ id: "adm1", email: admin.email });
    rows.salesRep.push({ ...ann }, { ...bob });
    rows.signupLead.push({ id: "l1", emailKey: "t@x.com", email: "t@x.com", phoneE164: "+16135550142", prospectId: "p1", promotedLeadId: null, referredRepId: null });
    rows.prospect.push({ id: "p1", businessName: "Test Co", status: SIGNUP_STATUS, signupKind: "abandoned", hot: true, email: "t@x.com", phoneE164: "+16135550142", province: "ON", country: "CA", tradeKey: "painting", assignedRepId: "rep_ann", assignedAt: hoursAgo(3), claimExpiresAt: new Date(NOW.getTime() + 45 * 3600e3), doNotContactAt: null, mergedIntoId: null, ...over });
    rows.salesQueueClaim.push({ id: "k1", salesRepId: "rep_ann", prospectId: "p1", claimedAt: hoursAgo(3), mode: "admin", batchId: "assigned_by:adm1:a", position: 0, localDate: "2026-09-25", workedAt: null, releasedAt: null, releaseReason: null });
  };
  seed();
  let r = await reassignSignup({ client, admin, rep: bob, leadId: "l1", now: NOW, notify });
  ok("the row moves from Ann to Bob with a fresh 48 hours", r.reassigned === 1 && rows.prospect[0].assignedRepId === "rep_bob" && rows.prospect[0].claimExpiresAt.getTime() === NOW.getTime() + 48 * 3600e3);
  ok("Ann's claim closes 'reassigned'; Bob's opens in mode admin naming the admin", rows.salesQueueClaim[0].releaseReason === "reassigned" && rows.salesQueueClaim[1]?.salesRepId === "rep_bob" && rows.salesQueueClaim[1].mode === "admin" && /^assigned_by:adm1:/.test(rows.salesQueueClaim[1].batchId));
  ok("an audit row signup_reassigned with both reps", rows.platformAuditLog.length === 1 && rows.platformAuditLog[0].action === "signup_reassigned" && rows.platformAuditLog[0].details.fromRepId === "rep_ann" && rows.platformAuditLog[0].details.toRepId === "rep_bob");
  ok("both reps are pushed — Bob assigned, Ann taken back", pushes.length === 2 && pushes[0].ids[0] === "rep_bob" && pushes[1].ids[0] === "rep_ann" && /takenBackLine/.test(pushes[1].payload.body));
  const { histories } = await loadSignupHistories({ client, prospects: [rows.prospect[0]], repName: new Map(), now: NOW });
  const h = histories.get("p1");
  ok("the history reads 'Assigned to Ann' then 'Reassigned from Ann to Bob' by the admin", h.map((e) => e.text).join(" | ") === "Assigned to Ann | Reassigned from Ann to Bob" && h[1].by === admin.email, h.map((e) => e.text).join(" | "));
  r = await reassignSignup({ client, admin, rep: bob, leadId: "l1", now: NOW, notify });
  ok("moving it to the rep who has it is refused", r.refused && /Already Bob's/.test(r.error));

  seed({ claimExpiresAt: null });
  rows.salesQueueClaim[0].workedAt = hoursAgo(2);
  r = await reassignSignup({ client, admin, rep: bob, leadId: "l1", now: NOW, notify });
  ok("a worked row moves and stays worked", r.reassigned === 1 && rows.prospect[0].assignedRepId === "rep_bob" && rows.prospect[0].claimExpiresAt === null && rows.salesQueueClaim.at(-1).workedAt?.getTime() === NOW.getTime());
  ok("…Ann's worked claim is left as it was (reassign.js's convention)", rows.salesQueueClaim[0].releasedAt == null);
  for (const a of rows.platformAuditLog) a.createdAt ??= new Date(NOW.getTime() + 200);
  const wh = (await loadSignupHistories({ client, prospects: [rows.prospect[0]], repName: new Map(), now: NOW })).histories.get("p1");
  ok("…and its history says she worked it, then where it went (from the audit row)", wh.map((e) => e.text).join(" | ") === "Assigned to Ann | Ann worked it — spoke to them | Reassigned from Ann to Bob" && wh.at(-1).by === admin.email, wh.map((e) => e.text).join(" | "));

  seed({ province: "QC" });
  r = await reassignSignup({ client, admin, rep: bob, leadId: "l1", now: NOW, notify });
  ok("a Quebec row to a rep without French is refused", r.refused && /French/.test(r.error) && rows.prospect[0].assignedRepId === "rep_ann");
  seed();
  r = await reassignSignup({ client, admin, rep: { ...bob, active: false }, leadId: "l1", now: NOW, notify });
  ok("an inactive target is refused", r.refused && /deactivated/.test(r.error));
  seed({ doNotContactAt: hoursAgo(1), doNotContactReason: "Asked on the phone" });
  r = await reassignSignup({ client, admin, rep: bob, leadId: "l1", now: NOW, notify });
  ok("the Prospect's own do-not-contact is refused too", r.refused && /Do not contact — Asked on the phone/.test(r.error));
  seed({ assignedRepId: null, claimExpiresAt: null });
  r = await reassignSignup({ client, admin, rep: bob, leadId: "l1", now: NOW, notify });
  ok("a row nobody holds is not 're'-assigned — the caller uses the assign", r.unheld === true && writes.length === 0);
  seed();
  rows.signupLead[0].promotedLeadId = "sl1";
  rows.signupLead[0].referredRepId = "rep_ann";
  r = await reassignSignup({ client, admin, rep: bob, leadId: "l1", now: NOW, notify });
  ok("a rep's own lead (their link) is never moved from here", r.refused && /Ann's link/.test(r.error) && rows.prospect[0].assignedRepId === "rep_ann");

  // Changed hands between the page and the press: the compare-and-set wins.
  seed();
  const racing = new Proxy(client, {
    get: (t, p) => {
      if (p !== "$transaction") return t[p];
      return async (fn) => {
        rows.prospect[0].assignedRepId = "rep_other";
        return t.$transaction(fn);
      };
    },
  });
  r = await reassignSignup({ client: racing, admin, rep: bob, leadId: "l1", now: NOW, notify });
  ok("a row that changed hands mid-press is not overwritten", r.refused && /Changed hands/.test(r.error) && rows.prospect[0].assignedRepId === "rep_other" && rows.salesQueueClaim.length === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The route, the wording, the catalogues");
// ═══════════════════════════════════════════════════════════════════════════
{
  const route = read("app/api/platform/signups/assign/route.js");
  ok("one superadmin gate, by role, before any action", /if \(admin\.role !== "superadmin"\) \{\n\s+return NextResponse\.json\(\{ error: "Only superadmins can assign signups to a rep" \}, \{ status: 403 \}\);/.test(route) && route.indexOf('admin.role !== "superadmin"') < route.indexOf('action === "take_back"'));
  ok("take_back and reassign go through the library, never a write of their own", /takeBackSignup\(\{ client: db, admin: actor/.test(route) && /reassignSignup\(\{ client: db, admin: actor, rep/.test(route) && !/prospect\.update/.test(route) && !/salesQueueClaim\./.test(route));
  ok("…and never touch a Company", !/db\.company\./.test(route));
  ok("an unheld reassign falls back to the ordinary assign, with its guards", /if \(r\.unheld\) \{\n\s+r = await assignSignupForCallback\(/.test(route));
  const lib = read("lib/signup/assignment.js");
  ok("nothing in the library writes a Company or a SignupLead", !/\.company\.(update|create|upsert|delete)/.test(lib) && !/\.signupLead\.(update|create|upsert|delete)/.test(lib));
  ok("the take-back is unassignFromRep — releaseUntouched, never a hand-written release", /unassignFromRep\(\{ db: client/.test(lib) && !/assignedRepId: null/.test(lib));
  ok("signup_reassigned has wording on the audit log", Boolean(AUDIT_ACTIONS.signup_reassigned?.label));
  for (const lang of ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"]) {
    const m = APP_MESSAGES[lang] || {};
    ok(`the take-back push is in ${lang}`, typeof m["app.salesToday.takenBackPushTitle"] === "string" && /\{admin\}/.test(m["app.salesToday.takenBackLine"] || "") && /\{business\}/.test(m["app.salesToday.takenBackLine"] || ""));
  }
  const analytics = read("app/api/platform/analytics/product/route.js");
  ok("the funnel's hot count is the folder's own (do-not-contact dropped)", /countUnplacedSignups\(\{ client: db, now, hotOnly: true \}\)/.test(analytics) && !/unplacedSignupWhere/.test(analytics));
  const floor = read("lib/signup/salesFloor.js");
  ok("the review folder's GET reads listUnplacedSignups, which drops do-not-contact rows", /return rows\.filter\(\(p\) => !dnc\.get\(p\.id\)\?\.dnc\);/.test(floor) && /const rows = await unplacedSignupRows\(\{/.test(floor));
  ok("the assign re-reads the list in its own request", /const dnc = await signupDoNotContact\(\{\n\s+client,/.test(floor.slice(floor.indexOf("export async function assignSignupToRep"))));
}

console.log(`\n${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
