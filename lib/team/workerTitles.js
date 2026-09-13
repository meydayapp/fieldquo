// lib/team/workerTitles.js
//
// The server-side half of lib/team/personLabel.js: look up job titles for a
// list of MEMBERS.
//
// A title lives on Worker (see the schema note on Worker.title), and most
// person lists in /app are built from Member rows — /api/settings/members is
// the roster source for the appointments, tasks, visit and invoice pickers,
// the team schedule, and the staff chat's directory. Member has no relation to
// Worker; the two meet on userId. Rather than every one of those routes
// re-deriving that join, they call this and spread the answer in.
//
// ── Scoped to the company, always ───────────────────────────────────────────
//
// Worker.userId is globally unique, so a user could be looked up through
// User.worker directly — but that row may belong to ANOTHER company (the
// conflict case lib/team/ensureWorker.js describes), and printing its title on
// this company's roster would leak a stranger's org chart one word at a time.
// The lookup is by companyId AND userId, so a title only ever comes from a
// Worker row of the company whose list is being drawn.

import { db } from "@/lib/db";

/**
 * @returns {Promise<Map<string, string>>} userId → title, for the users in
 *   `userIds` who have a Worker row in this company WITH a title. Absent means
 *   absent; the map holds no nulls for callers to trip over.
 */
export async function workerTitlesByUserId(companyId, userIds, { client = db } = {}) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!companyId || ids.length === 0) return new Map();
  const rows = await client.worker.findMany({
    where: { companyId, userId: { in: ids } },
    select: { userId: true, title: true },
  });
  const out = new Map();
  for (const r of rows) {
    const t = typeof r.title === "string" ? r.title.trim() : "";
    if (r.userId && t) out.set(r.userId, t);
  }
  return out;
}

/**
 * Decorate member-shaped rows with `title` from the map. `null` when there is
 * none, so a consumer can rely on the key existing without inventing a word.
 */
export function withWorkerTitles(rows, titles, userIdOf = (r) => r.userId) {
  return (rows || []).map((r) => ({ ...r, title: titles.get(userIdOf(r)) || null }));
}
