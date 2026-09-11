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
import { classifyMetaError, buildAuthorizeUrl, CAMPAIGN_INSIGHT_FIELDS } from "@/lib/meta/client";

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
  // MarketingSpend.date is a DateTime column. The owner's first real sync
  // (three live campaigns) 500'd on a Prisma validation error because the row
  // carried Meta's "YYYY-MM-DD" string here. A Date at midnight UTC, or it is
  // not a row Prisma will write.
  ok("the row's date is a real Date, not Meta's YYYY-MM-DD string",
    plan.toCreate[0].date instanceof Date && !Number.isNaN(plan.toCreate[0].date.getTime()));
  ok("…at midnight UTC of the day Meta reported",
    plan.toCreate[0].date.toISOString() === "2026-08-01T00:00:00.000Z");
}

{
  // The refresh route's "which stored forms are stale" count used a literal
  // NUL byte as a stand-in for an empty `notIn` list. Postgres refuses NUL in
  // text (22021), so a contractor with no lead forms — the first real one —
  // got a 500 from the one branch the sentinel existed to cover.
  const src = readFileSync(new URL("../app/api/meta/leads/forms/refresh/route.js", import.meta.url), "utf8");
  ok("the lead-forms refresh route contains no NUL byte", !src.includes("\u0000"));
  ok("…and the stale count has a real branch for 'no forms seen' rather than a sentinel",
    /where: seen\.length\s*\?\s*\{ companyId: member\.companyId, formId: \{ notIn: seen \} \}\s*:\s*\{ companyId: member\.companyId \}/.test(src));
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

// ── The full picture: every metric Meta sends beside the dollar ────────────
//
// The owner connected a live ad account with three running campaigns and
// asked what FieldQuo does with the rest of what Meta reports. Nothing —
// because the sync kept four numbers and dropped the array. These two
// fixtures are the two shapes a real row takes: one carrying every action
// type a campaign can produce, one carrying none (an awareness campaign, or
// a day with no delivery). The second is the one that matters: every metric
// on it must be NULL, never 0, because a row that says "0 conversations"
// about a campaign that has no messaging in it is a wrong statement.
const FULL_ROW = {
  campaign_id: "9001",
  campaign_name: "Roof — click to message",
  objective: "OUTCOME_ENGAGEMENT",
  spend: "41.27",
  impressions: "5120",
  reach: "3877",
  clicks: "210",
  inline_link_clicks: "96",
  actions: [
    { action_type: "link_click", value: "96" },
    { action_type: "post_engagement", value: "340" },
    { action_type: "video_view", value: "1150" },
    // A near-miss on the exact action type, placed BEFORE the real one so a
    // prefix match finds it first — must NOT be counted as a conversation
    // started.
    { action_type: "onsite_conversion.messaging_first_reply", value: "9" },
    { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "14" },
    { action_type: "lead", value: "3" },
  ],
  date_start: "2026-09-02",
  date_stop: "2026-09-02",
};
const BARE_ROW = {
  campaign_id: "9002",
  campaign_name: "Old sync shape",
  spend: "12.00",
  impressions: "800",
  clicks: "7",
  date_start: "2026-09-02",
  date_stop: "2026-09-02",
};

{
  const row = parseInsightsRow(FULL_ROW);
  ok("full row: objective is Meta's value verbatim, not a label", row.objective === "OUTCOME_ENGAGEMENT");
  ok("full row: reach is read as a number", row.reach === 3877);
  ok("full row: inline_link_clicks lands as linkClicks", row.linkClicks === 96);
  ok("full row: conversations started come from the exact 7d action type", row.messagingConversations === 14);
  ok("full row: …and the first-reply near-miss is not mistaken for it", row.messagingConversations !== 9 && row.messagingConversations !== 23);
  ok("full row: video_view lands as videoViews", row.videoViews === 1150);
  ok("full row: post_engagement lands as postEngagements", row.postEngagements === 340);
  ok("full row: lead-shaped actions still sum into metaConversions", row.metaConversions === 3);
  ok("full row: the whole actions array is kept raw, untouched",
    Array.isArray(row.actionsRaw) && row.actionsRaw.length === 6 && row.actionsRaw[4].value === "14");
}
{
  const row = parseInsightsRow(BARE_ROW);
  ok("bare row: still parses — a row from the OLD field list is not an error", row.status === "ok");
  ok("bare row: objective is null, not \"\"", row.objective === null);
  ok("bare row: reach is null, not 0", row.reach === null);
  ok("bare row: linkClicks is null, not 0", row.linkClicks === null);
  ok("bare row: conversations started is null, not 0", row.messagingConversations === null);
  ok("bare row: videoViews is null, not 0", row.videoViews === null);
  ok("bare row: postEngagements is null, not 0", row.postEngagements === null);
  ok("bare row: actionsRaw is null when Meta sent no array", row.actionsRaw === null);
  ok("bare row: the four original metrics are unchanged", row.amount === 12 && row.impressions === 800 && row.clicks === 7 && row.metaConversions === 0);
}
{
  const row = parseInsightsRow({ ...FULL_ROW, actions: [] });
  ok("an EMPTY actions array is a statement: named actions are null, the raw array is kept as []",
    row.messagingConversations === null && Array.isArray(row.actionsRaw) && row.actionsRaw.length === 0);
  const garbage = parseInsightsRow({ ...FULL_ROW, reach: "lots", inline_link_clicks: {}, actions: [{ action_type: "video_view", value: "many" }] });
  ok("unreadable counts are null, never NaN", garbage.reach === null && garbage.linkClicks === null && garbage.videoViews === null);
}
{
  const plan = buildImportPlan({ rawRows: [FULL_ROW, BARE_ROW], existingSpend: [], companyCurrency: "CAD", adAccountCurrency: "CAD" });
  const [full, bare] = plan.toCreate;
  ok("the write plan carries campaignId on the row (the column the campaign rollup groups by)", full.campaignId === "9001" && bare.campaignId === "9002");
  ok("the write plan carries every new column", ["objective", "reach", "linkClicks", "messagingConversations", "videoViews", "postEngagements", "actionsRaw"].every((k) => k in full));
  ok("…with the full row's values", full.objective === "OUTCOME_ENGAGEMENT" && full.reach === 3877 && full.linkClicks === 96 && full.messagingConversations === 14 && full.videoViews === 1150 && full.postEngagements === 340 && Array.isArray(full.actionsRaw));
  ok("…and nulls, not zeros, on the bare row", bare.objective === null && bare.reach === null && bare.linkClicks === null && bare.messagingConversations === null && bare.videoViews === null && bare.postEngagements === null && bare.actionsRaw === null);
  ok("the plan never writes MarketingSpend.leads", !("leads" in full) && !("leads" in bare));
}

// ── The field list Meta is asked for ───────────────────────────────────────
//
// Meta rejects the whole request for one unrecognised field name, so a typo
// here is not a blank column, it is a sync that never returns a row and a
// lastSyncError the contractor has to read. The names are asserted against
// Meta's own AdsInsights field enum (facebook-nodejs-business-sdk
// src/objects/ads-insights.js, generated from the API spec; read 2026-09-11)
// — verbatim, as a set, because the whole point is the spelling.
const DOCUMENTED_INSIGHT_FIELDS = new Set([
  "account_currency", "account_id", "account_name", "actions", "action_values", "ad_id", "ad_name",
  "adset_id", "adset_name", "campaign_id", "campaign_name", "clicks", "conversions", "cost_per_action_type",
  "cost_per_conversion", "cost_per_inline_link_click", "cost_per_unique_click", "cpc", "cpm", "cpp", "ctr",
  "date_start", "date_stop", "frequency", "impressions", "inline_link_click_ctr", "inline_link_clicks",
  "objective", "outbound_clicks", "reach", "social_spend", "spend", "unique_clicks", "unique_ctr",
  "unique_inline_link_clicks", "video_p100_watched_actions", "video_p25_watched_actions",
  "video_p50_watched_actions", "video_p75_watched_actions", "video_play_actions",
  "video_thruplay_watched_actions", "website_ctr",
]);
ok("every field the sync asks Meta for is a documented AdsInsights field name, spelled exactly",
  CAMPAIGN_INSIGHT_FIELDS.every((f) => DOCUMENTED_INSIGHT_FIELDS.has(f)),
  CAMPAIGN_INSIGHT_FIELDS.filter((f) => !DOCUMENTED_INSIGHT_FIELDS.has(f)));
ok("the two names the brief guessed at do not exist and are not requested",
  !CAMPAIGN_INSIGHT_FIELDS.includes("video_thru_play_actions") && !CAMPAIGN_INSIGHT_FIELDS.includes("link_clicks") &&
    !DOCUMENTED_INSIGHT_FIELDS.has("video_thru_play_actions") && !DOCUMENTED_INSIGHT_FIELDS.has("link_clicks"));
ok("every field requested lands somewhere: each is read by parseInsightsRow",
  (() => {
    const src = readFileSync(new URL("../lib/meta/insightsImport.js", import.meta.url), "utf8");
    return CAMPAIGN_INSIGHT_FIELDS.every((f) => src.includes(`raw?.${f}`) || src.includes(`raw.${f}`));
  })(),
  CAMPAIGN_INSIGHT_FIELDS);
for (const f of ["campaign_id", "campaign_name", "objective", "spend", "impressions", "reach", "clicks", "inline_link_clicks", "actions"]) {
  ok(`the sync asks for ${f}`, CAMPAIGN_INSIGHT_FIELDS.includes(f));
}
ok("…and nothing that no column stores (cost_per_action_type, the video threshold fields)",
  !CAMPAIGN_INSIGHT_FIELDS.some((f) => f === "cost_per_action_type" || f.startsWith("video_")));

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
    "insightsImport.js",
    INSIGHTS_LIB,
    "reports a missing action type as 0 instead of null",
    (s) => s.replace("  if (!row) return null;\n  const n = Number(row.value);", "  if (!row) return 0;\n  const n = Number(row.value);"),
  ],
  [
    "insightsImport.js",
    INSIGHTS_LIB,
    "matches a messaging action type by prefix, double-counting first replies as conversations",
    (s) => s.replace("const row = actions.find((a) => a && a.action_type === actionType);",
      "const row = actions.find((a) => a && String(a.action_type).startsWith(actionType.slice(0, 27)));"),
  ],
  [
    "insightsImport.js",
    INSIGHTS_LIB,
    "drops campaignId from the write plan (the column the campaign rollup groups by)",
    (s) => s.replace("      campaignId: parsed.campaignId,\n", ""),
  ],
  [
    "insightsImport.js",
    INSIGHTS_LIB,
    "drops the conversations-started column from the write plan",
    (s) => s.replace("      messagingConversations: parsed.messagingConversations,\n", ""),
  ],
  [
    "insightsImport.js",
    INSIGHTS_LIB,
    "stores an empty string instead of null for a missing objective",
    (s) => s.replace('objective: raw?.objective ? String(raw.objective) : null,', 'objective: raw?.objective ? String(raw.objective) : "",'),
  ],
  [
    "client.js",
    CLIENT_LIB,
    "asks Meta for a field that does not exist (the brief's spelling of the ThruPlay field)",
    (s) => s.replace('  "actions",\n]);', '  "actions",\n  "video_thru_play_actions",\n]);'),
  ],
  [
    "client.js",
    CLIENT_LIB,
    "stops asking Meta for reach",
    (s) => s.replace('  "reach", // → reach\n', ""),
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
    "drops ads_read from the scope, requesting Meta's default (broader) scope instead",
    // ── Mutated in metaRequestedScope(), not at the call site ───────────────
    //
    // This used to replace the literal `scope: META_OAUTH_SCOPE,` inside
    // buildAuthorizeUrl. That line has now moved twice in one week — once when
    // the scope became a composition of the pending App Reviews (lead ads,
    // Page messaging), and again when a `scope` override argument was added
    // for the Page-posting connect flow — and BOTH times this mutant silently
    // stopped applying. A mutant that no longer applies is a mutant that
    // certifies nothing, which is the failure this file exists to prevent.
    //
    // So the mutation now lands on the one line that carries the MEANING —
    // the base scope going into the composition — rather than on the call
    // site's punctuation.
    (s) => s.replace("const parts = [META_OAUTH_SCOPE];", "const parts = [];"),
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
