// lib/trial/phoneGate.js
//
// A free trial verifies a mobile number before it spends FieldQuo's money.
//
// ══ Why (owner-approved cost saver, 2026-10-03) ═════════════════════════════
//
// Since 2026-09-24 a trial needs no card. That made signing up free for a
// contractor — and free for anyone who wants FieldQuo to pay for their texts,
// a phone line with ~US$10.50 of starter credit (lib/voice/credits.js
// grantFreeTrial), outbound AI calls, video processing on Cloudinary, or a
// bulk email blast on FieldQuo's sending reputation. A throwaway email address
// costs nothing to make; a mobile number that can receive a text costs a SIM.
// So during a card-free trial, the features below ask for one verified mobile
// first. Everything else in the trial — quotes, jobs, invoices, the website,
// the AI tools inside their allowance — is untouched.
//
// ══ Who is asked ════════════════════════════════════════════════════════════
//
//   - ONLY a card-free trial: accessForCompany's reason "trial_no_plan" (a
//     company with no Subscription row and a trialEndsAt in the future). A
//     company on any subscription — paying, trialing with a card, past due,
//     cancelled — is never asked. Paid companies are unaffected.
//   - Never a demo fixture (isDemo — it simulates its sends anyway).
//   - Never when FieldQuo cannot actually deliver the code to that company's
//     country (see deliveryPathFor): a gate nobody can pass is a dead control,
//     so it stands aside and says why ("no_delivery_path") rather than lock a
//     US trial out of texting forever.
//
// ══ What is gated — the list the owner named, checked against lib ══════════
//
// Each key is checked at the route (or the one send function) that spends:
//   sms              lib/sms/twilioClient.js sendSms (every tenant text)
//   phone_number     POST /api/settings/voice/number (a line + starter credit)
//   crew_line        POST /api/crew/line action "buy"
//   business_number  POST /api/settings/business-number "hosted", and /port
//   ai_call          POST /api/quotes/[id]/call (the AI rings a client)
//   video_post       POST /api/marketing/video-posts (Cloudinary processing)
//   email_campaign   POST /api/marketing/campaigns/[id]/send (bulk email)
// The AI voice receptionist answers on a number, so it is behind phone_number.
// FieldQuo-paid AI (copilot, receipts, translation — lib/ai/featurePayer.js)
// is NOT here: each already has a per-company ceiling (fair use / daily cap),
// and the copilot is the trial's own demonstration.
import { db } from "@/lib/db";
import { accessForCompany } from "@/lib/billing/access";

export const VERIFY_PHONE_PATH = "/app/settings/verify-phone";

export const PHONE_GATED_FEATURES = Object.freeze({
  sms: "sending text messages",
  phone_number: "getting a phone number or the AI receptionist",
  crew_line: "buying a crew texting line",
  business_number: "bringing your own number",
  ai_call: "having the AI call a client",
  video_post: "making video posts",
  email_campaign: "sending an email campaign",
});

export const PHONE_REQUIRED_CODE = "phone_verification_required";

/**
 * Must this company verify a phone before `feature`? PURE.
 *
 * @param access        accessForCompany's answer ({ reason })
 * @param company       { isDemo, trialPhoneVerifiedAt }
 * @param deliveryPath  "sms" | "verify" | null — can a code reach them at all
 * @returns {{ required: boolean, reason: string }}
 */
export function phoneGateVerdict({ access, company, deliveryPath }) {
  if (!company) return { required: false, reason: "no_company" };
  if (company.isDemo) return { required: false, reason: "demo" };
  // Only the card-free trial. Every other billing state has either paid or
  // put a card down, and the gate is about strangers spending for free.
  if (access?.reason !== "trial_no_plan") return { required: false, reason: "not_trial" };
  if (company.trialPhoneVerifiedAt) return { required: false, reason: "verified" };
  if (!deliveryPath) return { required: false, reason: "no_delivery_path" };
  return { required: true, reason: "unverified" };
}

/**
 * How a code would reach this company, or null when it can't. Asked lazily:
 * it may read Twilio (the A2P registration of the system number, cached ten
 * minutes in lib/demo/simulatedSpend.js), and that read is only worth making
 * for an unverified card-free trial.
 *
 *   Not the US  → "sms": FieldQuo's own system number (US$0.0083 a text).
 *   US          → "sms" if the system number is A2P-registered for US
 *                 texting; else "verify" (Twilio Verify, its own registered
 *                 senders) when TWILIO_VERIFY_SERVICE_SID is set; else null.
 *
 * `deps` are seams for the check script.
 */
export async function deliveryPathFor(company, deps = {}) {
  const configured = deps.twilioConfigured || (await import("@/lib/sms/twilioClient")).twilioConfigured;
  if (!configured()) return null;
  const country = String(company?.country || "CA").toUpperCase();
  if (country !== "US") return "sms";
  const textsUs = deps.systemNumberTextsUs || (await usRegistrationReader());
  if (await textsUs().catch(() => false)) return "sms";
  const verifySid = deps.verifyServiceSid !== undefined ? deps.verifyServiceSid : process.env.TWILIO_VERIFY_SERVICE_SID;
  return verifySid ? "verify" : null;
}

async function usRegistrationReader() {
  const [{ systemSmsNumber }, { systemNumberTextsUs }] = await Promise.all([
    import("@/lib/sms/systemNumber"),
    import("@/lib/demo/simulatedSpend"),
  ]);
  return async () => {
    const e164 = await systemSmsNumber();
    return e164 ? systemNumberTextsUs(e164) : false;
  };
}

export const COMPANY_PHONE_SELECT = {
  id: true,
  isDemo: true,
  country: true,
  trialPhoneE164: true,
  trialPhoneVerifiedAt: true,
};

/**
 * The gate, against the database. Returns the verdict plus what a screen needs.
 * `access` may be passed when the caller already has it (getCurrentMember's
 * billingAccess) to save the Subscription read.
 */
export async function trialPhoneGate(companyId, { access = null, prisma = db, deps = {} } = {}) {
  if (!companyId) return { required: false, reason: "no_company" };
  const resolvedAccess = access || (await (deps.accessForCompany || accessForCompany)(companyId));
  // Cheap exits first: a paying company never reads the company row for this.
  if (resolvedAccess?.reason !== "trial_no_plan") return { required: false, reason: "not_trial" };
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: COMPANY_PHONE_SELECT });
  if (!company || company.isDemo || company.trialPhoneVerifiedAt) {
    return { ...phoneGateVerdict({ access: resolvedAccess, company, deliveryPath: "sms" }), company };
  }
  const deliveryPath = await deliveryPathFor(company, deps);
  return { ...phoneGateVerdict({ access: resolvedAccess, company, deliveryPath }), deliveryPath, company };
}

/** The refusal body, in one shape for every gated route. PURE. */
export function phoneGateBody(feature) {
  const what = PHONE_GATED_FEATURES[feature] || "this";
  return {
    error: `Verify a mobile number before ${what} during your free trial. It takes a minute: we text you a code. Choosing a plan also unlocks it.`,
    code: PHONE_REQUIRED_CODE,
    phoneVerification: { feature: PHONE_GATED_FEATURES[feature] ? feature : null, path: VERIFY_PHONE_PATH },
  };
}

/**
 * For a route: null when the feature may go ahead, else the 403 to return.
 *
 *   const blocked = await phoneGateResponse(member, "ai_call");
 *   if (blocked) return blocked;
 */
export async function phoneGateResponse(member, feature) {
  const verdict = await trialPhoneGate(member?.companyId, { access: member?.billingAccess || null });
  if (!verdict.required) return null;
  // The web-standard Response (what NextResponse extends), so this module
  // also loads under bare node for scripts/check-trial-phone-verification.mjs.
  return Response.json(phoneGateBody(feature), { status: 403 });
}
