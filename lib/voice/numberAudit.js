// lib/voice/numberAudit.js
//
// What Retell bills FieldQuo for, against what FieldQuo thinks it holds.
//
// ══ Why this had to exist ══════════════════════════════════════════════════
//
// FieldQuo holds ONE Retell account and every number "for a tenant" is billed
// to it (lib/voice/spendGate.js says the same thing about talk time). Until
// now, `listNumbers()` existed and nothing called it, so the only record of
// what FieldQuo pays for every month was our own VoicePhoneNumber table — a
// record that can only ever agree with itself.
//
// Two ways it comes apart, and they leak money in opposite directions:
//
//   UNHELD    Retell has a number no company holds. Nobody is being charged
//             rent for it and FieldQuo pays the provider anyway, every month,
//             for ever. There is no screen anywhere it would show up on, and no
//             tenant would ever complain — it is invisible by construction.
//             Two known ways to produce one: a purchase that half-succeeded
//             (bought at Retell, our INSERT never ran), and a row marked
//             `released` in our database by a path that never called the
//             provider. The second is the more expensive, because it looks
//             deliberate.
//
//   FIELDQUO'S OWN
//             the third case, and the one that made the UNHELD column lie.
//             FieldQuo's sales line (FIELDQUO_SALES_NUMBER) and the shared
//             receptionist test number (RETELL_TEST_NUMBER) are both real Retell
//             numbers that no company holds and none ever should — a
//             VoicePhoneNumber row for either would BE the bug, and
//             salesNumberProblems reports it as `belongs_to_tenant`. They are
//             deliberately FieldQuo's own cost, so a console that filed them
//             under "money leaving for nothing" was reporting the design as an
//             anomaly and burying the real leaks underneath it. They are named
//             here instead, and excluded from the leak count.
//
//   ORPHANED  a company holds a row whose number Retell does not list. Their
//             line can never ring. lib/voice/diagnose.js calls this a `ghost`
//             from the tenant's side and offers a repair; from here it is the
//             population count, plus the ones nobody has opened the settings
//             page to notice.
//
// ══ Why it is a pure function ══════════════════════════════════════════════
//
// Same argument as lib/crew/lineAudit.js, which this deliberately mirrors: a
// drift check exercised only by a human opening a page is a drift check nobody
// runs. All the comparison lives here, takes plain objects, and is executed
// against hostile shapes by scripts/check-voice-number-release.mjs.

import { HELD_STATUSES } from "./numberRelease";

/**
 * One Retell phone-number object, reduced to the facts this compares on.
 *
 * Exported and defensive because the provider's list shape has already moved
 * once under this codebase (see listNumbers: v1 returned a bare array, v2
 * returns `{ items }`), and a normaliser that throws on an unexpected row would
 * take the whole reconciliation page down over one odd entry.
 */
export function normaliseProviderNumber(raw) {
  if (!raw || typeof raw !== "object") return null;
  const e164 = typeof raw.phone_number === "string" ? raw.phone_number.trim() : "";
  if (!/^\+\d{6,20}$/.test(e164)) return null;

  // The routing LIST, not the deprecated scalar. `inbound_agent_id` is a hard
  // 400 at the provider since 31/03/2026 and is not returned either; a reader
  // still looking for it would report every number as unanswered.
  const agents = Array.isArray(raw.inbound_agents) ? raw.inbound_agents : [];
  return {
    e164,
    nickname: typeof raw.nickname === "string" ? raw.nickname : null,
    // null is "the provider did not say", which is not the same as "no agent".
    boundAgent: agents.length ? agents[0]?.agent_id || null : null,
    answering: agents.length > 0,
    tollFree: raw.number_type === "toll-free" || raw.number_type === "toll_free" || null,
  };
}

/**
 * @param providerNumbers  raw items from listNumbers() — normalised here
 * @param rows             EVERY VoicePhoneNumber row, released ones included,
 *                         with `company: { name }` joined. Released rows are
 *                         the point: a row that says released while Retell
 *                         still lists the number is the exact bug.
 * @param ourNumbers        FieldQuo's OWN lines: [{ e164, label }]. Numbers that
 *                          are deliberately held by nobody. Empty by default, so
 *                          a caller that does not know about them gets exactly
 *                          the old behaviour rather than a silent reclassifi-
 *                          cation — the audit says what it was told.
 * @param now
 *
 * @returns { lines, orphans, counts }
 *   lines    one per number RETELL has, with whoever holds it (or nobody)
 *   orphans  rows a company still holds whose number Retell does not list
 */
export function auditVoiceNumbers({
  providerNumbers = [],
  rows = [],
  ourNumbers = [],
  now = new Date(),
} = {}) {
  // Keyed on E.164, so a label survives to the line without a second lookup.
  const ours = new Map(
    (Array.isArray(ourNumbers) ? ourNumbers : [])
      .filter((n) => n && typeof n.e164 === "string" && n.e164)
      .map((n) => [n.e164, n.label || "fieldquo"]),
  );
  const held = (Array.isArray(providerNumbers) ? providerNumbers : [])
    .map(normaliseProviderNumber)
    .filter(Boolean);

  // Every row for an E.164, newest first, so "who holds it" prefers a live row
  // over an old released one for the same number — a company that released a
  // number and was later sold the same one back would otherwise read as a leak.
  const byNumber = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r?.e164) continue;
    const list = byNumber.get(r.e164) || [];
    list.push(r);
    byNumber.set(r.e164, list);
  }
  for (const list of byNumber.values()) {
    list.sort((a, b) => rank(b) - rank(a) || time(b.createdAt) - time(a.createdAt));
  }

  const lines = held.map((n) => {
    const candidates = byNumber.get(n.e164) || [];
    const holder = candidates.find((r) => HELD_STATUSES.includes(r.status)) || null;
    const lapsed = holder ? null : candidates[0] || null;

    // FieldQuo's own, and only when no company holds it. A tenant row WINS
    // deliberately: a contractor holding the number configured as our sales
    // line is a real, expensive collision, and hiding it behind "that's ours"
    // is the failure mode this whole file exists to avoid. salesNumberProblems
    // reports that case separately, as `belongs_to_tenant`.
    const ownLabel = !holder ? ours.get(n.e164) || null : null;

    return {
      ...n,
      holder: holder ? describeRow(holder) : null,
      // Nobody holds it and Retell bills us for it. Unchanged in meaning: this
      // is still literally "no company holds this row".
      unheld: !holder,
      // FieldQuo's own line, named. `fieldquoOwn` is the fact; `leak` below is
      // the judgement, and keeping them apart is what stops a future reader
      // deciding that "unheld" already meant "wrong".
      fieldquoOwn: Boolean(ownLabel),
      ownLabel,
      // Money leaving for nothing — the column the owner asked for, now that it
      // excludes the two numbers that are supposed to be nobody's.
      leak: !holder && !ownLabel,
      // WHY nobody holds it, because the causes need different actions.
      unheldReason: holder
        ? null
        : ownLabel
          ? // Not a fault of any kind. Answered before the row reasons below,
            // because "no row of ours has ever mentioned this number" is TRUE
            // of the sales line and is exactly the wrong thing to say about it.
            "fieldquo_own"
          : !lapsed
          ? // No row of ours has ever mentioned this number. Either a purchase
            // that completed at Retell and died before its INSERT, or a number
            // bought by hand in the Retell dashboard.
            "no_row"
          : lapsed.status === "released"
            ? // Marked released in our database while the provider still has it.
              // Every path that does this without calling the provider produces
              // exactly this row, and nothing else would ever notice.
              "marked_released"
            : `row_${lapsed.status}`,
      lapsed: lapsed && !holder ? describeRow(lapsed) : null,
    };
  });

  // The other direction. A company still holds this row — the settings screen
  // shows it, the rent cron may still be charging for it — and Retell does not
  // list the number at all.
  const providerSet = new Set(held.map((n) => n.e164));
  const orphans = [...byNumber.values()]
    .map((list) => list.find((r) => HELD_STATUSES.includes(r.status)) || null)
    .filter((r) => r && !providerSet.has(r.e164))
    .map((r) => ({
      ...describeRow(r),
      e164: r.e164,
      // Only an `active` row is actually being charged rent — rentDecision
      // skips everything else. Said explicitly so the page does not have to
      // re-derive a billing rule the gate already owns.
      billingRent: r.status === "active",
    }));

  const unheld = lines.filter((l) => l.unheld);
  const leaks = lines.filter((l) => l.leak);
  return {
    lines,
    orphans,
    counts: {
      atProvider: held.length,
      held: lines.length - unheld.length,
      // Unchanged: every line no company holds, FieldQuo's own included. Kept
      // so the three numbers below still add up to `atProvider` and nobody has
      // to work out which of two similar counts they are looking at.
      unheld: unheld.length,
      // FieldQuo's own lines, and the alarm — held + fieldquoOwn + leak ===
      // atProvider, by construction.
      fieldquoOwn: unheld.length - leaks.length,
      leak: leaks.length,
      // The subset that is a bug rather than an accident: we said we gave it
      // back and we are still paying for it.
      markedReleased: unheld.filter((l) => l.unheldReason === "marked_released").length,
      orphaned: orphans.length,
      // Orphans that are ALSO taking a contractor's money every month.
      orphanedAndBilling: orphans.filter((o) => o.billingRent).length,
    },
    checkedAt: now,
  };

  // A live row beats a dead one when both exist for the same E.164.
  function rank(r) {
    return HELD_STATUSES.includes(r?.status) ? 1 : 0;
  }
  function time(d) {
    const t = d ? new Date(d).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  }
}

function describeRow(r) {
  return {
    id: r.id || null,
    companyId: r.companyId || null,
    companyName: r.company?.name || null,
    status: r.status || null,
    source: r.source || null,
    numberType: r.numberType || null,
    // What the COMPANY pays us, not what Retell charges FieldQuo. Those are
    // different numbers and this page must never present one as the other —
    // Retell's invoice is the only authority on the cost side.
    monthlyCents: Number.isFinite(Number(r.monthlyCents)) ? Number(r.monthlyCents) : null,
    rentPaidThroughAt: r.rentPaidThroughAt || null,
    releasedAt: r.releasedAt || null,
    createdAt: r.createdAt || null,
  };
}
