// app/api/platform/features/route.js
//
// Which features FieldQuo offers, globally and per company. Read AND write.
//
// ── Why writing is correct here, unlike most of /platform ──────────────────
//
// The non-negotiable is that the platform console can view everything and edit
// NOTHING on a COMPANY's data — FieldQuo must never alter a customer's quote.
// PlatformFeature and CompanyFeatureOverride are not a customer's data. They are
// FieldQuo's own commercial decision about what it sells to whom, in the same
// way DemoHostAvailability is FieldQuo's own sales calendar. If this route were
// read-only the availability rules would have to live in a constant, which is
// exactly the problem the registry replaced. Do not "fix" this by making it
// read-only.
//
// What it must never do — and does not — is write to a tenant table. Turning a
// feature off changes one row here and nothing else; the funnels, campaigns,
// call records and site blocks behind it are untouched and come back exactly as
// they were. scripts/check-feature-flags.mjs asserts that no tenant model is
// named in this file.
//
// ── The key is closed ──────────────────────────────────────────────────────
//
// assertKnownFeature on every write. The console renders the registry and cannot
// invent a key, but the API is the boundary that makes that true rather than
// merely likely — a curl with a typo would otherwise persist a row nothing ever
// reads, which is the failure class AGENTS.md names outright.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import {
  FEATURES,
  FEATURE_STATES,
  assertKnownFeature,
  normaliseState,
  resolveFeature,
} from "@/lib/features/registry";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function GET(request) {
  const me = await getCurrentPlatformAdmin(request);
  if (!me) return bad("Unauthorized", 401);

  const [globals, overrides, companies] = await Promise.all([
    db.platformFeature.findMany(),
    db.companyFeatureOverride.findMany({
      include: { company: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ key: "asc" }],
    }),
    // For the "add an override" picker. Demo accounts included on purpose — a
    // demo is exactly where you want to try a preview feature first.
    db.company.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  const globalByKey = new Map(globals.map((g) => [g.key, g]));

  return NextResponse.json({
    states: FEATURE_STATES,
    // The registry itself, so the console renders exactly the closed list and
    // has no way to offer a key that isn't in it.
    features: FEATURES.map((f) => {
      const globalRow = globalByKey.get(f.key);
      const resolvedGlobal = resolveFeature({ key: f.key, globalRow });
      return {
        key: f.key,
        label: f.label,
        blurb: f.blurb,
        defaultState: f.defaultState,
        adoptionField: f.adoptionField,
        spends: f.spends,
        gates: {
          nav: f.navKeys.length,
          pages: f.routePrefixes,
          apis: f.apiPrefixes,
          crons: f.cronPaths,
        },
        global: {
          state: resolvedGlobal.state,
          // "default" means no row exists — worth showing, because "on because
          // nobody has decided" and "on because somebody decided" are different
          // facts and the console should not blur them.
          source: resolvedGlobal.source,
          note: resolvedGlobal.note,
          updatedAt: globalRow?.updatedAt || null,
        },
        overrides: overrides
          .filter((o) => o.key === f.key)
          .map((o) => ({
            id: o.id,
            companyId: o.companyId,
            company: o.company,
            state: normaliseState(o.state) || o.state,
            // Surfaced rather than silently corrected: a row the resolver reads
            // as hidden-because-nonsense has to be visible as nonsense, or
            // somebody will keep wondering why a company can't see anything.
            malformed: normaliseState(o.state) === null,
            note: o.note,
            updatedAt: o.updatedAt,
          })),
      };
    }),
    companies,
  });
}

/**
 * Set the global state for one feature.
 *
 * Upsert rather than update: "no row" is a legitimate starting state (the
 * registry default), and requiring a seed step would mean either a write on a
 * GET or a console that can't act until someone runs a script.
 */
export async function PUT(request) {
  const me = await getCurrentPlatformAdmin(request);
  if (!me) return bad("Unauthorized", 401);
  // Availability decides what a paying customer receives, so it sits with the
  // other commercial levers rather than with "can view a company".
  try {
    requirePlatformPermission(me.role, "plan:manage");
  } catch (err) {
    return bad(err.message, err.status || 403);
  }

  const body = await request.json().catch(() => ({}));

  let key;
  try {
    key = assertKnownFeature(String(body?.key || ""));
  } catch (err) {
    return bad(err.message, err.status || 400);
  }

  const state = normaliseState(body?.state);
  if (!state) return bad(`state must be one of: ${FEATURE_STATES.join(", ")}.`);

  const note = noteFrom(body?.note);
  if (note instanceof Error) return bad(note.message);

  const row = await db.platformFeature.upsert({
    where: { key },
    create: { key, state, note, updatedById: me.id },
    update: { state, note, updatedById: me.id },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: me.id,
      action: "feature_global_set",
      details: { key, state, note },
    },
  });

  return NextResponse.json({ feature: row });
}

/**
 * Set, or clear, one company's override.
 *
 * `state: null` DELETES the row, which is how a company goes back to inheriting.
 * Deliberately not "write the global's current value" — that would freeze this
 * company at today's global and silently stop tracking it, which is a different
 * decision wearing the same button.
 */
export async function POST(request) {
  const me = await getCurrentPlatformAdmin(request);
  if (!me) return bad("Unauthorized", 401);
  try {
    requirePlatformPermission(me.role, "plan:manage");
  } catch (err) {
    return bad(err.message, err.status || 403);
  }

  const body = await request.json().catch(() => ({}));

  let key;
  try {
    key = assertKnownFeature(String(body?.key || ""));
  } catch (err) {
    return bad(err.message, err.status || 400);
  }

  const companyId = String(body?.companyId || "");
  if (!companyId) return bad("companyId is required.");

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) return bad("No such company.", 404);

  // Clearing: back to inheriting the global.
  if (body?.state === null) {
    await db.companyFeatureOverride.deleteMany({ where: { companyId, key } });
    await db.platformAuditLog.create({
      data: {
        platformAdminId: me.id,
        action: "feature_override_cleared",
        targetCompanyId: companyId,
        details: { key },
      },
    });
    return NextResponse.json({ cleared: true, key, companyId });
  }

  const state = normaliseState(body?.state);
  if (!state) {
    return bad(`state must be null (inherit) or one of: ${FEATURE_STATES.join(", ")}.`);
  }

  const note = noteFrom(body?.note);
  if (note instanceof Error) return bad(note.message);

  const row = await db.companyFeatureOverride.upsert({
    where: { companyId_key: { companyId, key } },
    create: { companyId, key, state, note, updatedById: me.id },
    update: { state, note, updatedById: me.id },
  });

  // targetCompanyId, so the company's own history page shows it. A contractor
  // ringing up about a feature that vanished deserves an answer with a date on
  // it, not a shrug.
  await db.platformAuditLog.create({
    data: {
      platformAdminId: me.id,
      action: "feature_override_set",
      targetCompanyId: companyId,
      details: { key, state, note, companyName: company.name },
    },
  });

  return NextResponse.json({ override: row });
}

/**
 * The note, validated.
 *
 * A contractor reads this on the locked screen, so it is bounded and trimmed —
 * and an empty string becomes null rather than an empty note, because "no
 * reason given" and "the reason is nothing" should not render differently.
 */
function noteFrom(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return new Error("note must be text.");
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 300) {
    return new Error("A note that long won't fit on the locked screen — keep it under 300 characters.");
  }
  return trimmed;
}
