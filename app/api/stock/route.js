// app/api/stock/route.js
//
// What is on the shelf — summed from movements, never read off a column.
//
// ══ Why this query looks expensive and isn't ═══════════════════════════════
//
// It reads every movement for the company and adds them up in code. The
// obvious alternative is a `groupBy` with a `_sum`, and it was rejected for a
// specific reason rather than a stylistic one: Prisma's `_sum` over a Decimal
// comes back as a Decimal built by the database, and the whole point of
// lib/purchasing/quantity.js is that quantities are summed as integers so a
// level cannot arrive as 3.0000000000000004. Doing the sum here keeps ONE
// implementation of the arithmetic — the one scripts/check-purchasing.mjs
// executes — rather than one in Postgres and one in JavaScript that agree
// until they don't.
//
// A company with enough movements for this to matter is a company that has
// outgrown this screen, and the fix then is a materialised ledger with its own
// reconciliation, not a silent second opinion.
//
// ══ reorderThreshold, finally read ═════════════════════════════════════════
//
// `Material.reorderThreshold` has been written by the materials screen and
// read by NOTHING since it was added — AGENTS.md failure class #1. This is the
// route that reads it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { stockLevels, lowStock } from "@/lib/purchasing/stock";
import { PURCHASING_CATEGORY, PURCHASING_LEVEL } from "@/lib/purchasing/access";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(
    member,
    PURCHASING_CATEGORY,
    PURCHASING_LEVEL,
    "see stock levels",
  );
  if (denied) return denied;

  const [materials, movements] = await Promise.all([
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

  const levels = stockLevels(materials, movements);

  return NextResponse.json({
    levels,
    // Sent separately rather than left for the browser to filter, so the
    // banner and the table cannot disagree about what "low" means.
    low: lowStock(levels),
    // How many materials have no threshold at all. The screen says this out
    // loud instead of implying every other material is fine: a material nobody
    // has set a threshold for has made no statement about running low, and
    // AGENTS.md failure class #5 is exactly the habit of padding that silence.
    withoutThreshold: levels.filter((l) => l.belowThreshold === null).length,
  });
}
