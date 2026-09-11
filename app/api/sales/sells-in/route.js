// app/api/sales/sells-in/route.js
//
// The languages a rep can SELL in — the read and the write.
//
// ══ Not /api/sales/language ═══════════════════════════════════════════════
//
// That route is the portal's chrome: which words the tabs are drawn in. This
// one is allocation: which prospects the queue may hand this rep. The owner's
// rule — "the leads from quebec ... can't be handed out to anybody unless
// they have a French profile in their settings" — keys on THIS column, and
// keeping the two apart is what lets a rep read the console in English and
// sell in French, which is exactly the Quebec bilingual closer being hired.
//
// ══ Same gate as the language route, same reasoning ═══════════════════════
//
// requireOutreachRep is the named exception in front of the writes that are
// the rep's own work. The write goes through lib/sales/sellsInWrite.js, which
// is declared and column-asserted in scripts/check-sales-auth.mjs; this file
// makes no Prisma write of its own.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { saveRepSellsIn } from "@/lib/sales/sellsInWrite";
import { parseSellsIn, sellsInOf } from "@/lib/sales/leadLanguage";
import { REP_LANGUAGE_OPTIONS } from "@/lib/sales/repLanguage";

/**
 * The shape both verbs answer with.
 *
 * `sellsIn` goes back through sellsInOf() rather than raw, for the reason
 * /api/sales/language runs `language` through repLanguageOrNull: a code
 * dropped from app/i18n/languages.js after a rep ticked it must read as not
 * ticked, because it no longer qualifies them for anything.
 */
function view(rep) {
  return {
    sellsIn: sellsInOf(rep),
    // The vocabulary travels with the answer so the picker cannot drift from
    // the validator that will judge it.
    options: REP_LANGUAGE_OPTIONS,
  };
}

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const row = await db.salesRep.findUnique({
    where: { id: rep.id },
    select: { sellsIn: true },
  });
  if (!row) return NextResponse.json({ error: "No such rep." }, { status: 404 });
  return NextResponse.json(view(row));
}

export async function PUT(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  let body = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const parsed = parseSellsIn(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, allowed: REP_LANGUAGE_OPTIONS.map((o) => o.code) },
      { status: 400 },
    );
  }

  // The rep id comes from the gate's fresh read of the session, never from the
  // body — see lib/sales/sellsInWrite.js.
  const row = await saveRepSellsIn({ salesRepId: rep.id, sellsIn: parsed.sellsIn });
  return NextResponse.json(view(row));
}
