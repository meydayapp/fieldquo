// lib/servicePlans/validate.js
//
// The boundary between what a browser sent and what becomes a standing
// arrangement to take somebody's money. Pure, so scripts/check-service-plans.mjs
// can throw hostile input at it.
//
// The rule this file exists to enforce: a plan's MONEY TERMS are decided here,
// once, from a validated payload, and are never editable afterwards. The client
// authorises a named amount on a named cadence; letting the contractor edit
// either while a mandate is live is the difference between a payment and a
// chargeback.

import {
  PLAN_FREQUENCY_KEYS,
  PLAN_END_MODES,
  PLAN_COLLECTION_MODES,
  occurrenceDate,
} from "@/lib/servicePlans/schedule";
import { canAuthoriseInLanguage } from "@/lib/servicePlans/consent";

function trimmed(v, max = 200) {
  return String(v ?? "").trim().slice(0, max);
}

function positiveNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Midnight UTC for a YYYY-MM-DD, matching how every other calendar date in
 *  this codebase is stored — see documentFormatters' note on UTC dates. */
function calendarDate(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @returns { ok: true, plan } or { ok: false, error } — a sentence, not a code.
 *          Every rejection here is something a contractor typed, so it has to
 *          say what to change.
 */
export function validatePlanInput(body, { language = "en" } = {}) {
  const name = trimmed(body?.name, 120);
  if (!name) return { ok: false, error: "Give this plan a name the client will recognise." };

  const serviceName = trimmed(body?.serviceName, 120);
  if (!serviceName) return { ok: false, error: "Pick the service this plan covers." };

  const clientId = trimmed(body?.clientId, 64);
  if (!clientId) return { ok: false, error: "Pick the client this plan is for." };

  const frequency = trimmed(body?.frequency, 32);
  if (!PLAN_FREQUENCY_KEYS.includes(frequency)) {
    return { ok: false, error: "Choose how often this plan bills." };
  }

  const startDate = calendarDate(body?.startDate);
  if (!startDate) return { ok: false, error: "Give the date of the first visit." };

  const endMode = trimmed(body?.endMode, 16);
  if (!PLAN_END_MODES.includes(endMode)) {
    return { ok: false, error: "Choose how long this plan runs for." };
  }

  let occurrenceCount = null;
  let endDate = null;
  if (endMode === "count") {
    const n = Number(body?.occurrenceCount);
    if (!Number.isInteger(n) || n < 1 || n > 520) {
      return { ok: false, error: "How many visits? Enter a whole number between 1 and 520." };
    }
    occurrenceCount = n;
  }
  if (endMode === "until") {
    endDate = calendarDate(body?.endDate);
    if (!endDate) return { ok: false, error: "Give the date this plan should stop on." };
    if (endDate < startDate) {
      return { ok: false, error: "The end date is before the first visit." };
    }
    // An end date that lands before the first occurrence sells nothing. Caught
    // here rather than discovered as a plan that silently never bills.
    const first = occurrenceDate(startDate, frequency, 0);
    if (!first || first > endDate) {
      return { ok: false, error: "This plan would never bill — the end date is before the first payment." };
    }
  }

  const amountPerOccurrence = positiveNumber(body?.amountPerOccurrence);
  if (amountPerOccurrence === null) {
    return { ok: false, error: "Enter what each visit costs, before the package discount." };
  }
  if (amountPerOccurrence > 1_000_000) {
    return { ok: false, error: "That amount looks wrong. Check it before saving." };
  }

  const rawDiscount = body?.discountPct;
  const discountPct =
    rawDiscount === "" || rawDiscount === null || rawDiscount === undefined
      ? 0
      : Number(rawDiscount);
  if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct >= 100) {
    return { ok: false, error: "The package discount has to be between 0 and 99%." };
  }

  // Null is a real answer here — "no tax on this plan" — and is stored as null
  // rather than 0 so nothing downstream can mistake it for an unfilled field.
  const rawTax = body?.taxRatePct;
  let taxRatePct = null;
  if (rawTax !== "" && rawTax !== null && rawTax !== undefined) {
    const n = Number(rawTax);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { ok: false, error: "The tax rate has to be between 0 and 100%." };
    }
    taxRatePct = n;
  }

  const collectionMode = trimmed(body?.collectionMode, 16) || "invoice";
  if (!PLAN_COLLECTION_MODES.includes(collectionMode)) {
    return { ok: false, error: "Choose how this plan gets paid." };
  }

  // Automatic collection can only be SOLD in a language we can state the
  // authorisation terms in. Refusing here rather than letting the contractor
  // create a plan whose consent page cannot be rendered — see
  // AUTHORISATION_LANGUAGES for why we will not machine-draft this one.
  if (collectionMode === "automatic" && !canAuthoriseInLanguage(language)) {
    return {
      ok: false,
      error:
        "Automatic payments aren't available for this client's language yet — we only have reviewed authorisation wording in English and French. Invoice per visit works in every language.",
    };
  }

  return {
    ok: true,
    plan: {
      name,
      serviceName,
      clientId,
      categoryId: trimmed(body?.categoryId, 64) || null,
      frequency,
      startDate,
      endMode,
      occurrenceCount,
      endDate,
      amountPerOccurrence,
      discountPct,
      taxRatePct,
      collectionMode,
      language,
    },
  };
}
