// app/api/quotes/new/presentation/route.js
//
// The Presentation panel for a quote that does not exist yet — the builder's
// Presentation tab on /app/quotes/new.
//
// Read-only on purpose, and that is the whole point of it: everything behind
// the panel at this stage is COMPANY-level (the section defaults, the story,
// the gallery, the document library) and is edited in Settings. The per-quote
// overrides the estimator sets here are three JSON fields held in builder
// state and written by POST /api/quotes with the rest of the quote, so there
// is nothing to save before the quote is saved and no half-created row.
//
// Same answer shape as /api/quotes/[id]/presentation, from the same function
// (lib/proposal/panel.js), with `plan` null and `waivers` empty — the two
// pieces that genuinely need a saved quote. The panel prints a line saying so.
//
// "new" is a static segment, so it is matched ahead of the sibling
// /api/quotes/[id]/presentation. Quote ids are cuids, so no quote is reachable
// at this path.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { presentProposalPanel } from "@/lib/proposal/panel";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // Reading the company's own defaults is a read, gated like the GET next
  // door; the create itself is gated by POST /api/quotes.
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_only", "see quotes");
  if (denied) return denied;
  // The language the builder is composing in, so the document titles and
  // service names on the panel are the ones THIS quote will carry
  // (non-negotiable #6). Absent falls back to the company default.
  const language = new URL(request.url).searchParams.get("language") || null;
  return NextResponse.json(await presentProposalPanel({ member, quote: null, language }));
}
