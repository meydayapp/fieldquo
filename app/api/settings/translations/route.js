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
import { requirePermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isSupported } from "@/app/i18n/languages";
import { isAiConfigured } from "@/lib/ai/provider";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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
      // sendLanguages is NOT selected: this route resolves one language from the
    // query string and only needs the source to compare against.
    select: { defaultLanguage: true },
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
      // `reviewedAt` was stamped on every save and read by nothing, anywhere —
      // the written-and-never-read defect AGENTS.md names first. Projected now
      // so the row can say WHEN a human last checked this wording: "reviewed"
      // with no date is the same badge whether that happened this morning or
      // before the price list changed.
      reviewedAt: entry?.reviewedAt || null,
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
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── This rewrites text a homeowner reads ───────────────────────────────
  //
  // These are the product and service names that appear on quotes and
  // invoices in the client's own language. The catalogue itself is owner/admin
  // (app/api/products), and this route required only a session — so anyone
  // signed in could rewrite what a client sees a line item called, on a
  // document that goes out under the contractor's name.
  //
  // Same gate as the catalogue, because it is the same content by another
  // name.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner or admin can change product translations." },
      { status: 403 },
    );
  }

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
