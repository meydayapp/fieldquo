// app/api/settings/translations/route.js
//
// The review surface for company-authored translations.
//
// GET  — every service, with its translated text for one language and a count
//        of what's still missing.
// PATCH — save a corrected translation.
//
// The point of the review step: lib/i18n/translateContent.js drafts these with
// a model, and a drafted translation is not a reviewed one. Trade vocabulary
// is exactly where machine translation goes wrong — "finish", "trim", "coat"
// and "run" all mean something specific on a job site and something else in a
// dictionary. Nothing here is presented as correct until a person says so.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { isSupported } from "@/app/i18n/languages";
import { isAiConfigured } from "@/lib/ai/provider";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language");

  if (!language || !isSupported(language)) {
    return NextResponse.json(
      { error: "Pass a supported language code." },
      { status: 400 },
    );
  }

  const [company, products] = await Promise.all([
    db.company.findUnique({
      where: { id: member.companyId },
      select: { defaultLanguage: true, sendLanguages: true },
    }),
    db.product.findMany({
      where: { companyId: member.companyId, active: true },
      select: {
        id: true,
        name: true,
        description: true,
        translations: true,
        type: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const sourceLanguage = company?.defaultLanguage || "en";

  const items = products.map((p) => {
    const entry = p.translations?.[language] || null;
    return {
      id: p.id,
      type: p.type,
      source: { name: p.name, description: p.description || "" },
      translation: {
        name: entry?.name || "",
        description: entry?.description || "",
      },
      // A translated name with an untranslated description still reads as
      // unfinished on a quote, so it counts as missing.
      missing: !entry?.name || (Boolean(p.description) && !entry?.description),
      reviewed: Boolean(entry?.reviewed),
    };
  });

  return NextResponse.json({
    language,
    sourceLanguage,
    total: items.length,
    missing: items.filter((i) => i.missing).length,
    unreviewed: items.filter((i) => !i.reviewed && !i.missing).length,
    items,
    // Whether the "fill in the blanks" button should exist at all. Local dev and
    // any deployment without OPENAI_API_KEY genuinely cannot draft, and a button
    // that renders and then explains why it can't work is the dead control
    // AGENTS.md keeps finding. The page prints a sentence instead.
    aiAvailable: isAiConfigured(),
    // Drafting spends the company's AI allowance, so it carries the same bar as
    // editing the catalogue. A supervisor can still review and save by hand.
    canDraft: member.role === "owner" || member.role === "admin",
  });
}

export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId, language, name, description } = await request
    .json()
    .catch(() => ({}));

  if (!productId || !isSupported(language)) {
    return NextResponse.json(
      { error: "productId and a supported language are required." },
      { status: 400 },
    );
  }

  const product = await db.product.findFirst({
    where: { id: productId, companyId: member.companyId },
    select: { id: true, translations: true },
  });
  if (!product)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Merge rather than replace: another language's entry must survive an edit
  // to this one. Writing the whole object from the client would let a stale
  // tab wipe translations it never loaded.
  const translations = { ...(product.translations || {}) };

  if (!String(name || "").trim()) {
    // Clearing the name clears the entry. A description with no name isn't a
    // usable translation, and leaving a half-entry behind makes the "missing"
    // count lie.
    delete translations[language];
  } else {
    translations[language] = {
      name: String(name).trim(),
      description: String(description || "").trim(),
      // Set once a human has saved it from the review screen. Drafts written
      // by translateFields never carry this, which is what separates the two.
      reviewed: true,
      reviewedAt: new Date().toISOString(),
    };
  }

  const updated = await db.product.update({
    where: { id: product.id },
    data: { translations },
    select: { id: true, translations: true },
  });

  return NextResponse.json(updated);
}
