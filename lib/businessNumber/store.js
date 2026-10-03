// lib/businessNumber/store.js
//
// "Bring your number", end to end: check the line, start the right path, keep
// the status honest, and wire the number in when it lands.
//
// ══ Injectable on purpose ═══════════════════════════════════════════════════
//
// Every function takes `deps` — { prisma, provider, isDemo, balance, debit,
// now } — defaulting to the real database, lib/businessNumber/provider.js and
// the real ledger. scripts/check-bring-your-number.mjs passes fakes for all of
// them, so the state machine, the PIN handling and the demo refusal are
// executed end to end without a database or a Twilio account.
//
// ══ The company comes from the session, never the body ═════════════════════
//
// Every entry point takes `companyId` from the route's resolved member and
// reads/writes the row by that id (BroughtNumber.companyId is @unique). No
// function here accepts a row id from a request — so one company cannot read,
// cancel or activate another's request by naming its id. The only cross-tenant
// READ is the claim check (is anyone else bringing this number in?), and it
// returns a yes/no, never the other company.
//
// ══ Demo companies never order, host or port ═══════════════════════════════
//
// isDemo() is asked FIRST in every path that could reach the provider, before
// the configuration checks, so the simulated path works on a machine with no
// Twilio credentials — the same order lib/crew/line.js keeps. A demo's row is
// `simulated: true`, carries no secrets at all (nothing is encrypted because
// nothing is kept), never becomes `active`, and never writes
// Company.smsFromNumber — a fictional line must never be where a real
// homeowner's text is routed.

import { db } from "@/lib/db";
import * as realProvider from "./provider";
import { isDemoCompany } from "@/lib/demo/simulatedSpend";
import { toE164 } from "@/lib/voice/numbers";
import { numberCommitment } from "@/lib/voice/numberCommitment";
import { balanceFor, debitCredit } from "@/lib/voice/credits";
import { RENT_PERIOD_DAYS } from "@/lib/voice/spendGate";
import { recordError } from "@/lib/platform/errorLog";
import { classifyNumber, simulatedClassification } from "./lineType";
import {
  IN_FLIGHT,
  isTerminal,
  canTransition,
  mapHostedStatus,
  mapPortStatus,
  mapCanadianFiling,
  secretsShouldBePurged,
  nextStepFor,
  alreadyTextEnabled,
  ALREADY_TEXT_ENABLED_ADVICE,
  expectedBy,
} from "./state";
import { portSecretsConfigured, sealPortSecret, openPortSecret, redactPortDetail, lastFour } from "./secrets";
import { BROUGHT_NUMBER_MONTHLY_CENTS } from "./costs";
import { cleanForwardList } from "./twiml";

/** How long a status read is trusted before the screen asks Twilio again. */
export const SYNC_STALE_MS = 5 * 60 * 1000;

/** Bill upload limits. Under Vercel's 4.5 MB request ceiling, with the form around it. */
export const BILL_MAX_BYTES = 4 * 1024 * 1024;
export const BILL_TYPES = Object.freeze(["application/pdf", "image/png", "image/jpeg"]);

/** The webhooks a brought number is pointed at. One definition. */
export function webhookUrls(origin) {
  const base = String(origin || "").replace(/\/+$/, "");
  return {
    sms: `${base}/api/sms/inbound`,
    voice: `${base}/api/business-number/voice`,
    voiceStatus: `${base}/api/business-number/call-status`,
  };
}

function defaults(deps = {}) {
  return {
    prisma: deps.prisma || db,
    provider: deps.provider || realProvider,
    isDemo: deps.isDemo || isDemoCompany,
    balance: deps.balance || ((companyId, prisma) => balanceFor(companyId, prisma)),
    debit: deps.debit || debitCredit,
    commitment: deps.commitment || numberCommitment,
    now: deps.now || (() => new Date()),
    log: deps.log || recordError,
  };
}

const refuse = (status, reasonKey, reason, extra = {}) => ({ ok: false, status, reasonKey, reason, ...extra });

/** The fields the company's screen may see. Never a secret; last four at most. */
export function publicView(row, { filings = [], secrets = {} } = {}) {
  if (!row) return null;
  const forwardTo = Array.isArray(row.forwardTo) ? row.forwardTo : [];
  const latestFiling = [...filings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  return {
    e164: row.e164,
    country: row.country,
    lineType: row.lineType,
    carrierName: row.carrierName,
    path: row.path,
    status: row.status,
    providerStatus: row.providerStatus,
    failureReason: row.failureReason,
    alreadyTextEnabled: alreadyTextEnabled(row.failureReason),
    alreadyTextEnabledAdvice: alreadyTextEnabled(row.failureReason) ? ALREADY_TEXT_ENABLED_ADVICE : null,
    submitChannel: row.submitChannel,
    holderName: row.holderName,
    holderEmail: row.holderEmail,
    serviceAddress: row.serviceAddress || null,
    accountNumberHint: secrets.accountNumberHint || null,
    billName: row.billName || null,
    loaSignedAt: row.loaSignedAt,
    forwardTo,
    ringSeconds: row.ringSeconds,
    fallback: row.fallback,
    submittedAt: row.submittedAt,
    expectedAt: row.expectedAt,
    activatedAt: row.activatedAt,
    lastSyncedAt: row.lastSyncedAt,
    simulated: Boolean(row.simulated),
    secretsHeld: Boolean(row.accountNumberEnc || row.pinEnc || row.billEnc),
    secretsPurgedAt: row.secretsPurgedAt,
    filing: latestFiling ? { action: latestFiling.action, note: latestFiling.note, portDate: latestFiling.portDate, at: latestFiling.createdAt } : null,
    nextStep: nextStepFor({ ...row, forwardTo }),
  };
}

/** The data that purges every secret, for a write at a terminal state. */
function purgeData(now) {
  return { accountNumberEnc: null, pinEnc: null, billEnc: null, secretsPurgedAt: now };
}

/**
 * Is another company bringing (or holding) this number? A yes/no.
 *
 * Asked before anything is ordered. Two companies hosting one number would
 * have Twilio refuse the second — but only after the second company had
 * signed an authorization for a number that is not theirs.
 */
async function claimedElsewhere(prisma, e164, companyId, commitment) {
  const other = await prisma.broughtNumber.findFirst({
    where: { e164, companyId: { not: companyId }, status: { in: [...IN_FLIGHT] } },
    select: { id: true },
  });
  if (other) return { kind: "brought" };
  const owner = await prisma.company.findFirst({
    where: { smsFromNumber: e164, id: { not: companyId } },
    select: { id: true },
  });
  if (owner) return { kind: "brought" };
  const c = await commitment(e164, { forCompanyId: companyId, prisma });
  // `self` from numberCommitment is "your own crew line" — still a FieldQuo
  // number, so not one anybody brings in.
  if (c) return { kind: c.kind };
  return null;
}

// ── 1. What kind of line is it? ─────────────────────────────────────────────

/**
 * Classify the number and save it as a draft. Never orders anything.
 *
 * Refused while another request of this company's is in flight: a second
 * check would overwrite the row that is tracking a live order.
 */
export async function checkNumber({ companyId, input }, deps) {
  const d = defaults(deps);
  const e164 = toE164(input);
  if (!companyId) return refuse(401, "no_company", "No company.");
  if (!e164) return refuse(400, "invalid", "That doesn't look like a phone number.");

  const current = await d.prisma.broughtNumber.findUnique({ where: { companyId } });
  if (current && !["draft", "failed", "cancelled"].includes(current.status)) {
    return refuse(409, "in_flight", "You're already bringing a number in. Cancel that request first to start another.");
  }

  const demo = await d.isDemo(companyId);
  let verdict;
  if (demo) {
    verdict = simulatedClassification(e164);
  } else {
    if (!d.provider.twilioConfigured()) {
      return refuse(503, "not_configured", "Bringing a number isn't switched on yet. There's nothing for you to do — it'll appear here when it's ready.");
    }
    let lookup = null;
    try {
      lookup = await d.provider.lookupLineType(e164);
    } catch (err) {
      await d.log({ area: "business_number", code: "lookup_failed", companyId, message: `Line type lookup failed: ${err?.message}`, detail: { e164 } });
      return refuse(503, "lookup_failed", "We couldn't check that number just now. Nothing has been ordered — try again in a moment.");
    }
    verdict = classifyNumber({ e164, lookup });
  }

  if (!verdict.ok) return { ok: false, status: 200, verdict, reasonKey: verdict.reasonKey, reason: verdict.reason };

  const elsewhere = await claimedElsewhere(d.prisma, e164, companyId, d.commitment);
  if (elsewhere) {
    return refuse(409, "taken", "That number is already in use in FieldQuo, so it can't be brought in here. Check the digits, and contact us if it really is yours.", { verdict });
  }

  const now = d.now();
  const path = verdict.paths.length === 1 ? verdict.paths[0] : null;
  const data = {
    e164,
    country: verdict.country,
    lineType: verdict.kind,
    carrierName: verdict.carrierName,
    lookedUpAt: now,
    // An "unknown" line offers both paths; the company picks on the next
    // step, and the draft holds hosted_sms only as a placeholder the start
    // routes overwrite.
    path: path || "hosted_sms",
    status: "draft",
    providerStatus: null,
    failureReason: null,
    submitChannel: null,
    providerOrderSid: null,
    providerNumberSid: null,
    addressSid: null,
    documentSid: null,
    submittedAt: null,
    expectedAt: null,
    activatedAt: null,
    cancelledAt: null,
    simulated: Boolean(demo),
    // A restart from a failed attempt carries nothing secret forward.
    ...purgeData(now),
    secretsPurgedAt: current?.accountNumberEnc || current?.pinEnc || current?.billEnc ? now : current?.secretsPurgedAt || null,
  };
  const row = current
    ? await d.prisma.broughtNumber.update({ where: { companyId }, data })
    : await d.prisma.broughtNumber.create({ data: { companyId, ...data } });
  return { ok: true, verdict, number: publicView(row) };
}

// ── 2a. Hosted SMS ──────────────────────────────────────────────────────────

const req = (v, max = 200) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

function cleanAddress(a = {}, country) {
  const addr = {
    street: req(a.street, 120),
    street2: req(a.street2, 120),
    city: req(a.city, 80),
    region: req(a.region, 40),
    postalCode: req(a.postalCode, 20),
    country,
  };
  const missing = ["street", "city", "region", "postalCode"].filter((k) => !addr[k]);
  return { addr, missing };
}

async function requireFirstMonth(d, companyId) {
  const balance = await d.balance(companyId, d.prisma);
  if (balance < BROUGHT_NUMBER_MONTHLY_CENTS) {
    return refuse(402, "balance", `The first month (${(BROUGHT_NUMBER_MONTHLY_CENTS / 100).toFixed(2)}) is taken from your phone balance the day the number goes live. Top up first so it can be.`, {
      needCents: BROUGHT_NUMBER_MONTHLY_CENTS,
      balanceCents: balance,
    });
  }
  return null;
}

/**
 * Start hosting texts for a landline / toll-free number.
 *
 * form: { holderName, email, contactPhone, contactTitle?, address: {…} }
 */
export async function startHosted({ companyId, form = {}, origin }, deps) {
  const d = defaults(deps);
  const row = await d.prisma.broughtNumber.findUnique({ where: { companyId } });
  if (!row || row.status !== "draft") return refuse(409, "not_draft", "Check the number first.");
  if (!["landline", "toll_free", "unknown"].includes(row.lineType)) {
    return refuse(400, "wrong_path", "Texts-only hosting is for landlines and toll-free numbers. This one has to be moved instead.");
  }
  const holderName = req(form.holderName, 120);
  const email = req(form.email, 200);
  const contactPhone = toE164(form.contactPhone);
  const { addr, missing } = cleanAddress(form.address, row.country);
  if (!holderName || !email || !/^\S+@\S+\.\S+$/.test(email) || !contactPhone || missing.length) {
    return refuse(400, "incomplete", "Fill in the owner's name, email, a contact phone and the full address.", { missing });
  }

  const now = d.now();
  const base = {
    path: "hosted_sms",
    holderName,
    holderEmail: email,
    contactPhone,
    serviceAddress: addr,
    submittedAt: now,
    expectedAt: expectedBy("hosted_sms", now),
    submitChannel: "twilio_api",
  };

  if (await d.isDemo(companyId)) {
    const updated = await d.prisma.broughtNumber.update({
      where: { companyId },
      data: { ...base, status: "pending_verification", providerStatus: "simulated", simulated: true },
    });
    return { ok: true, simulated: true, number: publicView(updated) };
  }
  if (!d.provider.twilioConfigured()) return refuse(503, "not_configured", "Bringing a number isn't switched on yet.");
  const short = await requireFirstMonth(d, companyId);
  if (short) return short;

  try {
    const address = await d.provider.createAddress({
      customerName: holderName,
      street: addr.street,
      street2: addr.street2,
      city: addr.city,
      region: addr.region,
      postalCode: addr.postalCode,
      isoCountry: row.country,
    });
    const order = await d.provider.createHostedOrder({
      phoneNumber: row.e164,
      contactPhoneNumber: contactPhone,
      addressSid: address.sid,
      email,
      friendlyName: `FieldQuo — ${companyId}`.slice(0, 64),
      smsUrl: webhookUrls(origin).sms,
      contactTitle: req(form.contactTitle, 60),
    });
    const mapped = mapHostedStatus(order.status, order.failureReason);
    const updated = await d.prisma.broughtNumber.update({
      where: { companyId },
      data: {
        ...base,
        addressSid: address.sid,
        providerOrderSid: order.sid,
        providerNumberSid: order.incomingPhoneNumberSid || null,
        providerStatus: order.status,
        status: mapped.status || "submitted",
        failureReason: mapped.reason,
        lastSyncedAt: now,
      },
    });
    return { ok: true, number: publicView(updated) };
  } catch (err) {
    await d.log({ area: "business_number", code: "hosted_start_failed", companyId, message: `Hosted SMS order refused: ${err?.message}`, detail: { e164: row.e164 } });
    return refuse(502, "provider_refused", `The carrier refused the request: ${err?.message || "unknown error"}. Nothing has been charged.`);
  }
}

/** The ownership call. Returns the code the person types when it rings. */
export async function startVerificationCall({ companyId, extension = null }, deps) {
  const d = defaults(deps);
  const row = await d.prisma.broughtNumber.findUnique({ where: { companyId } });
  if (!row || row.path !== "hosted_sms" || row.status !== "pending_verification") {
    return refuse(409, "not_ready", "The verification call isn't the next step for this number.");
  }
  if (row.simulated || (await d.isDemo(companyId))) {
    return { ok: true, simulated: true, code: "000000", number: publicView(row) };
  }
  try {
    const order = await d.provider.startVerificationCall(row.providerOrderSid, { extension: req(extension, 10) });
    const mapped = mapHostedStatus(order.status, order.failureReason);
    const updated = await d.prisma.broughtNumber.update({
      where: { companyId },
      data: {
        providerStatus: order.status,
        ...(mapped.status && canTransition(row.status, mapped.status) ? { status: mapped.status } : {}),
        lastSyncedAt: d.now(),
      },
    });
    // The code is read fresh from Twilio and returned, never stored: it is a
    // ten-minute secret and the screen is the only place it is needed.
    return { ok: true, code: order.verificationCode || null, number: publicView(updated) };
  } catch (err) {
    return refuse(502, "provider_refused", `The verification call couldn't be placed: ${err?.message || "unknown error"}.`);
  }
}

// ── 2b. Porting ─────────────────────────────────────────────────────────────

/** The three warnings the company must have acknowledged before a port. */
export const PORT_ACKS = Object.freeze(["approve_text_90_min", "timeline", "leaves_sim"]);

/**
 * Start moving the number.
 *
 * form: { holderName, customerType, email, accountNumber, pin, address, acks: [..],
 *         signature: { name, agreed } }
 * bill: { bytes: Uint8Array, filename, contentType } | null
 */
export async function startPort({ companyId, form = {}, bill = null, ip = null }, deps) {
  const d = defaults(deps);
  const row = await d.prisma.broughtNumber.findUnique({ where: { companyId } });
  if (!row || row.status !== "draft") return refuse(409, "not_draft", "Check the number first.");

  const holderName = req(form.holderName, 120);
  const email = req(form.email, 200);
  const customerType = form.customerType === "Individual" ? "Individual" : "Business";
  const accountNumber = req(form.accountNumber, 40);
  const pin = req(form.pin, 20);
  const { addr, missing } = cleanAddress(form.address, row.country);
  const acks = Array.isArray(form.acks) ? form.acks : [];
  const signedName = req(form.signature?.name, 120);
  const agreed = form.signature?.agreed === true;

  const problems = [];
  if (!holderName) problems.push("holderName");
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) problems.push("email");
  if (!accountNumber) problems.push("accountNumber");
  // A port-out PIN is mandatory for a mobile number (Twilio, and every
  // Canadian carrier); a landline may not have one.
  if (row.lineType === "mobile" && !pin) problems.push("pin");
  problems.push(...missing.map((m) => `address.${m}`));
  if (PORT_ACKS.some((a) => !acks.includes(a))) problems.push("acks");
  if (!signedName || !agreed) problems.push("signature");
  if (!bill?.bytes?.length) problems.push("bill");
  else if (bill.bytes.length > BILL_MAX_BYTES) problems.push("bill_size");
  else if (!BILL_TYPES.includes(String(bill.contentType || ""))) problems.push("bill_type");
  if (problems.length) {
    return refuse(400, "incomplete", "Some details are missing or need fixing.", { problems });
  }

  const now = d.now();
  const base = {
    path: "port",
    holderName,
    holderEmail: email,
    customerType,
    serviceAddress: addr,
    billName: req(bill.filename, 120),
    billType: bill.contentType,
    loaSignedName: signedName,
    loaSignedAt: now,
    loaSignedIp: req(ip, 64),
    submittedAt: now,
    expectedAt: expectedBy("port", now),
  };

  // ── A demo files nothing and KEEPS nothing ────────────────────────────────
  if (await d.isDemo(companyId)) {
    const updated = await d.prisma.broughtNumber.update({
      where: { companyId },
      data: { ...base, status: "carrier_processing", providerStatus: "simulated", submitChannel: "simulated", simulated: true },
    });
    return { ok: true, simulated: true, number: publicView(updated) };
  }

  if (!portSecretsConfigured()) {
    return refuse(503, "no_secret_key", "Moving a number isn't switched on yet — the account number and PIN need somewhere safe to be kept, and that isn't set up. There's nothing for you to do.");
  }
  if (!d.provider.twilioConfigured()) return refuse(503, "not_configured", "Bringing a number isn't switched on yet.");
  const short = await requireFirstMonth(d, companyId);
  if (short) return short;

  const secretValues = [accountNumber, pin].filter(Boolean);

  // ── Canada: there is no API — FieldQuo files it ───────────────────────────
  //
  // The secrets and the bill are sealed to this row and kept until the port
  // reaches a terminal state, because a person at FieldQuo has to read them
  // to file Twilio's form, and a carrier rejection is answered by re-filing.
  if (row.country === "CA") {
    const updated = await d.prisma.broughtNumber.update({
      where: { companyId },
      data: {
        ...base,
        status: "awaiting_filing",
        providerStatus: null,
        submitChannel: "twilio_form",
        accountNumberEnc: sealPortSecret(row.id, accountNumber),
        pinEnc: pin ? sealPortSecret(row.id, pin) : null,
        billEnc: sealPortSecret(row.id, Buffer.from(bill.bytes).toString("base64")),
        secretsPurgedAt: null,
      },
    });
    return { ok: true, number: publicView(updated, { secrets: { accountNumberHint: lastFour(accountNumber) } }) };
  }

  // ── United States: Twilio's Port In API ───────────────────────────────────
  //
  // The bill goes straight to Twilio and is never stored here; the account
  // number and PIN go in the request body and are never stored here either —
  // once Twilio holds them, FieldQuo has no further use for them, so the row
  // is written with nothing secret on it at all.
  try {
    const doc = await d.provider.uploadUtilityBill({ bytes: bill.bytes, filename: bill.filename, contentType: bill.contentType });
    const portIn = await d.provider.createPortIn({
      account_sid: process.env.TWILIO_ACCOUNT_SID || undefined,
      documents: [doc.sid],
      phone_numbers: [{ phone_number: row.e164, ...(pin ? { pin } : {}) }],
      losing_carrier_information: {
        customer_type: customerType,
        customer_name: holderName,
        account_number: accountNumber,
        account_telephone_number: row.e164,
        authorized_representative: signedName,
        authorized_representative_email: email,
        address: { street: addr.street, ...(addr.street2 ? { street_2: addr.street2 } : {}), city: addr.city, state: addr.region, zip: addr.postalCode, country: "US" },
      },
      notification_emails: [email],
    });
    const mapped = mapPortStatus(portIn.status, portIn.cancellationReason);
    const updated = await d.prisma.broughtNumber.update({
      where: { companyId },
      data: {
        ...base,
        status: mapped.status || "submitted",
        providerStatus: portIn.status,
        failureReason: mapped.reason,
        submitChannel: "twilio_api",
        providerOrderSid: portIn.sid,
        documentSid: doc.sid,
        lastSyncedAt: now,
        ...purgeData(now),
      },
    });
    return { ok: true, number: publicView(updated), signatureUrl: portIn.signatureRequestUrl || null };
  } catch (err) {
    await d.log({
      area: "business_number",
      code: "port_start_failed",
      companyId,
      // Twilio's message can echo what it was sent. Masked by value as well
      // as by field name — see lib/businessNumber/secrets.js.
      message: redactPortDetail(`US port-in refused: ${err?.message}`, secretValues),
      detail: redactPortDetail({ e164: row.e164, status: err?.status || null }, secretValues),
    });
    return refuse(502, "provider_refused", redactPortDetail(`The carrier refused the port request: ${err?.message || "unknown error"}. Nothing has been charged.`, secretValues));
  }
}

// ── 3. Cancel ───────────────────────────────────────────────────────────────

export async function cancelRequest({ companyId }, deps) {
  const d = defaults(deps);
  const row = await d.prisma.broughtNumber.findUnique({ where: { companyId } });
  if (!row) return refuse(404, "none", "There's no request to cancel.");
  if (row.status === "active") {
    return refuse(409, "active", "This number is already live in FieldQuo. Contact us to move it away — cancelling here would cut your clients off mid-conversation.");
  }
  if (isTerminal(row.status)) return { ok: true, number: publicView(row) };
  if (!row.simulated && row.providerOrderSid) {
    const cancel = row.path === "hosted_sms" ? d.provider.cancelHostedOrder : d.provider.cancelPortIn;
    await cancel(row.providerOrderSid).catch(async (err) => {
      await d.log({ area: "business_number", code: "cancel_failed", companyId, message: `Provider cancel failed: ${err?.message}`, detail: { sid: row.providerOrderSid } });
    });
  }
  const now = d.now();
  const updated = await d.prisma.broughtNumber.update({
    where: { companyId },
    data: { status: "cancelled", cancelledAt: now, ...purgeData(now) },
  });
  return { ok: true, number: publicView(updated) };
}

// ── 4. Keep the status honest ───────────────────────────────────────────────

/**
 * Ask the provider where a request is, and move the row. Never throws.
 *
 * @returns {{ changed, row, activated? }}
 */
export async function syncRequest(row, { origin }, deps) {
  const d = defaults(deps);
  if (!row || row.simulated || isTerminal(row.status) || ["draft"].includes(row.status)) {
    return { changed: false, row };
  }
  const now = d.now();
  let mapped = null;
  let providerStatus = row.providerStatus;
  let extra = {};
  try {
    if (row.path === "hosted_sms" && row.providerOrderSid) {
      const order = await d.provider.fetchHostedOrder(row.providerOrderSid);
      providerStatus = order.status;
      mapped = mapHostedStatus(order.status, order.failureReason);
      if (order.incomingPhoneNumberSid) extra.providerNumberSid = order.incomingPhoneNumberSid;
      // Verified, and no LOA yet: create it. Twilio emails it to the owner.
      if (order.status === "verified" && !order.signingDocumentSid && row.addressSid) {
        await d.provider.createAuthorizationDocument({
          addressSid: row.addressSid,
          email: row.holderEmail,
          contactPhoneNumber: row.contactPhone || row.e164,
          hostedNumberOrderSids: [row.providerOrderSid],
        });
      }
    } else if (row.path === "port" && row.submitChannel === "twilio_api" && row.providerOrderSid) {
      const portIn = await d.provider.fetchPortIn(row.providerOrderSid);
      providerStatus = portIn.status;
      mapped = mapPortStatus(portIn.status, portIn.cancellationReason || portIn.rejectionReason);
      if (portIn.portDate) extra.expectedAt = new Date(portIn.portDate);
    } else if (row.path === "port" && row.submitChannel === "twilio_form") {
      const filings = await d.prisma.portFiling.findMany({ where: { broughtNumberId: row.id }, orderBy: { createdAt: "asc" } });
      const filed = filings.some((f) => f.action === "filed" || f.action === "confirmed");
      // The number appearing in FieldQuo's own Twilio account is the one
      // fact that ends a Canadian port — read from Twilio, not from a note.
      const owned = filed ? await d.provider.findOwnedNumber(row.e164) : null;
      mapped = mapCanadianFiling(filings, { landed: Boolean(owned) });
      if (owned) extra.providerNumberSid = owned.sid;
      if (mapped.portDate) extra.expectedAt = new Date(mapped.portDate);
      providerStatus = owned ? "landed" : filings.length ? filings[filings.length - 1].action : null;
    }
  } catch (err) {
    await d.log({ area: "business_number", code: "sync_failed", companyId: row.companyId, message: `Status read failed: ${err?.message}`, detail: { path: row.path } });
    const touched = await d.prisma.broughtNumber.update({ where: { companyId: row.companyId }, data: { lastSyncedAt: now } });
    return { changed: false, row: touched };
  }

  const data = { ...extra, providerStatus, lastSyncedAt: now };
  if (mapped?.status && canTransition(row.status, mapped.status)) {
    data.status = mapped.status;
    data.failureReason = mapped.reason;
    if (secretsShouldBePurged(mapped.status)) Object.assign(data, purgeData(now));
  }
  let updated = await d.prisma.broughtNumber.update({ where: { companyId: row.companyId }, data });

  if (mapped?.completed) {
    const result = await activate(updated, { origin }, deps);
    return { changed: true, row: result.row, activated: result.ok };
  }
  return { changed: updated.status !== row.status, row: updated };
}

/**
 * The number has landed. Point it at FieldQuo, make it the company's sending
 * number, take the first month, and only then say `active`.
 */
export async function activate(row, { origin }, deps) {
  const d = defaults(deps);
  const now = d.now();
  if (!row || row.simulated) return { ok: false, row };
  if (row.status === "active") return { ok: true, row };
  const urls = webhookUrls(origin);
  try {
    let sid = row.providerNumberSid;
    if (!sid) sid = (await d.provider.findOwnedNumber(row.e164))?.sid || null;
    if (!sid) throw new Error("the number has not arrived from the carrier yet");
    await d.provider.wireNumber(sid, {
      smsUrl: urls.sms,
      // Calls only for a PORTED number — a hosted number's calls stay with
      // its carrier, and a voiceUrl there would be configuration nothing reads.
      ...(row.path === "port" ? { voiceUrl: urls.voice, voiceStatusUrl: urls.voiceStatus } : {}),
    });

    // The company's sending number — what clientSmsFrom() and the inbound
    // route resolve. Set only when it is empty or already this number: the
    // column is @unique and decides routing, and it is never silently moved.
    const company = await d.prisma.company.findUnique({ where: { id: row.companyId }, select: { smsFromNumber: true } });
    const conflict = company?.smsFromNumber && company.smsFromNumber !== row.e164;
    if (!conflict) {
      await d.prisma.company.update({ where: { id: row.companyId }, data: { smsFromNumber: row.e164 } });
    }

    // The first month. Debited even if it takes the balance below zero: the
    // number is the company's own business line now, and stranding it over
    // $4 would be far worse than the overdraft (see billRent()).
    const periodStart = now;
    await d.debit({
      companyId: row.companyId,
      cents: BROUGHT_NUMBER_MONTHLY_CENTS,
      kind: "brought_number_rent",
      ref: `brought_rent:${row.id}:${periodStart.toISOString().slice(0, 10)}`,
      note: `Business number ${row.e164} — first month`,
      prisma: d.prisma,
    });

    const updated = await d.prisma.broughtNumber.update({
      where: { companyId: row.companyId },
      data: {
        status: "active",
        providerNumberSid: sid,
        activatedAt: now,
        rentPaidThroughAt: new Date(now.getTime() + RENT_PERIOD_DAYS * 24 * 60 * 60 * 1000),
        failureReason: conflict ? "Your texts already go out from another FieldQuo number, so this one was connected but not made your sending number. Contact us to switch." : null,
        ...purgeData(now),
      },
    });
    return { ok: true, row: updated };
  } catch (err) {
    await d.log({ area: "business_number", code: "activate_failed", companyId: row.companyId, message: `Activation failed: ${err?.message}`, detail: { e164: row.e164, path: row.path } });
    // Not active, and the screen says why; the next sync retries.
    const updated = await d.prisma.broughtNumber.update({
      where: { companyId: row.companyId },
      data: { failureReason: `Almost there — connecting the number to FieldQuo failed (${err?.message}). We'll retry automatically.` },
    });
    return { ok: false, row: updated };
  }
}

/** The company's current request, synced when stale. For the settings screen. */
export async function loadForCompany({ companyId, origin, sync = true }, deps) {
  const d = defaults(deps);
  let row = await d.prisma.broughtNumber.findUnique({ where: { companyId } });
  if (row && sync && !row.simulated && !isTerminal(row.status) && row.status !== "draft") {
    const stale = !row.lastSyncedAt || d.now().getTime() - new Date(row.lastSyncedAt).getTime() > SYNC_STALE_MS;
    if (stale) row = (await syncRequest(row, { origin }, deps)).row;
  }
  const filings = row ? await d.prisma.portFiling.findMany({ where: { broughtNumberId: row.id }, orderBy: { createdAt: "asc" } }) : [];
  let accountNumberHint = null;
  if (row?.accountNumberEnc) {
    try {
      accountNumberHint = lastFour(openPortSecret(row.id, row.accountNumberEnc));
    } catch {
      accountNumberHint = null;
    }
  }
  return publicView(row, { filings, secrets: { accountNumberHint } });
}

// ── 5. Where calls ring ─────────────────────────────────────────────────────

export async function setForwarding({ companyId, forwardTo, ringSeconds, fallback }, deps) {
  const d = defaults(deps);
  const row = await d.prisma.broughtNumber.findUnique({ where: { companyId } });
  if (!row) return refuse(404, "none", "Bring a number in first.");
  if (row.path !== "port") {
    return refuse(400, "hosted_calls", "Calls to this number stay with your current phone provider, so there's nothing to forward here.");
  }
  const list = cleanForwardList((Array.isArray(forwardTo) ? forwardTo : []).map((n) => toE164(n)).filter(Boolean), { businessE164: row.e164 });
  const ring = Math.min(60, Math.max(5, Math.round(Number(ringSeconds) || 20)));
  const fb = fallback === "voicemail" ? "voicemail" : "receptionist";
  const updated = await d.prisma.broughtNumber.update({
    where: { companyId },
    data: { forwardTo: list, ringSeconds: ring, fallback: fb },
  });
  return { ok: true, number: publicView(updated) };
}

// ── 6. Monthly rent ─────────────────────────────────────────────────────────

/**
 * Charge one period's rent if it is due. Idempotent on the period's ref.
 *
 * ══ Never released for want of $4 ═══════════════════════════════════════════
 *
 * A bought receptionist number goes back to the carrier after a grace period
 * (lib/voice/spendGate.js rentDecision). A BROUGHT number must not: it is the
 * number on the company's van and in three years of invoices, and once
 * released it is gone for good. So the rent is debited even into a negative
 * balance — bounded at $4 a month — and the low-balance warnings the voice
 * side already sends do the chasing.
 */
export async function billRent(row, deps) {
  const d = defaults(deps);
  const now = d.now();
  if (!row || row.status !== "active" || row.simulated) return { charged: false, reason: "not_active" };
  const due = !row.rentPaidThroughAt || new Date(row.rentPaidThroughAt) <= now;
  if (!due) return { charged: false, reason: "not_due" };
  const periodStart = row.rentPaidThroughAt ? new Date(row.rentPaidThroughAt) : now;
  await d.debit({
    companyId: row.companyId,
    cents: BROUGHT_NUMBER_MONTHLY_CENTS,
    kind: "brought_number_rent",
    ref: `brought_rent:${row.id}:${periodStart.toISOString().slice(0, 10)}`,
    note: `Business number ${row.e164} — monthly`,
    prisma: d.prisma,
  });
  await d.prisma.broughtNumber.update({
    where: { companyId: row.companyId },
    data: { rentPaidThroughAt: new Date(periodStart.getTime() + RENT_PERIOD_DAYS * 24 * 60 * 60 * 1000) },
  });
  return { charged: true };
}

/** The live brought number for a company — what the call routes read. */
export async function activeBroughtNumber(companyId, prisma = db) {
  if (!companyId) return null;
  return prisma.broughtNumber.findFirst({ where: { companyId, status: "active", simulated: false } });
}

/** The live brought number that IS this E.164 — what an inbound call resolves. */
export async function broughtNumberByE164(e164, prisma = db) {
  if (!e164) return null;
  return prisma.broughtNumber.findFirst({ where: { e164, status: "active", simulated: false } });
}
