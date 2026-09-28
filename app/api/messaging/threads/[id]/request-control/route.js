// app/api/messaging/threads/[id]/request-control/route.js
//
// "Ask to take over this conversation" — the one recovery FieldQuo may
// attempt when Meta refuses a reply because another app controls the thread
// (lib/messaging/threadControl.js).
//
// ══ Why ASK and never TAKE ═════════════════════════════════════════════════
//
// The app holding the conversation is there because the company put it there
// — in the incident, Meta's own Business AI answering the Page's inbox.
// take_thread_control would move the conversation out from under that choice
// without anyone deciding to, and Meta only allows it to the Primary Receiver
// or on an idle thread anyway. request_thread_control leaves the decision with
// the app that holds the conversation, which is where it belongs. Nothing here
// changes the company's Meta settings; the screen names those for a person to
// change.
//
// ══ What a 200 means ═══════════════════════════════════════════════════════
//
// "Meta delivered the request." Not "you have the conversation": FieldQuo does
// not subscribe to messaging_handovers, so it cannot know the holder's answer,
// and the response says so rather than implying success. The contractor's
// typed reply is still in the composer; pressing Send is the honest test.
//
// Writes nothing. A request is not a message, and a row claiming one was
// sent would be the record of a message that did not happen.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { messagingConnection } from "@/lib/messaging/channels";
import { requestMetaThreadControl } from "@/lib/messaging/metaSend";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The reply's own rung: asking for a conversation is only useful to
  // somebody allowed to answer in it.
  try {
    requireLevel(
      { ...member, permissions: member.id ? (await loadEnforceableMember(db, member.id))?.permissions ?? null : null },
      "requests",
      "view_create_edit",
      "reply to a message",
    );
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const limited = rateLimit(request, "messaging-request-control", {
    limit: 10,
    windowMs: 60 * 1000,
    message: "You've asked several times already. Give the other app a moment to answer.",
  });
  if (limited) return limited;

  const connection = await messagingConnection(member.companyId);
  if (connection.mock) {
    return NextResponse.json(
      { requested: false, reason: "demo", error: "This is a sample conversation — nothing is sent to Meta." },
      { status: 409 },
    );
  }

  // Company-scoped, exactly as the reply route: an id alone would let a member
  // ask for another tenant's conversation.
  const thread = await db.messageThread.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, participantExternalId: true, channel: true },
  });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await requestMetaThreadControl({
    channel: thread.channel,
    recipientExternalId: thread.participantExternalId,
  });
  if (!result.ok) {
    return NextResponse.json({ requested: false, reason: result.reason, error: result.message }, { status: 409 });
  }
  return NextResponse.json({ requested: true });
}
