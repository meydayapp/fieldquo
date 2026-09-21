// lib/signup/nextStepsStore.js
//
// The database half of nextSteps.js: the one PlatformSetting row the console
// writes (on / off, delay in hours), and the social-proof sample. Kept apart
// from the pure module for the reason floorSettingsStore.js gives — the rule
// is executed in a check under bare node, which cannot hold a Prisma client.
//
// A failed read is the DEFAULTS and says so on the console: the letter's
// default is ON at two hours, so a settings table that cannot be reached
// sends the letter the owner asked for rather than silently sending nothing.
import { db } from "@/lib/db";
import {
  DEFAULT_NEXT_STEPS_SETTINGS,
  NEXT_STEPS_SETTING_KEY,
  industrySlugsForTrade,
  normaliseNextStepsSettings,
} from "./nextSteps";

export async function loadNextStepsSettings({ client = db } = {}) {
  if (typeof client?.platformSetting?.findUnique !== "function") return { ...DEFAULT_NEXT_STEPS_SETTINGS };
  try {
    const row = await client.platformSetting.findUnique({ where: { key: NEXT_STEPS_SETTING_KEY } });
    return normaliseNextStepsSettings(row?.value);
  } catch (err) {
    console.error("[next-steps email settings] could not be read; defaults apply:", err?.message);
    return { ...DEFAULT_NEXT_STEPS_SETTINGS };
  }
}

/** A PUT names the fields it changes; the rest keep what was stored. Returns what was stored. */
export async function saveNextStepsSettings({ value, client = db } = {}) {
  const current = await loadNextStepsSettings({ client });
  const stored = normaliseNextStepsSettings({ ...current, ...(value || {}) });
  await client.platformSetting.upsert({
    where: { key: NEXT_STEPS_SETTING_KEY },
    update: { value: stored },
    create: { key: NEXT_STEPS_SETTING_KEY, value: stored },
  });
  return stored;
}

/**
 * Minutes from company creation to the first quote, one number per real
 * company of this trade that has sent at least one quote. Real rows only:
 * no demos, a Subscription present (a company that never reached Checkout
 * is not a peer of somebody who just did). The pure firstQuoteProof()
 * decides whether the list is big enough to print.
 *
 * @returns number[]  empty when the trade is unknown
 */
export async function firstQuoteMinutesForTrade(tradeKey, { client = db } = {}) {
  const slugs = industrySlugsForTrade(tradeKey);
  if (!slugs.length || typeof client?.company?.findMany !== "function") return [];
  const companies = await client.company.findMany({
    where: { isDemo: false, industries: { hasSome: slugs }, subscription: { isNot: null } },
    select: {
      createdAt: true,
      quotes: { orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true } },
    },
  });
  const out = [];
  for (const c of companies) {
    const first = c.quotes?.[0]?.createdAt;
    if (!first || !c.createdAt) continue;
    const minutes = (new Date(first).getTime() - new Date(c.createdAt).getTime()) / 60000;
    if (Number.isFinite(minutes) && minutes >= 0) out.push(minutes);
  }
  return out;
}
