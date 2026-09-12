// app/api/chat/directory/route.js
//
// Everybody in the caller's company who can be messaged: every active
// member, in one list, for the New message picker. Never anybody from
// another company — the roster is read by the caller's companyId
// (lib/company/chat/store.js directoryFor), and there is no parameter that
// could name a different one.
//
// GET ?q= → { me, people: [{ id, name, email, role, label, isYou }] }
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { directoryFor } from "@/lib/company/chat/store";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const q = new URL(request.url).searchParams.get("q") || "";
  const people = await directoryFor(member, { q });
  return NextResponse.json({ me: { id: member.id, role: member.role }, people });
}
