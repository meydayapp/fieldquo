// app/api/mailbox/imap/route.js
//
// POST — connect a mailbox on any other host with its address and password.
//
// The password is used for exactly two things in this request: a read-only
// IMAP LOGIN + EXAMINE INBOX to prove it works (the precise failure comes
// back to the card), and the seal (AES-256-GCM under MAIL_CREDENTIALS_KEY,
// bound to the row). It is never logged, never echoed, never stored in the
// clear; with the key unset the route refuses before reading the body.
//
// Rate-limited: a login test is a network call to a third party with a
// password in it, and a loop of them from one browser is somebody guessing.
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { rateLimit } from "@/lib/rateLimit";
import { recordActivity } from "@/lib/activity/log";
import { providerAvailable } from "@/lib/mailbox/config";
import { saveConnection } from "@/lib/mailbox/connections";
import { resolveImapSettings } from "@/lib/mailbox/presets";
import { testImapLogin } from "@/lib/mailbox/providers/imap";
import { bareAddress } from "@/lib/mailbox/addresses";
import { syncMailbox } from "@/lib/mailbox/sync";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) return NextResponse.json({ error: "A support session is read-only." }, { status: 403 });

  if (!providerAvailable("imap")) {
    return NextResponse.json(
      { error: "Mailbox passwords can't be stored safely on this deployment yet (MAIL_CREDENTIALS_KEY is not set).", code: "not_configured" },
      { status: 503 },
    );
  }

  const limited = rateLimit(request, "mailbox-imap-connect", {
    limit: 8,
    windowMs: 10 * 60 * 1000,
    message: "Too many sign-in attempts. Wait a few minutes and try again.",
  });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const address = bareAddress(body.address);
  const password = typeof body.password === "string" ? body.password : "";
  if (!address) return NextResponse.json({ error: "Enter the full email address.", code: "bad_address" }, { status: 400 });
  if (!password || password.length > 1024) return NextResponse.json({ error: "Enter the mailbox password.", code: "no_password" }, { status: 400 });

  const settings = resolveImapSettings({
    address,
    preset: typeof body.preset === "string" ? body.preset : "custom",
    imapHost: body.imapHost,
    imapPort: body.imapPort,
    imapSecurity: body.imapSecurity,
    smtpHost: body.smtpHost,
    smtpPort: body.smtpPort,
    smtpSecurity: body.smtpSecurity,
    loginName: body.loginName,
  });
  if (!settings.ok) return NextResponse.json({ error: settings.error, code: settings.code }, { status: 400 });

  const test = await testImapLogin({ address, ...settings.imap }, password);
  if (!test.ok) {
    return NextResponse.json({ error: test.error, code: test.code }, { status: 422 });
  }

  const saved = await saveConnection(db, {
    member,
    provider: "imap",
    address,
    scope: body.scope === "company" ? "company" : "member",
    secret: password,
    imap: settings.imap,
    cursorSeed: { sent: { folder: test.sentFolder || null, uidValidity: null, lastUid: 0 } },
  });
  if (!saved.ok) return NextResponse.json({ error: saved.error, code: saved.code }, { status: saved.status });

  await recordActivity(member, {
    action: "mailbox.connected",
    entityType: "settings",
    entityId: saved.row.id,
    summary: `Connected the mailbox ${address} (IMAP)`,
    summaryKey: "app.workEmail.activity.connected",
  }).catch(() => null);

  // The first pull, after the response — the card shows "Syncing…" and the
  // cron carries on from wherever this stops.
  after(async () => {
    const row = await db.mailboxConnection.findUnique({ where: { id: saved.row.id } });
    if (row) await syncMailbox(db, row, { budgetMs: 45 * 1000 }).catch(() => null);
  });

  return NextResponse.json({ ok: true, id: saved.row.id, sentFolder: test.sentFolder || null });
}
