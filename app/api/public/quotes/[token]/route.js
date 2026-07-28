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

const num = (v) => Number(v ?? 0);

async function loadQuote(token) {
  if (!token) return null;
  return db.quote.findUnique({
    where: { shareToken: token },
    include: {
      client: { select: { name: true, email: true, address: true } },
      company: {
        select: {
          name: true,
          logoUrl: true,
          brandColor: true,
          email: true,
          phone: true,
          website: true,
          address: true,
        },
      },
      scopeGroups: {
        orderBy: { sortOrder: "asc" },
        include: { category: { select: { label: true } } },
      },
      addOns: { orderBy: { sortOrder: "asc" } },
    },
  });
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

function present(quote) {
  return {
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    language: quote.language,
    notes: quote.notes,
    processNotes: quote.processNotes,
    validUntil: quote.validUntil,
    sentAt: quote.sentAt,
    subtotal: num(quote.subtotal),
    discount: num(quote.discount),
    tax: num(quote.tax),
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
    company: quote.company,
    scopeGroups: quote.scopeGroups.map((g) => ({
      label: g.label || g.category?.label || "Scope",
      subtotal: num(g.subtotal),
      lineItems: (Array.isArray(g.lineItems) ? g.lineItems : []).map((li) => ({
        description: li.description || "",
        quantity: li.quantity ?? 1,
        amount: num(li.amount),
      })),
    })),
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

  const updated = await db.quote.update({
    where: { shareToken: token },
    data: {
      status: decision,
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

  // Tell the people who need to act on it. Best-effort: a mail failure must
  // not make the client think their approval didn't register.
  try {
    await notifyCompany(updated, quote, decision, priced);
  } catch (err) {
    console.error("[public quote] notification failed:", err);
  }

  // The total is echoed back so the confirmation the client sees is the same
  // number the server committed — if the two ever disagreed, they'd find out
  // here rather than when the invoice arrived.
  return NextResponse.json({
    status: updated.status,
    total: accepted ? priced.total : null,
  });
}

async function notifyCompany(updated, quote, decision, priced) {
  const { Resend } = await import("resend");
  const { lazyClient } = await import("@/lib/lazyClient");
  const { senderFor, SENDER_SELECT } = await import("@/lib/email/resend");

  const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));

  const [company, members] = await Promise.all([
    db.company.findUnique({
      where: { id: updated.companyId },
      select: SENDER_SELECT,
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

  const to = members.map((m) => m.user?.email).filter(Boolean);
  if (!to.length) return;

  const { from } = senderFor(company || {});
  const base = getAppOrigin();
  const verb = decision === "accepted" ? "approved" : "declined";
  const fmt = (n) =>
    Number(n).toLocaleString("en-CA", { style: "currency", currency: "CAD" });

  // Extras go in the subject line, not buried in the body. Someone skimming
  // notifications on a phone should see that this approval is worth more than
  // the quote they sent — that's the whole return on offering them.
  const tookExtras = decision === "accepted" && priced?.chosen?.length > 0;
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
    : decision === "accepted" && priced
      ? `<p><strong>Approved total: ${fmt(priced.total)}</strong></p>`
      : "";

  await resend.emails.send({
    from,
    to,
    subject,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
      <p><strong>${escapeHtml(quote.client?.name || "A client")}</strong> ${verb} quote
      <strong>${updated.quoteNumber}</strong>.</p>
      ${extrasBlock}
      <p><a href="${base}/app/quotes/${updated.id}">Open the quote →</a></p>
    </div>`,
  });
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
