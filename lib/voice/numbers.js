// lib/voice/numbers.js
//
// How a company gets a phone number for the AI receptionist.
//
// Three paths, and they are genuinely different products rather than three
// buttons that do the same thing. The default matters more than the code here:
// get this wrong and a contractor's business line goes dark.
//
// ══ 1. FORWARD — the default, and what almost everyone should do ══════════
//
// They keep their own number. We give them a new one, and they set CONDITIONAL
// FORWARDING on their carrier: ring my phone, and if I don't pick up in 4 rings
// (or I'm on another call), send it to the FieldQuo number.
//
// Why this is the right default:
//   * Reversible in about a minute, from their own phone, without us.
//   * Their number keeps working everywhere it's already printed — the van, the
//     lawn signs, Google, three years of invoices.
//   * Nothing to schedule and nothing that can stall. If they hate the agent
//     they dial one code and it's over.
//   * They still answer their own phone when they're free. The agent catches
//     the calls that would otherwise have gone to voicemail — which is the
//     whole business case, not a compromise.
//
// The cost of it: caller ID on the forwarded leg shows the original caller on
// most carriers but not all, and the company pays their own carrier's
// forwarding charge if they have one. Both are worth saying out loud.
//
// ══ 2. BUY — a new number, instantly ══════════════════════════════════════
//
// Right for a company that wants a separate line — a dedicated "new enquiries"
// number for ads, or a second trade. Instant, no paperwork, and it's a genuinely
// new number so nothing existing is at risk.
//
// ══ 3. PORT — move the number itself ══════════════════════════════════════
//
// Offered because some companies will insist, and refusing sends them to a
// competitor. But it is the one path that can hurt:
//   * Two to four weeks, driven by the losing carrier, not by us.
//   * A mismatch between the account name on file and what they type will
//     reject it — usually silently, from their point of view.
//   * If it half-completes, their business line is unreliable during the
//     window, and that window is their working week.
//
// So the UI leads with forwarding, prices porting the same as buying, and says
// the timeline before they start rather than after.
import { db } from "@/lib/db";

/** What each path is, for the UI. Single source, so the copy can't drift. */
export const NUMBER_SOURCES = [
  {
    key: "forwarded",
    label: "Keep my number, forward missed calls",
    recommended: true,
    setupMinutes: 2,
    blurb:
      "You keep the number that's on your van. Calls you don't pick up ring through to the receptionist instead of voicemail.",
    caveat:
      "This rents a second line for the receptionist to answer on — that's the monthly charge, and it's the number your forwarding code points at. You keep giving out your own. You set the forwarding on your own phone, and you can turn it off the same way in under a minute.",
  },
  {
    key: "purchased",
    label: "Get a new number",
    recommended: false,
    setupMinutes: 1,
    blurb:
      "A separate line for the receptionist. Good for ads, or a second trade you want to track on its own.",
    caveat: "It's a new number, so it won't catch calls to the one you already advertise.",
  },
  {
    key: "ported",
    label: "Move my number over",
    recommended: false,
    setupMinutes: 60 * 24 * 21,
    blurb:
      "Your existing number transfers to us permanently. Nothing to forward, and one number to manage.",
    caveat:
      "Two to four weeks, and the timing is your old carrier's to control. Most people should forward instead — it's the same result, today, and reversible.",
  },
];

/**
 * The dial codes for conditional forwarding.
 *
 * These are the GSM standard codes and they work on most North American
 * carriers. They are shown as a starting point with the carrier named, NOT as a
 * promise: a few carriers use their own codes, and an instruction that silently
 * doesn't work leaves someone believing their calls are covered when they
 * aren't. The UI says "if these don't work, your carrier's support can set it
 * up in a minute" rather than pretending this list is complete.
 */
export function forwardingCodes(target) {
  const n = String(target || "").replace(/[^\d+]/g, "");
  return [
    // ── Why the TIMED code leads ────────────────────────────────────────────
    //
    // Plain `*61*<n>#` sets the no-answer DESTINATION but not the no-answer
    // TIMER, and most carriers' voicemail answers at ~15-20s — so an ignored
    // call reaches voicemail before the forward ever fires and the receptionist
    // never rings. That's the single most-reported "it doesn't work". Asking for
    // 10 seconds explicitly wins the race on carriers that honour the *11* field.
    {
      when: "When you don't answer (recommended)",
      code: `*61*${n}*11*10#`,
      note: "Forwards after ~10 seconds — before your carrier's voicemail can pick up. Try this one first.",
    },
    {
      when: "When you don't answer (if the above is rejected)",
      code: `*61*${n}#`,
      note: "Same thing without the timer. Some carriers only accept this form — but their voicemail may answer first.",
    },
    {
      when: "When your line is busy",
      code: `*67*${n}#`,
      note: "Also covers DECLINING a call — many phones treat 'decline' as busy, not as no-answer. Worth setting alongside the one above.",
    },
    { when: "When your phone is off or out of signal", code: `*62*${n}#` },
    {
      when: "Every call, straight through",
      code: `*21*${n}#`,
      note: "Your phone won't ring at all — the receptionist takes everything. The most reliable option if conditional forwarding won't stick on your carrier.",
    },
    { when: "Turn all of it off", code: "##002#", note: "Cancels every forwarding rule." },
  ];
}

/** E.164, or null. One normaliser, so a webhook lookup can't miss on format. */
export function toE164(input, defaultCountry = "1") {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;

  if (raw.startsWith("+")) return `+${digits}`;
  // North American: 10 digits, or 11 starting with 1.
  if (digits.length === 10) return `+${defaultCountry}${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Anything else is returned as-is with a plus, rather than guessed at — a
  // wrong country code is a number that rings a stranger.
  return digits.length >= 8 ? `+${digits}` : null;
}

/**
 * Is this actually a toll-free number?
 *
 * Asked because the answer was previously assumed. The purchase request didn't
 * say which kind it wanted while the price did, so a company could be charged
 * the toll-free rate ($9/month plus 5¢ a minute) for a local line. The request
 * now says so explicitly — and this exists to CHECK, because "we asked for
 * toll-free" is not the same as "we got one", and the difference is money.
 *
 * The list is the NANP toll-free set. 822/880–887 are reserved for future
 * toll-free use and deliberately absent: a number in a range that isn't
 * assignable yet is not one anybody was sold.
 */
export const TOLL_FREE_PREFIXES = ["800", "833", "844", "855", "866", "877", "888"];

export function isTollFreeNumber(e164) {
  const m = /^\+1(\d{3})\d{7}$/.exec(String(e164 || ""));
  return Boolean(m) && TOLL_FREE_PREFIXES.includes(m[1]);
}

/** Display form: +15551234567 → (555) 123-4567. Falls back to the input. */
export function formatNumber(e164) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(String(e164 || ""));
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164 || "";
}

/**
 * The number this company gives out.
 *
 * For a forwarded setup that's THEIR number, not ours. Printing ours on a
 * booking page would undo the entire reason they chose forwarding.
 */
export function publicNumberFor(row) {
  if (!row) return null;
  if (row.source === "forwarded") return row.publicNumber || null;
  return row.e164;
}

/** The company's active number, or null. */
export async function activeNumber(companyId) {
  if (!companyId) return null;
  return db.voicePhoneNumber.findFirst({
    where: { companyId, status: { in: ["active", "porting"] } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Any number row this company still HOLDS — including a stalled one.
 *
 * Deliberately wider than activeNumber(), and for one reason: `provisioning`.
 *
 * The buy route used to create its row on the schema default, `provisioning`,
 * and nothing ever promoted it. So a number that had been bought at the
 * provider and charged a month's rental matched neither the duplicate guard nor
 * the settings screen — the contractor saw the setup cards come back unchanged,
 * pressed again, and bought a second live number. Two activity entries, two
 * rentals, nothing on screen.
 *
 * The write path is fixed (the route now writes `active` explicitly), but rows
 * created before that fix still exist and are still costing money. Anything
 * asking "may they buy another one?" or "what do we show them?" has to see
 * those, or the same silent duplicate is one click away for every company that
 * already has one.
 *
 * `failed` and `released` are excluded on purpose: neither is a number they
 * hold, and blocking on them would strand a company after one bad attempt.
 *
 * `prisma` takes a transaction client. The buy route re-asks this question
 * INSIDE a serialisable transaction, and a read on the global client would be a
 * read outside that transaction — a different connection, a different snapshot,
 * and no read-write conflict for Postgres to detect. Same convention as
 * lib/voice/credits.js, which threads a client for the same reason.
 */
export async function heldNumber(companyId, prisma = db) {
  if (!companyId) return null;
  return prisma.voicePhoneNumber.findFirst({
    where: { companyId, status: { in: ["provisioning", "active", "porting"] } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Is the shared test number in play?
 *
 * The owner has one number for trying this out before any company buys their
 * own. It must never be handed to a real tenant: two companies answering on one
 * line means a caller reaches the wrong business, which is worse than the
 * feature not existing.
 */
export function isSharedTestNumber(e164) {
  const shared = (process.env.RETELL_TEST_NUMBER || "").split(",").map((s) => s.trim());
  return shared.filter(Boolean).includes(String(e164));
}
