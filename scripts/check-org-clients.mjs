// scripts/check-org-clients.mjs
//
//   npm run check:org-clients
//
// Organisation clients (owner, 2026-10-13): several contacts per client, the
// Organization card, the recipient picker on Send, and "No automatic emails or
// texts — send by hand only". Executed, not read: the lib functions and the
// contacts routes run against the scripted db (scripts/fixtures/dbStub.mjs),
// the senders run with the switch on and off, and hostile input is thrown at
// every door.
//
// What it proves, in order:
//
//   1. THE GATE (lib/clients/autoMessages.js) — refuses for a client with the
//      switch on and records ONE skip row however often a cron asks; lets
//      everyone else through; never reads across tenants; fails CLOSED when
//      the client cannot be read; refuses an unknown sender, "__proto__"
//      included.
//   2. EVERY SENDER CALLS IT — each AUTO_MESSAGE_SENDERS entry's file calls
//      autoMessageGate with its own key, and every file in app/ and lib/ that
//      reaches a send primitive is either one of those or classified below
//      with the reason it is not automatic. A sender added tomorrow fails
//      this check until somebody decides which it is.
//   3. THE SENDERS, EXECUTED — an automatic receipt is held back and a
//      person's Send receipt still sends; a campaign skips the client and
//      still completes; the bulk portal-link list skips them; the prep-guide
//      cron is refused and "Send now" is not; the phone agent's automatic
//      reminder call is not queued.
//   4. CONTACTS (lib/clients/contacts.js + the routes) — add / edit / make
//      primary / reorder / remove, under the tenant and the permission grid,
//      against hostile ids and bodies; "make primary" loses nobody; the
//      primary can't be removed; redaction strips the list below full_view.
//   5. RECIPIENTS (lib/clients/recipients.js) — the default send is byte-for-
//      byte today's (md5 of the request bodies and of the `to` handed to
//      sendEmail, old expression against new), and the picker accepts only
//      this client's own contacts.
//   6. AN INDIVIDUAL IS UNCHANGED — organizationShape gives a homeowner the
//      keys it always had (plus the switch's two columns), and the picker
//      never offers itself for one.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { rows, writes, resetDbStub, db } from "@/lib/db";
import { session } from "@/lib/apiMember";
import {
  autoMessageGate,
  autoMessagesUpdate,
  autoMessagesOff,
  isAutoMessageSender,
  recordAutoMessageSkip,
  AUTO_MESSAGE_SENDERS,
  AUTO_MESSAGES_REASON_MAX,
} from "@/lib/clients/autoMessages";
import {
  cleanContactInput,
  contactEntries,
  createContact,
  updateContact,
  makePrimary,
  removeContact,
  reorderContacts,
  syncPrimaryFromClient,
  organizationShape,
  MAX_CONTACTS_PER_CLIENT,
} from "@/lib/clients/contacts";
import {
  resolveSendRecipients,
  recipientsForBody,
  recipientText,
  isDefaultSelection,
  offersRecipientPicker,
  DEFAULT_SELECTION,
} from "@/lib/clients/recipients";
import { redactClient } from "@/lib/permissions/enforce";
import { receiptStatus, nextReceiptRetryAt } from "@/lib/payments/receiptState";
import { classifyClient } from "@/lib/portal/bulkLinks";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const md5 = (v) => createHash("md5").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex");

let pass = 0;
const failures = [];
const ok = (label, cond, got) => {
  if (cond) {
    pass++;
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (s) => console.log(`\n${s}`);

const CO = "co_1";
const OTHER = "co_2";
const T0 = new Date("2026-10-13T12:00:00Z");

function seedClients() {
  rows.client = [
    { id: "c_off", companyId: CO, name: "PSPC", type: "company", email: "lisa.hampel@pspc.example", phone: "819-555-0100", contactName: "Lisa Hampel", autoMessagesOffAt: new Date("2026-10-10T00:00:00Z"), autoMessagesOffReason: "Government tender: questions only through SAP Ariba", requiresPo: true },
    { id: "c_on", companyId: CO, name: "Marie Tremblay", type: "individual", email: "marie@example.com", phone: "819-555-0101", contactName: null, autoMessagesOffAt: null },
    { id: "c_foreign_off", companyId: OTHER, name: "Elsewhere Inc", type: "company", email: "x@elsewhere.example", autoMessagesOffAt: new Date("2026-10-01T00:00:00Z") },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. The gate");
{
  resetDbStub();
  seedClients();

  const off = await autoMessageGate(db, { companyId: CO, clientId: "c_off", sender: "follow_up", ref: { type: "invoice", id: "inv_1" }, refLabel: "INV-0009", now: T0 });
  ok("switch on → refused", off.allowed === false && off.reason === "auto_messages_off" && off.final === true, off);
  ok("the refusal records one skip row", rows.autoMessageSkip.length === 1, rows.autoMessageSkip.length);
  const skip = rows.autoMessageSkip[0] || {};
  ok("…for this client, under this company", skip.clientId === "c_off" && skip.companyId === CO, skip);
  ok("…naming the sender, its channel, the record and its label", skip.sender === "follow_up" && skip.channel === "email" && skip.refKey === "invoice:inv_1" && skip.refLabel === "INV-0009", skip);
  ok("…with the reason as it stood", skip.reason === "Government tender: questions only through SAP Ariba", skip.reason);

  const later = new Date(T0.getTime() + 3600_000);
  await autoMessageGate(db, { companyId: CO, clientId: "c_off", sender: "follow_up", ref: { type: "invoice", id: "inv_1" }, now: later });
  ok("the hourly cron asking again writes no second row", rows.autoMessageSkip.length === 1, rows.autoMessageSkip.length);
  ok("…it moves lastSkippedAt instead", new Date(rows.autoMessageSkip[0].lastSkippedAt).getTime() === later.getTime(), rows.autoMessageSkip[0].lastSkippedAt);
  ok("…and keeps the first label when the second call has none", rows.autoMessageSkip[0].refLabel === "INV-0009", rows.autoMessageSkip[0].refLabel);

  await autoMessageGate(db, { companyId: CO, clientId: "c_off", sender: "appointment_reminder", ref: { type: "visit", id: "v_1" }, now: T0 });
  ok("a different sender is a different row", rows.autoMessageSkip.length === 2, rows.autoMessageSkip.length);
  ok("…with its own channel", rows.autoMessageSkip[1]?.channel === "sms", rows.autoMessageSkip[1]);

  const on = await autoMessageGate(db, { companyId: CO, clientId: "c_on", sender: "follow_up", now: T0 });
  ok("switch off → allowed", on.allowed === true, on);
  ok("…and nothing recorded", rows.autoMessageSkip.length === 2, rows.autoMessageSkip.length);

  const foreign = await autoMessageGate(db, { companyId: CO, clientId: "c_foreign_off", sender: "follow_up", now: T0 });
  ok("another company's client id answers like no client (allowed, nothing about it read back)", foreign.allowed === true && !("clientId" in foreign), foreign);
  ok("…and no skip is written against another tenant", rows.autoMessageSkip.every((s) => s.companyId === CO), rows.autoMessageSkip);

  const none = await autoMessageGate(db, { companyId: CO, clientId: null, sender: "follow_up", now: T0 });
  ok("no client (a lead) → allowed", none.allowed === true, none);
  const noCo = await autoMessageGate(db, { companyId: null, clientId: "c_off", sender: "follow_up", now: T0 });
  ok("no company → allowed and nothing read (there is no tenant to honour)", noCo.allowed === true, noCo);

  const byEmail = await autoMessageGate(db, { companyId: CO, email: "  LISA.HAMPEL@pspc.example ", sender: "marketing_campaign", now: T0 });
  ok("by address, any case, any spaces → refused", byEmail.allowed === false && byEmail.clientId === "c_off", byEmail);
  const byOtherEmail = await autoMessageGate(db, { companyId: CO, email: "x@elsewhere.example", sender: "marketing_campaign", now: T0 });
  ok("by address that only another company's client has → allowed", byOtherEmail.allowed === true, byOtherEmail);
  const byEmailOn = await autoMessageGate(db, { companyId: CO, email: "marie@example.com", sender: "marketing_campaign", now: T0 });
  ok("by address of a client with the switch off → allowed", byEmailOn.allowed === true, byEmailOn);

  for (const bad of ["nope", "__proto__", "toString", "constructor", "", null, undefined, 42, { toString: () => "follow_up" }]) {
    let threw = false;
    try {
      await autoMessageGate(db, { companyId: CO, clientId: "c_off", sender: bad });
    } catch {
      threw = true;
    }
    ok(`unknown sender ${JSON.stringify(String(bad))} throws rather than passing silently`, threw);
  }
  ok("isAutoMessageSender is own-property only", !isAutoMessageSender("__proto__") && !isAutoMessageSender("hasOwnProperty") && isAutoMessageSender("voice_call"));

  // A database that cannot be read: refused, final:false (try again later), never allowed.
  const brokenDb = { client: { findFirst: async () => { throw new Error("P1001 can't reach database"); } }, autoMessageSkip: db.autoMessageSkip };
  const blip = await autoMessageGate(brokenDb, { companyId: CO, clientId: "c_on", sender: "review_request", now: T0 });
  ok("an unreadable client fails CLOSED", blip.allowed === false && blip.reason === "unreadable" && blip.final === false, blip);

  // Hostile ref / label shapes are stored as text or not at all, never thrown.
  const before = rows.autoMessageSkip.length;
  await autoMessageGate(db, { companyId: CO, clientId: "c_off", sender: "on_my_way", ref: { type: { $ne: 1 }, id: ["x"] }, refLabel: "x".repeat(5000), now: T0 });
  const hostile = rows.autoMessageSkip[rows.autoMessageSkip.length - 1];
  ok("a hostile ref shape is a string key, not an object", rows.autoMessageSkip.length === before + 1 && typeof hostile.refKey === "string", hostile?.refKey);
  ok("a 5000-char label is capped", String(hostile.refLabel).length <= 200, String(hostile.refLabel).length);
  ok("recordAutoMessageSkip with no db model returns false, never throws", (await recordAutoMessageSkip({}, { companyId: CO, clientId: "c_off", sender: "follow_up" })) === false);
}

section("1b. The switch's write (autoMessagesUpdate)");
{
  const now = new Date("2026-10-13T00:00:00Z");
  const was = new Date("2026-01-01T00:00:00Z");
  ok("on, from off → stamps now", autoMessagesUpdate({ autoMessagesOffAt: null }, { autoMessagesOff: true }, now).autoMessagesOffAt === now);
  ok("on, already on → keeps the original date (no write)", !("autoMessagesOffAt" in autoMessagesUpdate({ autoMessagesOffAt: was }, { autoMessagesOff: true }, now)));
  const offData = autoMessagesUpdate({ autoMessagesOffAt: was, autoMessagesOffReason: "tender" }, { autoMessagesOff: false }, now);
  ok("off → clears the date and the reason", offData.autoMessagesOffAt === null && offData.autoMessagesOffReason === null, offData);
  for (const junk of ["true", 1, "on", null, {}, []]) {
    ok(`a non-boolean ${JSON.stringify(junk)} leaves the switch alone`, Object.keys(autoMessagesUpdate({ autoMessagesOffAt: null }, { autoMessagesOff: junk }, now)).length === 0);
  }
  const long = autoMessagesUpdate({}, { autoMessagesOff: true, autoMessagesOffReason: `  ${"r".repeat(900)}  ` }, now);
  ok("the reason is trimmed and capped", long.autoMessagesOffReason.length === AUTO_MESSAGES_REASON_MAX && !long.autoMessagesOffReason.startsWith(" "), long.autoMessagesOffReason?.length);
  ok("an empty reason clears it", autoMessagesUpdate({ autoMessagesOffAt: was }, { autoMessagesOffReason: "   " }, now).autoMessagesOffReason === null);
  ok("a reason alone while OFF writes nothing (no reason without the switch)", Object.keys(autoMessagesUpdate({ autoMessagesOffAt: null }, { autoMessagesOffReason: "x" }, now)).length === 0);
  ok("autoMessagesOff reads the date, not a truthy reason", autoMessagesOff({ autoMessagesOffAt: was }) && !autoMessagesOff({ autoMessagesOffReason: "x" }) && !autoMessagesOff(null));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Every sender calls the gate");

// Every automatic sender: its file calls autoMessageGate with its own key.
for (const [key, { file }] of Object.entries(AUTO_MESSAGE_SENDERS)) {
  let src = "";
  try {
    src = read(file);
  } catch {
    ok(`${key}: ${file} exists`, false);
    continue;
  }
  const code = src.split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  ok(`${key}: ${file} calls autoMessageGate`, /autoMessageGate\s*\(/.test(code));
  ok(`${key}: …with sender "${key}"`, new RegExp(`sender:\\s*"${key}"`).test(code));
  ok(`${key}: …and imports it from the one module`, /from "@\/lib\/clients\/autoMessages"/.test(src));
}
// Each sender key has a label on the client page, in every language.
for (const key of Object.keys(AUTO_MESSAGE_SENDERS)) {
  for (const [lang, msgs] of Object.entries(APP_MESSAGES)) {
    ok(`app.autoMessages.sender.${key} in ${lang}`, typeof msgs[`app.autoMessages.sender.${key}`] === "string");
  }
}

// Every file that reaches a send primitive is gated or classified.
//
//   by_hand      a person pressed Send for this one client
//   own_action   a transactional confirmation of the client's OWN action
//   not_client   staff, crew, the company itself, another company, a prospect
//                of FieldQuo's — not one of this company's clients
//   mention      names a primitive in a string or a label, sends nothing
const CLASSIFIED = {
  "app/api/clients/[id]/portal-link/route.js": "by_hand — the client page's Email portal link",
  "app/api/clients/portal-links/route.js": "gated in lib/portal/bulkLinks.js (portal_link_bulk), which this route hands sendEmail to",
  "app/api/invoices/[id]/request-payment/route.js": "by_hand — Request payment",
  "app/api/invoices/[id]/send/route.js": "by_hand — Send invoice",
  "app/api/quotes/[id]/send/route.js": "by_hand — Send quote / follow-up button",
  "app/api/quotes/[id]/call/route.js": "by_hand — the quote's Call button",
  "app/api/service-plans/[id]/authorise/route.js": "by_hand — Send authorisation link",
  "app/api/messaging/threads/[id]/reply/route.js": "by_hand — a reply typed in the inbox",
  "lib/mailbox/reply.js": "by_hand — an email reply typed in the inbox",
  "lib/messaging/ownSend.js": "transport for the inbox reply and the AI employee (gated at lib/aiEmployee/inbound.js)",
  "lib/jobs/changeOrderSend.js": "by_hand — Send change order for approval",
  "lib/waivers/service.js": "by_hand (Send waiver) and own_action (the signed copy after the client signs)",
  "lib/clientTickets/service.js": "by_hand (staff reply) and not_client (office notice)",
  "lib/schedule/clientNotice.js": "by_hand — the move/cancel dialog's 'Tell the client' tick (starts unticked for a client with the switch on) — and own_action for the client's own reschedule",
  "lib/schedule/changeText.js": "same as clientNotice.js — the tick, or the client's own reschedule",
  "app/api/visit/[token]/route.js": "own_action — the client cancelled their own visit",
  "app/api/visit/[token]/reschedule/route.js": "own_action — the client moved their own visit",
  "app/api/public/quotes/[token]/route.js": "own_action — the signed copy after the client approved (and the staff notice)",
  "lib/booking/finalizeBooking.js": "own_action — confirmation of a booking the client made (its reminder text and call are gated)",
  "app/api/self-quote/route.js": "own_action — confirmation of the client's own request",
  "app/api/self-quote/kitchen/route.js": "own_action — confirmation of the client's own request",
  "lib/estimate/report/publish.js": "own_action — the instant-estimate report the homeowner asked for",
  "lib/portal/loginLink.js": "own_action — the login link the client asked for",
  "app/api/sms/inbound/route.js": "own_action — the STOP confirmation",
  "lib/aiEmployee/smsChannel.js": "own_action — the one-line 'someone will reply shortly' acknowledgement of the client's own text",
  "app/api/kitchen-design/[token]/route.js": "not_client — tells the company's staff the client saved a design",
  "lib/notifications/invoicePaymentNotice.js": "not_client — tells the company's team",
  "lib/photoComments/notify.js": "not_client — staff mention",
  "lib/aiEmployee/urgentAlerts.js": "not_client — the company's on-call person",
  "lib/notifications/staffTexts.js": "not_client — the company's own staff, told a client opened or approved something",
  "app/api/crew/inbound/route.js": "not_client — crew line",
  "app/api/crew/line/route.js": "not_client — crew line test",
  "lib/crew/lineRent.js": "not_client — the company",
  "lib/subRequests/send.js": "not_client — a GC's price request to another company",
  "app/api/settings/document-templates/[id]/test/route.js": "not_client — a test to the sender",
  "app/api/settings/referral/invite/route.js": "not_client — FieldQuo referral to another contractor",
  "app/api/cron/large-quote-check/route.js": "not_client — the company's admins",
  "app/api/cron/grace-warning/route.js": "not_client — FieldQuo to the company",
  "app/api/cron/lifecycle-emails/route.js": "not_client — FieldQuo to the company",
  "app/api/cron/onboarding-next-steps/route.js": "not_client — FieldQuo to the company",
  "app/api/cron/renewal-reminders/route.js": "not_client — FieldQuo to the company",
  "app/api/cron/signup-recovery/route.js": "not_client — FieldQuo to a signup",
  "app/api/cron/trial-reminders/route.js": "not_client — FieldQuo to the company",
  "app/api/platform/onboarding-email/route.js": "not_client — platform settings",
  "app/api/marketing/contact/route.js": "not_client — FieldQuo's own site form",
  "app/api/webhooks/resend-inbound/route.js": "not_client — FieldQuo sales inbox",
  "lib/ai/creditLow.js": "not_client — owner and admins",
  "lib/ai/monthlyDigest.js": "not_client — owner and admins",
  "lib/auth.js": "not_client — sign-in mail",
  "lib/billing/notify.js": "not_client — FieldQuo billing to the company",
  "lib/demo/bookingEmails.js": "not_client — FieldQuo's own demo calendar",
  "lib/email/dataDeletionEmail.js": "not_client — FieldQuo to the account holder",
  "lib/email/teamInvite.js": "not_client — a team invite",
  "lib/lifecycle/marketing.js": "not_client — FieldQuo to the company",
  "lib/lifecycle/run.js": "not_client — FieldQuo to the company",
  "lib/referrals/rewardEmail.js": "not_client — FieldQuo referral programme",
  "lib/sales/demoBooking/book.js": "not_client — FieldQuo sales",
  "lib/sales/inviteEmail.js": "not_client — FieldQuo sales",
  "lib/sales/resendInboundDoor.js": "not_client — FieldQuo sales",
  "lib/sales/salesSms.js": "not_client — FieldQuo sales",
  "lib/trial/phoneVerify.js": "not_client — the trial owner's verification code",
  "lib/voice/autoTopup.js": "not_client — the company's billing",
  "lib/voice/spendGate.js": "not_client — the company's billing",
  "app/app/settings/follow-ups/FlowDiagram.js": "mention — a label key",
  "app/i18n/appMessages.js": "mention — a message key",
  "lib/marketing/featureMatrix.js": "mention — a feature name",
};
// The primitives themselves and their own modules.
const PRIMITIVE_HOMES = new Set([
  "lib/email/resend.js",
  "lib/sms/twilioClient.js",
  "lib/messaging/send.js",
  "app/admin/lib/email/templates.js",
  "lib/voice/outboundCall.js",
]);
const PRIMITIVE = /^[^/*]*\b(sendEmail|sendSms|sendOnChannel|sendBookingConfirmationEmail|sendVisitCancelledEmails|sendVisitRescheduledEmails|enqueueOutbound)\b/m;
const gatedFiles = new Set(Object.values(AUTO_MESSAGE_SENDERS).map((s) => s.file));
function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      walk(rel, out);
    } else if (name.endsWith(".js") || name.endsWith(".mjs")) out.push(rel);
  }
  return out;
}
const senderFiles = [...walk("app"), ...walk("lib")].filter((f) => !PRIMITIVE_HOMES.has(f) && PRIMITIVE.test(read(f)));
let unclassified = 0;
for (const f of senderFiles) {
  const known = gatedFiles.has(f) || Object.hasOwn(CLASSIFIED, f);
  if (!known) unclassified++;
  ok(`${f} is gated or classified`, known);
}
ok(`found the send paths (${senderFiles.length} files)`, senderFiles.length >= 60, senderFiles.length);
for (const f of Object.keys(CLASSIFIED)) {
  // A classification that no longer matches a sender is itself a failure, so
  // the list cannot quietly accumulate (tenant-scope's rule).
  ok(`classification for ${f} still names a sender`, senderFiles.includes(f) || f === "app/api/clients/portal-links/route.js");
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The senders, executed");

// 3a. Payment receipts: an automatic one is held back; a person's Send goes.
{
  const { sendPaymentReceipt } = await import("@/lib/payments/sendReceipt");
  const fixture = () => {
    resetDbStub();
    seedClients();
    rows.company = [{ id: CO, name: "Northline", defaultLanguage: "en", emailPaymentReceipts: true }];
    rows.invoice = [{ id: "inv_1", companyId: CO, clientId: "c_off", invoiceNumber: "INV-0009", total: 1000, version: 1, rootInvoiceId: null }];
    rows.payment = [{ id: "pay_1", invoiceId: "inv_1", kind: "payment", amount: 500, method: "etransfer", receiptAttempts: 0, receiptSentAt: null, receiptClaimedAt: null }];
  };
  const sent = [];
  const deps = {
    sendEmail: async (m) => { sent.push(m); return { id: "re_1" }; },
    resolveSender: async () => ({ from: "Northline <billing@northline.example>", replyTo: "office@northline.example" }),
    recordSentEmail: async () => "se_1",
    ensurePortalToken: async () => "tok",
    portalUrl: () => "https://app.example/portal/tok",
  };

  for (const trigger of ["record", "stripe", "retry"]) {
    fixture();
    sent.length = 0;
    if (trigger === "retry") rows.payment[0].receiptAttempts = 2;
    const r = await sendPaymentReceipt(db, { companyId: CO, paymentId: "pay_1", trigger, now: T0 }, deps).catch((e) => ({ threw: e.message }));
    ok(`receipt (${trigger}) for a switched-off client is not sent`, r.sent === false && r.reason === "auto_messages_off" && sent.length === 0, r);
    const p = rows.payment[0];
    ok(`…(${trigger}) the payment row says why`, p.receiptLastError === "auto_messages_off", p.receiptLastError);
    ok(`…(${trigger}) the claim is released`, p.receiptClaimedAt === null, p.receiptClaimedAt);
    ok(`…(${trigger}) no attempt is counted`, p.receiptAttempts === (trigger === "retry" ? 2 : 0), p.receiptAttempts);
    ok(`…(${trigger}) the row reads "held", not a failure`, receiptStatus(p, T0).state === "held", receiptStatus(p, T0));
    ok(`…(${trigger}) and the retry cron will not pick it up`, nextReceiptRetryAt({ ...p, receiptFirstAttemptAt: T0, receiptLastAttemptAt: T0 }, T0) === null);
    ok(`…(${trigger}) the client page lists it`, rows.autoMessageSkip.some((s) => s.sender === "payment_receipt" && s.refLabel === "INV-0009"), rows.autoMessageSkip);
  }

  fixture();
  sent.length = 0;
  const manual = await sendPaymentReceipt(db, { companyId: CO, paymentId: "pay_1", trigger: "manual", actor: { id: "m", userId: "u", name: "Office" }, now: T0 }, deps).catch((e) => ({ threw: e.message }));
  ok("a person's Send receipt still sends to a switched-off client", manual.sent === true && sent.length === 1, manual);
  ok("…to the client's address", sent[0]?.to === "lisa.hampel@pspc.example", sent[0]?.to);
  ok("…and the gate recorded nothing for it", rows.autoMessageSkip.length === 0, rows.autoMessageSkip);

  fixture();
  rows.invoice[0].clientId = "c_on";
  sent.length = 0;
  const normal = await sendPaymentReceipt(db, { companyId: CO, paymentId: "pay_1", trigger: "record", now: T0 }, deps).catch((e) => ({ threw: e.message }));
  ok("an automatic receipt to anyone else is sent exactly as before", normal.sent === true && sent.length === 1, normal);
}

// 3b. Bulk portal links: the preview skips the client, by a stated reason.
{
  const base = { id: "c_off", companyId: CO, email: "lisa.hampel@pspc.example", doNotContactAt: null, jobs: [{ id: "j", companyId: CO, clientId: "c_off", status: "scheduled" }], quotes: [] };
  ok("bulk portal links: switch on → skipped as auto_messages_off", classifyClient({ ...base, autoMessagesOffAt: T0 }, { companyId: CO }).skip === "auto_messages_off");
  ok("bulk portal links: switch off → eligible as before", classifyClient({ ...base, autoMessagesOffAt: null }, { companyId: CO }).eligible === true);
  ok("bulk portal links: do-not-contact still reads as opted_out (both kept)", classifyClient({ ...base, doNotContactAt: T0, autoMessagesOffAt: T0 }, { companyId: CO }).skip === "opted_out");
  ok("the dialog names the new skip reason", /auto_messages_off/.test(read("app/app/clients/PortalLinksDialog.js")));
}

// 3c. A marketing campaign skips the client — by link and by bare address —
//     and still completes.
{
  const { sendCampaignEmails } = await import("@/app/api/marketing/campaigns/[id]/send/route");
  resetDbStub();
  seedClients();
  rows.marketingSubscriber = [
    { id: "s_off_linked", companyId: CO, email: "lisa.hampel@pspc.example", clientId: "c_off", subscribed: true, unsubscribeToken: "t1" },
    { id: "s_off_bare", companyId: CO, email: "LISA.HAMPEL@pspc.example", clientId: null, subscribed: true, unsubscribeToken: "t2" },
    { id: "s_on", companyId: CO, email: "marie@example.com", clientId: "c_on", subscribed: true, unsubscribeToken: "t3" },
  ];
  rows.marketingCampaign = [{ id: "camp_1", companyId: CO, name: "Spring" }];
  const campaign = { id: "camp_1", companyId: CO, name: "Spring", company: { id: CO, name: "Northline" }, template: { id: "tpl", subject: "Hi", blocks: [{ type: "text", text: "Hello" }] } };
  const res = await sendCampaignEmails({ campaign, companyId: CO, request: new Request("https://app.example/x") }).catch((e) => ({ threw: e.message }));
  const body = res?.json ? await res.json() : res;
  const delivered = rows.marketingCampaignDelivery.map((d) => d.subscriberId);
  ok("campaign: the switched-off client (linked) gets no delivery", !delivered.includes("s_off_linked"), delivered);
  ok("campaign: …nor the same address with no client link", !delivered.includes("s_off_bare"), delivered);
  ok("campaign: everyone else is delivered", delivered.includes("s_on"), body);
  ok("campaign: reports them as held back", body?.heldBack === 2, body);
  ok("campaign: and still completes", body?.partial === false, body);
}

// 3d. Prep guide: executed end to end in scripts/check-prep-guide.mjs, whose
//     fixture renders the real PDF ("automatic messages off: the cron's guide
//     is held back" / "a person's Send now still sends"). Here: the gate is
//     asked only on the cron's path (no `member`).
{
  const src = read("lib/prepGuide/send.js");
  ok("prep guide: the gate sits behind `if (!member)` — Send now is by hand", /if \(!member\) \{\s*const gate = await d\.autoMessageGate\(/.test(src));
  ok("prep guide: check-prep-guide executes the held-back case", /automatic messages off: the cron's guide is held back/.test(read("scripts/check-prep-guide.mjs")));
}

// 3e. The phone agent's automatic reminder call is not queued.
{
  const { onBookingConfirmed } = await import("@/lib/voice/triggers");
  const later = new Date(Date.now() + 3 * 86400_000);
  for (const [clientId, expectQueued] of [["c_off", false], ["c_on", true]]) {
    resetDbStub();
    seedClients();
    rows.booking = [{ id: `b_${clientId}`, mode: "visit", startTime: later, clientName: "x", appointment: { clientId, companyId: CO, company: { outboundCallsEnabled: true, timezone: "America/Toronto" }, client: { phone: "819-555-0100" } } }];
    const r = await onBookingConfirmed({ bookingId: `b_${clientId}` }).catch((e) => ({ threw: e.message }));
    const queued = rows.voiceCallTask.length > 0;
    ok(`voice reminder call (${clientId}): ${expectQueued ? "queued as before" : "not queued"}`, queued === expectQueued, { r, tasks: rows.voiceCallTask });
  }
  ok("…and the held-back call is listed", true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Contacts");
{
  // Pure input cleaning.
  ok("a contact needs a name", cleanContactInput({ name: "   " }).ok === false);
  ok("a bad email is refused, not stored", cleanContactInput({ name: "A", email: "not-an-email" }).ok === false);
  ok("an email is normalised", cleanContactInput({ name: "A", email: "  Lisa@PSPC.example " }).data?.email === "lisa@pspc.example");
  const hostileInput = cleanContactInput({ name: { $gt: "" }, role: ["x"], email: { toString: () => "a@b.c" }, phone: 5, notes: null });
  ok("non-string fields are dropped, not coerced", hostileInput.ok === false, hostileInput);
  const capped = cleanContactInput({ name: "n".repeat(900), role: "r".repeat(900), notes: "z".repeat(9000), phone: "1".repeat(99) });
  ok("every field is capped", capped.data.name.length === 200 && capped.data.role.length === 100 && capped.data.notes.length === 2000 && capped.data.phone.length === 40, capped.data && Object.fromEntries(Object.entries(capped.data).map(([k, v]) => [k, v?.length])));

  resetDbStub();
  seedClients();
  const add = (body, clientId = "c_off", companyId = CO) => createContact(db, { companyId, clientId, body });

  const bob = await add({ name: "Bob Tech", role: "Technical Authority", email: "bob@pspc.example", phone: "819-555-0110" });
  ok("add a contact", bob.ok && rows.clientContact.length === 1, bob);
  ok("…not primary, scoped to company and client", rows.clientContact[0].isPrimary === false && rows.clientContact[0].companyId === CO && rows.clientContact[0].clientId === "c_off");
  const sam = await add({ name: "Sam Site", role: "Site contact", phone: "819-555-0120" });
  const ap = await add({ name: "AP Desk", role: "Billing / Accounts payable", email: "ap@pspc.example" });
  ok("each new contact goes to the end", rows.clientContact.map((c) => c.sortOrder).join(",") === "1,2,3", rows.clientContact.map((c) => c.sortOrder));

  ok("adding to another company's client → 404", (await add({ name: "X" }, "c_foreign_off")).status === 404);
  ok("adding with my client id but another company's session → 404", (await add({ name: "X" }, "c_off", OTHER)).status === 404);
  ok("adding to a client id that is an object → 404", (await add({ name: "X" }, { $ne: null })).status === 404);

  // The list: primary first, from the client's own columns.
  const client = rows.client.find((c) => c.id === "c_off");
  let entries = contactEntries(client, rows.clientContact);
  ok("the primary is listed first, from the client's columns", entries[0]?.isPrimary && entries[0].id === null && entries[0].email === "lisa.hampel@pspc.example" && entries[0].name === "Lisa Hampel", entries[0]);
  ok("…then the others in order", entries.slice(1).map((e) => e.name).join("|") === "Bob Tech|Sam Site|AP Desk", entries.map((e) => e.name));

  // Edit the primary from the card: it becomes a row, the columns follow.
  const prim = await updateContact(db, { companyId: CO, clientId: "c_off", id: "primary", body: { name: "Lisa Hampel", role: "Contracting Authority", email: "lisa.hampel@pspc.example", phone: "819-555-0100", notes: "Ariba only" } });
  ok("editing the primary makes a primary row with its role", prim.ok && rows.clientContact.filter((c) => c.isPrimary).length === 1 && rows.clientContact.find((c) => c.isPrimary).role === "Contracting Authority", prim);
  ok("…and changes no client column when the details are the same", prim.changedClient.length === 0, prim.changedClient);

  // Make Bob primary: Lisa is kept, Bob's details become the client's.
  const people = () => new Set([...rows.clientContact.map((c) => c.email || c.phone)]);
  const before = people();
  const mp = await makePrimary(db, { companyId: CO, clientId: "c_off", id: bob.contact.id });
  ok("make primary succeeds", mp.ok, mp);
  ok("…the client's email is now Bob's (every document follows)", client.email === "bob@pspc.example" && client.contactName === "Bob Tech", { email: client.email, name: client.contactName });
  ok("…exactly one primary", rows.clientContact.filter((c) => c.isPrimary).length === 1);
  ok("…Lisa is still a contact (nobody lost)", rows.clientContact.some((c) => !c.isPrimary && c.email === "lisa.hampel@pspc.example" && c.role === "Contracting Authority"), rows.clientContact);
  ok("…the same people before and after", md5([...before].sort()) === md5([...people()].sort()), { before: [...before], after: [...people()] });
  ok("…logged as a change to the client's email and contact", mp.changedClient.includes("email") && mp.changedClient.includes("contactName"), mp.changedClient);

  // Make primary when the primary was only the columns: the columns' person is kept as a row.
  resetDbStub();
  seedClients();
  const c2 = rows.client.find((c) => c.id === "c_off");
  const t = await add({ name: "Tina", email: "tina@pspc.example" });
  await makePrimary(db, { companyId: CO, clientId: "c_off", id: t.contact.id });
  ok("promoting over a columns-only primary keeps that person as a contact", rows.clientContact.some((c) => !c.isPrimary && c.email === "lisa.hampel@pspc.example" && c.name === "Lisa Hampel"), rows.clientContact);
  ok("…and the client now points at Tina", c2.email === "tina@pspc.example");

  // Hostile ids.
  ok("make primary with another company's contact id → 404", (await makePrimary(db, { companyId: OTHER, clientId: "c_off", id: t.contact.id })).status === 404);
  rows.clientContact.push({ id: "cc_foreign", companyId: OTHER, clientId: "c_foreign_off", name: "Theirs", isPrimary: false, sortOrder: 1 });
  ok("editing a contact of another client → 404", (await updateContact(db, { companyId: CO, clientId: "c_off", id: "cc_foreign", body: { name: "Mine now" } })).status === 404);
  ok("…and theirs is unchanged", rows.clientContact.find((c) => c.id === "cc_foreign").name === "Theirs");
  ok("removing another company's contact → 404", (await removeContact(db, { companyId: CO, clientId: "c_off", id: "cc_foreign" })).status === 404);

  // Remove: the contact only, never the primary, never the client.
  const primaryRow = rows.clientContact.find((c) => c.isPrimary && c.clientId === "c_off");
  const r1 = await removeContact(db, { companyId: CO, clientId: "c_off", id: primaryRow.id });
  ok("removing the primary is refused (409)", r1.status === 409 && rows.clientContact.includes(primaryRow), r1);
  const lisaRow = rows.clientContact.find((c) => c.email === "lisa.hampel@pspc.example");
  const clientsBefore = rows.client.length;
  const r2 = await removeContact(db, { companyId: CO, clientId: "c_off", id: lisaRow.id });
  ok("removing a contact removes that contact", r2.ok && !rows.clientContact.includes(lisaRow), r2);
  ok("…and nothing else (the client stays)", rows.client.length === clientsBefore && rows.client.some((c) => c.id === "c_off"));

  // Reorder.
  resetDbStub();
  seedClients();
  const a = await add({ name: "A" });
  const b = await add({ name: "B" });
  const c = await add({ name: "C" });
  ok("reorder with a foreign id is refused whole", (await reorderContacts(db, { companyId: CO, clientId: "c_off", ids: [a.contact.id, "cc_foreign"] })).status === 400);
  ok("reorder with a duplicate is refused", (await reorderContacts(db, { companyId: CO, clientId: "c_off", ids: [a.contact.id, a.contact.id] })).status === 400);
  ok("reorder with a non-array is refused", (await reorderContacts(db, { companyId: CO, clientId: "c_off", ids: "a,b" })).status === 400);
  ok("reorder with an object id is refused", (await reorderContacts(db, { companyId: CO, clientId: "c_off", ids: [{ id: a.contact.id }] })).status === 400);
  const ro = await reorderContacts(db, { companyId: CO, clientId: "c_off", ids: [c.contact.id, a.contact.id, b.contact.id] });
  const order = contactEntries(rows.client.find((x) => x.id === "c_off"), rows.clientContact).filter((e) => !e.isPrimary).map((e) => e.name).join("");
  ok("reorder applies", ro.ok && order === "CAB", order);

  // The cap.
  resetDbStub();
  seedClients();
  for (let i = 0; i < MAX_CONTACTS_PER_CLIENT; i++) rows.clientContact.push({ id: `cc_${i}`, companyId: CO, clientId: "c_off", name: `P${i}`, sortOrder: i, isPrimary: false });
  ok(`the ${MAX_CONTACTS_PER_CLIENT + 1}th contact is refused`, (await add({ name: "One too many" })).status === 409);

  // The client's own edit form keeps the primary row in step.
  resetDbStub();
  seedClients();
  rows.clientContact = [{ id: "pr", companyId: CO, clientId: "c_off", name: "Lisa Hampel", email: "lisa.hampel@pspc.example", isPrimary: true, sortOrder: 0 }];
  await syncPrimaryFromClient(db, { companyId: CO, clientId: "c_off", client: { contactName: "Lisa H.", email: "new@pspc.example", phone: "1" } });
  ok("editing the client's email moves the primary row with it", rows.clientContact[0].email === "new@pspc.example" && rows.clientContact[0].name === "Lisa H.", rows.clientContact[0]);
  await syncPrimaryFromClient(db, { companyId: CO, clientId: "c_off", client: { contactName: null, email: "new@pspc.example" } });
  ok("…an individual's null contactName does not blank the row's name", rows.clientContact[0].name === "Lisa H.", rows.clientContact[0]);
  ok("…and never throws on a broken db", (await syncPrimaryFromClient({ clientContact: { updateMany: async () => { throw new Error("x"); } } }, { companyId: CO, clientId: "c_off", client: {} })) === undefined);
}

section("4b. The contacts routes, executed (permission grid + tenant)");
{
  const { GET, POST, PUT } = await import("@/app/api/clients/[id]/contacts/route");
  const one = await import("@/app/api/clients/[id]/contacts/[contactId]/route");
  const OWNER = { id: "m_owner", userId: "u_owner", companyId: CO, role: "owner", permissions: null };
  const CREW = { id: "m_crew", userId: "u_crew", companyId: CO, role: "employee", permissions: { clientsProperties: "name_address_only", jobs: "view_only" } };
  const VIEWER = { id: "m_view", userId: "u_view", companyId: CO, role: "employee", permissions: { clientsProperties: "full_view" } };
  const req = (method, body) => new Request("https://app.example/api/clients/c_off/contacts", { method, ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}) });
  const params = (id, contactId) => ({ params: Promise.resolve({ id, ...(contactId ? { contactId } : {}) }) });

  resetDbStub();
  seedClients();
  rows.member = [OWNER, CREW, VIEWER];

  session.member = null;
  ok("no session → 401", (await GET(req("GET"), params("c_off"))).status === 401);

  session.member = CREW;
  ok("name_address_only cannot read contacts (403)", (await GET(req("GET"), params("c_off"))).status === 403);
  ok("…nor add one (403)", (await POST(req("POST", { name: "X" }), params("c_off"))).status === 403);
  ok("…and nothing was written", rows.clientContact.length === 0);

  session.member = VIEWER;
  const list = await GET(req("GET"), params("c_off"));
  const listed = await list.json();
  ok("full_view reads the list", list.status === 200 && listed.contacts?.[0]?.isPrimary === true, listed);
  ok("…but cannot add (403)", (await POST(req("POST", { name: "X" }), params("c_off"))).status === 403);

  session.member = OWNER;
  const created = await POST(req("POST", { name: "Bob", email: "bob@pspc.example" }), params("c_off"));
  const cb = await created.json();
  ok("the owner adds a contact (201)", created.status === 201 && cb.contact?.name === "Bob", cb);
  ok("…and the trail names the contact, not their details", rows.activityLog?.some?.((l) => l.action === "client.contact_added" && !JSON.stringify(l).includes("bob@pspc.example")) ?? true);
  ok("an invalid email → 400", (await POST(req("POST", { name: "Bad", email: "nope" }), params("c_off"))).status === 400);
  ok("a foreign client → 404", (await POST(req("POST", { name: "X" }), params("c_foreign_off"))).status === 404);
  ok("a body that is not JSON → 400, not 500", (await POST(new Request("https://app.example/x", { method: "POST", body: "{{{" }), params("c_off"))).status === 400);
  ok("reorder with junk → 400", (await PUT(req("PUT", { ids: [1, 2] }), params("c_off"))).status === 400);
  const mk = await one.PATCH(req("PATCH", { action: "make_primary" }), params("c_off", cb.contact.id));
  ok("make primary through the route", mk.status === 200 && rows.client.find((c) => c.id === "c_off").email === "bob@pspc.example");
  ok("…logged as a client edit", rows.activityLog.some((l) => l.action === "client.updated" && l.metadata?.via === "contacts"), rows.activityLog.map((l) => l.action));
  ok("deleting the primary through the route → 409", (await one.DELETE(req("DELETE"), params("c_off", cb.contact.id))).status === 409);
  session.member = CREW;
  ok("name_address_only cannot delete (403)", (await one.DELETE(req("DELETE"), params("c_off", cb.contact.id))).status === 403);
  session.member = null;
}

section("4b'. The client route, executed: the switch, the Organization fields, the type switch");
{
  const { GET, PATCH } = await import("@/app/api/clients/[id]/route");
  const OWNER = { id: "m_owner", userId: "u_owner", companyId: CO, role: "owner", permissions: null };
  const CREW = { id: "m_crew", userId: "u_crew", companyId: CO, role: "employee", permissions: { clientsProperties: "name_address_only", jobs: "view_only" } };
  const patch = (body) => PATCH(new Request("https://app.example/api/clients/c_off", { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({ id: "c_off" }) });
  const get = async () => {
    const res = await GET(new Request("https://app.example/api/clients/c_off"), { params: Promise.resolve({ id: "c_off" }) });
    return { status: res.status, body: await res.json() };
  };
  resetDbStub();
  seedClients();
  rows.member = [OWNER, CREW];
  rows.user = [{ id: "u_owner", name: "Owner" }];
  const row = () => rows.client.find((c) => c.id === "c_off");
  row().autoMessagesOffAt = null;
  row().autoMessagesOffReason = null;
  rows.clientContact = [{ id: "cc_bob", companyId: CO, clientId: "c_off", name: "Bob", email: "bob@pspc.example", isPrimary: false, sortOrder: 1 }];

  session.member = CREW;
  ok("name_address_only cannot turn the switch on (403)", (await patch({ autoMessagesOff: true })).status === 403 && row().autoMessagesOffAt === null);

  session.member = OWNER;
  let r = await patch({ autoMessagesOff: true, autoMessagesOffReason: "  Government tender: SAP Ariba only  " });
  ok("the owner turns it on, with a trimmed reason", r.status === 200 && row().autoMessagesOffAt instanceof Date && row().autoMessagesOffReason === "Government tender: SAP Ariba only", { status: r.status, row: row() });
  const stamped = row().autoMessagesOffAt;
  ok("…logged as a client edit naming the switch", rows.activityLog.some((l) => l.action === "client.updated" && l.metadata?.fields?.includes("autoMessagesOff")), rows.activityLog.map((l) => l.metadata));
  await patch({ autoMessagesOff: true });
  ok("saving the form again keeps the original date", row().autoMessagesOffAt === stamped);
  await patch({ autoMessagesOff: "yes please" });
  ok("a non-boolean leaves it on", row().autoMessagesOffAt === stamped);
  await patch({ organizationUnit: "  Science and Parliamentary Infrastructure Branch  ", procurementNotes: "Questions only through SAP Ariba" });
  ok("the Organization fields are written trimmed", row().organizationUnit === "Science and Parliamentary Infrastructure Branch" && row().procurementNotes === "Questions only through SAP Ariba");
  await patch({ organizationUnit: 42, procurementNotes: { $set: "x" } });
  ok("non-string Organization fields are ignored, not read as a clear", row().organizationUnit === "Science and Parliamentary Infrastructure Branch" && row().procurementNotes === "Questions only through SAP Ariba", { u: row().organizationUnit, p: row().procurementNotes });
  await patch({ procurementNotes: "x".repeat(5000) });
  ok("a 5000-character note is capped", row().procurementNotes.length === 2000);
  await patch({ procurementNotes: "Questions only through SAP Ariba" });

  let g = await get();
  ok("GET (company): department, notes and contacts are there", g.status === 200 && g.body.organizationUnit && g.body.procurementNotes && Array.isArray(g.body.contacts) && g.body.contacts.some((c) => c.name === "Bob"), g.body);
  ok("…the switch is there for the page", Boolean(g.body.autoMessagesOffAt) && g.body.autoMessagesOffReason === "Government tender: SAP Ariba only");

  await patch({ type: "individual", scope: "everywhere" });
  g = await get();
  ok("switched to individual: no Organization keys reach the page", !("organizationUnit" in g.body) && !("procurementNotes" in g.body) && !("contacts" in g.body), Object.keys(g.body));
  ok("…but nothing was deleted", rows.clientContact.length === 1 && row().organizationUnit === "Science and Parliamentary Infrastructure Branch");
  ok("…and the switch is still shown (it is every client type's)", Boolean(g.body.autoMessagesOffAt));

  await patch({ type: "company", scope: "everywhere" });
  g = await get();
  ok("switched back to company: it all comes back", g.body.organizationUnit === "Science and Parliamentary Infrastructure Branch" && g.body.contacts?.some((c) => c.name === "Bob"));

  // An office member capped at name and address (a crew member scoped to
  // their own jobs is refused the client outright — 404 — which leaks less).
  const OFFICE_RESTRICTED = { id: "m_office", userId: "u_office", companyId: CO, role: "employee", permissions: { clientsProperties: "name_address_only", jobs: "view_create_edit" } };
  rows.member.push(OFFICE_RESTRICTED);
  session.member = OFFICE_RESTRICTED;
  g = await get();
  ok("GET as name_address_only: no contacts, no email", g.status === 200 && !("contacts" in g.body) && g.body.email === undefined && g.body.restricted === true, { status: g.status, keys: Object.keys(g.body) });
  session.member = CREW;
  ok("GET as crew not on this client's jobs: 404", (await get()).status === 404);

  session.member = OWNER;
  await patch({ autoMessagesOff: false });
  ok("turning it off clears the date and the reason", row().autoMessagesOffAt === null && row().autoMessagesOffReason === null);
  session.member = null;
}

section("4c. Redaction (rbac): the list is contact data");
{
  const restricted = { role: "employee", permissions: { clientsProperties: "name_address_only" } };
  const full = { role: "employee", permissions: { clientsProperties: "full_view", notes: "view_edit_all" } };
  const org = organizationShape(
    { id: "c_off", companyId: CO, name: "PSPC", type: "company", email: "l@x", phone: "1", contactName: "Lisa", organizationUnit: "Science Branch", procurementNotes: "Ariba only" },
    [{ id: "cc", name: "Bob", email: "bob@x", phone: "2", isPrimary: false, sortOrder: 1 }],
  );
  const r = redactClient(restricted, org);
  ok("name_address_only: no contacts key at all", !("contacts" in r), Object.keys(r));
  ok("…no email, phone or contact name", r.email === undefined && r.phone === undefined && r.contactName === undefined);
  ok("…and marked restricted so the card says so", r.restricted === true);
  ok("…the department and procurement notes are not contact data and stay", r.organizationUnit === "Science Branch" && r.procurementNotes === "Ariba only");
  const f = redactClient(full, org);
  ok("full_view: the contacts are there", Array.isArray(f.contacts) && f.contacts.some((c) => c.email === "bob@x"));
  ok("the enforce list names contacts", /"contacts",/.test(read("lib/permissions/enforce.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Recipients: the default send is byte-identical");
{
  const clients = [
    { id: "c_off", companyId: CO, type: "company", email: "lisa.hampel@pspc.example" },
    { id: "c_on", companyId: CO, type: "individual", email: "  marie@example.com  " },
    { id: "c_none", companyId: CO, type: "individual", email: null },
    { id: "c_empty", companyId: CO, type: "company", email: "" },
    null,
  ];
  for (const c of clients) {
    const old = { to: c?.email?.trim() };
    const now = await resolveSendRecipients(db, { companyId: CO, client: c, selection: undefined });
    ok(`default to for ${c?.id || "no client"}: md5 identical`, md5(old) === md5({ to: now.to }), { old, now });
  }
  // The request bodies the screens post, before and after.
  const bodies = [
    ["quote page", { kind: "quote" }],
    ["quote follow-up", { kind: "follow_up" }],
    ["invoice page (plain press)", null],
    ["invoice page (PO answer)", { clientPoNumber: "PO-1" }],
    ["invoice builder (send without PO)", { sendWithoutPo: true }],
    ["request payment", { note: "", mode: "balance" }],
  ];
  for (const [label, body] of bodies) {
    for (const sel of [null, undefined, DEFAULT_SELECTION, { primary: true, contactIds: [] }, { primary: true, contactIds: ["", null] }]) {
      const after = recipientsForBody(body, sel);
      ok(`${label} with selection ${JSON.stringify(sel)}: same object, md5 identical`, after === body && md5(JSON.stringify(after)) === md5(JSON.stringify(body)));
    }
  }
  ok("recipientText of a string is that string", recipientText("a@b.c") === "a@b.c" && recipientText(["a@b.c", "d@e.f"]) === "a@b.c, d@e.f");
  ok("the screens build their bodies through recipientsForBody", ["app/app/quotes/[id]/page.js", "app/app/invoices/[id]/page.js", "app/components/quotes/builder/QuoteBuilder.js", "app/components/invoices/builder/InvoiceBuilder.js"].every((f) => /recipientsForBody\(/.test(read(f))));
  ok("the routes resolve through resolveSendRecipients", ["app/api/quotes/[id]/send/route.js", "app/api/invoices/[id]/send/route.js", "app/api/invoices/[id]/request-payment/route.js"].every((f) => /resolveSendRecipients\(/.test(read(f))));
}

section("5b. Recipients: the picker accepts only this client's own people");
{
  resetDbStub();
  seedClients();
  rows.clientContact = [
    { id: "cc_bob", companyId: CO, clientId: "c_off", name: "Bob", email: "BOB@pspc.example", isPrimary: false },
    { id: "cc_sam", companyId: CO, clientId: "c_off", name: "Sam", email: null, isPrimary: false },
    { id: "cc_dup", companyId: CO, clientId: "c_off", name: "Lisa again", email: "Lisa.Hampel@pspc.example", isPrimary: false },
    { id: "cc_other_client", companyId: CO, clientId: "c_on", name: "Marie's", email: "m2@example.com", isPrimary: false },
    { id: "cc_foreign", companyId: OTHER, clientId: "c_foreign_off", name: "Theirs", email: "theirs@elsewhere.example", isPrimary: false },
  ];
  const off = rows.client.find((c) => c.id === "c_off");
  const on = rows.client.find((c) => c.id === "c_on");
  const pick = (selection, client = off) => resolveSendRecipients(db, { companyId: CO, client, selection });

  let r = await pick({ primary: true, contactIds: ["cc_bob"] });
  ok("primary + Bob → both, as an array", Array.isArray(r.to) && r.to.join(",") === "lisa.hampel@pspc.example,bob@pspc.example", r);
  r = await pick({ primary: false, contactIds: ["cc_bob"] });
  ok("Bob alone → one string", r.to === "bob@pspc.example", r);
  r = await pick({ primary: true, contactIds: ["cc_dup"] });
  ok("the same address twice is sent once", r.to === "lisa.hampel@pspc.example", r);
  ok("another client's contact → refused", (await pick({ primary: true, contactIds: ["cc_other_client"] })).code === "unknown_contact");
  ok("another company's contact → refused", (await pick({ primary: true, contactIds: ["cc_foreign"] })).code === "unknown_contact");
  ok("a raw address in contactIds → refused (ids only)", (await pick({ primary: true, contactIds: ["attacker@evil.example"] })).code === "unknown_contact");
  ok("a contact with no email → refused", (await pick({ primary: true, contactIds: ["cc_sam"] })).code === "contact_no_email");
  ok("nobody ticked → refused", (await pick({ primary: false, contactIds: [] })).code === "no_recipients");
  ok("a selection that is a string → refused", (await pick("everyone")).code === "bad_recipients");
  ok("a selection that is an array → refused", (await pick(["cc_bob"])).code === "bad_recipients");
  ok("an individual's hidden contacts can't be chosen", (await pick({ primary: true, contactIds: ["cc_other_client"] }, on)).code === "not_organisation");
  ok("a client from another company → 404", (await resolveSendRecipients(db, { companyId: OTHER, client: off, selection: { primary: true, contactIds: ["cc_bob"] } })).status === 404);
  ok("an `to` key smuggled into the selection is ignored", (await pick({ primary: true, contactIds: [], to: "attacker@evil.example" })).to === "lisa.hampel@pspc.example");

  // When the picker shows itself.
  const two = [{ isPrimary: true, email: "a@x" }, { id: "b", email: "b@x" }];
  ok("picker: an individual never gets it", !offersRecipientPicker({ type: "individual" }, two));
  ok("picker: an organisation with one reachable contact doesn't", !offersRecipientPicker({ type: "company" }, [two[0], { id: "c", email: null }]));
  ok("picker: an organisation with two reachable contacts does", offersRecipientPicker({ type: "company" }, two));
  ok("isDefaultSelection treats junk as default (the body is left alone)", isDefaultSelection(null) && isDefaultSelection("x") && !isDefaultSelection({ primary: false }));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. An individual is unchanged; switching type keeps everything");
{
  // The keys a homeowner's GET carried before this change, on a row read
  // with the new columns present.
  const before = { id: "c_on", companyId: CO, name: "Marie", type: "individual", contactName: null, email: "m@x", phone: "1", address: "1 Rue", notes: null, language: "fr", requiresPo: false };
  const withNewColumns = { ...before, organizationUnit: "left over", procurementNotes: "left over", autoMessagesOffAt: null, autoMessagesOffReason: null };
  const shaped = organizationShape(withNewColumns, [{ id: "kept", name: "Spouse", isPrimary: false }]);
  const extra = Object.keys(shaped).filter((k) => !(k in before)).sort();
  ok("an individual's payload gains only the switch's two columns", extra.join(",") === "autoMessagesOffAt,autoMessagesOffReason", extra);
  ok("…no contacts key", !("contacts" in shaped));
  const { autoMessagesOffAt: _a, autoMessagesOffReason: _b, ...comparable } = shaped;
  ok("…and everything else md5-identical", md5(comparable) === md5(before), { comparable, before });
  const asOrg = organizationShape({ ...withNewColumns, type: "company" }, [{ id: "kept", name: "Spouse", isPrimary: false }]);
  ok("switched to company: the kept department and contacts come back", asOrg.organizationUnit === "left over" && asOrg.contacts.some((c) => c.id === "kept"));
  ok("organizationShape never mutates the row", withNewColumns.organizationUnit === "left over" && !("contacts" in withNewColumns));

  // The client route: org fields written only from strings, and the type
  // switch deletes nothing (no clientContact delete anywhere in the route).
  const route = read("app/api/clients/[id]/route.js");
  ok("the client PATCH never deletes contacts", !/clientContact\.(delete|deleteMany)/.test(route));
  ok("the client GET reads contacts only for a company", /client\.type === "company"/.test(route));
  ok("the Organization card returns nothing unless type is company", /client\.type !== "company"\) return null/.test(read("app/components/clients/OrganizationCard.js")));
  ok("the automatic-messages panel and notice return nothing while the switch is off", (read("app/components/clients/AutoMessages.js").match(/if \(!(autoMessagesOff\(client\)|off)\) return null/g) || []).length === 2);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Strings, in every language");
{
  const keys = [
    "app.orgCard.title", "app.orgCard.addContact", "app.orgCard.makePrimary", "app.orgCard.removeConfirm", "app.orgCard.otherContacts",
    "app.orgCard.department", "app.orgCard.procurementNotes", "app.orgCard.role.contractingAuthority",
    "app.autoMessages.toggle", "app.autoMessages.toggleHint", "app.autoMessages.notice", "app.autoMessages.vsDnc", "app.autoMessages.heldTitle",
    "app.recipients.title", "app.recipients.chosenBelow", "app.invoiceDetail.receiptHeld", "app.invoiceDetail.receiptHeldState",
    "app.invoiceDetail.receiptAutoOff", "app.portalLinks.skip.autoMessagesOff", "app.setVoice.callback.auto_messages_off",
  ];
  for (const [lang, msgs] of Object.entries(APP_MESSAGES)) {
    const missing = keys.filter((k) => typeof msgs[k] !== "string" || !msgs[k].trim());
    ok(`${lang}: every new string present`, missing.length === 0, missing);
    ok(`${lang}: removeConfirm keeps its {name}`, /\{name\}/.test(msgs["app.orgCard.removeConfirm"] || ""));
  }
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
