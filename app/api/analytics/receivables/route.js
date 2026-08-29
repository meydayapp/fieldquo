// app/api/analytics/receivables/route.js
//
// What the company is owed, with age — and what money has actually come in,
// month by month. Both halves of the dashboard's money panel.
//
// ══ Why one endpoint answers two questions ═════════════════════════════════
//
// They read the same two tables under the same two gates. Outstanding balances
// need every payment ever recorded (an amendment leaves the payment on the
// version it was taken against), and the trend needs payments by month — so a
// second endpoint would run the same query, repeat the same permission
// argument, and give the dashboard a second round trip for one row of panels.
// The payload names the two halves separately; nothing is conflated inside it.
//
// ══ The gates, and why there are two ═══════════════════════════════════════
//
//   invoices: view_only   this is the invoice list in another shape, one row
//                         per document with the client's name on it. A member
//                         refused GET /api/invoices must not read it here.
//   showPricing           every figure on the payload is money.
//
// Both refuse with 403, and the dashboard renders a refused panel as ABSENT —
// never as "$0 owed", which is a different and alarming claim about the
// business. See the comment at the top of app/app/page.js.
//
// Client contact details are REDACTED rather than refused: a member on
// clientsProperties `name_address_only` keeps the name and the address on each
// card and loses the email and the phone, because the point of that dial is
// that a chase list must not double as an exportable phone book.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import {
  hasLevel,
  requireToggle,
  permissionErrorResponse,
  redactClient,
} from "@/lib/permissions/enforce";
import {
  buildReceivables,
  buildRevenueTrend,
  TREND_PERIODS,
} from "@/lib/analytics/receivables";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "invoices",
    "view_only",
    "see what clients owe",
  );
  if (denied) return denied;

  try {
    requireToggle(full, "showPricing", "see what clients owe");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { searchParams } = new URL(request.url);
  const asked = Number(searchParams.get("months"));
  const months = TREND_PERIODS.includes(asked) ? asked : 6;

  // ── Every version, deliberately ─────────────────────────────────────────
  //
  // GET /api/invoices filters to `parentInvoiceId: null` because it lists
  // documents. This needs the whole family: `invoiceFamilies` picks the latest
  // version's money and the root's issue date, and handing it only the roots
  // would price every amended invoice at the figure it was first raised at.
  //
  // Unbounded on purpose. An outstanding balance has no age limit — a 2019
  // invoice nobody paid is exactly the row this panel exists to surface — and
  // there is no column that says "settled" to filter on without doing the
  // payment arithmetic first. These are small companies; the select is narrow.
  const [invoices, payments, company, autoRule] = await Promise.all([
    db.invoice.findMany({
      where: { companyId: member.companyId },
      select: {
        id: true,
        parentInvoiceId: true,
        version: true,
        invoiceNumber: true,
        status: true,
        total: true,
        dueDate: true,
        sentAt: true,
        createdAt: true,
        clientId: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            province: true,
          },
        },
      },
    }),
    db.payment.findMany({
      where: { invoice: { companyId: member.companyId } },
      select: { invoiceId: true, amount: true, date: true },
    }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { currency: true },
    }),
    // What the automation will do on its own, if anything. Reported so the
    // panel can state the truth either way — "a reminder goes out 5 days past
    // due" when a rule is live, and nothing at all when it isn't. A rule with
    // no template is skipped by the cron (see app/api/cron/follow-ups), so it
    // is not a rule that sends, and claiming otherwise would be the same dead
    // promise as a dead button.
    db.followUpRule.findFirst({
      where: {
        companyId: member.companyId,
        triggerEvent: "invoice_overdue",
        active: true,
        templateId: { not: null },
      },
      select: { id: true, name: true, delayValue: true, delayUnit: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const now = new Date();
  const receivables = buildReceivables({ invoices, payments, asOf: now });

  return NextResponse.json({
    currency: company?.currency || null,
    receivables: {
      ...receivables,
      invoices: receivables.invoices.map((row) => ({
        ...row,
        client: redactClient(full, row.client),
      })),
      // The credits list carries the same client rows and the same rule.
      credits: receivables.credits.map((row) => ({
        ...row,
        client: redactClient(full, row.client),
      })),
    },
    revenue: buildRevenueTrend({
      payments,
      months,
      // The whole payment table was loaded above, so "has this company ever
      // been paid" is answered from data rather than inferred from an empty
      // window. Absence and a run of quiet months are different screens.
      everRecorded: payments.length > 0,
      asOf: now,
    }),
    periods: TREND_PERIODS,
    // ── Whether the Send reminder button exists at all ──────────────────────
    //
    // Decided here because POST /api/invoices/[id]/request-payment enforces
    // exactly this level, and a button the server will 403 is the dead control
    // AGENTS.md forbids. The client renders the reminder action only when this
    // is true and the card carries a client email — that route refuses with a
    // 400 when there is no address on file, and it is better to say so than to
    // offer a button that fails on click.
    canRemind: hasLevel(full, "invoices", "view_create_edit"),
    automaticReminder: autoRule
      ? {
          name: autoRule.name,
          delayValue: autoRule.delayValue,
          delayUnit: autoRule.delayUnit,
        }
      : null,
  });
}
