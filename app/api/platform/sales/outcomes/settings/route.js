// app/api/platform/sales/outcomes/settings/route.js
//
// The call-outcome settings (lib/sales/calls/outcomeSettings.js) and the
// sub-reason lists (lib/sales/calls/subDispositions.js): read by every
// platform admin, written by a superadmin, every write audit-logged with
// the values before and after.
//
// PUT { settings?: { key: value }, subDispositions?: { code: [entries] } }
// Either half may be absent; each present half is validated whole and
// refused whole — a save that stored the good keys and dropped the bad
// one would be the dead control AGENTS.md forbids.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requireSuperadmin } from "@/lib/platform/superadminGate";
import { AMD_USD_PER_CALL, outcomeSettingsTable, validateOutcomeSettingsEdit } from "@/lib/sales/calls/outcomeSettings";
import { DEFAULT_SUB_DISPOSITIONS, SUB_DISPOSITION_CODES, validateSubDispositionLists } from "@/lib/sales/calls/subDispositions";
import { loadOutcomeSettings, loadSubDispositions, saveOutcomeSettings, saveSubDispositions } from "@/lib/sales/calls/outcomeSettingsStore";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function payload() {
  const [settings, subs] = await Promise.all([loadOutcomeSettings(), loadSubDispositions()]);
  return {
    settings: outcomeSettingsTable(settings.values),
    fallbacks: settings.fallbacks,
    readFailed: settings.readFailed || subs.readFailed,
    subDispositions: { codes: SUB_DISPOSITION_CODES, lists: subs.lists, source: subs.source, fallbacks: subs.fallbacks, defaults: DEFAULT_SUB_DISPOSITIONS },
    amdUsdPerCall: AMD_USD_PER_CALL,
    serverNow: new Date().toISOString(),
  };
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  return NextResponse.json(await payload());
}

export async function PUT(request) {
  const { admin, refusal } = await requireSuperadmin(request, "change the call-outcome settings");
  if (refusal) return refusal;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("Send { settings, subDispositions }.");

  const before = await payload();
  const details = { before: {}, after: {} };

  if (body.settings !== undefined) {
    const v = validateOutcomeSettingsEdit(body.settings);
    if (!v.ok) return bad(v.errors.join(" "));
    details.before.settings = Object.fromEntries(before.settings.filter((r) => Object.hasOwn(v.values, r.key)).map((r) => [r.key, r.value]));
    await saveOutcomeSettings({ values: v.values });
    details.after.settings = v.values;
  }
  if (body.subDispositions !== undefined) {
    const v = validateSubDispositionLists(body.subDispositions);
    if (!v.ok) return bad(v.errors.join(" "));
    details.before.subDispositions = before.subDispositions.lists;
    await saveSubDispositions({ lists: v.lists });
    details.after.subDispositions = v.lists;
  }
  if (!Object.keys(details.after).length) return bad("Nothing to save.");

  await db.platformAuditLog.create({ data: { platformAdminId: admin.id, action: "sales_outcome_settings_updated", details } }).catch(() => {});
  return NextResponse.json(await payload());
}
