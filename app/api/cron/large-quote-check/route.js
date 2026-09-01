// app/api/cron/large-quote-check/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { Resend } from "resend";
import { lazyClient } from "@/lib/lazyClient";

// Lazy: `new Resend()` throws on a missing key, and at module scope that
// fires during `next build` when Next imports routes to collect page data.
const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));

// Vercel Cron hits this on a schedule and emails admins about quotes above
// their company's threshold.
//
// CRITICAL — this lookback window MUST match the cron interval in
// vercel.json. There is no per-quote "already notified" flag; the window is
// the only thing preventing repeats. Too short and quotes created between
// runs are missed entirely; too long and admins get the same quote emailed
// every run. Change one, change the other.
//
// Currently daily, because Vercel's Hobby plan permits at most one cron run
// per day. On Pro, drop both this and the schedule to something tighter —
// LARGE_QUOTE_LOOKBACK_MINUTES=15 alongside a */15 schedule.
const LOOKBACK_MINUTES =
  Number(process.env.LARGE_QUOTE_LOOKBACK_MINUTES) || 24 * 60;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);

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
        createdAt: { gte: since },
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
