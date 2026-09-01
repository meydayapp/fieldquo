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
import {
  renderTemplateSections,
  renderSubject,
} from "@/lib/email/renderTemplateSections";
import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { STAGE_INDEX } from "@/app/data/emailTemplateBlocks";

// Sample values for the merge fields that don't exist until a real
// quote/invoice/job is attached. Company-specific fields are overwritten
// below with the real company record.
const SAMPLE_MERGE = {
  clientName: "Jane Doe",
  clientAddress: "123 Maple Street, Toronto, ON",
  clientPhone: "(416) 555-0142",
  quoteNumber: "Q-1042",
  quoteTotal: "$4,250.00",
  quoteUrl: "https://example.com/quote/preview",
  invoiceNumber: "INV-1042",
  invoiceTotal: "$4,250.00",
  invoiceUrl: "https://example.com/invoice/preview",
  dueDate: "Aug 1, 2026",
  balanceDue: "$1,250.00",
  projectStartDate: "Jul 28, 2026",
  projectEndDate: "Jul 30, 2026",
  jobTitle: "Kitchen Cabinet Refinishing",
  // depositAmount was here, with a convincing "$1,275.00". Removed 2026-08-31
  // along with its chip in MERGE_FIELDS: no send path has ever supplied it,
  // because FieldQuo has no deposit concept to derive one from — staged
  // billing is 0% built (docs/PAYMENT-SCHEDULE.md; only the cosmetic
  // free-text-to-cards display exists).
  //
  // A sample value here was worse than the chip. Someone who types the token
  // by hand saw $1,275.00 in the preview and got an empty string in the real
  // email, so the preview was actively vouching for a token that never works.
  // check-follow-up-flow.mjs now asserts this fixture carries nothing a send
  // path cannot fill, so the sample cannot come back before the feature does.
  amountPaid: "$3,000.00",
  subtotal: "$3,900.00",
  discount: "$150.00",
  tax: "$500.00",
  // progressStage is added per-template below, from STAGE_INDEX, so the test
  // email shows the same stage the editor preview did.
  lineItems: [
    {
      name: "Cabinet doors & drawer fronts — spray refinish",
      quantity: 24,
      unitPrice: 125,
      total: 3000,
    },
    {
      name: "Cabinet boxes — on-site refinish",
      quantity: 1,
      unitPrice: 750,
      total: 750,
    },
    {
      name: "Premium hardware replacement",
      quantity: 24,
      unitPrice: 6.25,
      total: 150,
    },
  ],
};

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
    },
  });

  const mergeData = {
    ...SAMPLE_MERGE,
    companyName: company?.name || "Your Company",
    companyEmail: company?.email || "info@yourcompany.com",
    companyPhone: company?.phone || "(555) 123-4567",
    progressStage: STAGE_INDEX[template.type] ?? 0,
  };

  const sections = Array.isArray(template.sections) ? template.sections : [];
  const html = renderTemplateSections(sections, mergeData, {
    company: company || {},
    theme: template.theme || null,
  });

  const subject = renderSubject(template.subject, mergeData, template.name);

  const result = await sendEmail({
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
