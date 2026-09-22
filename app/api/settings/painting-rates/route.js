// app/api/settings/painting-rates/route.js
//
// The painting takeoff's rate card — rate sets per estimate type, product
// costs — read whole, and one custom rate added from the quote builder.
//
// ── Where the rates live ────────────────────────────────────────────────────
//
// On CompanyServiceCategory.rates under `takeoff`, the same row every other
// rate override of the trade sits on, so getPriceBook() lands them on
// book.takeoff without a second loader — every one of the twenty-odd callers
// that price a painting group (tradeScope, costing, calibration, the instant
// quote) reads the same merged book. The one wrinkle: the two painting books
// share one takeoff in CODE (see `takeoff:` on each in tradePriceBooks.js),
// but overrides ride on the CATEGORY row, and a company has two of them. So
// the subtree is written to BOTH painting rows, kept identical, and this
// route reads from whichever carries one. The Services editor does the same
// from the browser (PaintRateSets.js updates both categories' overrides).
//
// ── Who may write ───────────────────────────────────────────────────────────
//
// Owners and admins, the same rule PATCH /api/settings/service-categories
// applies to every other rate — a production rate is the company's price
// list. An estimator without that role who creates a custom rate in the
// picker gets a 403 here and keeps the rate on the line (PaintAreas.js), which
// is the honest answer rather than a silent no-op.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, canSeeMoney } from "@/lib/permissions/enforce";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import { sanitiseRates, PAINT_TAKEOFF_CATEGORIES } from "@/lib/pricing/sanitiseRates";
import {
  PAINT_ESTIMATE_TYPES,
  sanitisePaintRate,
} from "@/lib/pricing/paintTakeoff";

async function paintingRows(companyId) {
  const categories = await db.serviceCategory.findMany({
    where: { key: { in: PAINT_TAKEOFF_CATEGORIES }, isSystem: true },
    select: { id: true, key: true },
  });
  const settings = await db.companyServiceCategory.findMany({
    where: { companyId, categoryId: { in: categories.map((c) => c.id) } },
    select: { categoryId: true, rates: true },
  });
  const byCategory = new Map(settings.map((s) => [s.categoryId, s]));
  return categories.map((c) => ({ ...c, setting: byCategory.get(c.id) || null }));
}

/** The takeoff overrides a company carries — the first painting row with one. */
function takeoffOverridesOf(rows) {
  for (const r of rows) {
    const t = r.setting?.rates?.takeoff;
    if (t && typeof t === "object") return r.setting.rates;
  }
  return rows[0]?.setting?.rates || null;
}

// GET — the merged takeoff book (defaults + this company's overrides) and the
// sparse overrides, for a member who may see money.
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  if (!canSeeMoney(full)) {
    return NextResponse.json({ error: "Pricing is hidden for your role" }, { status: 403 });
  }
  const rows = await paintingRows(member.companyId);
  const overrides = takeoffOverridesOf(rows);
  const book = getPriceBook("interior_painting", overrides);
  return NextResponse.json({
    takeoff: book?.takeoff || null,
    overrides: overrides?.takeoff || null,
  });
}

// POST — add ONE custom rate to one estimate type's set. Body:
// { estimateType, rate: { label, situation, substrate, basis, productionRate |
//   hoursPerUnit | sellPerUnit } }. Answers { key, rate }.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners/admins can change rates" },
      { status: 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const estimateType =
    typeof body?.estimateType === "string" &&
    Object.prototype.hasOwnProperty.call(PAINT_ESTIMATE_TYPES, body.estimateType)
      ? body.estimateType
      : null;
  if (!estimateType) {
    return NextResponse.json({ error: "estimateType required" }, { status: 400 });
  }
  const rate = sanitisePaintRate(body?.rate);
  if (!rate || rate.hidden) {
    return NextResponse.json({ error: "A rate needs a name and a figure" }, { status: 400 });
  }

  const rows = await paintingRows(member.companyId);
  if (!rows.length) {
    return NextResponse.json({ error: "Painting is not in the catalogue" }, { status: 404 });
  }
  const current = takeoffOverridesOf(rows) || {};
  const existing = current.takeoff?.rateSets?.[estimateType]?.rates || {};

  // A key from the label, unique within the set. Slugged the same way the
  // sanitiser's KEY_RE expects, and never one of the defaults' keys — a
  // custom "8 ft walls" must not overwrite the recovered one.
  const base =
    rate.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 36) || "rate";
  const defaults = getPriceBook("interior_painting", null)?.takeoff?.rateSets?.[estimateType]?.rates || {};
  let key = `c_${base}`;
  let n = 2;
  while (
    Object.prototype.hasOwnProperty.call(existing, key) ||
    Object.prototype.hasOwnProperty.call(defaults, key)
  ) {
    key = `c_${base}_${n}`;
    n += 1;
  }

  const nextRates = {
    ...current,
    takeoff: {
      ...(current.takeoff || {}),
      rateSets: {
        ...(current.takeoff?.rateSets || {}),
        [estimateType]: {
          ...(current.takeoff?.rateSets?.[estimateType] || {}),
          rates: { ...existing, [key]: rate },
        },
      },
    },
  };

  // Through the same boundary the Services editor's save goes through, so
  // the two cannot disagree about what a stored override may contain.
  await Promise.all(
    rows.map((r) =>
      db.companyServiceCategory.upsert({
        where: {
          companyId_categoryId: { companyId: member.companyId, categoryId: r.id },
        },
        update: {
          rates: sanitiseRates(r.key, {
            ...(r.setting?.rates || {}),
            takeoff: nextRates.takeoff,
          }),
        },
        create: {
          companyId: member.companyId,
          categoryId: r.id,
          enabled: false,
          rates: sanitiseRates(r.key, { takeoff: nextRates.takeoff }),
        },
      }),
    ),
  );

  return NextResponse.json({ key, rate });
}
