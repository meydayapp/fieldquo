// app/api/kitchen-design/[token]/route.js
//
// The client-facing kitchen designer, gated by share token only.
//
//   GET   — the design, with every price stripped out
//   PATCH — the client's version, merged over the contractor's
//
// Public. A homeowner holding a quote link has no account and never will, so
// the token IS the credential — same pattern as /q/[token] and /portal/[token].
//
// ── What this endpoint will not do ─────────────────────────────────────────
//
// It does not return prices. AGENTS.md §4: public endpoints never return rates,
// because publishing a rate card hands it to every competitor in the city, and a
// share link travels. The client already has their total on the quote itself;
// what they get here is the drawing.
//
// It does not accept prices either. The design comes back through
// mergeClientDesign, which re-attaches appliance pricing from the contractor's
// own copy and discards any rate card the browser sent. The client can move a
// cabinet; they cannot move a number.
//
// The previous version of this file did neither — it returned the whole config
// including the rate card, trusted whatever came back, hardcoded
// notifications@fieldquo.com as the sender, and stamped the notification in
// America/Toronto regardless of where the company was. It also had no UI, so
// none of that had ever run.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Resend } from "resend";
import { lazyClient } from "@/lib/lazyClient";
import { getAppOrigin } from "@/lib/appUrl";
import { mergeClientDesign } from "@/lib/kitchen/pricing";
import { resolveSender } from "@/lib/email/companySender";
import { formatCompanyDateTime } from "@/lib/format/companyDate";

// Lazy — see lib/lazyClient.js. A module-scope `new Resend()` breaks the
// production build when RESEND_API_KEY isn't present at build time.
const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));

/**
 * Everything a price could hide in, removed.
 *
 * Rebuilt key-by-key rather than deleting the fields we happen to know about: a
 * blacklist starts leaking the moment the pricing engine gains a field, and the
 * failure mode is a rate card sitting on a public URL that nobody notices.
 */
function stripPricing(design) {
  if (!design || typeof design !== "object") return null;
  return {
    serviceType: "kitchen",
    room: design.room || null,
    elements: (Array.isArray(design.elements) ? design.elements : []).map((el) => ({
      id: el?.id,
      kind: el?.kind,
      wall: el?.wall,
      pos: el?.pos,
      width: el?.width,
      height: el?.height,
      depth: el?.depth,
      config: stripElementConfig(el?.config),
    })),
    // Finish is the point of the client view — colours and materials.
    finish: design.finish || null,
    // Which modules are on changes what's DRAWN (a countertop appears), so the
    // flags cross over. Their rates do not.
    modules: design.modules || null,
    accessories: (Array.isArray(design.accessories) ? design.accessories : []).map(
      (a) => ({ id: a?.id, quantity: a?.quantity }),
    ),
  };
}

function stripElementConfig(config) {
  if (!config || typeof config !== "object") return {};
  const { supplyPrice, installPrice, ...rest } = config;
  // `billable` stays. The drawing distinguishes an appliance the contractor is
  // supplying from one the homeowner already owns, and that's a fact about the
  // job rather than a price.
  return rest;
}

export async function GET(request, { params }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const quote = await db.quote.findUnique({
    where: { shareToken: token },
    select: {
      quoteNumber: true,
      status: true,
      scopeDetails: true,
      clientKitchenConfig: true,
      client: { select: { name: true } },
      company: { select: { name: true, logoUrl: true, brandColor: true } },
    },
  });

  if (!quote) {
    return NextResponse.json(
      { error: "Design link not found or expired." },
      { status: 404 },
    );
  }

  // The client's own version if they have one, else the contractor's. Theirs
  // first, so coming back to the link shows what they left rather than a reset.
  const base =
    quote.clientKitchenConfig ||
    (quote.scopeDetails?.serviceType === "kitchen" ? quote.scopeDetails : null);

  return NextResponse.json({
    quoteNumber: quote.quoteNumber,
    clientName: quote.client?.name || "",
    companyName: quote.company.name,
    companyLogoUrl: quote.company.logoUrl,
    companyBrandColor: quote.company.brandColor,
    // Once a quote is settled the drawing is part of what was agreed. Editing it
    // afterwards would leave the signed document describing a kitchen nobody is
    // going to build.
    locked: quote.status === "accepted" || quote.status === "declined",
    kitchenConfig: stripPricing(base),
  });
}

export async function PATCH(request, { params }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body?.kitchenConfig) {
    return NextResponse.json({ error: "No design data received." }, { status: 400 });
  }

  const quote = await db.quote.findUnique({
    where: { shareToken: token },
    include: { client: true, company: true },
  });
  if (!quote) {
    return NextResponse.json(
      { error: "Design link not found or expired." },
      { status: 404 },
    );
  }
  if (quote.status === "accepted" || quote.status === "declined") {
    return NextResponse.json(
      { error: "This quote is closed, so the design can't be changed." },
      { status: 409 },
    );
  }

  // The contractor's design is the base. Appliance prices, room dimensions and
  // the rate card all come from it — see mergeClientDesign.
  const saved =
    quote.scopeDetails?.serviceType === "kitchen" ? quote.scopeDetails : {};
  const merged = mergeClientDesign(saved, body.kitchenConfig);

  await db.quote.update({
    where: { id: quote.id },
    data: {
      clientKitchenConfig: merged,
      // clientDesignAt is the field everything reads — it answers "did they, and
      // when" in one value. clientDesignSaved is the redundant boolean the
      // ROADMAP flags; written here only because it still exists in the schema,
      // and leaving it stale would let the two disagree.
      clientDesignSaved: true,
      clientDesignAt: new Date(),
    },
  });

  // ── Tell the people who can act on it ───────────────────────────────────
  //
  // This quote's own creator plus owners and admins — not a hardcoded address.
  const notify = await db.member.findMany({
    where: {
      companyId: quote.companyId,
      active: true,
      OR: [{ userId: quote.createdById }, { role: { in: ["owner", "admin"] } }],
    },
    include: { user: { select: { email: true } } },
    distinct: ["userId"],
  });
  const to = notify.map((m) => m.user?.email).filter(Boolean);

  if (to.length) {
    try {
      const link = `${getAppOrigin(request)}/app/quotes/${quote.id}/kitchen`;
      // The COMPANY's date format, via the shared formatter. The original
      // hardcoded America/Toronto and en-CA, which gave a contractor in
      // Vancouver the wrong time and one in Montréal the wrong format.
      const when = formatCompanyDateTime(new Date(), quote.company?.dateFormat);
      // Through the shared sender, which discovers a verified From for this
      // company. A hardcoded notifications@fieldquo.com breaks as soon as a
      // company has its own sending domain — and this lands in their staff's
      // inbox, so it should look like their own system talking to them.
      const { from, replyTo } = await resolveSender(quote.company || {}, quote.companyId);

      await resend.emails.send({
        from,
        replyTo,
        to,
        subject: `Client design saved — ${quote.quoteNumber}`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;line-height:1.5;">
            <p><strong>${escapeHtml(quote.client?.name || "A client")}</strong>
               saved their own version of the kitchen layout on
               <strong>${escapeHtml(quote.quoteNumber)}</strong>${when ? `, ${escapeHtml(when)}` : ""}.</p>
            <p>Their changes are kept separate from your drawing — open the
               designer to compare and decide whether to take them.</p>
            <p><a href="${link}">Open the kitchen designer →</a></p>
          </div>
        `,
        text:
          `${quote.client?.name || "A client"} saved their own version of the kitchen ` +
          `layout on ${quote.quoteNumber}${when ? `, ${when}` : ""}.\n\n` +
          `Their changes are kept separate from your drawing.\n\n${link}`,
      });
    } catch (err) {
      // A failed notification must not fail the client's save. They did their
      // part; losing their layout because an email call timed out is the worse
      // outcome, and clientDesignAt already records that it happened.
      console.error("[kitchen-design] couldn't notify the company:", err);
    }
  }

  return NextResponse.json({ success: true });
}

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
