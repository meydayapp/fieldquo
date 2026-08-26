// lib/billing/cancelConsequences.js
//
// Which warnings the cancel screen is entitled to show THIS company.
//
// ══ Why this is a pure function and not a chain of `&&` in the JSX ═════════
//
// Because the dangerous outcome is a warning that does not fit. A one-van
// painter with no phone number, no service plans and nothing outstanding, told
// that his business line is about to die and his clients' cards are about to be
// charged, learns in one screen that our warnings are decoration — and skips the
// next one, which might have been the true one. The rule this file enforces is
// therefore narrow and absolute: an item appears only when a COUNT OF SOMETHING
// THAT EXISTS says it should.
//
// A chain of `&&` inside a component can only be checked by rendering the
// component, which means nobody checks it. Here it is a function taking the
// consequences payload and returning a list, so
// scripts/check-cancel-consequences.mjs can execute the empty company, the
// company with three numbers, and the company with unpaid invoices, and assert
// what each is and is not told.
//
// ══ Every item names the module that makes it true ════════════════════════
//
// `evidence` is not documentation. The check script reads it and asserts that
// the named module still performs the thing — the cron still selects without
// looking at the subscription, accessFor still goes read-only immediately — so
// the day one of those changes, this file fails the build rather than going on
// promising a consequence that no longer happens.
//
// It is deliberately the module and not the sentence. Asserting on the sentence
// would only ever prove the sentence had not changed, which is the one thing
// that does not matter.

/**
 * The three that are true for every company, in every state.
 *
 * Rendered even when the consequences fetch failed, which is the safe
 * direction: a company we could not ask about its phone number must still not
 * be told it hasn't got one. Two of the three are reassuring, on purpose —
 * "nothing is deleted" is the most useful fact on the screen, and an honest
 * warning includes what you do NOT lose.
 */
export const ALWAYS_TRUE = [
  {
    key: "youReadOnly",
    evidence: "lib/billing/access.js",
  },
  {
    key: "clientLinksLive",
    // The gate lives in getCurrentMember and nowhere else, so nothing on a
    // public path consults it. The check asserts that is still true of every
    // client-facing route directory.
    evidence: "lib/currentMember.js",
  },
  {
    key: "nothingDeleted",
    evidence: "app/api/platform/billing/cancel/route.js",
  },
];

/**
 * The per-company items, in the order they should be read.
 *
 * Ordered by how much money moves without anybody watching: the permanently
 * lost phone number first, then the cards that keep being charged, then the
 * things that merely sit there.
 *
 * @param what the /api/settings/subscription/consequences payload, or null
 * @returns [{ key, evidence, ...params }]
 */
export function consequenceItems(what) {
  if (!what || typeof what !== "object") return [];
  const items = [];

  const balanceCents = num(what.voiceCreditCents);

  // One per number. A company holding three does not want one sentence about
  // "your numbers" — each is a separate line somebody printed on something.
  for (const n of arr(what.phoneNumbers)) {
    if (!n?.e164) continue;
    items.push({
      key: "numberKept",
      // The cron selects on VoicePhoneNumber.status and the feature gate, and
      // on nothing about the subscription — so cancelling neither releases the
      // number nor stops the rent.
      evidence: "app/api/cron/voice-rent/route.js",
      number: n.e164,
      monthlyCents: num(n.monthlyCents),
      balanceCents,
      days: num(what.rentGraceDays) || 7,
    });
  }

  // Said only when there is something to lose. A zero balance is not a warning,
  // it is a fact about nothing.
  if (balanceCents > 0) {
    items.push({
      key: "creditNoRefund",
      // Nothing in the release path or the cancel path writes a credit entry
      // back. The check asserts neither module refunds.
      evidence: "lib/voice/numberRelease.js",
      balanceCents,
    });
  }

  if (what.autoTopup?.enabled) {
    const armed = Boolean(what.autoTopup.armed) && num(what.autoTopup.amountCents) > 0;
    items.push({
      // Two sentences, because they are two situations. A row that is enabled
      // but has no saved card cannot charge anybody, and telling that company
      // their card is about to be charged would be the overstatement this file
      // exists to prevent.
      key: armed ? "autoTopupArmed" : "autoTopupOn",
      evidence: "app/api/cron/voice-auto-topup/route.js",
      amountCents: num(what.autoTopup.amountCents),
    });
  }

  // `chargeable`, not `active`. A plan with no live mandate raises an invoice
  // and waits; a plan WITH one takes money off a homeowner's card unattended,
  // and only the second is worth stopping somebody at the door for.
  if (num(what.servicePlans?.chargeable) > 0) {
    items.push({
      key: "servicePlansRun",
      evidence: "app/api/cron/service-plans/route.js",
      count: num(what.servicePlans.chargeable),
    });
  }

  if (num(what.unpaidInvoices?.count) > 0) {
    items.push({
      key: "unpaidInvoices",
      // The client's pay link is a public path with no billing gate, so the
      // money still arrives; the contractor's own ability to chase it does not.
      evidence: "lib/billing/access.js",
      count: num(what.unpaidInvoices.count),
      amountDue: num(what.unpaidInvoices.amountDue),
    });
  }

  if (num(what.heldBookings) > 0) {
    items.push({
      key: "heldBookings",
      evidence: "lib/booking/reconcileBookingFee.js",
      count: num(what.heldBookings),
    });
  }

  if (what.site?.live) {
    items.push({
      key: "siteStaysLive",
      // Two facts from one module: the site serves on CompanySite.published
      // alone, and isPaidSubscription flips once the read-only window expires,
      // which is when the "Site by FieldQuo" credit comes back.
      evidence: "app/site/[subdomain]/page.js",
      days: num(what.readOnlyDays) || 30,
    });
  }

  return items;
}

/** Every evidence path this module can ever cite. The check walks it. */
export function evidencePaths() {
  const everyItem = consequenceItems(SAMPLE);
  return [
    ...new Set([...ALWAYS_TRUE, ...everyItem].map((i) => i.evidence)),
  ];
}

/**
 * A company that trips every branch.
 *
 * Exported so the check does not have to reinvent the payload shape, and kept
 * next to the reader so a new field cannot be added without a fixture that
 * exercises it.
 */
export const SAMPLE = {
  immediate: true,
  readOnlyDays: 30,
  rentGraceDays: 7,
  phoneNumbers: [{ e164: "+15875550123", status: "active", monthlyCents: 400 }],
  voiceCreditCents: 1250,
  autoTopup: { enabled: true, armed: true, amountCents: 2000 },
  servicePlans: { active: 2, chargeable: 2 },
  unpaidInvoices: { count: 3, amountDue: 4200 },
  heldBookings: 1,
  site: { live: true, subdomain: "brightside" },
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}
