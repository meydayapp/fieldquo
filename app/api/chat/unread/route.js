// app/api/chat/unread/route.js
//
// The digit on the Chat tab: { unread, mentions } across the rooms the
// member is in — lib/company/chat/store.js unreadTotalsFor, the same counts
// the room list draws, summed. Read on a poll by app/hooks/useChatUnread.js
// from the /app chrome (the phone tab bar, the rail, the crew's big Chat
// button), so it seeds nothing and writes nothing.
//
// Gated with the rest of /api/chat by the team_chat feature; scoped by
// membership in the caller's own company, like every chat read.
//
// GET → { unread, mentions }
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { unreadTotalsFor } from "@/lib/company/chat/store";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const totals = await unreadTotalsFor(member);
  return NextResponse.json(totals);
}
