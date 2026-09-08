// app/api/settings/whatsapp/templates/route.js
//
// Refresh the approved-template list from Meta.
//
// ══ Why a button and not a cron ════════════════════════════════════════════
//
// A template's status changes when Meta reviews it, which is a thing the
// contractor is waiting for and will check. A nightly job would mean a
// template approved at 10am shows as PENDING until tomorrow — and a composer
// offering nothing while an approved template sits unread is the feature
// looking broken for a whole day. Meta also pushes
// `message_template_status_update` webhooks; subscribing to that field is the
// obvious next step and is deliberately NOT claimed as done here.
//
// POST rather than GET because it writes rows. The list itself is read by
// /api/settings/whatsapp/status, which is where the panel gets it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { listChannels, decryptedChannelToken } from "@/lib/messaging/channels";
import { syncTemplates } from "@/lib/messaging/templates";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const limited = rateLimit(request, "whatsapp-templates", {
    limit: 10,
    windowMs: 5 * 60 * 1000,
    message: "That's been refreshed a few times just now. Give it a minute.",
  });
  if (limited) return limited;

  const channel = (await listChannels(member.companyId).catch(() => [])).find(
    (c) => c.platform === "whatsapp",
  );
  if (!channel) {
    // 409 and a sentence, not a silent empty list: "there is nothing to
    // refresh because no number is connected" is a different answer from "you
    // have no templates", and only one of them has something to do about it.
    return NextResponse.json(
      { error: "No WhatsApp number is connected, so there is no template list to read." },
      { status: 409 },
    );
  }

  let accessToken;
  try {
    accessToken = decryptedChannelToken(channel);
  } catch (err) {
    return NextResponse.json(
      { error: `The stored WhatsApp credential could not be read (${err?.message || "unknown"}).` },
      { status: 409 },
    );
  }

  const result = await syncTemplates({
    db,
    companyId: member.companyId,
    channel,
    accessToken,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message, reason: result.reason }, { status: 409 });
  }

  return NextResponse.json({ synced: result.synced, total: result.total });
}
