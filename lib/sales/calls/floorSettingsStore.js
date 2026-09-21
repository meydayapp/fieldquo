// lib/sales/calls/floorSettingsStore.js
//
// The database half of floorSettings.js: one PlatformSetting row, read by
// presenceFor() on every board draw and every state read, written by a
// superadmin from /platform/sales/floor. Kept apart from the pure module
// for the reason testLinesStore.js gives: the numbers are read in check
// scripts under bare node, which cannot hold a Prisma client.
//
// A failed read is the DEFAULTS, and says so on the console — a floor
// without a write-up window would let the dialler place a call over a
// half-written outcome, so the fallback is the owner's number, never zero.
import { db } from "@/lib/db";
import { DEFAULT_FLOOR_SETTINGS, FLOOR_SETTINGS_KEY, normaliseFloorSettings } from "./floorSettings";

export async function loadFloorSettings({ client = db } = {}) {
  // A client without the settings table (a scripted db) is the defaults,
  // quietly — there is nothing to warn about.
  if (typeof client?.platformSetting?.findUnique !== "function") return { ...DEFAULT_FLOOR_SETTINGS };
  try {
    const row = await client.platformSetting.findUnique({ where: { key: FLOOR_SETTINGS_KEY } });
    return normaliseFloorSettings(row?.value);
  } catch (err) {
    console.error("[sales floor settings] could not be read; defaults apply:", err?.message);
    return { ...DEFAULT_FLOOR_SETTINGS };
  }
}

/** Replace both values. The route has already validated and will audit-log. Returns what was stored. */
export async function saveFloorSettings({ value, client = db } = {}) {
  // A PUT names the limits it changes; the rest keep what was stored.
  const current = await loadFloorSettings({ client });
  const stored = normaliseFloorSettings({ ...value, pauseLimits: { ...current.pauseLimits, ...(value?.pauseLimits || {}) } });
  await client.platformSetting.upsert({
    where: { key: FLOOR_SETTINGS_KEY },
    update: { value: stored },
    create: { key: FLOOR_SETTINGS_KEY, value: stored },
  });
  return stored;
}
