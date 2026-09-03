// app/api/equipment/expiring/route.js
//
// The call list: every piece of customer equipment whose warranty has lapsed
// or is about to, across every client.
//
// ══ This endpoint IS the feature ═══════════════════════════════════════════
//
// Storing a serial number is bookkeeping. Being able to ring twelve households
// in March because their furnaces come out of cover in April is the thing
// worth building. Everything else in lib/equipment/ exists to make this list
// correct.
//
// ══ What is deliberately NOT in it ═════════════════════════════════════════
//
// Equipment with no warranty date. A blank is unknown, not expired
// (lib/expiry/window.js), and a call list padded with two hundred rows nobody
// can act on buries the twelve that are real. The count of them comes back
// separately as `tally.unknown`, because a company with 180 blanks has a
// data-entry problem and the honest way to say so is a number, not a call.
//
// ══ Gate ═══════════════════════════════════════════════════════════════════
//
// The same `clientsProperties: full_view` as the per-client panel. This
// returns client names and site addresses for the whole book, so anything
// looser would be the "restricted list, unrestricted detail route" hole QA
// already found once on /api/clients/[id].
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { requireEquipmentRead } from "@/lib/equipment/access";
import {
  expiringWarranties,
  warrantyTally,
  WARRANTY_SOON_DAYS,
} from "@/lib/equipment/warranty";

/**
 * How far ahead a caller may look.
 *
 * Capped at two years because beyond that the list stops being a call list and
 * becomes the whole installed base with dates on it — which is the per-client
 * panel's job, not this one's.
 */
const MAX_WITHIN_DAYS = 730;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireEquipmentRead(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const raw = new URL(request.url).searchParams.get("withinDays");
  const asked = raw === null ? WARRANTY_SOON_DAYS : Number(raw);
  // A junk window falls back to the documented default rather than to zero.
  // Zero would return only already-expired rows and look like "nothing is
  // coming up", which is the answer this screen must never give by accident.
  const withinDays =
    Number.isFinite(asked) && asked >= 0
      ? Math.min(Math.floor(asked), MAX_WITHIN_DAYS)
      : WARRANTY_SOON_DAYS;

  const rows = await db.clientEquipment.findMany({
    where: { companyId: member.companyId },
    select: {
      id: true,
      clientId: true,
      name: true,
      manufacturer: true,
      modelNumber: true,
      siteAddress: true,
      installedAt: true,
      warrantyEndsAt: true,
      warrantyProvider: true,
      client: { select: { id: true, name: true, phone: true, email: true } },
    },
    // Ordered here so the urgency sort below has a deterministic tiebreak —
    // two warranties ending the same day come back in the same order twice.
    orderBy: [{ warrantyEndsAt: "asc" }, { id: "asc" }],
  });

  const asOf = new Date();
  return NextResponse.json({
    withinDays,
    equipment: expiringWarranties(rows, { asOf, soonDays: withinDays }),
    tally: warrantyTally(rows, { asOf, soonDays: withinDays }),
  });
}
