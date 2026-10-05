// lib/planRead/referenceTables.js
//
// The drawing read's view of the painting PRESET's height, prep, access and
// crew figures. The figures themselves — and every source and how far it was
// checked — live in ONE place, lib/pricing/paintHeightPrep.js, which the
// paint book's preset (PAINT_TAKEOFF_DEFAULTS) carries, the quote builder
// prices with, and Settings → Services edits. The owner (2026-10-05): "can
// you integrate that into the preset then?" — so nothing here is a second
// copy: figuresFor() reads them off the company's merged book (its edits
// over the preset), in the shape the read's first pass uses.
//
// Pure.

import {
  SOURCES,
  HEIGHT_BANDS,
  bandIndexFor,
  heightFactors,
  HEIGHT_FACTOR_PRESET,
  prepAllowances,
  PREP_CONDITIONS,
  DAILY_SETUP_PRESET_MINUTES,
  DAILY_SETUP_LINE,
  CREW_PLAN_PRESET,
  RESTRICTED_HOURS_PER_DAY,
  CREW_OPTIONS,
  ACCESS_REFERENCE,
  ACCESS_REFERENCE_CURRENCY,
  ACCESS_REFERENCE_YEAR,
  RENTAL_PERIODS,
  cheapestRental,
  referenceRowFor,
  priceRental,
} from "@/lib/pricing/paintHeightPrep";

export {
  SOURCES,
  HEIGHT_BANDS,
  bandIndexFor,
  PREP_CONDITIONS,
  ACCESS_REFERENCE,
  ACCESS_REFERENCE_CURRENCY,
  ACCESS_REFERENCE_YEAR,
  RENTAL_PERIODS,
  cheapestRental,
  referenceRowFor,
  priceRental,
};

/** The crew defaults, with the preset's own figures. */
export const CREW_DEFAULTS = Object.freeze({
  hoursPerDay: CREW_PLAN_PRESET.hoursPerDay,
  restrictedHoursPerDay: RESTRICTED_HOURS_PER_DAY,
  crewSize: CREW_PLAN_PRESET.crewSize,
  options: CREW_OPTIONS,
  source: SOURCES.guess,
});

/**
 * Everything the first pass needs from a company's merged paint book. `own`
 * marks a figure the company changed from the preset — the screen says
 * "your figure" for it and the source for the rest. Pure.
 */
export function figuresFor(book) {
  const factors = heightFactors(book);
  const ownFactors = HEIGHT_BANDS.some((b, i) => factors[i] !== HEIGHT_FACTOR_PRESET[b.key]);
  const prep = prepAllowances(book);
  const minutes = Number(book?.dailySetupMinutes);
  const setupMinutes = Number.isFinite(minutes) && minutes >= 0 ? minutes : DAILY_SETUP_PRESET_MINUTES;
  const crew = book?.crewPlan && typeof book.crewPlan === "object" ? book.crewPlan : {};
  const hpd = Number(crew.hoursPerDay);
  const size = Number(crew.crewSize);
  return {
    bands: HEIGHT_BANDS.map((b, i) => ({ ...b, factor: factors[i] })),
    bandsSource: ownFactors ? { name: "Your height factors (Settings → Services)", tag: "YOURS" } : SOURCES.htdf,
    prep,
    setupHoursPerPainterDay: Math.round((setupMinutes / 60) * 1000) / 1000,
    setupLine: setupMinutes === DAILY_SETUP_PRESET_MINUTES ? DAILY_SETUP_LINE : `Your figure: ${setupMinutes} min a painter a day (Settings → Services)`,
    hoursPerDay: hpd >= 1 && hpd <= 24 && hpd !== CREW_PLAN_PRESET.hoursPerDay ? hpd : null,
    crewSize: Number.isInteger(size) && size >= 1 && size !== CREW_PLAN_PRESET.crewSize ? size : null,
    book,
    deliveryPerTrip: book?.deliveryPerTrip === null || book?.deliveryPerTrip === undefined || !Number.isFinite(Number(book.deliveryPerTrip)) ? null : Number(book.deliveryPerTrip),
  };
}
