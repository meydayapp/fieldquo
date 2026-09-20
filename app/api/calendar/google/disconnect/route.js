// app/api/calendar/google/disconnect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { decryptToken, revokeGoogleToken } from "@/lib/calendar/googleClient";
import { getConnectionForMember, deleteConnection } from "@/lib/calendar/googleConnection";
import { removeMemberMirrors } from "@/lib/calendar/googleSync";
import { clearBusyCache } from "@/lib/calendar/googleBusy";
import { recordActivity } from "@/lib/activity/log";

/**
 * Severs the signed-in member's own Google Calendar connection.
 *
 * ── Order is the whole point ──────────────────────────────────────────────
 *
 *   1. Every event FieldQuo created leaves their calendar — checked one by
 *      one for FieldQuo's private mark, so nothing of theirs is touched
 *      (lib/calendar/googleSync.js removeMemberMirrors). This needs the
 *      token, so it runs BEFORE the token is destroyed.
 *   2. The refresh token is revoked at Google, which kills every access
 *      token minted from it. Best effort: a Google refusal must never stop
 *      the credential leaving our database, which is what pressing
 *      Disconnect actually asks for.
 *   3. The row goes. The mirror rows went with step 1; the cascade catches
 *      any the step could not reach.
 *
 * A POST, not a GET: this changes stored data, and a GET that deletes a
 * credential is the exact shape a link-preview bot can trigger.
 */
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const connection = await getConnectionForMember(member.id);
  if (!connection) return NextResponse.json({ success: true, wasConnected: false });

  const removed = await removeMemberMirrors(member.id, { connection });

  let revoked = null;
  try {
    const refreshToken = decryptToken(connection.refreshTokenEnc);
    const res = await revokeGoogleToken(refreshToken);
    revoked = res.ok;
    if (!res.ok) console.error(`[google-calendar] revoke refused for member=${member.id}: ${res.message}`);
  } catch (err) {
    // A row whose ciphertext will not open. Nothing to revoke with; the row
    // still goes, which is what was asked.
    revoked = false;
    console.error(`[google-calendar] revoke skipped for member=${member.id}: ${err?.message}`);
  }

  await deleteConnection(member.id);
  clearBusyCache(member.id);

  await recordActivity(member, {
    action: "calendar.google_disconnected",
    entityType: "settings",
    entityId: member.id,
    summary: "Disconnected their Google Calendar",
    summaryKey: "app.calendar.google.activity.disconnected",
  });

  return NextResponse.json({
    success: true,
    wasConnected: true,
    // How many FieldQuo events left their calendar, and whether Google
    // confirmed the revocation — so the panel never guesses.
    eventsRemoved: removed.deleted,
    removeErrors: removed.errors.length,
    revoked,
  });
}
