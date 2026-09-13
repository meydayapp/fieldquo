// app/api/shift-requests/[id]/route.js
//
// One verb: POST { action: accept | decline | cancel | approve, note? }.
// The state machine (lib/shiftRequests/state.js) decides who may do what
// from where; a refusal comes back as 409 with the machine's own sentence,
// so the screen says "the colleague hasn't accepted yet" rather than
// "forbidden". Approving moves the shift in the same transaction as the
// status, after the fit check — see lib/shiftRequests/store.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { actOn } from "@/lib/shiftRequests/store";
import { REQUEST_ACTIONS } from "@/lib/shiftRequests/state";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";
  if (!REQUEST_ACTIONS.includes(action) || action === "expire") {
    return NextResponse.json({ error: "action must be accept, decline, cancel or approve." }, { status: 400 });
  }
  const result = await actOn(member, id, action, body);
  if (result.error) {
    return NextResponse.json(
      { error: result.error, refused: result.refused || undefined, request: result.request || undefined },
      { status: result.status || 400 },
    );
  }
  return NextResponse.json({ ok: true, request: result.request });
}
