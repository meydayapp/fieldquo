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
import { performImport, ImportError, sourceCostAmount } from "@/lib/quotes/importQuote";
import { deriveCommitStatus, importerView } from "@/lib/quotes/importedStatus";
import { recordActivity } from "@/lib/activity/log";
import { isPubliclyReadable } from "@/lib/quotes/shareToken";
import { NEW_TARGET, parseNewClient, createImportTargetQuote } from "@/lib/quotes/importTarget";

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

  // "Start a new quote": the client's name and kind are the only things the
  // page sends, checked here before anything is written.
  const startNew = targetQuoteId === NEW_TARGET;
  let newClient = null;
  if (startNew) {
    const { response: noClients } = await levelOrRefusal(member, "clientsProperties", "full_edit", "add clients");
    if (noClients) return noClients;
    const parsed = parseNewClient(body.newClient);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
    newClient = parsed.data;
  }

  const [sourceQuote, existingTarget, targetCompany] = await Promise.all([
    db.quote.findFirst({
      where: { shareToken: token },
      include: {
        company: { select: { name: true } },
        scopeGroups: true,
      },
    }),
    // Ownership enforced in the query: a target quote id that isn't the viewer's
    // simply doesn't resolve.
    startNew
      ? Promise.resolve(null)
      : db.quote.findFirst({
          where: { id: targetQuoteId, companyId: member.companyId },
          include: { scopeGroups: true },
        }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { taxRate: true },
    }),
  ]);

  // A draft is nobody's to import — the same gate as the page and the GET.
  if (!sourceQuote || !isPubliclyReadable(sourceQuote.status))
    return NextResponse.json({ error: "That quote link isn't valid." }, { status: 404 });
  // Refused BEFORE a new quote is made, so "this is your own quote" never
  // leaves an empty draft behind it.
  if (sourceQuote.companyId === member.companyId)
    return NextResponse.json({ error: "This is your own quote — nothing to import." }, { status: 400 });
  if (startNew && !(sourceCostAmount(sourceQuote) > 0))
    return NextResponse.json({ error: "That quote doesn't have an amount to import yet." }, { status: 400 });

  let targetQuote = existingTarget;
  if (startNew) {
    try {
      targetQuote = await createImportTargetQuote(db, { member, client: newClient });
    } catch (err) {
      console.error("[import quote] new quote failed:", err?.message);
      return NextResponse.json({ error: "Couldn't start a new quote. Please try again." }, { status: 500 });
    }
  }

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
      // Where the success card sends them: the quote, to finish it.
      targetQuoteId: targetQuote.id,
      targetQuoteNumber: targetQuote.quoteNumber,
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
