// app/api/jobs/[id]/work-order/pdf/route.js
//
// The crew work order as a PDF. GET, so the quote's Send menu can link
// "Download work order PDF" and a phone can open it — and because nothing
// about rendering it changes any row. Same read gate and job scoping as the
// page; the model carries no prices whoever asks.
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { loadWorkOrder } from "@/lib/workOrder/load";
import { findWorkOrderMoneyKey } from "@/lib/workOrder/build";
import { renderWorkOrderPdf } from "@/lib/workOrder/pdf";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see jobs");
  if (denied) return denied;

  const loaded = await loadWorkOrder(id, full);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (findWorkOrderMoneyKey(loaded.model)) {
    return NextResponse.json({ error: "The work order couldn't be prepared." }, { status: 500 });
  }

  // The crew's copy: hidden items absent, whoever downloads it. The office
  // sees them flagged on screen; on paper the flag would be a line the crew
  // read anyway.
  const crewModel = {
    ...loaded.model,
    areas: loaded.model.areas
      .filter((a) => !a.hidden)
      .map((a) => ({ ...a, lines: (a.lines || []).filter((l) => !l.hidden) })),
  };

  const pdf = await renderWorkOrderPdf({
    workOrder: crewModel,
    company: loaded.company,
    language: loaded.job.quote?.language,
  });
  const safe = String(loaded.model.job.title || "work-order").replace(/[^\w.-]+/g, "-").slice(0, 60);
  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="work-order-${safe}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
