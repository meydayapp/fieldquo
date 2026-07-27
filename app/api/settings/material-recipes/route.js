// app/api/settings/material-recipes/route.js
//
// Lets a company override the built-in cost-estimate recipes in
// app/data/materialRecipes.js — primer/top-coat coverage, per-gallon costs,
// coat counts, consumable costs, labour minutes — from Settings > Material
// Costs, instead of only ever using the shared TrueFinish-derived defaults.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { MATERIAL_RECIPES, getRecipe } from "@/app/data/materialRecipes";

// GET → { cabinet_refinishing: { ...resolvedRecipe, _hasOverrides }, ... }
// One entry per recipe that exists, merging any saved overrides on top of
// the shared default so the settings form always shows the live numbers.
export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can edit material costs" },
      { status: 403 },
    );
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
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can edit material costs" },
      { status: 403 },
    );
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
