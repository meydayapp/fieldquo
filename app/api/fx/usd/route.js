// app/api/fx/usd/route.js
//
// GET → { rates: { CAD: <USD→CAD> }, rateDate, source } — what one US dollar is
// in the currencies FieldQuo has a rate for, for the "≈ CA$xx at today's rate"
// hint beside a USD-priced add-on (app/components/billing/UsdBillingNote.js).
//
// The newest ExchangeRate row per pair, else the checked-in rate
// (lib/marketing/fxLive.js loadLiveRates — never throws, never fewer pairs).
// A pair with no rate is simply absent: the hint is then not drawn rather than
// guessed. Signed-in members only; it is public data, but nothing outside the
// app reads it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadLiveRates } from "@/lib/marketing/fxLive";

export async function GET(request) {
  const { response } = await memberOrRefusal(request);
  if (response) return response;
  const { rates, source } = await loadLiveRates();
  const out = {};
  let rateDate = null;
  for (const r of rates || []) {
    const rate = Number(r?.rate);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    if (r.base === "USD") out[r.quote] = rate;
    else if (r.quote === "USD") out[r.base] = 1 / rate;
    else continue;
    rateDate = rateDate && rateDate > r.rateDate ? rateDate : r.rateDate || rateDate;
  }
  return NextResponse.json({ rates: out, rateDate, source });
}
