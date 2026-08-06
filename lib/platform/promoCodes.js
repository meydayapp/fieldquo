// lib/platform/promoCodes.js
//
// Platform-issued promo codes — influencer / tester. A FieldQuo superadmin mints
// a code, hands it to an influencer or a selected tester, and the company that
// signs up with it gets extra free months before they pay. There is NO referrer
// and NO credit to anyone else — this is purely a longer free head start.
//
// Distinct from referral codes (lib/referrals): referral codes are company-owned
// lowercase slugs; promo codes are platform-generated "FQ-XXXXXXXX" tokens, so
// the two namespaces never collide and the signup path can tell them apart.

import { db } from "@/lib/db";
import { randomBytes } from "node:crypto";

function addMonths(date, months) {
  const out = new Date(date);
  // Clamp so Jan 31 + 1 month is Feb 28/29, not rolled into March.
  const day = out.getDate();
  out.setMonth(out.getMonth() + months);
  if (out.getDate() < day) out.setDate(0);
  return out;
}

const clampInt = (n, lo, hi, dflt) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
};

// No ambiguous characters (0/O, 1/I/L) — these get read off a screen and typed.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomToken(len = 8) {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/**
 * Mint a new promo code. `label`/`notes` are FieldQuo's own record of who got
 * it and are never shown to the redeemer. Retries on the (astronomically rare)
 * code collision.
 */
export async function generatePromoCode({
  adminId,
  label,
  notes,
  kind = "influencer",
  rewardMonths = 3,
  maxRedemptions = 1,
  expiresAt = null,
} = {}) {
  const data = {
    label: label?.trim() || null,
    notes: notes?.trim() || null,
    kind: kind === "tester" ? "tester" : "influencer",
    rewardMonths: clampInt(rewardMonths, 1, 24, 3),
    maxRedemptions: clampInt(maxRedemptions, 1, 100000, 1),
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    createdByAdminId: adminId || null,
    active: true,
  };
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await db.platformPromoCode.create({
        data: { code: `FQ-${randomToken(8)}`, ...data },
      });
    } catch (err) {
      if (err?.code !== "P2002") throw err; // not a unique collision — real error
    }
  }
  throw new Error("Couldn't generate a unique promo code");
}

/**
 * Redeem a code for a company at signup. Returns:
 *   null                      → not a promo code (caller should try referral)
 *   { ok:false, reason }      → a promo code, but not redeemable
 *   { ok:true, months, ... }  → granted; trialEndsAt extended
 *
 * Best-effort by contract — a promo must never block a signup. Grants are made
 * idempotent by the unique redemption row (a company can redeem at most one
 * promo, ever), so a retry can't stack free months.
 */
export async function redeemPromoCode({ company, code }) {
  if (!code || !company?.id) return null;
  const normalized = String(code).trim().toUpperCase();
  if (!normalized.startsWith("FQ-")) return null; // referral codes aren't promos

  const promo = await db.platformPromoCode.findUnique({ where: { code: normalized } });
  if (!promo) return null;

  if (!promo.active) return { ok: false, reason: "inactive" };
  if (promo.expiresAt && promo.expiresAt < new Date())
    return { ok: false, reason: "expired" };
  if (promo.redeemedCount >= promo.maxRedemptions)
    return { ok: false, reason: "exhausted" };

  // Extend from whichever is later — their base trial or now — so a 30-day trial
  // plus a 3-month code is ~4 months, not 3.
  const base =
    company.trialEndsAt && company.trialEndsAt > new Date()
      ? company.trialEndsAt
      : new Date();
  const trialEndsAt = addMonths(base, promo.rewardMonths);

  try {
    await db.$transaction([
      db.platformPromoRedemption.create({
        data: { promoCodeId: promo.id, companyId: company.id, monthsGranted: promo.rewardMonths },
      }),
      db.platformPromoCode.update({
        where: { id: promo.id },
        data: { redeemedCount: { increment: 1 } },
      }),
      db.company.update({ where: { id: company.id }, data: { trialEndsAt } }),
    ]);
    return { ok: true, months: promo.rewardMonths, trialEndsAt, kind: promo.kind };
  } catch (err) {
    // Unique violation → this company already redeemed a promo. Not an error the
    // signup should feel.
    if (err?.code === "P2002") return { ok: false, reason: "already_redeemed" };
    console.error("[promoCodes] redeem failed:", err?.message);
    return { ok: false, reason: "error" };
  }
}
