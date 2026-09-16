// app/api/sales/agency/route.js
//
// A call-centre agency's team: the list, and adding one of its own reps.
//
// ══ Who this is for ═══════════════════════════════════════════════════════
//
// A SalesRep of kind "agency" (lib/sales/agency.js — the header quotes the
// owner's brief). Anybody else is refused with 403 in the route, not hidden
// by the shell: the My team row is drawn only for an agency, and hiding a
// row is not access control.
//
// ══ The one write, and why it is allowed under a read-only portal ═════════
//
// POST creates an employee. lib/sales/gate.js refuses every write, and its
// reason — a rep who can write their own row can pay themselves — does not
// reach this one: the agency writes ANOTHER row, with the kind, engagement,
// manager and plan forced to values the agency does not choose, and the pay
// that row earns goes to the agency under terms the owner set. The write is
// made by lib/sales/agency.js's createAgencyRep, declared by name in
// scripts/check-sales-auth.mjs, and the forced values are asserted against
// the recorded write by scripts/check-sales-agency.mjs. The route goes
// through requireOutreachRep — the portal's one write door — the way
// /api/sales/payout does.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAppOrigin } from "@/lib/appUrl";
import { requireSalesRep } from "@/lib/sales/gate";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { agencyTeam, createAgencyRep, isAgency } from "@/lib/sales/agency";
import { queueCountsFor } from "@/lib/sales/reassign";
import { parseSellsIn } from "@/lib/sales/leadLanguage";

const NOT_AGENCY = { error: "Only an agency account has a team.", code: "not_agency" };

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  if (!isAgency(rep)) return NextResponse.json(NOT_AGENCY, { status: 403 });

  const now = new Date();
  const team = await agencyTeam({ agencyId: rep.id, origin: getAppOrigin(request), now });
  // What each employee holds — the same counts the deactivation gate judges
  // by, so the screen can say "release or move their 12 prospects first"
  // before the button is pressed rather than only after the 409.
  const queue = await queueCountsFor({ db, repIds: team.map((m) => m.id), now });

  return NextResponse.json({
    agency: { id: rep.id, name: rep.name, email: rep.email },
    team: team.map((m) => ({ ...m, queue: queue.get(m.id) || null })),
    serverNow: now.toISOString(),
  });
}

export async function POST(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  if (!isAgency(rep)) return NextResponse.json(NOT_AGENCY, { status: 403 });

  const body = await request.json().catch(() => ({}));
  let sellsIn = null;
  if ("sellsIn" in body) {
    const parsed = parseSellsIn(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    sellsIn = parsed.sellsIn;
  }

  // Name, email, languages. Nothing else is read from the body — not a
  // kind, not an engagement, not a plan, not a manager — so a client that
  // sends them is ignored rather than trusted. See lib/sales/agency.js.
  const result = await createAgencyRep({
    agency: rep,
    name: body.name,
    email: body.email,
    sellsIn,
    language: typeof body.language === "string" ? body.language : null,
    request,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json(
    {
      rep: {
        ...result.rep,
        signupLink: result.rep.code ? `${getAppOrigin(request)}/signup?sales=${encodeURIComponent(result.rep.code)}` : null,
      },
      invite: { sent: result.inviteSent, error: result.inviteError },
    },
    { status: 201 },
  );
}
