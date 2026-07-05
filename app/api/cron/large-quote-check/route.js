// app/api/cron/large-quote-check/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Vercel Cron hits this on a schedule (e.g. every 15 min) — checks for quotes created
// since the last run that exceed their company's configured threshold, and haven't
// been flagged yet.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const rules = await db.notificationRule.findMany({
    where: { type: "large_quote", active: true },
    include: { company: true },
  });

  let notified = 0;

  for (const rule of rules) {
    if (!rule.threshold) continue;

    const largeQuotes = await db.quote.findMany({
      where: {
        companyId: rule.companyId,
        createdAt: { gte: fifteenMinutesAgo },
        total: { gte: rule.threshold },
      },
      include: { client: true },
    });

    if (largeQuotes.length === 0) continue;

    const admins = await db.member.findMany({
      where: {
        companyId: rule.companyId,
        role: { in: ["owner", "admin"] },
        active: true,
      },
      include: { user: true },
    });

    for (const quote of largeQuotes) {
      for (const admin of admins) {
        if (!admin.user.email) continue;
        await resend.emails.send({
          from: `${rule.company.name} <notifications@fieldquo.com>`,
          to: admin.user.email,
          subject: `Large quote created: $${Number(quote.total).toLocaleString()}`,
          html: `<p>A quote for <strong>${quote.client.name}</strong> was just created for <strong>$${Number(quote.total).toLocaleString()}</strong>, above your $${Number(rule.threshold).toLocaleString()} threshold.</p>`,
        });
        notified++;
      }
    }
  }

  return NextResponse.json({ success: true, notified });
}
