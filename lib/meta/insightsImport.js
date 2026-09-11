// lib/meta/insightsImport.js
//
// Meta's raw /insights response -> a MarketingSpend write plan. Pure — no
// db, no fetch, same discipline lib/expenses/csvImport.js's header argues
// for and the same reason: AGENTS.md says execute pure functions against
// hostile input, and that's only possible when the function doesn't reach
// for a database connection to do it. The route that actually calls Meta
// (app/api/meta-ads/sync/route.js) fetches the rows and existing
// MarketingSpend rows, hands them here, and writes back whatever this
// returns — it has no import logic of its own.
//
// ── What this refuses to do ─────────────────────────────────────────────
//
// 1. Never writes MarketingSpend.leads. That column is the hand-typed,
//    contractor-entered figure lib/analytics/kpis.js already refuses to
//    build a per-channel costPerLead on (see its NOT_TRACKED entry). Meta's
//    own reported lead-like actions go into `.conversions` instead — a
//    column that already means "the platform's own count of an outcome",
//    labelled as Meta's in the UI, never merged with FieldQuo's own
//    LeadRequest count. See docs/META-ADS-INTEGRATION.md Part 2.
// 2. Never converts a currency at write time. A row whose ad account
//    currency differs from the company's own currency is still IMPORTED
//    (refusing to show a contractor their own ad spend at all would be
//    worse), and carries that currency on the row, as reported. The
//    conversion into the company's currency happens at READ time, at the
//    pinned rate in lib/marketing/fx.js, marked approximate — see
//    lib/analytics/spendCurrency.js. Nothing stored is ever a converted
//    number.
// 3. Never overwrites a manual entry. The write plan only ever creates or
//    updates rows this same import already created (matched by
//    MarketingSpend.externalId, itself scoped to source: "meta_api" by the
//    caller) — a hand-typed row is invisible to it by construction. Where a
//    manual entry LOOKS like the same real-world spend (naturalKey below),
//    it's surfaced as a possible duplicate for a human to look at, never
//    silently merged or dropped — the same non-decision
//    lib/expenses/csvImport.js's detectDuplicates makes.

const PLATFORM = "facebook";

/** Meta's campaign id + the day -> the externalId a re-run of the sync can find again. */
export function externalIdFor({ campaignId, date }) {
  return `${campaignId}:${date}`;
}

/**
 * Same shape as lib/expenses/csvImport.js's normaliseDescription — collapsed,
 * lowercased, punctuation stripped — applied to a campaign name so
 * "Spring Sale!!" and "spring sale" read as the same campaign for duplicate
 * detection.
 */
function normaliseCampaignName(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * platform + date + normalised campaign name -> a SOURCE-BLIND key.
 * Deliberately excludes `source`/`externalId` — a manual row entered for
 * "Facebook, Aug 15, Spring Sale" and a Meta-synced row for the same day and
 * campaign produce the same key, which is what makes them detectable as the
 * same real-world spend regardless of which one arrived first.
 */
export function naturalKey({ platform, date, campaignName }) {
  const iso = date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)
      ? date.slice(0, 10)
      : "invalid-date";
  return `${platform || "unknown"}|${iso}|${normaliseCampaignName(campaignName)}`;
}

const LEAD_ACTION_TYPES = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
]);

/** Sums whichever of Meta's own action rows look like a lead-shaped outcome. */
function sumLeadActions(actions) {
  if (!Array.isArray(actions)) return 0;
  let total = 0;
  for (const a of actions) {
    if (!a || !LEAD_ACTION_TYPES.has(a.action_type)) continue;
    const n = Number(a.value);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

// ── The action types that get a column of their own ─────────────────────────
//
// Meta reports most outcomes not as fields but as entries in one `actions`
// array, `{ action_type, value }`. These three are the ones a contractor
// actually buys a campaign for and asks about by name, so each gets a real
// column on MarketingSpend rather than a trip through the raw JSON:
//
//   onsite_conversion.messaging_conversation_started_7d
//       a Messenger / Instagram / WhatsApp thread the ad opened — the metric
//       a "click to message" campaign exists to produce, and the one the
//       Spend page prices ("cost per conversation")
//   video_view       Meta's 3-second view, the number Ads Manager headlines
//                    as "video plays"; the ThruPlay and 25/50/75/100% fields
//                    are real but nothing stores them (see
//                    CAMPAIGN_INSIGHT_FIELDS in lib/meta/client.js)
//   post_engagement  every reaction, comment, share, click and view rolled
//                    up — the "engagement" campaign's own headline number
//
// Exact-string keys, not prefix matches: `onsite_conversion.messaging_first_reply`
// and `messaging_conversation_started_7d`'s unique variant both exist and
// would double-count a loose match.
const NAMED_ACTION_TYPES = Object.freeze({
  messagingConversations: "onsite_conversion.messaging_conversation_started_7d",
  videoViews: "video_view",
  postEngagements: "post_engagement",
});

/**
 * One action type's value out of Meta's `actions` array — or NULL when the
 * array does not carry it. Never 0: a campaign that reports no
 * `video_view` entry is a campaign with no video in it, not one whose video
 * was watched zero times, and MarketingSpend's own comment on these columns
 * makes the same distinction. Failure class 5 in AGENTS.md — absence of a
 * statement is not a statement.
 */
function actionValue(actions, actionType) {
  if (!Array.isArray(actions)) return null;
  const row = actions.find((a) => a && a.action_type === actionType);
  if (!row) return null;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : null;
}

/** A Meta integer-as-string ("1234") → 1234, or null when absent/unreadable. */
function countOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * One raw Meta insights row -> a shaped row, or an error entry.
 *
 * Expected raw shape (per lib/meta/client.js's CAMPAIGN_INSIGHT_FIELDS):
 *   { campaign_id, campaign_name, objective, spend, impressions, reach,
 *     clicks, inline_link_clicks, actions, date_start, date_stop }
 *
 * Only campaign_id, date_start and spend are REQUIRED — the row is the
 * money, and a row without money is an error. Every other metric is null
 * when Meta did not send it, never 0 (see actionValue above). A response
 * from an older field list — every row the owner's first sync wrote had no
 * `reach`, no `objective` — parses cleanly with nulls in those places, which
 * is what lets the next "Sync now" UPDATE those rows in place rather than
 * choke on them.
 *
 * `date_start` and `date_stop` are the same value with time_increment: "1"
 * (one day per row) — both are checked and a row where they disagree is
 * refused rather than guessed at, the same "don't invent a value" rule
 * csvImport.js's date handling follows.
 */
export function parseInsightsRow(raw) {
  const errors = [];
  const campaignId = raw?.campaign_id ? String(raw.campaign_id) : null;
  const campaignName = raw?.campaign_name ? String(raw.campaign_name) : null;
  if (!campaignId) errors.push("Missing campaign_id");

  const dateStart = raw?.date_start;
  const dateStop = raw?.date_stop;
  if (!dateStart) errors.push("Missing date_start");
  else if (dateStop && dateStop !== dateStart) {
    errors.push(`date_start (${dateStart}) and date_stop (${dateStop}) disagree — expected one day per row`);
  }

  const spend = raw?.spend !== undefined ? Number(raw.spend) : null;
  if (spend === null || !Number.isFinite(spend)) errors.push(`Unreadable spend value "${raw?.spend}"`);

  if (errors.length) {
    return { status: "error", errors, raw };
  }

  const actions = Array.isArray(raw?.actions) ? raw.actions : null;

  return {
    status: "ok",
    campaignId,
    campaignName,
    // Meta's own enum value (OUTCOME_LEADS, OUTCOME_ENGAGEMENT, …), stored
    // verbatim. The human label is the SCREEN's job — lib/analytics/
    // campaignRollup.js — so a value Meta adds next year still round-trips.
    objective: raw?.objective ? String(raw.objective) : null,
    date: dateStart,
    amount: Math.round(spend * 100) / 100,
    impressions: countOrNull(raw?.impressions),
    reach: countOrNull(raw?.reach),
    clicks: countOrNull(raw?.clicks),
    linkClicks: countOrNull(raw?.inline_link_clicks),
    metaConversions: sumLeadActions(actions),
    messagingConversations: actionValue(actions, NAMED_ACTION_TYPES.messagingConversations),
    videoViews: actionValue(actions, NAMED_ACTION_TYPES.videoViews),
    postEngagements: actionValue(actions, NAMED_ACTION_TYPES.postEngagements),
    // The whole array, as sent, for whatever a later screen wants without
    // another sync. Null when Meta sent none — an empty array is a statement
    // ("no actions"), a missing key is not, and they are kept apart.
    actionsRaw: actions,
  };
}

/**
 * The full plan: raw Meta rows + this company's existing MarketingSpend rows
 * + the two currencies involved -> what to create, what to update (a re-run
 * of the sync for a day already imported), and what to flag rather than
 * write.
 *
 * @param {object[]} rawRows            Meta's insights response `data` array
 * @param {object[]} existingSpend      This company's MarketingSpend rows —
 *                                      only the fields naturalKey/externalId
 *                                      matching needs: { id, source,
 *                                      externalId, platform, date,
 *                                      campaignName }
 * @param {string}   companyCurrency    Company.currency
 * @param {string|null} adAccountCurrency  MetaAdConnection.adAccountCurrency
 */
export function buildImportPlan({ rawRows, existingSpend, companyCurrency, adAccountCurrency }) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const existing = Array.isArray(existingSpend) ? existingSpend : [];

  const currencyMismatch = Boolean(
    adAccountCurrency && companyCurrency && adAccountCurrency !== companyCurrency,
  );
  const rowCurrency = currencyMismatch ? adAccountCurrency : null;

  // Index existing rows two ways: by externalId (this import's own prior
  // rows, for update-in-place) and by natural key across EVERY source (for
  // the possible-duplicate flag against manual entries).
  const byExternalId = new Map();
  const byNaturalKey = new Map();
  for (const row of existing) {
    if (row.source === "meta_api" && row.externalId) {
      byExternalId.set(row.externalId, row);
    }
    const key = naturalKey({ platform: row.platform, date: row.date, campaignName: row.campaignName });
    if (!byNaturalKey.has(key)) byNaturalKey.set(key, []);
    byNaturalKey.get(key).push(row);
  }

  const toCreate = [];
  const toUpdate = [];
  const errors = [];
  const possibleDuplicates = [];

  for (const raw of rows) {
    const parsed = parseInsightsRow(raw);
    if (parsed.status === "error") {
      errors.push(parsed);
      continue;
    }

    const externalId = externalIdFor({ campaignId: parsed.campaignId, date: parsed.date });
    const data = {
      platform: PLATFORM,
      campaignId: parsed.campaignId,
      campaignName: parsed.campaignName,
      objective: parsed.objective,
      amount: parsed.amount,
      impressions: parsed.impressions,
      reach: parsed.reach,
      clicks: parsed.clicks,
      linkClicks: parsed.linkClicks,
      conversions: parsed.metaConversions,
      messagingConversations: parsed.messagingConversations,
      videoViews: parsed.videoViews,
      postEngagements: parsed.postEngagements,
      actionsRaw: parsed.actionsRaw,
      // A Date, not the "YYYY-MM-DD" string Meta sends. MarketingSpend.date is
      // a DateTime column and Prisma refuses a bare string for it — the owner's
      // first real sync (act_14771954, three campaigns, real spend) died on
      // exactly that with a 500 and nothing recorded. Midnight UTC, the same
      // instant naturalKey() and the manual CSV import use for a day.
      date: new Date(`${parsed.date}T00:00:00Z`),
      source: "meta_api",
      externalId,
      currency: rowCurrency,
    };

    const priorRun = byExternalId.get(externalId);
    if (priorRun) {
      toUpdate.push({ id: priorRun.id, data });
    } else {
      toCreate.push(data);
      // A manual row for what looks like the same real-world spend, on a day
      // this import has never written before — surfaced, not merged. Only
      // checked for genuinely NEW rows: an update to a row this import
      // already owns isn't a new collision with a manual entry.
      const key = naturalKey({ platform: PLATFORM, date: parsed.date, campaignName: parsed.campaignName });
      const collisions = (byNaturalKey.get(key) || []).filter((r) => r.source !== "meta_api");
      if (collisions.length) {
        possibleDuplicates.push({ externalId, matches: collisions.map((r) => r.id) });
      }
    }
  }

  return {
    toCreate,
    toUpdate,
    errors,
    possibleDuplicates,
    currencyMismatch,
    summary: {
      totalRows: rows.length,
      created: toCreate.length,
      updated: toUpdate.length,
      errored: errors.length,
      possibleDuplicates: possibleDuplicates.length,
    },
  };
}
