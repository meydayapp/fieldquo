// lib/sales/discovery/rbq/provider.js
//
// Quebec's RBQ contractor-licence register, as a BusinessDiscoveryProvider.
//
// ══ Why a licence register beats a points-of-interest file ═════════════════
//
// Overture found 79,736 businesses in the whole of Canada. This one file holds
// 54,264 licence-holders in Quebec alone, and it is better data in the two
// ways that decide whether a rep's call connects:
//
//   contactable   91.7% carry a phone, 91.7% an address, 87.0% an email —
//                 measured on the real file, not estimated. A directory that
//                 is 45% bare-digit phone numbers cannot say the same.
//   verified      every row is an ACTIVE licence, positively asserted by the
//                 regulator today. `operatingStatus` here is a statement, not
//                 the silence Overture's null means.
//
// And it is CC-BY 4.0, which permits commercial use and redistribution and
// requires attribution — see register.js for where the notice is rendered.
//
// ══ What this provider will NOT do: guess a trade ══════════════════════════
//
// The register publishes each licence's SUBCATEGORIES. They are an
// authorisation set — what this licensee is permitted to do — and licence.js's
// header carries the measurement: 81.3% of all licence-holders are authorised
// for "travaux de finition", 77.0% for "armoires et comptoirs usinés", and the
// median licence carries sixteen to seventeen of them.
//
// So there is no trade in this file, and this provider does not manufacture
// one. `categories.primary` is null; the codes ride along in
// `categories.alternate`, namespaced, mapping to nothing. `tradeForCategories`
// returns null and lib/sales/discovery/ingest.js counts the row as unmapped.
//
// ══ Which is why describeConfig still refuses, and what changed ════════════
//
// UPDATED 2026-09-03, because half of the original reason stopped being true
// and a refusal that argues from a false premise is worse than no refusal.
//
// What changed: `planIngest` no longer skips a business because its trade is
// null. It writes it to the BANK with `tradeKey: null`, counted as
// `bankedCount`, and claimCandidateWhere() keeps it out of every rep's queue
// because that query filters on an exact trade key. The single-trade rule was
// always about the queue rather than the bank, and the two conditions are now
// two conditions. And `lib/sales/intel/tradeDetect.js` establishes a trade
// from a contractor's own website — title, schema.org markup, service-page
// URLs, navigation — inside ANALYZE_CAPABILITIES, deterministically.
//
// What did NOT change, and is the whole remaining blocker: **the register
// carries no website column at all** (licence.js, `websites: []`). So
// `routeAfterEnrich` sends every RBQ prospect straight past the crawler, no
// page is ever fetched, and the detector that would give these rows a trade
// never gets anything to read. Starting a campaign here today would bank
// 54,264 licences none of which can EVER become callable through the mechanism
// just built — a Start button that runs and produces a dead-end, which is a
// quieter version of the dead control AGENTS.md opens by forbidding.
//
// So `describeConfig` still returns ok:false, and the sentence now says the
// true thing. The extractor below is finished and works today. What is missing
// is one named, small, separate build and it is a product decision rather than
// an oversight:
//
//   The register carries an email on 87.0% of licences. A registrable domain
//   derived from `Courriel`, minus the free-mail providers, would give the
//   crawler something to fetch — after which trade inference does the rest.
//   That is a guess about which website belongs to whom, and a wrong one puts
//   a rep on a call opening with the wrong trade, so it needs the owner's
//   decision and its own measurement rather than being slipped in here.
//
// The other route stays open too: a licence has trading names in `Autre nom`,
// and "Toitures Tremblay inc." names a trade in the name itself. That is a
// different detector on a different input and it is not this one.
import { registerDiscoveryProvider } from "../provider";
import { inTerritory } from "../overture/provider";
import { businessFromSnapshotRow, readSnapshot, RBQ_PROVIDER_KEY } from "./snapshot";
import { fetchRbqResource, RBQ_ATTRIBUTION, RBQ_DATASET_URL, RBQ_LICENCE_URL } from "./register";

export { RBQ_PROVIDER_KEY };

/** How many businesses one pipeline task ingests. Overture's number. */
export const PAGE_SIZE = 100;

/**
 * The sentence that stops a campaign starting, and the whole reason it exists.
 *
 * Exported so the check can assert the refusal is present and is the LAST
 * thing describeConfig does — a refusal placed first would stop the snapshot
 * URL ever being validated, and the day the refusal is lifted the URL check
 * would turn out never to have run.
 */
export const NO_TRADE_REFUSAL =
  "The RBQ register publishes each licence's authorised subcategories, not the trade the business " +
  "actually practises — 81% of all Quebec licence-holders are authorised for interior finishing and " +
  "77% for cabinets and countertops. FieldQuo will not guess a trade from an authorisation, so every " +
  "row from this source arrives with no trade. Rows with no trade are now kept: they go into the " +
  "bank and stay out of every rep's queue until a trade is established. What establishes one is the " +
  "contractor's own website, and the register carries no website column at all — so an RBQ campaign " +
  "would bank 54,264 licences that nothing can ever make callable. Deriving a domain from the " +
  "`Courriel` field (87% filled) would fix that and is a decision somebody has to take, because a " +
  "wrong domain puts a rep on a call opening with the wrong trade. The extractor works: run " +
  "`node scripts/rbq-snapshot.mjs` to see the data.";

/**
 * A snapshot, held for the life of the lambda instance.
 *
 * Per-instance and honestly so, the same caveat overture/provider.js makes:
 * two overlapping invocations each download the file once. Acceptable because
 * the file is static and a re-download costs bandwidth rather than
 * correctness.
 */
const cache = new Map();

/** Test seam: forget the cached snapshots. */
export function __clearRbqSnapshotCache() {
  cache.clear();
}

async function loadSnapshot(url, { fetchImpl = fetch } = {}) {
  if (cache.has(url)) return cache.get(url);

  let response;
  try {
    response = await fetchImpl(url, { redirect: "follow" });
  } catch (err) {
    return { error: `could not fetch the snapshot: ${err?.message || err}` };
  }
  if (!response?.ok) {
    return { error: `the snapshot URL answered ${response?.status ?? "no status"}` };
  }

  let body;
  try {
    body = await response.text();
  } catch (err) {
    return { error: `could not read the snapshot: ${err?.message || err}` };
  }

  const parsed = readSnapshot(body);
  if (parsed.problems.length) return { error: parsed.problems.join(" ") };

  const loaded = { manifest: parsed.manifest, rows: parsed.rows, unreadable: parsed.unreadable };
  cache.set(url, loaded);
  return loaded;
}

/** The cursor is an offset into the snapshot. Parsed defensively. */
export function parseCursor(cursor) {
  const n = Number.parseInt(String(cursor ?? "0"), 10);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export const rbqProvider = {
  key: RBQ_PROVIDER_KEY,
  label: "RBQ — Quebec contractor licences",
  description:
    `Active construction licences from Quebec's Régie du bâtiment — 54,264 licence-holders, 92% with a ` +
    `phone and 87% with an email, every one an active licence the regulator asserts today. ` +
    `${RBQ_ATTRIBUTION} ${RBQ_DATASET_URL}`,
  // ATTRIBUTION IS A CONDITION OF THE GRANT, which is the sentence that has to
  // reach the person ticking the box. register.js already carries the notice
  // and the two places it is rendered; this is the third, and it is the one
  // that appears BEFORE the obligation is taken on rather than after.
  licence: {
    name: "CC BY 4.0",
    url: RBQ_LICENCE_URL,
    obligation:
      "Attribution is a CONDITION of the grant, not a courtesy: every surface that shows a business " +
      "discovered here must carry the notice below. Commercial use and redistribution are permitted " +
      "once it does.",
    attribution: RBQ_ATTRIBUTION,
  },
  configFields: [
    {
      name: "snapshotUrl",
      label: "Snapshot URL",
      required: true,
      help:
        "Where this campaign's grouped licences live. Produce one with " +
        "`node scripts/rbq-snapshot.mjs`, then host it anywhere this deployment can GET. " +
        "The published extract is 341 MB of CSV holding 927,337 rows for 54,264 licences; " +
        "it cannot be streamed and grouped inside a serverless function.",
    },
  ],

  /**
   * Why this source cannot run at all, whatever it is configured with.
   *
   * The SAME constant `describeConfig` refuses with, deliberately — two
   * sentences would drift, and the day the refusal is lifted one of them would
   * be lifted and the other would not. scripts/check-campaign-sources.mjs
   * asserts the invariant directly: a source that reports itself unavailable
   * must also refuse every config, including a perfect one.
   *
   * This exists separately because a CHECKBOX has to be disabled before there
   * is any config to judge. Asking `describeConfig({})` instead would report
   * "no snapshot URL" — a fixable settings problem — for a source whose real
   * problem is that filling the field in would change nothing.
   */
  unavailableReason() {
    return NO_TRADE_REFUSAL;
  },

  describeConfig(config = {}) {
    const url = typeof config?.snapshotUrl === "string" ? config.snapshotUrl.trim() : "";
    if (!url) {
      return {
        ok: false,
        problems: ["This campaign has no snapshot URL, so there is nothing to read.", NO_TRADE_REFUSAL],
        summary: "No snapshot",
      };
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, problems: [`"${url}" is not a URL.`, NO_TRADE_REFUSAL], summary: "No snapshot" };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return {
        ok: false,
        problems: [
          `The snapshot is fetched over HTTP, so ${parsed.protocol} will not work — upload the file somewhere it can be downloaded from.`,
          NO_TRADE_REFUSAL,
        ],
        summary: "No snapshot",
      };
    }
    // Everything about the snapshot is fine. The refusal below is about the
    // DATA, not the settings, and it is last so that fixing it leaves a
    // config validator that has been exercised all along.
    return { ok: false, problems: [NO_TRADE_REFUSAL], summary: parsed.host + parsed.pathname };
  },

  async currentRelease(deps = {}) {
    const result = await fetchRbqResource(deps);
    return {
      release: result.ok ? result.release : null,
      error: result.ok ? null : result.problems.join(" "),
      checkedAt: new Date(),
    };
  },

  /**
   * One page of businesses.
   *
   * The territory filter is `inTerritory` from overture/provider.js rather
   * than a second copy. It reads only the address and the coordinates, which
   * every provider emits, and a second implementation would be the copy that
   * rots — AGENTS.md's fourth failure class, with "this campaign quietly
   * covers a different area" as the symptom.
   *
   * Note what that means for a register: the address is the licence-holder's
   * MAILING address, which is not always where they work. A radius territory
   * excludes every RBQ row outright, because the register carries no
   * coordinates and `inTerritory` refuses to place a business it cannot
   * locate. That is the conservative direction and it is the right one.
   */
  async fetchPage({ territory = null, cursor = null, limit = PAGE_SIZE, config = {}, deps = {} } = {}) {
    const url = typeof config?.snapshotUrl === "string" ? config.snapshotUrl.trim() : "";
    if (!url) {
      return { release: null, businesses: [], nextCursor: null, error: "This campaign has no snapshot URL.", scanned: 0 };
    }

    const loaded = await loadSnapshot(url, deps);
    if (loaded.error) return { release: null, businesses: [], nextCursor: null, error: loaded.error, scanned: 0 };

    const release = loaded.manifest.release;
    const offset = parseCursor(cursor);
    const take = Math.max(1, Math.min(Number(limit) || PAGE_SIZE, PAGE_SIZE));

    const businesses = [];
    let index = offset;
    for (; index < loaded.rows.length && businesses.length < take; index++) {
      const business = businessFromSnapshotRow(loaded.rows[index], loaded.manifest);
      if (!inTerritory(business, territory, deps)) continue;
      businesses.push(business);
    }

    return {
      release,
      businesses,
      nextCursor: index < loaded.rows.length ? String(index) : null,
      error: null,
      scanned: index - offset,
      total: loaded.rows.length,
    };
  },
};

registerDiscoveryProvider(rbqProvider);
