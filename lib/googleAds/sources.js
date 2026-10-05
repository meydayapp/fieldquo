// lib/googleAds/sources.js
//
// The MarketingSpend.source values a sync or an import writes — as opposed to
// "manual", a person typing a row in. One list, read by the PATCH route (which
// refuses to edit a row the next sync would overwrite), the Spend page (which
// draws no Edit button on one) and lib/googleAds/spendPlan.js. Its own file,
// with no imports, so the Spend page can read it without pulling the report
// parser (and papaparse) into the browser bundle.

export const GOOGLE_SOURCES = Object.freeze(["google_ads_csv", "google_ads_api"]);
export const SYNCED_SOURCES = Object.freeze(["meta_api", ...GOOGLE_SOURCES]);

export function isSyncedSource(source) {
  return SYNCED_SOURCES.includes(source);
}
