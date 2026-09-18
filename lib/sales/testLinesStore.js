// lib/sales/testLinesStore.js
//
// The database half of lib/sales/testLines.js: one PlatformSetting row, read
// by every gate that judges a number and written by the platform console.
//
// Kept apart from the pure module for the reason lib/sales/windowOverrides.js
// gives for its own split: the rules run in the browser on a timer and in
// check scripts under bare node, and neither can hold a Prisma client.
//
// ══ A failed read is "no test lines", never "no window" ═══════════════════
//
// If the row cannot be read, the list is empty and every number is judged by
// the law as before. The other direction — a cold start exempting a
// stranger's number — is a compliance incident, and this is the one place
// that choice is made.
import { db } from "@/lib/db";
import { TEST_LINES_SETTING_KEY, normaliseTestLines } from "./testLines";

/** The E.164 numbers on the list, or [] when there are none or the read failed. */
export async function loadTestLines({ client = db } = {}) {
  try {
    const row = await client.platformSetting.findUnique({ where: { key: TEST_LINES_SETTING_KEY } });
    return normaliseTestLines(row?.value);
  } catch (err) {
    console.error("[sales test lines] could not be read; no number is exempt:", err?.message);
    return [];
  }
}

/**
 * Replace the list. The caller (app/api/platform/sales/test-lines) has
 * already checked the writer is a superadmin and logs the change; this only
 * normalises and writes, and returns what was actually stored so the screen
 * never shows a number the normaliser dropped.
 */
export async function saveTestLines({ numbers, client = db } = {}) {
  const value = normaliseTestLines(numbers);
  await client.platformSetting.upsert({
    where: { key: TEST_LINES_SETTING_KEY },
    update: { value },
    create: { key: TEST_LINES_SETTING_KEY, value },
  });
  return value;
}
