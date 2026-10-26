// lib/stock/findOrCreateMaterial.js
//
// One shelf per material, found by name.
//
// Extracted from app/api/stock/purchase/route.js when purchase orders needed
// the same rule. Two copies of a find-or-create is how a company ends up with
// "Frog tape" and "Frog Tape" as separate shelves — the copy nobody edits is
// the one that keeps creating duplicates.
//
// Case-insensitive on purpose: lib/materials/sourcingList.js matches the name
// EXACTLY, so "Frog tape" typed on a purchase order and "Frog Tape" built from
// a job's material list would otherwise become two shelves for one roll. This
// side finds that row. The other half — sourcingList creating a second row
// when the case differs — is still there and still deliberate: it sits on the
// receipt-to-expense money path. Named rather than silently diverged from.

import { db } from "@/lib/db";

/**
 * @param {{ companyId: string, name: string, unit?: string|null,
 *           category?: string, prisma?: object }} args
 * @returns {Promise<{id, name, unit, created}|null>} null when there is
 *   nothing to name. `created` is false for a shelf that already existed —
 *   the caller needs that to tell "found yours" from "made you one", and
 *   recomputing it with a second lookup would race.
 */
export async function findOrCreateMaterial({
  companyId,
  name,
  unit = null,
  category = "stock",
  prisma = db,
}) {
  const clean = String(name ?? "").trim().slice(0, 200);
  if (!companyId || !clean) return null;

  const existing = await prisma.material.findFirst({
    where: { companyId, name: { equals: clean, mode: "insensitive" } },
    select: { id: true, name: true, unit: true },
  });
  if (existing) return { ...existing, created: false };

  const made = await prisma.material.create({
    // "stock" rather than "job_material": a thing bought onto the shelf is
    // not yet spoken for by any job.
    data: { companyId, name: clean, unit: unit || null, category },
    select: { id: true, name: true, unit: true },
  });
  return { ...made, created: true };
}
