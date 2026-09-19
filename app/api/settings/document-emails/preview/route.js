// app/api/settings/document-emails/preview/route.js
//
// POST { kind, language, copy?: { slots, sentMode, canvas } | null }
//   → { subject, html, text, document: { number, sample }, sectionsOmitted? }
//
// The real builder against the company's most recent document — see
// lib/email/documentEmailPreview.js. `copy` is whatever the editor holds,
// saved or not, so the picture is of the words on screen; `null` previews
// the original. Reads only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { documentEmailKind, ORIGINAL_LANGUAGES } from "@/lib/email/documentEmailWording";
import { renderDocumentEmailPreview } from "@/lib/email/documentEmailPreview";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  if (!documentEmailKind(body.kind)) {
    return NextResponse.json({ error: "Unknown document email" }, { status: 400 });
  }
  const language = ORIGINAL_LANGUAGES.includes(body.language) ? body.language : "en";
  const copy =
    body.copy && typeof body.copy === "object"
      ? {
          slots: body.copy.slots && typeof body.copy.slots === "object" ? body.copy.slots : {},
          sentMode: body.copy.sentMode === "canvas" ? "canvas" : "blocks",
          canvas: body.copy.canvas && typeof body.copy.canvas === "object" ? body.copy.canvas : null,
        }
      : null;

  try {
    const out = await renderDocumentEmailPreview(db, {
      companyId: member.companyId,
      kind: body.kind,
      language,
      copy,
      request,
    });
    // The preview iframe must not navigate away on a click — same inert-link
    // rule the block editor's preview uses.
    const html = out.html.replace(
      "</head>",
      "<style>a{pointer-events:none !important;cursor:default !important;}</style></head>",
    );
    return NextResponse.json({ ...out, html });
  } catch (err) {
    console.error("[document-emails preview] failed:", err);
    return NextResponse.json({ error: err?.message || "Couldn't render the preview." }, { status: 500 });
  }
}
