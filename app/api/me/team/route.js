// app/api/me/team/route.js
//
// The team directory for the More tab: everyone the chat directory would
// let the caller message (lib/company/chat/store.js directoryFor — the ONE
// roster rule), with the job title from the Worker row and a phone number
// where the roster has one. Nobody from another company; nothing about pay.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { directoryFor } from "@/lib/company/chat/store";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const q = new URL(request.url).searchParams.get("q") || "";
  const [people, workers] = await Promise.all([
    directoryFor(member, { q }),
    db.worker.findMany({
      where: { companyId: member.companyId, active: true },
      select: { id: true, name: true, title: true, phone: true, email: true, userId: true },
    }),
  ]);
  const byUser = new Map(workers.filter((w) => w.userId).map((w) => [w.userId, w]));
  const members = await db.member.findMany({
    where: { companyId: member.companyId, id: { in: people.map((p) => p.id) } },
    select: { id: true, userId: true, user: { select: { image: true } } },
  });
  const memberById = new Map(members.map((m) => [m.id, m]));
  const seenWorker = new Set();
  const out = people.map((p) => {
    const m = memberById.get(p.id);
    const w = m?.userId ? byUser.get(m.userId) : null;
    if (w) seenWorker.add(w.id);
    return { id: p.id, kind: "member", name: p.name, email: p.email, title: p.title || w?.title || null, label: p.label, phone: w?.phone || null, image: m?.user?.image || null, isYou: p.isYou };
  });
  // Roster rows with no login — the yard hand — still belong in a team
  // directory; they cannot be messaged, and the row says so by having no
  // chat link.
  const needle = q.trim().toLowerCase();
  for (const w of workers) {
    if (w.userId || seenWorker.has(w.id)) continue;
    if (needle && !w.name.toLowerCase().includes(needle)) continue;
    out.push({ id: `w_${w.id}`, kind: "worker", name: w.name, email: w.email, title: w.title, label: null, phone: w.phone, image: null, isYou: false });
  }
  out.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  return NextResponse.json({ people: out });
}
