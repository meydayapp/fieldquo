// app/api/quotes/received/[token]/import/route.js
//
// Perform the import: pull the quote at [token] (another company's) into one of
// the viewer's own quotes as a marked-up subcontractor cost line. The browser
// posts only the target quote id, a markup percent, a display choice and
// whether to hold it as an option — every money figure is derived server-side
// in performImport from the stored source quote. See lib/quotes/importQuote.js.
//
// The target may be an APPROVED quote (with its job): the signed quote is not
// edited, a pending change order to the client carries the price instead.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { performImport, ImportError, sourceCostAmount } from "@/lib/quotes/importQuote";
import { deriveImportCommitStatus, importerView } from "@/lib/quotes/importedStatus";
import { hasToggle, assignedJobWhere } from "@/lib/permissions/enforce";
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
  // "Keep as an option to compare": a yes/no, never a figure.
  const asOption = body?.asOption === true;
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
          include: {
            scopeGroups: true,
            // An approved target's job is where the change order goes —
            // the oldest, the one the acceptance created (lib/invoices/jobLink.js).
            jobs: { select: { id: true }, orderBy: { createdAt: "asc" }, take: 1 },
          },
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

  // ── Into an approved quote: that is a change order to the client ────────
  //
  // Same two gates as logging a change order by hand (POST
  // /api/jobs/[id]/change-orders): the jobs level and showPricing. Asked even
  // for "keep as an option" — an option on an approved quote exists only to
  // become one.
  if (existingTarget?.status === "accepted") {
    const { full: fullForCo, response: noJobs } = await levelOrRefusal(member, "jobs", "view_create_edit", "add extra work to an approved quote");
    if (noJobs) return noJobs;
    if (!hasToggle(fullForCo, "showPricing"))
      return NextResponse.json({ error: "You don't have permission to add priced extra work." }, { status: 403 });
    // …and on a job this member can reach, the scope the change-order route
    // applies (assignedJobWhere) — a member limited to their own jobs does not
    // raise one on somebody else's through this door.
    const jobId = existingTarget.jobs?.[0]?.id;
    const reachable = jobId
      ? await db.job.findFirst({ where: { id: jobId, companyId: member.companyId, ...assignedJobWhere(fullForCo) }, select: { id: true } })
      : null;
    if (jobId && !reachable) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
      asOption,
    });

    const placedWhere =
      result.placement === "change_order"
        ? ` as a pending change order`
        : result.placement === "option"
          ? ` as an option to compare`
          : "";
    await recordActivity(member, {
      action: "quote.cost_imported",
      entityType: "quote",
      entityId: targetQuote.id,
      summary: `Added ${result.import.label} from ${sourceQuote.company?.name || "another company"} to ${targetQuote.quoteNumber}${placedWhere}`,
      metadata: {
        sourceQuoteId: sourceQuote.id,
        markupPercent: Number(result.import.markupPercent),
        placement: result.placement,
        ...(result.changeOrder ? { changeOrderId: result.changeOrder.id } : {}),
      },
    });

    const commitStatus = deriveImportCommitStatus({
      placement: result.placement,
      changeOrderStatus: result.changeOrder?.status ?? null,
      targetQuoteStatus: targetQuote.status,
    });

    return NextResponse.json({
      ok: true,
      // Where the success card sends them: the quote, to finish it.
      targetQuoteId: targetQuote.id,
      targetQuoteNumber: targetQuote.quoteNumber,
      placement: result.placement,
      // The change order the client will be asked to sign — its number only;
      // it is sent from the quote page's change-order list.
      changeOrder: result.changeOrder
        ? { id: result.changeOrder.id, label: `CO-${result.changeOrder.seq}` }
        : null,
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
