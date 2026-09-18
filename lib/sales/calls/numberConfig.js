// lib/sales/calls/numberConfig.js
//
// How each sales number is actually configured at Twilio — read from
// Twilio, compared with what this deployment answers on.
//
// ══ Why this replaced the floor board's table ═════════════════════════════
//
// Until 2026-09-17 /platform/sales/floor carried a per-number table built
// from PlatformSmsNumber.voiceUrl — the URL we STORED at purchase — with a
// "not recorded" column for the region and a paragraph of instructions for
// pasting the status callback into Twilio's console. The owner's verdict:
// not needed on his floor. And the stored URL was the wrong evidence anyway:
// the status callbacks were set on every number through the API that night,
// which touched Twilio and not our column, so an audit of our column would
// have gone on printing instructions for a job that was done.
//
// So this asks Twilio. incomingPhoneNumbers.list() returns, per number, the
// voice URL and the status callback it will actually hit, and the audit
// compares both against THIS deployment's origin and the paths the inbound
// route answers on. A ✓ here is a ✓ at the carrier.
//
// The floor board keeps one sentence and a warning line only when a number
// is misconfigured (salesVoiceInboundState takes the count); the table lives
// on /platform/crew-lines under "Sales number configuration", which is the
// page that already lists FieldQuo's Twilio estate.
//
// ══ Pure comparison, separate read ═══════════════════════════════════════
//
// salesNumberConfigAudit() takes plain objects and is executed by
// scripts/check-sales-costs.mjs against a mismatched host, a missing
// callback and a number Twilio does not hold. readSalesNumberConfig() is the
// one that talks to the account.

import { db } from "@/lib/db";
import { twilioRest, twilioConfigured } from "@/lib/sms/twilioClient";
import { SALES_VOICE_PURPOSES } from "./store";
import { INBOUND_WEBHOOK_PATH } from "./inboundRouting";
import { hostOf } from "@/lib/voice/numberAudit";

/** The query the status callback must carry — lib/crew/platformNumber.js's voiceStatusCallbackUrlFor. */
export const STATUS_CALLBACK_QUERY = "stage=status";

function pathAndQuery(url) {
  try {
    const u = new URL(String(url || ""));
    return { path: u.pathname, query: u.search.replace(/^\?/, "") };
  } catch {
    return { path: null, query: null };
  }
}

/**
 * @param rows           PlatformSmsNumber rows for the sales purposes:
 *                       `{ e164, purpose, assignedRepName?, assignedAdminEmail? }`
 * @param twilioNumbers  incomingPhoneNumbers.list() rows, reduced or raw:
 *                       `{ phoneNumber, voiceUrl, statusCallback, sid }`.
 *                       `null` when Twilio could not be asked.
 * @param origin         this deployment's origin
 */
export function salesNumberConfigAudit({ rows = [], twilioNumbers = null, origin = null, inboundPath = INBOUND_WEBHOOK_PATH } = {}) {
  const expectedHost = hostOf(origin);
  const asked = Array.isArray(twilioNumbers);
  const byE164 = new Map();
  for (const n of asked ? twilioNumbers : []) {
    const e164 = typeof n?.phoneNumber === "string" ? n.phoneNumber : typeof n?.e164 === "string" ? n.e164 : null;
    if (e164) byE164.set(e164, n);
  }

  const lines = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && typeof r.e164 === "string")
    .map((r) => {
      const t = byE164.get(r.e164) || null;
      const voiceUrl = typeof t?.voiceUrl === "string" && t.voiceUrl.trim() ? t.voiceUrl.trim() : null;
      const statusCallback = typeof t?.statusCallback === "string" && t.statusCallback.trim() ? t.statusCallback.trim() : null;
      const voice = pathAndQuery(voiceUrl);
      const status = pathAndQuery(statusCallback);

      const voiceState = !asked
        ? "not_asked"
        : !t
          ? "not_held"
          : !voiceUrl
            ? "no_voice_url"
            : !expectedHost
              ? "origin_unknown"
              : hostOf(voiceUrl) !== expectedHost
                ? "wrong_host"
                : voice.path !== inboundPath
                  ? "wrong_path"
                  : "ok";
      const statusState = !asked
        ? "not_asked"
        : !t
          ? "not_held"
          : !statusCallback
            ? "missing"
            : !expectedHost
              ? "origin_unknown"
              : hostOf(statusCallback) !== expectedHost
                ? "wrong_host"
                : status.path !== inboundPath || !String(status.query || "").includes(STATUS_CALLBACK_QUERY)
                  ? "wrong_path"
                  : "ok";

      const ok = voiceState === "ok" && statusState === "ok";
      const unknown = voiceState === "not_asked" || voiceState === "origin_unknown";
      return {
        e164: r.e164,
        purpose: r.purpose || null,
        owner: r.assignedRepName || r.assignedAdminEmail || null,
        sid: t?.sid || null,
        voiceUrl,
        voiceHost: hostOf(voiceUrl),
        voiceState,
        statusCallback,
        statusState,
        expectedHost,
        ok,
        unknown,
        misconfigured: !ok && !unknown,
      };
    });

  return {
    lines,
    expectedHost,
    asked,
    counts: {
      held: lines.length,
      ok: lines.filter((l) => l.ok).length,
      misconfigured: lines.filter((l) => l.misconfigured).length,
      unknown: lines.filter((l) => l.unknown).length,
    },
  };
}

/**
 * Read the sales numbers and their Twilio configuration.
 *
 * @returns the audit, plus `twilioError` (a sentence) when Twilio could not
 *          be asked — in which case every line is `unknown`, not wrong.
 */
export async function readSalesNumberConfig({ origin, client = db, twilio = twilioRest } = {}) {
  const rows = await client.platformSmsNumber.findMany({
    where: { purpose: { in: SALES_VOICE_PURPOSES }, active: true },
    select: {
      e164: true,
      purpose: true,
      assignedRep: { select: { name: true } },
      assignedAdmin: { select: { email: true } },
    },
    orderBy: { e164: "asc" },
  });
  const shaped = rows.map((r) => ({
    e164: r.e164,
    purpose: r.purpose,
    assignedRepName: r.assignedRep?.name || null,
    assignedAdminEmail: r.assignedAdmin?.email || null,
  }));

  let twilioNumbers = null;
  let twilioError = null;
  if (!twilioConfigured()) {
    twilioError = "Twilio credentials are not set on this deployment, so the carrier could not be asked.";
  } else {
    try {
      const list = await twilio.incomingPhoneNumbers.list({ limit: 200 });
      twilioNumbers = (list || []).map((n) => ({
        phoneNumber: n.phoneNumber,
        sid: n.sid,
        voiceUrl: n.voiceUrl || null,
        statusCallback: n.statusCallback || null,
      }));
    } catch (err) {
      twilioError = `Twilio could not be asked just now (${err?.status || "no status"}). Nothing below is a verdict.`;
    }
  }

  return {
    ...salesNumberConfigAudit({ rows: shaped, twilioNumbers, origin }),
    twilioError,
    checkedAt: new Date(),
  };
}
