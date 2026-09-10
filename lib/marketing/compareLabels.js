// lib/marketing/compareLabels.js
//
// The seam between "what the comparison data records" and "how it is said".
//
// ══ The same split featureLabels.js already argued for ═════════════════════
//
// lib/marketing/competitors.js is a proof-carrying data module: every claim in
// it names a source URL, a vantage point and a date, and 600-odd assertions in
// scripts/check-competitors.mjs read its English strings. Translating those
// strings IN PLACE would put a legal claim about a named company through a
// coverage bar it has no business being held to, and would break every
// assertion that reads one.
//
// So the data module keeps saying what is TRUE, in English, and this file is
// the only place a renderer may turn one of its keys into words. Exactly the
// arrangement lib/marketing/featureLabels.js established for the feature
// matrix, for the same reason and with the same fallback chain: requested
// language → English catalogue → the module's own string.
//
// ══ What is NOT here, deliberately ═════════════════════════════════════════
//
// A competitor's own words. Their tier names ("Connect", "Grow", "The Works"),
// the feature lists their page prints, the sentence their page uses to ask you
// to request a price, and the `claim` prose recorded against each capability
// are all quotations. compareCopy.js's own rule — "renaming a competitor's
// feature to match one of ours is how a comparison quietly becomes a straw
// man" — applies at least as strongly to translating one. A quotation that has
// been through a translator is no longer a quotation, and these are the
// sentences a prospect is most likely to check against the competitor's own
// site. They stay in the language they were published in.
//
// What IS here: OUR vocabulary about the comparison — the capabilities we
// claim or concede, the axis a figure was read at, and the words for how a
// feature is made available.

import {
  BILLING_MODES,
  COMPETITORS,
  FEATURE_ABSENT,
  FEATURE_ADD_ON,
  FEATURE_INCLUDED,
  FEATURE_INCLUDED_USAGE_EXTRA,
  FEATURE_UNKNOWN,
  FIELDQUO_CAPABILITIES,
  FIELDQUO_LACKS,
  TEAM_SIZES,
  claims,
} from "@/lib/marketing/competitors";

/**
 * The capabilities a /compare page can actually PRINT a label for.
 *
 * Derived rather than typed, on the same principle as featureLabels.js's
 * LIMIT_KEYS: the day a new capability enters FIELDQUO_LACKS or a competitor's
 * claim list, the coverage check fails until somebody writes the nine
 * sentences — instead of that label shipping in English on eight translated
 * pages with nothing noticing.
 *
 * The ledger holds more capabilities than this. Minting a key for every one of
 * them would put a dozen sentences no page renders through a translation bar,
 * and a catalogue full of strings nobody reads is a coverage check that proves
 * nothing.
 */
export const RENDERED_CAPABILITIES = Object.freeze(
  [
    ...FIELDQUO_LACKS,
    // Named directly by ComparisonPage's receptionist panel, on every page,
    // whether or not any competitor's claim list mentions it.
    "ai_receptionist_no_monthly_floor",
    ...COMPETITORS.flatMap((c) => {
      const both = claims(c.id);
      return [...both.weHaveTheyDont, ...both.theyHaveWeDont].map((x) => x.capability);
    }),
  ]
    .filter((key, i, all) => all.indexOf(key) === i)
    .filter((key) => FIELDQUO_CAPABILITIES[key]),
);

export const capabilityKey = (key) => `compare.capability.${key}`;
export const teamSizeKey = (key) => `compare.teamSize.${key}`;
export const billingModeKey = (key) => `compare.billing.${key}`;

export const CAPABILITY_LABEL_KEYS = Object.freeze(
  RENDERED_CAPABILITIES.map(capabilityKey),
);
export const TEAM_SIZE_KEYS = Object.freeze(Object.keys(TEAM_SIZES).map(teamSizeKey));
export const BILLING_MODE_KEYS = Object.freeze(
  Object.keys(BILLING_MODES).map(billingModeKey),
);

/**
 * How a feature is made available, said in the reader's language.
 *
 * The English map used to live inside ComparisonPage.js. It is here now
 * because /pricing renders the same five words through AddOnStack, and two
 * copies of a five-word vocabulary is how one surface ends up calling an
 * add-on "extra" and the other calling it "optional".
 */
export const AVAILABILITY_FALLBACK = Object.freeze({
  [FEATURE_INCLUDED]: "in the plan price",
  [FEATURE_INCLUDED_USAGE_EXTRA]:
    "on every plan, with the talk time bought separately as prepaid credit",
  [FEATURE_ADD_ON]: "a paid add-on on top of the plan",
  [FEATURE_ABSENT]: "not on that tier",
  [FEATURE_UNKNOWN]: "not established",
});

const AVAILABILITY_KEY = Object.freeze({
  [FEATURE_INCLUDED]: "compare.availability.included",
  [FEATURE_INCLUDED_USAGE_EXTRA]: "compare.availability.includedUsageExtra",
  [FEATURE_ADD_ON]: "compare.availability.addOn",
  [FEATURE_ABSENT]: "compare.availability.absent",
  [FEATURE_UNKNOWN]: "compare.availability.unknown",
});

export const AVAILABILITY_KEYS = Object.freeze(Object.values(AVAILABILITY_KEY));

/**
 * Every one of these takes `t` optionally and falls back to the module's own
 * English, so a caller with no translation context renders exactly what it
 * rendered before this file existed. That is not politeness — it is what lets
 * scripts/check-compare-pages.mjs keep asserting against English markup while
 * the pages themselves speak nine languages.
 */
const say = (t, key, fallback, values) =>
  typeof t === "function" ? t(key, fallback, values) : fallback;

export function capabilityLabel(capability, t) {
  const fallback = FIELDQUO_CAPABILITIES[capability]?.label ?? capability;
  return say(t, capabilityKey(capability), fallback);
}

export function teamSizeLabel(key, t) {
  const fallback = TEAM_SIZES[key]?.label ?? key;
  return say(t, teamSizeKey(key), fallback);
}

export function billingModeLabel(key, t) {
  const fallback = BILLING_MODES[key]?.label ?? key;
  return say(t, billingModeKey(key), fallback);
}

export function availabilityWord(availability, t) {
  const fallback = AVAILABILITY_FALLBACK[availability] ?? availability;
  const key = AVAILABILITY_KEY[availability];
  return key ? say(t, key, fallback) : fallback;
}
