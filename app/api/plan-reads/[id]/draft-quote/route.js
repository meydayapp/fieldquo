// app/api/plan-reads/[id]/draft-quote/route.js
//
// GET — the drawing read's draft, in the shape the quote builder opens with
// (`/app/quotes/new?fromPlanRead=<id>`, app/components/quotes/builder/
// QuoteBuilder.js): one painting scope group per category, each holding the
// `area_substrate` paint TAKEOFF the read produced. No price travels — the
// builder prices the takeoff from the company's book exactly as it prices a
// typed one, and nothing is saved until the estimator presses Save. The only
// figures that ride along as lines are access-equipment prices the ESTIMATOR
// typed on the read's page; the model never wrote one.
//
// Every area carries "Drafted by FieldQuo AI" and each surface's source in
// its crew note (office-only). The summary, assumptions, exclusions, open
// questions and unpriced equipment go to the INTERNAL review notes.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { loadPlanRead } from "@/lib/planRead/load";
import { loadPaintBooks, readInputs } from "@/lib/planRead/run";
import { buildDimIndex, computeProject } from "@/lib/planRead/projectModel";
import { priceProject } from "@/lib/planRead/pricing";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "create a quote from a drawing read");
  if (denied) return denied;

  const read = await loadPlanRead(id, member.companyId, { messages: false });
  if (!read) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!read.model) return NextResponse.json({ error: "Run the read first." }, { status: 409 });

  const { books } = await loadPaintBooks(member.companyId);
  const inputs = readInputs(read);
  const computed = computeProject(read.model, {
    dims: buildDimIndex(inputs.sheets),
    book: books.interior_painting,
    excel: inputs.excel,
    photoRead: read.photoRead,
  });
  const priced = priceProject(computed, books);

  const extraLines = priced.access
    .filter((a) => a.price !== null)
    .map((a) => ({
      description: `${a.label}${a.areaName ? ` — ${a.areaName}` : ""}`,
      quantity: 1,
      unit: "flat",
      rate: a.price,
      amount: a.price,
      // Office-only provenance; never rendered to the client.
      meta: { aiDrafted: true, source: "plan_read", planReadId: read.id },
    }));

  const groups = priced.groups.map((g, i) => ({
    categoryKey: g.categoryKey,
    takeoff: g.takeoff,
    extraLines: i === 0 ? extraLines : [],
  }));
  // Access priced but no painting group to hang it on still needs a home.
  if (!groups.length && extraLines.length) groups.push({ categoryKey: "interior_painting", takeoff: null, extraLines });

  const open = computed.questions.filter((q) => !q.resolved).map((q) => `• ${q.text}`);
  const unpriced = priced.access.filter((a) => a.price === null).map((a) => `• ${a.label}${a.areaName ? ` — ${a.areaName}` : ""}${a.heightFt ? ` (${a.heightFt} ft)` : ""}: no price yet — add a line`);
  const reviewNotes = [
    `Drafted by FieldQuo AI from the drawing read "${read.title}". Check every quantity marked estimated.`,
    computed.summary ? `\n${computed.summary}` : "",
    computed.assumptions.length ? `\nAssumptions:\n${computed.assumptions.map((a) => `• ${a}`).join("\n")}` : "",
    computed.exclusions.length ? `\nExclusions:\n${computed.exclusions.map((a) => `• ${a}`).join("\n")}` : "",
    open.length ? `\nOpen questions:\n${open.join("\n")}` : "",
    unpriced.length ? `\nAccess equipment:\n${unpriced.join("\n")}` : "",
  ]
    .join("")
    .slice(0, 8000);

  return NextResponse.json({
    draft: {
      planReadId: read.id,
      clientId: read.clientId || null,
      groups,
      reviewNotes,
      skipped: priced.skipped,
    },
  });
}
