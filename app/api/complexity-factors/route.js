// app/api/complexity-factors/route.js
//
// The company's library of its OWN complexity factors — the "tight access,
// +15%" an estimator typed once and wants again (prisma
// ComplexityFactorPreset, lib/pricing/customFactors.js).
//
// GET  → the live rows (archived ones are left out), oldest first. Readable by
//        anyone who can see quotes: the builder's "From your library" list
//        opens on it. A percentage or an amount is the company's pricing, so
//        a member without showPricing gets the labels with `value` removed —
//        the same boundary /api/quote-text-blocks keeps.
// POST → a new row. Same bar as the text-block library: someone who can
//        create quotes, and who can see prices — a factor is nothing BUT a
//        price, so a member who may not see one may not write one either.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle } from "@/lib/permissions/enforce";
import { LANGUAGE_CODES } from "@/app/i18n/languages";
import { normalisePresetInput, presentPreset } from "@/lib/pricing/customFactors";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_only", "see the complexity library");
  if (denied) return denied;

  const rows = await db.complexityFactorPreset.findMany({
    where: { companyId: member.companyId, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const showPricing = hasToggle(full, "showPricing");
  return NextResponse.json(rows.map((r) => presentPreset(r, { showPricing })));
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "add to the complexity library");
  if (denied) return denied;
  if (!hasToggle(full, "showPricing")) {
    return NextResponse.json(
      { error: "A complexity factor is a price, and your access level hides prices. Ask an owner or admin to add it." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = normalisePresetInput(body, { languages: LANGUAGE_CODES });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // The language the label was typed in: what the caller says (the builder
  // sends the quote's language), else the company's default. Never guessed
  // from the words.
  let language = parsed.data.language;
  if (!language) {
    const company = await db.company.findUnique({ where: { id: member.companyId }, select: { defaultLanguage: true } });
    language = company?.defaultLanguage || "en";
  }

  // The same label and mode already in the library is the same factor —
  // "Save to library" pressed twice must not list it twice.
  const same = await db.complexityFactorPreset.findFirst({
    where: {
      companyId: member.companyId,
      archivedAt: null,
      mode: parsed.data.mode,
      label: { equals: parsed.data.label, mode: "insensitive" },
    },
  });
  if (same) return NextResponse.json({ ...presentPreset(same, { showPricing: true }), existed: true });

  const row = await db.complexityFactorPreset.create({
    data: {
      companyId: member.companyId,
      label: parsed.data.label,
      mode: parsed.data.mode,
      value: parsed.data.value,
      language,
      createdById: member.userId || null,
    },
  });
  return NextResponse.json(presentPreset(row, { showPricing: true }), { status: 201 });
}
