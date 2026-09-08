// app/api/messaging/threads/[id]/attachments/route.js
//
// "That photo didn't arrive. Try again."
//
// ══ Why a retry exists at all ══════════════════════════════════════════════
//
// Because the alternative is a photo that silently vanished, which is the
// failure this repo cares most about. /api/cron/messaging-media tries an
// attachment up to MEDIA_FETCH_MAX_ATTEMPTS times and then stops — it has to,
// because a media id Meta has expired will never resolve and a forever-retry
// on it is a permanent invisible cost. Stopping is right; stopping SILENTLY
// would leave a bubble saying "couldn't fetch this" with no way forward.
//
// So the bubble says what went wrong and offers this, and pressing it resets
// the attempt counter — a person pressing Retry is new information the counter
// does not have (Meta is back up, the number was reconnected).
//
// ══ Why it fetches inline instead of re-queueing ═══════════════════════════
//
// A retry that answered "we'll have another go within the minute" is a control
// whose result the person who pressed it never sees. Somebody is looking at
// the bubble; they get the verdict. The cron remains the mechanism for
// everything nobody is watching.
//
// ══ Why the READ rung and not the write rung ═══════════════════════════════
//
// This writes a column, so the reflex is `view_create_edit`. It is the wrong
// rung: nothing a customer sees changes, no message is sent, no judgement is
// recorded — it finishes loading a message that already exists, for somebody
// who is already entitled to read it. Putting it a rung higher would give a
// crew member a Retry button that 403s, which is a dead control wearing a
// permission check.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { messagingConnection, channelById } from "@/lib/messaging/channels";
import { fetchMessageMedia } from "@/lib/messaging/mediaFetch";
import {
  normaliseAttachments,
  withFetchReset,
  publicAttachments,
} from "@/lib/messaging/attachments";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request, { params }) {
  // params is a Promise in Next 16.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireLevel(
      { ...member, permissions: member.id ? (await loadEnforceableMember(db, member.id))?.permissions ?? null : null },
      "requests",
      "view_only",
      "fetch a message attachment",
    );
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  // Each press costs a Graph round trip and a Cloudinary upload, so the button
  // is bounded the same way the reply button is.
  const limited = rateLimit(request, "messaging-attachment", {
    limit: 30,
    windowMs: 60 * 1000,
    message: "That's a lot of retries at once. Give it a moment.",
  });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const messageId = typeof body.messageId === "string" ? body.messageId : "";
  const index = Number(body.index);
  if (!messageId || !Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Which attachment?" }, { status: 400 });
  }

  const connection = await messagingConnection(member.companyId);
  if (connection.mock) {
    // A demo's threads are computed rather than stored, so there is no row to
    // fetch into. Said plainly rather than answered 200 — see the reply route.
    return NextResponse.json(
      { error: "This is a sample conversation, so there is nothing to fetch." },
      { status: 409 },
    );
  }

  // Company-scoped through the THREAD, and the thread id from the path is
  // checked against the message as well: `messageId` alone would let a member
  // pull another tenant's attachment into their own Cloudinary folder, which
  // is the worst shape of this bug — their customer's photo, our contractor's
  // account.
  const message = await db.message.findFirst({
    where: { id: messageId, threadId: id, thread: { companyId: member.companyId } },
    select: {
      id: true,
      attachments: true,
      thread: { select: { companyId: true, channelId: true } },
    },
  });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current = normaliseAttachments(message.attachments);
  const target = current[index];
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.state === "ready") {
    // Already here. Not an error — two people looking at the same thread, one
    // of them a minute behind — so it answers with the truth rather than a
    // refusal the second person would read as a fault.
    return NextResponse.json({ attachments: publicAttachments(message.attachments) });
  }
  if (target.state === "unavailable") {
    return NextResponse.json(
      { error: "There is nothing to fetch for this one — no link and no file id ever arrived." },
      { status: 409 },
    );
  }

  const channel = await channelById(member.companyId, message.thread.channelId);

  const reset = withFetchReset(message.attachments, index);
  const result = await fetchMessageMedia({
    attachments: reset,
    channel,
    companyId: message.thread.companyId,
  });

  await db.message.update({
    where: { id: message.id },
    data: { attachments: result.attachments, mediaPending: result.pending },
  });

  const after = normaliseAttachments(result.attachments)[index];
  if (after?.state !== "ready") {
    // A failed retry is a 409 with the reason, so the browser's
    // reportResponseError shows Meta's own words rather than "something went
    // wrong" — and the bubble beneath still carries the same sentence.
    return NextResponse.json(
      {
        fetched: false,
        error: after?.fetchError || "The file could not be fetched.",
        attachments: publicAttachments(result.attachments),
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    fetched: true,
    attachments: publicAttachments(result.attachments),
  });
}
