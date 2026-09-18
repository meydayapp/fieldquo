// lib/leads/callbackRequest.js
//
// The "this doesn't look right → request a call back" payload, cleaned.
// Pure, so scripts/check-lawn-care.mjs can run the hostile cases — an empty
// phone, a phone of letters, a 10 KB note, a preferred time that is not one
// of the four — without a database. app/api/instant-quote/[slug]/callback
// is the only caller and does nothing to the body this does not.

import { CALLBACK_TIMES } from "@/lib/i18n/lawnEstimateCopy";
import { tradeLabel } from "@/lib/estimate/instantQuoteServer";

const clean = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Seven digits or more once the dashes and spaces are gone — a number a
 *  human can dial. Length only: the form formats NANP numbers, but a
 *  homeowner on a UK phone is not refused for it. */
export function dialable(phone) {
  return /\d{7,}/.test(String(phone || "").replace(/\D/g, ""));
}

/**
 * @returns {{ ok: true, request }} | {{ ok: false, reason: "no_phone" }}
 */
export function cleanCallbackRequest(body) {
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const phone = clean(b.phone, 40);
  if (!dialable(phone)) return { ok: false, reason: "no_phone" };
  const preferredTime = CALLBACK_TIMES.includes(b.preferredTime) ? b.preferredTime : "anytime";
  const note = clean(b.note, 600);
  const address = clean(b.address, 300);
  const trade = clean(b.trade, 40);
  const summary = clean(b.measurementSummary, 200);
  const quoteId = clean(b.quoteId, 40) || null;
  return {
    ok: true,
    request: {
      name: clean(b.name, 120),
      phone,
      preferredTime,
      note,
      address,
      trade,
      summary,
      quoteId,
      details: {
        callbackPreferredTime: preferredTime,
        ...(note && { callbackNote: note }),
        ...(summary && { measurementShown: summary }),
        ...(trade && { trade }),
      },
      message: [
        `CALL BACK REQUESTED — the homeowner says the measurement doesn't look right (${preferredTime}).`,
        summary ? `Shown: ${summary}` : null,
        note ? `Their note: ${note}` : null,
        address || null,
        trade ? `Instant estimate — ${tradeLabel(trade)}` : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  };
}
