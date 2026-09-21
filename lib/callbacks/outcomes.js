// lib/callbacks/outcomes.js
//
// What a call ended in. Six outcomes, and what each one changes:
//
//   booked          "Booked" opens a quote for the client (the same door a
//                   lead goes through); the row links to it once it exists
//   call_back       they said when — `callBackOn` keeps them off every list
//                   until that date, then they come round again
//   not_now         a soft no; the ordinary dormancy window applies
//   not_interested  a firm no; kept off lists for twelve months
//   wrong_number    the phone on file is wrong; the row says so and the
//                   client page shows it
//   do_not_contact  sets Client.doNotContactAt AND opts the number out of
//                   the voice agent's consent ledger (lib/voice/outbound.js
//                   optOut) — one wish, recorded in both places that ring
//                   people, never cleared by code
//
// Pure validation here; the route applies it.

export const OUTCOMES = ["booked", "call_back", "not_now", "not_interested", "wrong_number", "do_not_contact"];

export function normaliseOutcome(input = {}) {
  const outcome = OUTCOMES.includes(input.outcome) ? input.outcome : null;
  if (!outcome) return { error: "outcome must be one of " + OUTCOMES.join(", ") };
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : "";
  let callBackOn = null;
  if (outcome === "call_back") {
    const m = typeof input.callBackOn === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.callBackOn);
    if (!m) return { error: "call_back needs a callBackOn date (YYYY-MM-DD)" };
    callBackOn = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (Number.isNaN(callBackOn.getTime()) || callBackOn.getUTCMonth() !== Number(m[2]) - 1) return { error: "callBackOn is not a real date" };
  }
  return { outcome, note, callBackOn };
}
