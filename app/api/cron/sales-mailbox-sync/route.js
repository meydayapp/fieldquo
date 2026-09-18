// app/api/cron/sales-mailbox-sync/route.js
//
// Every minute: pull what is new in each connected rep mailbox.
//
// ══ Why a cron and not IDLE ═══════════════════════════════════════════════
//
// IMAP IDLE pushes the instant a message arrives and needs a socket that
// stays open. A Vercel function ends; its socket ends with it. So the
// portal polls by UID once a minute — lib/sales/mailbox/sync.js — and a
// minute is the honest latency the inbox states nowhere as "live".
//
// ══ One function, every mailbox, in sequence ══════════════════════════════
//
// Six mailboxes today; a sync with nothing new is two IMAP round trips
// (~1s). A sync with a backlog is capped at FETCH_BATCH messages per folder
// (lib/sales/mailbox/imap.js), so one invocation is bounded at roughly
// mailboxes × 2 folders × 40 messages × parse+upload — well inside the 300s
// declared below, and the next tick takes the rest. Sequential rather than
// parallel because the uploads and the database are shared; a rep's mail
// arriving a few seconds later is better than six syncs contending.
//
// The lock on each row (syncingSince) is what makes an overlapping tick
// safe: the second one is told "busy" and moves on.
export const maxDuration = 300;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { syncMailbox } from "@/lib/sales/mailbox/sync";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const mailboxes = await db.salesMailbox.findMany({
    where: { status: { in: ["connected", "error"] }, secret: { not: null }, salesRep: { active: true } },
    orderBy: { lastSyncAt: { sort: "asc", nulls: "first" } },
  });

  const results = [];
  for (const mailbox of mailboxes) {
    // An "error" row is retried by the sync too: a network blip at 09:00
    // should not need the owner's Retry at 09:01. A refused password stays
    // "error" until the owner acts, because the sync sets it back on the
    // same failure.
    const r = await syncMailbox(db, mailbox).catch((err) => ({ ok: false, reason: "threw", error: String(err?.message || err) }));
    results.push({ salesRepId: mailbox.salesRepId, address: mailbox.address, ...r });
  }

  return NextResponse.json({ mailboxes: results.length, results });
}
