// app/api/messaging/threads/[id]/note/route.js
//
// A private note, in the same thread as the customer's messages.
//
// ══ Why this is its own route and not a flag on the reply route ════════════
//
// Because of what it must never do. A note is "she's fussy about the trim
// colour", "quoted high, they're shopping around", "his wife makes the
// decisions" — written four pixels from the box that sends words to that
// person. The consequence of one wrong branch is not a broken screen, it is a
// homeowner reading what the company thinks of them.
//
// So the guarantee is STRUCTURAL rather than conditional: this file does not
// import lib/messaging/metaSend.js. There is no branch to get wrong, no flag
// to invert, and no future refactor that can accidentally send a note by
// reordering an if. A single route with `if (!isPrivate) send()` would put a
// customer's opinion of themselves one boolean away from their inbox.
//
// lib/messaging/metaSend.js refuses a private row anyway, first, before it
// looks at a channel — see its header. Two independent reasons, in the same
// spirit as the deliberately-doubled impersonation gate in AGENTS.md.
//
// ══ Why a note works when replying does not ════════════════════════════════
//
// Meta has not approved pages_messaging, so for every real company today the
// composer's Reply side is disabled with the reason on it. The Note side is
// NOT: a note goes nowhere near Meta, needs no Page, and is useful the moment
// a conversation exists. This is the one control on this screen that a real
// contractor can use today, which is exactly why it had to be real.
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
import { noteRowFields } from "@/lib/messaging/messageKinds";
import { rateLimit } from "@/lib/rateLimit";

// Longer than the 2000 the reply route allows, because Meta's limit is Meta's
// and this never goes there. Still bounded: an unbounded text column reachable
// from a browser is a denial-of-service with a nicer name.
const MAX_LENGTH = 4000;

export async function POST(request, { params }) {
  // params is a Promise in Next 16.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Writing what the company thinks of a customer, into the company's record,
  // sits at the same rung as replying — not at the read rung the inbox list
  // uses. A member who may only LOOK at requests may not annotate them.
  try {
    requireLevel(
      {
        ...member,
        permissions: member.id
          ? ((await loadEnforceableMember(db, member.id))?.permissions ?? null)
          : null,
      },
      "requests",
      "view_create_edit",
      "add a note to a conversation",
    );
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const limited = rateLimit(request, "messaging-note", {
    limit: 60,
    windowMs: 60 * 1000,
    message: "You're adding notes faster than we can store them. Give it a moment.",
  });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  if (text.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `Notes can be up to ${MAX_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const connection = await messagingConnection(member.companyId);
  if (connection.mock) {
    // A demo's threads are computed, not stored. Said plainly rather than
    // answered 200 with a note that will be gone on refresh.
    return NextResponse.json(
      { error: "This is a sample conversation, so notes on it aren't kept." },
      { status: 409 },
    );
  }

  // Company-scoped: the id alone would let a member write a note into another
  // tenant's conversation — and then read it back.
  const thread = await db.messageThread.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true },
  });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const message = await db.message.create({
    data: {
      threadId: thread.id,
      // ONE constructor for both columns — direction "note" AND private true —
      // so they cannot be set inconsistently here. See
      // lib/messaging/messageKinds.js.
      ...noteRowFields(),
      // Never came from Meta, and says so in its id, like every other locally
      // minted row in this feature.
      externalId: `local:note:${crypto.randomUUID()}`,
      body: text,
      sentAt: new Date(),
      sentByUserId: member.userId || null,
    },
    select: {
      id: true,
      direction: true,
      private: true,
      body: true,
      sentAt: true,
      sentByUserId: true,
    },
  });

  // The thread is deliberately NOT touched. `lastMessageAt` means "when these
  // two people last said something to each other" — the inbox orders on it and
  // the month-end review reports it — and a note is neither of them saying
  // anything. `unread` is left alone for the same reason: making a note about
  // somebody is not answering them, which is the same rule
  // lib/messaging/waiting.js applies to `waitingSince`.

  return NextResponse.json({ saved: true, message });
}
