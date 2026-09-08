// app/api/settings/whatsapp/disconnect/route.js
//
// Stop watching a WhatsApp number.
//
// ══ It does not delete ═════════════════════════════════════════════════════
//
// The channel row is STAMPED, not removed — MessagingChannel.disconnectedAt,
// exactly as a Page disconnect works and for the reason the schema gives: the
// conversations survive, because the month-end review reads history and a
// contractor who reconnects must not find last quarter's won/lost record gone.
// Reconnecting revives the same row and every thread hanging off it comes
// back with it (lib/messaging/channels.js's saveChannel).
//
// The templates are left alone too. They are Meta's verdicts on the
// contractor's own WABA, not FieldQuo's data, and deleting them would mean a
// reconnect showed an empty template list until somebody thought to refresh
// it — a working feature that looks broken.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const channelId = typeof body.channelId === "string" ? body.channelId : "";
  if (!channelId) {
    return NextResponse.json({ error: "Which number?" }, { status: 400 });
  }

  // Company-scoped AND platform-scoped. The id alone would let a member
  // disconnect another tenant's channel; without the platform filter this
  // route could be used to disconnect a Facebook Page from the WhatsApp panel,
  // which is a control doing something other than what it says.
  const channel = await db.messagingChannel.findFirst({
    where: { id: channelId, companyId: member.companyId, platform: "whatsapp" },
    select: { id: true },
  });
  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.messagingChannel.update({
    where: { id: channel.id },
    // `status` is deliberately untouched. It describes whether the CREDENTIAL
    // works, and a contractor choosing to stop using a number has not broken
    // anything — writing "error" here would make a deliberate act read as a
    // fault in the support conversation that follows. `disconnectedAt` is the
    // column that means "not in use", and listChannels() filters on it.
    data: { disconnectedAt: new Date() },
  });

  return NextResponse.json({ disconnected: true });
}
