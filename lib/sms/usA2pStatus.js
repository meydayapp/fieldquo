// lib/sms/usA2pStatus.js
//
// Can this account text a US phone? Read from Twilio's A2P 10DLC resources,
// never assumed.
//
// ══ 2026-09-19: error 30034 ═══════════════════════════════════════════════
//
// SMdee05d4dbe71275b37619115d02fa9e6, from +17166383616 to a New York
// number: undelivered, error 30034 — "US A2P 10DLC: message from an
// unregistered number". Every text the account had delivered since
// 2026-09-10 went to +1 819 (Quebec); both it failed went to New York. US
// carriers refuse application-to-person traffic from a long-code number
// that is not attached to a registered campaign, and this account holds no
// Messaging Service, no brand registration and no campaign — checked
// through the API the night it was noticed. Canadian recipients are
// unaffected: 10DLC is a US-carrier regime.
//
// So: every FieldQuo Twilio number — the six sales numbers, the crew line,
// the system number +17162747905 — has its texts to US phones undelivered
// until a brand and a campaign exist and the numbers are in the campaign's
// Messaging Service. This module says which state each number is in, from
// the resources that decide it, so /platform/crew-lines can print
// "registered" or "NOT registered — texts to US numbers are undelivered
// (error 30034)" beside each one rather than leaving it to be discovered a
// message at a time.
//
// ══ What "registered" means here ══════════════════════════════════════════
//
// A number is registered for US A2P when it sits in a Messaging Service
// that has a US App-to-Person campaign whose status is VERIFIED (Twilio's
// `campaign_status`). A service with a campaign still IN_PROGRESS or
// FAILED does not carry US traffic yet, and the verdict says so in those
// words. Nothing here registers anything: that is the owner's, in the
// console, with the business's own details (see the steps on the page).
//
// ══ Pure verdict, separate read ═══════════════════════════════════════════
//
// usTextingVerdict() takes plain objects and is executed by
// scripts/check-sales-sms.mjs against every state. readUsA2pStatus() is the
// one that talks to the account, and it never throws: an unreachable
// Twilio is `twilioError` and every number `unknown`, not "not registered".
import { twilioRest, twilioConfigured } from "./twilioClient";

/** Twilio's own error for an unregistered US A2P sender. */
export const US_A2P_UNREGISTERED_ERROR = 30034;

/** Twilio's campaign_status that carries traffic. */
export const CAMPAIGN_VERIFIED = "VERIFIED";

/**
 * @param numbers   [{ e164, purpose? }] — FieldQuo's own numbers
 * @param services  [{ sid, friendlyName, phoneNumbers: [e164], campaigns: [{ sid, status, usecase }] }]
 * @param brands    [{ sid, status, brandType }]
 * @returns {{ registered: boolean|null, lines: [...], summary: string, brands, campaigns }}
 */
export function usTextingVerdict({ numbers = [], services = [], brands = [], asked = true } = {}) {
  const verifiedServices = services.filter((s) => (s.campaigns || []).some((c) => c?.status === CAMPAIGN_VERIFIED));
  const pendingServices = services.filter((s) => (s.campaigns || []).length > 0 && !verifiedServices.includes(s));
  const inService = (e164) => services.find((s) => (s.phoneNumbers || []).includes(e164)) || null;

  const lines = (Array.isArray(numbers) ? numbers : []).map((n) => {
    if (!asked) return { e164: n.e164, purpose: n.purpose || null, state: "unknown", serviceSid: null, text: "not checked — Twilio was not asked" };
    const svc = inService(n.e164);
    if (svc && verifiedServices.includes(svc)) {
      return { e164: n.e164, purpose: n.purpose || null, state: "registered", serviceSid: svc.sid, text: `registered — in ${svc.friendlyName || svc.sid}, campaign verified` };
    }
    if (svc && pendingServices.includes(svc)) {
      const c = (svc.campaigns || [])[0];
      return { e164: n.e164, purpose: n.purpose || null, state: "pending", serviceSid: svc.sid, text: `campaign ${c?.status || "pending"} — texts to US numbers are undelivered until it is VERIFIED` };
    }
    if (svc) {
      return { e164: n.e164, purpose: n.purpose || null, state: "not_registered", serviceSid: svc.sid, text: `in ${svc.friendlyName || svc.sid} with no campaign — texts to US numbers are undelivered (error ${US_A2P_UNREGISTERED_ERROR})` };
    }
    return { e164: n.e164, purpose: n.purpose || null, state: "not_registered", serviceSid: null, text: `NOT registered — texts to US numbers are undelivered (error ${US_A2P_UNREGISTERED_ERROR})` };
  });

  const counts = {
    registered: lines.filter((l) => l.state === "registered").length,
    pending: lines.filter((l) => l.state === "pending").length,
    notRegistered: lines.filter((l) => l.state === "not_registered").length,
    unknown: lines.filter((l) => l.state === "unknown").length,
  };
  let registered = null;
  if (asked) registered = lines.length > 0 && counts.registered === lines.length;

  let summary;
  if (!asked) summary = "Twilio was not asked, so nothing here is a verdict.";
  else if (lines.length === 0) summary = "No numbers to check.";
  else if (registered) summary = `US texting: registered — all ${lines.length} numbers are in a Messaging Service with a verified A2P 10DLC campaign.`;
  else if (brands.length === 0 && services.length === 0)
    summary = `US texting: NOT registered — this account has no A2P 10DLC brand, no campaign and no Messaging Service. Every text from any FieldQuo number to a US phone is undelivered with error ${US_A2P_UNREGISTERED_ERROR}. Canadian recipients are unaffected.`;
  else
    summary = `US texting: ${counts.registered} of ${lines.length} numbers registered${counts.pending ? `, ${counts.pending} pending` : ""}, ${counts.notRegistered} not registered — texts from those to US phones are undelivered with error ${US_A2P_UNREGISTERED_ERROR}. Canadian recipients are unaffected.`;

  return {
    registered,
    lines,
    counts,
    summary,
    brands: (Array.isArray(brands) ? brands : []).map((b) => ({ sid: b.sid, status: b.status || null, brandType: b.brandType || null })),
    campaigns: services.flatMap((s) => (s.campaigns || []).map((c) => ({ sid: c.sid, status: c.status || null, usecase: c.usecase || null, serviceSid: s.sid }))),
    services: services.map((s) => ({ sid: s.sid, friendlyName: s.friendlyName || null, phoneNumbers: s.phoneNumbers || [] })),
  };
}

/**
 * The read. `numbers` are the account's own numbers (already listed by the
 * caller, or listed here when omitted).
 */
export async function readUsA2pStatus({ twilio = twilioRest, numbers = null } = {}) {
  if (!twilioConfigured()) {
    return { ...usTextingVerdict({ numbers: numbers || [], asked: false }), twilioError: "Twilio credentials are not set on this deployment, so the carrier could not be asked.", checkedAt: new Date() };
  }
  try {
    const own =
      numbers ||
      (await twilio.incomingPhoneNumbers.list({ limit: 200 })).map((n) => ({ e164: n.phoneNumber, purpose: n.friendlyName || null }));
    const serviceList = await twilio.messaging.v1.services.list({ limit: 50 });
    const services = [];
    for (const s of serviceList || []) {
      // eslint-disable-next-line no-await-in-loop
      const phones = await twilio.messaging.v1.services(s.sid).phoneNumbers.list({ limit: 200 });
      // eslint-disable-next-line no-await-in-loop
      const campaigns = await twilio.messaging.v1.services(s.sid).usAppToPerson.list({ limit: 20 });
      services.push({
        sid: s.sid,
        friendlyName: s.friendlyName || null,
        phoneNumbers: (phones || []).map((p) => p.phoneNumber),
        campaigns: (campaigns || []).map((c) => ({ sid: c.sid, status: c.campaignStatus || null, usecase: c.usAppToPersonUsecase || null })),
      });
    }
    const brandList = await twilio.messaging.v1.brandRegistrations.list({ limit: 20 });
    const brands = (brandList || []).map((b) => ({ sid: b.sid, status: b.status || null, brandType: b.brandType || null }));
    return { ...usTextingVerdict({ numbers: own, services, brands, asked: true }), twilioError: null, checkedAt: new Date() };
  } catch (err) {
    return {
      ...usTextingVerdict({ numbers: numbers || [], asked: false }),
      twilioError: `Twilio could not be asked just now (${err?.status || err?.message || "no status"}). Nothing here is a verdict.`,
      checkedAt: new Date(),
    };
  }
}
