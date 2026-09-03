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
// ══ Which is why describeConfig refuses, and says why ══════════════════════
//
// That has a consequence worth stating in the one place a superadmin will meet
// it. `planIngest` SKIPS any business whose trade is null. A campaign pointed
// at this source would therefore run to completion, report "54,264 found,
// 54,264 unmapped, 0 accepted", and write no prospects at all — a Start button
// that runs and produces nothing, which is exactly the dead control AGENTS.md
// opens by forbidding.
//
// So `describeConfig` returns ok:false with that sentence. The campaigns route
// already refuses to create or start a campaign whose config is not ok and
// renders `problems` on the form, so this is a "Coming soon" panel and not a
// button that lies. The extractor below is finished and works today; what is
// missing is a product decision, and it is named rather than guessed at:
//
//   Either single-trade queues learn to hold register-sourced prospects whose
//   trade is genuinely unknown, or a later stage (a crawl of the website the
//   register does not carry, or the trading names in `Autre nom`) establishes
//   a trade before the row reaches a rep. Both are product decisions. Picking
//   one here and building it quietly is the scope change AGENTS.md says to ask
//   about.
import { registerDiscoveryProvider } from "../provider";
import { inTerritory } from "../overture/provider";
import { businessFromSnapshotRow, readSnapshot, RBQ_PROVIDER_KEY } from "./snapshot";
import { fetchRbqResource, RBQ_ATTRIBUTION, RBQ_DATASET_URL } from "./register";

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
  "row from this source arrives with no trade, and discovery skips rows with no trade. This source " +
  "cannot fill a single-trade queue until that is decided. The extractor works: run " +
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
