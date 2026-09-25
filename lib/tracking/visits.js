// lib/tracking/visits.js
//
// The database half of funnel tracking: open a FunnelVisit, move it forward,
// keep a partial lead on it, and hand its attribution to the lead a submit
// creates. The rules live in the pure modules beside this one
// (attribution.js, funnelSteps.js, partial.js); this file only reads and
// writes.
//
// Every write is best-effort from the caller's point of view — a visit row
// failing must never fail the homeowner's submission — so the submit routes
// call linkVisitToLead inside a catch, and the visit route answers 200 with
// no token rather than an error the page would have to show.
//
// ══ First touch across a company's pages (25 September 2026) ═══════════════
//
// A visitor who lands on the company's website from an ad and then taps
// "Book a visit" opens a second page of the same company. That page's own
// URL carries nothing — the ad's parameters were on the first one — so it
// would have been counted "direct" and the booking credited to nobody.
//
// The browser keeps the tokens of the visits it opened in this TAB
// (sessionStorage "fq.touch", app/components/public/useAdTracking.js — no
// cookie, nothing after the tab closes, nothing shared between sites) and
// posts them with the next page's first beacon. When that page's landing has
// no signal of its own (attribution.js landingHasOwnSignal), openVisit copies
// the landing of the EARLIEST of those visits that belongs to the same
// company and was itself a landing, and records which one in
// `firstVisitId`. The report counts a carried visit's requests and bookings
// for the campaign, and does not count it as a second visit.
//
// The server decides, from its own rows: a token from another company, or
// one that is not a visit, carries nothing.
//
// ══ Before the columns exist ═══════════════════════════════════════════════
//
// `ad`, `firstVisitId` and `bookingId` are additive columns applied by hand
// (the live database holds tables no branch has landed, so nothing here is
// ever pushed). Code deploys first. Until the SQL runs, every read names its
// columns explicitly — Prisma selects every scalar by default, and one
// missing column would take the whole row down, which would stop the funnel
// and instant-estimate counts that work today — and every query that names
// a new column is retried once without it on Postgres's "column does not
// exist". The cost of the gap is the new detail, never a visit.

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { attributionFromVisit, cleanLanding, landingHasOwnSignal, CARRIED_FIELDS } from "./attribution";
import { furthestStep, stepRank, SUBMITTED } from "./funnelSteps";
import { planPartialWrite } from "./partial";

/** How long a tab's first landing is still the first touch. */
export const TOUCH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** How many of a tab's visit tokens a beacon may name. */
export const TOUCH_MAX = 8;

export function newVisitToken() {
  return randomBytes(24).toString("base64url");
}

export function isVisitToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32}$/.test(value);
}

/** The tokens a browser posted as this tab's earlier visits, cleaned. */
export function cleanTouches(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isVisitToken))].slice(0, TOUCH_MAX);
}

/** Postgres/Prisma saying a column this code names is not there yet. */
export function isMissingColumn(err) {
  if (err?.code === "P2022") return true;
  const m = String(err?.message || "");
  return /column/i.test(m) && /does not exist/i.test(m);
}

/** Run with the new columns; once more without them if the database has not got them. */
async function withNewColumns(run) {
  try {
    return await run(true);
  } catch (err) {
    if (!isMissingColumn(err)) throw err;
    return run(false);
  }
}

/** Every column that existed before 25 September 2026 — named, never `*`. */
const LEGACY_SELECT = Object.freeze({
  id: true,
  companyId: true,
  surface: true,
  funnelId: true,
  trade: true,
  token: true,
  language: true,
  stepKey: true,
  stepRank: true,
  source: true,
  utmSource: true,
  utmMedium: true,
  utmCampaign: true,
  utmContent: true,
  utmTerm: true,
  clickNetwork: true,
  fbc: true,
  referrerHost: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  contactAt: true,
  partialExpiredAt: true,
  leadId: true,
  completedAt: true,
  startedAt: true,
  lastSeenAt: true,
});
const NEW_SELECT = Object.freeze({ ad: true, firstVisitId: true, bookingId: true });

export function visitSelect(full) {
  return full ? { ...LEGACY_SELECT, ...NEW_SELECT } : { ...LEGACY_SELECT };
}

/**
 * The visit whose landing a new visit inherits, or null: the earliest of
 * the posted tokens that is this company's, was itself a landing, and is
 * recent enough to still be this tab's first touch.
 */
export async function firstTouch({ companyId, touches, now = new Date() }) {
  const tokens = cleanTouches(touches);
  if (!companyId || !tokens.length) return null;
  return withNewColumns((full) =>
    db.funnelVisit.findFirst({
      where: {
        companyId,
        token: { in: tokens },
        startedAt: { gte: new Date(now.getTime() - TOUCH_MAX_AGE_MS) },
        ...(full ? { firstVisitId: null } : {}),
      },
      orderBy: { startedAt: "asc" },
      select: visitSelect(full),
    }),
  );
}

/**
 * Open a visit. `landing` is what the browser read from the URL; `touches`
 * the tokens of the visits this tab opened before (see the header).
 */
export async function openVisit({ companyId, surface, funnelId = null, language = null, landing = {}, touches = [], step = null, now = new Date() }) {
  const { ad, ...clean } = cleanLanding(landing, now);
  const carried = landingHasOwnSignal({ ...clean, ad })
    ? null
    : await firstTouch({ companyId, touches, now }).catch(() => null);

  const landed = { ...clean };
  let adJson = ad;
  if (carried) {
    for (const k of CARRIED_FIELDS) if (k !== "ad") landed[k] = carried[k] ?? null;
    landed.source = carried.source || "direct";
    adJson = carried.ad && typeof carried.ad === "object" ? carried.ad : null;
  }

  const token = newVisitToken();
  const data = {
    companyId,
    surface,
    funnelId,
    token,
    language,
    stepKey: step?.key || "landed",
    stepRank: step?.rank ?? 0,
    ...landed,
    startedAt: now,
    lastSeenAt: now,
  };
  await withNewColumns((full) =>
    db.funnelVisit.create({
      data: full
        ? {
            ...data,
            // A Json column takes no plain null in Prisma — absent is absent.
            ...(adJson ? { ad: adJson } : {}),
            ...(carried ? { firstVisitId: carried.id } : {}),
          }
        : data,
      select: { id: true },
    }),
  );
  return token;
}

/** The visit a token names, inside this company and surface only. */
export function findVisit({ companyId, surface, token }) {
  if (!isVisitToken(token)) return Promise.resolve(null);
  return withNewColumns((full) =>
    db.funnelVisit.findFirst({ where: { token, companyId, surface }, select: visitSelect(full) }),
  );
}

/**
 * Move a visit forward and/or keep what was typed. `step` is
 * { key, rank } already ranked by the caller against the server's order.
 */
export async function advanceVisit(visit, { step = null, trade = null, contact = null, now = new Date() } = {}) {
  const data = { lastSeenAt: now };
  const next = furthestStep({ key: visit.stepKey, rank: visit.stepRank }, step);
  if (next.rank !== visit.stepRank) {
    data.stepKey = next.key;
    data.stepRank = next.rank;
  }
  if (trade && !visit.completedAt) data.trade = trade;
  const partial = planPartialWrite(visit, contact, now);
  if (partial) Object.assign(data, partial);
  await db.funnelVisit.update({ where: { id: visit.id }, data, select: { id: true } });
}

/**
 * The attribution for a lead about to be created from this visit, or null.
 * Read BEFORE the lead is created so it can be written on the create itself.
 */
export async function visitForSubmit({ companyId, surface, token }) {
  const visit = await findVisit({ companyId, surface, token }).catch(() => null);
  if (!visit || visit.leadId) return { visit: null, attribution: null };
  return { visit, attribution: attributionFromVisit(visit) };
}

/**
 * The attribution for a lead made on a page that opens no visit of its own
 * (the self-quote form, reached from the company's website): the tab's first
 * touch, or null. Nothing is linked — the visit belongs to the page it was
 * opened on, and marking the website visit "submitted" would count one
 * request on a surface that does not take requests.
 */
export async function attributionFromTouches({ companyId, touches, now = new Date() }) {
  const visit = await firstTouch({ companyId, touches, now }).catch(() => null);
  return visit ? attributionFromVisit(visit) : null;
}

/**
 * The visit became a lead: mark it submitted and link it, so the partial
 * view drops it and the report counts it once. `funnelSteps` ranks
 * "submitted" for a funnel.
 */
export async function linkVisitToLead(visit, leadId, { funnelSteps = [], trade = null, now = new Date() } = {}) {
  if (!visit || !leadId) return;
  const rank = stepRank(visit.surface, SUBMITTED, funnelSteps);
  await db.funnelVisit.update({
    where: { id: visit.id },
    data: {
      leadId,
      completedAt: now,
      lastSeenAt: now,
      stepKey: SUBMITTED,
      stepRank: rank ?? visit.stepRank,
      ...(trade ? { trade } : {}),
    },
    select: { id: true },
  });
}

/**
 * A booking-page visit made a booking. The first booking a visit makes is
 * the one it keeps: a second one from the same tab is a real booking, but
 * it is not a second conversion of the same landing. A paid visit is linked
 * while it is still a hold; the report counts it only once it is confirmed.
 */
export async function linkVisitToBooking(visit, bookingId, { now = new Date() } = {}) {
  if (!visit || !bookingId || visit.bookingId || visit.surface !== "booking") return;
  const rank = stepRank("booking", SUBMITTED);
  const data = { completedAt: visit.completedAt || now, lastSeenAt: now, stepKey: SUBMITTED, stepRank: rank ?? visit.stepRank };
  await withNewColumns((full) =>
    db.funnelVisit.update({ where: { id: visit.id }, data: full ? { ...data, bookingId } : data, select: { id: true } }),
  );
}
