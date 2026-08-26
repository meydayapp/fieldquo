// app/api/settings/voice/knowledge/route.js
//
// "Draft this from my company profile" on the receptionist settings screen.
//
//   POST  (no body) → the questions the note still needs to answer.
//
// ── It writes NOTHING ──────────────────────────────────────────────────────
//
// Same call the translation drafter makes next door, for a sharper reason. The
// note is read out by something that sounds like the contractor, to a stranger
// who may hold them to it. A draft that landed straight in
// VoiceAgent.instructions would be a machine's guess indistinguishable from
// something the owner wrote and meant. So this returns JSON, the screen shows
// it, and the existing PUT — driven by a person pressing Save over text they
// can see — stays the only thing that persists anything.
//
// ── What it deliberately does not draft ────────────────────────────────────
//
// Opening hours, services, work areas. All three already reach the agent as
// structured facts (factsFor in lib/voice/provision.js), and a prose copy of a
// database row is a copy that goes stale the day somebody edits the row. Where
// one of those is MISSING the answer is a link to the field, not a sentence —
// see the `structured` half of the response.
//
// ── Never a broken screen ──────────────────────────────────────────────────
//
// No key, over quota, or a model returning nonsense all return 200 with
// `generated: false` and the catalogue in the company's own language. The
// button is worth pressing on a deployment with no AI at all, which is also
// every local dev machine.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { isAiConfigured } from "@/lib/ai/provider";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { draftKnowledge } from "@/lib/voice/knowledgeDraft";
import { tradeGaps } from "@/lib/voice/knowledge";
import { categoryLabel } from "@/lib/i18n/translateContent";
import { hasBusinessHours } from "@/lib/company/businessHours";
import { resolveServiceContent } from "@/lib/documents/serviceContent";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

/**
 * The catalogue's own wording, in the company's language.
 *
 * The company's, not the signed-in member's: the note is written FOR the agent,
 * and the agent speaks `Company.defaultLanguage` (see provisionAgent). A note
 * drafted in one language for an agent answering in another is two problems
 * pretending to be a feature.
 *
 * Falls back per key to English, which is what t() does everywhere else — the
 * four review-pending catalogues are incomplete by design.
 */
function textFor(language) {
  const dict = APP_MESSAGES[language] || {};
  return (key) => dict[key] || APP_MESSAGES.en[key] || null;
}

export async function POST(request) {
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) {
    // Spread, not `{ error }`: refusalBody carries fields the client reacts to
    // (a locked feature's upgrade hint), and picking one off would break them.
    const { status, ...body } = refusal;
    return NextResponse.json(body, { status });
  }

  // Same bar as editing the note itself — this decides what a stranger hears
  // when they ring the business — and it spends the company's AI allowance, so
  // it is not a read.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner or admin can change the receptionist." },
      { status: 403 },
    );
  }

  const [company, enabled, areas, agent, eventTypes] = await Promise.all([
    db.company.findUnique({
      where: { id: member.companyId },
      select: {
        name: true, phone: true, city: true, province: true,
        businessHours: true, defaultLanguage: true,
      },
    }),
    db.companyServiceCategory.findMany({
      where: { companyId: member.companyId, enabled: true },
      select: {
        accentColor: true, includedItems: true, processSteps: true, scopeDescription: true,
        category: { select: { key: true, label: true, labelTranslations: true } },
      },
      take: 20,
    }),
    db.workArea.findMany({
      where: { companyId: member.companyId },
      select: { name: true },
      take: 30,
    }),
    db.voiceAgent.findUnique({
      where: { companyId: member.companyId },
      select: { instructions: true },
    }),
    db.eventType.count({ where: { companyId: member.companyId, active: true } }),
  ]);

  const language = company?.defaultLanguage || "en";

  // The same three facts factsFor() sends the agent, read here only to know
  // whether they EXIST. Their contents are never drafted into prose.
  const services = enabled.map((e) => categoryLabel(e.category, language)).filter(Boolean);
  const areaNames = areas.map((a) => a.name).filter(Boolean);
  const hasHours = hasBusinessHours(company?.businessHours);

  // The per-trade questions, seeded from the quote content this company already
  // has. `mayChange` is the list of things the trade genuinely cannot know
  // until it starts — which is exactly what a caller rings up to ask about.
  const trades = tradeGaps(
    enabled.map((e) => ({
      key: e.category.key,
      label: categoryLabel(e.category, language),
      content: resolveServiceContent(e.category.key, e, null),
    })),
  );

  const input = {
    company: company || {},
    services,
    areas: areaNames,
    hasHours,
    canBook: eventTypes > 0,
    notes: agent?.instructions || "",
    trades,
    language,
    text: textFor(language),
  };

  // ── Why an over-quota company still gets a draft ────────────────────────
  //
  // Because the fallback is genuinely useful rather than a stub. Refusing with
  // a 429 would hide a working feature behind a limit that only affects how
  // nicely the questions are worded. The reason is returned so the screen can
  // say which version they are looking at instead of implying a model wrote it.
  let unavailable = null;
  if (!isAiConfigured()) {
    unavailable = "not_configured";
  } else {
    const quota = await checkAiQuota(member.companyId);
    if (!quota.allowed) unavailable = "quota";
  }

  const draft = await draftKnowledge({
    ...input,
    // Skipped rather than discovered inside the drafter: an over-quota company
    // must not spend a call finding out it is over quota.
    skipModel: Boolean(unavailable),
    onUsage: (u) =>
      recordAiUsage({
        companyId: member.companyId,
        feature: "voice_knowledge",
        userId: member.userId,
        ...u,
      }),
  });

  return NextResponse.json({
    questions: draft.questions,
    structured: draft.structured,
    note: draft.note,
    generated: draft.generated,
    // "not_configured" | "quota" | null. Named rather than implied so the page
    // can print the honest sentence instead of a generic apology.
    aiUnavailable: unavailable,
    language,
  });
}
