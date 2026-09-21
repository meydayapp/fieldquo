// app/api/portal/[token]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";
import { latestPerFamily } from "@/lib/invoices/family";
import { loadDocumentCustomFields } from "@/lib/customFields/values";
import { resolveClientLanguage } from "@/lib/i18n/resolveLanguage";
import { taxStatement } from "@/lib/tax/documentTax";
import { documentTaxSentence } from "@/lib/tax/documentSentence";
import { bankDebitOffer } from "@/lib/stripe/bankDebit";
import { invoiceBalanceCents } from "@/lib/stripe";
import { howToPayFor, onlineOptions, HOW_TO_PAY_COMPANY_SELECT } from "@/lib/payments/offlineMethods";
import { orderPlan, planStatus } from "@/lib/jobs/plan";
import { changeOrderLabel } from "@/lib/jobs/changeOrderAddendum";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const client = await db.client.findUnique({
    where: { portalToken: _params.token },
    // Allow-list, not `include`. This used to have no top-level `select` at
    // all — every scalar on Client, Quote, Invoice and Job reached a
    // homeowner's browser on an unauthenticated (token-only) endpoint,
    // Quote.reviewNotes included, whose own schema comment says it must
    // never reach a client-facing surface. An allow-list fails CLOSED when a
    // field is added to one of these models tomorrow: it has to be named
    // here to leave the building, where `include` would have shipped it by
    // default. See docs/SECURITY-FIXES.md.
    select: {
      // Only what this route itself reads (resolveClientLanguage,
      // taxStatement below) or hands straight back as `clientName`. Nothing
      // else on Client — email, phone, address, notes, portalToken, type,
      // contactName, city, createdAt — reaches this route at all now.
      name: true,
      language: true,
      country: true, // resolveDocumentTax's jurisdiction lookup
      province: true, // same
      // Read by loadDocumentCustomFields below to find the company's own
      // definitions; the response builds its own object and never forwards it.
      companyId: true,
      company: {
        select: {
          name: true,
          logoUrl: true,
          // The client portal shows the invoice too, so the tax registration
          // number has to reach it — this narrowed select was the one surface
          // where the fields simply weren't loaded.
          taxIdName: true,
          taxIdNumber: true,
          brandColor: true,
          phone: true,
          email: true,
          currency: true,
          // The "paid in full — thank you" state on an invoice offers the
          // review link under it (Settings → Reviews). Null means no offer;
          // nothing is invented. Forwarded to the browser as-is: it is the
          // address the company already prints on its stickers.
          reviewUrl: true,
          // The fallback in resolveClientLanguage, below the client's own
          // preference. The portal isn't tied to a single document, so there's
          // no frozen document language here — it's client.language → company
          // default → en, the same rule as any other correspondence.
          defaultLanguage: true,
          // Whether the Pay button can actually do anything, and what to say
          // instead when it can't. Both are stripped from the payload below —
          // see the note on `onlinePayments`.
          stripeAccountId: true,
          stripeChargesEnabled: true,
          stripeBankDebitEnabled: true,
          // The "How to pay" block is rendered per invoice below from these
          // (a stored block wins — see howToPayFor) and every one of them
          // is stripped from `company` before the response: the homeowner
          // receives the sentences, never the settings, and an ACH account
          // number reaches the browser only inside the rendered block.
          ...HOW_TO_PAY_COMPANY_SELECT,
          // ── For the tax line, and stripped from the payload below ────────
          //
          // Every invoice in this portal carries a tax row, and a row reading
          // "$0.00" is a claim the invoice may not be able to back — see
          // lib/tax/documentTax.js and Q-2026-0011. These decide which of the
          // three sentences that row makes; the homeowner receives the
          // sentence, never the settings.
          province: true,
          country: true,
          taxRate: true,
          autoApplyLocalTax: true,
          vatRegistered: true,
          usTaxOverrides: true,
        },
      },
      // Drafts stay in the office, same rule the public quote page already
      // enforces by 404ing one ("A draft was never meant to leave the office").
      // The portal was the exception: it listed every quote with its total, so
      // an auto-generated instant estimate — flagged needsReview, priced by
      // nobody — appeared in the homeowner's own account as a figure from the
      // company. They could not approve it (that link is gated on `sent`), but
      // seeing it is enough: it is a number the contractor may then have to
      // argue down from, and they never agreed to it in the first place.
      quotes: {
        where: { status: { not: "draft" } },
        orderBy: { createdAt: "desc" },
        // Exactly what ClientPortal.js renders per quote: the number, the
        // total, the date, the status pill, and the share token that builds
        // its "review" link. Everything else on Quote — reviewNotes (whose
        // own schema comment says it must never reach a client-facing
        // surface), aiReview, aiReviewedAt, aiVisionPasses, autoEstimated,
        // needsReview, processNotes, declineReason, followUpCount,
        // followUpSentAt, estimateSource, estimateData, composeSeconds,
        // sourceCallId, createdById, assignedToId, reviewedById, and every
        // other internal column — stays on the server.
        select: {
          id: true,
          quoteNumber: true,
          total: true,
          createdAt: true,
          status: true,
          shareToken: true,
        },
      },
      // ── Only invoices that have actually been ISSUED ──────────────────
      //
      // This returned every invoice, drafts included, and ClientPortal counts
      // what it gets into "Balance owing" and the unpaid list. A draft is an
      // internal staging document — the contractor is still deciding the
      // figure — so a homeowner was being shown money owed on a bill nobody
      // had sent them, and could pay it.
      //
      // That was already possible; it becomes routine now that accepting a
      // quote creates a draft invoice automatically, so the predicate has to
      // be right rather than incidental.
      //
      // Issued means one of two things, because there are two honest routes to
      // it: `sentAt` is stamped only after Resend accepts the email (never by
      // a button that merely changes a word — see the field's own comment), and
      // a status past draft covers an invoice settled in person and marked paid
      // without email ever being involved. A draft with neither is not a bill
      // yet, and the client's own copy should not be where they find out
      // otherwise.
      invoices: {
        where: { OR: [{ sentAt: { not: null } }, { status: { not: "draft" } }] },
        orderBy: { createdAt: "desc" },
        // What PortalInvoice.js and ClientPortal.js render, plus taxEnabled
        // and createdAt, which never leave this route — they only feed
        // taxStatement() below to compute taxKind/taxAssumedRegion. The old
        // `include: { payments: true }` shipped every Payment row (processor
        // ids included) to the browser; nothing in either portal component
        // reads `invoice.payments`, so it's dropped rather than narrowed.
        select: {
          id: true,
          // Which family this row belongs to and where it sits in it — read
          // below to show one current document per invoice. Not sensitive.
          parentInvoiceId: true,
          version: true,
          invoiceNumber: true,
          total: true,
          amountPaid: true,
          dueDate: true,
          lineItems: true,
          notes: true,
          subtotal: true,
          discount: true,
          tax: true,
          taxEnabled: true,
          // What the line said — read below for the kind and the sentence,
          // never forwarded raw.
          taxResolution: true,
          createdAt: true,
          // A bank debit on its way, or one that bounced — the portal says
          // so beside the balance (lib/stripe/settleCheckoutSession.js).
          pendingPaymentMethod: true,
          pendingPaymentAt: true,
          pendingPaymentFailedAt: true,
          pendingPaymentFailure: true,
          // The "How to pay" block as sent (lib/payments/offlineMethods.js),
          // and the document's language for building one when the invoice
          // was issued before the block existed.
          howToPay: true,
          language: true,
          // Payment-schedule stages this invoice carries — only the fields
          // safe for a stranger's browser: a label and an amount, never the
          // internal trigger/percentage/job link. `requested` only: a
          // `pending` stage hasn't been asked for yet (nothing to show), and
          // once `waived` there is nothing to pay. Lets PortalInvoice.js show
          // "Deposit — $X due now" instead of the invoice's full remaining
          // balance when the client arrived via a stage's own email link
          // (?stage=<id>) — see lib/paymentSchedule/run.js.
          jobPaymentStages: {
            where: { status: "requested" },
            orderBy: { seq: "asc" },
            select: { id: true, label: true, amountCents: true },
          },
        },
      },
      // ── Jobs, back with a real select ───────────────────────────────────
      //
      // `jobs` used to be fetched here whole (visits, technician ids,
      // checklists) and was dropped because nothing rendered it — "add it
      // back with a real select the day the portal actually shows job
      // status". That day: ClientPortal.js's job card shows the plan's steps
      // as Done · In progress · Waiting on, the dates, the photos the crew
      // filed against a step, and the change orders awaiting the client's
      // signature.
      //
      // The allow-list is the boundary. Per step: title, status, due date,
      // the step it waits on (title only), the hold reason, the change order
      // it waits on. NOT its description (that is where staff write notes),
      // NOT its estimate (hours are effort, effort is price), NOT its
      // assignee id. Only steps the office marked clientVisible (default off
      // — see Task.clientVisible). Photos: only those filed against such a
      // step, and never the `issue` stage, whose own comment says "never to
      // publish".
      jobs: {
        where: {
          archivedAt: null,
          status: { in: ["unscheduled", "scheduled", "in_progress", "completed"] },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          startDate: true,
          endDate: true,
          completedAt: true,
          tasks: {
            where: { planStep: true, clientVisible: true, status: { not: "cancelled" } },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              title: true,
              status: true,
              dueDate: true,
              scheduledStart: true,
              waitingReason: true,
              waitingOnChangeOrderId: true,
              updatedAt: true,
              dependsOn: { select: { dependsOn: { select: { id: true, title: true, status: true } } } },
              photos: {
                where: { stage: { not: "issue" } },
                orderBy: { createdAt: "asc" },
                select: { id: true, url: true, createdAt: true },
              },
            },
          },
          changeOrders: {
            where: { status: "waiting_client", shareToken: { not: null } },
            orderBy: { createdAt: "asc" },
            select: { id: true, seq: true, createdAt: true, description: true, shareToken: true },
          },
          // Who is on site right now: open time entries on this job. The
          // worker's name and the clock-in time, nothing else about the
          // entry.
          timeEntries: {
            where: { clockOut: null },
            select: { clockIn: true, worker: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!client)
    return NextResponse.json(
      { error: "Portal link not found" },
      { status: 404 },
    );

  // ── One current document per invoice, and the family's real balance ──────
  //
  // An amended invoice is several Invoice rows (root + versions), and every
  // issued one of them matched the where above — so a client saw v1 AND v2,
  // both payable, and could pay the same bill twice. Only the latest version
  // of each family is shown now, judged over the WHOLE family rather than the
  // issued rows alone, so a superseded version is never the one on offer.
  //
  // Its amountPaid is re-derived from every Payment row in the family: the
  // cache on a version amended before this rule existed can be stale, and
  // this is the number a homeowner decides to pay against. Payment rows never
  // leave the server — the select above dropped them for a reason. See
  // lib/invoices/family.js.
  {
    const listed = client.invoices || [];
    const rootIds = [...new Set(listed.map((i) => i.parentInvoiceId || i.id))];
    if (rootIds.length) {
      const members = await db.invoice.findMany({
        where: { OR: [{ id: { in: rootIds } }, { parentInvoiceId: { in: rootIds } }] },
        select: { id: true, parentInvoiceId: true, version: true },
      });
      const latestIdByRoot = new Map();
      for (const m of latestPerFamily(members)) latestIdByRoot.set(m.parentInvoiceId || m.id, m.id);
      const current = listed.filter((i) => latestIdByRoot.get(i.parentInvoiceId || i.id) === i.id);

      const memberIds = members.map((m) => m.id);
      const rootOf = new Map(members.map((m) => [m.id, m.parentInvoiceId || m.id]));
      const payments = memberIds.length
        ? await db.payment.findMany({
            where: { invoiceId: { in: memberIds } },
            select: { invoiceId: true, amount: true, refundedAmount: true, disputeStatus: true },
          })
        : [];
      for (const inv of current) {
        const root = inv.parentInvoiceId || inv.id;
        const familyRows = payments.filter((p) => rootOf.get(p.invoiceId) === root);
        inv.amountPaid = computeInvoiceState({ total: inv.total, payments: familyRows }).amountPaid;
      }
      client.invoices = current;
    }
  }

  // ── Can this company actually take a card? ────────────────────────────────
  //
  // Both portal surfaces used to render "Pay $X" for any unpaid invoice, with
  // no way to know: the POST to /pay then 400'd with "This company can't accept
  // online payments yet" under the contractor's own logo. That's a control that
  // appears to work and doesn't, on the one surface a stranger sees.
  //
  // Derived here rather than shipped raw: `stripeAccountId` is a Stripe
  // connected-account id on a PUBLIC, token-only endpoint, and the homeowner
  // needs the answer, not the account. So the two Stripe fields are destructured
  // off and never reach the response.
  //
  // The five tax settings go the same way and for the same reason: what the
  // homeowner needs is what each invoice's tax line SAYS, resolved below.
  const {
    stripeAccountId,
    stripeChargesEnabled,
    stripeBankDebitEnabled: _bankDebitEnabled,
    paymentMethods: _paymentMethods,
    paymentMethodDetails: _paymentMethodDetails,
    offerFinancing: _offerFinancing,
    stripeAffirmStatus: _stripeAffirmStatus,
    address: _address,
    taxRate: _taxRate,
    autoApplyLocalTax: _autoApply,
    vatRegistered: _vatRegistered,
    usTaxOverrides: _usTaxOverrides,
    ...companyView
  } = client.company || {};
  const onlinePayments = Boolean(stripeAccountId && stripeChargesEnabled);
  // "Pay from bank account" renders only when Stripe has ACTIVATED the
  // capability, the company bills in that method's currency, AND the amount
  // is inside Stripe's per-debit cap ($3,000 CAD for PAD — measured, see
  // lib/stripe/bankDebit.js). The cap is why this is decided per invoice
  // (and per payment stage) below rather than once per company: a $4,150
  // invoice used to render the bank button, and the tap answered with a
  // 500 from Stripe's `amount_too_large`. The offer carries the method,
  // whether THIS amount qualifies and the cap — so the page can say why the
  // button is missing — and never a fee (non-negotiable #4: the fee is the
  // contractor's).
  const offerFor = (amountCents) =>
    onlinePayments ? bankDebitOffer({ company: client.company, amountCents }) : null;

  // Per invoice, because each was raised on its own day with its own decision
  // about tax. `asOf` is the invoice's creation date so a rate change last
  // month cannot re-explain a bill sent before it.
  // The company's own boxes flagged for the document (a PO number), per
  // invoice family — the same line the emailed copy and the PDF print. One
  // query per invoice; the portal lists a handful, never hundreds.
  const customFieldsByInvoice = new Map(
    await Promise.all(
      client.invoices.map(async (invoice) => [
        invoice.id,
        await loadDocumentCustomFields(db, client.companyId, "invoice", invoice.id),
      ]),
    ),
  );

  const invoices = client.invoices.map((invoice) => {
    const statement = taxStatement({
      taxEnabled: invoice.taxEnabled,
      tax: invoice.tax,
      stored: invoice.taxResolution || null,
      company: client.company || {},
      client,
      asOf: invoice.createdAt,
      lang: resolveClientLanguage(client, client.company),
    });
    // Explicit allow-list, not `...invoice`: taxEnabled and createdAt above
    // are read to COMPUTE taxKind, not to be forwarded, and spreading the
    // row would ship them to the browser anyway — the same "select is the
    // real fix" reasoning as the query above, applied to the one place a
    // field could still sneak back in after it.
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      dueDate: invoice.dueDate,
      // Only what the company flagged for the document, with an answer.
      customFields: customFieldsByInvoice.get(invoice.id) || [],
      lineItems: invoice.lineItems,
      notes: invoice.notes,
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      tax: invoice.tax,
      // The allow-list is the right shape and it is also the thing that has to
      // be kept in step: the query above gained `jobPaymentStages` when the
      // payment-schedule engine landed, and this map — written earlier, to stop
      // `...invoice` shipping columns nobody asked for — silently dropped it
      // again. PortalInvoice.js looked for the stage, never found one, and fell
      // through to the invoice's full remaining balance.
      //
      // Which meant the deposit email's own link (?stage=<id>, minted in
      // lib/paymentSchedule/run.js) opened a page headed BALANCE DUE $12,000
      // with a "Pay $12,000" button — while the pay route, re-deriving the
      // figure from the stage row, charged the $3,000 the email had asked for.
      // The number the client agreed to and the number they were shown were
      // different numbers, on the payment screen.
      //
      // Already narrow at the source: id, label and amountCents only, and only
      // `requested` stages. Nothing further to strip here.
      //
      // Each stage carries its own bank-debit offer: a $3,000 deposit on a
      // $12,000 invoice is inside PAD's cap even though the balance is not,
      // and the pay route charges the stage's share, so the stage's share
      // is what the cap is measured against (capped at the balance, as the
      // charge itself is — lib/stripe.js createInvoiceCheckoutSession).
      jobPaymentStages: (invoice.jobPaymentStages || []).map((stage) => ({
        ...stage,
        bankDebit: offerFor(Math.min(stage.amountCents, invoiceBalanceCents(invoice))),
      })),
      // The bank-debit offer for the invoice's whole remaining balance —
      // null when the company cannot take bank debit at all.
      bankDebit: offerFor(invoiceBalanceCents(invoice)),
      // Pending / failed bank debit, as a state and Stripe's reason — no
      // intent id, nothing the browser can act on.
      pendingPayment: invoice.pendingPaymentAt && !invoice.pendingPaymentFailedAt
        ? { method: invoice.pendingPaymentMethod, at: invoice.pendingPaymentAt }
        : null,
      failedPayment: invoice.pendingPaymentFailedAt
        ? { method: invoice.pendingPaymentMethod, at: invoice.pendingPaymentFailedAt, reason: invoice.pendingPaymentFailure }
        : null,
      // How to pay: the block stored at send time, else one built now in the
      // document's language. Rendered sentences only — the company's
      // settings above never leave this route.
      howToPay: howToPayFor(invoice, {
        company: client.company || {},
        language: invoice.language || resolveClientLanguage(client, client.company),
        online: onlinePayments ? onlineOptions(client.company) : null,
      }),
      taxKind: statement.kind,
      taxAssumedRegion: statement.assumed ? statement.assumedRegion : null,
      taxSentence:
        statement.kind === "off"
          ? ""
          : documentTaxSentence(invoice.taxResolution, resolveClientLanguage(client, client.company)),
    };
  });

  // ── The job card's rows, derived here so the browser never sees a raw
  //    task row. Status is lib/jobs/plan.js's derived one — "waiting" when a
  //    blocker is not done, the change order is unsigned, or a hold reason
  //    was written — and the change-order labels are the same CO-n the
  //    addendum carries.
  const now = new Date();
  const jobs = (client.jobs || [])
    // A finished job stays on the card for a month, then drops off: the
    // homeowner opened this to see where things are, not a history.
    .filter((j) => j.status !== "completed" || !j.completedAt || now - new Date(j.completedAt) < 31 * 86400000)
    .map((j) => {
      const coRows = j.changeOrders || [];
      const labelOf = (id) => {
        const co = coRows.find((c) => c.id === id);
        return co ? changeOrderLabel(co, coRows) : null;
      };
      const steps = orderPlan(j.tasks || []).map((t) => {
        const blockers = (t.dependsOn || []).map((d) => d.dependsOn).filter(Boolean);
        const co = t.waitingOnChangeOrderId ? coRows.find((c) => c.id === t.waitingOnChangeOrderId) : null;
        const derived = planStatus(t, blockers, co ? { ...co, label: changeOrderLabel(co, coRows) } : null);
        return {
          id: t.id,
          title: t.title,
          status: derived.status,
          waitingOn: derived.waitingOn.map((w) => ({
            kind: w.kind,
            label: w.label,
            ...(w.kind === "change_order" ? { changeOrderLabel: labelOf(w.id), shareToken: coRows.find((c) => c.id === w.id)?.shareToken || null } : {}),
          })),
          dueDate: t.scheduledStart || t.dueDate || null,
          doneAt: t.status === "done" ? t.updatedAt : null,
          photos: (t.photos || []).map((p) => ({ id: p.id, url: p.url, at: p.createdAt })),
        };
      });
      const overdue = steps.some((s) => s.status !== "done" && s.dueDate && new Date(s.dueDate) < now);
      return {
        id: j.id,
        title: j.title,
        status: j.status,
        startDate: j.startDate,
        endDate: j.endDate,
        completedAt: j.completedAt,
        onSchedule: !overdue,
        steps,
        changeOrders: coRows.map((co) => ({
          id: co.id,
          label: changeOrderLabel(co, coRows),
          description: co.description,
          shareToken: co.shareToken,
        })),
        onSite: (j.timeEntries || [])
          .filter((e) => e.worker?.name)
          .map((e) => ({ name: e.worker.name, since: e.clockIn })),
      };
    });

  return NextResponse.json({
    clientName: client.name,
    // Resolved once, server-side, so both portal components read the same
    // language the client was written to elsewhere. client.language is
    // selected explicitly above for exactly this.
    language: resolveClientLanguage(client, client.company),
    company: companyView,
    onlinePayments,
    // No company-level `bankDebit` here any more: the answer depends on the
    // amount, so it lives on each invoice and each stage above.
    quotes: client.quotes,
    invoices,
    jobs,
  });
}
