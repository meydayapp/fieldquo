// app/api/portal/[token]/tickets/route.js
//
// The client's side of client tickets and "Request work".
//
//   GET  → { tickets, services, maintenancePlans }
//          tickets           this client's own, with their threads, shaped by
//                            clientTicketView (no assignee, no priority, no
//                            member ids)
//          services          the company's enabled services, NAMES ONLY, in
//                            the client's language — never a rate
//                            (non-negotiable #4)
//          maintenancePlans  the client's active plans with the visits left
//                            in them (null when the plan runs until
//                            cancelled) — for "book my next included visit"
//   POST → open a ticket: "Report an issue" (repair / warranty / question /
//          billing) or "book my next included visit" (maintenance, which must
//          name one of the client's own active plans).
//
// Scoped by the token to one client of one company; see
// lib/clientTickets/service.js for how every link is re-proved.
export const runtime = "nodejs";

import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { clientTickets, openTicket, emailOffice } from "@/lib/clientTickets/service";
import { clientTicketView, CLIENT_ISSUE_TYPES, sanitiseBody } from "@/lib/clientTickets/rules";
import { upcomingPlanDates } from "@/lib/portal/view";
import { planBlockedReason } from "@/lib/servicePlans/schedule";
import { categoryLabel } from "@/lib/i18n/translateContent";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";

const PLAN_SELECT = {
  id: true,
  name: true,
  status: true,
  frequency: true,
  startDate: true,
  endMode: true,
  occurrenceCount: true,
  endDate: true,
  cancelledAt: true,
  completedAt: true,
};

async function clientFor(params) {
  const { token } = await params;
  return db.client.findUnique({
    where: { portalToken: String(token || "") },
    select: { id: true, companyId: true, name: true, language: true, company: { select: { defaultLanguage: true } } },
  });
}

/** Visits still to come inside the plan's term; null for an open-ended plan,
 *  whose honest answer is "until it is cancelled", not a number. */
function remainingVisits(plan, now) {
  if (plan.endMode === "open") return null;
  return upcomingPlanDates(plan, { now, count: 500 }).length;
}

async function activePlans(client, now) {
  const rows = await db.servicePlan.findMany({
    where: { clientId: client.id, companyId: client.companyId, status: "active" },
    select: PLAN_SELECT,
    take: 10,
  });
  return rows
    .filter((p) => {
      const b = planBlockedReason(p, { now });
      return !b || b === "not_started";
    })
    .map((p) => ({ id: p.id, name: p.name, remaining: remainingVisits(p, now) }));
}

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise — clientFor awaits it.
  const client = await clientFor(params);
  if (!client) return NextResponse.json({ error: "Portal link not found" }, { status: 404 });
  const now = new Date();
  const language = resolveClientLanguage({ client, company: client.company });
  const [tickets, enabled, maintenancePlans] = await Promise.all([
    clientTickets({ client }),
    db.companyServiceCategory.findMany({
      where: { companyId: client.companyId, enabled: true },
      // Names only. The category row carries no price, and nothing priced
      // (Product, InstantQuoteConfig, the rate sets) is read here at all.
      select: { category: { select: { id: true, label: true, labelTranslations: true } } },
      take: 60,
    }),
    activePlans(client, now),
  ]);
  return NextResponse.json({
    tickets: tickets.map(clientTicketView),
    services: enabled
      .map((e) => e.category)
      .filter(Boolean)
      .map((c) => ({ id: c.id, name: categoryLabel(c, language) }))
      .filter((s) => s.name)
      .sort((a, b) => a.name.localeCompare(b.name)),
    maintenancePlans,
  });
}

export async function POST(request, { params }) {
  const limited = rateLimit(request, "portal-ticket", { limit: 10, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;
  const client = await clientFor(params);
  if (!client) return NextResponse.json({ error: "Portal link not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));

  let input = body;
  let allowedTypes = CLIENT_ISSUE_TYPES;
  if (body?.type === "maintenance") {
    // "Book my next included visit": one of THIS client's active plans, and
    // the words are built here, in the client's language — the browser sends
    // which plan and when suits them, nothing else.
    const plans = await activePlans(client, new Date());
    const plan = plans.find((p) => p.id === body?.servicePlanId);
    if (!plan) return NextResponse.json({ error: "bad_servicePlanId" }, { status: 404 });
    const language = resolveClientLanguage({ client, company: client.company });
    const c = clientDocCopy(language).portal;
    const when = sanitiseBody(body?.preferredWindow, 300);
    const note = sanitiseBody(body?.body, 2000);
    input = {
      type: "maintenance",
      subject: c.maintenanceSubject(plan.name),
      body: [when ? c.preferredLine(when) : null, note || null].filter(Boolean).join("\n\n") || c.maintenanceNoNote,
      servicePlanId: plan.id,
      photos: body?.photos,
    };
    allowedTypes = ["maintenance"];
  }

  const result = await openTicket({ client, input, allowedTypes });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  after(() => emailOffice({ ticket: result.ticket, client, kind: "opened", text: result.notice.text, request }));
  return NextResponse.json({ ok: true, id: result.ticket.id }, { status: 201 });
}
