// lib/trial/phoneVerify.js
//
// Texting a code to a trial owner's mobile, and checking it. The gate that
// needs it is lib/trial/phoneGate.js; the screen is /app/settings/verify-phone.
//
// ══ Which sender, and what it costs (prices checked 2026-10-03) ════════════
//
//   FieldQuo's own Twilio number (lib/sms/twilioClient.js sendSms):
//       US$0.0083 per SMS segment (+ carrier fees), ONE text per code.
//   Twilio Verify:
//       US$0.05 per SUCCESSFUL verification + the same ~US$0.0083 channel fee
//       per text sent — about 7× the first.
//   Twilio Lookup, Line Type Intelligence: US$0.008 per number looked up.
//
// The cheaper one is the default: our own number, a 6-digit code we generate,
// store only as a hash, and check ourselves. Verify is used for exactly one
// case — a US mobile while FieldQuo's system number is NOT registered for US
// A2P texting (lib/sms/usA2pStatus.js: every such text is undelivered with
// error 30034) — because Verify sends from Twilio's own registered senders,
// and a code that never arrives is a gate nobody can pass. Verify is only
// used when TWILIO_VERIFY_SERVICE_SID is set; without it a US trial is not
// asked at all (phoneGate.js deliveryPathFor), rather than asked for a code
// that cannot come.
//
// Line type: one Lookup per new number (US$0.008 — trivial against what the
// gate protects). VoIP (TextNow, Google Voice and the like — "fixedVoip",
// "nonFixedVoip"), landlines, toll-free, pagers and premium lines are refused:
// they are free to mint by the hundred, which is the abuse this exists to
// stop. A Lookup that fails or cannot tell lets the number through — an
// outage must not lock a real contractor out.
//
// ══ Limits ══════════════════════════════════════════════════════════════════
//
//   - 60 s between two sends; 3 sends an hour and 6 a day per company;
//     5 a day to one number across all companies (an SMS-pumping attacker
//     spends FieldQuo's money on texts, not on verifications).
//   - A code lives 10 minutes and allows 5 tries.
//   - One number verifies ONE trial: a number already verified by another
//     company's trial is refused before any text is sent.
//
// Every rule is a pure function below, executed by
// scripts/check-trial-phone-verification.mjs against hostile input; the
// database and Twilio are injectable, and the check never sends a real text.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { countryForAreaCode } from "@/lib/voice/nanp";
import { kindFromLookup } from "@/lib/businessNumber/lineType";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_TRIES = 5;
export const RESEND_GAP_MS = 60 * 1000;
export const SENDS_PER_HOUR = 3;
export const SENDS_PER_DAY = 6;
export const SENDS_PER_NUMBER_PER_DAY = 5;

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** A US/Canadian number as E.164, or null. PURE. Only +1 NANP. */
export function normaliseMobile(input) {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const raw = String(input).trim();
  if (raw.length > 32) return null;
  const digits = raw.replace(/\D/g, "");
  let national = null;
  if (digits.length === 10) national = digits;
  else if (digits.length === 11 && digits.startsWith("1")) national = digits.slice(1);
  if (!national) return null;
  // NXX-NXX-XXXX: neither the area code nor the exchange starts with 0 or 1.
  if (!/^[2-9]\d\d[2-9]\d{6}$/.test(national)) return null;
  if (!countryForAreaCode(national.slice(0, 3))) return null;
  return `+1${national}`;
}

/** "+1 ••• ••• 4567" — what the screen shows back. PURE. */
export function maskE164(e164) {
  const s = String(e164 || "");
  return s.length >= 4 ? `+1 ••• ••• ${s.slice(-4)}` : "";
}

/** Lookup's answer → may this number verify a trial? PURE. */
export function lineTypeVerdict(lookup) {
  if (!lookup) return { ok: true, kind: "unknown" };
  if (lookup.valid === false) return { ok: false, kind: "invalid", reasonKey: "invalid" };
  const country = lookup.countryCode ? String(lookup.countryCode).toUpperCase() : null;
  if (country && country !== "US" && country !== "CA") return { ok: false, kind: "other", reasonKey: "country" };
  const type = String(lookup.lineTypeIntelligence?.type || "");
  const kind = kindFromLookup(type);
  if (kind === "voip") return { ok: false, kind, reasonKey: "voip" };
  if (kind === "landline" || kind === "toll_free") return { ok: false, kind, reasonKey: "not_mobile" };
  if (["pager", "premium", "sharedCost", "uan", "voicemail"].includes(type)) return { ok: false, kind: "other", reasonKey: "not_mobile" };
  // mobile, personal, unknown — Lookup could not say otherwise.
  return { ok: true, kind, country };
}

/**
 * May another code be sent now? PURE.
 *
 * @param companySends  this company's sends' createdAt (any order)
 * @param numberSends   sends to this number across all companies
 * @returns {{ ok, reasonKey?, retryAfterSeconds? }}
 */
export function sendAllowed({ companySends = [], numberSends = [], now = Date.now() }) {
  const t = (d) => new Date(d).getTime();
  const mine = companySends.map(t).filter(Number.isFinite);
  const latest = mine.length ? Math.max(...mine) : null;
  if (latest !== null && now - latest < RESEND_GAP_MS) {
    return { ok: false, reasonKey: "too_soon", retryAfterSeconds: Math.ceil((RESEND_GAP_MS - (now - latest)) / 1000) };
  }
  const lastHour = mine.filter((x) => now - x < HOUR);
  if (lastHour.length >= SENDS_PER_HOUR) {
    return { ok: false, reasonKey: "rate_limited", retryAfterSeconds: Math.ceil((Math.min(...lastHour) + HOUR - now) / 1000) };
  }
  const lastDay = mine.filter((x) => now - x < DAY);
  if (lastDay.length >= SENDS_PER_DAY) {
    return { ok: false, reasonKey: "rate_limited", retryAfterSeconds: Math.ceil((Math.min(...lastDay) + DAY - now) / 1000) };
  }
  const toNumber = numberSends.map(t).filter((x) => Number.isFinite(x) && now - x < DAY);
  if (toNumber.length >= SENDS_PER_NUMBER_PER_DAY) {
    return { ok: false, reasonKey: "rate_limited", retryAfterSeconds: Math.ceil((Math.min(...toNumber) + DAY - now) / 1000) };
  }
  return { ok: true };
}

function secret() {
  const s = process.env.PHONE_CODE_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("No secret to hash verification codes with (BETTER_AUTH_SECRET)");
  return s;
}

/** The stored form of a code: an HMAC bound to the company and the number. */
export function hashCode({ companyId, e164, code, key = null }) {
  return createHmac("sha256", key || secret()).update(`${companyId}:${e164}:${String(code)}`).digest("hex");
}

/** A 6-digit code, uniformly random, leading zeros kept. */
export function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Does `typed` match the pending attempt? PURE given `key`.
 * @returns {{ ok, reasonKey? }}  wrong_code | expired | too_many | no_code
 */
export function codeVerdict({ attempt, companyId, typed, now = Date.now(), key = null }) {
  if (!attempt || attempt.status !== "pending") return { ok: false, reasonKey: "no_code" };
  if (new Date(attempt.expiresAt).getTime() <= now) return { ok: false, reasonKey: "expired" };
  if ((Number(attempt.attempts) || 0) >= MAX_CODE_TRIES) return { ok: false, reasonKey: "too_many" };
  const clean = String(typed ?? "").replace(/\D/g, "");
  if (clean.length !== 6) return { ok: false, reasonKey: "wrong_code" };
  if (attempt.sender === "verify") return { ok: true, viaVerify: true, code: clean };
  const want = Buffer.from(String(attempt.codeHash || ""), "hex");
  const got = Buffer.from(hashCode({ companyId, e164: attempt.e164, code: clean, key }), "hex");
  if (want.length !== got.length || want.length === 0) return { ok: false, reasonKey: "wrong_code" };
  return timingSafeEqual(want, got) ? { ok: true } : { ok: false, reasonKey: "wrong_code" };
}

// ── The words, keyed — the screen translates the key; this is the fallback ──
export const REFUSALS = {
  invalid: "That isn't a US or Canadian mobile number.",
  country: "Verification works with US and Canadian mobile numbers.",
  voip: "That number is an internet (VoIP) line. Use the mobile number of a phone with a SIM card.",
  not_mobile: "That number can't receive texts. Use a mobile number.",
  already_used: "That number has already been used to verify another FieldQuo trial. Use your own mobile, or choose a plan.",
  too_soon: "A code was just sent. Wait a minute before asking for another.",
  rate_limited: "Too many codes have been sent. Try again later, or choose a plan instead.",
  unavailable: "We can't text a code right now. Try again in a few minutes.",
  wrong_code: "That code doesn't match. Check the text and try again.",
  expired: "That code has expired. Send a new one.",
  too_many: "Too many wrong tries for that code. Send a new one.",
  no_code: "Send a code first.",
  not_needed: "Your account doesn't need to verify a phone.",
};

/**
 * Send a code. `deps` (all optional) are the seams the check script drives:
 *   prisma, sendSms, lookupLineType, verifyStart, now, key, deliveryPath.
 */
export async function sendCode({ companyId, userId = null, phone, deliveryPath, deps = {} }) {
  const prisma = deps.prisma || db;
  const now = deps.now ?? Date.now();
  const e164 = normaliseMobile(phone);
  if (!e164) return { ok: false, reasonKey: "invalid" };

  // One number, one trial — asked before a text is spent on it.
  const taken = await prisma.company.findFirst({
    where: { trialPhoneE164: e164, trialPhoneVerifiedAt: { not: null }, id: { not: companyId } },
    select: { id: true },
  });
  if (taken) return { ok: false, reasonKey: "already_used" };

  const since = new Date(now - DAY);
  const [companySends, numberSends] = await Promise.all([
    prisma.phoneVerification.findMany({ where: { companyId, createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.phoneVerification.findMany({ where: { e164, createdAt: { gte: since } }, select: { createdAt: true } }),
  ]);
  const limit = sendAllowed({ companySends: companySends.map((r) => r.createdAt), numberSends: numberSends.map((r) => r.createdAt), now });
  if (!limit.ok) return { ok: false, reasonKey: limit.reasonKey, retryAfterSeconds: limit.retryAfterSeconds };

  // Line type, once per number per 30 days (a stored answer is reused).
  const known = await prisma.phoneVerification.findFirst({
    where: { e164, lineType: { not: null }, createdAt: { gte: new Date(now - 30 * DAY) } },
    orderBy: { createdAt: "desc" },
    select: { lineType: true },
  });
  let lineType = known?.lineType || null;
  if (!lineType) {
    const lookup = deps.lookupLineType || (await import("@/lib/businessNumber/provider")).lookupLineType;
    const answer = await lookup(e164).catch(() => null);
    const verdict = lineTypeVerdict(answer);
    if (!verdict.ok) return { ok: false, reasonKey: verdict.reasonKey };
    lineType = verdict.kind;
  } else if (lineType === "voip") {
    return { ok: false, reasonKey: "voip" };
  } else if (lineType === "landline" || lineType === "toll_free") {
    return { ok: false, reasonKey: "not_mobile" };
  }

  // The number's own country picks the sender: a Canadian mobile always goes
  // through our number; a US one through Verify unless our number may text
  // the US (deliveryPath, from phoneGate.deliveryPathFor).
  const numberCountry = countryForAreaCode(e164.slice(2, 5));
  const sender = numberCountry === "US" && deliveryPath === "verify" ? "verify" : "sms";
  if (numberCountry === "US" && !deliveryPath) return { ok: false, reasonKey: "unavailable" };

  let codeHash = null;
  if (sender === "sms") {
    const code = newCode();
    try {
      codeHash = hashCode({ companyId, e164, code, key: deps.key || null });
    } catch {
      // No secret configured: say "can't text right now" rather than 500 —
      // and send nothing, because a code we could not store cannot be checked.
      return { ok: false, reasonKey: "unavailable" };
    }
    const send = deps.sendSms || (await import("@/lib/sms/twilioClient")).sendSms;
    // No companyId on purpose: this is FieldQuo's own text to its customer,
    // not a text on the company's behalf — it must not meet the very gate it
    // exists to open, and it is not the company's to be billed.
    const sent = await send({
      to: e164,
      body: `FieldQuo: your verification code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this text.`,
      purpose: "phone_verification",
    }).catch((err) => ({ success: false, error: err?.message }));
    if (!sent?.success) return { ok: false, reasonKey: "unavailable" };
  } else {
    const start = deps.verifyStart || verifyStart;
    const started = await start(e164).catch(() => false);
    if (!started) return { ok: false, reasonKey: "unavailable" };
  }

  // Any earlier pending code for this company stops working.
  await prisma.phoneVerification.updateMany({ where: { companyId, status: "pending" }, data: { status: "expired" } });
  const row = await prisma.phoneVerification.create({
    data: { companyId, userId, e164, sender, codeHash, lineType, expiresAt: new Date(now + CODE_TTL_MS) },
  });
  return { ok: true, id: row.id, masked: maskE164(e164), expiresAt: row.expiresAt, resendInSeconds: Math.ceil(RESEND_GAP_MS / 1000) };
}

/** Check a typed code. On success stamps the company — the gate's one write. */
export async function checkCode({ companyId, code, deps = {} }) {
  const prisma = deps.prisma || db;
  const now = deps.now ?? Date.now();
  const attempt = await prisma.phoneVerification.findFirst({
    where: { companyId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  let verdict;
  try {
    verdict = codeVerdict({ attempt, companyId, typed: code, now, key: deps.key || null });
  } catch {
    return { ok: false, reasonKey: "unavailable" };
  }
  let ok = verdict.ok;
  if (ok && verdict.viaVerify) {
    const check = deps.verifyCheck || verifyCheck;
    ok = await check(attempt.e164, verdict.code).catch(() => false);
  }
  if (!ok) {
    // Count the miss; a dead code stays dead.
    if (attempt && attempt.status === "pending" && verdict.reasonKey !== "expired" && verdict.reasonKey !== "too_many") {
      await prisma.phoneVerification.update({ where: { id: attempt.id }, data: { attempts: { increment: 1 } } });
    }
    return { ok: false, reasonKey: verdict.reasonKey || "wrong_code" };
  }

  // Re-asked at the moment of the write: two trials verifying the same number
  // in the same minute must not both win.
  const taken = await prisma.company.findFirst({
    where: { trialPhoneE164: attempt.e164, trialPhoneVerifiedAt: { not: null }, id: { not: companyId } },
    select: { id: true },
  });
  if (taken) return { ok: false, reasonKey: "already_used" };

  const at = new Date(now);
  await prisma.phoneVerification.update({ where: { id: attempt.id }, data: { status: "approved", verifiedAt: at } });
  await prisma.company.update({ where: { id: companyId }, data: { trialPhoneE164: attempt.e164, trialPhoneVerifiedAt: at } });
  return { ok: true, masked: maskE164(attempt.e164), verifiedAt: at };
}

// ── Twilio Verify, only for the US-without-A2P case ─────────────────────────
async function verifyStart(e164) {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) return false;
  const { twilioRest } = await import("@/lib/sms/twilioClient");
  const v = await twilioRest.verify.v2.services(sid).verifications.create({ to: e164, channel: "sms" });
  return Boolean(v?.sid);
}

async function verifyCheck(e164, code) {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) return false;
  const { twilioRest } = await import("@/lib/sms/twilioClient");
  const c = await twilioRest.verify.v2.services(sid).verificationChecks.create({ to: e164, code });
  return c?.status === "approved";
}
