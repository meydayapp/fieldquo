// lib/aiEmployee/ownChannel.js
//
// The MessagingChannel row for one of FieldQuo's own two channels — "web"
// (the site chat widget) and "sms" (the shared system number) — for one
// company.
//
// ══ Why a channel row at all ═══════════════════════════════════════════════
//
// The inbox is built on MessageThread → MessagingChannel → company, and
// everything that makes it an inbox — the unread count, the waiting badge, the
// thread number, the push to staff, the AI employee hook, the reply route —
// hangs off that chain (lib/messaging/ingest.js). A web-chat conversation
// stored anywhere else would be a second inbox, and the owner's ask was that
// "the company sees it in Conversations". So each of the two channels is a
// row here, keyed `web:<companyId>` / `sms:<companyId>` so the global
// @@unique([platform, externalId]) holds and channelForExternalId resolves
// it exactly as it resolves a Page id.
//
// ══ Not a Meta channel ═════════════════════════════════════════════════════
//
// No token (accessTokenEnc is the empty string — the column is required and
// nothing decrypts it for these platforms), no approval, no 24-hour window.
// lib/messaging/channels.js's listChannels and saveChannel read
// META_PLATFORMS and never see these rows, so "is a Page connected" keeps
// meaning what it meant.

import { db } from "@/lib/db";
import { OWN_PLATFORMS } from "@/lib/messaging/platforms";

export function ownChannelExternalId(platform, companyId) {
  return `${platform}:${companyId}`;
}

/**
 * Get or create. Idempotent on the unique index; two visitors opening the
 * widget in the same second race to the same row.
 */
export async function ownChannelFor(companyId, platform, prisma = db) {
  if (!companyId || !OWN_PLATFORMS.includes(platform)) return null;
  const externalId = ownChannelExternalId(platform, companyId);
  const existing = await prisma.messagingChannel.findUnique({
    where: { platform_externalId: { platform, externalId } },
  });
  if (existing) {
    // Belt and braces: the id embeds the company, and the row must agree.
    return existing.companyId === companyId ? existing : null;
  }
  try {
    return await prisma.messagingChannel.create({
      data: {
        companyId,
        platform,
        externalId,
        name: platform === "web" ? "Website chat" : "Text messages",
        accessTokenEnc: "",
        status: "connected",
      },
    });
  } catch {
    const raced = await prisma.messagingChannel.findUnique({
      where: { platform_externalId: { platform, externalId } },
    });
    return raced?.companyId === companyId ? raced : null;
  }
}
