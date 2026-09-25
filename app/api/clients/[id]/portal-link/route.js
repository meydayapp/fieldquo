// app/api/clients/[id]/portal-link/route.js
//
// POST { send?: boolean } — the client's portal link, for the office.
//
//   send false → returns { url } for "Copy portal link"
//   send true  → also emails it to the client, from the company, in the
//                client's language (lib/portal/loginEmail.js), and returns
//                { url, sentTo }
//
// POST for both, because both can WRITE: the first call for a client mints
// Client.portalToken (lib/clientPortal.js). A GET that writes would also be
// open to a read-only support session, which non-negotiable #2 forbids;
// getCurrentMember refuses impersonation on any non-GET.
//
// Gated on seeing the full client record (clientsProperties:full_view): the
// link opens the client's invoices and balance to whoever holds it, and GET
// /api/clients/[id] already strips portalToken below that level
// (CLIENT_RESTRICTED_FIELDS). A member who cannot see the token must not be
// able to mint and copy it through a side door.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { ensurePortalToken, portalUrl } from "@/lib/clientPortal";
import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { buildPortalLinkEmail } from "@/lib/portal/loginEmail";
import { recordActivity } from "@/lib/activity/log";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "clientsProperties", "full_view", "share a client's portal link");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const client = await db.client.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, name: true, email: true, language: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const token = await ensurePortalToken(db, client.id, member.companyId);
  if (!token) return NextResponse.json({ error: "Couldn't create a portal link for this client." }, { status: 500 });
  const url = portalUrl(token, request);

  if (body?.send !== true) return NextResponse.json({ url });

  if (!client.email) {
    return NextResponse.json({ error: "This client has no email address. Add one, or copy the link instead." }, { status: 400 });
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { ...SENDER_SELECT, logoUrl: true, brandColor: true, phone: true, defaultLanguage: true },
  });
  const { from, replyTo } = await resolveSender(company || {}, member.companyId);
  const language = resolveClientLanguage({ client, company });
  const { subject, html, text } = buildPortalLinkEmail({ company: company || {}, client, url, language, requested: false });

  const result = await sendEmail({ companyId: member.companyId, from, replyTo, to: client.email, subject, html, text });
  if (result?.skipped) {
    return NextResponse.json(
      { error: "Email isn't configured on this deployment yet — RESEND_API_KEY is missing, so nothing was sent." },
      { status: 503 },
    );
  }
  if (result?.error) {
    const message = typeof result.error === "string" ? result.error : result.error?.message || "Send failed";
    return NextResponse.json({ error: `The email couldn't be sent. ${message}` }, { status: 502 });
  }

  // Who emailed a credential, and to whom — the activity trail is where
  // "how did they get into the portal?" gets answered. Never throws.
  await recordActivity(member, {
    action: "client.portal_link_sent",
    entityType: "client",
    entityId: client.id,
    summary: `Emailed the portal link to ${client.name}`,
  });

  return NextResponse.json({ url, sentTo: client.email });
}
