// app/api/public/quotes/[token]/route.js
//
// The client's side of a quote. No session — the share token IS the
// credential, same pattern as app/api/kitchen-design/[token].
//
// Because there's no auth, the response is assembled field by field rather
// than passed straight through from Prisma. A spread of the quote row would
// leak internal costing, createdById, the tier group, and the company's whole
// record to anyone with the link.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAppOrigin } from "@/lib/appUrl";
import { formatMoney } from "@/lib/currency";
import { attachServiceSettings } from "@/lib/documents/loadServiceSettings";
import { onQuoteAccepted, onQuoteDeclined } from "@/lib/quotes/quoteLifecycle";
import { recordActivity } from "@/lib/activity/log";
import { buildSignatureRecord } from "@/lib/documents/signatureAudit";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { taxStatement } from "@/lib/tax/documentTax";
import { usableSections } from "@/lib/documents/templateKind";
import { financingOffer } from "@/lib/estimate/financing";
import { financingTerms } from "@/lib/financing/monthlyEstimate";

// First hop of x-forwarded-for is the client on Vercel. Best-effort — an audit
// record with a null IP is still a valid signature, just weaker evidence.
function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || null;
}
import {
  resolveServiceContent,
  dominantGlossary,
  dominantProcessSteps,
} from "@/lib/documents/serviceContent";
// From lib/documents, NOT from the PDF section that also uses it — that
// module imports @react-pdf/renderer, and a public endpoint a stranger hits
// on a phone has no business loading a PDF engine to format a percentage.
import { parsePaymentSchedule } from "@/lib/documents/paymentSchedule";

const num = (v) => Number(v ?? 0);

async function loadQuote(token) {
  if (!token) return null;

  const quote = await db.quote.findUnique({
    where: { shareToken: token },
    include: {
      client: {
        select: { name: true, email: true, address: true, language: true },
      },
      company: {
        // No id. `present()` returns this object wholesale to an
        // unauthenticated caller, and quote.companyId below covers the one
        // place the id is actually needed.
        select: {
          name: true,
          logoUrl: true,
          brandColor: true,
          email: true,
          phone: true,
          website: true,
          address: true,
          paymentTerms: true,
          paymentMethods: true,
          currency: true,
          // The company default is only the fallback in resolveClientLanguage,
          // below the quote's own language and the client's preference — but
          // the page still needs it to land somewhere sensible for a client
          // who never set a language on an older quote with none frozen.
          defaultLanguage: true,
          // Stripped back out in present() — see the destructure there. It is
          // selected because the financing block is built from it server-side,
          // not because a stranger should receive the raw setting.
          financing: true,
          // ── Also stripped in present() ────────────────────────────────────
          //
          // These five decide what the TAX LINE on this page is allowed to
          // say, and the decision is made server-side: the page receives
          // `taxKind` and a province name, never the company's tax settings.
          //
          // province/country add no exposure — `address` above already carries
          // both to the same stranger. The other three are settings and are
          // peeled off before the response is built.
          province: true,
          country: true,
          taxRate: true,
          autoApplyLocalTax: true,
          vatRegistered: true,
        },
      },
      scopeGroups: {
        orderBy: { sortOrder: "asc" },
        include: { category: { select: { key: true, label: true } } },
      },
      addOns: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!quote) return null;

  // Per-service wording this company has customised, if any. Attached before
  // present() so the page and the PDF resolve identical content — a client who
  // reads the web quote and then opens the attachment should not find two
  // different documents.
  quote.scopeGroups = await attachServiceSettings(
    db,
    quote.companyId,
    quote.scopeGroups,
  );

  return quote;
}

// The rate actually applied to THIS quote, recovered from its own stored
// figures rather than read off the company record.
//
// Those two can differ — a company that changed its tax rate last month must
// not have that change silently reprice a quote sent before it, and a quote
// with tax switched off must stay that way when an extra is added. Deriving
// it from what's on the document keeps the maths consistent with the numbers
// the client is already looking at.
function effectiveTaxRate(quote) {
  if (!quote.taxEnabled) return 0;
  const base = num(quote.subtotal) - num(quote.discount);
  if (base <= 0) return 0;
  return num(quote.tax) / base;
}

const round = (n) => Math.round(n * 100) / 100;

/**
 * Recomputes the document total for a set of chosen extras.
 *
 * THE ONLY PLACE a total involving add-ons is ever produced. The browser
 * shows a figure so the client can see what they're agreeing to, but that
 * figure is never sent back and never trusted — this function recalculates
 * from the prices stored on the server, using only the ids that were ticked.
 * Someone editing the page can change what they SEE; they cannot change what
 * they are charged.
 */
function priceWithAddOns(quote, selectedIds) {
  const chosen = quote.addOns.filter((a) => selectedIds.includes(a.id));

  const extras = chosen.reduce((s, a) => s + num(a.amount), 0);
  const taxableExtras = chosen
    .filter((a) => a.taxable)
    .reduce((s, a) => s + num(a.amount), 0);

  const rate = effectiveTaxRate(quote);
  const subtotal = round(num(quote.subtotal) + extras);
  const tax = round(num(quote.tax) + taxableExtras * rate);
  const total = round(subtotal - num(quote.discount) + tax);

  return { chosen, extras: round(extras), subtotal, tax, total };
}

// What the client-facing page is told about financing, or null.
//
// Two separate things, deliberately kept apart:
//
//   offer  — mode/note/url, the company's own words and (maybe) a hand-off link.
//            financingOffer has never had a number in its shape and still doesn't.
//   terms  — the APR and term the COMPANY typed into its own settings, or null.
//            Null is the normal case, and null means the page shows no monthly
//            figure at all. There is no default rate and no default term
//            anywhere in the stack to fall back on.
//
// The terms travel rather than a computed payment because the total moves as
// the client ticks extras, and an instalment that stayed frozen at the
// pre-extras figure would be a wrong number on the one line they'll act on. The
// page recomputes with the same pure module the check script exercises. Nothing
// numeric is ever sent back — see priceWithAddOns.
function financingBlock(quote) {
  const raw = quote.company?.financing;
  const offer = financingOffer(raw, {
    language: resolveClientLanguage({
      document: quote,
      client: quote.client,
      company: quote.company,
    }),
  });
  if (!offer) return null;
  return { ...offer, terms: financingTerms(raw) };
}

function present(quote) {
  // financing is company-level configuration, not something a stranger with a
  // link should receive verbatim; `company` below is returned wholesale, so it
  // is peeled off here and re-published only in the shape financingBlock allows.
  //
  // The five tax settings go the same way, for the same reason: what a
  // stranger needs is what this quote's tax line SAYS, not the configuration
  // behind it. `taxLine` below is that sentence and nothing more.
  const {
    financing: _financing,
    taxRate: _taxRate,
    autoApplyLocalTax: _autoApply,
    vatRegistered: _vatRegistered,
    ...companyPublic
  } = quote.company || {};

  // ── Why the page is told a KIND and not just a number ────────────────────
  //
  // Q-2026-0011 rendered "Tax $0.00" here on $5,250 of Ontario work with tax
  // switched on. A money row saying zero is a claim the quote could not back.
  // The kind lets the page print "To be confirmed" instead — and, when the
  // rate came from the contractor's own province rather than the homeowner's,
  // say so to the one person who can correct it.
  const statement = taxStatement({
    taxEnabled: quote.taxEnabled,
    tax: quote.tax,
    company: quote.company || {},
    client: quote.client,
    asOf: quote.createdAt,
    lang: resolveClientLanguage({
      document: quote,
      client: quote.client,
      company: quote.company,
    }),
  });

  return {
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    // The fully RESOLVED language, not the raw quote.language, so the page
    // matches the PDF and the covering email exactly: quote.language →
    // client.language → company.defaultLanguage → en. A quote created before
    // languages existed (no frozen language) still reaches the client's own
    // preference instead of silently defaulting to English on screen.
    language: resolveClientLanguage({
      document: quote,
      client: quote.client,
      company: quote.company,
    }),
    notes: quote.notes,
    processNotes: quote.processNotes,
    validUntil: quote.validUntil,
    sentAt: quote.sentAt,
    subtotal: num(quote.subtotal),
    discount: num(quote.discount),
    tax: num(quote.tax),
    // "charged" | "off" | "none" | "unresolved" — see lib/tax/documentTax.js.
    // Recomputed on the page as add-ons are ticked: an extra that carries tax
    // turns an unresolved line into a charged one.
    taxKind: statement.kind,
    // The province the rate was ASSUMED from, or null. Never presented as
    // determined — see QuoteApproval.
    taxAssumedRegion: statement.assumed ? statement.assumedRegion : null,
    total: num(quote.total),
    // Present once decided, so a client reopening the link sees the figure
    // they actually agreed to rather than the pre-add-on quote total.
    acceptedTotal:
      quote.acceptedTotal === null ? null : num(quote.acceptedTotal),
    // The rate is sent so the page can show a live total as boxes are ticked.
    // It's display only — see priceWithAddOns.
    taxRate: effectiveTaxRate(quote),
    addOns: quote.addOns.map((a) => ({
      id: a.id,
      description: a.description,
      detail: a.detail,
      amount: num(a.amount),
      taxable: a.taxable,
      selected: a.selected,
    })),
    client: { name: quote.client?.name || "" },
    company: companyPublic,
    financing: financingBlock(quote),
    scopeGroups: quote.scopeGroups.map((g) => {
      // Resolved server-side rather than sent as a category key for the page
      // to look up. The client bundle then carries no copy of the trade
      // content at all — it's several kilobytes of prose that a stranger's
      // phone has no reason to download sixty trades of.
      // g.takeoff is read HERE and never returned. It picks which scope
      // paragraph this trade prints — a refacing job in thermofoil is not the
      // sanded-and-sprayed job painted MDF is — and it must not travel any
      // further: a countertop takeoff carries the supplier's cost and the
      // company's markup, which is precisely what this endpoint exists to keep
      // away from a stranger's browser.
      const content = resolveServiceContent(
        g.category?.key,
        g.companySettings || null,
        g.takeoff,
      );
      return {
        label: g.label || g.category?.label || "Scope",
        subtotal: num(g.subtotal),
        accent: content.accent,
        // "" for a trade that declares none, so the page renders no paragraph
        // rather than an empty block above the prices.
        description: content.description,
        included: content.included,
        // Empty for every trade that has none, so the page renders nothing
        // rather than a heading over a blank panel.
        mayChange: content.mayChange,
        lineItems: (Array.isArray(g.lineItems) ? g.lineItems : []).map(
          (li) => ({
            description: li.description || "",
            quantity: li.quantity ?? 1,
            amount: num(li.amount),
          }),
        ),
      };
    }),
    // The vocabulary of the trade the client is actually deciding about,
    // once. Same reasoning, and the same dominant-group rule, as the steps.
    glossary: dominantGlossary(
      quote.scopeGroups.map((g) => ({
        categoryKey: g.category?.key,
        override: g.companySettings || null,
        subtotal: num(g.subtotal),
      })),
    ),
    // Shown once at the bottom, from the largest scope group — see
    // dominantProcessSteps for why this isn't per-service.
    processSteps: dominantProcessSteps(
      quote.scopeGroups.map((g) => ({
        categoryKey: g.category?.key || null,
        override: g.companySettings || null,
        subtotal: num(g.subtotal),
      })),
    ),
    paymentTerms: quote.company?.paymentTerms || null,
    paymentSchedule: parsePaymentSchedule(quote.company?.paymentTerms),
  };
}

export async function GET(request, { params }) {
  const { token } = await params;
  const quote = await loadQuote(token);

  // Same message whether the token is malformed, expired or simply wrong —
  // no signal that distinguishes "this quote exists" from "it doesn't".
  if (!quote) {
    return NextResponse.json(
      { error: "This link isn't valid. Ask for a new one." },
      { status: 404 },
    );
  }

  // A draft was never meant to leave the office. If a link escapes before the
  // quote is sent, don't show numbers that are still being worked out.
  if (quote.status === "draft") {
    return NextResponse.json(
      { error: "This quote isn't ready yet." },
      { status: 404 },
    );
  }

  return NextResponse.json(present(quote));
}

// Accept or decline. The client is not authenticated beyond the token, so
// this is deliberately narrow: it sets status and nothing else.
export async function POST(request, { params }) {
  const { token } = await params;

  const body = await request.json().catch(() => ({}));
  const decision = body?.decision;

  if (!["accepted", "declined"].includes(decision)) {
    return NextResponse.json(
      { error: "Decision must be 'accepted' or 'declined'." },
      { status: 400 },
    );
  }

  const quote = await loadQuote(token);
  if (!quote || quote.status === "draft") {
    return NextResponse.json(
      { error: "This link isn't valid. Ask for a new one." },
      { status: 404 },
    );
  }

  // Already decided — return the current state rather than letting someone
  // flip an acceptance to a decline (or re-accept) by reloading the page.
  // Reversing a decision is a conversation, not a button.
  if (quote.status !== "sent") {
    return NextResponse.json(
      {
        error:
          quote.status === "accepted"
            ? "This quote has already been approved."
            : "This quote has already been declined.",
        status: quote.status,
      },
      { status: 409 },
    );
  }

  if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
    return NextResponse.json(
      { error: "This quote has expired. Ask for an updated one." },
      { status: 410 },
    );
  }

  // Which extras they ticked. Ids only — deliberately not amounts, not a
  // total. Anything the client could edit in the page is discarded here and
  // re-derived from the database below.
  const requestedIds = Array.isArray(body?.addOnIds)
    ? body.addOnIds.filter((id) => typeof id === "string")
    : [];

  // Intersected with what's actually on this quote, so an id copied from
  // another quote (or invented) simply doesn't appear in `chosen` and costs
  // nothing. No error is raised: a stranger fiddling with the page shouldn't
  // get a message confirming which ids exist.
  const validIds = quote.addOns.map((a) => a.id);
  const selectedIds = requestedIds.filter((id) => validIds.includes(id));

  const priced = priceWithAddOns(quote, selectedIds);

  const accepted = decision === "accepted";

  // The signature IS the approval. On acceptance, require it and capture a
  // tamper-evident audit record: the client supplies their name, drawn mark and
  // consent; the server adds IP, device, timestamp and a hash of the exact
  // priced quote (see lib/documents/signatureAudit.js). No valid signature → no
  // acceptance, so an approval can never be recorded without one.
  let signatureRecord = null;
  if (accepted) {
    const snapshot = {
      quoteNumber: quote.quoteNumber,
      companyId: quote.companyId,
      clientId: quote.clientId,
      currency: quote.currency,
      subtotal: priced.subtotal,
      tax: priced.tax,
      discount: quote.discount,
      total: priced.total,
      lineItems: quote.lineItems,
      scopeGroups: quote.scopeGroups,
      addOns: quote.addOns.map((a) => ({
        id: a.id,
        price: a.price,
        selected: selectedIds.includes(a.id),
      })),
    };
    signatureRecord = buildSignatureRecord({
      quote: snapshot,
      name: body?.signature?.name,
      signatureDataUrl: body?.signature?.dataUrl,
      consent: body?.signature?.consent === true,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    if (!signatureRecord) {
      return NextResponse.json(
        {
          error:
            "A signature is required to approve. Add your name, sign in the box, and tick the agreement.",
          needsSignature: true,
        },
        { status: 400 },
      );
    }
  }

  const updated = await db.quote.update({
    where: { shareToken: token },
    data: {
      status: decision,
      ...(signatureRecord ? { signature: signatureRecord } : {}),
      // Reuse the existing timestamp field rather than adding a new one; the
      // internal approval screen reads this to show when the client acted.
      clientDesignAt: new Date(),
      // Only on acceptance. A declined quote has no agreed figure, and
      // writing one would make "declined" and "accepted at $0 of extras"
      // indistinguishable later.
      ...(accepted
        ? {
            acceptedSubtotal: priced.subtotal,
            acceptedTax: priced.tax,
            acceptedTotal: priced.total,
          }
        : {}),
    },
    select: { id: true, status: true, companyId: true, quoteNumber: true },
  });

  // Record which extras were taken, so the invoice can be built from them and
  // the company can see what the upsell actually earned.
  if (accepted && selectedIds.length) {
    await db.quoteAddOn.updateMany({
      where: { id: { in: selectedIds }, quoteId: quote.id },
      data: { selected: true, selectedAt: new Date() },
    });
  }

  // Tell the people who need to act on it, and — on acceptance — send the
  // signed quote PDF to the client too, so both sides keep the same document.
  // Best-effort: a mail failure must not make the client think their approval
  // didn't register.
  try {
    await dispatchDecisionEmails(updated, quote, decision, priced, signatureRecord);
  } catch (err) {
    console.error("[public quote] notification failed:", err);
  }

  // On acceptance, turn the won work into a schedulable job and log it. Both
  // are best-effort and must never make the client's approval appear to fail —
  // the acceptance is already committed above.
  if (accepted) {
    try {
      // Turn the won work into a schedulable job, a draft invoice and a "put it
      // in the diary" task, and move the lead behind it to won. Shared with the
      // back-office path (PATCH /api/quotes/[id]) so the two can never drift —
      // they used to, and the back office was the one doing nothing.
      const { job, invoice } = await onQuoteAccepted(updated.id);
      await recordActivity(
        { companyId: updated.companyId },
        {
          action: "quote.accepted",
          entityType: "quote",
          entityId: updated.id,
          actorName: "Client (approval link)",
          summary: `Quote ${updated.quoteNumber} accepted by the client${job ? " — job created, ready to schedule" : ""}${invoice ? `, invoice ${invoice.invoiceNumber} drafted` : ""}`,
          metadata: {
            total: priced.total,
            jobId: job?.id || null,
            invoiceId: invoice?.id || null,
          },
        },
      );
    } catch (err) {
      console.error("[public quote] job/invoice/activity failed:", err);
    }
  } else {
    // A decline creates nothing, but it still closes the lead behind the quote.
    // A homeowner who bothers to type a reason is giving the contractor the
    // most valuable thing in this whole flow. Optional — declining must never
    // require an explanation.
    await onQuoteDeclined(updated.id, {
      reason: body?.declineReason || null,
    }).catch((err) =>
      console.error("[public quote] lead close failed:", err?.message),
    );
  }

  // The total is echoed back so the confirmation the client sees is the same
  // number the server committed — if the two ever disagreed, they'd find out
  // here rather than when the invoice arrived.
  return NextResponse.json({
    status: updated.status,
    total: accepted ? priced.total : null,
  });
}

// Everything the outcome sets in motion by email. On a decline this is what it
// always was: a plain internal note to the owners/admins. On an ACCEPTANCE it
// also renders the approved quote as a PDF and sends that same signed document
// to both sides — the client keeps a copy of what they agreed to, and the
// company's copy carries the attachment rather than just a link.
//
// The PDF engine (@react-pdf/renderer) is imported lazily here, never at module
// top: the far commoner path through this file is a stranger's GET, which has
// no business loading a rendering engine to format a percentage.
async function dispatchDecisionEmails(updated, quote, decision, priced, signatureRecord) {
  const { sendEmail, SENDER_SELECT } = await import("@/lib/email/resend");
  const { resolveSender } = await import("@/lib/email/companySender");

  const accepted = decision === "accepted";

  const [company, members] = await Promise.all([
    db.company.findUnique({
      where: { id: updated.companyId },
      // currency on top of the sender fields: the totals below are formatted
      // with it. It used to be hardcoded CAD, so a US or UK contractor read
      // their own approvals with the wrong symbol attached.
      select: { ...SENDER_SELECT, currency: true },
    }),
    db.member.findMany({
      where: {
        companyId: updated.companyId,
        active: true,
        role: { in: ["owner", "admin"] },
      },
      include: { user: { select: { email: true } } },
      distinct: ["userId"],
    }),
  ]);

  const { from, replyTo } = await resolveSender(
    company || {},
    updated.companyId,
  );

  // The document's own language, resolved the same way the covering email and
  // the PDF were at send time — so the signed copy the client now receives is
  // in the language they read the quote in.
  const language = resolveClientLanguage({
    document: quote,
    client: quote.client,
    company: quote.company,
  });

  // Rendered once, on acceptance only, and shared by both emails. Best-effort:
  // a PDF hiccup must not stop either notification — an approval that lands
  // without an attachment still beats one that never lands.
  let pdfBuffer = null;
  if (accepted) {
    try {
      pdfBuffer = await renderApprovedQuotePdf(
        quote,
        updated.companyId,
        priced,
        language,
        signatureRecord,
      );
    } catch (err) {
      console.error("[public quote] approved PDF render failed:", err?.message);
    }
  }

  const attachments =
    accepted && pdfBuffer?.length
      ? [{ filename: `Quote-${updated.quoteNumber}.pdf`, content: pdfBuffer }]
      : undefined;

  const base = getAppOrigin();
  const verb = accepted ? "approved" : "declined";
  // The company's own billing currency. No locale argument: this note goes to
  // the owner/admin, and formatMoney fixes the SYMBOL from the currency while
  // letting the reader's environment decide grouping — which is the right way
  // round. currencyMeta() falls back to the default for a blank column, so an
  // older company row that never set one still formats.
  const fmt = (n) => formatMoney(n, company?.currency);

  // ── The internal note (owners/admins) ──────────────────────────────────────
  const to = members.map((m) => m.user?.email).filter(Boolean);
  if (to.length) {
    // Extras go in the subject line, not buried in the body. Someone skimming
    // notifications on a phone should see that this approval is worth more than
    // the quote they sent — that's the whole return on offering them.
    const tookExtras = accepted && priced?.chosen?.length > 0;
    const subject = tookExtras
      ? `${quote.client?.name || "A client"} approved ${updated.quoteNumber} — plus ${fmt(priced.extras)} in extras`
      : `${quote.client?.name || "A client"} ${verb} ${updated.quoteNumber}`;

    const extrasBlock = tookExtras
      ? `<p style="margin-top:16px"><strong>They also added:</strong></p>
         <ul style="padding-left:18px">
           ${priced.chosen
             .map(
               (a) =>
                 `<li>${escapeHtml(a.description)} — ${fmt(Number(a.amount))}</li>`,
             )
             .join("")}
         </ul>
         <p><strong>Approved total: ${fmt(priced.total)}</strong></p>`
      : accepted && priced
        ? `<p><strong>Approved total: ${fmt(priced.total)}</strong></p>`
        : "";

    await sendEmail({
      // updated.companyId, not a value carried in from the request: this route
      // is reached by a stranger holding a share token, and the tenant is
      // whatever the quote row says it is.
      companyId: updated.companyId,
      from,
      to,
      subject,
      attachments,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <p><strong>${escapeHtml(quote.client?.name || "A client")}</strong> ${verb} quote
        <strong>${updated.quoteNumber}</strong>.</p>
        ${extrasBlock}
        <p><a href="${base}/app/quotes/${updated.id}">Open the quote →</a></p>
      </div>`,
    });
  }

  // ── The client's copy of the signed quote ───────────────────────────────────
  // Only on acceptance, only if we have somewhere to send it and a rendered PDF.
  // Nothing FieldQuo-branded here: the From line, the covering note and the
  // attachment all read as the contractor's own.
  const clientTo = (quote.client?.email || quote.sentToEmail || "").trim();
  if (accepted && clientTo && pdfBuffer?.length) {
    const { emailCopy } = await import("@/lib/i18n/emailCopy");
    const { clientDocCopy } = await import("@/lib/i18n/clientDocCopy");
    const ec = emailCopy(language);
    const dc = clientDocCopy(language);
    const companyName = quote.company?.name || "";
    const clientFirst = String(quote.client?.name || "").split(" ")[0] || "";

    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#2d2520">
      <p>${escapeHtml(ec.greeting(clientFirst))}</p>
      <p>${escapeHtml(dc.approvedCopyIntro(companyName))}</p>
      <p style="color:#6b675f;font-size:13px">${escapeHtml(ec.questions(quote.company?.phone))}</p>
      <p><strong>${escapeHtml(companyName)}</strong></p>
    </div>`;
    const text = [
      ec.greeting(clientFirst),
      "",
      dc.approvedCopyIntro(companyName),
      "",
      ec.questions(quote.company?.phone),
      companyName,
    ]
      .filter((l) => l !== "")
      .join("\n");

    await sendEmail({
      companyId: updated.companyId,
      from,
      replyTo,
      to: clientTo,
      subject: `${dc.approvedTitle} — ${updated.quoteNumber}`,
      html,
      text,
      attachments,
    });
  }
}

// Renders the approved quote to a PDF buffer, using the same engine, sections
// and client-aware language as the original send (app/api/quotes/[id]/send).
// The accepted subtotal/tax/total are threaded in so the signed copy shows the
// figure the client actually agreed to — extras included — not the pre-add-on
// quote total sitting on the row.
//
// `signatureRecord` is threaded in explicitly rather than read off `quote`:
// `quote` was loaded by loadQuote() BEFORE this same request wrote the
// signature to the database, so quote.signature is still the pre-signing
// value (usually undefined). Without this, SignatureSection's `data.signature
// ? renderSigned : renderBlank` branch always takes the blank path on the
// very PDF this endpoint exists to send — the signature is real and stored,
// it just never reached the renderer.
async function renderApprovedQuotePdf(quote, companyId, priced, language, signatureRecord) {
  const { renderDocumentPdfBuffer } =
    await import("@/app/admin/lib/pdf/renderDocumentPdf");
  const { getDefaultSections } =
    await import("@/app/admin/lib/pdf/defaultSections");

  const [fullCompany, template] = await Promise.all([
    db.company.findUnique({ where: { id: companyId } }),
    db.documentTemplate.findFirst({
      where: { companyId, type: "quote_pdf", isDefault: true },
    }),
  ]);

  const sections = usableSections(
    "quote_pdf",
    template?.sections || getDefaultSections("quote_pdf"),
  ).sections;
  // quote.scopeGroups already carry this company's customised service wording —
  // attachServiceSettings ran in loadQuote — so the PDF resolves the identical
  // content the client saw on the page.
  const buffer = await renderDocumentPdfBuffer({
    sections,
    language,
    data: {
      ...quote,
      client: quote.client,
      scopeGroups: quote.scopeGroups,
      subtotal: priced.subtotal,
      tax: priced.tax,
      total: priced.total,
      signature: signatureRecord || quote.signature || null,
    },
    company: fullCompany,
  });
  return buffer?.length ? buffer : null;
}

// Client names and add-on text are typed by people and land in an HTML email.
// An apostrophe is the common case; a stray tag is the reason this exists.
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
