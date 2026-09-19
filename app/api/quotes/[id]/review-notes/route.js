// app/api/quotes/[id]/review-notes/route.js
//
// Append to a quote's INTERNAL "Notes for review" — Quote.reviewNotes, the
// box the client never sees — and save it at once.
//
// ── Why a route of its own, rather than the builder's Save ─────────────────
//
// "Add to notes for review" under the deep photo read did nothing the person
// pressing it could see: it appended to a textarea two screens up that only
// exists once it has text, made no request, and was lost on reload unless the
// builder's own Save was pressed afterwards. The owner reported it as doing
// nothing, which from where they stood it did.
//
// The obvious fix — PATCH /api/quotes/[id] with reviewNotes — would trip the
// builder's stale-write guard on its NEXT save: that form posts every field
// against the updatedAt it loaded, and a PATCH in between moves it. So this is
// an APPEND on one internal column, done here so the server merges it onto
// whatever is stored (not onto what the screen loaded a while ago), and the
// updatedAt it produces is handed back for the builder to carry forward.
//
// Only ever appends; never replaces. Two reads on two days both survive, and so
// does whatever a phone draft put there first.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";

/** The one rule: a blank current note takes the text; anything else gets it under a blank line. */
export function appendReviewNote(current, text) {
  const add = String(text || "").trim();
  if (!add) return String(current || "");
  const base = String(current || "").trimEnd();
  return base ? `${base}\n\n${add}` : add;
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same rung as PATCH /api/quotes/[id]: writing a note on a quote is editing
  // the quote.
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "edit quotes");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const text = typeof body?.append === "string" ? body.append.trim().slice(0, 4000) : "";
  if (!text) return NextResponse.json({ error: "Nothing to add." }, { status: 400 });

  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, reviewNotes: true },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.quote.update({
    where: { id: quote.id },
    data: { reviewNotes: appendReviewNote(quote.reviewNotes, text) },
    select: { reviewNotes: true, updatedAt: true },
  });

  return NextResponse.json({ reviewNotes: updated.reviewNotes, updatedAt: updated.updatedAt });
}
