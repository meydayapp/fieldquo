// app/api/cron/sales-payouts/route.js
//
// Closes LAST week into a payout batch per rep, once a week.
//
// ══ Why last week and not this one ════════════════════════════════════════
//
// A week is closed only after it has finished. Closing the current week would
// mean a batch that keeps growing after it was called final, which is the same
// class of lie as a cached total — and a rep who saw their payout figure rise
// twice would rightly stop trusting the screen.
//
// ══ Why nothing is paid here ══════════════════════════════════════════════
//
// Batches close to `ready`. A person marks them paid. Moving money to a rep —
// payroll, withholding, a cross-border transfer — is a decision with its own
// compliance surface that nobody has made, and automating it now would mean
// guessing at all three. See lib/sales/payouts.js.
import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { closeWeekForRep, previousWeekBounds } from "@/lib/sales/payouts";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const { start, end } = previousWeekBounds(new Date());

  // Every rep with unbatched entries, including deactivated ones. A rep who
  // left last Wednesday still earned what they earned before Wednesday, and a
  // filter on `active` here would quietly withhold it — the same reasoning
  // that keeps endedAt out of the retention milestone.
  const reps = await db.salesRep.findMany({ select: { id: true } });

  const counts = { considered: reps.length, closed: 0, empty: 0, failed: 0 };
  const batches = [];

  for (const rep of reps) {
    try {
      const batch = await closeWeekForRep({ salesRepId: rep.id, start, end });
      if (batch) {
        counts.closed += 1;
        batches.push({ salesRepId: rep.id, batchId: batch.id, cents: batch.totalCentsAtClose });
      } else {
        // Nothing owed. No batch is created on purpose — an empty batch reads
        // as "we paid you nothing" and is indistinguishable from a bug when
        // someone is hunting a missing payment.
        counts.empty += 1;
      }
    } catch (err) {
      counts.failed += 1;
      await recordError({
        area: "cron:sales-payouts",
        message: `Closing the week for rep ${rep.id} failed: ${err?.message}`,
      }).catch(() => {});
    }
  }

  return NextResponse.json({
    ok: true,
    periodStart: start,
    periodEnd: end,
    ...counts,
    batches,
  });
}
