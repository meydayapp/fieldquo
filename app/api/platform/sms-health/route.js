// app/api/platform/sms-health/route.js
//
// Did FieldQuo's texts ARRIVE? Read-only.
//
// Everything sendSms() sends lands in SmsDelivery with its carrier verdict
// (lib/sms/deliveryStore.js). This rolls the last 7 or 30 days up by verdict,
// by Twilio error code (each explained in plain words), by sending number, by
// company and by purpose — the view that answers the owner's "did you fix the
// text issue?" with a number instead of a guess.
//
// It also reports WHICH mechanism settled each text: the status callback, or
// only the reconcile cron. Plenty of the second and none of the first means
// Twilio's callback is not reaching /api/sms/status (a wrong origin, Vercel
// Deployment Protection on the callback URL, or no TWILIO_AUTH_TOKEN to
// verify it) — the webhook-absence failure this codebase has had three times,
// made visible.
//
// Recipients' numbers leave this route masked to their last four digits.
// Sending numbers are FieldQuo's or the company's own lines and are shown in
// full, because "which number is unregistered" is the whole question.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { deliveryVerdict, reasonText, maskPhone, FAILED_STATUSES } from "@/lib/sms/deliveryStatus";

const DAY = 24 * 60 * 60 * 1000;

/** { total, delivered, failed, sent, pending } from groupBy rows with a status. */
function tally(rows) {
  const t = { total: 0, delivered: 0, failed: 0, sent: 0, pending: 0 };
  for (const r of rows) {
    const n = r._count?._all ?? 0;
    t.total += n;
    t[deliveryVerdict({ status: r.status })] += n;
  }
  return t;
}

/** Group rows by `key`, tally each group, biggest first. */
function breakdown(rows, key) {
  const groups = new Map();
  for (const r of rows) {
    const k = r[key] ?? null;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return [...groups].map(([k, rs]) => ({ key: k, ...tally(rs) })).sort((a, b) => b.total - a.total);
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const days = new URL(request.url).searchParams.get("days") === "30" ? 30 : 7;
  const since = new Date(Date.now() - days * DAY);
  const where = { sentAt: { gte: since } };

  let byStatus, byCode, byNumber, byCompany, byPurpose, callbackSettled, reconcileOnly, recentFailures, callbacks;
  try {
    [byStatus, byCode, byNumber, byCompany, byPurpose, callbackSettled, reconcileOnly, recentFailures, callbacks] =
      await Promise.all([
        db.smsDelivery.groupBy({ by: ["status"], where, _count: { _all: true } }),
        db.smsDelivery.groupBy({
          by: ["errorCode"],
          where: { ...where, status: { in: FAILED_STATUSES } },
          _count: { _all: true },
        }),
        db.smsDelivery.groupBy({ by: ["fromE164", "status"], where, _count: { _all: true } }),
        db.smsDelivery.groupBy({ by: ["companyId", "status"], where, _count: { _all: true } }),
        db.smsDelivery.groupBy({ by: ["purpose", "status"], where, _count: { _all: true } }),
        db.smsDelivery.count({ where: { ...where, lastCallbackAt: { not: null } } }),
        db.smsDelivery.count({ where: { ...where, lastCallbackAt: null, reconciledAt: { not: null } } }),
        db.smsDelivery.findMany({
          where: { ...where, status: { in: FAILED_STATUSES } },
          orderBy: { sentAt: "desc" },
          take: 25,
          select: {
            id: true,
            companyId: true,
            purpose: true,
            status: true,
            errorCode: true,
            errorMessage: true,
            toE164: true,
            fromE164: true,
            sentAt: true,
            statusAt: true,
          },
        }),
        // Every status post Twilio made, duplicates included — the raw
        // evidence the webhook is being called at all.
        db.smsDelivery.aggregate({ where, _sum: { callbackCount: true } }),
      ]);
  } catch (err) {
    // The table not existing yet is the one expected failure — the schema is
    // applied by hand (docs/ROADMAP.md). Said plainly rather than as a 500.
    const missing = /SmsDelivery|does not exist|P2021/i.test(String(err?.message || ""));
    return NextResponse.json(
      {
        error: missing
          ? "The SmsDelivery table doesn't exist in this database yet — apply the SQL in docs/ROADMAP.md (SMS delivery receipts)."
          : `Couldn't read SMS deliveries: ${err?.message || "unknown error"}`,
      },
      { status: missing ? 503 : 500 },
    );
  }

  const codes = byCode
    .map((r) => ({
      code: r.errorCode,
      count: r._count._all,
      reason: reasonText(r.errorCode),
    }))
    .sort((a, b) => b.count - a.count);

  // Every failed row's code, per group, so each row of the number and company
  // tables can name its own worst error rather than the global one.
  const failedRows = await db.smsDelivery
    .groupBy({
      by: ["companyId", "fromE164", "errorCode"],
      where: { ...where, status: { in: FAILED_STATUSES } },
      _count: { _all: true },
    })
    .catch(() => []);
  const topCodeBy = (key) => {
    const best = new Map();
    for (const r of failedRows) {
      const k = r[key] ?? null;
      const cur = best.get(k);
      if (!cur || r._count._all > cur.count) best.set(k, { code: r.errorCode, count: r._count._all });
    }
    return best;
  };
  const topByNumber = topCodeBy("fromE164");
  const topByCompany = topCodeBy("companyId");

  const companyIds = [...new Set(byCompany.map((r) => r.companyId).filter(Boolean))];
  const names = new Map(
    (
      await db.company
        .findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } })
        .catch(() => [])
    ).map((c) => [c.id, c.name]),
  );

  const totals = tally(byStatus);
  const top = codes[0] || null;

  return NextResponse.json({
    days,
    since,
    totals,
    mechanism: {
      callbackSettled,
      reconcileOnly,
      callbacksReceived: callbacks?._sum?.callbackCount ?? 0,
      // Rows that have been through a whole hour of the cron with no callback
      // are the signal; a handful is normal (a callback lost in transit), a
      // majority is a webhook that is not arriving.
      callbackMissing: reconcileOnly > 0 && reconcileOnly >= callbackSettled,
    },
    topError: top ? { ...top, share: totals.failed ? top.count / totals.failed : 0 } : null,
    codes,
    byNumber: breakdown(byNumber, "fromE164").map((r) => {
      const worst = topByNumber.get(r.key);
      return { ...r, number: r.key, topError: worst ? { ...worst, reason: reasonText(worst.code) } : null };
    }),
    byCompany: breakdown(byCompany, "companyId").map((r) => {
      const worst = topByCompany.get(r.key);
      return {
        ...r,
        companyId: r.key,
        name: r.key ? names.get(r.key) || "(deleted company)" : "FieldQuo's own texts",
        topError: worst ? { ...worst, reason: reasonText(worst.code) } : null,
      };
    }),
    byPurpose: breakdown(byPurpose, "purpose"),
    recentFailures: recentFailures.map((r) => ({
      id: r.id,
      company: r.companyId ? names.get(r.companyId) || "(company)" : "FieldQuo",
      purpose: r.purpose,
      status: r.status,
      errorCode: r.errorCode,
      reason: reasonText(r.errorCode, r.errorMessage),
      to: maskPhone(r.toE164),
      from: r.fromE164,
      sentAt: r.sentAt,
      // When the carrier's verdict arrived — minutes after sending is a
      // carrier refusal, hours is the reconcile catching up.
      failedAt: r.statusAt,
    })),
  });
}
