// app/api/supply-requests/options/route.js
//
// What the phone form offers: the jobs this person may name and the
// company's stock list with its levels.
//
// The jobs come from the SAME chooser the time clock uses
// (lib/timeclock/jobChoices.js) — today's visits first, then the open jobs
// the person may see — so a crew member cannot be offered a job here that
// the request route will then refuse. The stock list is names, units,
// levels and thresholds: counts, not prices, which is why a crew member may
// read it here when /api/stock (purchasing's own route) would refuse them.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { clockJobOptions } from "@/lib/timeclock/jobChoices";
import { stockLevels } from "@/lib/purchasing/stock";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);

  const [choices, materials, movements] = await Promise.all([
    clockJobOptions(db, { companyId: member.companyId, full, userId: member.userId, now: new Date() }),
    db.material.findMany({
      where: { companyId: member.companyId },
      select: { id: true, name: true, unit: true, reorderThreshold: true },
      orderBy: { name: "asc" },
    }),
    db.stockMovement.findMany({
      where: { companyId: member.companyId },
      select: { materialId: true, quantity: true },
    }),
  ]);

  return NextResponse.json({
    jobs: choices.options,
    materials: stockLevels(materials, movements).map((l) => ({
      id: l.materialId,
      name: l.name,
      unit: l.unit,
      level: l.level,
      threshold: l.threshold,
    })),
  });
}
