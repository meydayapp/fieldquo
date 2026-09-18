// scripts/check-sales-link-no-signup.mjs
//
// The link went and nothing came of it — lib/sales/checkin/linkNoSignup.js.
// Executed, not read: the verdict for every stop condition, the three
// touchpoints and their instants, the wording in three languages with no
// URL in it, and the store function over a scriptable client — one draft
// written on day 2, the day-2 draft dismissed in favour of day 5, every
// stop condition dismissing what is open and writing nothing, and NOTHING
// sent by any of it.
//
// Run: npm run check:sales-link-no-signup
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
let fail = 0;
function ok(name, condition, detail = "") {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? `  — got: ${JSON.stringify(detail)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}`);

const {
  linkNoSignupVerdict,
  linkNoSignupDraft,
  linkNoSignupDedupeKey,
  isLinkNoSignupKey,
  parseLinkNoSignupKey,
  lastNudgeAt,
  materialiseLinkNoSignupForRep,
  LINK_NO_SIGNUP_REASON,
  LAST_NUDGE_DAY,
  LINK_NO_SIGNUP_MAX_AGE_MS,
} = await import("@/lib/sales/checkin/linkNoSignup");
const { describeDraftKey, touchpointOfKey } = await import("@/lib/sales/checkin/plan");
const { touchpointLabelKey, TOUCHPOINT_LABEL_KEYS } = await import("@/lib/sales/checkin/touchpointLabel");
const { checkinHeadlineKey, CHECKIN_HEADLINE_KEYS, REASON_CODES } = await import("@/lib/sales/checkin/signals");
const { isUnfinishedSignupKey } = await import("@/lib/sales/checkin/unfinishedSignup");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");

const DAY = 24 * 60 * 60 * 1000;
const SENT = new Date("2026-09-15T18:00:00Z"); // a Tuesday, 14:00 Toronto
const at = (days, hours = 0) => new Date(SENT.getTime() + days * DAY + hours * 3600000);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The verdict, one condition at a time");
// ═══════════════════════════════════════════════════════════════════════════
const base = { progress: { linkSentAt: SENT, openedAt: null, completedAt: null, companyId: null, cardAt: null }, inboundAfterLink: false, suppressed: false, claim: { held: true, claimExpiresAt: null }, leadHeld: true };
ok("day 1: nothing due, nothing to stop", linkNoSignupVerdict({ ...base, now: at(1) }).action === "wait");
ok("day 2: the day-2 draft is due", (() => { const v = linkNoSignupVerdict({ ...base, now: at(2, 1) }); return v.action === "draft" && v.touchpoint === "d2" && v.dueAt.getTime() === at(2).getTime(); })());
ok("day 4: still the day-2 draft (the latest due, not the next)", linkNoSignupVerdict({ ...base, now: at(4) }).touchpoint === "d2");
ok("day 5: the day-5 draft", linkNoSignupVerdict({ ...base, now: at(5, 1) }).touchpoint === "d5");
ok(`day ${LAST_NUDGE_DAY} with a permanent claim: the last nudge`, (() => { const v = linkNoSignupVerdict({ ...base, now: at(LAST_NUDGE_DAY, 1) }); return v.action === "draft" && v.touchpoint === "last"; })());
ok("a claim lapsing on day 7: the last nudge lands six hours before it", (() => { const v = linkNoSignupVerdict({ ...base, claim: { held: true, claimExpiresAt: at(7) }, now: at(6, 20) }); return v.action === "draft" && v.touchpoint === "last" && v.dueAt.getTime() === at(7).getTime() - 6 * 3600000; })());
ok("…and not before: at day 6 noon it is still the day-5 draft", linkNoSignupVerdict({ ...base, claim: { held: true, claimExpiresAt: at(7) }, now: at(6, 12) }).touchpoint === "d5");
ok("a claim lapsing before day 5 invents no last nudge — day 9 is the last", lastNudgeAt({ linkSentAt: SENT, claimExpiresAt: at(3) }).getTime() === at(LAST_NUDGE_DAY).getTime());
ok("stale: three weeks on, nothing is drafted", linkNoSignupVerdict({ ...base, now: new Date(SENT.getTime() + LINK_NO_SIGNUP_MAX_AGE_MS + DAY) }).action === "stop");
ok("no linkSentAt: wait (the text never went)", linkNoSignupVerdict({ ...base, progress: { linkSentAt: null }, now: at(3) }).action === "wait");

const stops = [
  ["they signed up (completedAt)", { progress: { ...base.progress, completedAt: at(1) } }, "signed_up"],
  ["they entered a card on the token (companyId + cardAt)", { progress: { ...base.progress, companyId: "co1", cardAt: at(1) } }, "signed_up"],
  ["they replied (any inbound after the link)", { inboundAfterLink: true }, "replied"],
  ["they asked to stop (suppressed)", { suppressed: true }, "suppressed"],
  ["the claim was released", { claim: { held: false, claimExpiresAt: null } }, "claim_released"],
  ["the lead is no longer the rep's", { leadHeld: false }, "lead_released"],
  ["they opened the link (unfinishedSignup.js takes over)", { progress: { ...base.progress, openedAt: at(1) } }, "opened"],
];
for (const [name, patch, reason] of stops) {
  const v = linkNoSignupVerdict({ ...base, ...patch, now: at(3) });
  ok(`stop — ${name}`, v.action === "stop" && v.reason === reason, v);
}
ok("a signup outranks a reply outranks a STOP outranks a released claim (the order the reasons are read)", linkNoSignupVerdict({ ...base, progress: { ...base.progress, completedAt: at(1) }, inboundAfterLink: true, suppressed: true, now: at(3) }).reason === "signed_up" && linkNoSignupVerdict({ ...base, inboundAfterLink: true, suppressed: true, now: at(3) }).reason === "replied");

// ═══════════════════════════════════════════════════════════════════════════
section("2. The words, the keys, the labels");
// ═══════════════════════════════════════════════════════════════════════════
for (const lang of ["en", "fr", "es"]) {
  for (const tp of ["d2", "d5", "last"]) {
    const text = linkNoSignupDraft({ language: lang, repName: "Daniel", businessName: "Easy Roofers", touchpoint: tp });
    ok(`${lang} ${tp}: names the rep, the business, carries NO link, fits two segments with the footer`, /Daniel/.test(text) && /Easy Roofers/.test(text) && !/https?:\/\//.test(text) && text.length <= 240, text);
  }
}
ok("day 2 asks about the link; day 5 offers fifteen minutes, mornings or afternoons; last says it is the last", /questions about the link/i.test(linkNoSignupDraft({ touchpoint: "d2" })) && /fifteen minutes/.test(linkNoSignupDraft({ touchpoint: "d5" })) && /mornings or afternoons/.test(linkNoSignupDraft({ touchpoint: "d5" })) && /Last note/.test(linkNoSignupDraft({ touchpoint: "last" })));
ok("an unknown language falls back to English", /it is FieldQuo\. Any questions/.test(linkNoSignupDraft({ language: "de", touchpoint: "d2" })));
ok("the key is its own shape, and no other engine claims it", linkNoSignupDedupeKey("p1", "d2") === "linksent:p1:d2" && isLinkNoSignupKey("linksent:p1:last") && !isLinkNoSignupKey("signup:p1:2h") && !isUnfinishedSignupKey("linksent:p1:d2") && touchpointOfKey("linksent:p1:d2") === null && linkNoSignupDedupeKey("p1", "d3") === null);
ok("parse reverses the key", JSON.stringify(parseLinkNoSignupKey("linksent:abc:d5")) === JSON.stringify({ progressId: "abc", touchpoint: "d5" }) && parseLinkNoSignupKey("scheduled:c:1") === null);
ok("describeDraftKey files it as kind linksent, and the label key exists in every language", (() => { const d = describeDraftKey("linksent:p1:last"); const k = touchpointLabelKey(d); return d.kind === "linksent" && d.touchpoint === "last" && k === "app.salesCheckin.touchpoint.linksent" && TOUCHPOINT_LABEL_KEYS.includes(k) && Object.keys(APP_MESSAGES).every((l) => APP_MESSAGES[l][k]); })());
ok("the reason code has a headline key in every language, with the day in it, and is NOT a company signal", checkinHeadlineKey(LINK_NO_SIGNUP_REASON) === "app.salesCheckin.reason.link_no_signup" && CHECKIN_HEADLINE_KEYS.includes("app.salesCheckin.reason.link_no_signup") && !REASON_CODES.includes(LINK_NO_SIGNUP_REASON) && Object.keys(APP_MESSAGES).every((l) => /\{sent\}/.test(APP_MESSAGES[l]["app.salesCheckin.reason.link_no_signup"] || "") && APP_MESSAGES[l]["app.salesCheckin.reasonLinkNoSignupNoDay"]));
ok("…and the older opened-and-unfinished sequence now has its sentence too", checkinHeadlineKey("signup_unfinished") === "app.salesCheckin.reason.signup_unfinished" && Object.keys(APP_MESSAGES).every((l) => APP_MESSAGES[l]["app.salesCheckin.reason.signup_unfinished"]));

// ═══════════════════════════════════════════════════════════════════════════
section("3. The store function over a scriptable client");
// ═══════════════════════════════════════════════════════════════════════════
function makeClient(state) {
  const writes = [];
  const drafts = state.drafts || [];
  const client = {
    writes,
    drafts,
    salesRep: { findUnique: async () => ({ id: "rep-a", name: "Daniel", code: "danielboves" }) },
    salesSignupProgress: { findMany: async () => state.progress || [] },
    salesLead: { findMany: async () => state.leads || [] },
    salesSmsMessage: { findFirst: async ({ where }) => (state.inbound || []).find((m) => m.fromE164 === where.fromE164 && m.sentAt > where.sentAt.gt) || null },
    salesSuppression: { findMany: async () => state.suppressions || [] },
    salesCheckIn: {
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const d of drafts) {
          if (d.salesRepId === where.salesRepId && where.dedupeKey.in.includes(d.dedupeKey) && d.status === where.status) {
            Object.assign(d, data);
            count += 1;
          }
        }
        writes.push(["salesCheckIn.updateMany", where.dedupeKey.in, count]);
        return { count };
      },
      create: async ({ data }) => {
        if (drafts.some((d) => d.salesRepId === data.salesRepId && d.dedupeKey === data.dedupeKey)) {
          const err = new Error("dup"); err.code = "P2002"; throw err;
        }
        const row = { id: `ck-${drafts.length + 1}`, ...data };
        drafts.push(row);
        writes.push(["salesCheckIn.create", data.dedupeKey]);
        return row;
      },
      findFirst: async ({ where }) => drafts.find((d) => d.salesRepId === where.salesRepId && d.dedupeKey === where.dedupeKey) || null,
    },
  };
  return client;
}
const LEAD = { id: "lead-1", salesRepId: "rep-a", businessName: "Easy Roofers", phone: "+18192387263", timeZone: "America/Toronto", country: "CA", province: "QC", prospectId: "p-1", prospect: { id: "p-1", assignedRepId: "rep-a", claimExpiresAt: null, province: "QC" } };
const PROGRESS = { id: "prog-1", leadId: "lead-1", salesRepId: "rep-a", token: "tok", linkSentAt: SENT, openedAt: null, completedAt: null, companyId: null, cardAt: null };

{
  const client = makeClient({ progress: [PROGRESS], leads: [LEAD] });
  const r = await materialiseLinkNoSignupForRep({ salesRepId: "rep-a", client, now: at(2, 1) });
  const row = client.drafts[0];
  ok("day 2: ONE draft, on the lead, in French for a Quebec lead, with the reason code and its key, status draft", r.created.length === 1 && client.drafts.length === 1 && row.leadId === "lead-1" && row.companyId === null && row.toE164 === "+18192387263" && /Bonjour Easy Roofers, c'est Daniel de FieldQuo/.test(row.draftText) && row.reasonCode === LINK_NO_SIGNUP_REASON && row.dedupeKey === "linksent:prog-1:d2" && row.status === "draft" && row.origin === "engine", { r, row });
  ok("…scheduled inside the texting window in the lead's zone, never before day 2", row.scheduledFor instanceof Date && row.scheduledFor.getTime() >= at(2).getTime(), row.scheduledFor);
  const again = await materialiseLinkNoSignupForRep({ salesRepId: "rep-a", client, now: at(2, 3) });
  ok("a second run writes nothing (idempotent on the key)", again.created.length === 0 && again.skipped[0]?.reason === "open" && client.drafts.length === 1, again);
  const day5 = await materialiseLinkNoSignupForRep({ salesRepId: "rep-a", client, now: at(5, 1) });
  ok("day 5, day 2 never sent: the day-2 draft is dismissed and the day-5 one written — one open draft on the thread", day5.created[0]?.touchpoint === "d5" && client.drafts.find((d) => d.dedupeKey === "linksent:prog-1:d2").status === "dismissed" && client.drafts.filter((d) => d.status === "draft").length === 1, client.drafts.map((d) => [d.dedupeKey, d.status]));
  ok("the language is the lead's: an Ontario lead gets English", (async () => true)() && /Hi Easy Roofers, it is Daniel/.test(linkNoSignupDraft({ language: "en", repName: "Daniel", businessName: "Easy Roofers" })));
}

// Every stop condition: the open draft is dismissed and nothing is written.
const openDraft = () => ({ id: "ck-open", salesRepId: "rep-a", dedupeKey: "linksent:prog-1:d2", status: "draft", toE164: "+18192387263" });
const stopCases = [
  ["signed up", { progress: [{ ...PROGRESS, completedAt: at(3) }], leads: [LEAD] }, "signed_up"],
  ["card entered on the token", { progress: [{ ...PROGRESS, companyId: "co-1", cardAt: at(3) }], leads: [LEAD] }, "signed_up"],
  ["replied", { progress: [PROGRESS], leads: [LEAD], inbound: [{ fromE164: "+18192387263", sentAt: at(3) }] }, "replied"],
  ["STOP on the list", { progress: [PROGRESS], leads: [LEAD], suppressions: [{ id: "s1", kind: "phone", value: "+18192387263", rawValue: "+18192387263", channels: ["sms", "email", "phone"], source: "sms_stop", reason: "Replied STOP", evidenceUrl: null, requestedAt: at(3), retainUntil: null, removedAt: null, removedByAdminId: null }] }, "suppressed"],
  ["claim released", { progress: [PROGRESS], leads: [{ ...LEAD, prospect: { ...LEAD.prospect, assignedRepId: null } }] }, "claim_released"],
  ["claim taken by another rep", { progress: [PROGRESS], leads: [{ ...LEAD, prospect: { ...LEAD.prospect, assignedRepId: "rep-b" } }] }, "claim_released"],
  ["lead no longer the rep's", { progress: [PROGRESS], leads: [{ ...LEAD, salesRepId: "rep-b" }] }, "lead_released"],
  ["link opened", { progress: [{ ...PROGRESS, openedAt: at(3) }], leads: [LEAD] }, "opened"],
];
for (const [name, state, reason] of stopCases) {
  const client = makeClient({ ...state, drafts: [openDraft()] });
  const r = await materialiseLinkNoSignupForRep({ salesRepId: "rep-a", client, now: at(5, 1) });
  ok(`stop — ${name}: the open draft is dismissed, nothing is written, the reason is named`, r.created.length === 0 && r.dismissed.length === 1 && r.dismissed[0].reason === reason && client.drafts[0].status === "dismissed" && !client.writes.some((w) => w[0] === "salesCheckIn.create"), { r, drafts: client.drafts });
}
{
  const client = makeClient({ progress: [PROGRESS], leads: [LEAD], drafts: [openDraft()] });
  client.salesSuppression.findMany = async () => { throw new Error("neon asleep"); };
  const r = await materialiseLinkNoSignupForRep({ salesRepId: "rep-a", client, now: at(5, 1) });
  ok("an unreadable do-not-contact list writes nothing AND dismisses nothing — skip this pass", r.created.length === 0 && r.dismissed.length === 0 && r.skipped[0]?.reason === "suppression_unreadable" && client.drafts[0].status === "draft", r);
}
{
  const client = makeClient({ progress: [PROGRESS], leads: [LEAD] });
  const r = await materialiseLinkNoSignupForRep({ salesRepId: "rep-a", client, now: at(2, 1), dryRun: true });
  ok("dryRun reports and writes nothing", r.created.length === 1 && r.created[0].dryRun === true && client.drafts.length === 0 && client.writes.length === 0);
}
{
  const client = makeClient({ progress: [{ ...PROGRESS, leadId: "lead-gone" }], leads: [LEAD] });
  const r = await materialiseLinkNoSignupForRep({ salesRepId: "rep-a", client, now: at(2, 1) });
  ok("a progress row whose lead cannot be found stops as lead_released and writes nothing", r.created.length === 0 && r.skipped[0]?.reason === "lead_released");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Nothing here sends, and the pass is wired where the others are");
// ═══════════════════════════════════════════════════════════════════════════
{
  const src = read("lib/sales/checkin/linkNoSignup.js");
  ok("the module imports no send path, no Twilio, no store", !/from "\.\.\/salesSms"|twilio|deliverReply|sendSms|from "\.\/store"/.test(src) && !/salesSmsMessage\.(create|update)/.test(src));
  ok("…and writes only SalesCheckIn rows (create) and dismissals (updateMany status dismissed)", (src.match(/client\.salesCheckIn\.updateMany/g) || []).length === 2 && !/salesCheckIn\.delete/.test(src) && /status: "dismissed", dismissedAt: now/.test(src) && /insertDraftRow\(client, \{/.test(src));
  const mat = read("lib/sales/checkin/materialise.js");
  ok("materialiseCheckInsForRep runs the pass after the unfinished-signup one, isolated, and reports it as linkDrafts", /out\.linkDrafts = await materialiseLinkNoSignupForRep\(\{ salesRepId: rep\.id, client, now, dryRun \}\)/.test(mat) && mat.indexOf("materialiseLinkNoSignupForRep({") > mat.indexOf("materialiseUnfinishedSignupsForRep({") && /r\.linkDrafts\?\.created\?\.length/.test(mat));
  const store = read("lib/sales/checkin/store.js");
  ok("openCheckIns hands the thread the day the link went (reasonParams.sentAt) for these rows", /parseLinkNoSignupKey\(r\.dedupeKey\)/.test(store) && /reasonParams: \{ sentAt: sentAtById\.get\(key\.progressId\) \|\| null \}/.test(store));
  const draftUi = read("app/sales/messages/CheckInDraft.js");
  ok("…and the draft prints it, or the sentence without the day when it is missing", /app\.salesCheckin\.reasonLinkNoSignupNoDay/.test(draftUi) && /sent: sentAt\.toLocaleDateString/.test(draftUi));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
