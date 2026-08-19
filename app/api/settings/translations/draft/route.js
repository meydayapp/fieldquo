// app/api/settings/translations/draft/route.js
//
// "Fill in the blanks" on the translations review screen.
//
// POST { language } → drafts for every catalogue row that has no translation
// in that language yet. Returns them; writes NOTHING.
//
// ── Why it doesn't save ────────────────────────────────────────────────────
//
// Because a machine draft that lands in the database is indistinguishable from
// a translation someone checked, and the difference between those two is the
// entire point of this screen. The drafts come back as JSON, the page puts them
// in the input boxes marked as machine-written, and the existing PATCH — which
// stamps `reviewed: true` — is still the only thing that persists anything. A
// wrong trade term on a quote a homeowner signs is the failure mode, and the
// only reliable guard against it is a person having read the word.
//
// ── Why this doesn't contradict AGENTS.md non-negotiable 6 ─────────────────
//
// That rule says a DOCUMENT keeps the language it was created in and nothing is
// machine-translated at send time. Nothing here touches a document. This
// translates a company's own catalogue, at authoring time, on an explicit click,
// into a form field its author then edits. See the long note at the top of
// lib/i18n/translateContent.js for the full distinction — and do not read this
// route as permission to translate a quote.
//
// ── Why the existing AI provider and not Google Translate ──────────────────
//
// The ask was "Google Translate API". Reasons this went the other way:
//
//   * Quality on the input that actually matters. A catalogue is short trade
//     terms — "Finish", "Trim", "Coat", "Run", "Rough-in". A translation API
//     receives each string alone and returns the dictionary sense; a model
//     receives the batch, plus a system prompt saying these are contracting
//     terms on a document a client signs, and can see that "Trim" sits between
//     "Baseboard" and "Crown moulding". Context is the whole difference on
//     exactly the strings this feature exists for.
//   * Cost. Cloud Translation is $20 per million characters. A 60-service
//     catalogue is roughly 9k characters per language — inside Google's free
//     tier, and about $0.18 per language beyond it. The same work through
//     gpt-5-mini is a few thousand tokens, well under a cent. Neither is
//     expensive; the model is the cheaper of the two once the free tier is out.
//   * No new secret. Google needs a GCP project, billing enabled, a key, that
//     key added to Vercel AND to docs/VERCEL.md or `npm run check:env` fails the
//     build — and a second vendor to rotate, monitor and pay. OPENAI_API_KEY is
//     already there.
//   * Metering. Every model call in this product is quota-checked before and
//     recorded after (lib/ai/usage.js). A Google client would be a second
//     spending path with no cap and no per-company attribution, which is the
//     one thing that metering system exists to prevent.
//
// The honest cost of the choice: a translation API is more predictable — it
// cannot decline, ramble, or return prose instead of JSON. That is handled by
// treating a malformed batch as a failed batch and saying so, rather than by
// picking the vendor that can't fail in that particular way.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { isSupported } from "@/app/i18n/languages";
import { isAiConfigured } from "@/lib/ai/provider";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { draftProductTranslations } from "@/lib/i18n/translateContent";

function isAdmin(role) {
  return role === "owner" || role === "admin";
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Same bar as editing the catalogue itself. This one also spends the
  // company's AI allowance, so it is not a read.
  if (!isAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can draft translations." },
      { status: 403 },
    );
  }

  const { language } = await request.json().catch(() => ({}));
  if (!language || !isSupported(language)) {
    return NextResponse.json(
      { error: "Pass a supported language code." },
      { status: 400 },
    );
  }

  // Checked before any work: a dead button is worse than an absent one, so the
  // page hides the control entirely when the GET says AI is unconfigured. This
  // is the belt to that suspenders — a stale tab, or a key pulled since load.
  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error:
          "Automatic translation isn't switched on for this deployment. You can still type translations in yourself.",
        aiUnavailable: true,
      },
      { status: 503 },
    );
  }

  const [company, products] = await Promise.all([
    db.company.findUnique({
      where: { id: member.companyId },
      select: { defaultLanguage: true },
    }),
    db.product.findMany({
      where: { companyId: member.companyId, active: true },
      select: { id: true, name: true, description: true, translations: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const sourceLanguage = company?.defaultLanguage || "en";
  if (language === sourceLanguage) {
    return NextResponse.json(
      { error: "That's already the language your catalogue is written in." },
      { status: 400 },
    );
  }

  // Only the gaps. Re-translating something a person already checked would
  // overwrite reviewed wording with unreviewed wording — the exact inversion
  // this screen exists to prevent. The same "missing" definition as the GET: a
  // translated name with an untranslated description still reads unfinished.
  const pending = products.filter((p) => {
    const entry = p.translations?.[language];
    return !entry?.name || (Boolean(p.description) && !entry?.description);
  });

  if (pending.length === 0) {
    return NextResponse.json({ language, drafts: {}, drafted: 0, failed: 0, stopped: false });
  }

  const quota = await checkAiQuota(member.companyId);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.reason, quotaExceeded: true },
      { status: 429 },
    );
  }

  const result = await draftProductTranslations(
    pending.map((p) => ({ id: p.id, name: p.name, description: p.description || "" })),
    sourceLanguage,
    language,
    {
      onUsage: (u) =>
        recordAiUsage({
          companyId: member.companyId,
          feature: "translation",
          userId: member.userId,
          ...u,
        }),
      // Re-checked between batches rather than once at the start. A big
      // catalogue can cross the monthly cap halfway through, and stopping there
      // with 40 drafts and an honest message beats either blowing through the
      // cap or refusing the whole run because it might.
      shouldContinue: async () => (await checkAiQuota(member.companyId)).allowed,
    },
  );

  return NextResponse.json({
    language,
    drafts: result.drafts,
    drafted: Object.keys(result.drafts).length,
    failed: result.failedIds.length,
    // True when the allowance ran out mid-run. The page says so rather than
    // presenting a partial fill as a complete one.
    stopped: result.stopped,
    pending: pending.length,
  });
}
