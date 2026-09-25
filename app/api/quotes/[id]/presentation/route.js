// app/api/quotes/[id]/presentation/route.js
//
// THIS quote's proposal: which sections the homeowner will see, which
// library documents, the crew size behind the day plan, and the waivers
// attached. GET answers the Presentation panel; PATCH saves the overrides.
//
// The same three-state rule as the email sections next door: `null` on a
// section means "follow the company default", and the route accepts all
// three values and refuses anything else rather than coercing.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";
import { PROPOSAL_SECTION_KEYS, PROPOSAL_SECTIONS, sanitisePresentation } from "@/lib/proposal/sections";
import { PROPOSAL_COMPANY_SELECT, loadProposalContent, loadWorkPlan } from "@/lib/proposal/load";
import { listDocuments } from "@/lib/company/documentLibrary";
import { localisedCompany } from "@/lib/i18n/companyText";

async function present(member, quote) {
  const loaded = await db.company.findUnique({
    where: { id: member.companyId },
    select: { ...PROPOSAL_COMPANY_SELECT, defaultLanguage: true },
  });
  const language = quote.language || loaded?.defaultLanguage || "en";
  // The story in the quote's language when its translation exists — what
  // the client page shows (app/api/public/quotes/[token]).
  const company = await localisedCompany(db, loaded, { companyId: member.companyId, language });
  const [{ content, sections }, plan, documents, waivers] = await Promise.all([
    loadProposalContent({
      companyId: member.companyId,
      company: company || {},
      language,
      presentation: quote.presentation,
    }),
    loadWorkPlan({ quote, companyId: member.companyId }),
    listDocuments(member.companyId),
    db.documentSignature.findMany({
      where: { quoteId: quote.id, companyId: member.companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true, status: true, signedAt: true, sentAt: true, token: true, document: { select: { id: true, title: true } } },
    }),
  ]);
  const pres = sanitisePresentation(quote.presentation);
  return {
    quoteId: quote.id,
    sections: PROPOSAL_SECTION_KEYS.map((key) => ({
      key,
      labelKey: PROPOSAL_SECTIONS[key].labelKey,
      fillHref: PROPOSAL_SECTIONS[key].fillHref,
      on: sections[key].on,
      inherited: sections[key].inherited,
      companyDefault: sections[key].companyDefault,
      hasContent: sections[key].hasContent,
      rendered: sections[key].rendered,
      override: pres.sections[key],
    })),
    counts: {
      beforeAfter: content.gallery.length,
      documents: content.documents.length,
      testimonials: content.testimonials.length,
      services: content.services.length,
    },
    // Every library document a client could see, with whether this quote
    // includes it. `documentIds: null` means all of them.
    documents: documents
      .filter((d) => d.type !== "waiver")
      .map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        expired: d.expired,
        visibleToClients: d.visibleToClients,
        included: d.visibleToClients && (pres.documentIds === null || pres.documentIds.includes(d.id)),
      })),
    documentIds: pres.documentIds,
    plan: {
      totalHours: plan?.totalHours || 0,
      crewSize: plan?.crewSize || null,
      crewSizeOverride: pres.crewSize,
      days: plan?.days || null,
    },
    waivers: waivers.map((w) => ({
      id: w.id,
      documentId: w.document?.id,
      title: w.document?.title || "",
      status: w.status,
      signedAt: w.signedAt,
      sentAt: w.sentAt,
    })),
    waiverLibrary: documents.filter((d) => d.type === "waiver").map((d) => ({ id: d.id, title: d.title, signable: d.signable })),
  };
}

const QUOTE_SELECT = {
  id: true, quoteNumber: true, language: true, presentation: true, status: true,
  scopeGroups: { orderBy: { sortOrder: "asc" }, select: { categoryId: true, takeoff: true, category: { select: { key: true } } } },
};

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_only", "see quotes");
  if (denied) return denied;
  const quote = await db.quote.findFirst({ where: { id, companyId: member.companyId }, select: QUOTE_SELECT });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await present(member, quote));
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "edit quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }
  const quote = await db.quote.findFirst({ where: { id, companyId: member.companyId }, select: QUOTE_SELECT });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const current = sanitisePresentation(quote.presentation);
  const next = { sections: { ...current.sections }, documentIds: current.documentIds, crewSize: current.crewSize };
  const changed = [];

  if (body.sections && typeof body.sections === "object") {
    for (const key of PROPOSAL_SECTION_KEYS) {
      if (!(key in body.sections)) continue;
      const v = body.sections[key];
      if (v !== true && v !== false && v !== null) {
        return NextResponse.json({ error: `sections.${key} must be true, false, or null (follow the company default).` }, { status: 400 });
      }
      next.sections[key] = v;
      changed.push(`sections.${key}`);
    }
  }
  if ("documentIds" in body) {
    if (body.documentIds !== null && !Array.isArray(body.documentIds)) {
      return NextResponse.json({ error: "documentIds must be an array of ids, or null for every document." }, { status: 400 });
    }
    next.documentIds = body.documentIds === null ? null : body.documentIds.filter((x) => typeof x === "string");
    changed.push("documentIds");
  }
  if ("crewSize" in body) {
    if (body.crewSize !== null && !(Number.isInteger(body.crewSize) && body.crewSize >= 1 && body.crewSize <= 20)) {
      return NextResponse.json({ error: "crewSize must be a whole number from 1 to 20, or null." }, { status: 400 });
    }
    next.crewSize = body.crewSize;
    changed.push("crewSize");
  }
  if (!changed.length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const saved = sanitisePresentation(next);
  const updated = await db.quote.update({
    where: { id },
    data: { presentation: saved },
    select: QUOTE_SELECT,
  });
  await recordActivity(member, {
    action: "quote.presentation_updated",
    entityType: "quote",
    entityId: id,
    summary: `Changed the client proposal on ${quote.quoteNumber}`,
    metadata: { changed },
  });
  return NextResponse.json(await present(member, updated));
}
