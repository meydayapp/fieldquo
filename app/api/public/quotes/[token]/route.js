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
    },
  });
}

function present(quote) {
  return {
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    language: quote.language,
    notes: quote.notes,
    validUntil: quote.validUntil,
    sentAt: quote.sentAt,
    subtotal: num(quote.subtotal),
    discount: num(quote.discount),
    tax: num(quote.tax),
    total: num(quote.total),
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

  const updated = await db.quote.update({
    where: { shareToken: token },
    data: {
      status: decision,
      // Reuse the existing timestamp field rather than adding a new one; the
      // internal approval screen reads this to show when the client acted.
      clientDesignAt: new Date(),
    },
    select: { id: true, status: true, companyId: true, quoteNumber: true },
  });

  // Tell the people who need to act on it. Best-effort: a mail failure must
  // not make the client think their approval didn't register.
  try {
    await notifyCompany(updated, quote, decision);
  } catch (err) {
    console.error("[public quote] notification failed:", err);
  }

  return NextResponse.json({ status: updated.status });
}

async function notifyCompany(updated, quote, decision) {
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

  await resend.emails.send({
    from,
    to,
    subject: `${quote.client?.name || "A client"} ${verb} ${updated.quoteNumber}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
      <p><strong>${quote.client?.name || "A client"}</strong> ${verb} quote
      <strong>${updated.quoteNumber}</strong>.</p>
      <p><a href="${base}/app/quotes/${updated.id}">Open the quote →</a></p>
    </div>`,
  });
}
