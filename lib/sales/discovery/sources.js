// lib/sales/discovery/sources.js
//
// A campaign draws from a SET of discovery sources, not one.
//
// ══ Why this is its own file, and pure ═════════════════════════════════════
//
// Four places now have to agree on what "this campaign's sources" means: the
// creation route, the detail route, the campaign screens, and the pipeline
// handler. Three of those cannot be run without a database, and the fourth is
// React — so the decisions live here, take an already-loaded campaign row, and
// are executed against hostile input by scripts/check-campaign-sources.mjs.
// That is the same split lib/sales/discovery/ingest.js makes and for the same
// reason: the real bugs are in the decisions, and a decision wrapped in a
// query cannot be run against a fixture.
//
// ══ Choosing sources is choosing LICENCES, plural ══════════════════════════
//
// The single `<select>` this replaces existed because of one sentence in
// ProspectCampaign's schema comment: the obvious default source was Google,
// whose terms forbid storing business names and addresses and forbid building
// a directory at all. Choosing a source is choosing a licence, so a campaign
// NAMES its source and there is no default.
//
// Ticking three boxes takes on three different obligations at once, and a form
// that let somebody do that without seeing them would have lost the property
// the single-select was protecting. So `licence` is REQUIRED of every
// registered provider (see provider.js) and is rendered against every
// checkbox — not in a tooltip, not on a second screen.
//
// ══ The legacy single-source columns are READ, never written ═══════════════
//
// `discoveryProvider`, `providerConfig` and `discoveryCursor` hold one
// provider, one config blob and one cursor. Every campaign created before this
// change carries its source there and nothing else, and `prisma db push` does
// not move data — so dropping those columns would delete the only record of
// what those campaigns were discovering.
//
// They therefore stay, and every reader below falls back to them when the new
// plural fields are empty. Nothing writes them any more: a new campaign fills
// `discoverySources` / `sourceConfigs` / `sourceState` and leaves the singular
// three as they were. Writing BOTH was rejected — `discoveryProvider` would
// then have to hold one of three sources, and a column that names one of three
// is a column that lies about two of them.
//
// ══ Why the config is keyed per source ═════════════════════════════════════
//
// Both shipped providers have a config field called `snapshotUrl`. One blob
// for several sources means Overture's snapshot URL and the RBQ's are the same
// string — the second source silently reads the first source's file, which is
// a wrong dataset ingested under the right provider name, and nothing anywhere
// would say so. `sourceConfigs` is keyed by provider key for exactly that
// collision.

/** How many consecutive transport failures a source gets before it is shut
 *  off for this campaign. Matches the runner's own MAX_ATTEMPTS ladder, so a
 *  source does not get a longer rope from the campaign than a task gets from
 *  the runner. */
export const MAX_SOURCE_FAILURES = 5;

/** A source nothing has run yet. Every field is stated, so an absent state and
 *  a fresh one are the same shape and no reader has to guess. */
export const EMPTY_SOURCE_STATE = Object.freeze({
  cursor: null,
  ended: false,
  blocked: null,
  failures: 0,
  lastError: null,
  lastErrorAt: null,
});

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

/** The legacy single provider this campaign was created with, or "". */
function legacyKey(campaign) {
  return trimmed(campaign?.discoveryProvider);
}

/**
 * The sources this campaign draws from, in the order it named them.
 *
 * Deduped: ticking the same key twice through the API must not make a source
 * run twice per page, which would double every counter it produced.
 *
 * Order is preserved rather than sorted, because it is the order the pipeline
 * ingests in and that order is load-bearing — see runDiscoverBusinesses.
 */
export function campaignSourceKeys(campaign) {
  const listed = Array.isArray(campaign?.discoverySources) ? campaign.discoverySources : [];
  const keys = [];
  for (const raw of listed) {
    const key = trimmed(raw);
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (keys.length) return keys;
  const legacy = legacyKey(campaign);
  return legacy ? [legacy] : [];
}

/**
 * The settings one source needs, and nobody else's.
 *
 * The legacy blob is returned for ONE key only — the provider the campaign was
 * originally created with. Handing it to a second source would be the exact
 * collision this keying exists to prevent, dressed up as a helpful default.
 */
export function configForSource(campaign, key) {
  const wanted = trimmed(key);
  if (!wanted) return {};

  const all = plainObject(campaign?.sourceConfigs);
  if (all) {
    const own = plainObject(all[wanted]);
    if (own) return own;
    // Present but empty is a STATEMENT — "this source is configured with
    // nothing" — not an invitation to go looking for another source's blob.
    if (Object.prototype.hasOwnProperty.call(all, wanted)) return {};
  }

  if (legacyKey(campaign) === wanted) {
    const blob = plainObject(campaign?.providerConfig);
    if (blob) return blob;
  }
  return {};
}

/**
 * Where one source got to, and whether it is still going.
 *
 *   cursor    the provider's own dialect, carried and never interpreted.
 *   ended     the provider said there is no next page. Terminal and CLEAN.
 *   blocked   a sentence saying why this source will not be attempted again.
 *             Terminal and NOT clean: a campaign carrying one has finished
 *             short, and the screen has to say so rather than showing
 *             "completed".
 *   failures  consecutive transport failures. Reset by any successful page.
 */
export function sourceStateFor(campaign, key) {
  const wanted = trimmed(key);
  const all = plainObject(campaign?.sourceState);
  const own = all ? plainObject(all[wanted]) : null;
  if (own) {
    return {
      cursor: trimmed(own.cursor) || null,
      ended: own.ended === true,
      blocked: trimmed(own.blocked) || null,
      // `Number(null)` is 0 and 0 is finite, so a plain Number() check reads a
      // missing count as a real zero and a missing OBJECT as a real state.
      // Integer-checked instead, which null, "", undefined and NaN all fail.
      failures: Number.isInteger(own.failures) && own.failures > 0 ? own.failures : 0,
      lastError: trimmed(own.lastError) || null,
      lastErrorAt: trimmed(own.lastErrorAt) || null,
    };
  }

  // A campaign created before this change has its cursor in `discoveryCursor`,
  // and losing it would restart a half-finished import from row zero — which
  // re-reads a whole snapshot and re-counts every row it already found.
  if (legacyKey(campaign) === wanted && trimmed(campaign?.discoveryCursor)) {
    return { ...EMPTY_SOURCE_STATE, cursor: trimmed(campaign.discoveryCursor) };
  }
  return { ...EMPTY_SOURCE_STATE };
}

/** Is this source still worth attempting? */
export function sourceIsOpen(state) {
  return !state?.ended && !state?.blocked;
}

/**
 * The whole `sourceState` blob to write, with `patches` applied.
 *
 * Every selected key is present in the result, including the untouched ones,
 * because this is a whole-column write: a partial object would erase the
 * cursor of every source the page did not reach.
 *
 * A key the campaign no longer selects is dropped. That is deliberate — its
 * cursor describes a source this campaign is not drawing from, and keeping it
 * would silently resume mid-file if the box were ticked again months later.
 */
export function mergeSourceState(campaign, patches = {}) {
  const next = {};
  for (const key of campaignSourceKeys(campaign)) {
    next[key] = { ...sourceStateFor(campaign, key), ...(plainObject(patches[key]) || {}) };
  }
  return next;
}

/**
 * A stable name for "where every source currently is".
 *
 * Used as the idempotency key of the next discovery task, so two runs that
 * both finish the same page enqueue ONE task rather than two — the property
 * the single-cursor key had, kept across several cursors.
 */
export function cursorFingerprint(campaign) {
  return campaignSourceKeys(campaign)
    .map((key) => {
      const state = sourceStateFor(campaign, key);
      if (state.blocked) return `${key}@blocked`;
      if (state.ended) return `${key}@end`;
      return `${key}@${state.cursor || "0"}`;
    })
    .join("+");
}

/**
 * Every source this campaign names, described for a screen.
 *
 * `getProvider` is injected rather than imported so this file pulls in no
 * provider registry — which is what lets the check drive it with two stub
 * sources and no snapshot anywhere.
 *
 * @returns {Array<{key:string, label:string, registered:boolean,
 *                  licence:object|null, unavailable:string|null,
 *                  configOk:boolean, problems:string[], summary:string,
 *                  state:object}>}
 */
export function describeSources(campaign, { getProvider } = {}) {
  return campaignSourceKeys(campaign).map((key) => {
    const provider = typeof getProvider === "function" ? getProvider(key) : null;
    const state = sourceStateFor(campaign, key);
    if (!provider) {
      return {
        key,
        label: key,
        registered: false,
        licence: null,
        unavailable: null,
        configOk: false,
        problems: [`This build does not ship a source called "${key}".`],
        summary: "",
        state,
      };
    }
    const unavailable = unavailableReasonOf(provider);
    const described = provider.describeConfig(configForSource(campaign, key)) || {};
    return {
      key,
      label: provider.label || key,
      registered: true,
      licence: provider.licence || null,
      unavailable,
      configOk: described.ok === true && !unavailable,
      problems: Array.isArray(described.problems) ? described.problems : [],
      summary: typeof described.summary === "string" ? described.summary : "",
      state,
    };
  });
}

/** A provider's own statement that it cannot run whatever it is configured
 *  with, or null. Kept here so every caller asks the same way. */
export function unavailableReasonOf(provider) {
  if (typeof provider?.unavailableReason !== "function") return null;
  const reason = trimmed(provider.unavailableReason());
  return reason || null;
}

/**
 * Why this campaign cannot start, as sentences a superadmin can act on.
 *
 * Empty means it can. Every reason names the SOURCE it belongs to, because
 * "no snapshot URL" against a campaign with three sources sends somebody to
 * read code to find out which one.
 */
export function startProblems(campaign, { getProvider } = {}) {
  const described = describeSources(campaign, { getProvider });
  if (!described.length) {
    return [
      "This campaign names no discovery source. There is deliberately no default — choosing a source " +
        "is choosing a licence, and the obvious default is the one whose terms forbid this exact use.",
    ];
  }
  const problems = [];
  for (const source of described) {
    if (!source.registered) {
      problems.push(source.problems[0]);
      continue;
    }
    if (source.unavailable) {
      problems.push(`${source.label}: ${source.unavailable}`);
      continue;
    }
    if (!source.configOk) {
      for (const problem of source.problems) problems.push(`${source.label}: ${problem}`);
    }
  }
  return problems;
}

/**
 * Has every source run out?
 *
 * `blocked` counts as finished — the source will not be attempted again — but
 * it is NOT the same outcome as `ended`, and `blockedSources` below is what
 * keeps the difference visible. A campaign that stopped because one of its two
 * sources died is not a campaign that found everything there was.
 */
export function allSourcesFinished(campaign) {
  const keys = campaignSourceKeys(campaign);
  if (!keys.length) return false;
  return keys.every((key) => !sourceIsOpen(sourceStateFor(campaign, key)));
}

/** The sources that stopped for a reason somebody has to read. */
export function blockedSources(campaign) {
  return campaignSourceKeys(campaign)
    .map((key) => ({ key, ...sourceStateFor(campaign, key) }))
    .filter((s) => s.blocked);
}

/**
 * The source selection a request is asking for, validated.
 *
 * Accepts the plural form, and falls back to the singular `discoveryProvider`
 * so an existing caller — or an existing campaign being re-saved — still works
 * rather than being told it named nothing.
 *
 * @returns {{ keys:string[], error:string|null }}
 */
export function readSourceSelection(body) {
  const raw = Array.isArray(body?.discoverySources)
    ? body.discoverySources
    : trimmed(body?.discoveryProvider)
      ? [trimmed(body.discoveryProvider)]
      : [];

  const keys = [];
  for (const value of raw) {
    const key = trimmed(value);
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (!keys.length) {
    return {
      keys,
      error:
        "A campaign has to name at least one discovery source. There is deliberately no default — see " +
        "the note on the form.",
    };
  }
  return { keys, error: null };
}

/**
 * The per-source config a request is asking for, reduced to the ticked keys.
 *
 * Anything sent for a source that is not ticked is DROPPED rather than stored.
 * Keeping it would leave a snapshot URL on the row for a source the campaign
 * does not draw from, which reads as configuration and is not.
 */
export function readSourceConfigs(body, keys) {
  const sent = plainObject(body?.sourceConfigs) || {};
  const legacy = plainObject(body?.providerConfig);
  const configs = {};
  for (const key of keys) {
    const own = plainObject(sent[key]);
    if (own) {
      configs[key] = own;
      continue;
    }
    // One ticked source and a legacy-shaped body: the single blob is
    // unambiguous, so it is honoured. Two ticked sources and it is NOT — the
    // blob names no source, and guessing would put one source's snapshot URL
    // on another. That is the collision this keying exists to prevent, so it
    // is refused by being ignored rather than silently spread.
    configs[key] = keys.length === 1 && legacy ? legacy : {};
  }
  return configs;
}
