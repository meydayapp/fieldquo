// app/api/settings/whatsapp/status/route.js
//
// What the WhatsApp panel needs to render ONE honest state and never a control
// that cannot work:
//
//   1. awaiting Meta review  — metaWhatsAppEnabled() is false, which is every
//                              production deployment today. No Connect button
//                              at all; the panel says what is blocked.
//   2. not configured        — the flag is on but this deployment has no
//                              META_APP_ID/META_APP_SECRET, no token
//                              encryption key, or no Embedded Signup
//                              configuration id.
//   3. connected / not connected — a real Connect / Disconnect, plus the
//                              approved templates, because "what can I send
//                              once the 24-hour window closes" is a question
//                              with an answer only this screen can give.
//
// Gated exactly like app/api/settings/social/status: isBillingAdmin, with the
// same impersonation carve-out on the READ only (non-negotiable #3 — the
// platform console views everything and edits nothing, and middleware already
// refuses every non-GET under an impersonation cookie).
//
// The TOKEN is not in this response and cannot be: publicChannelShape() is the
// only thing serialised and it has no token field.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { metaAppConfigured, metaFullyConfigured, metaWhatsAppEnabled } from "@/lib/meta/client";
import { featureStateFor } from "@/lib/features/gate";
import { listChannels, publicChannelShape } from "@/lib/messaging/channels";
import { publicTemplateShape } from "@/lib/messaging/templates";
import { whatsAppSignupConfigured } from "@/lib/messaging/whatsappSignup";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  // The availability gate, asked explicitly. FieldQuo can withhold WhatsApp
  // from a company independently of Meta's approval — a beta cohort, or a
  // tenant whose number was suspended — and a panel that only knew about the
  // env flag would offer a Connect button FieldQuo itself has switched off.
  const feature = await featureStateFor(member.companyId, "whatsapp_messaging");

  const channels = (await listChannels(member.companyId).catch(() => []))
    .filter((c) => c.platform === "whatsapp")
    .map(publicChannelShape);

  // Templates are only meaningful once a number is connected — there is no
  // WABA to have approved anything against otherwise. An empty list for an
  // unconnected company is the truth, not a failed read.
  const templates = channels.length
    ? (
        await db.whatsAppTemplate
          .findMany({
            where: { companyId: member.companyId },
            orderBy: [{ status: "asc" }, { name: "asc" }],
          })
          .catch(() => [])
      ).map(publicTemplateShape)
    : [];

  return NextResponse.json({
    // The env flag and the feature gate are reported SEPARATELY rather than
    // ANDed into one boolean. They fail differently and the panel says two
    // different sentences: "Meta has not approved this yet" is nothing the
    // contractor can act on, and "FieldQuo has not switched this on for you"
    // is a support conversation.
    connectEnabled: metaWhatsAppEnabled(),
    featureState: feature.state,
    appConfigured: metaAppConfigured(),
    fullyConfigured: metaFullyConfigured(),
    signupConfigured: whatsAppSignupConfigured(),
    // A support session reads this screen and may change nothing on it
    // (non-negotiable #3; every non-GET is refused inside getCurrentMember).
    // Said here so the panel can withhold the pasted-credential form rather
    // than draw one whose submit would be refused.
    readOnly: Boolean(member.impersonation),
    channels,
    templates,
  });
}
