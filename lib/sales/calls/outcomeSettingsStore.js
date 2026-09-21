// lib/sales/calls/outcomeSettingsStore.js
//
// The one PlatformSetting row behind lib/sales/calls/outcomeSettings.js and
// lib/sales/calls/subDispositions.js: read with the defaults as the
// fallback, written only through the validators.
//
// A read that fails answers the DEFAULTS, loudly: the disposition write,
// the bridge and the cron must never fail because a settings row could not
// be read, and the defaults are the behaviour the floor had before any of
// this existed (transcription at 100 %, AMD off, no callback limits below
// the code's own).

import { db } from "@/lib/db";
import { OUTCOME_SETTINGS_KEY, effectiveOutcomeSettings, outcomeDefaults } from "./outcomeSettings";
import { SUB_DISPOSITIONS_KEY, effectiveSubDispositions } from "./subDispositions";

function hasDelegate(client) {
  return typeof client?.platformSetting?.findUnique === "function";
}

/** The effective outcome settings — `{ values, fallbacks }`. */
export async function loadOutcomeSettings({ client = db } = {}) {
  if (!hasDelegate(client)) return { values: outcomeDefaults(), fallbacks: [], readFailed: false };
  try {
    const row = await client.platformSetting.findUnique({ where: { key: OUTCOME_SETTINGS_KEY } });
    return { ...effectiveOutcomeSettings(row?.value), readFailed: false };
  } catch (err) {
    console.error("[sales outcomes] settings could not be read; running on the defaults:", err?.message);
    return { values: outcomeDefaults(), fallbacks: [], readFailed: true };
  }
}

/** Just the values, for callers that only need a number. */
export async function outcomeSettingValues({ client = db } = {}) {
  return (await loadOutcomeSettings({ client })).values;
}

/**
 * Merge an already-validated edit into the stored row. The caller has run
 * validateOutcomeSettingsEdit and checked the writer; this only stores.
 * Returns the effective settings after the write.
 */
export async function saveOutcomeSettings({ values, client = db } = {}) {
  const current = hasDelegate(client) ? await client.platformSetting.findUnique({ where: { key: OUTCOME_SETTINGS_KEY } }).catch(() => null) : null;
  const base = current?.value && typeof current.value === "object" && !Array.isArray(current.value) ? current.value : {};
  const next = { ...base, ...(values || {}) };
  await client.platformSetting.upsert({
    where: { key: OUTCOME_SETTINGS_KEY },
    update: { value: next },
    create: { key: OUTCOME_SETTINGS_KEY, value: next },
  });
  return effectiveOutcomeSettings(next);
}

/** The effective sub-disposition lists — `{ lists, source }`. */
export async function loadSubDispositions({ client = db } = {}) {
  if (!hasDelegate(client)) return { ...effectiveSubDispositions(null), readFailed: false };
  try {
    const row = await client.platformSetting.findUnique({ where: { key: SUB_DISPOSITIONS_KEY } });
    return { ...effectiveSubDispositions(row?.value), readFailed: false };
  } catch (err) {
    console.error("[sales outcomes] sub-disposition lists could not be read; running on the defaults:", err?.message);
    return { ...effectiveSubDispositions(null), readFailed: true };
  }
}

/** Store the validated lists (the whole object, every outcome). */
export async function saveSubDispositions({ lists, client = db } = {}) {
  await client.platformSetting.upsert({
    where: { key: SUB_DISPOSITIONS_KEY },
    update: { value: lists },
    create: { key: SUB_DISPOSITIONS_KEY, value: lists },
  });
  return effectiveSubDispositions(lists);
}
