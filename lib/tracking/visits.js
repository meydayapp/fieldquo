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

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { attributionFromVisit, cleanLanding } from "./attribution";
import { furthestStep, stepRank, SUBMITTED } from "./funnelSteps";
import { planPartialWrite } from "./partial";

export function newVisitToken() {
  return randomBytes(24).toString("base64url");
}

export function isVisitToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32}$/.test(value);
}

/** Open a visit. `landing` is what the browser read from the URL. */
export async function openVisit({ companyId, surface, funnelId = null, language = null, landing = {}, step = null, now = new Date() }) {
  const clean = cleanLanding(landing, now);
  const token = newVisitToken();
  await db.funnelVisit.create({
    data: {
      companyId,
      surface,
      funnelId,
      token,
      language,
      stepKey: step?.key || "landed",
      stepRank: step?.rank ?? 0,
      ...clean,
      startedAt: now,
      lastSeenAt: now,
    },
  });
  return token;
}

/** The visit a token names, inside this company and surface only. */
export function findVisit({ companyId, surface, token }) {
  if (!isVisitToken(token)) return Promise.resolve(null);
  return db.funnelVisit.findFirst({ where: { token, companyId, surface } });
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
  await db.funnelVisit.update({ where: { id: visit.id }, data });
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
  });
}
