// app/api/plan-reads/[id]/run/route.js
//
// POST — start the paid read (or pick a running one back up). The credit is
// HELD here, before any model is called, at the ceiling the screen showed
// (lib/planRead/billing.js); the work then runs under after() and the
// screen polls GET /api/plan-reads/[id] for progress. A company without the
// credit gets the numbers and the top-up offer, never a silent no.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse, after } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { can } from "@/lib/permissions";
import { publicTopupOffer } from "@/lib/ai/topupOffer";
import { startRead, advanceRead } from "@/lib/planRead/run";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "run a drawing read");
  if (denied) return denied;

  const started = await startRead({ planReadId: id, companyId: member.companyId, userId: member.userId || null });
  if (!started.ok) {
    if (started.error === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (started.error === "files_unreadable") {
      // The set WAS added; FieldQuo could not read it. Say which file and
      // what to do, never "add a drawing set first".
      const tooBig = (started.reasons || []).includes("too_large");
      return NextResponse.json(
        {
          error: `FieldQuo couldn't read ${started.names.join(", ")}. ${
            tooBig
              ? "The file is larger than can be read in one piece — upload it again and it will be split into parts."
              : "Check that it opens on your computer and isn't password-protected, then upload it again (as a PDF, .xlsx or .csv)."
          } Nothing was charged.`,
          code: "files_unreadable",
          names: started.names,
        },
        { status: 400 },
      );
    }
    if (started.error === "nothing_for_scope") {
      return NextResponse.json(
        {
          error: `None of these sheets is for ${started.trades.join(", ")} — the services this read is for. Add the sheets that show that work, or change the services. Nothing was charged.`,
          code: "nothing_for_scope",
        },
        { status: 400 },
      );
    }
    if (started.error === "nothing_to_read") {
      return NextResponse.json({ error: "Add a drawing set, a scope sheet or photos first — or, if nothing is new, use the chat to change the read.", code: "nothing_to_read" }, { status: 400 });
    }
    if (started.error === "feature_unavailable") {
      return NextResponse.json({ error: "The deep read isn't available on your account yet.", code: "feature_unavailable" }, { status: 403 });
    }
    if (started.error === "insufficient_credit") {
      return NextResponse.json(
        {
          error:
            `This read needs up to ${started.needCents} credits ($${(started.needCents / 100).toFixed(2)}) of AI credit. ` +
            `Your balance is ${started.balanceCents} — add at least ${started.shortfallCents} first.`,
          code: "insufficient_credit",
          needCents: started.needCents,
          balanceCents: started.balanceCents,
          shortfallCents: started.shortfallCents,
          topup: publicTopupOffer(started.shortfallCents, can(member.role, "user:manage")),
        },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: "Couldn't start the read just now. Nothing was charged." }, { status: 502 });
  }

  after(() => advanceRead(id, { companyId: member.companyId, userId: member.userId || null }));
  return NextResponse.json({ ok: true, heldCents: started.heldCents || null, resumed: Boolean(started.resumed) }, { status: 202 });
}
