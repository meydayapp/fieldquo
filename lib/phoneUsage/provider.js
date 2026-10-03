// lib/phoneUsage/provider.js
//
// Reading what Twilio charged FieldQuo for a message or a call — the `price`
// Twilio writes onto the record once it is rated. Through the one existing
// client (lib/sms/twilioClient.js); settle.js takes this module as a
// dependency so the checks never reach live Twilio.
//
// Twilio reports price as a negative decimal string in `priceUnit` (USD on
// FieldQuo's account), null until it has been rated. Null is returned as null
// — "not known yet" — never as zero, which would read as "free" and settle at
// the floor for the wrong reason.

import { twilioRest } from "@/lib/sms/twilioClient";
import { priceToMicros } from "./pricing";

/** A message's price in micros, or null while Twilio has not rated it. */
export async function messageCostMicros(sid) {
  const m = await twilioRest.messages(sid).fetch();
  return priceToMicros(m?.price);
}

/**
 * A call's price in micros: the call itself AND every leg it dialled (a
 * forwarded call's <Dial> to the contractor's cell, the receptionist hand-off,
 * the call button's leg to the client) — each leg is its own Twilio record
 * with its own price. Null until every leg that connected has been rated.
 */
export async function callCostMicros(sid) {
  const parent = await twilioRest.calls(sid).fetch();
  const parentCost = priceToMicros(parent?.price);
  if (parentCost === null) return null;
  const children = await twilioRest.calls.list({ parentCallSid: sid, limit: 20 });
  let total = parentCost;
  for (const c of children || []) {
    const cost = priceToMicros(c?.price);
    // A leg that never connected has no price and costs nothing.
    if (cost === null) {
      if (c?.status === "completed" && Number(c?.duration) > 0) return null;
      continue;
    }
    total += cost;
  }
  return total;
}
