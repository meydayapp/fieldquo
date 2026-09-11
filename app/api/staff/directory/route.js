// app/api/staff/directory/route.js
//
// Everyone at FieldQuo who can be messaged: every active platform admin and
// every rep who can sign in, in one list, for both portals. The owner's rule:
// "they can look up people within fieldquo including sales and internal
// employees".
//
// GET ?q= → { me, people: [{ kind, id, name, email, role, label, engagement,
//                            presence: { source, online, state, stale,
//                                        lastSeenAt } }] }
//
// `presence.source` says what the dot MEANS: "floor" is the state a rep
// declared on the sales floor (the same livePresence the floor board draws);
// "chat" is when a platform admin last had this chat open. They are not the
// same fact and the screen must not print them as one. Departed staff are not
// in the list at all — see staffDirectory().
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveStaffViewer } from "@/lib/staff/viewer";
import { staffDirectory } from "@/lib/staff/store";

export async function GET(request) {
  const { viewer, refusal } = await resolveStaffViewer(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const q = new URL(request.url).searchParams.get("q") || "";
  const people = await staffDirectory({ q });
  return NextResponse.json({ me: viewer, people });
}
