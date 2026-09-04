// app/api/sales/playbook/route.js
//
// The script, for the rep who is about to say it out loud.
//
// ══ Why this exists beside the superadmin preview ═════════════════════════
//
// /api/platform/sales/playbooks/preview runs the same engine, and it is
// superadmin-only. So until now the objection library, the nine stages and the
// per-prospect talking points were reachable ONLY by the people who never make
// a call, and the closer on their fortieth dial of the day worked from memory.
// lib/sales/playbook/objections.js says a label "is what a rep scans for
// mid-call" — this is the route that finally puts it in front of one.
//
// ══ Read-only, and structurally so ════════════════════════════════════════
//
// GET only, and `assignVariant: false`. The queue gate declares exactly one
// writable model (REP_QUEUE_WRITES = ["prospect"]) and check-prospect-ui
// asserts that list stays one model long, so a route sitting behind it may not
// create a SalesPlaybookAssignment on a page load. That is not a workaround —
// assembleProspectPlaybook's own comment argues it is the correct place for the
// refusal: a rep who opens a prospect card has not phoned anybody, and §38 asks
// for the arm to be fixed before the CALL, which is the dial POST on
// /api/sales/calls, not this.
//
// ══ Scoped to a prospect this rep holds ═══════════════════════════════════
//
// assembleProspectPlaybook takes a bare id and reads the row itself — it was
// written for a superadmin who may look at anything. So the id is resolved
// through queueWhere() FIRST and a miss returns 404 before the engine runs. A
// rep who can pull a script for an unclaimed prospect can read the whole
// researched pool one id at a time, which is the exact thing the queue route's
// header explains there is no endpoint for.
//
// ══ No model is called, ever, on this path ════════════════════════════════
//
// `useAi: false`. Two reasons and either would be enough. A generated sentence
// costs money and the rep opens this on every prospect in the queue; and it
// would put latency between claiming a prospect and being able to dial. The
// deterministic path renders the rule's own evidence-cited sentences — plainer
// copy, never a blank panel, the property lib/site/generateSite.js holds for
// the same reason. Nothing here touches lib/ai/provider.js, so there is no
// quota to check and no top-up to offer.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireQueueRep } from "@/lib/sales/queueGate";
import { queueWhere } from "@/lib/sales/prospectView";
import { assembleProspectPlaybook } from "@/lib/sales/playbook/assemble";

export async function GET(request) {
  const { rep, refusal } = await requireQueueRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const prospectId = (new URL(request.url).searchParams.get("prospectId") || "").trim().slice(0, 40);
  if (!prospectId) {
    return NextResponse.json({ error: "Which prospect?" }, { status: 400 });
  }

  const now = new Date();
  const mine = await db.prospect.findFirst({
    where: { id: prospectId, ...queueWhere(rep.id, { now }) },
    select: { id: true },
  });
  if (!mine) {
    return NextResponse.json(
      { error: "That prospect is not yours to work. Claims are one rep at a time." },
      { status: 404 },
    );
  }

  const result = await assembleProspectPlaybook({
    prospectId,
    rep: { id: rep.id, name: rep.name },
    useAi: false,
    persist: false,
    assignVariant: false,
  });
  if (!result.found) {
    return NextResponse.json({ error: "No prospect with that id." }, { status: 404 });
  }

  // Shaped rather than passed through. `selection.trace` is the superadmin's
  // answer to "why does my playbook never open?" and it is forty rows of
  // refusals; what a rep needs is the one that DID open and the sentence saying
  // why. The experiment block is dropped entirely — no arm was assigned here,
  // and reporting a variantKey of null beside a running experiment would read
  // as a derivation that failed.
  return NextResponse.json({
    prospect: {
      id: result.prospect.id,
      businessName: result.prospect.businessName,
    },
    playbook: result.selection.selected
      ? {
          key: result.selection.selected.key,
          name: result.selection.selected.name,
          selectorLabel: result.selection.selectorLabel,
          describe: result.selection.selected.describe,
          facts: result.selection.selected.facts || [],
        }
      : null,
    // Present exactly when `playbook` is null, and it is the true sentence — a
    // prospect nothing has crawled has no script, and inventing one is a rep
    // phoning a stranger with words that claim to know something about them.
    noPlaybookReason: result.selection.selected ? null : result.selection.reasonText,
    script: result.script,
    objections: result.objections,
    talkingPoints: result.talkingPoints,
    // Carried up so a three-line script off a business whose site timed out
    // reads as "we could not look" rather than as a confident three.
    unchecked: result.unchecked,
    generation: {
      source: result.generation.source,
      degraded: result.generation.degraded,
      reasonText: result.generation.reasonText,
    },
    // Computed from the generated Prisma client, never asserted. While the
    // playbook tables are absent these words are the built-in starter library
    // and nobody can edit them — which is what a rep needs to know before they
    // report a line as wrong.
    store: result.store,
  });
}
