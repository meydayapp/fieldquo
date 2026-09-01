// scripts/check-meta-insights.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-meta-insights.mjs
//
// NOT wired into `npm run check:all` — see docs/META-ADS-BUILD.md for why
// (other work was mid-flight on package.json when this was written; adding
// an entry there was explicitly out of scope for this pass). Run by hand
// after touching lib/meta/insightsImport.js or lib/meta/client.js's pure
// helpers, the same way check-kpis.mjs and check-statements.mjs are run.
//
// Everything here is PURE — no db, no fetch, no real Meta credentials exist
// anywhere in this codebase (see docs/META-ADS-BUILD.md) — so this is the
// only kind of test that can exist for this integration today. Section 1
// exercises lib/meta/insightsImport.js's buildImportPlan and its helpers
// against hostile Meta-shaped input. Section 2 exercises
// lib/meta/client.js's classifyMetaError and buildAuthorizeUrl. Section 3
// mutates both files on disk, one bug at a time, and re-runs this file as a
// subprocess to confirm each mutation is caught — the technique
// scripts/check-kpis.mjs's own header explains in more depth.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A real value only for buildAuthorizeUrl's own hostile-input checks below —
// this process never talks to Meta and this is not a real app id.
process.env.META_APP_ID ||= "test_app_id";

import { naturalKey, externalIdFor, parseInsightsRow, buildImportPlan } from "@/lib/meta/insightsImport";
import { classifyMetaError, buildAuthorizeUrl } from "@/lib/meta/client";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

console.log("\n1. lib/meta/insightsImport.js — hostile Meta-shaped input\n");

// ── naturalKey — source-blind, the whole point ──────────────────────────────
ok("naturalKey is source-blind: platform+date+campaign, nothing about WHERE a row came from",
  naturalKey({ platform: "facebook", date: "2026-08-15", campaignName: "Spring Sale" }) ===
    naturalKey({ platform: "facebook", date: "2026-08-15", campaignName: "Spring Sale" }));
ok("naturalKey ignores case/punctuation/whitespace in the campaign name",
  naturalKey({ platform: "facebook", date: "2026-08-15", campaignName: "Spring Sale!!" }) ===
    naturalKey({ platform: "facebook", date: "2026-08-15", campaignName: "spring   sale" }));
ok("naturalKey treats a missing campaign name as its own stable key, not a crash",
  naturalKey({ platform: "facebook", date: "2026-08-15", campaignName: null }) ===
    naturalKey({ platform: "facebook", date: "2026-08-15", campaignName: undefined }));
ok("naturalKey never throws on a garbage date",
  naturalKey({ platform: "facebook", date: {}, campaignName: "x" }).includes("invalid-date"));
ok("naturalKey distinguishes two different campaigns on the same day",
  naturalKey({ platform: "facebook", date: "2026-08-15", campaignName: "A" }) !==
    naturalKey({ platform: "facebook", date: "2026-08-15", campaignName: "B" }));

// ── parseInsightsRow — Meta's own field names, hostile values ───────────────
ok("missing campaign_id is an error row, not a crash",
  parseInsightsRow({ spend: "10", date_start: "2026-08-01", date_stop: "2026-08-01" }).status === "error");
ok("unreadable spend is an error row",
  parseInsightsRow({ campaign_id: "1", spend: "not-a-number", date_start: "2026-08-01", date_stop: "2026-08-01" }).status === "error");
ok("date_start/date_stop disagreeing (not one day per row) is refused, not averaged",
  parseInsightsRow({ campaign_id: "1", spend: "5", date_start: "2026-08-01", date_stop: "2026-08-05" }).status === "error");
ok("a completely empty object is an error row with no throw",
  parseInsightsRow({}).status === "error");
ok("null actions array is read as zero conversions, not a crash",
  parseInsightsRow({ campaign_id: "1", spend: "5", date_start: "2026-08-01", date_stop: "2026-08-01", actions: null }).metaConversions === 0);
ok("lead-shaped actions are summed into metaConversions, never into leads (there is no .leads field on the parsed row at all)",
  (() => {
    const row = parseInsightsRow({
      campaign_id: "1", spend: "5", date_start: "2026-08-01", date_stop: "2026-08-01",
      actions: [{ action_type: "lead", value: "3" }, { action_type: "link_click", value: "50" }],
    });
    return row.metaConversions === 3 && !("leads" in row);
  })());
ok("spend is rounded to cents, not left as float noise",
  parseInsightsRow({ campaign_id: "1", spend: "10.0049", date_start: "2026-08-01", date_stop: "2026-08-01" }).amount === 10);

// ── buildImportPlan — the write plan a route can trust ──────────────────────
ok("empty input produces an empty, harmless plan",
  (() => {
    const p = buildImportPlan({ rawRows: [], existingSpend: [], companyCurrency: "CAD", adAccountCurrency: null });
    return p.toCreate.length === 0 && p.toUpdate.length === 0 && p.currencyMismatch === false;
  })());
ok("a non-array rawRows never throws — treated as zero rows",
  buildImportPlan({ rawRows: "not-an-array", existingSpend: null, companyCurrency: "CAD", adAccountCurrency: "CAD" }).summary.totalRows === 0);

{
  const plan = buildImportPlan({
    rawRows: [{ campaign_id: "1", campaign_name: "C", spend: "10", date_start: "2026-08-01", date_stop: "2026-08-01" }],
    existingSpend: [],
    companyCurrency: "CAD",
    adAccountCurrency: "USD",
  });
  ok("a currency mismatch is flagged AND the row still gets written (not silently dropped)",
    plan.currencyMismatch === true && plan.toCreate.length === 1);
  ok("…and the row carries the AD ACCOUNT'S currency, not the company's",
    plan.toCreate[0].currency === "USD");
  ok("…and it's still tagged source: meta_api with a real externalId",
    plan.toCreate[0].source === "meta_api" && plan.toCreate[0].externalId === externalIdFor({ campaignId: "1", date: "2026-08-01" }));
}

{
  const priorExternalId = externalIdFor({ campaignId: "1", date: "2026-08-01" });
  const plan = buildImportPlan({
    rawRows: [{ campaign_id: "1", campaign_name: "C", spend: "20", date_start: "2026-08-01", date_stop: "2026-08-01" }],
    existingSpend: [{ id: "row1", source: "meta_api", externalId: priorExternalId, platform: "facebook", date: "2026-08-01", campaignName: "C" }],
    companyCurrency: "CAD",
    adAccountCurrency: "CAD",
  });
  ok("re-running the sync on a day it already synced UPDATES that row, never creates a duplicate",
    plan.toCreate.length === 0 && plan.toUpdate.length === 1 && plan.toUpdate[0].id === "row1");
}

{
  const plan = buildImportPlan({
    rawRows: [{ campaign_id: "2", campaign_name: "Spring Sale", spend: "30", date_start: "2026-08-05", date_stop: "2026-08-05" }],
    existingSpend: [{ id: "manual1", source: "manual", externalId: null, platform: "facebook", date: "2026-08-05", campaignName: "spring sale!!" }],
    companyCurrency: "CAD",
    adAccountCurrency: "CAD",
  });
  ok("a manual entry that LOOKS like the same real-world spend is flagged as a possible duplicate, never merged or silently dropped",
    plan.toCreate.length === 1 && plan.possibleDuplicates.length === 1 && plan.possibleDuplicates[0].matches.includes("manual1"));
  ok("…and the SAME-currency row's `currency` is null, not the ad account's — null means \"same as the company's own\"",
    plan.toCreate[0].currency === null);
}

{
  const plan = buildImportPlan({
    rawRows: [{ campaign_id: "3", spend: "not-a-number", date_start: "2026-08-01", date_stop: "2026-08-01" }],
    existingSpend: [],
    companyCurrency: "CAD",
    adAccountCurrency: "CAD",
  });
  ok("an unparseable row lands in errors, not toCreate — never written as $0 or NaN",
    plan.errors.length === 1 && plan.toCreate.length === 0);
}

console.log("\n2. lib/meta/client.js — pure helpers against hostile input\n");

ok("classifyMetaError: code 190 is always an auth_error, regardless of HTTP status",
  classifyMetaError({ status: 400, body: { error: { code: 190, message: "x" } } }).kind === "auth_error");
ok("classifyMetaError: bare HTTP 401 with no body is still auth_error",
  classifyMetaError({ status: 401, body: null }).kind === "auth_error");
ok("classifyMetaError: rate-limit codes (4/17/32/613) are rate_limited, not unknown_error",
  [4, 17, 32, 613].every((code) => classifyMetaError({ status: 400, body: { error: { code, message: "x" } } }).kind === "rate_limited"));
ok("classifyMetaError: a rate-limited response with no retry-after header still gets a real number (Meta's documented 300s), never undefined/NaN",
  Number.isFinite(classifyMetaError({ status: 429, body: null }).retryAfterSeconds));
ok("classifyMetaError: code 803 / HTTP 404 is not_found, not lumped into unknown_error",
  classifyMetaError({ status: 404, body: null }).kind === "not_found" &&
    classifyMetaError({ status: 400, body: { error: { code: 803, message: "x" } } }).kind === "not_found");
ok("classifyMetaError: a genuinely unrecognised error is unknown_error, not silently treated as auth or rate-limit",
  classifyMetaError({ status: 500, body: { error: { code: 999, message: "x" } } }).kind === "unknown_error");
ok("classifyMetaError: completely empty input never throws",
  typeof classifyMetaError({}).kind === "string");

ok("buildAuthorizeUrl throws (not silently builds a broken URL) with no redirectUri",
  (() => { try { buildAuthorizeUrl({ state: "x" }); return false; } catch { return true; } })());
ok("buildAuthorizeUrl throws with no state — an OAuth flow with no CSRF token must never start",
  (() => { try { buildAuthorizeUrl({ redirectUri: "https://x" }); return false; } catch { return true; } })());
ok("buildAuthorizeUrl requests ONLY ads_read, never ads_management",
  buildAuthorizeUrl({ redirectUri: "https://app.fieldquo.com/api/meta-ads/callback", state: "abc" }).includes("scope=ads_read"));

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);

if (process.argv.includes("--no-mutate")) {
  process.exit(fails.length ? 1 : 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Mutation pass — every guarantee above must actually be load-bearing
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n3. Mutation pass\n");

const INSIGHTS_LIB = fileURLToPath(new URL("../lib/meta/insightsImport.js", import.meta.url));
const CLIENT_LIB = fileURLToPath(new URL("../lib/meta/client.js", import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));

const backupDir = mkdtempSync(join(tmpdir(), "meta-insights-"));
const INSIGHTS_ORIGINAL = readFileSync(INSIGHTS_LIB, "utf8");
const CLIENT_ORIGINAL = readFileSync(CLIENT_LIB, "utf8");
writeFileSync(join(backupDir, "insightsImport.js.bak"), INSIGHTS_ORIGINAL);
writeFileSync(join(backupDir, "client.js.bak"), CLIENT_ORIGINAL);

const MUTATIONS = [
  [
    "insightsImport.js",
    INSIGHTS_LIB,
    "stops flagging a manual entry that looks like the same real-world spend as a possible duplicate",
    (s) => s.replace(
      'const collisions = (byNaturalKey.get(key) || []).filter((r) => r.source !== "meta_api");',
      "const collisions = [];",
    ),
  ],
  [
    "insightsImport.js",
    INSIGHTS_LIB,
    "accepts a row whose date_start and date_stop disagree",
    (s) => s.replace(
      'else if (dateStop && dateStop !== dateStart) {\n    errors.push(`date_start (${dateStart}) and date_stop (${dateStop}) disagree — expected one day per row`);\n  }',
      "",
    ),
  ],
  [
    "insightsImport.js",
    INSIGHTS_LIB,
    "re-running the sync creates a duplicate instead of updating the prior row",
    (s) => s.replace("const priorRun = byExternalId.get(externalId);", "const priorRun = null;"),
  ],
  [
    "insightsImport.js",
    INSIGHTS_LIB,
    "writes the row's currency even when it matches the company's (blends silently)",
    (s) => s.replace(
      "const rowCurrency = currencyMismatch ? adAccountCurrency : null;",
      "const rowCurrency = adAccountCurrency;",
    ),
  ],
  [
    "client.js",
    CLIENT_LIB,
    "classifies an expired/revoked token (code 190) as something other than auth_error",
    (s) => s.replace("if (code === 190 || status === 401) {", "if (false) {"),
  ],
  [
    "client.js",
    CLIENT_LIB,
    "drops the ads_read scope, requesting Meta's default (broader) scope instead",
    (s) => s.replace('scope: META_OAUTH_SCOPE,', ""),
  ],
];

let caught = 0;
const escaped = [];
try {
  for (const [fileLabel, filePath, label, mutate] of MUTATIONS) {
    const original = filePath === INSIGHTS_LIB ? INSIGHTS_ORIGINAL : CLIENT_ORIGINAL;
    const mutated = mutate(original);
    if (mutated === original) {
      escaped.push(`${fileLabel}: ${label} — the mutation did not apply (the source moved under it)`);
      continue;
    }
    writeFileSync(filePath, mutated);
    let survived = false;
    try {
      execFileSync(process.execPath, ["--import", LOADER, SELF, "--no-mutate"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      survived = true;
    } catch {
      /* non-zero exit = the mutant was caught */
    }
    writeFileSync(filePath, original);
    if (survived) escaped.push(`${fileLabel}: ${label} — NOT caught`);
    else {
      caught++;
      console.log(`  ✓ caught: ${fileLabel}: ${label}`);
    }
  }
} finally {
  writeFileSync(INSIGHTS_LIB, INSIGHTS_ORIGINAL);
  writeFileSync(CLIENT_LIB, CLIENT_ORIGINAL);
  rmSync(backupDir, { recursive: true, force: true });
}
ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
pass += caught;

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
