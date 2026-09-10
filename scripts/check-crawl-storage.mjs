#!/usr/bin/env node
//
// scripts/check-crawl-storage.mjs
//
//   npm run check:crawl-storage
//
// What a crawl is allowed to WRITE, and proof that spending less does not
// detect less.
//
// ══ The measurement this file exists because of ════════════════════════════
//
// ProspectEvidence reached 943,540 rows across 2,328 crawled prospects — 405
// rows per prospect, 418 MB, 85% of a 512 MB database with 22 MB of headroom.
// 367,164 of those rows were `link`: a contractor's navigation, repeated in the
// header, the footer and a mobile drawer, on six crawled pages, is one fact
// stored eighteen times.
//
// So the writer now stores each distinct observation once per crawl and caps
// each type. That is a storage decision, and a storage decision that quietly
// loses a signal is the worst kind of saving — a rep is told a contractor has
// no booking page because we stopped writing the row that said they had one.
//
// ══ Therefore this file EXECUTES ═══════════════════════════════════════════
//
// It runs the real extractor over real HTML fixtures, the real writer over the
// extraction, and the real detectors over the rows — twice. Once through the
// writer as it was (every row, every page) and once through the writer as it
// is. The technologies, the capabilities, the trade, the rendered-page count
// and the absence eligibility must come out IDENTICAL. Anything less is not a
// saving, it is a regression with a smaller footprint.
//
// The three source-level rules at the end are read with comments STRIPPED.
// This file's own header names `dedupe`, `MAX_ROWS_PER_CRAWL` and `counts`;
// so does evidence.js's. A rule that matched prose would pass over deleted
// code, which is how two checks in this repo passed while proving nothing.

import { readFileSync } from "node:fs";

const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
const read = (f) => readFileSync(f, "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

// A crash is not a pass. The whole body runs inside main(); anything thrown
// lands as a failure with a name, and the exit code is the only verdict.
async function main() {
  const { contractorPages, hugeLinkPage, vendorPage, javascriptShellPage } = await import(
    "@/scripts/fixtures/contractorSite.mjs"
  );
  const { extractPage } = await import("@/lib/sales/crawl/html");
  const evidence = await import("@/lib/sales/crawl/evidence");
  const tech = await import("@/lib/sales/intel/technology");
  const cap = await import("@/lib/sales/intel/capabilityDetect");
  const trade = await import("@/lib/sales/intel/tradeDetect");
  const { seedSignatures } = await import("@/lib/sales/intel/signatureSeed");

  const extract = (p) =>
    extractPage({
      html: p.html,
      finalUrl: p.url,
      requestedUrl: p.url,
      status: 200,
      contentType: "text/html",
      bytes: p.html.length,
    });

  /** The writer as it stood before this work: every row of every page, and no
   *  `counts` in the fetch envelope, which is what every row already in the
   *  table looks like. This is the BEFORE side of every comparison below. */
  const unbounded = (pages) =>
    pages
      .flatMap((p) => evidence.pageEvidence(p))
      .map((row) => {
        if (row.type !== "page_fetch") return row;
        const envelope = JSON.parse(row.rawValue);
        delete envelope.counts;
        return { ...row, rawValue: JSON.stringify(envelope) };
      });

  const signatures = seedSignatures().filter((s) => s.active);
  const prospect = {
    id: "p_check",
    hasWebsite: true,
    websiteUrl: "https://acmepainting.ca/",
    tradeKey: null,
    businessName: "Acme Painting",
  };

  /** Everything the two consumers decide, as comparable strings. */
  function analyse(rows) {
    const crawl = tech.normaliseCrawl(tech.pagesFromEvidence(rows));
    const detected = tech.detectTechnologies({ signatures, crawl });
    const capabilities = cap.detectCapabilities({
      crawl,
      technologies: detected.technologies,
      prospect,
    });
    const inferred = trade.inferTrade({ crawl, prospect, siteBelongsToProspect: true });
    return {
      pagesConsidered: detected.pagesConsidered,
      rendered: capabilities.eligibility.rendered,
      deep: capabilities.eligibility.deep,
      siteWide: capabilities.eligibility.siteWide,
      technologies: detected.technologies.map((t) => `${t.technologyCode}@${t.confidence}`).sort(),
      capabilities: capabilities.capabilities.map((c) => `${c.code}=${c.value}@${c.confidence}`).sort(),
      trade: `${inferred.decision}:${inferred.tradeKey}`,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  section("1. A real six-page contractor site costs a fraction of what it did");
  // ═════════════════════════════════════════════════════════════════════════

  const site = contractorPages().map(extract);
  const before = unbounded(site);
  const after = evidence.crawlEvidence(site);

  const perPageBefore = before.length / site.length;
  const perPageAfter = after.length / site.length;
  console.log(
    `       ${site.length} pages · ${before.length} rows before (${perPageBefore.toFixed(1)}/page)` +
      ` · ${after.length} rows after (${perPageAfter.toFixed(1)}/page)` +
      ` · ${(100 - (after.length / before.length) * 100).toFixed(0)}% fewer`,
  );

  ok("the fixture is the shape the measurement was taken on", site.length === 6, site.length);
  ok(
    "the writer as it was cost more than 60 rows a page",
    perPageBefore > 60,
    Number(perPageBefore.toFixed(1)),
  );
  ok("…and the writer as it is costs under 30", perPageAfter < 30, Number(perPageAfter.toFixed(1)));
  ok(
    "…which is at least a threefold cut on this site",
    before.length / after.length >= 3,
    Number((before.length / after.length).toFixed(2)),
  );
  ok("a whole crawl of a small site stays under 200 rows", after.length < 200, after.length);

  // The type that was 39% of the table.
  const linksBefore = before.filter((r) => r.type === "link").length;
  const linksAfter = after.filter((r) => r.type === "link").length;
  console.log(`       link rows: ${linksBefore} → ${linksAfter}`);
  ok("link rows fall by at least two thirds", linksAfter <= linksBefore / 3, {
    linksBefore,
    linksAfter,
  });

  // ═════════════════════════════════════════════════════════════════════════
  section("2. Every distinct observation survives; only the repeats do not");
  // ═════════════════════════════════════════════════════════════════════════

  {
    // The fetch envelope is compared out of both sets: it is the ONE row whose
    // content this change alters, by adding `counts`, and comparing it against
    // the stripped copy the BEFORE side builds would only be re-testing the
    // stripping.
    const keys = (rows) => new Set(rows.filter((r) => r.type !== "page_fetch").map(evidence.dedupeKey));
    const distinctBefore = keys(before);
    const distinctAfter = keys(after);

    // Nothing was invented.
    ok(
      "no row is written that the old writer would not have written",
      [...distinctAfter].every((k) => distinctBefore.has(k)),
      [...distinctAfter].filter((k) => !distinctBefore.has(k)).slice(0, 3),
    );
    // And nothing distinct was lost — this site is under every cap, so the
    // only thing dedupe removed is duplication.
    const lost = [...distinctBefore].filter((k) => !distinctAfter.has(k));
    ok("…and no distinct observation is lost on a site under the caps", lost.length === 0, lost.slice(0, 3));

    const counted = new Map();
    for (const row of after) {
      if (row.type === "page_fetch" || row.type === "page_content") continue;
      const key = evidence.dedupeKey(row);
      counted.set(key, (counted.get(key) || 0) + 1);
    }
    const repeated = [...counted.entries()].filter(([, n]) => n > 1);
    ok("no deduplicated row is written twice in one crawl", repeated.length === 0, repeated.slice(0, 3));

    // The two exemptions are exemptions on purpose, and each page keeps its own.
    ok(
      "every page still writes its own fetch envelope",
      after.filter((r) => r.type === "page_fetch").length === site.length,
    );
    ok(
      "…and its own page_content, even when two pages read alike",
      after.filter((r) => r.type === "page_content").length === site.filter((p) => p.text).length,
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  section("3. A page with 500 links does not write 500 rows");
  // ═════════════════════════════════════════════════════════════════════════

  {
    const huge = extract(hugeLinkPage());
    ok("the fixture really does carry 500 anchors", hugeLinkPage().html.split("<a href=\"/page-").length - 1 === 500);

    const rows = evidence.crawlEvidence([huge]);
    const links = rows.filter((r) => r.type === "link");
    console.log(`       500-link page → ${rows.length} rows, ${links.length} of them links`);
    ok("the crawl writes fewer than 200 rows for it", rows.length < 200, rows.length);
    ok(
      "…and no more link rows than the per-crawl cap",
      links.length <= evidence.MAX_ROWS_PER_CRAWL.link,
      links.length,
    );

    // The cap must eat the archive, not the signal. Rank 0 and 1 are the
    // mailto/tel and the third-party hosts every detection is made of.
    const kept = new Set(links.map((r) => r.normalizedValue));
    ok("…and it keeps the tel: link", [...kept].some((v) => v.startsWith("tel:")), null);
    ok("…and the mailto: link", [...kept].some((v) => v.startsWith("mailto:")), null);
    ok(
      "…and every off-host link",
      [...kept].filter((v) => v.includes("facebook.com") || v.includes("instagram.com") || v.includes("g.page"))
        .length === 3,
      [...kept].filter((v) => !v.includes("acmepainting.ca")).length,
    );
    ok(
      "…while the deep archive pages are what falls off the end",
      links.filter((r) => /\/page-\d+$/.test(r.normalizedValue)).length < 500,
    );

    // Ranking is the reason the cap is safe, so it is asserted directly.
    const rank = (normalizedValue, sourceUrl) => evidence.linkRank({ normalizedValue, sourceUrl });
    ok("a tel: link outranks everything", rank("tel:+16135550142", "https://a.ca/") === 0);
    ok("an off-host link outranks an on-host one",
      rank("https://calendly.com/x", "https://a.ca/") < rank("https://a.ca/services", "https://a.ca/"));
    ok("a shallow route outranks a deep archive URL",
      rank("https://a.ca/services", "https://a.ca/") < rank("https://a.ca/blog/2024/05/11/post", "https://a.ca/"));
    ok("an unresolvable relative href is not mistaken for a third party",
      rank("/services", "https://a.ca/") > 1);
  }

  // ═════════════════════════════════════════════════════════════════════════
  section("4. The detectors decide exactly what they decided before");
  // ═════════════════════════════════════════════════════════════════════════

  {
    ok("the signature seed still has something to match with", signatures.length >= 10, signatures.length);

    // The vendor page is what makes this comparison mean anything: without a
    // detectable technology on it, "the same technologies were found" is a
    // comparison of two empty lists.
    const full = [...contractorPages(), vendorPage()].map(extract);
    const wasFound = analyse(unbounded(full));
    const isFound = analyse(evidence.crawlEvidence(full));

    ok("technologies are unchanged", JSON.stringify(wasFound.technologies) === JSON.stringify(isFound.technologies), {
      before: wasFound.technologies,
      after: isFound.technologies,
    });
    ok("…and there were technologies to find", wasFound.technologies.length >= 5, wasFound.technologies);
    ok(
      "…including the one that is only visible in a data-* attribute",
      isFound.technologies.some((t) => t.startsWith("HOUSECALL_PRO@")),
      isFound.technologies,
    );
    ok("capabilities are unchanged", JSON.stringify(wasFound.capabilities) === JSON.stringify(isFound.capabilities), {
      before: wasFound.capabilities,
      after: isFound.capabilities,
    });
    ok(
      "…and some of them were determined true",
      isFound.capabilities.filter((c) => c.includes("=true@")).length >= 5,
      isFound.capabilities,
    );
    ok("the trade is unchanged", wasFound.trade === isFound.trade, {
      before: wasFound.trade,
      after: isFound.trade,
    });
    ok("…and it was established", isFound.trade.startsWith("confirmed:"), isFound.trade);
    ok("the same pages are considered", wasFound.pagesConsidered === isFound.pagesConsidered, {
      before: wasFound.pagesConsidered,
      after: isFound.pagesConsidered,
    });
    ok("the same pages count as rendered", wasFound.rendered === isFound.rendered, {
      before: wasFound.rendered,
      after: isFound.rendered,
    });
    ok("…and absence is provable to the same depth", wasFound.deep === isFound.deep && wasFound.siteWide === isFound.siteWide, {
      before: [wasFound.deep, wasFound.siteWide],
      after: [isFound.deep, isFound.siteWide],
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  section("5. A page whose links are all shared is still a rendered page");
  // ═════════════════════════════════════════════════════════════════════════
  //
  // The one thing crawl-wide dedupe would have broken. /about carries nothing
  // but the shared navigation, so after dedupe it owns no link rows at all —
  // and looksRendered() reads "no links" as a JavaScript shell, withdraws the
  // page from the rendered set, and can take deep absence down with it.

  {
    const rows = evidence.crawlEvidence(site);
    const crawl = tech.normaliseCrawl(tech.pagesFromEvidence(rows));
    const about = crawl.pages.find((p) => (p.finalUrl || "").endsWith("/about"));
    ok("the shared-navigation page is in the crawl", Boolean(about), crawl.pages.map((p) => p.finalUrl));
    if (about) {
      ok("…and it genuinely owns no link rows of its own", about.links.length === 0, about.links.length);
      ok("…but the envelope remembers how many it had", about.linkCount > 0, about.linkCount);
      ok("…so it still reads as rendered", cap.looksRendered(about) === true);
      ok("…and linkCountOf prefers the count over the rows", cap.linkCountOf(about) === about.linkCount);
    }

    // The shell this rule exists to catch must still be caught.
    const shell = evidence.crawlEvidence([extract(javascriptShellPage())]);
    const shellCrawl = tech.normaliseCrawl(tech.pagesFromEvidence(shell));
    ok("a real JavaScript shell still has a zero count", shellCrawl.pages[0]?.linkCount === 0, shellCrawl.pages[0]?.linkCount);
    ok("…and still does not read as rendered", cap.looksRendered(shellCrawl.pages[0]) === false);

    // An inline payload and every row written before the counts existed carry
    // no count, and must fall back to the rows rather than to zero.
    const legacy = tech.normalisePage({ status: 200, text: "x".repeat(500), links: ["/a", "/b"] });
    ok("a snapshot with no count falls back to its rows", cap.linkCountOf(legacy) === 2, cap.linkCountOf(legacy));
    ok("…and normalisePage leaves the count null rather than inventing one", legacy.linkCount === null, legacy.linkCount);
  }

  // ═════════════════════════════════════════════════════════════════════════
  section("6. The mechanisms are in the source, not in the comments");
  // ═════════════════════════════════════════════════════════════════════════

  {
    const writer = decomment(read("lib/sales/crawl/evidence.js"));
    ok("crawlEvidence dedupes", /const\s+seen\s*=\s*new Set\(\)/.test(writer) && /seen\.has\(key\)/.test(writer));
    ok("…keyed on the type and both value columns", /export function dedupeKey/.test(writer));
    ok("…and the fetch envelope carries the pre-dedupe counts", /counts:\s*\{/.test(writer));
    ok("a per-crawl cap exists per type", /MAX_ROWS_PER_CRAWL\s*=\s*Object\.freeze\(/.test(writer));
    ok("…and it is applied, not merely declared", /MAX_ROWS_PER_CRAWL\)/.test(writer));
    ok("…and links are ranked before it bites", /RANKED\s*=\s*\{\s*link:\s*linkRank/.test(writer));
    ok(
      "the two types a dedupe must not touch are named",
      /NEVER_DEDUPED\s*=\s*new Set\(\["page_fetch",\s*"page_content"\]\)/.test(writer),
    );

    const reader = decomment(read("lib/sales/intel/capabilityDetect.js"));
    ok("looksRendered asks the count, not the rows", /return linkCountOf\(page\) > 0/.test(reader));
    ok("…and no longer reads links.length there", !/return page\.links\.length > 0/.test(reader));

    const snapshot = decomment(read("lib/sales/intel/technology.js"));
    ok("the snapshot carries linkCount", /linkCount: Number\.isInteger\(page\.linkCount\)/.test(snapshot));
    ok("…and it is read off the envelope", /envelope\.counts\?\.links/.test(snapshot));
  }

  // ═════════════════════════════════════════════════════════════════════════
  section("7. The check is wired in");
  // ═════════════════════════════════════════════════════════════════════════

  {
    const pkg = JSON.parse(read("package.json"));
    ok("check:crawl-storage is a script", typeof pkg.scripts?.["check:crawl-storage"] === "string");
    ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:crawl-storage"));
  }
}

main().then(
  () => {
    console.log(`\n${pass} checks, ${failures.length} failure(s).`);
    if (failures.length) {
      for (const f of failures) console.log(`  · ${f}`);
      process.exit(1);
    }
  },
  (error) => {
    // A crash prints no FAIL lines, which reads exactly like a pass to anybody
    // grepping the output. It is not one, and the exit code says so.
    console.log(`\n  FAIL the check itself threw — ${error?.stack || error}`);
    console.log(`\n${pass} checks, ${failures.length + 1} failure(s).`);
    process.exit(1);
  },
);
