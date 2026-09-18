// app/api/sales/queue/people/route.js
//
// The name a rep heard on the phone — "ask for Maria, she owns it" — kept
// on the prospect as a ProspectPerson with source "typed" and the rep's id.
//
// ══ Scoped like every other write from the queue ══════════════════════════
//
// The prospect is re-read through queueWhere(rep.id): a rep can only name
// somebody on a row they hold, and a row another rep holds resolves to
// nothing rather than to a 403 that confirms it exists. The typed row is
// created, never updated (lib/sales/intel/people.js): a second name from
// the same rep is a second row, and the card leads with the newest typed
// one. What BBB or a register said stays beside it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireQueueRep } from "@/lib/sales/queueGate";
import { queueWhere } from "@/lib/sales/prospectView";
import { PEOPLE_SELECT, recordPeople, tidyPersonName, whoToAskFor } from "@/lib/sales/intel/people";

const MAX_NAME = 120;
const MAX_ROLE = 80;
const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request) {
  const { rep, refusal } = await requireQueueRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("Expected a JSON body.");
  const prospectId = typeof body.prospectId === "string" ? body.prospectId.trim() : "";
  if (!prospectId) return bad("prospectId is required.");

  const prospect = await db.prospect.findFirst({
    where: { id: prospectId, ...queueWhere(rep.id, { now: new Date() }) },
    select: { id: true, doNotContactAt: true },
  });
  if (!prospect) return bad("That record is not yours to work.", 404);
  if (prospect.doNotContactAt) return bad("This business asked not to be contacted; nothing more is recorded for them.", 409);

  const person = tidyPersonName(String(body.name ?? "").slice(0, MAX_NAME));
  if (!person?.name || person.name.length < 2) return bad("Type the name you heard — at least a first name.");
  const role = typeof body.role === "string" && body.role.trim() ? body.role.trim().slice(0, MAX_ROLE) : null;

  const r = await recordPeople({
    db,
    prospectId,
    people: [{ name: person.name, givenName: person.givenName, role }],
    source: "typed",
    sourceUrl: null,
    seenAt: new Date(),
    detector: "rep.typed",
    typedBySalesRepId: rep.id,
  });
  const people = await db.prospectPerson.findMany({ where: { prospectId }, select: PEOPLE_SELECT, orderBy: { seenAt: "desc" } });
  return NextResponse.json({ ok: true, added: r.added, who: whoToAskFor(people), people });
}
