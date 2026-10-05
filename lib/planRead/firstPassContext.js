// lib/planRead/firstPassContext.js
//
// The company facts the first pass prices with that are not money a member
// may be hidden from: the crew it plans with (active field workers on the
// Team page), the company's currency, and the dated US$ rate the reference
// rental table is converted at. Loaded by every route that computes a read
// (the screen, the draft quote, the pricing paths) — one loader, one answer.
//
// Each lookup degrades on its own: no crew count is FieldQuo's stated default
// crew, no rate is "no reference price in your currency" — never a read that
// cannot open.
//
// Server only.

import { loadLiveRates } from "@/lib/marketing/fxLive";
import { usdFx } from "./firstPass";

export async function loadFirstPassContext(companyId, { prisma, asOf = new Date() } = {}) {
  const soft = (p, fallback) =>
    Promise.resolve(p).catch((err) => {
      console.error("[planRead] first pass context:", err?.message);
      return fallback;
    });
  const [company, fieldCrew, live] = await Promise.all([
    soft(prisma.company.findUnique({ where: { id: companyId }, select: { currency: true } }), null),
    soft(prisma.worker.count({ where: { companyId, active: true, workType: "field" } }), 0),
    soft(loadLiveRates({ prisma, asOf }), { rates: undefined }),
  ]);
  const currency = String(company?.currency || "CAD").toUpperCase();
  return { currency, fieldCrew: Number(fieldCrew) || 0, fx: usdFx(currency, live?.rates, asOf) };
}
