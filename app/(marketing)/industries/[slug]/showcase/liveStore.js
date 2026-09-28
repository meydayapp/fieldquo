// app/(marketing)/industries/[slug]/showcase/liveStore.js
//
// Where POST /api/showcase/roof-measure keeps the two things that must
// survive a serverless instance: today's count of paid measurements (the
// global cap and each visitor's share of it) and the 30-day answer per
// address. Server-only.
//
// ══ Why PlatformSetting, and not a new table or memory ═════════════════════
//
// Memory is not an option for either: lib/rateLimit.js says it plainly — its
// window lives per Lambda instance, and a cold start forgets it. A daily cap
// held there is a cap per instance, which on a scaled-out deployment is no
// cap. The repo has no Redis or KV. It does have PlatformSetting, FieldQuo's
// own key/value table ("Key/value, deliberately dull" — prisma/schema.prisma),
// which holds FieldQuo's facts and never a tenant's. So: no schema change,
// and the rows are named so nothing else can collide with them —
//
//   showcase.roofMeasure.day.<YYYY-MM-DD>     { count, visitors: { tag: n } }
//   showcase.roofMeasure.cache.<sha256>       { v, at, outcome, geo, roof }
//
// One day row per UTC day, and at most the day's cap of cache rows — the cap
// is what bounds how many new addresses can be written. Nothing here is ever
// deleted (an expired answer is overwritten the next time that address is
// asked). A visitor is a keyed hash of their IP and the day, never the IP.
//
// ══ The count is reserved in ONE statement ════════════════════════════════
//
// Read-then-write would let two requests at count 99 both see room under a
// cap of 100 and both spend. The upsert below increments only WHERE the day
// is under the cap and the visitor under their share, and returns nothing
// when either is full — Postgres serialises the two on the row, so the cap
// is exact. scripts/check-roofing-example.mjs runs this SQL on PGlite.

/**
 * $1 key · $2 visitor tag · $3 daily cap · $4 per-visitor limit.
 * The INSERT branch is the day's first request, allowed whenever both limits
 * are at least 1 — the caller refuses a cap of 0 before asking.
 */
export const RESERVE_SQL = `
INSERT INTO "PlatformSetting" ("key", "value", "updatedAt")
VALUES ($1, jsonb_build_object('count', 1, 'visitors', jsonb_build_object($2::text, 1)), NOW())
ON CONFLICT ("key") DO UPDATE SET
  "value" = jsonb_build_object(
    'count', COALESCE(("PlatformSetting"."value"->>'count')::int, 0) + 1,
    'visitors', COALESCE("PlatformSetting"."value"->'visitors', '{}'::jsonb)
      || jsonb_build_object($2::text, COALESCE(("PlatformSetting"."value"->'visitors'->>$2::text)::int, 0) + 1)
  ),
  "updatedAt" = NOW()
WHERE COALESCE(("PlatformSetting"."value"->>'count')::int, 0) < $3::int
  AND COALESCE(("PlatformSetting"."value"->'visitors'->>$2::text)::int, 0) < $4::int
RETURNING "value"`;

/** The store over a Prisma client (lib/db's `db`), or anything shaped like one. */
export function platformSettingStore(db) {
  return {
    async readCache(key) {
      const row = await db.platformSetting.findUnique({ where: { key } });
      return row?.value ?? null;
    },
    async writeCache(key, value) {
      await db.platformSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
    },
    /**
     * Take one of today's paid measurements, or say which limit is full.
     * @returns {{ ok: true, count } | { ok: false, why: "cap" | "visitor" }}
     */
    async reserve({ dayKey, visitor, cap, perVisitor }) {
      if (!(cap >= 1) || !(perVisitor >= 1)) return { ok: false, why: "cap" };
      const rows = await db.$queryRawUnsafe(RESERVE_SQL, dayKey, visitor, cap, perVisitor);
      if (Array.isArray(rows) && rows.length) return { ok: true, count: Number(rows[0]?.value?.count) || null };
      const row = await db.platformSetting.findUnique({ where: { key: dayKey } });
      return { ok: false, why: (Number(row?.value?.count) || 0) >= cap ? "cap" : "visitor" };
    },
  };
}
