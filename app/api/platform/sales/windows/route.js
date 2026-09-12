// app/api/platform/sales/windows/route.js
//
// The per-jurisdiction calling-window override: read by every platform admin,
// written by a superadmin.
//
// ══ What a row here changes, and what it cannot ═══════════════════════════
//
// lib/sales/callingRules.js is the law; a SalesJurisdictionOverride row is
// how hard FieldQuo's own screens apply it — enforce (refuse, today's
// behaviour), warn (allow, say so), off (do not apply). Every gate reads the
// row through lib/sales/windowPolicy.js's effectiveWindowPolicy(), and that
// resolver holds any relaxed mode at `enforce` for a jurisdiction whose
// telemarketer registration is outstanding. This route stores what a
// superadmin asked for and REPORTS the hold beside it; it never decides the
// hold itself, because a second copy of that rule is how the console and the
// dial start disagreeing.
//
// ══ Superadmin writes, everyone reads ═════════════════════════════════════
//
// Relaxing a calling window is the same class of decision as recording a
// registration: it decides whether a rep may ring somebody at nine at night,
// and getting it wrong in the permissive direction is a private right of
// action in Oklahoma and Florida. So the write sits behind superadminOrRefusal
// like the registration route. The READ is open to any platform admin —
// support should be able to see why a rep's screen said "warn only".
//
// ══ Never deleted ═════════════════════════════════════════════════════════
//
// There is no DELETE. Setting a row back to "enforce" is the default, and the
// row stays as the record of who relaxed what and when — the same argument
// the registration and suppression tables make for keeping rows.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { CALLING_JURISDICTIONS, describeWindow, jurisdictionKey } from "@/lib/sales/callingRules";
import { registeredKeys, registrationStatus } from "@/lib/sales/registrations";
import {
  WINDOW_MODES,
  WINDOW_MODE_ENFORCE,
  effectiveWindowPolicy,
  isWindowMode,
  overrideKey,
} from "@/lib/sales/windowPolicy";

const MAX_NOTE = 500;
const bad = (error, status = 400) => NextResponse.json({ error }, { status });

/**
 * Country and region for a jurisdiction key, the way the row stores them.
 * "US-OK" → { country: "US", region: "OK" }; "CA" → { country: "CA", region: "" }.
 */
function splitKey(key) {
  const [country, region = ""] = String(key).split("-");
  return { country, region };
}

/** Every jurisdiction the law file knows, with its law, its hold and its row. */
async function payload(now = new Date()) {
  const [rows, certificates] = await Promise.all([
    db.salesJurisdictionOverride.findMany({ include: { setBy: { select: { email: true } } } }),
    db.salesTelemarketerRegistration.findMany(),
  ]);
  const registered = registeredKeys(certificates, now);
  const byKey = new Map(rows.map((r) => [overrideKey(r), r]));

  const jurisdictions = Object.keys(CALLING_JURISDICTIONS)
    .map((key) => {
      const law = CALLING_JURISDICTIONS[key];
      const { country, region } = splitKey(key);
      const policy = effectiveWindowPolicy({ country, region: region || null, overrides: rows, registeredKeys: registered });
      const row = byKey.get(key) || null;
      const registration = registrationStatus(key, certificates, { now });
      return {
        key,
        country,
        region,
        name: law.name,
        verified: law.verified === true,
        // The window as the rep's screen says it. A verified row with no
        // window takes FieldQuo's courtesy window, and the screen says whose
        // rule it is — same words as callingRules' salesCallReadiness.
        window: law.window ? describeWindow(law.window) : null,
        statutoryWindow: Boolean(law.window),
        prohibition: Boolean(law.prohibition),
        cap: law.maxCallsPer24h ?? null,
        registrationRequired: law.registration?.required === true,
        registrationState: registration.state,
        registrationGated: policy.registrationGated,
        mode: policy.mode,
        requestedMode: policy.requestedMode,
        heldByRegistration: policy.heldByRegistration,
        note: policy.note,
        setBy: row?.setBy?.email || null,
        updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { jurisdictions, modes: WINDOW_MODES, serverNow: now.toISOString() };
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  return NextResponse.json(await payload());
}

export async function PUT(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return bad("Expected a JSON body.");

  // Checked against the LAW FILE through the same key rule the dial uses. A
  // row for a place nobody has read would store cleanly and relax nothing —
  // the resolver ignores unknown keys — which is a control that appears to
  // work and doesn't.
  const key = jurisdictionKey({ country: body.country, province: body.region || null });
  if (!key || !CALLING_JURISDICTIONS[key]) {
    return bad("That is not a jurisdiction the calling rules have read.");
  }
  const { country, region } = splitKey(key);

  const mode = typeof body.mode === "string" ? body.mode.trim() : "";
  if (!isWindowMode(mode)) {
    return bad(`Mode is one of ${WINDOW_MODES.join(", ")}.`);
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE) : "";
  // A relaxed window with no reason on it cannot be reviewed later. Enforce
  // is the default and needs none.
  if (mode !== WINDOW_MODE_ENFORCE && !note) {
    return bad("Say why the window is being relaxed — it is shown to the rep and kept on the record.");
  }

  const data = { mode, note: note || null, setById: admin.id };
  await db.salesJurisdictionOverride.upsert({
    where: { country_region: { country, region } },
    create: { country, region, ...data },
    update: data,
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: mode === WINDOW_MODE_ENFORCE ? "sales_window_override_enforced" : "sales_window_override_relaxed",
      details: { jurisdictionKey: key, name: CALLING_JURISDICTIONS[key].name, mode, note: note || null },
    },
  });

  return NextResponse.json(await payload());
}
