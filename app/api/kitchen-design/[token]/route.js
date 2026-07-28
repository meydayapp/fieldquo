// app/api/kitchen-design/[token]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Resend } from "resend";
import { lazyClient } from "@/lib/lazyClient";
import { getAppOrigin } from "@/lib/appUrl";

// Lazy — see lib/lazyClient.js. A module-scope `new Resend()` breaks the
// production build when RESEND_API_KEY isn't present at build time.
const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));

// Public — gated by shareToken only, no session/auth check. Same pattern as TrueFinish.
export async function GET(request, { params }) {
  const { token } = await params;
  if (!token)
    return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const quote = await db.quote.findUnique({
    where: { shareToken: token },
    include: {
      client: true,
      company: { select: { name: true, logoUrl: true, brandColor: true } },
    },
  });

  if (!quote) {
    return NextResponse.json(
      { error: "Design link not found or expired." },
      { status: 404 },
    );
  }

  const kitchenConfig =
    quote.clientKitchenConfig ||
    (quote.scopeDetails?.serviceType === "kitchen" ? quote.scopeDetails : null);

  return NextResponse.json({
    quoteNumber: quote.quoteNumber,
    clientName: quote.client?.name || "",
    companyName: quote.company.name,
    companyLogoUrl: quote.company.logoUrl,
    companyBrandColor: quote.company.brandColor,
    kitchenConfig: kitchenConfig || null,
  });
}

export async function PATCH(request, { params }) {
  const { token } = await params;
  if (!token)
    return NextResponse.json({ error: "Missing token" }, { status: 400 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { kitchenConfig } = body;
  if (!kitchenConfig) {
    return NextResponse.json(
      { error: "No design data received." },
      { status: 400 },
    );
  }

  const quote = await db.quote.update({
    where: { shareToken: token },
    data: {
      clientKitchenConfig: kitchenConfig,
      clientDesignSaved: true,
      clientDesignAt: new Date(),
    },
    include: { client: true, company: true },
  });

  // Notify this quote's own creator (and owner/admins) — not a hardcoded address
  const notifyMembers = await db.member.findMany({
    where: {
      companyId: quote.companyId,
      active: true,
      OR: [{ userId: quote.createdById }, { role: { in: ["owner", "admin"] } }],
    },
    include: { user: { select: { email: true } } },
    distinct: ["userId"],
  });

  const recipients = notifyMembers.map((m) => m.user.email).filter(Boolean);

  if (recipients.length > 0) {
    const siteUrl = getAppOrigin(request);
    const adminLink = `${siteUrl}/app/quotes/${quote.id}`;
    const savedAt = new Date().toLocaleString("en-CA", {
      timeZone: "America/Toronto",
    });

    await resend.emails.send({
      from: `${quote.company.name} <notifications@fieldquo.com>`,
      to: recipients,
      subject: `🎨 Client design saved — ${quote.quoteNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <p><strong>${quote.client?.name || "A client"}</strong> just saved a kitchen design for quote <strong>${quote.quoteNumber}</strong>, saved ${savedAt}.</p>
          <p><a href="${adminLink}">View the quote →</a></p>
        </div>
      `,
    });
  }

  return NextResponse.json({ success: true });
}
