// app/api/settings/message-templates/route.js
//
// The wording of the texts clients receive.
//
// GET returns each editable type with its tokens (for the live preview) and the
// company's current override or the built-in default. PUT saves one type's
// wording, validating its tokens server-side — the client-side check is only
// the friendly half; this is the one that actually protects a customer from a
// raw "{price}".
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import {
  SMS_TEMPLATE_TYPES,
  validateTemplate,
  fillTemplate,
} from "@/lib/sms/renderTemplate";

/** Sample values for a type, from its token metadata — drives the preview. */
function samplesFor(spec) {
  return Object.fromEntries(Object.entries(spec.tokens).map(([t, m]) => [t, m.sample]));
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { smsTemplates: true },
  });
  const stored = company?.smsTemplates && typeof company.smsTemplates === "object"
    ? company.smsTemplates
    : {};

  // Only editable types reach the screen — a type that can't send yet has no
  // business being edited (that's the dead control this codebase keeps pulling).
  const types = Object.entries(SMS_TEMPLATE_TYPES)
    .filter(([, spec]) => spec.editable)
    .map(([key, spec]) => {
      const samples = samplesFor(spec);
      const custom = typeof stored[key] === "string" ? stored[key] : null;
      return {
        key,
        label: spec.label,
        tokens: Object.entries(spec.tokens).map(([t, m]) => ({ token: t, hint: m.hint })),
        custom,
        // What actually sends today, rendered with sample values — the default
        // wording when nothing's been customised, so the preview of an untouched
        // template matches reality.
        preview: custom && validateTemplate(key, custom).ok
          ? fillTemplate(key, custom, samples)
          : spec.fallback(samples),
        defaultPreview: spec.fallback(samples),
      };
    });

  return NextResponse.json({ types });
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can change client messages" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const { type } = body;
  const spec = SMS_TEMPLATE_TYPES[type];
  if (!spec || !spec.editable) {
    return NextResponse.json({ error: "That message can't be edited." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { smsTemplates: true },
  });
  const stored = company?.smsTemplates && typeof company.smsTemplates === "object"
    ? { ...company.smsTemplates }
    : {};

  if (!text) {
    // Empty means "go back to the built-in wording" — the key is REMOVED rather
    // than stored as "", so renderMessage cleanly falls through to the default.
    delete stored[type];
  } else {
    const check = validateTemplate(type, text);
    if (!check.ok) {
      const reason = check.unknownTokens.length
        ? `Unknown ${check.unknownTokens.length === 1 ? "field" : "fields"}: ${check.unknownTokens
            .map((t) => `{${t}}`)
            .join(", ")}. Use only the fields listed.`
        : "Write a message first.";
      return NextResponse.json({ error: reason }, { status: 400 });
    }
    stored[type] = text;
  }

  await db.company.update({
    where: { id: member.companyId },
    data: { smsTemplates: stored },
  });

  await recordActivity(member, {
    action: "message_template.updated",
    entityType: "company",
    entityId: member.companyId,
    summary: text ? `Customised the "${spec.label}" text` : `Reset the "${spec.label}" text to default`,
    metadata: { type },
  });

  const samples = samplesFor(spec);
  return NextResponse.json({
    ok: true,
    custom: text || null,
    preview: text ? fillTemplate(type, text, samples) : spec.fallback(samples),
  });
}
