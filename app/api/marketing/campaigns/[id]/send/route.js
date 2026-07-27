// app/api/marketing/campaigns/[id]/send/route.js
//
// Sends an "email" type MarketingCampaign to every subscribed
// MarketingSubscriber. One-shot — a campaign that's already been sent
// (sentAt set) can't be re-sent from here, to avoid accidental double-blasts;
// duplicate the campaign instead if you want to send again.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import {
  renderTemplateSections,
  renderSubject,
} from "@/lib/email/renderTemplateSections";

export async function POST(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can send campaigns" },
      { status: err.status || 403 },
    );
  }

  const campaign = await db.marketingCampaign.findUnique({
    where: { id },
    include: {
      template: true,
      // Branding fields feed the themed header/footer, not just merge tokens.
      company: {
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
      },
    },
  });
  if (!campaign || campaign.companyId !== member.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (campaign.type !== "email") {
    return NextResponse.json(
      { error: "Only email campaigns can be sent" },
      { status: 400 },
    );
  }
  if (!campaign.template) {
    return NextResponse.json(
      { error: "This campaign has no template selected" },
      { status: 400 },
    );
  }
  if (campaign.sentAt) {
    return NextResponse.json(
      { error: "This campaign has already been sent" },
      { status: 400 },
    );
  }

  const subscribers = await db.marketingSubscriber.findMany({
    where: { companyId: member.companyId, subscribed: true },
  });
  if (subscribers.length === 0) {
    return NextResponse.json(
      { error: "No subscribed recipients — import clients or add subscribers first" },
      { status: 400 },
    );
  }

  // Resolved once, not per subscriber — the sender is identical for every
  // recipient in a campaign.
  const sender = await resolveSender(campaign.company || {}, campaign.companyId);

  let delivered = 0;
  for (const sub of subscribers) {
    const mergeData = {
      clientName: sub.name || "",
      clientAddress: sub.address || "",
      clientPhone: sub.phone || "",
      companyName: campaign.company?.name || "",
      companyPhone: campaign.company?.phone || "",
      companyEmail: campaign.company?.email || "",
    };
    const html = renderTemplateSections(campaign.template.sections, mergeData, {
      company: campaign.company || {},
      theme: campaign.template.theme || null,
    });
    // The campaign name is an internal label; prefer the template's
    // client-facing subject when one is set.
    const subject = renderSubject(
      campaign.template.subject,
      mergeData,
      campaign.name,
    );
    const result = await sendEmail({
      to: sub.email,
      subject,
      html,
      ...sender,
    });
    if (!result?.error) delivered++;
  }

  const updated = await db.marketingCampaign.update({
    where: { id },
    data: {
      sentAt: new Date(),
      recipientCount: delivered,
      status: "completed",
    },
  });

  return NextResponse.json({ ok: true, sent: delivered, campaign: updated });
}
