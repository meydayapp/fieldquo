// app/api/chat/rooms/[id]/route.js
//
// One conversation in the company's crew chat: read it, say something, and
// (a channel's managers, a group's members) rename it or change its topic,
// visibility, posting rule or auto-join.
//
// GET [?after=<iso>[&changed=<iso>]] → lib/company/chat/store.js readThread:
//        { id, delta, lastSeenAt, kind, jobId, active, title, titleMissing,
//          titleExtra, topic, private, postingPolicy, autoJoin, archived,
//          memberCount, readOnly, mine, can, messages, seen,
//          members?, membersTruncated? }
//        Without `after`: the newest THREAD_TAKE messages, oldest first, and
//        up to MEMBER_INLINE_MAX members. With it: only the messages since —
//        the 4-second poll of an open room — and no member list.
//        `seen` is { messageId, count } for the reader's own last message,
//        for room members only. `changed` (the previous payload's
//        `changesCursor`) adds the messages already on screen that were
//        edited or removed since, as `changed: [...]`; `pinned` rides on
//        every read, so an unpin is seen as an absence. A removed message's
//        words are in NO payload, for anybody (rules.js threadMessages).
// POST { body?, attachments?, card?, replyToId? } → { ok, message }
//        [X-Offline-Key: <key>] — the phone's outbox: a replay of the same
//        key is the same message (lib/offline/idempotency.js).
//        Mentions parsed on write; codes: no_room | empty | read_only |
//        archived | office_only | bad_attachment | bad_card | bad_reply
// PATCH { name?, topic?, postingPolicy?, private?, autoJoin? } → { ok }
//        codes: no_room | read_only | fixed_room | archived | not_allowed |
//               bad_setting | name_missing | name_too_long | name_reserved |
//               name_taken
//
// Not-a-member and does-not-exist both answer 404: a distinct 403 would
// confirm a room with that id exists, which is a fact about somebody else's
// conversation — a private channel's above all — and, across companies,
// about somebody else's tenant.
//
// `params` is a Promise in Next 16 — awaited below, not destructured.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { readThread, postMessage, updateRoom } from "@/lib/company/chat/store";
import { readOfflineKey } from "@/lib/offline/idempotency";

const refused = (r) => NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
const NOT_FOUND = { status: 404, code: "no_room", error: "No such conversation." };

export async function GET(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { id } = await params;
  const sp = new URL(request.url).searchParams;
  const after = sp.get("after") || null;
  const changedSince = sp.get("changed") || null;
  // Opening it is reading it — up to the last message THIS payload shows,
  // not up to now (lib/chat/unreadQuery.js seenUpTo). A support session
  // holds no row and stamps nothing — it must leave no trace on the
  // customer's data.
  const thread = await readThread(member, id, { after, changedSince });
  if (!thread) return refused(NOT_FOUND);
  return NextResponse.json(thread);
}

export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const sent = await postMessage({
    member,
    roomId: id,
    body: body?.body,
    attachments: Array.isArray(body?.attachments) ? body.attachments : null,
    card: body?.card ?? null,
    replyToId: typeof body?.replyToId === "string" ? body.replyToId : null,
    offlineKey: readOfflineKey(request),
  });
  if (!sent.ok) return refused(sent);
  return NextResponse.json({ ok: true, message: sent.message, replayed: Boolean(sent.replayed) });
}

export async function PATCH(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  // Only the fields this route knows are passed on; anything else in the
  // body is ignored rather than written.
  const patch = {};
  for (const key of ["name", "topic", "postingPolicy", "private", "autoJoin"]) {
    if (body && Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key];
  }
  const done = await updateRoom(member, id, patch);
  if (!done.ok) return refused(done);
  return NextResponse.json({ ok: true, unchanged: Boolean(done.unchanged) });
}
