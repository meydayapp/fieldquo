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

import { bookingTextOn } from "@/lib/booking/bookingText";
import { documentTextOn } from "@/lib/sms/documentTextRules";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import {
  SMS_TEMPLATE_TYPES,
  BOOKING_TEXT_TYPES,
  DOCUMENT_TEXT_TYPES,
  validateTemplate,
  fillTemplate,
} from "@/lib/sms/renderTemplate";
// A custom wording is sent to clients who read OTHER languages too, once its
// draft lands (renderMessage's translatedTemplates) — drafted after the save.
import { scheduleAutoTranslate } from "@/lib/i18n/autoTranslateSchedule";

/**
 * The on/off switches, and which types answer to each one.
 *
 * `owner` is the type that CARRIES the toggle; the others say whose switch
 * they follow rather than growing a second toggle that could disagree with
 * it. The copy keys travel with the switch because the sentence beside a
 * booking toggle ("every client who books gets a text") is not the sentence
 * beside a document one — the screen used to hardcode the booking wording,
 * which would have described the wrong thing the moment a second switch
 * existed.
 */
const SWITCHES = [
  {
    owner: "booking_confirmation",
    types: BOOKING_TEXT_TYPES,
    on: (company) => bookingTextOn(company),
    copy: {
      on: "app.setMessages.bookingSmsOn",
      off: "app.setMessages.bookingSmsOff",
      hint: "app.setMessages.bookingSmsHint",
      followsOn: "app.setMessages.changeSmsOn",
      followsOff: "app.setMessages.changeSmsOff",
    },
    write: (enabled) => ({ bookingSmsConfirmation: enabled, bookingSmsChosenAt: new Date() }),
  },
  {
    owner: "quote_sent",
    types: DOCUMENT_TEXT_TYPES,
    on: (company) => documentTextOn(company),
    copy: {
      on: "app.setMessages.documentSmsOn",
      off: "app.setMessages.documentSmsOff",
      hint: "app.setMessages.documentSmsHint",
      followsOn: "app.setMessages.documentSmsFollowsOn",
      followsOff: "app.setMessages.documentSmsFollowsOff",
    },
    write: (enabled) => ({ documentSmsOn: enabled }),
  },
];

/** The switch a type answers to, or null for one with none. */
function switchFor(key) {
  return SWITCHES.find((entry) => entry.types.includes(key)) || null;
}

/** Sample values for a type, from its token metadata — drives the preview. */
function samplesFor(spec) {
  return Object.fromEntries(Object.entries(spec.tokens).map(([t, m]) => [t, m.sample]));
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { smsTemplates: true, name: true, phone: true, bookingSmsConfirmation: true, bookingSmsChosenAt: true, documentSmsOn: true },
  });
  const stored = company?.smsTemplates && typeof company.smsTemplates === "object"
    ? company.smsTemplates
    : {};

  // Only editable types reach the screen — a type that can't send yet has no
  // business being edited (that's the dead control this codebase keeps pulling).
  const types = Object.entries(SMS_TEMPLATE_TYPES)
    .filter(([, spec]) => spec.editable)
    .map(([key, spec]) => {
      const sw = switchFor(key);
      // The company's own name and phone stand in for the samples, so the
      // preview reads as the text their client will get — and a company with
      // no phone on file sees the "call us" tail drop out here rather than
      // discovering it on a client's screen.
      const samples = {
        ...samplesFor(spec),
        ...(company?.name && { company: company.name }),
        ...("phone" in spec.tokens && { phone: company?.phone || null }),
      };
      const custom = typeof stored[key] === "string" ? stored[key] : null;
      return {
        key,
        label: spec.label,
        // The switch that governs whether this type sends at all, when it
        // has one — see SWITCHES above. The owner of a switch carries the
        // toggle; the types that follow it report its state and say whose it
        // is, rather than growing a second toggle that could disagree. Same
        // rule as the send paths: on unless the company turned it off.
        ...(sw && sw.owner === key && { enabled: sw.on(company), switchCopy: sw.copy }),
        ...(sw && sw.owner !== key && {
          followsSwitch: sw.owner,
          switchOn: sw.on(company),
          switchCopy: sw.copy,
        }),
        // The screen renders the KEY through t(); `label`/`hint` stay as the
        // English fallback for a language missing one.
        labelKey: spec.labelKey,
        tokens: Object.entries(spec.tokens).map(([t, m]) => ({ token: t, hint: m.hint, hintKey: m.hintKey })),
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

  // ── The on/off switch, separate from the wording ─────────────────────────
  //
  // `{ type: "booking_confirmation", enabled: true|false }` flips the booking
  // texts; `{ type: "quote_sent", enabled }` the two document ones. Only the
  // type that CARRIES a switch may flip it — posting `enabled` for a follower
  // falls through to the wording branch below rather than silently writing
  // somebody else's switch. Each send path re-reads the column fresh.
  const sw = SWITCHES.find((s2) => s2.owner === type);
  if (sw && typeof body.enabled === "boolean") {
    await db.company.update({
      where: { id: member.companyId },
      data: sw.write(body.enabled),
    });
    await recordActivity(member, {
      action: "message_template.updated",
      entityType: "company",
      entityId: member.companyId,
      summary: body.enabled
        ? `Switched on the "${spec.label}" text`
        : `Switched off the "${spec.label}" text`,
      metadata: { type, enabled: body.enabled },
    });
    return NextResponse.json({ ok: true, enabled: body.enabled });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { smsTemplates: true, name: true, phone: true, defaultLanguage: true },
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

  // Same stand-ins as the GET, so the preview after a save matches the one
  // before it.
  const samples = {
    ...samplesFor(spec),
    ...(company?.name && { company: company.name }),
    ...("phone" in spec.tokens && { phone: company?.phone || null }),
  };
  const autoTranslate = text
    ? scheduleAutoTranslate({
        companyId: member.companyId,
        model: "company",
        fields: { [`smsTemplates.${type}`]: text },
        sourceLanguage: company?.defaultLanguage || "en",
      })
    : null;

  return NextResponse.json({
    ok: true,
    custom: text || null,
    preview: text ? fillTemplate(type, text, samples) : spec.fallback(samples),
    autoTranslate,
  });
}
