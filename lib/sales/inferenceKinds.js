// lib/sales/inferenceKinds.js
//
// The `ProspectInference.kind` strings that more than one layer has to agree
// on.
//
// ══ Why this file exists, and why it imports NOTHING ═══════════════════════
//
// It is the same file, for the same reason, as lib/sales/contactBasis.js, and
// that file's header records the failure both of them exist to prevent:
//
//   lib/sales/prospectView.js is a PRESENTER and is imported by
//   app/sales/queue/page.js, which is a client component. So everything
//   prospectView imports, transitively, is compiled for the browser. Anything
//   that reaches lib/sales/suppressionRules.js reaches lib/voice/numbers.js,
//   which reaches lib/db.js, which reaches `pg` — and the build fails trying
//   to resolve Node's `dns` module for a browser bundle.
//
// contactBasis.js was carved out when the CASL rule tripped that chain. This
// file was carved out hours later when `DERIVED_SITE_INFERENCE_KIND` tripped
// the SAME chain from a different direction: the constant was defined in
// lib/sales/discovery/normalise.js, which imports `normaliseDomain` from
// suppressionRules — so prospectView importing one bare string dragged the
// Postgres driver into the rep's queue page for the second time in a day.
//
// The lesson the second occurrence teaches, which the first did not: the
// property worth holding is not "the consent rule is pure", it is "nothing
// prospectView reaches, at any depth, imports lib/db". A constant is exactly
// the kind of thing somebody puts in whichever file feels topical, and
// topical files import things. So shared vocabulary lives here, with no
// imports, and scripts/check-rbq-provider.mjs now walks the whole graph rather
// than asserting about one module.
//
// ── What belongs here ─────────────────────────────────────────────────────
//
// A kind string that BOTH a writer and a reader need. `TRADE_INFERENCE_KIND`
// deliberately stays in lib/sales/intel/tradeDetect.js: it is owned by one
// detector, that detector is already browser-safe, and moving it would be
// churn for no property. This file is not a dumping ground for constants — it
// is the ones whose two ends sit on opposite sides of the client boundary.

/**
 * A website DERIVED rather than published — today, from a Quebec RBQ licence
 * email. See lib/sales/discovery/rbq/derivedSite.js.
 *
 * Four files must spell this identically: lib/sales/discovery/normalise.js
 * shapes the envelope, lib/sales/discovery/ingest.js writes the row,
 * lib/sales/intel/db.js reads it back for the crawler and the trade gate, and
 * lib/sales/prospectView.js renders it. A second spelling in any of them is a
 * row written and never read, and it would fail SILENTLY — as a queue that
 * never fills.
 */
export const DERIVED_SITE_INFERENCE_KIND = "derived_site";
