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
// Metered like every model call — checked before, recorded after — through
// meterFor("translation") (lib/ai/featurePayer.js). Translation drafting is
// FieldQuo's cost since the owner's 2026-09-25 decision, so this lands on
// FieldQuo's own budget under the translation feature, not the company's
// allowance (it was the allowance's "text_block_translation" before). Cost:
// one short call per block per new language — a few hundred tokens.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { isSupported } from "@/app/i18n/languages";
import { isAiConfigured } from "@/lib/ai/provider";
import { meterFor } from "@/lib/ai/featurePayer";
import { underDailyDraftCap, DAILY_CAP_REFUSAL } from "@/lib/i18n/autoTranslate";
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

  const meter = await meterFor("translation", { companyId: member.companyId, userId: member.userId || null });
  const quota = await meter.check();
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.reason, quotaExceeded: true }, { status: 429 });
  }
  // On FieldQuo's card the per-company ceiling is the daily draft cap shared
  // with auto-translation — see lib/i18n/autoTranslate.js.
  if (meter.payer === "fieldquo" && !(await underDailyDraftCap(db, member.companyId))) {
    return NextResponse.json({ error: DAILY_CAP_REFUSAL, quotaExceeded: true }, { status: 429 });
  }

  const drafts = await translateFields(
    { name: block.name, body: block.body || "" },
    block.language || "en",
    [language],
    {
      onUsage: (u) => meter.record(u, { meta: { source: "text_block", id: block.id, language } }),
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
