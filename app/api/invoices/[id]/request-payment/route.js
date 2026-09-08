// app/api/invoices/[id]/request-payment/route.js
//
// Emails the client a link to pay what's still owed on an invoice.
//
// The link goes to the client portal, not to a raw Stripe URL. Two reasons:
// a Stripe Checkout session expires after 24 hours, so a raw link in an inbox
// goes dead by the next morning; and the portal is where the client can see
// what they're paying for before they pay it. The portal mints a fresh
// checkout session at the moment they click Pay.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { ensurePortalToken, portalUrl } from "@/lib/clientPortal";
import { buildInvoiceEmail } from "@/lib/email/invoiceEmail";
import { refreshFamilyLedger } from "@/lib/invoices/family";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

export async function POST(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Asking a client for money on the company's behalf is not a view-only act.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "request payment");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const invoice = await db.invoice.findFirst({
    where: { id, companyId: member.companyId },
    include: { client: true },
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A past job entered after the fact was paid before it was typed in; there
  // is no balance to chase and no client to chase it from. The page hides the
  // button; the route refuses, because a button hidden in one place is not a
  // rule.
  if (invoice.historicalImportedAt) {
    return NextResponse.json(
      { error: "This invoice was entered as a past job. Nothing is sent to the client for past jobs.", historical: true },
      { status: 409 },
    );
  }

  // The balance this email quotes is the FAMILY's — every payment across the
  // invoice's versions — recomputed now, not the cached columns the version
  // was created with. An invoice amended before the family ledger existed
  // kept a stale cache that healed only when money moved; this route read
  // it and emailed a homeowner $1,390.72 for a $1,190.72 balance (QA rerun,
  // 6 September). Refreshing here also writes the truth back to the row.
  const ledger = await refreshFamilyLedger(db, invoice.id);
  if (ledger) {
    invoice.amountPaid = ledger.state.amountPaid;
    invoice.amountDue = ledger.state.amountDue;
    invoice.amountRefunded = ledger.state.amountRefunded;
    invoice.status = ledger.state.status;
  }

  if (!invoice.client?.email) {
    return NextResponse.json(
      {
        error: `${invoice.client?.name || "This client"} has no email address on file. Add one on their client record first.`,
      },
      { status: 400 },
    );
  }

  const balance =
    Number(invoice.total || 0) - Number(invoice.amountPaid || 0);

  if (balance <= 0) {
    return NextResponse.json(
      { error: "This invoice is already paid in full." },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      ...SENDER_SELECT,
      logoUrl: true,
      brandColor: true,
      phone: true,
      // Same omission as the send route had: without it buildInvoiceEmail
      // formats every amount as CAD, so a chaser could name a different
      // currency than the invoice it is chasing.
      currency: true,
      paymentTerms: true,
      paymentMethods: true,
      defaultLanguage: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
    },
  });

  // Say so plainly rather than sending an email whose only button 500s.
  const canTakeCard = Boolean(
    company?.stripeAccountId && company?.stripeChargesEnabled,
  );

  const token = await ensurePortalToken(db, invoice.clientId, member.companyId);
  if (!token) {
    return NextResponse.json(
      { error: "Couldn't create a portal link for this client." },
      { status: 500 },
    );
  }

  const url = portalUrl(token, request);
  const { from, replyTo } = await resolveSender(company || {}, member.companyId);
  const body = await request.json().catch(() => ({}));
  const note = String(body?.note || "").trim();

  // Was a second, hand-rolled English template with its own layout and a
  // hardcoded dark button colour that vanished on a dark brand. A client
  // chasing one invoice would receive two emails that looked like they came
  // from different companies. Same builder now, in the client's language,
  // with `kind: "reminder"` changing only the framing.
  const { subject, html, text } = buildInvoiceEmail({
    invoice,
    client: invoice.client,
    company: company || {},
    url,
    canTakeCard,
    note,
    kind: "reminder",
    language: resolveClientLanguage({
      document: invoice,
      client: invoice.client,
      company,
    }),
  });

  // Through sendEmail rather than a Resend client of its own — see that
  // file's header for why there is now exactly one. The result is CHECKED,
  // which the old `await resend.emails.send(...)` never had to be because it
  // threw; sendEmail returns its failures instead, and an unchecked call here
  // would stamp sentAt on an invoice the client never received. That is the
  // precise bug the comment below spends four paragraphs warning about,
  // reintroduced by the refactor that was meant to be mechanical.
  const result = await sendEmail({
    companyId: member.companyId,
    from,
    replyTo,
    to: invoice.client.email,
    subject,
    html,
    text,
  });

  if (result?.skipped) {
    return NextResponse.json(
      {
        error:
          "Email isn't configured on this deployment yet — RESEND_API_KEY is missing, so nothing was sent.",
      },
      { status: 503 },
    );
  }
  if (result?.error) {
    const message =
      typeof result.error === "string" ? result.error : result.error?.message || "Send failed";
    return NextResponse.json({ error: `The email couldn't be sent. ${message}` }, { status: 502 });
  }

  // ── Chasing payment IS issuing the invoice ────────────────────────────────
  //
  // This route emailed the client a real link to pay and then recorded nothing
  // at all — no status, no sentAt. That was survivable while the portal showed
  // every invoice, and stops being survivable the moment it doesn't: the portal
  // now hides drafts (a draft is the contractor still deciding the figure, and
  // accepted quotes mint one automatically), so a payment request on a draft
  // sent the client to a page where their invoice did not exist. "Nothing
  // outstanding", under the contractor's logo, minutes after being asked to pay.
  //
  // Written only AFTER Resend accepts, for the same reason the send route does
  // it that way: sentAt is a record that something happened, not that somebody
  // intended it.
  //
  // Two deliberate narrowings, both copied from the send route's hard-won
  // shape. A paid or overdue invoice is not dragged back to "sent" because
  // someone chased it. And sentAt is stamped only when it is EMPTY — this
  // route is the reminder path, so overwriting would march the issue date
  // forward with every chase and lose when the client was first billed.
  //
  // Which is exactly why the chase needs a column of its own. With sentAt
  // frozen at the first send, a second chase changed nothing on the row and
  // wrote nothing to the activity log (the send route records `invoice.sent`;
  // this route recorded nothing), so "when did we last chase this" had no
  // answer anywhere in the product. lastChasedAt moves on EVERY accepted send
  // and chaseCount counts them — see the column comment in schema.prisma.
  const chasedAt = new Date();
  const stamped = await db.invoice.update({
    where: { id: invoice.id },
    data: {
      ...(invoice.sentAt ? {} : { sentAt: chasedAt, sentToEmail: invoice.client.email }),
      ...(invoice.status === "draft" ? { status: "sent" } : {}),
      lastChasedAt: chasedAt,
      chaseCount: { increment: 1 },
    },
    select: { lastChasedAt: true, chaseCount: true },
  });

  // `manual: true` so the log can tell a person pressing the button apart from
  // the overdue cron, should the cron ever start writing here too.
  await recordActivity(member, {
    action: "invoice.chased",
    entityType: "invoice",
    entityId: invoice.id,
    summary: `Chased invoice ${invoice.invoiceNumber} (${[balance.toFixed(2), company?.currency].filter(Boolean).join(" ")} owing) to ${invoice.client.email}`,
    metadata: { to: invoice.client.email, balance, manual: true },
  });

  return NextResponse.json({
    sent: true,
    to: invoice.client.email,
    balance,
    lastChasedAt: stamped.lastChasedAt,
    chaseCount: stamped.chaseCount,
    portalUrl: url,
    // The UI warns when this is false — the client will get an email they
    // can't act on, which is worth knowing before you hit send.
    onlinePaymentsEnabled: canTakeCard,
  });
}
