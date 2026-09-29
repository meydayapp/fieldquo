// app/(marketing)/industries/[slug]/showcase/houseFixture.js
//
// The walk-through on a house the VISITOR named, instead of the sample one.
//
// Two ways in, and neither prices anything:
//
//   fixtureForHouse   a real address, measured on the server by
//                     POST /api/showcase/roof-measure (./liveMeasure.js) with
//                     the product's own Solar measurement. The route answers
//                     with the house — its roof, its country and province,
//                     the tax that jurisdiction's rules give — and never a
//                     price: the prices stay the sample company's preset
//                     (fixture.config), already on the page, and are run
//                     through ./roofingRun.js exactly as the sample is.
//   fixtureWithSquares  no measurement to be had (Google has no roof model,
//                     the address is outside Canada and the US, the geocode
//                     failed): the visitor types the roof size in squares.
//                     That figure is THEIRS and is labelled so — source
//                     "manual", no pitch, no steepness tier, no imagery date.
//                     Nothing about the roof is filled in that nobody said:
//                     an unknown pitch prices with no steepness surcharge,
//                     and the page says that it did.
//
// Pure: no React, no fetch. Swaps fields on the plain-data fixture
// buildRoofingShowcase() made; the price book, the company, the homeowner and
// every word stay the sample's. check:roofing-example executes it.

import { budgetBands } from "@/lib/estimate/budgetBands";
import { MIN_PLAUSIBLE_ROOF_SQFT } from "@/lib/measure/roofMeasurement";

/**
 * The roof sizes the typed fallback accepts, in squares (100 sq ft each).
 * The floor is the measurement's own "smallest roof that can be a house";
 * the ceiling is a large house, not a warehouse — this is a homeowner form.
 */
export const MANUAL_SQUARES = Object.freeze({ min: MIN_PLAUSIBLE_ROOF_SQFT / 100, max: 200 });

/** A house's billing currency, from the country the geocode placed it in. */
export function currencyForCountry(country) {
  if (country === "CA") return "CAD";
  if (country === "US") return "USD";
  return null;
}

/**
 * The budget question's bands as GET /api/instant-quote/[slug] sends them:
 * index and label, labelled in the form's currency. One function for the
 * sample (buildRoofingShowcase) and a house in another currency, so the two
 * cannot label the same thresholds two ways.
 */
export function payloadBands(config, { currency, language }) {
  return budgetBands(config.budgetThresholds, { currency, language }).map((b) => ({ index: b.index, label: b.label }));
}

/** The form payloads re-labelled for a currency — nothing else in them changes. */
function payloadsIn(fixture, currency) {
  return Object.fromEntries(
    Object.entries(fixture.payloads).map(([code, p]) => [
      code,
      {
        ...p,
        currency,
        trades: p.trades.map((tr) => ({ ...tr, budgetBands: payloadBands(fixture.config, { currency, language: code }) })),
      },
    ]),
  );
}

/**
 * The fixture on the house the route returned.
 *
 * `house` is the route's `house` object (./liveMeasure.js houseView): address,
 * country, region, currency, tax, measurement. The company keeps its name,
 * logo and prices; it takes the house's province, country and currency,
 * because a draft is taxed and billed where the property is. With no
 * measurement (Google had no roof model) the result is not priceable until
 * fixtureWithSquares() gives it a size — the caller does exactly that.
 */
export function fixtureForHouse(fixture, house) {
  const currency = currencyForCountry(house?.country);
  if (!house || !currency || !house.tax) return null;
  return {
    ...fixture,
    company: { ...fixture.company, currency, province: house.region, country: house.country },
    address: house.address,
    measurement: house.measurement ? { ...house.measurement } : null,
    tax: { ...house.tax },
    payloads: payloadsIn(fixture, currency),
    live: {
      kind: house.measurement ? "measured" : "unmeasured",
      address: house.address,
      trustworthy: house.trustworthy !== false,
      satelliteImageUrl: house.satelliteImageUrl || null,
    },
  };
}

/** A typed roof size, or null when it is not one the fallback accepts. */
export function cleanSquares(value) {
  const n = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 10) / 10;
  if (rounded < MANUAL_SQUARES.min || rounded > MANUAL_SQUARES.max) return null;
  return rounded;
}

/**
 * The fixture priced on a roof size the visitor typed.
 *
 * Only squares and the area they define (1 square = 100 sq ft) — the two
 * facts the visitor stated. Pitch, steepness, facets, footprint and imagery
 * are null because nobody measured them. The picture is the house's own still
 * when the address resolved (Google had imagery but no roof model), the
 * sample's drawing otherwise.
 */
export function fixtureWithSquares(fixture, squares) {
  const sq = cleanSquares(squares);
  if (sq == null) return null;
  const image = fixture.live?.satelliteImageUrl || fixture.measurement?.satelliteImageUrl || null;
  return {
    ...fixture,
    measurement: {
      source: "manual",
      areaSqft: Math.round(sq * 100),
      squares: sq,
      predominantPitch: null,
      steepness: null,
      segmentCount: null,
      footprintSqft: null,
      formattedAddress: fixture.address,
      imageryDate: null,
      satelliteImageUrl: image,
    },
    live: { ...(fixture.live || {}), kind: "typed", squares: sq, address: fixture.live?.address || null },
  };
}
