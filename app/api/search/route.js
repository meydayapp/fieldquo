// app/api/search/route.js
//
// GET /api/search?q= — the records half of the shell's global search
// (app/components/layout/GlobalSearch.js): clients, quotes, jobs and
// invoices of THIS company, by name, number or title, five per type.
//
// ── What it deliberately does not return ────────────────────────────────────
//
// No money. A result is a name, a number, a status and a link. The four list
// endpoints each redact totals by the caller's showPricing toggle and their
// own rules (lib/permissions/enforce.js); rather than re-implement four
// redactions here, the search never selects a total in the first place, so
// there is nothing to redact and nothing to get wrong. The page the result
// opens applies its own rules.
//
// ── Who sees which type ─────────────────────────────────────────────────────
//
// The same rung each list route gates on: quotes / jobs / invoices at
// view_only, clients at name_address_only (a name is what a result shows).
// A type the caller may not open is skipped, not refused — a Crew member
// typing a client's name gets the jobs they are booked on, not a 403 for
// the whole box.
//
// Fans out in one Promise.all so a search costs one round trip, and every
// query is bounded (take: 5) and prefix-indexed where the schema allows.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";

const PER_TYPE = 5;
const MAX_QUERY = 80;

/** Trim, cap, collapse whitespace. Empty → null. */
export function normaliseQuery(raw) {
  const q = String(raw || "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
  return q.length >= 2 ? q : null;
}

/** Which of the four types this member may search. Pure; check-shell executes it. */
export function searchableTypes(member) {
  return {
    client: hasLevel(member, "clientsProperties", "name_address_only"),
    quote: hasLevel(member, "quotes", "view_only"),
    job: hasLevel(member, "jobs", "view_only"),
    invoice: hasLevel(member, "invoices", "view_only"),
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const q = normaliseQuery(new URL(request.url).searchParams.get("q"));
  if (!q) return NextResponse.json({ results: [] });

  const full = await loadEnforceableMember(db, member.id);
  const may = searchableTypes(full);
  const companyId = member.companyId;
  const ci = { contains: q, mode: "insensitive" };

  const [clients, quotes, jobs, invoices] = await Promise.all([
    may.client
      ? db.client.findMany({
          where: { companyId, OR: [{ name: ci }, { email: ci }, { phone: { contains: q } }] },
          select: { id: true, name: true, email: true },
          orderBy: { createdAt: "desc" },
          take: PER_TYPE,
        })
      : [],
    may.quote
      ? db.quote.findMany({
          where: { companyId, OR: [{ quoteNumber: ci }, { client: { name: ci } }] },
          select: { id: true, quoteNumber: true, status: true, client: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
          take: PER_TYPE,
        })
      : [],
    may.job
      ? db.job.findMany({
          where: { companyId, OR: [{ title: ci }, { client: { name: ci } }] },
          select: { id: true, title: true, status: true, client: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
          take: PER_TYPE,
        })
      : [],
    may.invoice
      ? db.invoice.findMany({
          where: { companyId, OR: [{ invoiceNumber: ci }, { client: { name: ci } }] },
          select: { id: true, invoiceNumber: true, status: true, client: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
          take: PER_TYPE,
        })
      : [],
  ]);

  const results = [
    ...clients.map((c) => ({ type: "client", id: c.id, title: c.name, subtitle: c.email || null, href: `/app/clients/${c.id}` })),
    ...quotes.map((r) => ({ type: "quote", id: r.id, title: r.quoteNumber, subtitle: `${r.client?.name || ""} · ${r.status}`.replace(/^ · /, ""), href: `/app/quotes/${r.id}` })),
    ...jobs.map((r) => ({ type: "job", id: r.id, title: r.title, subtitle: `${r.client?.name || ""} · ${r.status}`.replace(/^ · /, ""), href: `/app/jobs/${r.id}` })),
    ...invoices.map((r) => ({ type: "invoice", id: r.id, title: r.invoiceNumber, subtitle: `${r.client?.name || ""} · ${r.status}`.replace(/^ · /, ""), href: `/app/invoices/${r.id}` })),
  ];
  return NextResponse.json({ results });
}
