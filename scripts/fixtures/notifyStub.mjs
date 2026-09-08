// scripts/fixtures/notifyStub.mjs
//
// Records calls to `@/lib/billing/notify` instead of sending mail. The real
// module resolves the platform sender, reads the company, builds HTML and
// talks to Resend; none of that is what a plan-change check is about. What it
// IS about is WHEN the "your plan changed" note fires — at the moment the
// switch lands, not when it was booked — and that is a question of whether
// this function was called, with which company, how many times.

export const notifyCalls = [];
export const cancellationCalls = [];

export function resetNotifyStub() {
  notifyCalls.length = 0;
  cancellationCalls.length = 0;
}

export async function notifySubscriptionState(companyId, request) {
  notifyCalls.push({ companyId, request: request ?? null });
  return { sent: true, kind: "changed" };
}

export async function notifyCancellation(companyId, request, opts = {}) {
  cancellationCalls.push({ companyId, ...opts });
  return { sent: true };
}
