// app/api/sales/language/route.js
//
// The language a rep works in — the read and the write.
//
// ══ Why this route had to exist ═══════════════════════════════════════════
//
// app/sales/layout.js rendered `<LanguageProvider initialLanguage="en"
// fromAccount>`. `fromAccount` means "this is a signed-in user's SAVED
// preference" and makes the provider skip its localStorage and navigator
// fallbacks — so a hardcoded literal beside it claimed a decision on behalf of
// somebody who had never been offered one, and denied a francophone rep even
// the browser fallback they would have got as a stranger on the marketing site.
// lib/sales/repLanguage.js's header carries the full story, including the real
// incident that made asserting English defensible before this route existed.
//
// ══ Why requireOutreachRep and not requireSalesRep ════════════════════════
//
// requireSalesRep refuses every non-GET method under /api/sales, deliberately
// — see lib/sales/gate.js. requireOutreachRep is the named exception in front
// of the writes that are the rep's own work, and /api/sales/payout already
// uses it for exactly this shape of write: a rep changing a fact about
// themselves that decides no money. Same gate, same reasoning, so the two
// settings surfaces cannot drift apart on who is allowed in.
//
// Note what the gate does NOT grant: REP_OUTREACH_WRITES does not list
// salesRep, and this route makes no Prisma call of its own. The write goes
// through lib/sales/preferenceWrite.js, which is declared and column-asserted
// in scripts/check-sales-auth.mjs.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { saveRepLanguage } from "@/lib/sales/preferenceWrite";
import {
  REP_LANGUAGE_OPTIONS,
  parseLanguageChoice,
  repLanguageOrNull,
} from "@/lib/sales/repLanguage";

/**
 * The shape both verbs answer with, so the screen never has two readings.
 *
 * `language` is run back through repLanguageOrNull rather than returned raw:
 * a code dropped from app/i18n/languages.js after a rep chose it must read as
 * "no stated preference" on the screen, for the same reason it does in the
 * layout. A picker showing a selected language the shell is not rendering in
 * is the control that appears to work and doesn't.
 */
function view(rep) {
  return {
    language: repLanguageOrNull(rep?.language),
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
    select: { language: true },
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

  // Validated by the same pure function the check executes against hostile
  // input, rather than by an inline test here that only this route's tests
  // would ever see.
  const parsed = parseLanguageChoice(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, allowed: REP_LANGUAGE_OPTIONS.map((o) => o.code) },
      { status: 400 },
    );
  }

  // The rep id comes from the gate's fresh read of the session, never from the
  // body — see lib/sales/preferenceWrite.js.
  const row = await saveRepLanguage({ salesRepId: rep.id, language: parsed.language });
  return NextResponse.json(view(row));
}
