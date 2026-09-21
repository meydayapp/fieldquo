// app/api/jobs/[id]/materials/print/route.js
//
// The material list as a printable page (lib/materials/printSheet.js),
// opened in a new tab. Same read gate and the same job scoping as the list
// itself; no prices on the sheet whatever the caller's toggles, so the two
// money columns are not even loaded here.
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { readerLanguage } from "@/lib/i18n/readerLanguage";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { stockLevels } from "@/lib/purchasing/stock";
import { onHandStatus } from "@/lib/materials/list";
import { materialListPrintHtml } from "@/lib/materials/printSheet";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see jobs");
  if (denied) return denied;

  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: {
      title: true,
      siteAddress: true,
      client: { select: { name: true } },
      company: { select: { name: true, brandColor: true, brandColors: true } },
      materials: {
        where: { excludedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          name: true, qty: true, unit: true, group: true, reason: true, wastePct: true,
          stockMaterialId: true, purchasedAt: true,
        },
      },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = job.materials.map((m) => ({
    ...m,
    qty: num(m.qty),
    wastePct: m.wastePct == null ? null : num(m.wastePct),
  }));
  const stockIds = [...new Set(rows.map((m) => m.stockMaterialId).filter(Boolean))];
  const levels = new Map();
  if (stockIds.length) {
    const [mats, movements] = await Promise.all([
      db.material.findMany({
        where: { id: { in: stockIds }, companyId: member.companyId },
        select: { id: true, name: true, unit: true, reorderThreshold: true },
      }),
      db.stockMovement.findMany({
        where: { companyId: member.companyId, materialId: { in: stockIds } },
        select: { materialId: true, quantity: true },
      }),
    ]);
    for (const l of stockLevels(mats, movements)) levels.set(l.materialId, l);
  }
  for (const m of rows) {
    const level = m.stockMaterialId ? levels.get(m.stockMaterialId) : null;
    Object.assign(m, onHandStatus(m.qty, level ? level.level : null));
  }

  const ui = await readerLanguage({ userId: member.userId, companyId: member.companyId });
  const printLabel = APP_MESSAGES[ui]?.["app.action.print"] || APP_MESSAGES.en["app.action.print"] || "Print";

  const html = materialListPrintHtml({ company: job.company, job, materials: rows, printLabel });
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
