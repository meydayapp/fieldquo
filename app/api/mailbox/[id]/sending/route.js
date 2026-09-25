// app/api/mailbox/[id]/sending/route.js
//
// PATCH { enabled } — "Send client emails from this mailbox". Owner/admin
// only, company mailbox only.
//
// Switching ON is proven before it is saved:
//   · IMAP rows: an SMTP login with the stored password (sending nothing).
//     A refusal comes back as the card's error and the switch stays off.
//   · Google / Microsoft rows: sending needs a scope the read-only connect
//     did not ask for (gmail.send / Mail.Send). If it was not granted, the
//     answer is { consentUrl } and the card sends the person through the
//     provider's consent again; the callback switches it on once granted.
// One company mailbox sends at a time; turning one on turns the others off,
// said in the response so the card can show it.
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { isOwnerOrAdmin } from "@/lib/mailbox/connections";
import { openMailSecret } from "@/lib/mailbox/crypto";
import { testSmtpLogin } from "@/lib/mailbox/send";
import { GMAIL_SEND_SCOPE } from "@/lib/mailbox/providers/google";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isOwnerOrAdmin(member)) return NextResponse.json({ error: "Only an owner or admin can choose where client email is sent from." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const enabled = body.enabled === true;

  const row = await db.mailboxConnection.findFirst({ where: { id, companyId: member.companyId } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!enabled) {
    await db.mailboxConnection.update({ where: { id: row.id }, data: { sendEnabled: false } });
    await recordActivity(member, { action: "mailbox.sending_off", entityType: "settings", entityId: row.id, summary: `Stopped sending client email from ${row.address}`, summaryKey: "app.workEmail.activity.sendingOff" }).catch(() => null);
    return NextResponse.json({ ok: true, sendEnabled: false });
  }

  if (row.scope !== "company") return NextResponse.json({ error: "Only the company mailbox can send client email. Connect it as the company mailbox first.", code: "not_company" }, { status: 409 });
  if (row.status !== "connected" || !row.secretEnc) return NextResponse.json({ error: "Reconnect this mailbox before sending from it.", code: "not_connected" }, { status: 409 });

  if (row.provider === "google" && !String(row.grantedScopes || "").includes(GMAIL_SEND_SCOPE)) {
    return NextResponse.json({ ok: false, consentUrl: "/api/mailbox/google/connect?scope=company&send=1" });
  }
  if (row.provider === "microsoft" && !/Mail\.Send/i.test(String(row.grantedScopes || ""))) {
    return NextResponse.json({ ok: false, consentUrl: `/api/mailbox/microsoft/connect?scope=company&send=1&hint=${encodeURIComponent(row.address)}` });
  }
  if (row.provider === "imap") {
    if (!row.smtpHost || !row.smtpPort) return NextResponse.json({ error: "This mailbox has no outgoing (SMTP) server saved. Connect it again with its SMTP settings.", code: "no_smtp" }, { status: 409 });
    let password;
    try {
      password = openMailSecret(row.secretEnc, row.id);
    } catch {
      return NextResponse.json({ error: "The stored password could not be opened. Reconnect the mailbox.", code: "secret_unreadable" }, { status: 409 });
    }
    const test = await testSmtpLogin(row, password);
    if (!test.ok) return NextResponse.json({ error: test.error, code: test.code }, { status: 422 });
  }

  const others = await db.mailboxConnection.updateMany({
    where: { companyId: member.companyId, id: { not: row.id }, sendEnabled: true },
    data: { sendEnabled: false },
  });
  await db.mailboxConnection.update({
    where: { id: row.id },
    data: { sendEnabled: true, sendEnabledAt: new Date(), sendEnabledById: member.id, lastSendFallbackAt: null, lastSendFallbackReason: null },
  });
  await recordActivity(member, { action: "mailbox.sending_on", entityType: "settings", entityId: row.id, summary: `Client email now sends from ${row.address}`, summaryKey: "app.workEmail.activity.sendingOn" }).catch(() => null);
  return NextResponse.json({ ok: true, sendEnabled: true, turnedOff: others?.count || 0 });
}
