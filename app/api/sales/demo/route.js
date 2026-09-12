// app/api/sales/demo/route.js
//
// The demo tenants a rep shows a prospect — their own, one per trade.
//
// ══ Why a rep cannot use "Run the demo" ═══════════════════════════════════
//
// The platform console opens a demo through IMPERSONATION, which is
// superadmin-only and read-only — non-negotiable #2, enforced in middleware
// and again in lib/currentMember.js, deliberately twice. A rep impersonating a
// demo company could not write a quote, and watching a quote get written is
// the only part of a demo a prospect cares about.
//
// So the rep signs into their demo company for real, with a login they set
// the password on themselves. That login is minted through the same mechanism
// a superadmin uses for the pool (lib/demo/demoLogin.js — Better Auth's own
// sign-up, an owner Member row, an Organization row), through a narrower door:
// only for companies whose demoOwnerRepId is this rep's, re-read from the row.
// lib/sales/repDemo.js's header carries the argument.
//
// ══ What happened to the pool ═════════════════════════════════════════════
//
// Until 2026-09-12 this route handed out the ten seeded fixtures one per rep,
// and in practice everybody signed in as demo1 because it was the one with a
// login. The owner: "make sure that each sales rep gets a unique demo
// account." A rep now gets a company seeded FOR them the first time this GET
// runs (idempotent — see repDemo.js on the unique slot), and the pool stays
// exactly as it is for the platform console. A rep who was holding a pool
// demo is moved onto their own on that first GET; the pool demo is simply no
// longer pointed at, and nothing on it changes.
//
// ══ What a rep MAY do to their own demos ══════════════════════════════════
//
//   GET            ensure one exists, and report all of them
//   POST create    a demo for another trade
//   POST open      make that one the demo their login lands in
//   POST reset     retire it and seed a fresh one — nothing is deleted
//   POST login     set (or replace) the password that opens them
//
// No "industry" action any more: the pool's re-dress wiped the company's rows
// in place, and a rep's demo is never wiped — a different trade is a different
// company. Every action re-reads the target company and refuses unless it is
// this rep's own, a demo, and not retired; a rep cannot touch a colleague's
// demo, a pool demo, or a real tenant through any of them.
//
// ══ Why POST does not ride requireSalesRep ════════════════════════════════
//
// requireSalesRep() refuses every non-GET method under /api/sales — correctly,
// that is its whole job. POST goes through lib/sales/demoGate.js's
// requireDemoRep, the narrow named exception, which lists what it permits.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSalesRep } from "@/lib/sales/gate";
import { requireDemoRep } from "@/lib/sales/demoGate";
import {
  ensureRepDemo,
  ensureRepDemoLogin,
  openRepDemo,
  repDemoState,
  resetRepDemo,
} from "@/lib/sales/repDemo";
import { INDUSTRIES } from "@/lib/demo/industries";
import { materialiseDemoCheckIn } from "@/lib/sales/checkin/materialise";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

/**
 * The rep's row as the demo library wants it — code and name included, since
 * the slug, the company name and the login address are derived from them and
 * never from the request.
 */
async function freshRep(id) {
  return db.salesRep.findUnique({
    where: { id },
    select: { id: true, name: true, code: true, demoCompanyId: true },
  });
}

/** The fixture day-1 check-in draft on the current demo. Fails soft. */
async function draftCheckIn(repId) {
  await materialiseDemoCheckIn({ salesRepId: repId }).catch((err) =>
    console.error("[sales demo] demo check-in not written:", err?.message),
  );
}

async function fullState(repId) {
  const rep = await freshRep(repId);
  return {
    ...(await repDemoState(rep)),
    industries: Object.entries(INDUSTRIES).map(([key, v]) => ({ key, label: v.label })),
  };
}

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  // The seed-on-first-open. A GET that writes is unusual enough to say why:
  // the alternative is a "Create my demo" button that every rep presses
  // exactly once, and a rep who has not pressed it has no demo to be told
  // about. Idempotent by the unique slot, so a reload seeds nothing.
  try {
    const row = await freshRep(rep.id);
    const { created } = await ensureRepDemo({ rep: row });
    if (created) await draftCheckIn(rep.id);
  } catch (err) {
    console.error("[sales demo] could not ensure a demo:", err);
    return bad(err?.message || "Could not set up your demo.", err?.status || 500);
  }

  return NextResponse.json(await fullState(rep.id));
}

export async function POST(request) {
  const { rep, refusal } = await requireDemoRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim();
  const row = await freshRep(rep.id);

  try {
    if (action === "create") {
      const trade = String(body?.trade ?? "").trim();
      if (!INDUSTRIES[trade]) return bad("That is not one of the trades a demo can be set up as.");
      const { company, created } = await ensureRepDemo({ rep: row, trade });
      if (created) await draftCheckIn(rep.id);
      return NextResponse.json({ ok: true, created, companyId: company.id, ...(await fullState(rep.id)) });
    }

    if (action === "open") {
      const companyId = String(body?.companyId ?? "").trim();
      if (!companyId) return bad("companyId is required.");
      const opened = await openRepDemo({ rep: row, companyId });
      if (!opened.ok) return bad(opened.error, opened.status);
      await draftCheckIn(rep.id);
      return NextResponse.json({ ok: true, ...(await fullState(rep.id)) });
    }

    if (action === "reset") {
      const companyId = String(body?.companyId ?? "").trim();
      if (!companyId) return bad("companyId is required.");
      const result = await resetRepDemo({ rep: row, companyId });
      if (!result.ok) return bad(result.error, result.status);
      await draftCheckIn(rep.id);
      return NextResponse.json({
        ok: true,
        retiredId: result.retired.id,
        companyId: result.company.id,
        ...(await fullState(rep.id)),
      });
    }

    if (action === "login") {
      const result = await ensureRepDemoLogin({ rep: row, password: body?.password });
      if (!result.ok) return bad(result.error, result.status);
      return NextResponse.json({
        ok: true,
        email: result.email,
        replaced: result.replaced,
        ...(await fullState(rep.id)),
      });
    }
  } catch (err) {
    console.error(`[sales demo] ${action} failed:`, err);
    return bad(err?.message || "That did not work.", err?.status || 500);
  }

  return bad('Expected "create", "open", "reset" or "login".');
}
