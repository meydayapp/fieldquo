// lib/platform/signupOrigin.js
//
// The db half of lib/platform/signupFlags.js: record where a signup came
// from, decide the flag, tell the superadmins, stamp a review.
//
// ══ Never on the signup's critical path ════════════════════════════════════
//
// recordSignupOrigin() is called by app/api/companies/route.js after the
// Company row is committed. It returns a result and never throws: a
// contractor's signup must not fail because FieldQuo's own fraud bookkeeping
// could not write a row (the same rule captureSalesAttribution() lives by).
// A failure is recorded to the platform error log under area
// "signup_origin" so a broken capture is visible on /platform/errors rather
// than silent.
//
// ══ `deps` ═════════════════════════════════════════════════════════════════
//
// The client, the clock, the error log and the push are injectable so
// scripts/check-signup-origin.mjs can execute the real write path — including
// "the row write throws and the signup still gets a result" — against a fake
// client, the way lib/notify/push.js is exercised.

import { db } from "@/lib/db";
import { clientIp } from "@/lib/rateLimit";
import { recordError } from "@/lib/platform/errorLog";
import { pushToPlatformRoles } from "@/lib/notify/push";
import {
  SIGNUP_VIAS,
  SIGNUP_FLAG_LABELS,
  SIGNUP_VIA_LABELS,
  countRecentFromIp,
  decideSignupFlag,
  flagPushPayload,
  needsReview,
  readSignupRequest,
  repeatIpWindowStart,
} from "@/lib/platform/signupFlags";

const NOTE_MAX = 1000;

/** One row, as the console screen and the reps accordion both read it. */
export function shapeOrigin(o) {
  return {
    id: o.id,
    companyId: o.companyId,
    companyName: o.company?.name || null,
    companyCountry: o.company?.country || null,
    isDemo: Boolean(o.company?.isDemo),
    ip: o.ip,
    ipCountry: o.ipCountry,
    ipRegion: o.ipRegion,
    ipCity: o.ipCity,
    statedCountry: o.statedCountry,
    userAgent: o.userAgent,
    acceptLanguage: o.acceptLanguage,
    via: o.via,
    viaLabel: SIGNUP_VIA_LABELS[o.via] || o.via,
    rep: o.salesRep ? { id: o.salesRep.id, name: o.salesRep.name, code: o.salesRep.code } : null,
    referralCode: o.referralCode,
    flag: o.flag,
    flagLabel: SIGNUP_FLAG_LABELS[o.flag] || o.flag,
    flagReason: o.flagReason,
    needsReview: needsReview(o),
    reviewedAt: o.reviewedAt,
    reviewedBy: o.reviewedBy ? o.reviewedBy.email : null,
    reviewNote: o.reviewNote,
    createdAt: o.createdAt,
  };
}

export const ORIGIN_SELECT = {
  id: true,
  companyId: true,
  company: { select: { name: true, country: true, isDemo: true } },
  ip: true,
  ipCountry: true,
  ipRegion: true,
  ipCity: true,
  statedCountry: true,
  userAgent: true,
  acceptLanguage: true,
  via: true,
  salesRep: { select: { id: true, name: true, code: true } },
  referralCode: true,
  flag: true,
  flagReason: true,
  reviewedAt: true,
  reviewedBy: { select: { email: true } },
  reviewNote: true,
  createdAt: true,
};

/** The rows that need a look — the badge, the filter and the push agree. */
export const NEEDS_REVIEW_WHERE = { flag: { not: "none" }, reviewedAt: null };

/**
 * Record the origin of a signup and decide its flag.
 *
 * @param {object} args
 * @param {string} args.companyId
 * @param {Request} args.request   the signup request — headers are read here
 * @param {string} args.via        one of SIGNUP_VIAS
 * @param {string|null} args.salesRepId   the attributed rep, if any
 * @param {string|null} args.referralCode as presented
 * @param {string|null} args.statedCountry Company.country at creation
 * @param {string|null} args.companyName   for the push only
 * @returns {Promise<{ ok: boolean, origin: object|null, flag: string, error?: string }>}
 */
export async function recordSignupOrigin(
  { companyId, request, via, salesRepId = null, referralCode = null, statedCountry = null, companyName = null },
  deps = {},
) {
  const database = deps.db || db;
  const now = deps.now || new Date();
  const log = deps.recordError || recordError;
  const push = deps.push || pushToPlatformRoles;

  try {
    if (!companyId) throw new Error("companyId is required");
    const kind = SIGNUP_VIAS.includes(via) ? via : "other";
    const req = readSignupRequest(request?.headers, request ? clientIp(request) : null);

    // Other signups from the same address inside the window. The query mirrors
    // countRecentFromIp() — the rows come back and the pure function counts
    // them, so the exclusion of this company and of an unknown address is the
    // same code the check executes.
    let priorSignupsFromIp = 0;
    if (req.ip) {
      const recent = await database.signupOrigin.findMany({
        where: { ip: req.ip, createdAt: { gte: repeatIpWindowStart(now) } },
        select: { companyId: true, ip: true, createdAt: true },
      });
      priorSignupsFromIp = countRecentFromIp(recent, { ip: req.ip, now, excludeCompanyId: companyId });
    }

    const decision = decideSignupFlag({
      ipCountry: req.ipCountry,
      statedCountry,
      priorSignupsFromIp,
    });

    const origin = await database.signupOrigin.create({
      data: {
        companyId,
        ip: req.ip,
        ipCountry: req.ipCountry,
        ipRegion: req.ipRegion,
        ipCity: req.ipCity,
        userAgent: req.userAgent,
        acceptLanguage: req.acceptLanguage,
        statedCountry: statedCountry ? String(statedCountry).toUpperCase().slice(0, 2) : null,
        via: kind,
        salesRepId: salesRepId || null,
        referralCode: referralCode ? String(referralCode).trim().toLowerCase().slice(0, 64) : null,
        flag: decision.flag,
        flagReason: decision.reason,
      },
    });

    if (needsReview(origin)) {
      let repName = null;
      if (salesRepId) {
        const rep = await database.salesRep
          .findUnique({ where: { id: salesRepId }, select: { name: true } })
          .catch(() => null);
        repName = rep?.name || null;
      }
      // Fire-and-forget, like every other push: the row is written whatever
      // the push service says.
      void push({
        roles: ["superadmin"],
        payload: flagPushPayload({
          companyName,
          flag: decision.flag,
          ipCountry: req.ipCountry,
          via: kind,
          repName,
        }),
      });
    }

    return { ok: true, origin, flag: decision.flag };
  } catch (err) {
    await log({
      area: "signup_origin",
      code: "record_failed",
      message: `Could not record where a signup came from: ${err?.message}`,
      companyId: companyId || null,
    }).catch(() => {});
    return { ok: false, origin: null, flag: "none", error: err?.message || "failed" };
  }
}

/**
 * The console's one write: "somebody looked at this". One direction, with a
 * note, and refused with the reason when there is nothing to review or it was
 * already reviewed — a second stamp would overwrite who looked first.
 *
 * Permission is the caller's job (app/api/platform/signup-origins/[id]/review);
 * this re-reads the row inside the transaction so two clicks racing produce
 * one review.
 */
export async function reviewSignupOrigin({ id, adminId, note = null }, deps = {}) {
  const database = deps.db || db;
  const now = deps.now || new Date();
  const text = typeof note === "string" ? note.trim().slice(0, NOTE_MAX) : "";
  if (!id || !adminId) return { ok: false, status: 400, error: "id and adminId are required" };

  return database.$transaction(async (tx) => {
    const row = await tx.signupOrigin.findUnique({
      where: { id },
      select: { id: true, companyId: true, flag: true, reviewedAt: true },
    });
    if (!row) return { ok: false, status: 404, error: "Not found" };
    if (row.flag === "none") return { ok: false, status: 409, error: "This signup is not flagged — nothing to review." };
    if (row.reviewedAt) return { ok: false, status: 409, error: "This signup was already reviewed." };

    const updated = await tx.signupOrigin.update({
      where: { id },
      data: { reviewedAt: now, reviewedById: adminId, reviewNote: text || null },
      // The full shape back, so the screen swaps the row in without a reload.
      select: ORIGIN_SELECT,
    });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: adminId,
        action: "signup_reviewed",
        targetCompanyId: row.companyId,
        details: { signupOriginId: id, flag: row.flag, note: text || null },
      },
    });
    return { ok: true, status: 200, origin: updated };
  });
}
