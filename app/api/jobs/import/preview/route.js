// app/api/jobs/import/preview/route.js
//
// POST — validate a batch of past jobs against THIS company's rows and say,
// per row, what the commit would do: write it, skip it as already on file,
// or refuse it and why. Nothing is written. Review-then-commit, the same
// shape as app/api/expenses/import/preview — AGENTS.md is explicit that N
// rows are never written straight from a file.
//
// Same gate as the commit route (lib/jobs/pastJobsGate.js), so a member who
// can preview can commit and vice versa.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { buildPastJobsPreview, MAX_PAST_JOB_ROWS } from "@/lib/jobs/pastJobImport";
import { loadPastJobContext, findMatchingClient } from "@/lib/jobs/importPastJob";
import { pastJobsGate } from "@/lib/jobs/pastJobsGate";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await pastJobsGate(member);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }
  const rows = Array.isArray(body?.rows) ? body.rows : null;
  if (!rows) return NextResponse.json({ error: "rows must be an array." }, { status: 400 });
  if (rows.length > MAX_PAST_JOB_ROWS) {
    return NextResponse.json(
      { error: `A batch is at most ${MAX_PAST_JOB_ROWS} past jobs. Split the file and import it in parts.` },
      { status: 400 },
    );
  }

  const context = await loadPastJobContext(db, member.companyId);
  if (!context.company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const preview = buildPastJobsPreview({
    rows,
    today: new Date(),
    defaultTaxApplied: context.defaultTaxApplied,
    categories: context.categories,
    existingKeys: context.existingKeys,
    existingInvoiceNumbers: context.existingInvoiceNumbers,
    existingQuoteNumbers: context.existingQuoteNumbers,
  });

  // Which rows will make a NEW client and which reuse one on file — worth
  // knowing before committing, because "12 new clients" from a file of
  // regulars means the names don't match how they are spelled here.
  const out = [];
  for (const r of preview.rows) {
    let client = null;
    if (r.status !== "error") {
      if (r.value.clientId) {
        client = await db.client.findFirst({
          where: { id: r.value.clientId, companyId: member.companyId },
          select: { id: true, name: true },
        });
        if (!client) {
          out.push({ ...r, raw: undefined, status: "error", errors: [{ field: "clientId", code: "client_not_found" }], client: null });
          continue;
        }
      } else {
        client = await findMatchingClient(db, member.companyId, r.value);
      }
    }
    out.push({
      index: r.index,
      status: r.status,
      errors: r.errors,
      duplicateOf: r.duplicateOf,
      category: r.category,
      client: client ? { id: client.id, name: client.name, existing: true } : r.value.clientName ? { id: null, name: r.value.clientName, existing: false } : null,
      value: {
        ...r.value,
        startDate: r.value.startDate ? r.value.startDate.toISOString().slice(0, 10) : null,
        endDate: r.value.endDate ? r.value.endDate.toISOString().slice(0, 10) : null,
        paidDate: r.value.paidDate ? r.value.paidDate.toISOString().slice(0, 10) : null,
      },
    });
  }

  const summary = {
    ...preview.summary,
    ok: out.filter((r) => r.status === "ok").length,
    errors: out.filter((r) => r.status === "error").length,
    newClients: out.filter((r) => r.status === "ok" && r.client && !r.client.existing).length,
    defaultTaxApplied: context.defaultTaxApplied,
  };

  return NextResponse.json({ rows: out, summary });
}
