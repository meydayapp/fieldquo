// app/api/cron/large-quote-check/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
// Through the shared sender rather than a Resend client of its own. The lazy
// client that used to live here is gone: lib/email/resend.js is now the only
// module that constructs one, so the demo interception has a single seam
// instead of fourteen. See that file's header.
import { sendEmail } from "@/lib/email/resend";
import { getAppOrigin } from "@/lib/appUrl";
import { teamNoticeFrom } from "@/lib/email/teamNotice";
import { largeQuoteNotice } from "@/lib/notifications/teamEmails";
import { memberReaders, READER_MEMBER_SELECT } from "@/lib/notifications/teamReaders";

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
    // currency/timezone/defaultLanguage: the alert prints the amount in the
    // company's own currency (it hardcoded "$"), the time in its zone, and
    // falls back to its language for a reader who never chose one.
    include: { company: { select: { name: true, currency: true, timezone: true, defaultLanguage: true } } },
  });
  const origin = getAppOrigin(request);

  let notified = 0;

  for (const rule of rules) {
    if (!rule.threshold) continue;

    const largeQuotes = await db.quote.findMany({
      where: {
        companyId: rule.companyId,
        createdAt: { gte: since },
        total: { gte: rule.threshold },
        // A past job typed in today has today's createdAt and a 2024 total.
        // It is not a large quote that just came in; it is bookkeeping.
        historicalImportedAt: null,
      },
      select: {
        id: true,
        quoteNumber: true,
        total: true,
        createdAt: true,
        client: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });

    if (largeQuotes.length === 0) continue;

    const admins = await db.member.findMany({
      where: {
        companyId: rule.companyId,
        role: { in: ["owner", "admin"] },
        active: true,
      },
      select: READER_MEMBER_SELECT,
    });
    // Each admin in their own language — one email per admin, as before.
    const readers = memberReaders(admins, rule.company);

    for (const quote of largeQuotes) {
      for (const r of readers) {
        // Null for a reader who may not see money: never, today, for an
        // owner or admin — the builder holds the rule so that a wider
        // recipient list can't widen what is read (lib/email/teamNotice.js).
        const mail = largeQuoteNotice({
          language: r.language,
          company: rule.company,
          quote,
          threshold: rule.threshold,
          writtenBy: quote.createdBy?.name || null,
          reader: r.reader,
          origin,
        });
        if (!mail) continue;
        await sendEmail({
          // The company this notice is about, so a demo company's staff notice
          // is simulated like everything else it sends. sendEmail re-reads the
          // row; this is an id, not a verdict.
          companyId: rule.companyId,
          // FieldQuo's fixed notifications address under the company's name,
          // as before — with the name cleaned of the characters that broke
          // the header (teamNoticeFrom).
          from: teamNoticeFrom(rule.company.name),
          to: r.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        });
        notified++;
      }
    }
  }

  return NextResponse.json({ success: true, notified });
}
