// lib/sales/pipeline/handlers/index.js
//
// The one import the runner makes for side effects: importing this module is
// what puts real handlers into the registry.
//
// ══ One of the eight stages is real, and that is the honest state ══════════
//
// CRAWL_WEBSITE is implemented and imported below. The other seven are not,
// and the registry holds a "not implemented" stand-in for each, which records
// a terminal `abandoned` row naming the missing handler — so a pipeline run
// today reports exactly what is and is not built, rather than reporting
// success for work that did not happen.
//
// To add one, in the handler's own file:
//
//     import { registerHandler } from "@/lib/sales/pipeline/registry";
//     registerHandler("CRAWL_WEBSITE", async ({ task, payload,
//       idempotencyKey, now, db }) => { … });
//
// and then add the import below. The import must be here rather than in the
// handler's own consumer, because on Vercel the cron route is the only entry
// point that ever loads this code — a handler nobody imports is a handler that
// never registers, and the stage would keep reporting "not implemented" while
// the file sat in the tree looking finished.
//
// The list is deliberately explicit rather than a directory scan: a glob would
// make the set of live stages depend on what happens to be on disk, and
// bundlers do not resolve one anyway (see scripts/check-imports.mjs on why
// computed specifiers are not resolvable).

// ── Real handlers go here ──────────────────────────────────────────────────
//
// Imported for the side effect of registering. Nothing reads the binding; the
// import IS the registration, which is why it cannot be tree-shaken away and
// why HANDLER_MODULES below names it too — a list a check can assert against.
import "./crawlWebsite";

export const HANDLER_MODULES = ["CRAWL_WEBSITE"];
