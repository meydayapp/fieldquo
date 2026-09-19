// app/api/quotes/[id]/review/calibrate/route.js
//
// POST { offerId } — press one "Update my costing" offer from the quote
// review's actuals finding.
//
// ── What is written, and by whom ───────────────────────────────────────────
//
// The offer was computed server-side when the review ran (lib/quotes/
// reviewFindings.js calibrationOffers, through the close-out's own
// labourCalibration / materialCalibration) and STORED with the review. The
// browser posts only the offer's id; the rate, the path and the store come
// off the stored review, never off the request — the same discipline as the
// add-on repricing, and non-negotiable #5 for free.
//
// The write is what the close-out's button would have written: the same
// path set on the same settings row through the same sanitiser (lib/pricing/
// sanitiseRates.js for the rate card, sanitiseRecipeOverrides for a recipe),
// so a rate moved from here is indistinguishable from one moved from the
// job's cost review. The difference the owner asked for — "attributed to the
// member" — is the activity row: who pressed it, on which quote, which rate,
// from what to what.
//
// ── Gates, in order ────────────────────────────────────────────────────────
//
// May they edit quotes; may they see costing (an offer is a cost figure);
// may they write THIS store — the calibration route's own rule, restated:
// recipes through the cost-basis grid, the rate card for owners and admins.
// Then: is the offer still what the review said? A rate somebody moved since
// is refused rather than overwritten, because the "from" the person read on
// the button is no longer true.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle } from "@/lib/permissions/enforce";
import { canWriteCostBasis } from "@/lib/permissions/costBasis";
import { recordActivity } from "@/lib/activity/log";
import { readPath, withPathSet } from "@/lib/costing/materialCalibration";
import { sanitiseRates } from "@/lib/pricing/sanitiseRates";
import { MATERIAL_RECIPES, sanitiseRecipeOverrides } from "@/app/data/materialRecipes";
import { canUseMaterialCostsCategory } from "@/lib/settings/tradeGate";

export async function POST(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_create_edit",
    "edit quotes",
  );
  if (denied) return denied;
  if (!hasToggle(full, "jobCosting")) {
    return NextResponse.json({ error: "You don't have access to job costing." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const offerId = typeof body?.offerId === "string" ? body.offerId : "";
  if (!offerId) return NextResponse.json({ error: "offerId required" }, { status: 400 });

  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, quoteNumber: true, aiReview: true },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const offers = Array.isArray(quote.aiReview?.actuals?.offers) ? quote.aiReview.actuals.offers : [];
  const offer = offers.find((o) => o && o.id === offerId) || null;
  if (!offer) {
    return NextResponse.json(
      { error: "That offer is not on this quote's review. Run the review again." },
      { status: 404 },
    );
  }

  const mayWrite =
    offer.store === "recipe"
      ? canWriteCostBasis(full, "materialRecipes")
      : offer.store === "book"
        ? ["owner", "admin"].includes(member.role)
        : false;
  if (!mayWrite) {
    return NextResponse.json(
      { error: "You don't have access to change this rate. Ask an owner or admin." },
      { status: 403 },
    );
  }

  const to = Number(offer.to);
  if (!Number.isFinite(to) || to <= 0) {
    return NextResponse.json({ error: "That offer carries no rate." }, { status: 400 });
  }

  let written;
  if (offer.store === "recipe") {
    written = await applyRecipe({ member, offer, to });
  } else {
    written = await applyBook({ member, offer, to });
  }
  if (written.error) return NextResponse.json({ error: written.error }, { status: written.status || 409 });

  await recordActivity(member, {
    action: "quote.costing_calibrated",
    entityType: "quote",
    entityId: quote.id,
    summary: `Updated ${offer.label || offer.categoryKey} ${offer.rateLabel || offer.path} from ${offer.from} to ${to} off the review of ${quote.quoteNumber || "a quote"}`,
    metadata: {
      quoteId: quote.id,
      offerId,
      kind: offer.kind,
      store: offer.store,
      categoryKey: offer.categoryKey,
      path: offer.path,
      from: offer.from ?? null,
      to,
    },
  });

  return NextResponse.json({ ok: true, offerId, store: offer.store, path: offer.path, from: offer.from ?? null, to });
}

/**
 * The recipe write PUT /api/settings/material-recipes performs, for one path.
 * Current overrides read fresh; the offer's "from" must still be what the
 * recipe resolves to, or the person pressed a button about a number that has
 * since moved.
 */
async function applyRecipe({ member, offer, to }) {
  if (!MATERIAL_RECIPES[offer.categoryKey]) return { error: "Unknown trade.", status: 400 };
  if (!(await canUseMaterialCostsCategory(member.companyId, offer.categoryKey))) {
    return { error: "This company doesn't sell that trade.", status: 403 };
  }
  const row = await db.materialRecipeSetting.findUnique({
    where: { companyId_categoryKey: { companyId: member.companyId, categoryKey: offer.categoryKey } },
    select: { overrides: true },
  });
  const overrides = row?.overrides && typeof row.overrides === "object" ? row.overrides : {};
  const current = readPath(overrides, offer.path);
  if (current !== undefined && offer.from != null && Number(current) !== Number(offer.from)) {
    return { error: "That rate has changed since the review ran. Run the review again." };
  }
  const { overrides: clean, errors } = sanitiseRecipeOverrides(
    offer.categoryKey,
    withPathSet(overrides, offer.path, to),
  );
  if (errors.length) return { error: errors.join(" "), status: 400 };
  await db.materialRecipeSetting.upsert({
    where: { companyId_categoryKey: { companyId: member.companyId, categoryKey: offer.categoryKey } },
    update: { overrides: clean },
    create: { companyId: member.companyId, categoryKey: offer.categoryKey, overrides: clean },
  });
  return { ok: true };
}

/**
 * The rate-card write PATCH /api/settings/service-categories performs, for
 * one path on one category. `categoryId` is resolved from the key here, not
 * trusted from the stored offer, because the key is what the sanitiser is
 * keyed by and the row is what the id names.
 */
async function applyBook({ member, offer, to }) {
  const category = await db.serviceCategory.findFirst({
    where: { key: offer.categoryKey },
    select: { id: true },
  });
  if (!category) return { error: "Unknown trade.", status: 400 };
  const row = await db.companyServiceCategory.findUnique({
    where: { companyId_categoryId: { companyId: member.companyId, categoryId: category.id } },
    select: { rates: true, enabled: true },
  });
  const rates = row?.rates && typeof row.rates === "object" ? row.rates : {};
  const current = readPath(rates, offer.path);
  if (current !== undefined && offer.from != null && Number(current) !== Number(offer.from)) {
    return { error: "That rate has changed since the review ran. Run the review again." };
  }
  const clean = sanitiseRates(offer.categoryKey, withPathSet(rates, offer.path, to));
  if (!clean || readPath(clean, offer.path) !== to) {
    return { error: "That rate is not one the price book lets a company change.", status: 400 };
  }
  await db.companyServiceCategory.upsert({
    where: { companyId_categoryId: { companyId: member.companyId, categoryId: category.id } },
    update: { rates: clean },
    create: { companyId: member.companyId, categoryId: category.id, enabled: row?.enabled ?? true, rates: clean },
  });
  return { ok: true };
}
