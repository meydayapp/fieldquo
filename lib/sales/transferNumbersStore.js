// lib/sales/transferNumbersStore.js
//
// The database half of lib/sales/transferNumbers.js: one PlatformSetting row,
// read by the transfer route on every picker open and written by the
// platform console.
//
// Kept apart from the pure module for the reason lib/sales/testLinesStore.js
// gives for its own split: the list is judged inside a state machine a check
// script drives under bare node, and that cannot hold a Prisma client.
//
// ══ A failed read is "no phones", never a guessed phone ═══════════════════
//
// If the row cannot be read, the picker offers no phone targets and says so.
// The other direction — a cold start offering a number from a cache or a
// default — would put a destination on a transfer button that nobody
// sanctioned, which is the one thing the allow-list exists to prevent.
import { db } from "@/lib/db";
import { TRANSFER_NUMBERS_SETTING_KEY, normaliseTransferNumbers } from "./transferNumbers";

/** The entries on the list, or [] when there are none or the read failed. */
export async function loadTransferNumbers({ client = db } = {}) {
  try {
    const row = await client.platformSetting.findUnique({ where: { key: TRANSFER_NUMBERS_SETTING_KEY } });
    return normaliseTransferNumbers(row?.value);
  } catch (err) {
    console.error("[sales transfer numbers] could not be read; no phone is offered:", err?.message);
    return [];
  }
}

/**
 * Replace the list. The caller (app/api/platform/sales/transfer-numbers) has
 * already checked the writer is a superadmin and logs the change; this only
 * normalises and writes, and returns what was actually stored so the screen
 * never shows an entry the normaliser dropped. Ids are derived, not stored —
 * only `{ e164, label }` goes into the row.
 */
export async function saveTransferNumbers({ numbers, client = db } = {}) {
  const value = normaliseTransferNumbers(numbers).map(({ e164, label }) => ({ e164, label }));
  await client.platformSetting.upsert({
    where: { key: TRANSFER_NUMBERS_SETTING_KEY },
    update: { value },
    create: { key: TRANSFER_NUMBERS_SETTING_KEY, value },
  });
  return normaliseTransferNumbers(value);
}
