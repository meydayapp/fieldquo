// app/api/settings/material-recipes/route.js
//
// Lets a company override the built-in cost-estimate recipes in
// app/data/materialRecipes.js — primer/top-coat coverage, per-gallon costs,
// coat counts, consumable costs, labour minutes — from Settings > Material
// Costs, instead of only ever using the shared TrueFinish-derived defaults.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import {
  requireCostBasisRead,
  requireCostBasisWrite,
} from "@/lib/permissions/costBasis";
import { MATERIAL_RECIPES, getRecipe } from "@/app/data/materialRecipes";

// GET → { cabinet_refinishing: { ...resolvedRecipe, _hasOverrides }, ... }
// One entry per recipe that exists, merging any saved overrides on top of
// the shared default so the settings form always shows the live numbers.
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The GET had no check of any kind, on a payload the settings screen above
  // it describes as "what you actually pay for materials and labour, separate
  // from the price you charge the client". That is the cost basis, so it is
  // gated like the rest of it — read on the same rule as the write, because
  // there is no half of a per-gallon cost worth serving.
  //
  // Impersonation is carved out of the READ only, the way
  // /api/settings/cabinet-rates does it: non-negotiable #3 is that the
  // platform console views everything and edits nothing, and a support
  // session's role is "viewer", which holds no permission at all. PUT and
  // DELETE below do not consult member.impersonation, so a write cannot
  // acquire the carve-out by someone editing one place.
  if (!member.impersonation) {
    const full = await loadEnforceableMember(db, member.id);
    try {
      requireCostBasisRead(full, "materialRecipes");
    } catch (err) {
      const { body, status } = permissionErrorResponse(err);
      return NextResponse.json(body, { status });
    }
  }

  const saved = await db.materialRecipeSetting.findMany({
    where: { companyId: member.companyId },
  });
  const savedByKey = Object.fromEntries(
    saved.map((s) => [s.categoryKey, s.overrides]),
  );

  const result = {};
  for (const categoryKey of Object.keys(MATERIAL_RECIPES)) {
    result[categoryKey] = {
      ...getRecipe(categoryKey, savedByKey[categoryKey] || {}),
      _hasOverrides: Boolean(savedByKey[categoryKey]),
    };
  }

  return NextResponse.json(result);
}

// PUT { categoryKey, overrides } → upserts the company's override row.
// `overrides` should only contain keys that differ from the default (the UI
// sends the full edited set, which is fine — getRecipe() merges either way).
export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisWrite(full, "materialRecipes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { categoryKey, overrides } = await request.json();
  if (!categoryKey || !MATERIAL_RECIPES[categoryKey]) {
    return NextResponse.json({ error: "Unknown categoryKey" }, { status: 400 });
  }
  if (!overrides || typeof overrides !== "object") {
    return NextResponse.json({ error: "overrides must be an object" }, { status: 400 });
  }

  const saved = await db.materialRecipeSetting.upsert({
    where: {
      companyId_categoryKey: { companyId: member.companyId, categoryKey },
    },
    update: { overrides },
    create: { companyId: member.companyId, categoryKey, overrides },
  });

  return NextResponse.json({
    ...getRecipe(categoryKey, saved.overrides),
    _hasOverrides: true,
  });
}

// DELETE ?categoryKey=... → resets a company back to the shared defaults.
export async function DELETE(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisWrite(full, "materialRecipes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const categoryKey = new URL(request.url).searchParams.get("categoryKey");
  if (!categoryKey) {
    return NextResponse.json({ error: "categoryKey required" }, { status: 400 });
  }

  await db.materialRecipeSetting
    .delete({
      where: { companyId_categoryKey: { companyId: member.companyId, categoryKey } },
    })
    .catch(() => null); // fine if there was nothing saved yet

  return NextResponse.json({
    ...getRecipe(categoryKey, {}),
    _hasOverrides: false,
  });
}
