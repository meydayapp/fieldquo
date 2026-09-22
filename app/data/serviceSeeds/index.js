// app/data/serviceSeeds/index.js
//
// The service list a company in each trade starts from — one file per trade,
// keyed by ServiceCategory.key, registered here so the bundler can see them.
//
// ── What a file holds ──────────────────────────────────────────────────────
//
//   trade        the ServiceCategory.key; equals the file name
//   categories   [{ key, name: { en, fr, es } }] — the headings a trade's
//                services sit under; nested source headings are flattened
//   services     [{
//     seedKey        "fq.<trade>.<category>.<slug>" — stable, ours, unique across
//                    every trade; what Product.seedKey stores so a re-seed can
//                    tell "already have it" from "new"
//     category       a key from `categories`
//     name           { en, fr, es } — real French (Quebec trade vocabulary)
//                    and real Spanish, not a word-for-word rendering
//     description    { en, fr, es } — one or two homeowner-facing sentences
//                    saying what is done; lands on the quote line's detail
//     unit           flat | each | sqft | linear_ft | hour
//     benchmark      null, or { low, median, high, currency: "USD",
//                    source: "benchmark", asOf } — national quartiles from an
//                    industry benchmark. `median` is pre-filled as the
//                    company's starting price at first seed; low/high are the
//                    guideline shown beside it. Null low/high = a point.
//     durationMinutes  where the source booked it with a length, else null
//     bookable       whether the service is offered on the online booking page
//     pricedBy       "takeoff" | "book" — a service the takeoff or the price
//                    book already prices; kept as a reference, NEVER written
//                    as a flat-priced Product (lib/services/seeds.js)
//     existing       a note where the current book/catalogue already has the
//                    equivalent, so the two are merged and not duplicated
//   }]
//
// ── The rules every file follows ───────────────────────────────────────────
//
//   - Descriptions are written in FieldQuo's own words. The benchmark's text
//     was read for meaning only; scripts/check-service-seeds.mjs holds a hash
//     of every source sentence and fails on a match.
//   - The benchmark's own base/placeholder prices are never stored — only the
//     quartiles. A service with no insight has `benchmark: null`, and the UI
//     says "set your rate"; it is never padded with a placeholder.
//   - Nothing here reaches a client-facing surface. The seeds write Product
//     rows and show a guideline to the contractor; the check asserts no
//     /quote, /book, /q, /portal, /site or /embed route imports this folder.
//   - The files import nothing, so a check can load them without the alias.
//   - Every row of every field-service industry in the benchmark is here —
//     the owner's word: "all of those should be saved in the services for our
//     quotes and trades too". The source's catch-all rows ("something else")
//     are kept as honest catch-alls so his row-by-row validation joins back.
//     The join itself — our seed key to the source's task code — lives in
//     scripts/service-seeds/source-map/<trade>.json, under scripts/ so it is
//     never bundled and never shipped.
//
// docs/SERVICE-SEEDS.md has the industry → trade mapping and the counts.

import { SEED as snow_removal } from "./snow_removal";

export const SERVICE_SEEDS = {
  snow_removal,
};
