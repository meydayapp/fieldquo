// app/api/settings/subscription/value/route.js
//
// "Here's what you've built here" — for the cancel screen.
//
// ── The most honest retention lever there is ───────────────────────────────
//
// It's not a trick and it isn't a discount. It's the true answer to a question
// the cancel button doesn't ask: what am I actually giving up? A contractor
// weighing $45 a month against nothing will cancel; one weighing it against
// three years of quotes, their client list and every invoice they've sent
// usually doesn't.
//
// ── It has to be able to say nothing ───────────────────────────────────────
//
// `worthShowing` is the whole point. A company two weeks in has three quotes
// and one client, and showing them that is an argument FOR cancelling — we'd
// be making their case. Below the threshold this returns nothing and the screen
// simply doesn't render the panel.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";

/** Below this there's no story to tell, so we don't tell one. */
const MIN_QUOTES = 10;
const MIN_CLIENTS = 5;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const companyId = member.companyId;
  const [quotes, won, clients, jobs, invoices, collected, photos] = await Promise.all([
    db.quote.count({ where: { companyId } }),
    db.quote.aggregate({
      where: { companyId, status: "accepted" },
      _sum: { total: true },
      _count: true,
    }),
    db.client.count({ where: { companyId } }),
    db.job.count({ where: { companyId } }),
    db.invoice.count({ where: { companyId } }),
    db.invoice.aggregate({ where: { companyId, status: "paid" }, _sum: { total: true } }),
    // Photos live on JobVisit.photos (a string array), not on a JobPhoto model
    // — there isn't one. `db.jobPhoto` would have been undefined and thrown
    // synchronously inside this Promise.all, 500ing the whole route; a .catch()
    // wouldn't have saved it, because the throw happens before a promise exists.
    db.jobVisit.count({
      where: { job: { companyId }, NOT: { photos: { isEmpty: true } } },
    }),
  ]);

  const wonTotal = Number(won._sum.total || 0);
  const collectedTotal = Number(collected._sum.total || 0);

  return NextResponse.json({
    worthShowing: quotes >= MIN_QUOTES || clients >= MIN_CLIENTS,
    quotes,
    quotesWon: won._count,
    wonTotal,
    clients,
    jobs,
    invoices,
    collectedTotal,
    visitsWithPhotos: photos,
  });
}
