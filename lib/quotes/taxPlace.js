// lib/quotes/taxPlace.js
//
// "New York, NY" — the client's own place, for the builder's tax hint that
// would otherwise ask for a country and province that are already on file.
//
// The "not worked out" sentence under the tax line (QuoteTotalsBar) told
// everyone to "set the client's country and province" — including the
// estimator looking at Q-2026-0003, whose client had country US and province
// NY from Google's autocomplete. Nothing was missing (at the time the US
// path applied no rate by design; it applies the combined rate now). A
// sentence asking for something already done reads as the software being
// broken, so the hint names the place and says no rate is known for it yet
// — and lib/tax/taxLine.js only shows that hint when the RATE is unknown,
// never merely because the tax amount on an empty quote is $0.
//
// Null unless BOTH the country and the province are set: those are the two
// fields the resolver keys on (lib/tax/resolveTaxRate.js), so a client
// missing either genuinely needs the sentence that asks for them. City, then
// county, then the province alone — whatever the record can honestly name.
// Pure, so scripts/check-quote-builder.mjs executes it.

export function taxPlaceOf(client) {
  if (!client || typeof client !== "object") return null;
  const country = String(client.country || "").trim();
  const province = String(client.province || "").trim();
  if (!country || !province) return null;
  const local = String(client.city || client.county || "").trim();
  return local ? `${local}, ${province}` : province;
}
