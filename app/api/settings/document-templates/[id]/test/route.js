// app/api/settings/document-templates/[id]/test/route.js
//
// POST { to } — renders this template's sections with the company's real
// details (falling back to sample values for the quote/invoice tokens that
// only exist at real send time) and emails it to `to` via Resend so a company
// can preview exactly what a client receives. Owners/admins only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { renderSubject } from "@/lib/email/renderTemplateSections";
import { templateBody } from "@/lib/email/templateBody";
import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { STAGE_INDEX } from "@/app/data/emailTemplateBlocks";
import { sampleMergeData } from "@/lib/email/templateMergeFields";

// Sample values for the merge fields that don't exist until a real
// quote/invoice/job is attached come from lib/email/templateMergeFields.js —
// the same sample the editor previews, formatted in the company's currency
// and language. This file used to carry its own copy with "$4,250.00"
// written into it, so a company billing in euros was sent a test showing
// dollars. The company fields are overwritten below with the real record.
//
// depositAmount is deliberately absent (removed 2026-08-31 with its chip):
// no send path has ever supplied it, because FieldQuo has no deposit concept
// to derive one from. check-follow-up-flow.mjs asserts the shared sample
// carries nothing a send path cannot fill.

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can send test emails" },
      { status: 403 },
    );
  }

  const { to } = await request.json();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(to).trim())) {
    return NextResponse.json(
      { error: "A valid recipient email is required." },
      { status: 400 },
    );
  }

  const template = await db.documentTemplate.findUnique({ where: { id } });
  if (!template || template.companyId !== member.companyId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Branding fields are needed for the themed header/footer, not just the
  // {{company*}} merge tokens.
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      ...SENDER_SELECT,
      phone: true,
      website: true,
      address: true,
      city: true,
      province: true,
      logoUrl: true,
      brandColor: true,
      brandColors: true,
      // The itemised block's sample is formatted in these two.
      currency: true,
      defaultLanguage: true,
    },
  });

  // The company's default language stands in for "the document's": a test
  // has no document, and a company that writes its quotes in French should
  // see the French labels and the French-formatted totals its real chases
  // will carry — in its own currency, never a hard-coded "$".
  const language = company?.defaultLanguage || "en";
  const mergeData = {
    ...sampleMergeData({ language, currency: company?.currency || null }),
    companyName: company?.name || "Your Company",
    companyEmail: company?.email || "info@yourcompany.com",
    companyPhone: company?.phone || "(555) 123-4567",
    progressStage: STAGE_INDEX[template.type] ?? 0,
  };

  // The body the template says is sent, so a test of a canvas template is a
  // test of the canvas and not of blocks nobody will receive.
  const html = templateBody(template, mergeData, { company: company || {}, language });
  if (!html) {
    return NextResponse.json(
      { error: "This template's canvas is empty — draw something, or switch it back to blocks, before sending a test." },
      { status: 400 },
    );
  }

  const subject = renderSubject(template.subject, mergeData, template.name);

  const result = await sendEmail({
    // A test send takes a free-text address from the form, so it is the
    // easiest way of all to put a demo's letter in a real inbox.
    companyId: member.companyId,
    to: String(to).trim(),
    subject: `[Test] ${subject}`,
    html,
    // Test sends use the real sender too, so a company can confirm its
    // verified domain actually works before any client sees it.
    ...(await resolveSender(company || {}, member.companyId)),
  });

  if (result?.error) {
    return NextResponse.json(
      { error: typeof result.error === "string" ? result.error : "Could not send the test email." },
      { status: 400 },
    );
  }
  if (result?.skipped) {
    return NextResponse.json(
      {
        error:
          "Email isn't configured yet (RESEND_API_KEY missing) — the test wasn't sent.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, id: result?.id });
}
