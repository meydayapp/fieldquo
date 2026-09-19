// app/api/platform/sales/prospects/enrichment/route.js
//
// The enrichment console: where each pass is against the dispatcher, the
// two bulk vendor runs' counters, and the buttons.
//
//   GET                         the status the panel draws
//   POST { action: "apify", source }         one tick for a source, now
//   POST { action: "people", scope: "claimed" }  the register lookup over the claimed leads
//   POST { action: "setting", key, value }   pairsPerDay per source, or the
//                                            tier-2 Places cap
//
// Superadmin only — every write here spends money or changes a cap.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { ACTORS, apifyStatus, runApifyTick, setPairsPerDay } from "@/lib/sales/intel/apifyRuns";
import { apifySpendThisMonth } from "@/lib/sales/intel/apify";
import { PLACES_AHEAD_SETTING_KEY, enrichmentSweepStatus } from "@/lib/sales/intel/placesSweep";
import { recrawlStatus } from "@/lib/sales/pipeline/recrawl";
import { lookupRegisterPeopleFor } from "@/lib/sales/intel/registerPeople";
import { DISCOVERY_TRADES } from "@/lib/sales/discovery/trades";

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const now = new Date();
  const [sweep, bbb, maps, spend, personnel, recrawl] = await Promise.all([
    enrichmentSweepStatus({ db, now }),
    apifyStatus({ db, source: "bbb", now }),
    apifyStatus({ db, source: "google_maps", now }),
    apifySpendThisMonth({ db, now }),
    db.registerPersonnel.aggregate({ _count: { _all: true }, _max: { release: true, loadedAt: true } }),
    // The second look at websites: due now in the order, waiting, and what
    // the last cron tick and the last day found (lib/sales/pipeline/recrawl.js).
    recrawlStatus({ db, now }),
  ]);
  return NextResponse.json({
    sweep: {
      ...sweep,
      trades: sweep.trades.map((t) => ({ ...t, label: DISCOVERY_TRADES[t.tradeKey]?.label || t.tradeKey })),
    },
    recrawl,
    apify: { bbb, google_maps: maps, spendThisMonth: spend },
    personnel: { rows: personnel._count._all, release: personnel._max.release, loadedAt: personnel._max.loadedAt },
  });
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  const now = new Date();

  if (body.action === "apify") {
    if (!ACTORS[body.source]) return NextResponse.json({ error: "source must be bbb or google_maps." }, { status: 400 });
    const limit = Number.isInteger(body.limit) ? Math.max(0, Math.min(20, body.limit)) : null;
    const result = await runApifyTick({ db, source: body.source, now, trigger: "button", startLimit: limit });
    console.log(`[enrichment] apify ${body.source} by ${admin?.email || admin?.id}: ${JSON.stringify({ started: result.started?.length, ingested: result.collected?.ingested, skipped: result.skipped })}`);
    return NextResponse.json(result);
  }

  if (body.action === "people") {
    const claims = await db.salesQueueClaim.findMany({ where: { releasedAt: null }, select: { prospectId: true }, distinct: ["prospectId"] });
    const report = await lookupRegisterPeopleFor({ db, ids: claims.map((c) => c.prospectId), force: body.force === true, now });
    return NextResponse.json({ asked: report.asked, checked: report.checked, skipped: report.skipped, found: report.found, added: report.added, notRegister: report.notRegister, errors: report.errors });
  }

  if (body.action === "setting") {
    const value = Math.max(0, Math.min(500, Math.floor(Number(body.value) || 0)));
    if (body.key === "bbb" || body.key === "google_maps") {
      const saved = await setPairsPerDay({ db, source: body.key, pairsPerDay: value });
      return NextResponse.json({ ok: true, key: ACTORS[body.key].settingKey, value: saved });
    }
    if (body.key === "placesAhead") {
      await db.platformSetting.upsert({ where: { key: PLACES_AHEAD_SETTING_KEY }, update: { value: { perHour: value } }, create: { key: PLACES_AHEAD_SETTING_KEY, value: { perHour: value } } });
      return NextResponse.json({ ok: true, key: PLACES_AHEAD_SETTING_KEY, value });
    }
    return NextResponse.json({ error: "key must be bbb, google_maps or placesAhead." }, { status: 400 });
  }

  return NextResponse.json({ error: "action must be apify, people or setting." }, { status: 400 });
}
