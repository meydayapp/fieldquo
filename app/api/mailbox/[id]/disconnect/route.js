// app/api/mailbox/[id]/disconnect/route.js
//
// POST — the person's own "Disconnect". Wipes the stored credential (the one
// deletion this feature makes, and only at this request), revokes a Google
// token at Google, stops the sync and switches sending off. Emails already
// filed stay in the clients' history — the card says so before the click.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { canManage, disconnectConnection } from "@/lib/mailbox/connections";
import { openMailSecret } from "@/lib/mailbox/crypto";
import { revokeGmail } from "@/lib/mailbox/providers/google";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const row = await db.mailboxConnection.findFirst({ where: { id, companyId: member.companyId } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManage(member, row)) {
    return NextResponse.json({ error: "Only the person who connected this mailbox, or an owner or admin, can disconnect it." }, { status: 403 });
  }
  if (row.status === "disconnected") return NextResponse.json({ ok: true, already: true });

  await disconnectConnection(db, row, {
    // Google offers a revoke endpoint and a refresh token revoked there is
    // dead everywhere. Microsoft has no per-token revoke for delegated
    // access; the token is destroyed here and the person can remove the app
    // at myapps.microsoft.com, which the card links to. IMAP: nothing to
    // revoke — the password stays theirs.
    revoke: row.provider === "google" ? async (r) => revokeGmail(openMailSecret(r.secretEnc, r.id)) : null,
  });

  await recordActivity(member, {
    action: "mailbox.disconnected",
    entityType: "settings",
    entityId: row.id,
    summary: `Disconnected the mailbox ${row.address}`,
    summaryKey: "app.workEmail.activity.disconnected",
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
