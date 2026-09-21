// lib/booking/fee.js
//
// The one place that decides what a booking actually costs, so the public
// booking page (which shows the price) and the confirm route (which charges it)
// can never disagree. Server-side only — the browser never computes the fee.
//
// A fee is charged ONLY when the company can actually collect it (Stripe Connect
// charges enabled). Without that, a paid event type quietly falls back to a free
// booking rather than showing a price nobody can be charged.
//
// ── Per MODE, since 2026-09-20 ──────────────────────────────────────────────
//
// "Maybe the phone is free, maybe the in-person is paid." The in-person
// visit's fee is the event type's, per consultation, with its promo — exactly
// as before. A phone call's and a video call's fee are the company's
// (Company.callFeeCents / videoFeeCents), null meaning free, because a call is
// the same call whoever takes it. `mode` defaults to "visit" so every caller
// that predates this keeps its meaning.

import { BOOKING_MODES, bookingDurationMinutes, offeredModes } from "@/lib/booking/bookingModes";

export function effectiveBookingFeeCents(company, eventType, mode = "visit") {
  const chargesEnabled = Boolean(company?.stripeChargesEnabled);
  if (!chargesEnabled) return { feeCents: 0, feeStandardCents: null };

  if (mode === "call" || mode === "video") {
    const cents = Math.round(Number(mode === "call" ? company?.callFeeCents : company?.videoFeeCents) || 0);
    return { feeCents: cents > 0 ? cents : 0, feeStandardCents: null };
  }

  const base = Number(eventType?.feeCents) || 0;
  if (base <= 0) return { feeCents: 0, feeStandardCents: null };
  // A live promo replaces the standard price; feeStandardCents carries the
  // original for the struck-through "$79 → $20" display.
  const promo = eventType?.promoFeeCents;
  if (eventType?.promoActive && promo != null && Number(promo) >= 0) {
    return { feeCents: Math.round(Number(promo)), feeStandardCents: base };
  }
  return { feeCents: base, feeStandardCents: null };
}

/**
 * One mode's whole preset for one event type: its length and its fee, as the
 * booking page shows them and the confirm route books them.
 *
 *   { minutes, feeCents, feeStandardCents }
 *
 * The visit row reads the event type (durationMinutes, feeCents, promo); the
 * call and video rows read the company (callMinutes / callFeeCents, …). Both
 * halves are resolved by the two functions above and in
 * lib/booking/bookingModes.js — this only puts them side by side, so the
 * page's "Phone call · 20 min · Free" and the route's reservation and charge
 * come from the same numbers.
 */
export function bookingModePreset({ company, eventType, mode }) {
  const m = BOOKING_MODES.includes(mode) ? mode : "visit";
  const { feeCents, feeStandardCents } = effectiveBookingFeeCents(company, eventType, m);
  return {
    minutes: bookingDurationMinutes({ company, eventType, mode: m }),
    feeCents,
    feeStandardCents,
  };
}

/** Every offered mode's preset for one event type, keyed by mode. */
export function bookingModePresets({ company, eventType }) {
  return Object.fromEntries(
    offeredModes(company).map((mode) => [mode, bookingModePreset({ company, eventType, mode })]),
  );
}

// How long an unpaid hold blocks its slot.
//
// One constant because three places have to agree or the promise breaks: the
// confirm route's conflict check (which enforces it), the booking page's
// "your time is held for 30 minutes" (which states it), and the reconciler
// (which cancels the hold once it has lapsed). They were previously a literal,
// a sentence and nothing at all.
export const FEE_HOLD_MINUTES = 30;

// The instant at which holds older than this stop blocking a slot.
export function feeHoldCutoff(now = Date.now()) {
  return new Date(now - FEE_HOLD_MINUTES * 60 * 1000);
}
