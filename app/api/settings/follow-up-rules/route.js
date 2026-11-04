// app/api/settings/follow-up-rules/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { SUPPORTED_TRIGGERS, FOLLOW_UP_CHANNELS, triggerMaySms } from "@/lib/followUps/triggers";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { ensureDefaultFollowUps, ALL_BUILT_IN_KEYS } from "@/lib/followUps/defaults";
// The company's follow-up-TEXT switch, so the page can say that a rule set to
// text sends nothing until it is on. A rule that looks armed and isn't is the
// control this codebase keeps being swept for; the page cannot warn about it
// without being told.
import { followUpTextOn } from "@/lib/sms/followUpTextRules";
// Whether the company's /book/<slug> page actually resolves — three
// conditions, not just a slug (lib/booking/bookableMembers.js). An enquiry
// chase by TEXT has no action in it without one, so the page has to be able
// to say that rather than let somebody arm a rule that sends nothing.
import { hasBookableMember } from "@/lib/booking/bookableMembers";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // A company created before the defaults existed, or one whose signup
  // seeding hiccuped, gets them the first time anyone opens the page.
  // Idempotent (keyed on companyId + builtInKey), so this costs one read on
  // every load and a write only once per company. Best-effort: a seeding
  // failure must not take the page down.
  try {
    // Not for a read-only support session: seeding writes rows.
    if (member.impersonationMode !== "read_only") await ensureDefaultFollowUps(db, member.companyId);
  } catch (err) {
    console.error("[follow-up-rules] default seeding failed:", err?.message);
  }

  const [rules, company, booking] = await Promise.all([
    db.followUpRule.findMany({
      where: { companyId: member.companyId },
      include: { template: { select: { id: true, name: true, type: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { followUpSmsOn: true, preQuoteVideoUrl: true, leadCallsPerDay: true },
    }),
    hasBookableMember(member.companyId).catch(() => ({ ok: false, reason: "unknown" })),
  ]);

  // Tombstoned defaults are reported separately, not hidden: the page offers
  // to restore them, and a list that silently dropped a row would have no
  // way to say "you deleted the day-7 one".
  const live = rules.filter((r) => !r.deletedAt);
  const deleted = rules
    .filter((r) => r.deletedAt && ALL_BUILT_IN_KEYS.includes(r.builtInKey))
    .map((r) => ({ id: r.id, builtInKey: r.builtInKey, name: r.name, deletedAt: r.deletedAt }));

  // Built-ins first, in FieldQuo's order, then the company's own rules by age.
  const order = (r) => (r.builtInKey ? ALL_BUILT_IN_KEYS.indexOf(r.builtInKey) : ALL_BUILT_IN_KEYS.length);
  live.sort((a, b) => order(a) - order(b) || new Date(a.createdAt) - new Date(b.createdAt));

  return NextResponse.json({
    rules: live,
    deletedBuiltIns: deleted,
    // Two facts about the company the LIST cannot carry, because both are
    // about every rule at once: whether follow-up texts are switched on, and
    // whether a pre-quote video exists to link to. The page says so beside
    // the rules that depend on them rather than letting somebody set a rule
    // to "text" and watch nothing happen.
    smsEnabled: followUpTextOn(company),
    hasPreQuoteVideo: Boolean(company?.preQuoteVideoUrl),
    // A failed lookup answers `false` with reason "unknown" rather than
    // throwing the page away — and the page distinguishes the two, so a
    // transient error is never drawn as "you have no booking page".
    // The human cadence the dashboard measures recorded attempts against —
    // on this page because this is where chasing a lead is configured, and
    // the automated sequence and the manual one are the same job.
    leadCallsPerDay: company?.leadCallsPerDay ?? null,
    canSelfBook: booking?.ok === true,
    bookingReason: booking?.reason || null,
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage follow-up rules" },
      { status: 403 },
    );
  }

  const { name, triggerEvent, delayValue, delayUnit, templateId, active, channel } =
    await request.json();

  if (!SUPPORTED_TRIGGERS.includes(triggerEvent)) {
    return NextResponse.json(
      { error: `Unknown triggerEvent — must be one of ${SUPPORTED_TRIGGERS.join(", ")}` },
      { status: 400 },
    );
  }

  // ── The channel, and what it changes about the rest of the body ─────────
  //
  // Omitted means email, which is what every rule did before the column
  // existed. An unknown value is REFUSED rather than quietly stored and read
  // back as email by followUpChannel(): the cron would send an email the
  // person had asked to be a text, which is the kind of near-miss nobody
  // notices for a month.
  const wants = channel === undefined || channel === null ? "email" : String(channel);
  if (!FOLLOW_UP_CHANNELS.includes(wants)) {
    return NextResponse.json(
      { error: `Unknown channel — must be one of ${FOLLOW_UP_CHANNELS.join(", ")}` },
      { status: 400 },
    );
  }
  // Two of the four triggers have SMS wording; lib/followUps/triggers.js says
  // why the other two do not. Refused here rather than saved and then skipped
  // by the cron every hour with nothing on screen saying so.
  if (wants === "sms" && !triggerMaySms(triggerEvent)) {
    return NextResponse.json(
      { error: "That trigger can't send a text — only an unanswered enquiry or quote can." },
      { status: 400 },
    );
  }
  // A text's wording is a message type on Settings › Messages, not a
  // DocumentTemplate, so an SMS rule needs no template and must not be made
  // to invent one. An EMAIL rule with no template is a rule the cron skips —
  // a row that looks like an automation and is not.
  if (wants === "email" && !templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  // templateId names a DocumentTemplate, which is company-owned. Unchecked, a
  // rule could fire another tenant's template at this company's clients — and
  // the `include` below reads its name straight back.
  // Scoped to what is actually STORED: a dialog switched to "text" may still
  // be carrying the template it had selected, and refusing the save over a
  // field this rule discards would be a 400 nobody could explain.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    templateId: wants === "sms" ? null : templateId,
  });
  if (notOurs) return notOurs;

  const created = await db.followUpRule.create({
    data: {
      companyId: member.companyId,
      name: name?.trim() || "Untitled rule",
      triggerEvent,
      delayValue: Number(delayValue) || 3,
      delayUnit: delayUnit === "hours" ? "hours" : "days",
      // Null for a text: there is no template to point at, and storing the
      // one the dialog happened to have selected would leave a column that
      // nothing reads — the first failure class AGENTS.md lists.
      templateId: wants === "sms" ? null : templateId,
      active: active !== false,
      channel: wants,
    },
    include: { template: { select: { id: true, name: true, type: true } } },
  });

  return NextResponse.json(created, { status: 201 });
}
