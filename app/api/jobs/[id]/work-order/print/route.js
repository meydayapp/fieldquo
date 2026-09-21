// app/api/jobs/[id]/work-order/print/route.js
//
// The crew work order as a printable page (lib/workOrder/printSheet.js),
// opened in a new tab. Same read gate and scoping as the page; the sheet is
// the crew's copy — hidden items absent — in the quote's language.
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { readerLanguage } from "@/lib/i18n/readerLanguage";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { loadWorkOrder } from "@/lib/workOrder/load";
import { findWorkOrderMoneyKey } from "@/lib/workOrder/build";
import { workOrderPrintHtml } from "@/lib/workOrder/printSheet";

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

  const ui = await readerLanguage({ userId: member.userId, companyId: member.companyId });
  const printLabel = APP_MESSAGES[ui]?.["app.action.print"] || APP_MESSAGES.en["app.action.print"] || "Print";
  const html = workOrderPrintHtml({
    company: loaded.company,
    workOrder: loaded.model,
    language: loaded.job.quote?.language || loaded.company?.defaultLanguage || "en",
    printLabel,
  });
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
