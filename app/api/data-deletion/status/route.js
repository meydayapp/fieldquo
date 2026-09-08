// app/api/data-deletion/status/route.js
//
// GET ?code=FQ-DEL-XXXXXX → { status, receivedAt, completedAt }.
//
// Public, because the reference is what Meta hands the person as a link
// (`url` in the callback response) and what the acknowledgement email tells
// them to keep. The whole design question is what a six-character code that
// anybody can type should unlock, and the answer is: dates and a status, and
// nothing about WHO asked. publicStatus() in lib/dataDeletion/requests.js is
// the projection; this route never selects the row's personal columns at all,
// so a future field added to the model is not returned by accident either.
//
// Rate-limited, because a guessable code plus an unthrottled endpoint is an
// enumeration oracle even when the answer is only a status.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { normaliseConfirmationCode, publicStatus } from "@/lib/dataDeletion/requests";

export async function GET(request) {
  const limited = rateLimit(request, "data-deletion-status", {
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const code = normaliseConfirmationCode(searchParams.get("code"));
  if (!code) {
    return NextResponse.json(
      { error: "That doesn't look like a reference. It reads FQ-DEL- followed by six characters." },
      { status: 400 },
    );
  }

  const row = await db.dataDeletionRequest.findUnique({
    where: { confirmationCode: code },
    select: { status: true, receivedAt: true, completedAt: true },
  });
  if (!row) {
    return NextResponse.json({ error: "No request with that reference." }, { status: 404 });
  }

  return NextResponse.json({ confirmationCode: code, ...publicStatus(row) });
}
