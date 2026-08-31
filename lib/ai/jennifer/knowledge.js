// lib/ai/jennifer/knowledge.js
//
// What Jennifer is allowed to KNOW, per mode. Two completely different
// sources on purpose:
//
//   anonymous — lib/platform/salesKnowledge.js. FieldQuo already has a sales
//   knowledge base, driven from the Plan and PlatformFeature tables rather
//   than hand-typed, with its own rule that a claim traces to something the
//   build already proves (see scripts/check-sales-agent.mjs). Jennifer reuses
//   it rather than writing a second set of claims that can drift from the
//   first — two knowledge bases about the same product is how one of them
//   goes stale and nobody notices which.
//
//   company — docs/SUPPORT-GUIDE.md, read whole. It was written for exactly
//   this ("written for a first-line AI support agent answering a
//   contractor's question" — its own header says so) and is Part 1 through
//   Part 6 of what tier-1 support may say. Nothing here re-derives or
//   summarises it; summarising a support doc by hand is how it drifts from
//   the doc a human edits.
import fs from "node:fs";
import path from "node:path";
import { salesKnowledge, renderSalesKnowledge } from "@/lib/platform/salesKnowledge";

/**
 * The anonymous-mode knowledge block: FieldQuo's own sales facts, rendered
 * exactly as the sales agent renders them. Async because salesKnowledge()
 * reads Plan and PlatformFeature — a price or a feature toggled off since the
 * last deploy must be reflected on the next request, not baked in at build
 * time.
 */
export async function anonymousKnowledge() {
  const kb = await salesKnowledge();
  return renderSalesKnowledge(kb);
}

// Read once per server instance, not per request. The doc is a build
// artefact, not something that changes between two requests seconds apart —
// re-reading a ~20KB file from disk on every message a visitor sends would be
// pure waste. A deploy restarts the process, so a doc update reaches the next
// cold start the same way any other code change does.
let cachedSupportGuide = null;

/**
 * The company-mode knowledge block: the support guide, verbatim.
 *
 * Never throws. A missing or unreadable file must degrade to "no extra
 * knowledge beyond what the prompt already says" rather than 500 the whole
 * conversation — the same "never let a nice-to-have summary crash a working
 * page" rule lib/ai/provider.js's complete() follows.
 */
export function companyKnowledge() {
  if (cachedSupportGuide !== null) return cachedSupportGuide;

  try {
    const filePath = path.join(process.cwd(), "docs", "SUPPORT-GUIDE.md");
    cachedSupportGuide = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error("[jennifer/knowledge] couldn't read SUPPORT-GUIDE.md:", err?.message);
    cachedSupportGuide = "";
  }

  return cachedSupportGuide;
}

/** Test-only: forces the next companyKnowledge() call to re-read the file. */
export function _resetCompanyKnowledgeCache() {
  cachedSupportGuide = null;
}
