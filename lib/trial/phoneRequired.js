// lib/trial/phoneRequired.js
//
// The browser half of lib/trial/phoneGate.js — the same shape as
// lib/signup/planRequired.js, for the same reason its header gives: a refused
// spend during a card-free trial must open the way through (verify a mobile),
// not die in a toast. One listener, app/components/PhoneVerifyPrompt.js,
// mounted once in app/app/layout.js; lib/clientErrors.js and lib/fetchJson.js
// dispatch to it, so no call site has to be wired by hand.
//
// No imports on purpose: lib/fetchJson.js is reached from server code and
// check scripts as well as the browser.

export const PHONE_REQUIRED_EVENT = "fieldquo:phone-required";
export const PHONE_REQUIRED_CODE = "phone_verification_required";

/** The `phoneVerification` payload of a refusal, or null. Both halves demanded. */
export function phoneRequiredPayload(status, data) {
  if (status !== 403) return null;
  if (data?.code !== PHONE_REQUIRED_CODE) return null;
  const payload = data?.phoneVerification;
  if (!payload || typeof payload !== "object") return null;
  return { ...payload, message: data?.error || null };
}

/** Opens the prompt. A no-op outside a browser. */
export function showPhoneRequired(payload) {
  if (typeof window === "undefined" || !payload) return;
  window.dispatchEvent(new CustomEvent(PHONE_REQUIRED_EVENT, { detail: payload }));
}

/** true when this was the trial phone gate and the prompt has been opened. */
export function phoneRequiredFrom(status, data) {
  const payload = phoneRequiredPayload(status, data);
  if (!payload) return false;
  showPhoneRequired(payload);
  return true;
}
