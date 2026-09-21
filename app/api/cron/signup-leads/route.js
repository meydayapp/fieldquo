// app/api/cron/signup-leads/route.js
//
// Every fifteen minutes: turn the signups that went quiet into leads, and
// keep the welcome-call rows honest about the trial behind them.
//
// Two jobs, both in lib/signup/salesFloor.js so scripts/check-signup-leads.mjs
// can execute them against the scripted db:
//
//   promoteSignupLeads   a SignupLead with a phone, no Company, quiet for
//                        PROMOTE_AFTER_MS (thirty minutes) becomes a HOT
//                        Prospect in the review folder's signup section —
//                        or the referring rep's own SalesLead when the link
//                        carried their code. Dedupe by email and phone
//                        against Company and Prospect; the do-not-contact
//                        list is read here, in the request that writes.
//   sweepSignupProspects a welcome-call row flips to "stalled" when its
//                        company has no card after the checkout grace or no
//                        quote sent in seven days, and back when that clears;
//                        and any unreferred company of the last thirty days
//                        with no row gets one.
//
// Fifteen minutes, not daily: the promotion rule is thirty minutes of quiet,
// and a hot lead that waits until tomorrow's 14:30 run is a lukewarm one. The
// recovery EMAIL stays on its own daily run (cron/signup-recovery) and skips
// any signup a rep now holds — see lib/signup/abandoned.js's held-lead rule.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { promoteSignupLeads, sweepSignupProspects } from "@/lib/signup/salesFloor";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  const out = { success: true };
  try {
    out.promotion = await promoteSignupLeads({ client: db, now });
  } catch (err) {
    out.success = false;
    out.promotionError = err?.message || String(err);
    await recordError({ area: "signup", code: "signup_leads_promotion_failed", message: `Promoting signup leads threw: ${err?.message}` }).catch(() => {});
  }
  try {
    out.sweep = await sweepSignupProspects({ client: db, now });
  } catch (err) {
    out.success = false;
    out.sweepError = err?.message || String(err);
    await recordError({ area: "signup", code: "signup_leads_sweep_failed", message: `Sweeping signup prospects threw: ${err?.message}` }).catch(() => {});
  }
  return NextResponse.json(out, { status: out.success ? 200 : 500 });
}
