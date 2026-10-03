// lib/businessNumber/provider.js
//
// Every Twilio call "Bring your number" makes, and nothing else.
//
// ══ Behind the existing client, never a second one ═════════════════════════
//
// All of it goes through `twilioRest` from lib/sms/twilioClient.js — the one
// place that knows how FieldQuo's Twilio credentials are assembled — plus
// twilioBasicAuth() from the same file for the single endpoint the SDK does
// not wrap (the bill upload). lib/businessNumber/store.js takes this module as
// an injectable dependency, so scripts/check-bring-your-number.mjs drives the
// whole flow against a fake and never reaches live Twilio.
//
// ══ What is automatable, by Twilio's own documentation (2026-10-03) ════════
//
//   Lookup line type      lookups v2, field line_type_intelligence. US + CA.
//   Hosted SMS            numbers v2 HostedNumber/Orders + AuthorizationDocuments.
//                         US + CA, landline and toll-free only. The ownership
//                         call and the LOA e-signature (HelloSign) are
//                         Twilio's own flow; we start them and read status.
//   Port in, US           numbers v1 Porting/PortIn. "Country available: United
//                         States". Utility bill uploaded to numbers-upload as a
//                         document; LOA e-signature emailed by Twilio to the
//                         authorized representative.
//   Port in, Canada       NO API. Twilio's Canadian porting guideline sends
//                         local and mobile numbers through its international
//                         porting form (twlo.my.salesforce-sites.com/
//                         InternationalPorting), with an LOA dated within 30
//                         days, a recent bill, the account number and PIN.
//                         FieldQuo staff file it from /platform/business-numbers;
//                         nothing in this file pretends to.

import { twilioRest, twilioBasicAuth, twilioConfigured } from "@/lib/sms/twilioClient";

export { twilioConfigured };

/** Lookup v2 with line type intelligence. Returns the plain fields classifyNumber reads. */
export async function lookupLineType(e164) {
  const r = await twilioRest.lookups.v2.phoneNumbers(e164).fetch({ fields: "line_type_intelligence" });
  return {
    countryCode: r?.countryCode || null,
    valid: r?.valid !== false,
    lineTypeIntelligence: r?.lineTypeIntelligence
      ? {
          type: r.lineTypeIntelligence.type || null,
          carrierName: r.lineTypeIntelligence.carrier_name || r.lineTypeIntelligence.carrierName || null,
          errorCode: r.lineTypeIntelligence.error_code ?? r.lineTypeIntelligence.errorCode ?? null,
        }
      : null,
  };
}

/** The owner's address, as a Twilio Address resource (hosted orders reference it by sid). */
export async function createAddress({ customerName, street, street2, city, region, postalCode, isoCountry }) {
  const a = await twilioRest.addresses.create({
    customerName,
    street,
    ...(street2 ? { streetSecondary: street2 } : {}),
    city,
    region,
    postalCode,
    isoCountry,
    friendlyName: `Hosted SMS — ${customerName}`.slice(0, 64),
  });
  return { sid: a.sid };
}

export async function createHostedOrder({ phoneNumber, contactPhoneNumber, addressSid, email, friendlyName, smsUrl, contactTitle }) {
  const o = await twilioRest.numbers.v2.hostedNumberOrders.create({
    phoneNumber,
    contactPhoneNumber,
    addressSid,
    email,
    friendlyName,
    smsCapability: true,
    smsUrl,
    smsMethod: "POST",
    ...(contactTitle ? { contactTitle } : {}),
  });
  return shapeHostedOrder(o);
}

export async function fetchHostedOrder(sid) {
  return shapeHostedOrder(await twilioRest.numbers.v2.hostedNumberOrders(sid).fetch());
}

/** Ask Twilio to place the ownership call to the number. */
export async function startVerificationCall(sid, { extension = null } = {}) {
  const o = await twilioRest.numbers.v2.hostedNumberOrders(sid).update({
    status: "pending-verification",
    verificationCallDelay: 10,
    ...(extension ? { verificationCallExtension: String(extension) } : {}),
  });
  return shapeHostedOrder(o);
}

/** The LOA, after verification. Twilio emails it to `email` for e-signature. */
export async function createAuthorizationDocument({ addressSid, email, contactPhoneNumber, hostedNumberOrderSids, contactTitle }) {
  const d = await twilioRest.numbers.v2.authorizationDocuments.create({
    addressSid,
    email,
    contactPhoneNumber,
    hostedNumberOrderSids,
    ...(contactTitle ? { contactTitle } : {}),
  });
  return { sid: d.sid, status: d.status || null };
}

export async function cancelHostedOrder(sid) {
  return twilioRest.numbers.v2.hostedNumberOrders(sid).remove();
}

function shapeHostedOrder(o) {
  return {
    sid: o?.sid || null,
    status: o?.status || null,
    failureReason: o?.failureReason || null,
    incomingPhoneNumberSid: o?.incomingPhoneNumberSid || null,
    signingDocumentSid: o?.signingDocumentSid || null,
    verificationCode: o?.verificationCode || null,
    verificationAttempts: o?.verificationAttempts ?? null,
  };
}

/**
 * Upload the phone bill for a US port-in. Multipart, so a raw fetch — the SDK
 * has no wrapper for numbers-upload. Returns { sid }.
 */
export async function uploadUtilityBill({ bytes, filename, contentType }) {
  const auth = twilioBasicAuth();
  if (!auth) throw new Error("Twilio credentials are not configured.");
  const form = new FormData();
  form.set("document_type", "utility_bill");
  form.set("friendly_name", String(filename || "bill").slice(0, 64));
  form.set("File", new Blob([bytes], { type: contentType || "application/pdf" }), filename || "bill.pdf");
  const res = await fetch("https://numbers-upload.twilio.com/v1/Documents", {
    method: "POST",
    headers: { Authorization: auth },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.sid) {
    const err = new Error(json?.message || `Document upload refused (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return { sid: json.sid };
}

/** Create a US port-in request. `payload` is Twilio's snake_case body, built by the store. */
export async function createPortIn(payload) {
  const r = await twilioRest.numbers.v1.portingPortIns.create(payload);
  return shapePortIn(r);
}

export async function fetchPortIn(sid) {
  return shapePortIn(await twilioRest.numbers.v1.portingPortIns(sid).fetch());
}

export async function cancelPortIn(sid) {
  return twilioRest.numbers.v1.portingPortIns(sid).remove();
}

function shapePortIn(r) {
  const n = Array.isArray(r?.phoneNumbers) ? r.phoneNumbers[0] : null;
  return {
    sid: r?.portInRequestSid || null,
    status: r?.portInRequestStatus || null,
    cancellationReason: r?.orderCancellationReason || null,
    signatureRequestUrl: r?.signatureRequestUrl || null,
    portDate: n?.portDate || n?.port_date || null,
    rejectionReason: n?.rejectionReason || n?.rejection_reason || null,
    notPortableReason: n?.notPortabilityReason || n?.not_portability_reason || null,
  };
}

/** Is this number in FieldQuo's Twilio account now? `{ sid }` or null. */
export async function findOwnedNumber(e164) {
  const rows = await twilioRest.incomingPhoneNumbers.list({ phoneNumber: e164, limit: 1 });
  const row = rows?.[0];
  return row ? { sid: row.sid, sms: Boolean(row.capabilities?.sms), voice: Boolean(row.capabilities?.voice) } : null;
}

/**
 * Point the number at FieldQuo. Texts always; calls only when the number is
 * ours for calls (a port) — a hosted number's voice stays with its carrier
 * and setting a voiceUrl there would be a setting nothing ever calls.
 */
export async function wireNumber(sid, { smsUrl, voiceUrl = null, voiceStatusUrl = null }) {
  return twilioRest.incomingPhoneNumbers(sid).update({
    smsUrl,
    smsMethod: "POST",
    ...(voiceUrl ? { voiceUrl, voiceMethod: "POST" } : {}),
    ...(voiceStatusUrl ? { statusCallback: voiceStatusUrl, statusCallbackMethod: "POST" } : {}),
  });
}

/**
 * A voicemail's audio, fetched server-side with FieldQuo's credentials — a
 * Twilio recording URL needs them, and handing the browser a credentialed URL
 * would be handing out the account. Returns a fetch Response (mp3).
 */
export async function fetchRecordingAudio(recordingSid) {
  const auth = twilioBasicAuth();
  const account = process.env.TWILIO_ACCOUNT_SID;
  if (!auth || !account) throw new Error("Twilio credentials are not configured.");
  if (!/^RE[0-9a-f]{32}$/i.test(String(recordingSid || ""))) throw new Error("Not a recording id.");
  return fetch(`https://api.twilio.com/2010-04-01/Accounts/${account}/Recordings/${recordingSid}.mp3`, {
    headers: { Authorization: auth },
  });
}

/** Leg one of the call button: ring the contractor's phone, from the business number. */
export async function placeBridgeCall({ to, from, url, statusCallback }) {
  const c = await twilioRest.calls.create({
    to,
    from,
    url,
    method: "POST",
    statusCallback,
    statusCallbackMethod: "POST",
    statusCallbackEvent: ["completed"],
    timeout: 25,
  });
  return { sid: c.sid };
}
