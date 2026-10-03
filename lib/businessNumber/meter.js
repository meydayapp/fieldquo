// lib/businessNumber/meter.js
//
// Charging texts and call minutes on a brought number to the phone balance.
//
// Its own small file, importing only the ledger and the prices, because
// lib/sms/twilioClient.js's sendSms reaches it on every successful send — and
// sendSms is imported by half the product. Anything heavier here (the inbox,
// the lead capture) would put a circular import under every text FieldQuo
// sends.
//
// ══ Floor now, carrier price × 2 later (owner, 2026-10-03) ══════════════════
//
// Each charge here is the FLOOR (lib/phoneUsage/pricing.js), taken the moment
// the text or call happens, and is queued for settlement: once Twilio rates
// the record, lib/phoneUsage/settle.js tops it up to twice Twilio's price when
// that is more. The same mechanism settles crew texts (lib/crew/messaging.js).
//
// Every charge is idempotent on the provider's own id (MessageSid / CallSid)
// through debitCredit's unique ref, so a webhook Twilio retries charges once.

import { db } from "@/lib/db";
import { debitCredit } from "@/lib/voice/credits";
import { textCents, callCents, BUSINESS_CALL_CENTS_PER_MINUTE, TEXT_CENTS, smsSegments } from "./costs";
import { enqueueUsage, countryOfE164 } from "@/lib/phoneUsage/settle";

const tail4 = (p) => String(p || "").replace(/\D/g, "").slice(-4);

/** Charge one text on a brought number (the floor), and queue it for settlement. */
export async function meterText({ companyId, direction, messageSid, body = "", hasMedia = false, party = null }, debit = debitCredit, enqueue = enqueueUsage) {
  const cents = textCents({ body, hasMedia });
  if (!companyId || !messageSid || cents <= 0) return null;
  const tail = tail4(party);
  const segments = Math.round(cents / TEXT_CENTS);
  const ref = `brought_${direction === "out" ? "out" : "in"}:${messageSid}`;
  const entry = await debit({
    companyId,
    cents,
    kind: "brought_text",
    ref,
    note: `${direction === "out" ? "Text sent" : "Text received"} on business number${tail ? ` ·${tail}` : ""} — ${hasMedia ? `${cents}¢` : segments > 1 ? `${segments} × ${TEXT_CENTS}¢` : `${TEXT_CENTS}¢`}`,
  });
  await enqueue({
    companyId, sid: messageSid, resource: "message", direction: direction === "out" ? "out" : "in",
    ledgerKind: "brought_text", ledgerRef: ref, provisionalCents: cents,
    units: hasMedia ? 1 : Math.min(10, smsSegments(body)), hasMedia, country: countryOfE164(party),
  }).catch(() => null);
  return entry;
}

/** Charge one connected call (the floor), and queue it for settlement. */
export async function meterCall({ companyId, callSid, seconds, direction = "in", party = null }, debit = debitCredit, enqueue = enqueueUsage) {
  const cents = callCents(seconds);
  if (!companyId || !callSid || cents <= 0) return null;
  const tail = tail4(party);
  const ref = `brought_call:${callSid}`;
  const minutes = Math.ceil(Number(seconds) / 60);
  const entry = await debit({
    companyId,
    cents,
    kind: "brought_call",
    ref,
    note: `${direction === "out" ? "Call placed" : "Call forwarded"} on business number${tail ? ` ·${tail}` : ""} — ${minutes} min @ ${BUSINESS_CALL_CENTS_PER_MINUTE}¢`,
  });
  await enqueue({
    companyId, sid: callSid, resource: "call", direction: direction === "out" ? "out" : "in",
    ledgerKind: "brought_call", ledgerRef: ref, provisionalCents: cents, units: minutes, country: countryOfE164(party),
  }).catch(() => null);
  return entry;
}

/**
 * sendSms's hook: if this text left from the company's own brought number,
 * charge it. A text from the shared system number is not metered — that is
 * FieldQuo's line, and nothing about this feature changes what it costs.
 * Never throws: a billing hiccup must not turn a delivered text into an error.
 */
export async function meterOutboundIfBrought({ companyId, from, to, body, sid }, { prisma = db, debit = debitCredit } = {}) {
  try {
    if (!companyId || !from || !sid) return null;
    const row = await prisma.broughtNumber.findFirst({
      where: { companyId, e164: from, status: "active", simulated: false },
      select: { id: true },
    });
    if (!row) return null;
    return await meterText({ companyId, direction: "out", messageSid: sid, body, party: to }, debit);
  } catch (err) {
    console.error("[business-number] outbound text not metered:", err?.message);
    return null;
  }
}
