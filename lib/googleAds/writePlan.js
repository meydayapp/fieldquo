// lib/googleAds/writePlan.js
//
// The one place a Google spend plan (lib/googleAds/spendPlan.js) becomes
// database writes — shared by the report import and the API sync, so the
// two cannot drift on how a row is written or which rows a write may touch.

/**
 * @param {object} db         a Prisma client (or a fixture with the same calls)
 * @param {string} companyId  from the session or the connection row — never a body
 * @param {string} source     "google_ads_csv" | "google_ads_api"
 * @param {object} plan       buildGoogleSpendPlan's result
 */
export async function writeGoogleSpendPlan(db, companyId, source, plan) {
  for (const row of plan.toCreate) {
    // upsert, not create: two runs racing (a double click, the cron and a
    // "Sync now") both planned this row as new from the same snapshot. The
    // loser updates the winner's row with the same figures instead of
    // failing on the (companyId, source, externalId) unique key.
    await db.marketingSpend.upsert({
      where: { companyId_source_externalId: { companyId, source, externalId: row.externalId } },
      create: { companyId, ...row },
      update: row,
    });
  }
  for (const upd of plan.toUpdate) {
    // companyId AND source in the where: an update can only ever reach a row
    // THIS source wrote for THIS company — never a manual, Meta or other
    // Google row, however the plan was built.
    await db.marketingSpend.updateMany({
      where: { id: upd.id, companyId, source },
      data: upd.data,
    });
  }
}
