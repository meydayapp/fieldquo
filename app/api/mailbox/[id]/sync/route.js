// app/api/mailbox/[id]/sync/route.js
//
// POST — "Sync now" on the card: one time-boxed tick for this mailbox, the
// same function the cron runs. Returns what it did so the card can say
// "3 filed, 41 skipped" rather than a spinner that stops.
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { rateLimit } from "@/lib/rateLimit";
import { canManage } from "@/lib/mailbox/connections";
import { syncMailbox } from "@/lib/mailbox/sync";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const limited = rateLimit(request, "mailbox-sync-now", { limit: 6, windowMs: 10 * 60 * 1000, message: "The mailbox is already being read. Give it a few minutes." });
  if (limited) return limited;

  const row = await db.mailboxConnection.findFirst({ where: { id, companyId: member.companyId } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManage(member, row)) return NextResponse.json({ error: "Only the person who connected this mailbox, or an owner or admin, can sync it." }, { status: 403 });
  if (row.status === "disconnected") return NextResponse.json({ error: "This mailbox is disconnected. Connect it again first." }, { status: 409 });

  const result = await syncMailbox(db, row, { budgetMs: 40 * 1000 });
  if (!result.ok && result.reason === "busy") return NextResponse.json({ ok: false, busy: true, filed: 0, skipped: 0 });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error || "The sync did not finish.", code: result.reason, filed: result.filed, skipped: result.skipped }, { status: 502 });
  return NextResponse.json({ ok: true, filed: result.filed, skipped: result.skipped, held: result.held });
}
