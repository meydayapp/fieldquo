// app/components/billing/CustomSeatPicker.js
//
// The fifth card's control: how many seats, and what that comes to.
//
// One component for both places it appears — the public pricing page and
// the Account & Billing plan picker — because the two surfaces used to be
// where the same sentence drifted apart (seatLine in account-billing versus
// peopleLines on /pricing, both once printing the sum of seats and crew as
// "employee accounts"). The arithmetic is not here at all: it is
// customTier() in lib/pricing/ladder.js, the function the server prices the
// row with, so the number on the card is the number on the invoice.
//
// It renders nothing without an `offer` — the per-seat and base prices in a
// currency, from lib/billing/customPlan.js — because a stepper that cannot
// say a price is a dead control. Translation is the caller's: the two pages
// read different catalogues (marketing vs app), so labels come in as props
// and every string has an English fallback.
"use client";

import { Minus, Plus } from "lucide-react";
import { customTier, CUSTOM_QUICK_PICKS } from "@/lib/pricing/ladder";

/** The priced tier for a picked count against an offer — null when the
 *  count or the offer cannot be priced. Exported so a page can print the
 *  same figures elsewhere (a confirmation dialog) without re-deriving. */
export function pickedTier(offer, seats) {
  if (!offer) return null;
  return customTier(seats, {
    base: { priceMonthly: offer.baseMonthly, priceAnnual: offer.baseAnnual },
  });
}

/** Clamp a typed or stepped count into the sellable range. */
export function clampSeats(offer, seats) {
  const n = Math.floor(Number(seats));
  if (!offer || !Number.isFinite(n)) return offer?.minSeats ?? 0;
  return Math.min(offer.maxSeats, Math.max(offer.minSeats, n));
}

export default function CustomSeatPicker({
  offer,
  seats,
  onChange,
  labels = {},
  idPrefix = "custom-seats",
}) {
  if (!offer) return null;
  const value = clampSeats(offer, seats);
  const tier = pickedTier(offer, value);
  const L = {
    seats: labels.seats || "Seats",
    quickPicks: labels.quickPicks || "Quick picks",
    fewer: labels.fewer || "One seat fewer",
    more: labels.more || "One seat more",
  };
  const set = (n) => onChange?.(clampSeats(offer, n));

  return (
    <div className="mt-4">
      <label htmlFor={`${idPrefix}-input`} className="text-xs font-medium text-muted-foreground">
        {L.seats}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          aria-label={L.fewer}
          onClick={() => set(value - 1)}
          disabled={value <= offer.minSeats}
          className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-foreground disabled:opacity-40"
        >
          <Minus size={16} />
        </button>
        <input
          id={`${idPrefix}-input`}
          type="number"
          inputMode="numeric"
          min={offer.minSeats}
          max={offer.maxSeats}
          value={value}
          onChange={(e) => set(e.target.value)}
          className="h-9 w-20 text-center rounded-lg border border-border bg-background text-foreground font-semibold"
        />
        <button
          type="button"
          aria-label={L.more}
          onClick={() => set(value + 1)}
          disabled={value >= offer.maxSeats}
          className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-foreground disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground mr-1">{L.quickPicks}</span>
        {CUSTOM_QUICK_PICKS.filter((n) => n >= offer.minSeats && n <= offer.maxSeats).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => set(n)}
            aria-pressed={n === value}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
              n === value
                ? "border-foreground bg-foreground text-background"
                : "border-border text-foreground hover:border-foreground/40"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {tier ? null : (
        <p className="mt-2 text-xs text-destructive">
          {labels.outOfRange || `Between ${offer.minSeats} and ${offer.maxSeats} seats.`}
        </p>
      )}
    </div>
  );
}
