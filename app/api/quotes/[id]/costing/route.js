// app/api/quotes/[id]/costing/route.js
//
// What one quote was estimated to cost, and what margin that left.
//
// ── Why this is not part of GET /api/quotes/[id] ───────────────────────────
//
// Because that response is spread into a PDF and, through the share token,
// reaches a homeowner's browser. The whole reason QuoteCosting is a separate
// row is that nothing joins it by accident; hanging it off the quote's own GET
// would hand that guarantee straight back. A caller has to ask for the cost
// deliberately, and prove it may see it.
//
// ── Saved, or recomputed and honest about it ───────────────────────────────
//
// `saved: true` means these are the figures the quote was actually priced at,
// stored server-side when it was saved. `saved: false` means nothing was
// stored — an older quote, or one raised by someone who never opened the cost
// panel — and the figures were worked out just now from the quote's stored
// takeoffs against TODAY's price book. That is a different number from the one
// the estimator saw, and the flag is how the UI can say so rather than passing
// a fresh calculation off as a record.
//
// ── Saving is not here ─────────────────────────────────────────────────────
//
// The costing is written by POST /api/quotes and PATCH /api/quotes/[id], in
// the same write as the quote itself. A separate save button would let someone
// edit the crew, press Save on the quote, and lose them.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle } from "@/lib/permissions/enforce";
import { loadQuoteCosting } from "@/lib/costing/quoteCostEstimate";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise.
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Two gates, in this order: may they see the QUOTE at all, and then may they
  // see what it cost. jobCosting alone would have answered "yes" to a member
  // who is not allowed the document the costing belongs to.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_only",
    "see quotes",
  );
  if (denied) return denied;

  // The same gate as the job's and the invoice's cost panels. 403, not a
  // redacted body of zeroes: someone who may not see what a job costs must be
  // told they may not, because a panel full of zeroes reads as a job that cost
  // nothing and is the more dangerous of the two lies.
  if (!hasToggle(full, "jobCosting")) {
    return NextResponse.json(
      { error: "You don't have access to job costing." },
      { status: 403 },
    );
  }

  // ── Saved wins, always, and nothing is recomputed ────────────────────────
  //
  // Not even partially. Recomputing one field — the overhead, say, because the
  // company's capacity figure has improved since — would put a figure on screen
  // that changes while nobody touches the quote, sitting next to figures that
  // don't. The row's existence is the flag: once a quote has been costed,
  // today's rate card stops having an opinion about it.
  //
  // The read itself lives in lib/costing/quoteCostEstimate.js now, because the
  // AI review measures the margin off the same object (lib/ai/quoteReview.js)
  // — two readers of one row, one function, so they cannot disagree.
  const costing = await loadQuoteCosting({
    companyId: member.companyId,
    quoteId: id,
  });
  if (!costing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(costing);
}
