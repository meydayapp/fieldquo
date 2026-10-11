// lib/lifecycle/settingsStore.js
//
// The database half of lib/lifecycle/settings.js — the two PlatformSetting
// rows. A failed read is the EMPTY value, never a default person: the
// personal note then does not go out and the stories block is omitted, which
// is the safe failure for both (nothing is said in anybody's name).
import { db as realDb } from "@/lib/db";
import {
  CUSTOMER_STORIES_KEY,
  PERSONAL_SENDER_KEY,
  normalisePersonalSender,
  normaliseStories,
} from "./settings";

async function read(key, client) {
  if (typeof client?.platformSetting?.findUnique !== "function") return null;
  try {
    const row = await client.platformSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch (err) {
    console.error(`[lifecycle settings] ${key} could not be read; treated as empty:`, err?.message);
    return null;
  }
}

export async function loadLifecycleSettings({ client = realDb } = {}) {
  const [sender, stories] = await Promise.all([read(PERSONAL_SENDER_KEY, client), read(CUSTOMER_STORIES_KEY, client)]);
  return { personalSender: normalisePersonalSender(sender), stories: normaliseStories(stories) };
}

export async function savePersonalSender(value, { client = realDb } = {}) {
  const stored = normalisePersonalSender(value);
  await client.platformSetting.upsert({
    where: { key: PERSONAL_SENDER_KEY },
    update: { value: stored },
    create: { key: PERSONAL_SENDER_KEY, value: stored },
  });
  return stored;
}

export async function saveStories(list, { client = realDb } = {}) {
  const stored = normaliseStories(list);
  await client.platformSetting.upsert({
    where: { key: CUSTOMER_STORIES_KEY },
    update: { value: stored },
    create: { key: CUSTOMER_STORIES_KEY, value: stored },
  });
  return stored;
}
