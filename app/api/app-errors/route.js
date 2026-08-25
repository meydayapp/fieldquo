// app/api/app-errors/route.js
//
// A crash in the back office, recorded where support can see it.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// A quote page threw and the owner saw "This page couldn't load. Reload to try
// again, or go back." Nothing was written anywhere: PlatformErrorLog only ever
// received SERVER failures, and a React render error happens in a browser we do
// not own. Diagnosing it meant asking the person who hit it to open a console.
//
// So the app's error boundary posts here. Same table, area "app", so it shows
// up in the platform console beside every other failure rather than in a
// second place nobody checks.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { recordError } from "@/lib/platform/errorLog";

export async function POST(request) {
  // Authenticated only. This writes to the support-facing error table, and an
  // open endpoint that appends to it is a way to bury real failures under
  // noise — the exact thing the helper's own comment warns about.
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const message = String(body?.message || "").slice(0, 500);
  if (!message) return NextResponse.json({ ok: true });

  await recordError({
    area: "app",
    code: body?.digest ? String(body.digest).slice(0, 60) : "render_error",
    message,
    companyId: member.companyId,
    detail: {
      // The route that broke, which is the first question anyone asks. Taken
      // from the client rather than the referer: a boundary catches the render
      // of the page you are ON, and the referer is the page you came from.
      path: String(body?.path || "").slice(0, 300),
      digest: body?.digest ? String(body.digest).slice(0, 120) : null,
      // Trimmed. A full minified stack is a wall nobody reads, and the top
      // frames are where the answer is.
      stack: String(body?.stack || "")
        .split("\n")
        .slice(0, 12)
        .join("\n")
        .slice(0, 2000),
      userId: member.userId,
    },
  });

  return NextResponse.json({ ok: true });
}
