// app/api/quote-text-blocks/route.js
//
// The company's text-block library — the prose a quote reuses (see
// prisma QuoteTextBlock and lib/quotes/textBlocks.js).
//
// GET   → every block, in order. Seeds the painting starters on a first read
//         (lib/quotes/textBlockSeed.js). Readable by anyone who can build a
//         quote: the builder's "+ Add area or line item" opens on this list.
//         Prices on a block are the company's own rate card, so a member
//         without showPricing gets the blocks with `price` removed — the
//         words are what they need, and the dialog prices nothing for them.
// POST  → a new block. Same bar as writing a service's wording: someone who
//         can create quotes. "Save to library" from the builder lands here
//         with the same body the settings card sends.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle } from "@/lib/permissions/enforce";
import { LANGUAGE_CODES } from "@/app/i18n/languages";
import { normaliseTextBlockInput, presentTextBlock } from "@/lib/quotes/textBlocks";
import { seedTextBlocksIfEmpty } from "@/lib/quotes/textBlockSeed";

const ORDER = [{ sortOrder: "asc" }, { createdAt: "asc" }];

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_only", "see the quote library");
  if (denied) return denied;

  await seedTextBlocksIfEmpty(db, member.companyId);

  const rows = await db.quoteTextBlock.findMany({
    where: { companyId: member.companyId },
    orderBy: ORDER,
  });
  const showPricing = hasToggle(full, "showPricing");
  return NextResponse.json(rows.map((r) => presentTextBlock(r, { showPricing })));
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "add to the quote library");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const parsed = normaliseTextBlockInput(body, { languages: LANGUAGE_CODES });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // A block written by someone who may not see prices carries none: the
  // route will not store a number the author was never shown.
  const showPricing = hasToggle(full, "showPricing");
  if (!showPricing) {
    parsed.data.price = null;
  }

  // The language it was written in: what the caller says (the builder sends
  // the quote's language), else the company's default. Never guessed from
  // the text.
  let language = parsed.data.language;
  if (!language) {
    const company = await db.company.findUnique({ where: { id: member.companyId }, select: { defaultLanguage: true } });
    language = company?.defaultLanguage || "en";
  }

  const last = await db.quoteTextBlock.aggregate({ where: { companyId: member.companyId }, _max: { sortOrder: true } });

  const row = await db.quoteTextBlock.create({
    data: {
      ...parsed.data,
      language,
      companyId: member.companyId,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(presentTextBlock(row, { showPricing }), { status: 201 });
}
