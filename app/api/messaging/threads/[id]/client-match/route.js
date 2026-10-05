// app/api/messaging/threads/[id]/client-match/route.js
//
// The website-chat client match (lib/aiEmployee/webChatMatch.js), as the
// conversation shows it:
//
//   GET  → the live match on this thread, if the AI team made one: which
//          client, on what (email / phone / name), and why — or null.
//   POST { action: "undo", matchId } → "Not this client": the thread's
//          client link is removed (only while it still points at that
//          client), the match is marked undone, and the pair is never
//          proposed again.
//
// The same rung as linking a client by hand (PATCH on the thread:
// requests view_create_edit) — undoing a link is editing one. Read-only
// support may look and never undo.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { undoWebMatch } from "@/lib/aiEmployee/webChatMatch";

async function graded(member) {
  const full = member.id ? await loadEnforceableMember(db, member.id) : null;
  return { ...member, permissions: full?.permissions ?? null };
}

async function gate(member, level, what) {
  try {
    requireLevel(await graded(member), "requests", level, what);
    return null;
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation) {
    const refused = await gate(member, "view_only", "see a conversation");
    if (refused) return refused;
  }
  const thread = await db.messageThread.findFirst({ where: { id: String(id || ""), companyId: member.companyId }, select: { id: true, clientId: true } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!thread.clientId) return NextResponse.json({ match: null });
  const match = await db.threadClientMatch.findFirst({
    where: { companyId: member.companyId, threadId: thread.id, clientId: thread.clientId, status: "linked" },
    orderBy: { createdAt: "desc" },
    select: { id: true, clientId: true, confidence: true, matchedOn: true, why: true, createdAt: true },
  });
  if (!match) return NextResponse.json({ match: null });
  const client = await db.client.findFirst({ where: { id: match.clientId, companyId: member.companyId }, select: { id: true, name: true } });
  return NextResponse.json({
    match: {
      id: match.id,
      clientId: match.clientId,
      clientName: client?.name || null,
      confidence: match.confidence,
      matchedOn: Array.isArray(match.matchedOn) ? match.matchedOn : [],
      why: match.why || null,
      createdAt: match.createdAt,
    },
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) return NextResponse.json({ error: "Support sessions are read-only." }, { status: 403 });
  const refused = await gate(member, "view_create_edit", "update a conversation");
  if (refused) return refused;
  const body = await request.json().catch(() => ({}));
  if (body?.action !== "undo" || typeof body?.matchId !== "string") {
    return NextResponse.json({ error: "Say which match to undo.", reason: "bad_action" }, { status: 400 });
  }
  const user = member.userId ? await db.user.findUnique({ where: { id: member.userId }, select: { name: true } }).catch(() => null) : null;
  const res = await undoWebMatch({
    prisma: db,
    companyId: member.companyId,
    threadId: String(id || ""),
    matchId: body.matchId,
    userId: member.userId || null,
    actorName: user?.name || null,
  });
  if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: res.status || 404 });
  return NextResponse.json({ ok: true, unlinked: Boolean(res.unlinked), already: Boolean(res.already) });
}
