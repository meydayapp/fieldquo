// lib/platform/errorLog.js
//
// One way to record a real failure so support can see it later.
//
// Contract: recordError NEVER throws and never blocks. It is called from inside
// catch blocks — a logger that can fail there would turn a handled problem into
// an unhandled one. Every failure inside it is swallowed after a console.error.
//
// Keep it to genuine failures. If this becomes a debug log it stops being worth
// opening, and "no errors" stops meaning anything.

import { db } from "@/lib/db";

/**
 * @param {object} p
 * @param {string} p.area     email | sms | ai | stripe | webhook | pdf | upload | cron | api
 * @param {string} p.message  human-readable; what failed
 * @param {string} [p.code]   groupable short code
 * @param {string} [p.companyId]
 * @param {object} [p.detail] ids, status codes, trimmed stack
 */
export async function recordError({ area, message, code, companyId, detail } = {}) {
  try {
    if (!area || !message) return;
    await db.platformErrorLog.create({
      data: {
        area: String(area).slice(0, 40),
        code: code ? String(code).slice(0, 60) : null,
        message: String(message).slice(0, 1000),
        companyId: companyId || null,
        detail: detail ?? null,
      },
    });
  } catch (err) {
    // Deliberately terminal. If the error log itself is broken, the last thing
    // to do is throw from a catch block.
    console.error("[errorLog] could not record:", err?.message);
  }
}

/** Trim a thrown value into something worth storing. */
export function errorDetail(err, extra = {}) {
  return {
    ...extra,
    ...(err?.name ? { name: err.name } : {}),
    ...(err?.status || err?.http_code ? { status: err.status || err.http_code } : {}),
    // First few frames only — enough to locate it, not a wall of node_modules.
    ...(err?.stack ? { stack: String(err.stack).split("\n").slice(0, 4).join("\n") } : {}),
  };
}
