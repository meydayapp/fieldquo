// app/api/platform/jennifer/conversations/[id]/route.js
//
// One conversation, for the operator: read the whole thread, reply into it,
// or mark it resolved. Staff-only. See the list route's header for why a
// reply here is the deliberate exception, not a hole, in non-negotiable #3.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { appendMessage } from "@/lib/ai/jennifer/conversations";

async function loadWithCompanyName(id) {
  const conversation = await db.jenniferConversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) return null;

  const company = await db.company.findUnique({
    where: { id: conversation.companyId },
    select: { name: true },
  });

  return { ...conversation, companyName: company?.name || "(deleted company)" };
}

export async function GET(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const conversation = await loadWithCompanyName(id);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ conversation });
}

/**
 * A reply, or a status change, or both — the operator screen sends whichever
 * it needs. A reply with no explicit `resolve` leaves the conversation
 * "escalated" (still theirs to keep working); `resolve: true` closes it out,
 * which reopenIfResolved() in conversations.js will undo automatically the
 * next time the contractor writes into it — a resolved thread that gets a
 * new message from the company side becomes a fresh "unresolved" one that
 * Jennifer answers again, not a dead end.
 */
export async function POST(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { reply, resolve } = await request.json().catch(() => ({}));

  const conversation = await db.jenniferConversation.findUnique({ where: { id } });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trimmed = typeof reply === "string" ? reply.trim() : "";
  if (trimmed) {
    if (trimmed.length > 8000) {
      return NextResponse.json({ error: "Reply is too long." }, { status: 400 });
    }
    await appendMessage({ conversationId: id, role: "operator", content: trimmed });
  } else if (!resolve) {
    return NextResponse.json({ error: "reply or resolve is required" }, { status: 400 });
  }

  const nextStatus = resolve ? "resolved" : "escalated";
  await db.jenniferConversation.update({ where: { id }, data: { status: nextStatus } });

  const conversationOut = await loadWithCompanyName(id);
  return NextResponse.json({ conversation: conversationOut });
}
