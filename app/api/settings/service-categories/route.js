// app/api/settings/service-categories/route.js
export const runtime = "nodejs";

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPriceBook, PRICE_BOOK_FIELDS } from "@/app/data/tradePriceBooks";
import { getCurrentMember } from "@/lib/currentMember"; // resolves session -> { companyId, role }
import { toStoredFields } from "@/app/data/intakeFieldLibrary";

// GET — system catalog + this company's own custom quote types, merged with
// this company's settings (enabled/rate/unit). Custom categories are scoped
// by companyId so one company never sees another's — a system category has
// companyId: null and is visible to everyone; a custom one only shows up
// for the company that created it.
export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await db.serviceCategory.findMany({
    where: { OR: [{ isSystem: true }, { companyId: member.companyId }] },
    orderBy: { sortOrder: "asc" },
    include: {
      companySettings: { where: { companyId: member.companyId } },
    },
  });

  const merged = categories.map((c) => {
    const setting = c.companySettings[0] || null;
    return {
      id: c.id,
      key: c.key,
      label: c.label,
      icon: c.icon,
      isSystem: c.isSystem,
      customFields: c.customFields || null,
      enabled: setting?.enabled ?? false,
      // No `pricingModel`: see the PATCH below. The column still exists but
      // nothing reads it, so returning it only invited a new caller to.
      defaultRate: setting?.defaultRate ?? null,
      unit: setting?.unit ?? null,
      // The trade's structured rates: code defaults with this company's sparse
      // overrides merged in. `rateOverrides` is sent alongside so the settings
      // screen can show which fields have actually been customised — and so a
      // save round-trips the patch rather than writing back a full copy of the
      // defaults, which would detach the company from future improvements.
      priceBook: getPriceBook(c.key, setting?.rates) || null,
      rateOverrides: setting?.rates ?? null,
    };
  });

  return NextResponse.json(merged);
}

// POST — create a custom (company-owned) quote type: a name plus a subset of
// fields chosen from the shared library (app/data/intakeFieldLibrary.js),
// rather than a from-scratch form builder. Auto-enabled immediately since
// there's no reason to create one you can't use yet — from then on it's
// toggled/priced through the same PATCH below as any system category.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners/admins can change settings" },
      { status: 403 },
    );
  }

  const { label, fieldKeys } = await request.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const customFields = toStoredFields(
    Array.isArray(fieldKeys) ? fieldKeys : [],
  );

  const category = await db.serviceCategory.create({
    data: {
      // Never user-typed — sidesteps any risk of colliding with the ~26
      // seeded system keys or another company's custom key, since `key`
      // stays globally unique across every ServiceCategory row.
      key: `custom_${randomUUID()}`,
      label: label.trim(),
      isSystem: false,
      companyId: member.companyId,
      customFields,
      companySettings: {
        create: { companyId: member.companyId, enabled: true },
      },
    },
  });

  return NextResponse.json(
    {
      id: category.id,
      key: category.key,
      label: category.label,
      icon: null,
      isSystem: false,
      customFields: category.customFields,
      enabled: true,
      defaultRate: null,
      unit: null,
    },
    { status: 201 },
  );
}

// PATCH — bulk upsert company's category settings
// body: { categories: [{ categoryId, enabled, defaultRate, unit, rates }] }
//
// `pricingModel` (flat | per_unit | hourly) is deliberately NOT accepted any
// more. It was written on every save and read by nothing: no quote, PDF,
// invoice or estimator ever branched on it, so a company that picked "hourly"
// got exactly the same prices as one that picked "flat". The real answer is
// per-trade — a cabinet shop charges per door and per drawer, a stair
// refinisher per tread and riser, a painter per square foot — and that lives
// in the price book (app/data/tradePriceBooks.js, stored as `rates`). Trades
// with no book keep `defaultRate` + `unit`, both of which ARE read when a
// quote line item is seeded.
//
// The CompanyServiceCategory.pricingModel column is left in place: dropping it
// is a data migration, not a code change. Existing rows keep whatever they
// last stored, and nothing looks at it.
export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners/admins can change settings" },
      { status: 403 },
    );
  }

  const { categories } = await request.json();
  if (!Array.isArray(categories)) {
    return NextResponse.json(
      { error: "categories array required" },
      { status: 400 },
    );
  }

  // Resolve categoryId -> key here rather than trusting the client to send it.
  // sanitiseRates needs the key to know which fields the trade has, and the
  // settings screen only ever posts categoryId — reading c.key would quietly
  // discard every saved rate.
  const known = await db.serviceCategory.findMany({
    where: { id: { in: categories.map((c) => c.categoryId).filter(Boolean) } },
    select: { id: true, key: true },
  });
  const keyById = new Map(known.map((k) => [k.id, k.key]));

  const results = await Promise.all(
    categories.map((c) =>
      db.companyServiceCategory.upsert({
        where: {
          companyId_categoryId: {
            companyId: member.companyId,
            categoryId: c.categoryId,
          },
        },
        update: {
          enabled: c.enabled,
          defaultRate: c.defaultRate ?? null,
          unit: c.unit || null,
          // Only touched when the caller sends it — a settings screen that
          // saves enabled/rate must not blank a company's rate book.
          ...(c.rates !== undefined && {
            rates: sanitiseRates(keyById.get(c.categoryId), c.rates),
          }),
        },
        create: {
          companyId: member.companyId,
          categoryId: c.categoryId,
          enabled: c.enabled,
          defaultRate: c.defaultRate ?? null,
          unit: c.unit || null,
          ...(c.rates !== undefined && {
            rates: sanitiseRates(keyById.get(c.categoryId), c.rates),
          }),
        },
      }),
    ),
  );

  return NextResponse.json({ success: true, updated: results.length });
}

/**
 * Keep a company's rate override to the fields its trade actually has.
 *
 * The browser sends this, and it is merged over the price book on every quote,
 * so an arbitrary object here would let a tenant graft junk (or a "__proto__")
 * onto the pricing model. Only paths declared in PRICE_BOOK_FIELDS survive, and
 * each value must be a finite number — a rate is never a string or an object.
 * Nothing left after filtering is stored as null, which correctly means
 * "this company has not customised anything".
 */
function sanitiseRates(categoryKey, rates) {
  const fields = PRICE_BOOK_FIELDS[categoryKey];
  if (!fields || !rates || typeof rates !== "object" || Array.isArray(rates)) return null;

  const out = {};
  let count = 0;
  for (const field of fields) {
    const value = readPath(rates, field.path);
    if (value === undefined || value === null || value === "") continue;
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    writePath(out, field.path, n);
    count += 1;
  }
  return count > 0 ? out : null;
}

function readPath(obj, path) {
  return String(path)
    .split(".")
    .reduce((node, part) => (node == null ? undefined : node[part]), obj);
}

function writePath(obj, path, value) {
  const parts = String(path).split(".");
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === "__proto__" || part === "constructor" || part === "prototype") return;
    if (!node[part] || typeof node[part] !== "object") node[part] = {};
    node = node[part];
  }
  const last = parts[parts.length - 1];
  if (last === "__proto__" || last === "constructor" || last === "prototype") return;
  node[last] = value;
}
