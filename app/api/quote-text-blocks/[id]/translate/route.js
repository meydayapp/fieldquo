// app/api/quote-text-blocks/[id]/translate/route.js
//
// POST { language } → { language, draft: { name, body }, stored: false }
//
// A DRAFT of one block in one language, for the estimator to read and edit
// before it lands on the quote. Writes nothing: the builder stores what the
// person accepted through PATCH /api/quote-text-blocks/[id] { translation },
// and only then does the block carry that language. A machine draft that
// landed in the table would be indistinguishable from a reviewed one — the
// same reasoning as app/api/settings/translations/draft/route.js.
//
// Stored translations short-circuit: if the block already has this language
// it is returned as-is with `stored: true` and no model is called. That is
// the "translate once" rule the owner asked for, and why a busy painter pays
// for "Exclusions" in French exactly once.
//
// Metered like every model call: checkAiQuota before, recordAiUsage after,
// feature "text_block_translation". Cost: one short call per block per new
// language — a few hundred tokens.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { isSupported } from "@/app/i18n/languages";
import { isAiConfigured } from "@/lib/ai/provider";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { translateFields } from "@/lib/i18n/translateContent";
import { resolveTextBlockText } from "@/lib/quotes/textBlocks";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "translate a library block");
  if (denied) return denied;

  const { language } = await request.json().catch(() => ({}));
  if (!language || !isSupported(language)) {
    return NextResponse.json({ error: "Pass a supported language code." }, { status: 400 });
  }

  const block = await db.quoteTextBlock.findFirst({ where: { id, companyId: member.companyId } });
  if (!block) return NextResponse.json({ error: "Block not found" }, { status: 404 });

  const resolved = resolveTextBlockText(block, language);
  if (!resolved.missing) {
    return NextResponse.json({ language, draft: { name: resolved.name, body: resolved.body }, stored: true });
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "Automatic translation isn't switched on for this deployment. You can type the translation yourself.", aiUnavailable: true },
      { status: 503 },
    );
  }

  const quota = await checkAiQuota(member.companyId);
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.reason, quotaExceeded: true }, { status: 429 });
  }

  const drafts = await translateFields(
    { name: block.name, body: block.body || "" },
    block.language || "en",
    [language],
    {
      onUsage: (u) =>
        recordAiUsage({
          companyId: member.companyId,
          feature: "text_block_translation",
          userId: member.userId,
          ...u,
        }),
    },
  );
  const draft = drafts?.[language];
  if (!draft?.name) {
    return NextResponse.json(
      { error: "The translation didn't come back usable. You can type it yourself.", aiFailed: true },
      { status: 502 },
    );
  }
  return NextResponse.json({
    language,
    draft: { name: draft.name, body: block.body ? draft.body || "" : "" },
    stored: false,
  });
}
