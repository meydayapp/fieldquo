// app/api/portal/[token]/request/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createScoredLead } from "@/lib/leads/createLead";
import { buildLeadIntake } from "@/lib/leads/intakeShape";

import { recordConsent } from "@/lib/voice/outbound";
import { rateLimit } from "@/lib/rateLimit";
import { ownUploads, sanitiseBody } from "@/lib/clientTickets/rules";
import { appSentence } from "@/lib/notify/push";
import { DISCLOSURE } from "@/lib/voice/disclosure";
// A logged-in-via-token client requesting new work — feeds the same LeadRequest
// pipeline as the public embeddable form, just pre-filled since we already know
// who they are.
//
// ── "Request work" (2026-09-24), extended rather than duplicated ──────────
//
// The portal's Request work entry posts here for two of its three choices:
//
//   kind "new_work" (the default, and what a body with no kind always was) —
//     a new job or quote request: one of the company's enabled services, a
//     description, photos, preferred dates;
//   kind "maintenance_setup" — a client with no plan asking to set one up:
//     the same lead, its message opening with "Recurring maintenance request"
//     in the company's language so the board says what it is.
//
// (The third, "book my next included visit" for a client WITH a plan, is a
// ticket, not a lead — it is work already sold — and posts to ../tickets.)
//
// Everything lands for the company to confirm: a lead is a lead, nothing is
// scheduled, quoted or charged here. The browser sends no money and receives
// none (non-negotiable #4/#5). Photos are kept only when they are this
// company's own portal uploads (lib/clientTickets/rules.js ownUploads).
export async function POST(request, { params }) {
  // Token-only and it creates a lead the office has to read: throttled like
  // every other public POST.
  const limited = rateLimit(request, "portal-request", { limit: 6, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const client = await db.client.findUnique({
    where: { portalToken: _params.token },
  });
  if (!client)
    return NextResponse.json(
      { error: "Portal link not found" },
      { status: 404 },
    );

  const body = await request.json().catch(() => ({}));
  const kind = body?.kind === "maintenance_setup" ? "maintenance_setup" : "new_work";

  // A service must be one this company sells. It was taken on trust before —
  // any ServiceCategory id in the catalogue would have been filed against the
  // lead. Absent is fine (the client can describe something not on the list).
  let categoryId = null;
  if (body?.categoryId) {
    const enabled = await db.companyServiceCategory.findFirst({
      where: { companyId: client.companyId, enabled: true, categoryId: String(body.categoryId) },
      select: { categoryId: true },
    });
    if (!enabled) return NextResponse.json({ error: "bad_categoryId" }, { status: 400 });
    categoryId = enabled.categoryId;
  }

  // The lead is read by the OFFICE, so the labels around the client's own
  // words are in the company's language.
  const officeLanguage =
    (await db.company.findUnique({ where: { id: client.companyId }, select: { defaultLanguage: true } }))?.defaultLanguage || "en";
  const described = sanitiseBody(body?.message, 4000);
  const dates = sanitiseBody(body?.preferredDates, 300);
  const message = [
    kind === "maintenance_setup" ? await appSentence(officeLanguage, "app.portalRequest.maintenanceTag") : null,
    described || null,
    dates ? await appSentence(officeLanguage, "app.portalRequest.preferredDates", { dates }) : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (!message) return NextResponse.json({ error: "message_required" }, { status: 400 });
  const clientPhotos = ownUploads(body?.photos, { companyId: client.companyId });

  const lead = await createScoredLead({
    companyId: client.companyId,
    name: client.name,
    email: client.email,
    phone: client.phone,
    categoryId,
    message,
    source: "client_portal",
    ...(clientPhotos.length ? { clientPhotos } : {}),
    // The address we already hold for them, in the shared shape, so the lead
    // card says WHERE before anyone opens the client record. This form asks for
    // nothing but a category and a message — the address is not something they
    // told us here, it is something we know — but a lead with no location on it
    // is one an estimator cannot schedule around, and it is the same household.
    //
    // Nothing is invented: a client with blank address columns produces no
    // intake at all, and buildLeadIntake returns null rather than {}.
    intake: buildLeadIntake({
      address: client.address,
      city: client.city,
      province: client.province,
      country: client.country,
    }),
  });

  // An existing client asking for more work — the clearest consent there is,
  // and the number is the one already on their record rather than anything
  // they typed here.
  if (client.phone) {
    await recordConsent({
      companyId: client.companyId,
      phone: client.phone,
      source: "self_quote",
      disclosure: DISCLOSURE.lead,
      leadId: lead.id,
      clientId: client.id,
    }).catch((err) => console.error("[portal/request] consent not recorded:", err));
  }

  return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
}
