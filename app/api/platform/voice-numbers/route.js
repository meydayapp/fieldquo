// app/api/platform/voice-numbers/route.js
//
// Every number Retell bills FieldQuo for, against every number a tenant holds.
//
// ── Why it is asked of the provider, not read from our rows ────────────────
//
// The whole class of failure this exists to catch is our record and Retell's
// disagreeing, and a screen built from one of them can never see it. Same
// argument as /api/platform/crew-lines, which this follows deliberately: one
// shape for "what our provider account really holds", so nobody has to learn a
// second one.
//
// ── Read-only ──────────────────────────────────────────────────────────────
//
// AGENTS.md rule 3: the platform console views everything and edits nothing on
// a company's data. There is no release button here on purpose. Releasing a
// number destroys a contractor's phone line, and FieldQuo doing that to a
// tenant from a console — even a correct one — is exactly the power the rule
// withholds. The tenant's own owner releases theirs from
// /app/settings/voice; the rent cron releases the ones nobody paid for.
//
// A number NOBODY holds is a different matter — it is FieldQuo's own money and
// FieldQuo's own account — but it is still not released from here, because the
// answer to "why does Retell have a number we have no row for" is usually a
// half-finished purchase whose company is about to be found, and deleting one
// takes a phone number back off a carrier's shelf for ever.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { voiceConfigured, listAllNumbers } from "@/lib/voice/retell";
import { auditVoiceNumbers } from "@/lib/voice/numberAudit";
import { salesNumbers, SALES_NUMBER_ENV } from "@/lib/platform/salesCall";
import { sharedTestNumbers, toE164 } from "@/lib/voice/numbers";
import { describeFailure, describeVendorFailure } from "@/lib/platform/diagnostics";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configured = voiceConfigured();

  let items = [];
  let complete = true;
  let providerError = null;
  if (configured) {
    try {
      const listed = await listAllNumbers();
      items = listed.items;
      complete = listed.complete;
    } catch (err) {
      // ── Named, not surfaced verbatim ──────────────────────────────────────
      //
      // This used to pass `err.message` straight to the browser, on the
      // argument that the reader of this page is the one person for whom a
      // Retell error message is the useful form of the answer. Half true: the
      // STATUS is useful to him, the remedy more so, and the vendor's own prose
      // is the one part that is neither — an API's instinct on an auth failure
      // is to echo what it rejected, and what it rejected is our key. So the
      // sentence is built from a closed template plus a status number, and
      // whatever the vendor said is scrubbed before it can reach a screen.
      providerError = describeVendorFailure(err, {
        vendor: "Retell",
        envVar: "RETELL_API_KEY",
      });
    }
  }

  // EVERY row, released ones included. A released row whose number Retell still
  // lists is the single most expensive thing this page can find, and filtering
  // to live rows would hide precisely that.
  //
  // `simulated` rows are the one exception, and for a different reason than
  // `released`: they were never bought at Retell in the first place — see
  // VoicePhoneNumber.simulated and lib/voice/demoLine.js. Including them here
  // would report every one of them as an "orphan" (held on our side, absent at
  // the provider), which is what this page exists to flag as a billing leak.
  // For a simulated row it is not one; it is the entire design.
  let rows;
  try {
    rows = await db.voicePhoneNumber.findMany({
      where: { simulated: false },
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    // Without our own rows there is no comparison to make, and reporting every
    // number Retell holds as unheld would be the alarm this page exists for,
    // fired at the whole account. Refuse the read and say why.
    const problem = describeFailure(err, { vendor: "the database" });
    return NextResponse.json({ error: problem.message, ...problem }, { status: 503 });
  }

  // ── FieldQuo's own lines, named rather than alarmed about ────────────────
  //
  // Both are real Retell numbers that no company holds and none ever should, so
  // both landed in the "nobody holds this — FieldQuo pays for nothing" column
  // and read as a billing leak. They are not one; they are the sales line
  // (lib/platform/salesCall.js explains why it cannot be a VoicePhoneNumber
  // row) and the shared receptionist test line. Told to the audit rather than
  // filtered out here, because a number that vanishes from a reconciliation
  // page is a number nobody can check.
  const ourNumbers = [
    ...salesNumbers().map((e164) => ({ e164, label: "sales" })),
    ...sharedTestNumbers()
      .map(toE164)
      .filter(Boolean)
      .map((e164) => ({ e164, label: "test" })),
  ];

  const audit = auditVoiceNumbers({
    providerNumbers: items,
    rows,
    ourNumbers,
    now: new Date(),
  });

  // ── Companies holding more than one ────────────────────────────────────────
  //
  // Not drift, but the same money question one level along, and this is the one
  // screen that can see it across all tenants. One production company holds
  // three rows and was charged twice 31 seconds apart. heldNumber() now blocks a
  // second purchase; nothing reconciles a company that already made one.
  const byCompany = new Map();
  for (const r of rows) {
    if (!["provisioning", "active", "porting"].includes(r.status)) continue;
    const list = byCompany.get(r.companyId) || [];
    list.push(r);
    byCompany.set(r.companyId, list);
  }
  const multiHolders = [...byCompany.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([companyId, list]) => ({
      companyId,
      companyName: list[0]?.company?.name || null,
      numbers: list.map((r) => ({
        e164: r.e164,
        status: r.status,
        source: r.source,
        numberType: r.numberType,
        monthlyCents: r.monthlyCents,
        createdAt: r.createdAt,
        // Which of them, if any, Retell actually has. A company paying for two
        // rows where only one exists at the provider is a different problem
        // from one genuinely holding two lines.
        atProvider: audit.lines.some((l) => l.e164 === r.e164),
      })),
    }));

  return NextResponse.json({
    deployment: {
      voiceConfigured: configured,
      missingEnv: configured ? [] : ["RETELL_API_KEY"],
      // False when the pagination hit its stop. The page has to say so — a
      // partial list read as a whole account reports real numbers as orphaned.
      listComplete: complete,
      // ── The other half of a two-screen story ─────────────────────────────
      //
      // A toll-free number Retell bills FieldQuo for that no company holds is
      // reported here as a billing leak, and /platform/sales-agent is at the
      // same moment reporting that it has no number to answer on. Those are
      // very often ONE fact: a sales line bought and never named in
      // configuration. Neither screen mentioned the other, so the owner was
      // asked to decide about an orphan with no idea it might be the thing the
      // other page is waiting for.
      salesNumberVar: SALES_NUMBER_ENV,
      salesNumberSet: salesNumbers().length > 0,
    },
    providerError,
    ...audit,
    multiHolders,
  });
}
