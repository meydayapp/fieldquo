// app/api/platform/sales/capabilities/route.js
//
// The FieldQuo capability matrix, for the superadmin screen that edits it.
//
// ══ Superadmin only ═══════════════════════════════════════════════════════
//
// Same bar as POST /api/platform/sales/reps and for the same reason: there is
// no sales permission in PLATFORM_PERMISSIONS, and adding one would imply that
// map has a scoping concept it does not have. This is not a support task —
// what is in this table decides what every rep is allowed to promise a
// stranger, and a wrong row is a promise FieldQuo cannot keep.
//
// ══ Why the list carries the rules that depend on each row ════════════════
//
// `active: false` on a capability silently stops every rule that recommends it.
// A screen that offers the toggle without saying so is a destructive operation
// labelled as cosmetic — AGENTS.md's seventh failure class — so the rule count
// travels with the row and the screen prints it inside the confirmation.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import {
  capabilityMatrix,
  repScript,
  EXCLUDED_CAPABILITIES,
} from "@/lib/sales/intel/capabilities";
import { loadCapabilityMatrix, seedIntelConfig } from "@/lib/sales/intel/db";

async function superadminOrRefusal(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return { admin: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  if (admin.role !== "superadmin") {
    return {
      admin: null,
      refusal: {
        status: 403,
        body: { error: "Only superadmins can edit what the sales team is allowed to promise" },
      },
    };
  }
  return { admin, refusal: null };
}

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const [rows, rules] = await Promise.all([
    loadCapabilityMatrix({ includeInactive: true }),
    db.opportunityRule.findMany({
      select: { code: true, name: true, capabilityCode: true, active: true, priority: true },
      orderBy: [{ priority: "desc" }, { code: "asc" }],
    }),
  ]);

  const rulesByCapability = new Map();
  for (const r of rules) {
    if (!rulesByCapability.has(r.capabilityCode)) rulesByCapability.set(r.capabilityCode, []);
    rulesByCapability.get(r.capabilityCode).push(r);
  }

  // What the seed WOULD write, so the screen can say "this table is empty" or
  // "the code knows about three capabilities this database has never seen"
  // rather than showing an empty list that looks like a bug.
  const seedCodes = capabilityMatrix().map((c) => c.code);
  const present = new Set(rows.map((r) => r.code));

  return NextResponse.json({
    capabilities: rows.map((c) => ({
      ...c,
      // What a rep actually reads, composed once here rather than by each
      // renderer — the caller that forgets to append the caveats is the one
      // that ships. See repScript's own header.
      script: repScript(c),
      rules: rulesByCapability.get(c.code) || [],
      // A capability nothing recommends can never reach a rep. Not an error —
      // the matrix is the vocabulary and rules are added over time — but it is
      // the thing somebody wants to know when they wonder why a capability
      // never appears on a prospect.
      reachable: (rulesByCapability.get(c.code) || []).some((r) => r.active),
    })),
    unseeded: seedCodes.filter((code) => !present.has(code)),
    // Carried so the screen can show what was deliberately NOT built, with the
    // reason. An absent capability is a decision on the record; a screen that
    // only lists what exists makes it look like an oversight.
    excluded: EXCLUDED_CAPABILITIES,
  });
}

/**
 * Run the seed.
 *
 * A POST rather than a script-only path because the screen is useless against
 * an empty table and "ssh in and run a script" is not a control anybody can
 * see. Idempotent, additive, deletes nothing — seedIntelConfig's header says
 * exactly what it refreshes and what it leaves to whoever edits this screen.
 */
export async function POST(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  try {
    const counts = await seedIntelConfig();
    return NextResponse.json({ counts });
  } catch (err) {
    // A seed failure is almost always a capability citing a marketing key that
    // was renamed — capabilityMatrix() throws with the code and the key. That
    // message is worth showing, because the fix is a one-line edit and the
    // generic 500 would send somebody reading a stack trace instead.
    console.error("[sales/capabilities] seed failed:", err?.message);
    return NextResponse.json({ error: err?.message || "The seed failed" }, { status: 500 });
  }
}
