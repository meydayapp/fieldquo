// app/api/plan-reads/[id]/messages/route.js
//
// POST — one chat turn on a finished drawing read (lib/planRead/chat.js).
// The estimator's message, the reply, what changed and the new project model
// are written in ONE transaction, so the saved history and the overview can
// never disagree. Charged per call from the AI credit through the wallet
// meter; a turn that produced nothing usable is not charged.
export const runtime = "nodejs";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { can } from "@/lib/permissions";
import { publicTopupOffer } from "@/lib/ai/topupOffer";
import { featureAllowsSpend } from "@/lib/features/gate";
import { loadPlanRead } from "@/lib/planRead/load";
import { chatTurn } from "@/lib/planRead/chat";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "change a drawing read");
  if (denied) return denied;

  const read = await loadPlanRead(id, member.companyId);
  if (!read) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (read.status === "reading") return NextResponse.json({ error: "The read is still running. Ask when it finishes." }, { status: 409 });
  if (!(await featureAllowsSpend(member.companyId, "ai_vision"))) {
    return NextResponse.json({ error: "The deep read isn't available on your account yet.", code: "feature_unavailable" }, { status: 403 });
  }

  const raw = await request.json().catch(() => ({}));
  const turnId = randomUUID();
  const turn = await chatTurn(
    {
      read,
      companyId: member.companyId,
      userId: member.userId || null,
      message: raw?.message,
      history: (read.messages || []).map((m) => ({ role: m.role, text: m.text })),
    },
    { turnId },
  );

  if (!turn.ok) {
    if (turn.error === "empty") return NextResponse.json({ error: "Type a message first." }, { status: 400 });
    if (turn.error === "not_read") return NextResponse.json({ error: "Run the read first — the chat changes its overview." }, { status: 409 });
    if (turn.error === "no_credit") {
      return NextResponse.json(
        {
          error: turn.reason || "Your AI credit is empty. Top up to keep chatting.",
          code: "no_credit",
          needCents: turn.needCents,
          balanceCents: turn.balanceCents,
          topup: publicTopupOffer(Math.max(0, (turn.needCents || 0) - (turn.balanceCents || 0)), can(member.role, "user:manage")),
        },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: "Couldn't answer just now. Nothing was charged — try again." }, { status: 502 });
  }

  await db.$transaction([
    db.planReadMessage.create({
      data: { companyId: member.companyId, planReadId: read.id, role: "user", text: turn.message, userId: member.userId || null },
    }),
    db.planReadMessage.create({
      data: {
        companyId: member.companyId,
        planReadId: read.id,
        role: "assistant",
        text: turn.reply,
        changes: [...turn.changes, ...turn.dropped.map((x) => `Not applied: ${x}`)],
        usage: turn.usage,
        chargedCents: turn.chargedCents,
      },
    }),
    db.planRead.updateMany({ where: { id: read.id, companyId: member.companyId }, data: { model: turn.model } }),
  ]);

  return NextResponse.json({ reply: turn.reply, changes: turn.changes, dropped: turn.dropped, chargedCents: turn.chargedCents, usage: turn.usage, opened: turn.opened });
}
