// lib/sales/windowPolicy.js
//
// How hard ONE jurisdiction's calling window and 24-hour cap are applied, once
// the platform console has had its say.
//
// ══ What this is, and what it is not ═══════════════════════════════════════
//
// lib/sales/callingRules.js says what each jurisdiction's law IS — the hours,
// the cap, the registration it requires — and that table is research, edited
// in a diff. This file answers a different question: given that law, does
// FieldQuo's own screen REFUSE on it, WARN beside a working button, or not
// apply it at all. That is a platform decision, taken by a superadmin on
// /platform/sales/windows and stored as a SalesJurisdictionOverride row, and
// it is laid over the table here rather than written into it for the reason
// lib/sales/registrations.js gives for certificates: a constant in a source
// file has no author, no date and no reason attached.
//
// ══ ONE function, read by every gate ═══════════════════════════════════════
//
// effectiveWindowPolicy() is the whole of the decision. The queue route, the
// dial refusal (app/api/sales/calls), the batch claim, the day-list grouping
// and the texting window all call it and hand its answer to the evaluator as
// `windowPolicy`; the browser receives the SAME resolved answer inside
// `callingContext` and passes it back to its own thirty-second re-ask. There
// is no second copy of the "which mode wins" rule anywhere, because a second
// copy is how the console says "warn" while the dial still refuses.
//
// ══ Registration is never relaxed. Not by any mode. ═══════════════════════
//
// The owner, on being asked whether the override could ship: "we can do it,
// just don't feed it to the companies until I check off the registration."
// So a jurisdiction that requires a telemarketer registration FieldQuo has not
// recorded stays at `enforce` whatever the row says. The row is kept — a
// superadmin may record "warn" for Washington today so it takes effect the day
// the certificate is entered — but until then the resolver reports it as HELD,
// and the console prints that word beside the radio rather than letting the
// radio look like it did something. scripts/check-sales-window-override.mjs
// executes that for every mode.
//
// ══ Absent means enforce, always ═══════════════════════════════════════════
//
// No row, a row for a place the law file has never read, a mode string the
// database holds that this file does not recognise, an overrides list that
// failed to load — every one of those resolves to `enforce`, which is today's
// behaviour. There is no path through this file that opens a window by
// accident, and the check walks each one.
import {
  CALLING_JURISDICTIONS,
  WINDOW_MODES,
  WINDOW_MODE_ENFORCE,
  WINDOW_MODE_OFF,
  WINDOW_MODE_WARN,
  jurisdictionKey,
} from "./callingRules";

// The three words are defined beside the evaluator — it cannot import this
// file, since this file imports its table — and re-exported here so a caller
// that only knows about the policy never has to know that.
export { WINDOW_MODES, WINDOW_MODE_ENFORCE, WINDOW_MODE_WARN, WINDOW_MODE_OFF };

/** Is this a mode the resolver will honour? Anything else reads as enforce. */
export function isWindowMode(value) {
  return typeof value === "string" && WINDOW_MODES.includes(value);
}

/**
 * The key an override row addresses — "CA", "US-OK" — or null.
 *
 * A row stores `country` and `region` the way the schema's unique index wants
 * them; the law file keys by jurisdiction. This is the ONE spelling of the
 * bridge between the two, through callingRules' own jurisdictionKey() so
 * "Ok", "us-ok" and "Oklahoma" on a row land on the same jurisdiction the
 * dial resolves a prospect to.
 */
export function overrideKey(row = {}) {
  return jurisdictionKey({ country: row?.country, province: row?.region || null });
}

/**
 * Does this jurisdiction's law require a registration FieldQuo has not
 * recorded? The fact that holds an override at enforce.
 *
 * `registeredKeys` is the live-certificate list lib/sales/registrations.js
 * produces from the SalesTelemarketerRegistration table — the same overlay the
 * campaign gate uses — so a certificate recorded in the console releases the
 * hold here without a code edit. The law file's own `registration.done`
 * (Canada's filed DNCL registration) counts too.
 */
export function registrationGated(key, { registeredKeys = [], jurisdictions = CALLING_JURISDICTIONS } = {}) {
  const row = key ? jurisdictions[key] : null;
  const reg = row?.registration;
  if (!reg || reg.required !== true) return false;
  if (reg.done === true) return false;
  return !(Array.isArray(registeredKeys) && registeredKeys.includes(key));
}

/**
 * The policy in force for one jurisdiction.
 *
 * @param country        the prospect's country, any spelling callingRules reads
 * @param region         the state or province code, or null for a
 *                       country-level jurisdiction
 * @param overrides      SalesJurisdictionOverride rows, as an array, or an
 *                       object already keyed by jurisdiction key. Null or
 *                       unreadable means "no overrides", which means enforce.
 * @param registeredKeys jurisdiction keys with a live certificate, from
 *                       registeredKeys() in lib/sales/registrations.js
 * @param jurisdictions  the law table; injectable so the check can hand in a
 *                       row with the registration flipped and prove the hold
 *                       lifts with it
 *
 * @returns {{
 *   key: string|null,
 *   mode: "enforce"|"warn"|"off",   the mode that BINDS, after the hold
 *   requestedMode: "enforce"|"warn"|"off",  what the row asked for
 *   registrationGated: boolean,
 *   heldByRegistration: boolean,   requested ≠ enforce, but gated, so enforce
 *   source: "default"|"override",
 *   note: string|null, setById: string|null, updatedAt: string|null,
 * }}
 */
export function effectiveWindowPolicy({
  country = null,
  region = null,
  overrides = null,
  registeredKeys = [],
  jurisdictions = CALLING_JURISDICTIONS,
} = {}) {
  const key = jurisdictionKey({ country, province: region });
  const gated = registrationGated(key, { registeredKeys, jurisdictions });

  const base = {
    key,
    mode: WINDOW_MODE_ENFORCE,
    requestedMode: WINDOW_MODE_ENFORCE,
    registrationGated: gated,
    heldByRegistration: false,
    source: "default",
    note: null,
    setById: null,
    updatedAt: null,
  };

  // A place the law file has never read has no window to relax; the evaluator
  // already answers `unknown` for it and this must not turn that into a yes.
  // The same goes for a row that is listed but unverified (Iowa, Vermont): the
  // evaluator refuses before it reaches the clock, so a relaxed mode there
  // would be a radio that does nothing — reported as default, not as applied.
  if (!key || !jurisdictions[key] || jurisdictions[key].verified !== true) return base;

  const row = findOverride(overrides, key);
  if (!row) return base;

  const requested = isWindowMode(row.mode) ? row.mode : WINDOW_MODE_ENFORCE;
  const held = gated && requested !== WINDOW_MODE_ENFORCE;
  return {
    ...base,
    mode: held ? WINDOW_MODE_ENFORCE : requested,
    requestedMode: requested,
    heldByRegistration: held,
    source: "override",
    note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : null,
    setById: row.setById || null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/** The override row for a key, from either shape the caller may hold. */
function findOverride(overrides, key) {
  if (!overrides) return null;
  if (Array.isArray(overrides)) {
    return overrides.find((row) => row && overrideKey(row) === key) || null;
  }
  if (typeof overrides === "object") {
    const row = overrides[key];
    return row && typeof row === "object" ? row : null;
  }
  return null;
}

/**
 * The same resolver, for a prospect-shaped object — `{ country, province }`
 * is what every dial path already holds. A convenience over ONE function, not
 * a second one.
 */
export function windowPolicyFor(prospect = {}, context = {}) {
  return effectiveWindowPolicy({
    country: prospect?.country ?? null,
    region: prospect?.province ?? null,
    overrides: context?.overrides ?? null,
    registeredKeys: context?.registeredKeys ?? [],
    jurisdictions: context?.jurisdictions ?? CALLING_JURISDICTIONS,
  });
}

/**
 * The policy as it travels to a browser: the resolved answer and nothing
 * that needs a database to check. `setById` stays behind — an admin's id is
 * of no use to a rep and the console reads it by name from its own route.
 */
export function publicWindowPolicy(policy) {
  if (!policy || typeof policy !== "object") return null;
  return {
    key: policy.key ?? null,
    mode: isWindowMode(policy.mode) ? policy.mode : WINDOW_MODE_ENFORCE,
    requestedMode: isWindowMode(policy.requestedMode) ? policy.requestedMode : WINDOW_MODE_ENFORCE,
    registrationGated: policy.registrationGated === true,
    heldByRegistration: policy.heldByRegistration === true,
    source: policy.source === "override" ? "override" : "default",
    note: policy.note ?? null,
  };
}
