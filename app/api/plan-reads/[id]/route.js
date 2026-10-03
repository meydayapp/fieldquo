// app/api/plan-reads/[id]/route.js
//
// GET   one drawing read, with its overview and draft computed now
//       (lib/planRead/view.js). A running read whose lease has lapsed is
//       picked up again here — the poll that shows progress is what keeps a
//       read moving across Vercel's per-invocation ceiling (lib/planRead/run.js).
//   ?sheet=<key> adds that sheet's dimension list for the measure tool.
// PATCH the estimator's own edits: the title, what the client wants, a
//       measurement traced on a sheet, a price typed for a lift, a surface or
//       area switched off, a photo grouping split or merged. The same
//       applyOps the chat uses, with actor "person" — so only a person can set
//       a measurement or a price.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle } from "@/lib/permissions/enforce";
import { aiBalanceFor } from "@/lib/voice/credits";
import { loadPlanRead } from "@/lib/planRead/load";
import { planReadView } from "@/lib/planRead/view";
import { advanceRead, readInputs, loadPaintBooks } from "@/lib/planRead/run";
import { applyOps, buildDimIndex } from "@/lib/planRead/projectModel";
import { planSubstrateKeys } from "@/lib/planRead/catalogue";
import { splitPhotoSurface, mergePhotoSurfaces } from "@/lib/planRead/photoScale";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_only", "see drawing reads");
  if (denied) return denied;

  const read = await loadPlanRead(id, member.companyId);
  if (!read) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stale = read.status === "reading" && (!read.leaseUntil || new Date(read.leaseUntil).getTime() < Date.now());
  // Never from a read-only support session: continuing a read writes the
  // company's data and spends its held credit.
  if (stale && member.impersonationMode !== "read_only") {
    after(() => advanceRead(read.id, { companyId: member.companyId, userId: member.userId || null }));
  }

  const sheetKey = new URL(request.url).searchParams.get("sheet");
  const [balanceCents, company] = await Promise.all([
    aiBalanceFor(member.companyId),
    db.company.findUnique({ where: { id: member.companyId }, select: { currency: true } }),
  ]);
  const view = await planReadView(read, {
    companyId: member.companyId,
    canSeeMoney: hasToggle(full, "showPricing"),
    balanceCents,
    sheetKey,
  });
  return NextResponse.json({ ...view, currency: company?.currency || null });
}

const clip = (s, n) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "edit drawing reads");
  if (denied) return denied;

  const read = await loadPlanRead(id, member.companyId, { messages: false });
  if (!read) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (read.status === "reading") return NextResponse.json({ error: "A read is running. Edit it when it finishes." }, { status: 409 });

  const raw = await request.json().catch(() => ({}));
  const data = {};
  const changes = [];
  if (typeof raw?.title === "string") data.title = clip(raw.title, 120) || read.title;
  if (typeof raw?.clientRequest === "string") data.clientRequest = clip(raw.clientRequest, 2000) || null;

  if (raw?.photo && read.photoRead) {
    const next =
      raw.photo.op === "split"
        ? splitPhotoSurface(read.photoRead, String(raw.photo.id || ""))
        : raw.photo.op === "merge"
          ? mergePhotoSurfaces(read.photoRead, Array.isArray(raw.photo.ids) ? raw.photo.ids.map(String).slice(0, 10) : [])
          : read.photoRead;
    if (next !== read.photoRead) {
      data.photoRead = next;
      changes.push(raw.photo.op === "split" ? "Split a photo grouping" : "Merged photo groupings");
      // Keep the overview's surfaces pointing at a photo surface that still
      // exists: a split one's link follows its first part, a merged one's
      // follows the surface it was merged into.
      const live = new Set(next.surfaces.map((s) => s.id));
      const relink = (pid) => {
        if (!pid || live.has(pid)) return pid;
        if (raw.photo.op === "split" && live.has(`${pid}.1`)) return `${pid}.1`;
        if (raw.photo.op === "merge") return next.surfaces.find((s) => Array.isArray(raw.photo.ids) && raw.photo.ids.includes(s.id))?.id || null;
        return null;
      };
      if (read.model?.surfaces) {
        data.model = { ...read.model, surfaces: read.model.surfaces.map((s) => ({ ...s, photoSurfaceId: relink(s.photoSurfaceId) })) };
      }
    }
  }

  if (Array.isArray(raw?.ops) && read.model) {
    // A price for equipment is money on the estimator's own draft; a member
    // whose access hides pricing may not set one.
    const canSeeMoney = hasToggle(full, "showPricing");
    const ops = raw.ops.filter((o) => o && (canSeeMoney || o.op !== "set_access_price")).slice(0, 20);
    const { books } = await loadPaintBooks(member.companyId);
    const book = books.interior_painting;
    const { sheets, excel } = readInputs(read);
    const dims = buildDimIndex(sheets);
    const result = applyOps(
      data.model || read.model,
      ops,
      {
        dimIds: new Set(dims.keys()),
        itemKeys: new Set(planSubstrateKeys(book)),
        productKeys: new Set(Object.keys(book?.products || {})),
        photoIds: new Set(((data.photoRead || read.photoRead)?.surfaces || []).map((s) => s.id)),
        excel,
      },
      { actor: "person" },
    );
    data.model = result.model;
    changes.push(...result.changes);
  }

  if (!Object.keys(data).length) return NextResponse.json({ ok: true, changes: [] });
  await db.planRead.updateMany({ where: { id: read.id, companyId: member.companyId }, data });
  return NextResponse.json({ ok: true, changes });
}
