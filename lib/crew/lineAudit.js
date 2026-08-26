// lib/crew/lineAudit.js
//
// FieldQuo's own view of the crew-texting estate: every number the Twilio
// account holds, who is holding it, and where its texts are actually going.
//
// ══ Why this is a separate screen from the contractor's ════════════════════
//
// Because it is a different company's problem. FieldQuo holds the Twilio
// account, buys the numbers and lends one to a tenant — the same arrangement as
// Retell on the voice side, where no contractor has ever seen an agent id or
// been asked to configure anything. The crew inbox had drifted the other way:
// /app/crew-inbox printed this deployment's `/api/crew/inbound` URL and the
// number's raw `smsUrl` under a "Setup details" disclosure, and named
// TWILIO_AUTH_TOKEN in a blocker. The owner read the webhook URL off his own
// screen, clicked it, and got a blank page — correctly, since it is a POST-only
// endpoint. None of it was ever his to act on, and publishing it invited
// someone to point a private Twilio number straight at our endpoint, around the
// claim flow whose one-to-one CrewInboxNumber.e164 is the only guarantee that a
// crew photo reaches the right tenant.
//
// So the facts did not go away; they moved to the reader who can use them.
//
// ══ Why the audit is a pure function ═══════════════════════════════════════
//
// The failure it exists to catch is silent by construction. A number whose
// `smsUrl` points at a dead preview deployment keeps a green tick in our own
// row and delivers every crew photo into a branch database — the voice side
// learned exactly this the hard way. A drift check that is only ever exercised
// by looking at the page is a drift check nobody runs, so the whole comparison
// lives here, takes plain objects, and is executed against hostile shapes by
// scripts/check-crew-inbox.mjs.

import { crewInboxCapability } from "./capability";

/**
 * @param {Array}  numbers   what Twilio says the account holds:
 *                           [{ e164, sid, mms, smsUrl }]
 * @param {Array}  rows      CrewInboxNumber rows, with `company` joined:
 *                           [{ e164, companyId, provider, source, providerId,
 *                              webhookUrl, connectedAt, expiresAt,
 *                              company: { name, crewInboxEnabled } }]
 * @param {string} expectedWebhookUrl  where THIS deployment expects delivery
 * @param {boolean} signatureConfigured
 * @param {Date}   now
 *
 * @returns {{ lines: Array, orphans: Array, counts: object }}
 *   `lines`   — one entry per number the account holds, plus any claimed
 *               number the account does NOT hold (which is its own alarm).
 *   `orphans` — claimed rows whose number Twilio no longer lists. A row like
 *               that can never receive anything and nothing else notices.
 */
export function auditCrewLines({
  numbers = [],
  rows = [],
  expectedWebhookUrl = null,
  signatureConfigured = false,
  now = new Date(),
} = {}) {
  const held = Array.isArray(numbers) ? numbers.filter((n) => n && n.e164) : [];
  const claims = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r && r.e164) claims.set(r.e164, r);
  }

  const lines = held.map((n) => describe(n, claims.get(n.e164) || null));

  // A claimed number Twilio does not list. Either it was released at the
  // provider without releasing the row, or the credentials now point at a
  // different Twilio account. Both look identical from inside a tenant — a line
  // that says it is on and receives nothing for ever.
  const heldSet = new Set(held.map((n) => n.e164));
  const orphans = [...claims.values()]
    .filter((r) => !heldSet.has(r.e164))
    .map((r) => describe({ e164: r.e164, sid: r.providerId || null, mms: null, smsUrl: null }, r, true));

  const all = [...lines, ...orphans];
  return {
    lines,
    orphans,
    counts: {
      held: held.length,
      claimed: claims.size,
      free: lines.filter((l) => !l.claim).length,
      // The two states worth waking somebody for.
      drifting: all.filter((l) => l.drift).length,
      orphaned: orphans.length,
    },
  };

  function describe(number, row, missingAtProvider = false) {
    const capability = row
      ? crewInboxCapability({
          line: row,
          signatureConfigured,
          expectedWebhookUrl,
          now,
        })
      : null;

    // Drift is measured against TWILIO's answer, not our stored copy of it.
    // Comparing our row to our own expectation would agree with itself
    // for ever, which is precisely how "it says connected and nothing arrives"
    // survived an afternoon.
    const pointedHere = Boolean(expectedWebhookUrl) && number.smsUrl === expectedWebhookUrl;
    const pointedSomewhere = Boolean(number.smsUrl);
    const drift = Boolean(
      row &&
        !missingAtProvider &&
        // A row we believe is connected, whose number Twilio is delivering
        // anywhere other than here — including nowhere at all.
        row.connectedAt &&
        !pointedHere,
    );

    // ── Why drift needs its OWN sentence ────────────────────────────────
    //
    // crewInboxCapability reads our row, and in a drift the row is perfectly
    // happy: it says connected, to the URL we expect, and returns `ready`. That
    // is the whole failure — our record agrees with itself while Twilio quietly
    // delivers somewhere else. So the capability verdict cannot describe this,
    // and a screen that printed only the verdict would show a green tick over a
    // line whose photos are landing in a preview database.
    const driftMessage = !drift
      ? null
      : missingAtProvider
        ? null
        : pointedSomewhere
          ? `Our row says connected and ready; Twilio is delivering this number's texts to ${number.smsUrl}. Their crew's photos are landing in whatever deployment that is, not here.`
          : "Our row says connected and ready; Twilio has no message webhook on this number at all, so every text to it is dropped silently.";

    return {
      e164: number.e164,
      sid: number.sid || null,
      // null means "we could not ask", which is a different statement from
      // "no". The screen prints the difference rather than padding it.
      mms: number.mms === null || number.mms === undefined ? null : Boolean(number.mms),
      smsUrl: number.smsUrl || null,
      pointedHere,
      pointedSomewhere,
      missingAtProvider,
      drift,
      driftMessage,
      claim: row
        ? {
            companyId: row.companyId,
            companyName: row.company?.name || null,
            enabled: Boolean(row.company?.crewInboxEnabled),
            source: row.source || null,
            connectedAt: row.connectedAt || null,
            expiresAt: row.expiresAt || null,
            expired: Boolean(row.expiresAt && new Date(row.expiresAt) <= now),
            ready: Boolean(capability?.ready),
            reason: capability?.reason || null,
            // FieldQuo's half of the verdict. Names env vars and endpoints on
            // purpose, and is never returned by any tenant route.
            opsMessage: capability?.opsMessage || capability?.message || null,
          }
        : null,
    };
  }
}
