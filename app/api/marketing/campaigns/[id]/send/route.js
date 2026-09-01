// app/api/marketing/campaigns/[id]/send/route.js
//
// Sends an "email" type MarketingCampaign to every subscribed
// MarketingSubscriber. A campaign that's already fully sent (sentAt set)
// can't be re-sent from here — duplicate the campaign instead.
//
// ── Resumable, not just one-shot ────────────────────────────────────────────
//
// The sentAt guard above used to be the whole story, and it had a gap: sentAt
// was written only AFTER the loop finished, so anything that killed the
// request mid-loop (a Neon cold-start P1001 is the everyday version of this —
// see AGENTS.md) left sentAt unset. The guard didn't fire on a retry, and the
// contractor's only available next move — click Send again — re-emailed
// everyone already reached. Nothing recorded who had been mailed, so there
// was nothing to skip.
//
// MarketingCampaignDelivery (prisma/schema.prisma) is that record. Before
// mailing a subscriber, this route CLAIMS them by creating a delivery row —
// a @@unique([campaignId, subscriberId]) constraint, so if a previous attempt
// (or a concurrent one — a double-click races the same way a retry does)
// already claimed them, the create fails and this attempt skips them without
// sending twice. If the send itself then fails, the claim is deleted so a
// later attempt can try that subscriber again — a delivery row is a promise
// that the email actually left, never that an attempt was merely made.
//
// sentAt is written only when every currently-subscribed recipient ends up
// with a delivery row. Anything short of that is `status: "partial"`,
// which the campaign detail UI reads to tell "sent" from "partially sent"
// rather than leaving the contractor to guess from a bare recipient count.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import {
  renderTemplateSections,
  renderSubject,
} from "@/lib/email/renderTemplateSections";
import { ensureSubscriberToken, unsubscribeHeaders } from "@/lib/marketing/unsubscribe";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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

  return sendCampaignEmails({ campaign, companyId: member.companyId, request });
}

/**
 * The resumable send loop itself, split out from POST so it can be exercised
 * directly against a scripted db (scripts/check-consent-mechanisms.mjs) —
 * "a retry skips whoever already got it" is a property of a query racing a
 * unique constraint, and there is no way to be confident of that by reading
 * the loop rather than running it. POST above still owns every auth and
 * validation gate; this function assumes all of that already passed.
 */
export async function sendCampaignEmails({ campaign, companyId, request }) {
  const id = campaign.id;

  const subscribers = await db.marketingSubscriber.findMany({
    where: { companyId, subscribed: true },
  });

  // Who this campaign has already reached, from this attempt or an earlier
  // one — read BEFORE sending anything, so a subscriber already claimed is
  // never even considered for a new send this pass.
  const priorDeliveries = await db.marketingCampaignDelivery.findMany({
    where: { campaignId: id },
    select: { subscriberId: true },
  });
  const deliveredIds = new Set(priorDeliveries.map((d) => d.subscriberId));
  const pending = subscribers.filter((s) => !deliveredIds.has(s.id));

  if (subscribers.length === 0 && deliveredIds.size === 0) {
    return NextResponse.json(
      { error: "No subscribed recipients — import clients or add subscribers first" },
      { status: 400 },
    );
  }

  // Resolved once, not per subscriber — the sender is identical for every
  // recipient in a campaign.
  const sender = await resolveSender(campaign.company || {}, campaign.companyId);

  for (const sub of pending) {
    // The claim. A unique-constraint failure here means someone else (an
    // earlier attempt, or a request racing this one) already has this
    // subscriber — skip, don't send. Any OTHER failure (e.g. the DB itself
    // is unreachable) means we don't know whether a row exists, but no row
    // was committed by THIS call either way (Postgres doesn't partially
    // commit a single INSERT), so it's equally safe to skip: the subscriber
    // stays "pending" and a later attempt will pick them up.
    let claim;
    try {
      claim = await db.marketingCampaignDelivery.create({
        data: { campaignId: id, subscriberId: sub.id },
      });
    } catch (err) {
      console.error(`[campaign send] could not claim ${sub.email}:`, err?.message);
      continue;
    }

    try {
      // A marketing campaign is the textbook COMMERCIAL email — see
      // lib/marketing/unsubscribe.js's classification note. Every recipient
      // here already exists as a subscribed row (the query above filters on
      // it), but not every row was ever minted a token: rows added by a
      // manual add or a client import never send anything at creation time,
      // so nothing needed one until now.
      const unsubscribeToken = await ensureSubscriberToken(db, sub);

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
        unsubscribe: { token: unsubscribeToken, request },
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
        ...unsubscribeHeaders({ token: unsubscribeToken, request }),
      });
      if (result?.error) {
        throw new Error(
          typeof result.error === "string" ? result.error : result.error?.message || "send failed",
        );
      }
    } catch (err) {
      // The claim was a promise that this subscriber got emailed. They
      // didn't, so undo it — a later resend must be able to try them again.
      // Best-effort: one bad recipient (a bounced address, a template error)
      // must not stop the rest of the campaign from going out.
      await db.marketingCampaignDelivery
        .delete({ where: { id: claim.id } })
        .catch((delErr) =>
          console.error(`[campaign send] could not release claim for ${sub.email}:`, delErr?.message),
        );
      console.error(`[campaign send] send to ${sub.email} failed:`, err?.message);
    }
  }

  const deliveredCount = await db.marketingCampaignDelivery.count({
    where: { campaignId: id },
  });
  // "Complete" means every recipient subscribed AT THE START of this request
  // now has a delivery row. Subscribers added mid-send by a concurrent
  // request aren't held against this pass — the guard is about not leaving
  // someone who was supposed to get this email un-emailed, not about
  // freezing the list.
  const complete = deliveredCount >= subscribers.length;

  const updated = await db.marketingCampaign.update({
    where: { id },
    data: {
      recipientCount: deliveredCount,
      ...(complete
        ? { sentAt: new Date(), status: "completed" }
        : { status: "partial" }),
    },
  });

  return NextResponse.json({
    ok: true,
    sent: deliveredCount,
    partial: !complete,
    campaign: updated,
  });
}
