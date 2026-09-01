// scripts/fixtures/emailStub.mjs
//
// A scriptable stand-in for lib/email/resend.js, used only by check scripts
// that redirect "@/lib/email/resend" to this file (see
// scripts/check-consent-mechanisms.mjs's campaign-send tests).
//
// Real lib/email/resend.js already no-ops (skips, logs, returns no error)
// when RESEND_API_KEY isn't set — which is enough to execute a send path
// without hitting the network. It is NOT enough to assert "this specific
// recipient was never mailed twice", because that no-op path doesn't record
// anything a check can inspect afterwards. `sent` is that record: every call,
// in order, so a check can count how many times any given address was
// actually handed to "Resend" — the real anti-double-send property, as
// opposed to the delivery-ledger bookkeeping being merely self-consistent.
export const sent = [];

// Addresses that should come back as a Resend-reported failure (a bounce, an
// invalid address) rather than a network/DB death — the other way a send can
// fail, and the one that has to release its claim WITHOUT counting as an
// attempt-that-might-have-gone-through, unlike a `failNext`-style DB outage.
export const failFor = new Set();

export const SENDER_SELECT = {};

export async function sendEmail({ to, subject }) {
  if (failFor.has(to)) return { error: { message: "stubbed bounce" } };
  sent.push({ to, subject });
  return {};
}

export function resetEmailStub() {
  sent.length = 0;
  failFor.clear();
}
