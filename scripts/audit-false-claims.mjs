#!/usr/bin/env node
//
// scripts/audit-false-claims.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/audit-false-claims.mjs [--sample 300] [--seed 7]
//
// READ-ONLY. For a random sample of prospects that carry a `false` deep
// capability verdict — "no online booking", "no enquiry form", "no client
// portal" — this prints which pages were rendered for the verdict and
// whether a signal the crawler stored CONTRADICTS it:
//
//   · js_shell   the crawl holds a JavaScript shell (capabilityDetect.jsShell
//                on the rebuilt pages): the site was never read, and a
//                false written by an older detector off it is unearned.
//   · schema     the site's own JSON-LD states the thing the verdict denies
//                (a telephone beside PHONE_CONTACT=false, a ReserveAction
//                beside ONLINE_BOOKING=false, a Review beside
//                ONLINE_REVIEWS=false…) — schemaFacts.js.
//   · sitemap    a `sitemap_url` row names a page of the kind the verdict
//                would have needed (a /book-online beside ONLINE_BOOKING=
//                false, a /contact beside LEAD_CAPTURE_FORM=false) that was
//                NOT among the pages rendered.
//   · re-detect  the CURRENT detector, run over the stored evidence, no
//                longer says false (it says null, or true).
//
// It reports the numbers and the first few examples, and writes nothing —
// the count is what the owner decides a re-crawl on. Run after
// capabilityDetect.js version 4 landed (2026-09-14); a prospect whose rows
// predate the crawler's version 3 has no sitemap or rendered_text rows,
// which is itself reported.
//
// ══ Measured on 2026-09-14 (300 random prospects with a deep false) ═══════
//
// See the "Measured" block printed by the run; the numbers at the time of
// writing are recorded in docs/sales-intel/CRAWLING.md under "Measured".
import "dotenv/config";
import { db } from "@/lib/db";
import { detectCapabilities, jsShell } from "@/lib/sales/intel/capabilityDetect";
import { normaliseCrawl, pagesFromEvidence } from "@/lib/sales/intel/technology";
import { schemaFacts } from "@/lib/sales/intel/schemaFacts";
import { slugKind } from "@/lib/sales/crawl/url";
import { CRAWL_EVIDENCE_TYPES } from "@/lib/sales/pipeline/handlers/detectTechnology";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const SAMPLE = Number(flag("sample", 300));
const SEED = Number(flag("seed", 7));

const DEEP = ["ONLINE_BOOKING", "INSTANT_ESTIMATE", "LEAD_CAPTURE_FORM", "CLIENT_PORTAL", "ONLINE_PAYMENT", "ONLINE_REVIEWS"];

/** Which navigation kinds (url.js) would have carried the signal a false
 *  denies — a sitemap naming one the crawl did not render is the
 *  contradiction. */
const KINDS_FOR = {
  ONLINE_BOOKING: ["booking"],
  INSTANT_ESTIMATE: ["quote"],
  LEAD_CAPTURE_FORM: ["contact", "quote"],
  CLIENT_PORTAL: ["portal"],
  ONLINE_PAYMENT: ["payment"],
  ONLINE_REVIEWS: ["reviews"],
};

/** Which schema fact contradicts which false. */
const SCHEMA_CONTRADICTS = {
  ONLINE_BOOKING: (f) => Boolean(f.bookingAction),
  ONLINE_REVIEWS: (f) => f.aggregateRating || f.reviews > 0,
  PHONE_CONTACT: (f) => f.telephone.length > 0,
  EMAIL_CONTACT: (f) => f.email.length > 0,
  PUBLISHED_HOURS: (f) => f.hours,
};

// A seeded shuffle so a run is reproducible and a second run can be compared.
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const rand = mulberry(SEED);
  const ids = await db.prospectCapability.findMany({
    where: { value: false, code: { in: DEEP } },
    select: { prospectId: true },
    distinct: ["prospectId"],
  });
  const pool = ids.map((r) => r.prospectId);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const sample = pool.slice(0, SAMPLE);
  console.log(`${pool.length} prospects carry a false deep verdict; auditing ${sample.length} (seed ${SEED})\n`);

  const totals = {
    prospects: 0,
    falseVerdicts: 0,
    oldDetector: 0,
    jsShell: 0,
    schemaContradiction: 0,
    sitemapContradiction: 0,
    redetectNotFalse: 0,
    anyContradiction: 0,
    noSitemapRows: 0,
  };
  const examples = [];

  for (const prospectId of sample) {
    const [prospect, caps, rows] = await Promise.all([
      db.prospect.findUnique({ where: { id: prospectId }, select: { id: true, businessName: true, websiteUrl: true } }),
      db.prospectCapability.findMany({ where: { prospectId, value: false }, select: { code: true, detectorVersion: true, evidenceIds: true } }),
      db.prospectEvidence.findMany({
        where: { prospectId, source: "website", type: { in: [...CRAWL_EVIDENCE_TYPES, "sitemap_url"] } },
        orderBy: { observedAt: "desc" },
        take: 5000,
        select: { type: true, sourceUrl: true, rawValue: true, normalizedValue: true, observedAt: true },
      }),
    ]);
    if (!prospect) continue;
    totals.prospects += 1;

    const crawlRows = rows.filter((r) => r.type !== "sitemap_url");
    const crawl = normaliseCrawl(pagesFromEvidence(crawlRows));
    const rendered = crawl.pages.filter((p) => p.ok === true).map((p) => p.finalUrl);
    const shells = crawl.pages.filter((p) => jsShell(p));
    const sitemapPaths = rows.filter((r) => r.type === "sitemap_url").map((r) => String(r.normalizedValue || ""));
    if (!sitemapPaths.length) totals.noSitemapRows += 1;
    const renderedPaths = new Set(rendered.map((u) => { try { return new URL(u).pathname.replace(/\/+$/, "") || "/"; } catch { return u; } }));
    const facts = crawl.pages.map((p) => schemaFacts(p));
    const redetected = detectCapabilities({ crawl, technologies: [], prospect });

    const perProspect = { id: prospectId, name: prospect.businessName, url: prospect.websiteUrl, rendered, contradictions: [] };
    let any = false;
    for (const cap of caps) {
      totals.falseVerdicts += 1;
      const reasons = [];
      if (String(cap.detectorVersion || "") !== "4") totals.oldDetector += 1;
      if (shells.length) reasons.push("js_shell");
      const contradict = SCHEMA_CONTRADICTS[cap.code];
      if (contradict && facts.some((f) => f.parsed && contradict(f))) reasons.push("schema");
      const kinds = KINDS_FOR[cap.code] || [];
      const named = sitemapPaths.filter((p) => kinds.includes(slugKind(p).kind) && !renderedPaths.has(p.replace(/\/+$/, "") || "/"));
      if (named.length) reasons.push(`sitemap:${named[0]}`);
      const now = redetected.capabilities.find((c) => c.code === cap.code);
      if (now && now.value !== false) reasons.push(`re-detect:${now.value === null ? `null(${now.reason})` : "true"}`);
      if (reasons.length) {
        any = true;
        if (reasons.includes("js_shell")) totals.jsShell += 1;
        if (reasons.includes("schema")) totals.schemaContradiction += 1;
        if (reasons.some((r) => r.startsWith("sitemap:"))) totals.sitemapContradiction += 1;
        if (reasons.some((r) => r.startsWith("re-detect:"))) totals.redetectNotFalse += 1;
        perProspect.contradictions.push({ code: cap.code, version: cap.detectorVersion, reasons });
      }
    }
    if (any) {
      totals.anyContradiction += 1;
      if (examples.length < 12) examples.push(perProspect);
    }
  }

  console.log("Measured:");
  console.log(`  prospects audited            ${totals.prospects}`);
  console.log(`  false verdicts, every code   ${totals.falseVerdicts}`);
  console.log(`  …written by a detector < 4   ${totals.oldDetector}`);
  console.log(`  …on a crawl holding a shell  ${totals.jsShell}`);
  console.log(`  …contradicted by JSON-LD     ${totals.schemaContradiction}`);
  console.log(`  …contradicted by the sitemap ${totals.sitemapContradiction}  (${totals.noSitemapRows} prospects have no sitemap rows yet — crawled before v3)`);
  console.log(`  …no longer false on re-detect ${totals.redetectNotFalse}`);
  console.log(`  prospects with any contradiction ${totals.anyContradiction} of ${totals.prospects}`);
  console.log("\nExamples:");
  for (const ex of examples) {
    console.log(`\n  ${ex.name} — ${ex.url}`);
    console.log(`    rendered: ${ex.rendered.join(", ") || "(none)"}`);
    for (const c of ex.contradictions) console.log(`    ${c.code}=false (v${c.version || "?"}) ← ${c.reasons.join(", ")}`);
  }
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
