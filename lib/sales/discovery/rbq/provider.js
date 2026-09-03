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
// ══ This source now runs, and what had to be true first ════════════════════
//
// UPDATED 2026-09-03. It refused every campaign until today, twice over, and
// both halves of the refusal have now been removed by work rather than by
// argument. The history is kept because the reasoning is the load-bearing part.
//
// FIRST HALF, removed earlier: `planIngest` used to skip a business whose
// trade was null. It now writes it to the BANK with `tradeKey: null`, counted
// as `bankedCount`, and claimCandidateWhere() keeps it out of every rep's
// queue because that query filters on an exact trade key. The single-trade
// rule was always about the queue rather than the bank.
//
// SECOND HALF, removed by this change: the register carries no website column,
// so `routeAfterEnrich` sent every RBQ prospect straight past the crawler and
// `lib/sales/intel/tradeDetect.js` — the ONLY thing that can give a register
// row a trade — never got a page to read. A campaign would have banked 54,264
// licences none of which could ever become callable: a Start button that runs
// and produces a dead end, which is the dead control AGENTS.md opens by
// forbidding.
//
// lib/sales/discovery/rbq/derivedSite.js closes it. A registrable domain is
// derived from `Courriel` when that domain is used by exactly ONE licence in
// the whole register, which removes every mailbox provider and every ISP by
// arithmetic rather than by a blocklist somebody has to maintain. It is stored
// as a `derived_site` ProspectInference — a hypothesis, in the table
// hypotheses go in — and NEVER as `websiteUrl`, so nothing about it reads as
// something the Régie published.
//
// ══ Measured before this was flipped, on the real register ═════════════════
//
// 360 derived domains crawled on 2026-09-03, in two independent samples,
// honouring robots.txt and the per-host delay:
//
//   15,924 / 54,264   licences yield a candidate domain (29.3%), measured by
//                     running the extractor on the published file
//      309 / 360      of those domains served a page (85.8%)
//       89 / 143      of pages corroborated the licence (62.2%) — sample 2,
//                     which ran the shipped corroborateSite()
//       11 / 160      reached a CONFIRMED trade from the home page alone (6.9%)
//
// That last number is a floor, not a yield: the sample fetched one page and
// the shipped crawler reads up to six (MAX_PAGES_PER_RUN). Projected onto the
// register it is ~1,100 Quebec contractors with an active licence, a phone —
// the register's phone fill is 99.99% — and a trade read off their own
// corroborated website. Against zero, for ever, which is what this source
// produced yesterday.
//
// The rest bank with `tradeKey: null` and stay out of every queue, which is
// the already-accepted behaviour for an unmapped row and is not a regression.
//
// ══ The failure this was gated on, and the measurement of it ═══════════════
//
// A dead guessed domain costs nothing. A LIVE guessed domain belonging to
// somebody else costs a call: the site loads, it is well marked up, the
// detector reads it confidently, and a rep opens a roofing script on a
// plumber. Four of the 166 pages in sample 1 were exactly that — ge.com from a
// GE subsidiary's licence, crh.com from Oldcastle Canada's, c3.farm from a
// CABINET MAKER's, tree9structures.com from a second business the same owner
// runs.
//
// All four were UNCORROBORATED, and lib/sales/intel/siteIdentity.js is what
// turns that into a refusal: a derived site may not set `Prospect.tradeKey`
// unless the site's own pages carry the register's phone or its street
// address. Across 309 crawled pages, not one wrong-entity site corroborated.
// The cost is stated rather than hidden — a name match alone is refused, which
// in sample 2 lost one genuine carpenter — and confidence.js's fuzzy ceiling
// is what does the refusing, so no tuning can open the door later.
//
// The other route stays open and is not built: a licence has trading names in
// `Autre nom`, and "Toitures Tremblay inc." names a trade in the name itself.
// That is a different detector on a different input.
import { registerDiscoveryProvider } from "../provider";
import { inTerritory } from "../overture/provider";
import { businessFromSnapshotRow, readSnapshot, RBQ_PROVIDER_KEY } from "./snapshot";
import { fetchRbqResource, RBQ_ATTRIBUTION, RBQ_DATASET_URL, RBQ_LICENCE_URL } from "./register";

export { RBQ_PROVIDER_KEY };

/** How many businesses one pipeline task ingests. Overture's number. */
export const PAGE_SIZE = 100;

/**
 * What a superadmin ticking this box is agreeing to, in the numbers it was
 * measured at.
 *
 * ══ Why this is a description and not a refusal any more ═══════════════════
 *
 * It WAS `NO_TRADE_REFUSAL`, and `describeConfig` returned ok:false on every
 * config including a perfect one, because no RBQ row could ever reach a rep's
 * queue. That is no longer true — see the file header for the mechanism and
 * the measurement — so a refusal arguing from it would be a refusal arguing
 * from a false premise, which is worse than no refusal.
 *
 * What it must NOT become is silence. This source's yield is 2% of the
 * register and the other 98% banks with no trade; a superadmin who ticks the
 * box expecting 54,264 callable contractors and gets ~1,100 has been misled by
 * a form, and "the campaign quietly did less than the number on the box"
 * is the failure the funnel counters exist to make visible. So the sentence
 * survives with the numbers in it, on the provider `description` the campaign
 * form renders — which is the one surface a person reads BEFORE choosing.
 *
 * Exported so the check can assert it is actually rendered rather than
 * defined, and so the numbers live in exactly one place.
 */
export const RBQ_YIELD_NOTE =
  "The register publishes each licence's AUTHORISED subcategories, not the trade the business " +
  "practises — 81% of all Quebec licence-holders may do interior finishing and 77% cabinets and " +
  "countertops — so FieldQuo never guesses a trade from an authorisation and every row arrives " +
  "with none. A trade is established later, from the contractor's own website. The register lists " +
  "no website either, so one is DERIVED from the licence email when that domain belongs to exactly " +
  "one licence, stored as a hypothesis, crawled, and accepted only when the site's own phone or " +
  "address matches the register. Measured on 360 crawled domains: 29% of licences yield a candidate " +
  "domain, 86% of those serve a page, 62% of those pages corroborate — roughly 1,100 callable " +
  "contractors out of 54,264 licences. The other 53,000 bank with no trade and appear in no rep's " +
  "queue. Run `node scripts/rbq-snapshot.mjs` to produce the snapshot and see the fill rates.";

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
    // The yield, on the surface a superadmin reads BEFORE ticking the box.
    // Rendered here rather than raised as a config problem because it is not a
    // problem — it is what this source is — and a warning that blocks nothing
    // belongs where the choice is made.
    `${RBQ_YIELD_NOTE} ` +
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
   * NULL now, and the null is the change. It returned a refusal for as long as
   * an RBQ campaign could only ever produce a dead end; see the file header
   * for what closed that and the numbers it was closed at.
   *
   * The method STAYS rather than being deleted, and that is deliberate. It is
   * the only hook that can grey a CHECKBOX out before there is any config to
   * judge — `describeConfig({})` would say "no snapshot URL", a fixable
   * settings problem, for a source whose problem might be that filling the
   * field in changes nothing. Deleting it would mean the next source that
   * genuinely cannot run has nowhere to say so, and
   * scripts/check-campaign-sources.mjs already asserts the invariant that ties
   * the two together: a source reporting itself unavailable must also refuse
   * every config, including a perfect one. With null here that invariant holds
   * vacuously, which is correct rather than convenient.
   *
   * @returns {string|null}
   */
  unavailableReason() {
    return null;
  },

  describeConfig(config = {}) {
    const url = typeof config?.snapshotUrl === "string" ? config.snapshotUrl.trim() : "";
    if (!url) {
      return {
        ok: false,
        problems: ["This campaign has no snapshot URL, so there is nothing to read."],
        summary: "No snapshot",
      };
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, problems: [`"${url}" is not a URL.`], summary: "No snapshot" };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return {
        ok: false,
        problems: [
          `The snapshot is fetched over HTTP, so ${parsed.protocol} will not work — upload the file somewhere it can be downloaded from.`,
        ],
        summary: "No snapshot",
      };
    }
    // Everything about the snapshot is fine, and — since 2026-09-03 — so is
    // everything about the data. This is the ONE `ok: true` in this file and
    // it is the whole flip: a campaign naming the RBQ can now start.
    //
    // The yield note is NOT repeated here as a problem. It blocks nothing, and
    // a `problems` entry that does not stop anything is a warning wearing an
    // error's clothes — the screen renders `problems` as the reason a campaign
    // will not run. It rides on the provider `description` instead, which is
    // the surface a superadmin reads while choosing rather than after.
    return { ok: true, problems: [], summary: parsed.host + parsed.pathname };
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
