// app/api/platform/sales/confidence/route.js
//
// The confidence weights, for the superadmin screen that tunes them.
//
// ══ What is tunable, and what is a boundary ═══════════════════════════════
//
// lib/sales/intel/confidence.js's header is the authority here and this route
// implements exactly what it says: WEIGHT is a dial and CATEGORY is a
// boundary. A superadmin raising `identity.similar_name` — reasonably, trying
// to surface more matches — must not be able to also reclassify it as
// deterministic, because that would promote a resemblance two streets away
// into a verified identity across the whole database.
//
// So this list is not a CRUD list. There is no create and no delete: the
// signal vocabulary is a contract with the detectors that emit the signals,
// and a row naming something `SIGNALS` does not know contributes NOTHING to
// any figure — `weightsFrom` returns it as `unrecognised` rather than giving
// it a default weight. That is deliberate (absence of a statement is not a
// statement) and it means a hand-written signal row would be a control that
// appears to work and doesn't. The screen shows those rows, named, instead.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  CATEGORIES,
  FUZZY_CEILING,
  MATCH_THRESHOLD,
  SIGNALS,
  weightsFrom,
} from "@/lib/sales/intel/confidence";
import { knownSignals, superadminOrRefusal } from "@/lib/sales/intel/configAdmin";

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const rows = await db.confidenceRule.findMany({ orderBy: { signal: "asc" } });

  // The resolved answer, from the shipped resolver rather than from a second
  // reading of the same rows. What the engine will actually use is what the
  // screen has to show — computing it here a different way is how a weights
  // screen ends up describing weights nothing applies.
  const { weights, disabled, unrecognised } = weightsFrom(rows);

  const byName = new Map(rows.map((r) => [r.signal, r]));
  const known = knownSignals().map((s) => {
    const row = byName.get(s.signal);
    return {
      ...s,
      // No row yet: the engine falls back to the built-in default, so say so
      // rather than showing a blank that reads as "off".
      seeded: Boolean(row),
      weight: row ? Number(row.weight) : s.defaultWeight,
      enabled: row ? row.enabled : true,
      version: row?.version ?? null,
      updatedAt: row?.updatedAt ?? null,
      // What the engine resolves for this signal right now, including the
      // disabled case where there is no weight at all.
      effectiveWeight: disabled.has(s.signal) ? null : (weights.get(s.signal) ?? null),
      tunedAwayFromDefault: row ? Number(row.weight) !== s.defaultWeight : false,
    };
  });

  return NextResponse.json({
    signals: known,
    categories: CATEGORIES,
    // Rows in the table that no detector emits and no engine reads. Surfaced
    // rather than hidden: somebody tuning one of these is tuning nothing.
    unrecognised: unrecognised.map((signal) => {
      const row = byName.get(signal);
      return { signal, weight: row ? Number(row.weight) : null, enabled: row?.enabled ?? null };
    }),
    missing: Object.keys(SIGNALS).filter((s) => !byName.has(s)),
    // The two constants the whole identity half depends on. Shown because a
    // superadmin raising fuzzy weights deserves to see, on the same screen,
    // that no pile of them can ever reach an automatic match.
    thresholds: { matchThreshold: MATCH_THRESHOLD, fuzzyCeiling: FUZZY_CEILING },
  });
}
