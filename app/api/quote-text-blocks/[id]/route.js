// app/api/quote-text-blocks/[id]/route.js
//
// PATCH  → edit a block's fields, or store ONE reviewed translation:
//          { translation: { language, name, body } } writes translations[language]
//          and nothing else. The translation path is what the builder calls
//          after the estimator accepted a draft (lib/quotes/textBlocks.js
//          header on why it is stored once, on the block, never re-run at
//          send time).
// DELETE → removes the library row. The lines already copied onto quotes are
//          copies and keep their text; a seeded row's seedKey goes with it so
//          the seeder does not hand it back (it only ever seeds an empty library).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle } from "@/lib/permissions/enforce";
import { LANGUAGE_CODES, isSupported } from "@/app/i18n/languages";
import { normaliseTextBlockInput, translationEntry, presentTextBlock } from "@/lib/quotes/textBlocks";
import { scheduleAutoTranslate } from "@/lib/i18n/autoTranslateSchedule";

async function ownedBlock(id, companyId) {
  return db.quoteTextBlock.findFirst({ where: { id, companyId } });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "edit the quote library");
  if (denied) return denied;

  const existing = await ownedBlock(id, member.companyId);
  if (!existing) return NextResponse.json({ error: "Block not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const showPricing = hasToggle(full, "showPricing");

  // ── One translation, reviewed ─────────────────────────────────────────
  if (body?.translation && typeof body.translation === "object") {
    const language = String(body.translation.language || "").toLowerCase();
    if (!isSupported(language) || language === existing.language) {
      return NextResponse.json({ error: "Pass a supported language other than the block's own." }, { status: 400 });
    }
    const entry = translationEntry(body.translation);
    if (!entry) return NextResponse.json({ error: "A translation needs a title." }, { status: 400 });
    const translations = { ...(existing.translations && typeof existing.translations === "object" ? existing.translations : {}), [language]: entry };
    const row = await db.quoteTextBlock.update({ where: { id }, data: { translations } });
    return NextResponse.json(presentTextBlock(row, { showPricing }));
  }

  // ── The block itself ──────────────────────────────────────────────────
  const parsed = normaliseTextBlockInput({ ...existing, ...body }, { languages: LANGUAGE_CODES });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = { ...parsed.data };
  // A caller who may not see prices cannot change one either — the stored
  // number stays whatever it was.
  if (!showPricing) delete data.price;
  // The source language is fixed at creation: changing it would relabel the
  // stored translations as something they are not.
  delete data.language;
  if (Number.isInteger(body?.sortOrder)) data.sortOrder = body.sortOrder;

  const row = await db.quoteTextBlock.update({ where: { id }, data });
  // Only when the words changed: a reorder or a price edit costs nothing.
  const wordsChanged = row.name !== existing.name || (row.body || "") !== (existing.body || "");
  const autoTranslate = wordsChanged
    ? scheduleAutoTranslate({
        companyId: member.companyId,
        model: "quoteTextBlock",
        id: row.id,
        fields: { name: row.name, body: row.body || "" },
        sourceLanguage: row.language || "en",
      })
    : null;
  return NextResponse.json({ ...presentTextBlock(row, { showPricing }), autoTranslate });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "edit the quote library");
  if (denied) return denied;

  const existing = await ownedBlock(id, member.companyId);
  if (!existing) return NextResponse.json({ error: "Block not found" }, { status: 404 });

  await db.quoteTextBlock.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
