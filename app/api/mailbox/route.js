// app/api/mailbox/route.js
//
// GET — Settings › Work email's whole card: which connection routes this
// deployment offers (and what is missing for the others), the caller's own
// mailboxes, and — for an owner or admin — every other mailbox at the
// company. Every member may call it: connecting your own work mailbox is
// yours to do (lib/mailbox/connections.js).
//
// Nothing secret is selected. publicShape is an allowlist.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { providerAvailability } from "@/lib/mailbox/config";
import { publicShape, isOwnerOrAdmin } from "@/lib/mailbox/connections";
import { GMAIL_SEND_SCOPE } from "@/lib/mailbox/providers/google";
import { PRESETS } from "@/lib/mailbox/presets";

const ROW_SELECT = {
  id: true,
  companyId: true,
  memberId: true,
  provider: true,
  address: true,
  scope: true,
  status: true,
  preset: true,
  imapHost: true,
  imapPort: true,
  smtpHost: true,
  smtpPort: true,
  grantedScopes: true,
  lastSyncAt: true,
  lastError: true,
  lastErrorAt: true,
  filedCount: true,
  skippedCount: true,
  backfillFrom: true,
  connectedAt: true,
  disconnectedAt: true,
  sendEnabled: true,
  lastSentAt: true,
  lastSendFallbackAt: true,
  lastSendFallbackReason: true,
  syncingSince: true,
};

/** Could this row send if switched on — without asking the provider again? */
function sendCapable(row) {
  if (row.scope !== "company") return false;
  if (row.provider === "imap") return Boolean(row.smtpHost && row.smtpPort);
  if (row.provider === "google") return String(row.grantedScopes || "").includes(GMAIL_SEND_SCOPE);
  if (row.provider === "microsoft") return /Mail\.Send/i.test(String(row.grantedScopes || ""));
  return false;
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const admin = isOwnerOrAdmin(member);
  const rows = await db.mailboxConnection.findMany({
    where: { companyId: member.companyId, ...(admin ? {} : { memberId: member.id }) },
    orderBy: { connectedAt: "asc" },
    select: ROW_SELECT,
  });

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const counts = rows.length
    ? await db.emailMessage.groupBy({
        by: ["mailboxId"],
        where: { companyId: member.companyId, mailboxId: { in: rows.map((r) => r.id) }, filedBy: "sync", createdAt: { gte: weekAgo } },
        _count: { _all: true },
      })
    : [];
  const byMailbox = new Map(counts.map((c) => [c.mailboxId, c._count._all]));

  const memberIds = [...new Set(rows.map((r) => r.memberId))];
  const members = memberIds.length
    ? await db.member.findMany({ where: { id: { in: memberIds }, companyId: member.companyId }, select: { id: true, user: { select: { name: true, email: true } } } })
    : [];
  const names = new Map(members.map((m) => [m.id, m.user?.name || m.user?.email || null]));

  const shaped = rows.map((r) =>
    publicShape(r, {
      filedThisWeek: byMailbox.get(r.id) || 0,
      memberName: names.get(r.memberId) || null,
      isMine: r.memberId === member.id,
      sendCapable: sendCapable(r),
    }),
  );

  return NextResponse.json({
    providers: providerAvailability(),
    canConnectCompany: admin,
    readOnly: Boolean(member.impersonation),
    mailboxes: shaped,
    // Which company mailbox is carrying client email right now, if any —
    // the card's one line above the list.
    sendingFrom: rows.find((r) => r.sendEnabled && r.status === "connected" && sendCapable(r))?.address || null,
    presets: PRESETS.map(({ key, label, imapHost, imapPort, imapSecurity, smtpHost, smtpPort, smtpSecurity, noteKey, route, hostPattern }) => ({
      key,
      label,
      imapHost,
      imapPort,
      imapSecurity,
      smtpHost,
      smtpPort,
      smtpSecurity,
      noteKey: noteKey || null,
      route: route || "imap",
      hostPattern: Boolean(hostPattern),
    })),
  });
}
