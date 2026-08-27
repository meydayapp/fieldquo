// app/api/quotes/received/[token]/import/route.js
//
// Perform the import: pull the quote at [token] (another company's) into one of
// the viewer's own quotes as a marked-up subcontractor cost line. The browser
// posts only the target quote id, a markup percent and a display choice — every
// money figure is derived server-side in performImport from the stored source
// quote. See lib/quotes/importQuote.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { performImport, ImportError } from "@/lib/quotes/importQuote";
import { deriveCommitStatus, importerView } from "@/lib/quotes/importedStatus";
import { recordActivity } from "@/lib/activity/log";

export async function POST(request, { params }) {
  const { token } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // A write, so read-only impersonation (userId null) is refused here too.
  if (!member.userId)
    return NextResponse.json(
      { error: "Sign in to add this to your project." },
      { status: 401 },
    );

  // Writes a marked-up cost line onto one of the viewer's own quotes, which is
  // a quote edit — and had no grid check at all, only a session.
  const { response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_create_edit",
    "edit quotes",
  );
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const { targetQuoteId, markupPercent, display, label } = body;
  if (!targetQuoteId)
    return NextResponse.json(
      { error: "Choose which of your quotes to add it to." },
      { status: 400 },
    );

  const [sourceQuote, targetQuote, targetCompany] = await Promise.all([
    db.quote.findFirst({
      where: { shareToken: token },
      include: {
        company: { select: { name: true } },
        scopeGroups: true,
      },
    }),
    // Ownership enforced in the query: a target quote id that isn't the viewer's
    // simply doesn't resolve.
    db.quote.findFirst({
      where: { id: targetQuoteId, companyId: member.companyId },
      include: { scopeGroups: true },
    }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { taxRate: true },
    }),
  ]);

  try {
    const result = await performImport({
      db,
      member,
      sourceQuote,
      targetQuote,
      targetCompany,
      markupPercent,
      display,
      label,
    });

    await recordActivity(member, {
      action: "quote.cost_imported",
      entityType: "quote",
      entityId: targetQuote.id,
      summary: `Added ${result.import.label} from ${sourceQuote.company?.name || "another company"} to ${targetQuote.quoteNumber}`,
      metadata: {
        sourceQuoteId: sourceQuote.id,
        markupPercent: Number(result.import.markupPercent),
      },
    });

    const commitStatus = deriveCommitStatus({
      targetQuoteStatus: targetQuote.status,
    });

    return NextResponse.json({
      ok: true,
      import: importerView(
        { ...result.import, sourceCompany: sourceQuote.company },
        { commitStatus },
      ),
      targetTotal: result.targetTotal,
    });
  } catch (err) {
    if (err instanceof ImportError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[import quote] failed:", err);
    return NextResponse.json(
      { error: "Couldn't add that cost. Please try again." },
      { status: 500 },
    );
  }
}
