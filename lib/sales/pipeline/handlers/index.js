// lib/sales/pipeline/handlers/index.js
//
// The one import the runner makes for side effects: importing this module is
// what puts real handlers into the registry.
//
// ══ All eight stages are real ══════════════════════════════════════════════
//
// Every kind in TASK_KINDS is imported below and registers a handler, so the
// registry holds no "not implemented" stand-in and `handlerStatus()` reports
// eight implemented stages. That is a claim the cron's response body makes on
// every tick, so it is checked rather than asserted: HANDLER_MODULES below
// must equal TASK_KINDS, and scripts/check-sales-brief.mjs compares them.
//
// The order below is the order the pipeline runs them, which is documented in
// lib/sales/pipeline/chain.js — one file that says what follows what, rather
// than eight files each naming their own successor.
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
import "./discoverBusinesses";
import "./enrichBusiness";
import "./crawlWebsite";
import "./detectTechnology";
import "./analyzeCapabilities";
import "./detectOpportunities";
import "./calculateLeadScore";
import "./generateResearchBrief";

export const HANDLER_MODULES = [
  "DISCOVER_BUSINESSES",
  "ENRICH_BUSINESS",
  "CRAWL_WEBSITE",
  "DETECT_TECHNOLOGY",
  "ANALYZE_CAPABILITIES",
  "DETECT_OPPORTUNITIES",
  "CALCULATE_LEAD_SCORE",
  "GENERATE_RESEARCH_BRIEF",
];
