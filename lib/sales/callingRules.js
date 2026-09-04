// lib/sales/callingRules.js
//
// WHICH rules bind a sales call, WHERE they bind, and whether this call may be
// placed right now.
//
// ══ Why a table and not a function full of if-statements ═══════════════════
//
// lib/sales/callingWindow.js encodes ONE window — Canada's — as constants,
// because when it was written Canada was the only jurisdiction anyone had
// read. That was honest then and is wrong now: the same file's window was
// being applied, in principle, to a prospect in Oklahoma whose statute says
// something different, and in practice to nobody at all, because nothing in
// production ever called it. `app/sales/queue/page.js` rendered a `tel:` link
// with no check of any kind, so a rep could dial at three in the morning.
//
// The rules differ per jurisdiction along four axes at once — window start,
// window end, whether the weekend differs, and whether there is a cap on how
// often the same business may be rung — and, crucially, along a fifth that no
// window function can express: whether anybody has actually READ that
// jurisdiction's law. So this is a table of rows with a `verified` flag, and
// the flag is load-bearing. A row that says "we have not read this" must
// produce "we cannot confirm this is allowed", never "allowed".
//
// ══ There is no permissive default, and that is the whole design ═══════════
//
// The obvious shape was a federal floor with state overrides. It cannot be
// built, because there is no federal floor for these calls:
//
//   16 CFR 310.6(b)(7) exempts business-to-business calls from the ENTIRE
//   Telemarketing Sales Rule, and the TSR's 8am–9pm restriction (16 CFR
//   310.4(c)) is limited to calls to a RESIDENCE in the first place. FieldQuo
//   sells software to contractors for use in their business. Federal calling
//   hours therefore do not bind these calls at all, and a "federal default" in
//   this table would be an invented rule wearing a citation.
//
// So an unlisted US state resolves to `unknown`, not to a comfortable 8-to-9.
// That is a strong posture and it is deliberate: AGENTS.md failure class #5,
// padding absent data with defaults.
//
// ══ The read has now happened, and it did not make the posture softer ══════
//
// 2026-09-03: 49 of the 50 states plus DC were read against primary or
// authoritative-secondary sources, and the owner item at
// docs/sales-intel/AUDIT-compliance.md §8 — "get a state-law read for the US
// states actually targeted" — is done for the states in the extract. What the
// read found is that the shape of the answer is NOT "most states mirror the
// federal window":
//
//   - Most state windows are written for a RESIDENCE and genuinely do not
//     reach a call to a business line. Those rows are `window: null` on a
//     VERIFIED row and take FieldQuo's courtesy window instead.
//   - A minority — Illinois, New York, Virginia, New Jersey and eight others —
//     are written to reach any called party, and those bind.
//   - Arizona's answer is neither: a flat ban on unsolicited sales calls to
//     mobiles that no hour of the day satisfies. `prohibition` exists for it.
//   - Iowa and Vermont are still `unknown` ON PURPOSE. Both look permissive
//     and neither was provable to this file's standard — see their rows.
//
// The rows that stayed unknown are the point. Two states out of fifty-one is a
// finding; fifty-one was a placeholder. Rendering "we cannot confirm this is
// allowed" on the queue screen is what kept the item visible until it was.
//
// ══ 47 U.S.C. 227(b)(1)(A)(iii) is out of scope, and stays that way ════════
//
// The TCPA's ban on autodialled and artificial-voice calls to wireless numbers
// has NO business exemption, and small contractors answer on mobiles. It is
// not triggered today for one structural reason: the queue dials through a
// `tel:` link a human presses, and the automated voice path
// (lib/voice/outboundCall.js) requires a companyId and targets a tenant's own
// client. No sales path reaches it. That is a property worth keeping rather
// than a fact worth noting, so scripts/check-sales-calling-window.mjs walks the
// import graph from every sales entry point and fails if it ever does.
//
// ══ What this file deliberately does NOT do ════════════════════════════════
//
// Registration. Washington (RCW 19.158.050) and Texas (Bus. & Com. Code ch.
// 302) require a telephone solicitor to register — and post security — BEFORE
// the first call, and Canada's National DNCL registration is free and
// mandatory even for callers whose calls are exempt. None of that is code: it
// is a form, a fee and a bond. It is carried here as a per-jurisdiction flag
// so the screen can say it out loud and the owner can see which markets are
// gated on a signature, and it is a WARNING rather than a refusal because
// nothing in this system can know whether the certificate is in the drawer.
// Flip `registration.done` to true in this table when it is, and cite the
// registration number in the commit.
import { SALES_CALL_WINDOW, localTimeIn } from "./callingWindow";

export const CALL_ALLOWED = "allowed";
export const CALL_REFUSED = "refused";
export const CALL_UNKNOWN = "unknown";

/**
 * A window that is the same every day, expressed the way SALES_CALL_WINDOW is
 * so one evaluator serves both.
 *
 * Minutes from local midnight rather than hours, for callingWindow.js's reason:
 * Canada's weekday cutoff is 21:30, and an hour-granular representation has to
 * round it to a side, both of which are wrong.
 */
function flat(startMinute, endMinute, closedWeekdays = []) {
  return {
    weekday: { startMinute, endMinute },
    weekend: { startMinute, endMinute },
    closedWeekdays,
  };
}

/**
 * `closedWeekdays` — days on which the jurisdiction permits NO call at all.
 *
 * Added because three states say so in terms and the weekday/weekend pair
 * cannot express it: Saturday and Sunday share one bound, so a Sunday ban
 * would have had to close Saturday too. Alabama's PSC rule, Mississippi's
 * §77-3-723(1) and Pennsylvania's Act 47 of 2026 each ban Sunday outright
 * while leaving Saturday open, and encoding that as "weekend closed" would
 * have cost every Saturday in three states to describe a rule about Sundays.
 *
 * JavaScript weekday numbering, to match `localTimeIn`: 0 = Sunday.
 *
 * ══ What this deliberately does NOT model ══════════════════════════════════
 *
 * HOLIDAYS. Alabama bans solicitation on holidays and Rhode Island on state
 * and federal holidays, and neither is encoded, because "holiday" is a moving
 * per-state list and a half-built holiday calendar that is right about Labor
 * Day and wrong about Confederate Memorial Day is worse than none. Those rows
 * carry the ban in `handEnforced` instead, so it is SAID on the screen rather
 * than silently not applied — the same move `maxCallsPer24h` already makes for
 * a cap nothing counts.
 */
const NO_DAYS_CLOSED = [];
const SUNDAY = 0;

/** 08:00–20:00, every day. The shape Oklahoma, Florida and Washington share. */
const EIGHT_TO_EIGHT = flat(8 * 60, 20 * 60);
/** 08:00–21:00, every day. The commonest state window — Illinois, New York, the Carolinas. */
const EIGHT_TO_NINE = flat(8 * 60, 21 * 60);

/**
 * The jurisdictions, as data.
 *
 * `verified: true` means a human read the primary source named in `citation`
 * and the window below is what it says. `verified: false` means the
 * jurisdiction is KNOWN TO MATTER and has not been read — it is listed rather
 * than omitted so the screen can say which statute is outstanding, which an
 * absent row cannot.
 *
 * `window: null` on a verified row means the jurisdiction was read and imposes
 * no time-of-day restriction. That is a finding, and it is not the same as
 * `verified: false` — see US-NV, where the distinction is the whole point.
 *
 * `maxCallsPer24h` is a cap on calls to the same called party on the same
 * subject within 24 hours. Only two jurisdictions here have one, and neither
 * can be enforced until something records call attempts — see
 * `salesCallReadiness`, which reports that gap rather than ignoring it.
 *
 * `dataAcquisition` is not about dialling at all. Several states regulate
 * OBTAINING a list of licensed contractors for solicitation, which is upstream
 * of this gate and of the discovery pipeline both. It rides here because this
 * is the file that already knows which jurisdiction a prospect is in, and
 * because a constraint recorded nowhere is a constraint nobody meets.
 */
export const CALLING_JURISDICTIONS = Object.freeze({
  // ── Canada: federal, and the same in every province ─────────────────────
  //
  // The CRTC's Unsolicited Telecommunications Rules are federal, so there is
  // one Canadian row rather than thirteen. B2B calls are exempt from Part II
  // (the National DNCL) ONLY; Parts III and IV still apply in full, which is
  // where the hours, the identification requirement and the internal
  // do-not-call list come from.
  CA: {
    code: "CA",
    name: "Canada",
    verified: true,
    window: SALES_CALL_WINDOW,
    maxCallsPer24h: null,
    citation:
      "CRTC Unsolicited Telecommunications Rules, Part III (Telemarketing Rules): " +
      "09:00–21:30 weekdays and 10:00–18:00 weekends in the called party's time zone. " +
      "Business-to-business calls are exempt from Part II (National DNCL) only.",
    registration: {
      required: true,
      done: false,
      what:
        "Registration with Canada's National DNCL at lnnte-dncl.gc.ca. Free, and " +
        "mandatory even for a telemarketer whose calls are exempt. A subscription " +
        "is a different thing and is almost certainly not needed.",
    },
    dataAcquisition: null,
  },

  // ── United States, by state ─────────────────────────────────────────────

  "US-OK": {
    code: "US-OK",
    name: "Oklahoma",
    verified: true,
    window: EIGHT_TO_EIGHT,
    maxCallsPer24h: 3,
    citation:
      "15 O.S. §775C.1 et seq. — 'called party' carries no consumer or residential " +
      "limitation, so these calls are in scope: 08:00–20:00 local, and no more than " +
      "three calls in 24 hours on the same subject. Private right of action, $500 " +
      "trebled. The B2B exemption at §775C.5(10) requires three years' trading under " +
      "the same name with at least half of sales repeat business to existing " +
      "customers; FieldQuo cannot meet it, so it is assumed not to apply.",
    registration: null,
    dataAcquisition: null,
  },

  "US-FL": {
    code: "US-FL",
    name: "Florida",
    verified: true,
    window: EIGHT_TO_EIGHT,
    maxCallsPer24h: 3,
    citation:
      "Fla. Stat. §501.616(6) — 08:00–20:00 local and no more than three calls in " +
      "24 hours on the same subject. NOT §501.059, which is the do-not-call " +
      "provision and a different rule. §501.603 defines 'person' to include a sole " +
      "proprietorship or any other business entity, so a contractor's business line " +
      "is inside it.",
    registration: null,
    dataAcquisition: null,
  },

  "US-WA": {
    code: "US-WA",
    name: "Washington",
    verified: true,
    window: EIGHT_TO_EIGHT,
    maxCallsPer24h: null,
    citation:
      "RCW 19.158.110(4) bars a telephone solicitation before 08:00 or after 20:00 " +
      "to 'any person', with no business-to-business carve-out, and a violation is a " +
      "per se Consumer Protection Act violation (treble damages, fee-shifting). " +
      "RCW 80.36.390 points the other way — §(1)(b)(v) expressly excludes " +
      "'business-to-business contacts' — but excluding one statute does not lift " +
      "the other, so the 08:00–20:00 window is encoded on the 19.158 basis.",
    registration: {
      required: true,
      done: false,
      what:
        "RCW 19.158.050 requires a commercial telephone solicitor to register with " +
        "the Department of Licensing and post security BEFORE the first call. This " +
        "is a filing and a bond, not code.",
    },
    dataAcquisition: null,
  },

  "US-NV": {
    code: "US-NV",
    name: "Nevada",
    verified: true,
    // Read, and there is nothing to encode. `null` is a FINDING here — the
    // statutes were checked and impose no time-of-day restriction on this call
    // — which is why it must not be confused with `verified: false`. See
    // FIELDQUO_COURTESY_WINDOW below for what happens next, and why it is
    // labelled as FieldQuo's manners rather than as Nevada's law.
    window: null,
    maxCallsPer24h: null,
    citation:
      "NRS 239 and NRS/NAC 624 carry no commercial-purpose or solicitation " +
      "restriction, and NRS 624.110(1) affirmatively requires the contractor licence " +
      "record be kept open to the public. Nothing in Nevada law restricts the hours " +
      "of a business-to-business sales call, and no federal rule fills the gap: " +
      "16 CFR 310.6(b)(7) exempts B2B from the TSR entirely.",
    registration: null,
    dataAcquisition: null,
  },

  "US-AZ": {
    code: "US-AZ",
    name: "Arizona",
    // The calling hours were NOT read. What was read is a public-records rule
    // about how the prospect list may be obtained, which is a different
    // question and does not make the calling question answered.
    verified: false,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Arizona's telephone solicitation hours have not been read. Separately and " +
      "verified: A.R.S. §39-121.03(D) names 'obtaining of names and addresses … for " +
      "the purpose of solicitation' as a commercial purpose, so a written statement " +
      "of purpose is required to obtain the records, market-value pricing is " +
      "permitted, and §39-121.03(C) allows treble damages for misstating the purpose.",
    registration: null,
    dataAcquisition:
      "A.R.S. §39-121.03: obtaining names and addresses from an Arizona public body " +
      "for solicitation requires a written declaration of that purpose. Misstating it " +
      "carries treble damages. This binds the discovery pipeline, not the dialler.",
  },

  "US-TX": {
    code: "US-TX",
    name: "Texas",
    verified: false,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Texas Bus. & Com. Code ch. 302 requires a telephone solicitor to register and " +
      "post security, and that requirement could NOT be verified this session — the " +
      "statute sites now serve a JavaScript shell and the Secretary of State returns " +
      "403. Calling hours were not read either. Separately and verified: Gov't Code " +
      "§552.222(b) forbids a Texas agency from asking why a requestor wants records, " +
      "so obtaining a list is unconstrained on the requestor's side.",
    registration: {
      required: true,
      done: false,
      what:
        "Texas Bus. & Com. Code ch. 302 registration and security. Status UNKNOWN — " +
        "not confirmed either way. Treat Texas as gated until somebody reads it.",
    },
    dataAcquisition: null,
  },

  // ══ The 2026-09-03 state-law read ════════════════════════════════════════
  //
  // The owner's outstanding item — "get a state-law read for the US states
  // actually targeted" — done for 43 of the 50 states plus the four already
  // here. Every row below quotes the operative SCOPE words of the statute,
  // because scope is the whole question and the hours are the easy part.
  //
  // ══ What the read actually found, and why it is not what was expected ═══
  //
  // The brief expected most states to mirror the federal 8-to-9 and a few to
  // exempt B2B. The truth is messier in both directions, and three patterns
  // recur:
  //
  //  1. MOST state windows are written for a RESIDENCE and genuinely do not
  //     reach this call. Texas is the clearest: §301.051(b)(2) has a real
  //     window, and §301.001(4) limits it to "an unsolicited call made to a
  //     residential telephone number" for a "consumer good or service". Both
  //     limbs fail here. Those states get `window: null` on a VERIFIED row —
  //     the Nevada shape — and FieldQuo's courtesy window applies instead.
  //
  //  2. A minority of windows are written to reach ANY called party, and
  //     those bind. Illinois — "No person shall solicit the sale of goods or
  //     services in this State by placing a telephone call during the hours
  //     between 9 p.m. and 8 a.m." — has no residential limb at all.
  //
  //  3. The dangerous middle: a state whose window is limited to a NATURAL
  //     PERSON rather than to a residence. New York's "customer" is "any
  //     natural person who is a resident of this state". A sole-proprietor
  //     painter is a natural person; an LLC is not; and Overture cannot tell
  //     us which. Those states are encoded as BINDING, because the directory
  //     row does not carry the fact the exemption turns on.
  //
  // ══ Registration is the bigger exposure than the clock ══════════════════
  //
  // Six states require FieldQuo to register, and several to post a bond,
  // BEFORE the first call — and their B2B exemptions do not reach it. Texas
  // is the sharpest: §302.056's "commercial sales" exemption covers only a
  // purchaser who RESELLS the item or uses it in manufacturing, so a
  // contractor buying software to run his own business is not exempt. Those
  // ride as warnings, per this file's existing rule: nothing here can know
  // whether the certificate is in the drawer.

  // ── Verified: a statutory window binds this call ────────────────────────

  "US-IL": {
    code: "US-IL",
    name: "Illinois",
    verified: true,
    window: EIGHT_TO_NINE,
    maxCallsPer24h: null,
    citation:
      "815 ILCS 413/15(a): 'No person shall solicit the sale of goods or services in this " +
      "State by placing a telephone call during the hours between 9 p.m. and 8 a.m.' There " +
      "is no residential, consumer or subscriber limb anywhere in that sentence, and " +
      "413/5 defines 'telephone solicitation' as a communication 'by live operators' — " +
      "which is exactly this call. The 413/10 exemptions are institutional (telecoms, " +
      "banks, insurers, real-estate licensees) and reach nothing here. Illinois is " +
      "wholly Central, so the derived zone is unambiguous. Read at ilga.gov.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-NY": {
    code: "US-NY",
    name: "New York",
    verified: true,
    window: EIGHT_TO_NINE,
    maxCallsPer24h: null,
    citation:
      "N.Y. Gen. Bus. Law §399-z(2): no telemarketing 'at any time other than between " +
      "8:00 A.M. and 9:00 P.M. at the location of the customer'. §399-z(1)(c) defines " +
      "'customer' as 'any natural person who is a resident of this state' — a SOLE " +
      "PROPRIETOR is one, an LLC is not, and nothing in a directory row says which, so " +
      "the window is applied. The drafters used 'person' (which §399-z(1)(g) defines to " +
      "include a corporation) elsewhere in the same section and 'customer' here, which " +
      "is the strongest signal there is. TRAP: §399-pp(10)(b)(4) DOES exempt B2B — but " +
      "from §399-pp only. §399-z has no B2B exemption. Fines to $20,000 per violation " +
      "(§399-z(14)(a)). Read at nysenate.gov.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-NC": {
    code: "US-NC",
    name: "North Carolina",
    verified: true,
    window: EIGHT_TO_NINE,
    maxCallsPer24h: null,
    citation:
      "N.C.G.S. §75-102(f) entire: 'No telephone solicitor shall make a telephone " +
      "solicitation before 8:00 A.M. or after 9:00 P.M.' No residence, no subscriber, no " +
      "time zone, no exception — and §75-103, which lifts other subsections for small " +
      "callers and established relationships, pointedly does not list (f). The " +
      "residential limb sits only in §75-101's 'telephone subscriber', whose wireless " +
      "branch is grammatically ambiguous and may not be residence-qualified at all. " +
      "Because §75-102(f) states NO time zone, the safe reading is both clocks. Read at " +
      "codes.findlaw.com — ncleg.gov returned 403.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-VA": {
    code: "US-VA",
    name: "Virginia",
    verified: true,
    window: EIGHT_TO_NINE,
    maxCallsPer24h: null,
    citation:
      "Va. Code §59.1-511: no telephone solicitation 'at any time other than between " +
      "8:00 a.m. and 9:00 p.m. local time at the contacted person's location'. §59.1-510 " +
      "defines the covered call by NUMBER, not by who answers — 'to any landline or " +
      "wireless telephone with a Virginia area code' — so a contractor's business line " +
      "is squarely inside it. No B2B exemption exists anywhere in ch. 44; §59.1-514(D)'s " +
      "carve-outs lift the do-not-call section only. Amended by 2025 c. 626. Read at " +
      "law.lis.virginia.gov.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-SC": {
    code: "US-SC",
    name: "South Carolina",
    verified: true,
    window: EIGHT_TO_NINE,
    maxCallsPer24h: null,
    citation:
      "S.C. Code §37-21-30: no telephone solicitation 'at any time other than between " +
      "8:00 a.m. and 9:00 p.m. local time at the consumer's location'. §37-21-20(6) " +
      "reaches a call 'to a natural person's residence in the State, OR to a wireless " +
      "telephone with a South Carolina area code' — the second branch carries no " +
      "residence, natural-person or non-business qualifier. No B2B exemption. Private " +
      "right of action, $1,000 per violation and $5,000 if wilful (§37-21-80). NOTE: " +
      "§16-17-445 was deleted by 2018 Act 218; anything citing it cites dead law. Read " +
      "at scstatehouse.gov.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-NJ": {
    code: "US-NJ",
    name: "New Jersey",
    verified: true,
    window: EIGHT_TO_NINE,
    maxCallsPer24h: null,
    citation:
      "N.J.S.A. 56:8-128(c): no unsolicited telemarketing sales call 'to any customer " +
      "between the hours of 9 p.m. and 8 a.m., local time, at the customer's location'. " +
      "The word that would free a B2B call — 'residential' — appears in the DEFINITION " +
      "of 'telemarketer' and in the regulation's scope clause (N.J.A.C. 13:45D-1.2), " +
      "never in the operative prohibition, which says 'any customer'; and 56:8-120 " +
      "defines 'customer' as 'an individual who is a resident of this State'. Encoded as " +
      "binding on that basis. No B2B exemption anywhere in the act or ch. 45D. Read in " +
      "the Division of Consumer Affairs' own published statute and rule PDFs.",
    registration: {
      required: true,
      done: false,
      what:
        "N.J.S.A. 56:8-121 requires annual registration with the Division of Consumer " +
        "Affairs, expressly 'including telemarketers whose residence or principal place " +
        "of business is located outside of this State', and 56:8-126(a) permits a bond of " +
        "not less than $25,000. NO B2B exemption reaches it — the only argument against " +
        "registering is the same inference that 'telemarketer' is defined by making " +
        "RESIDENTIAL calls. That is the weakest link in this table and wants a lawyer.",
    },
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-NM": {
    code: "US-NM",
    name: "New Mexico",
    verified: true,
    // 09:00, not 08:00. New Mexico opens an hour later than everybody else and
    // a copied 8-to-9 would be unlawful for that hour every morning.
    window: flat(9 * 60, 21 * 60),
    maxCallsPer24h: null,
    citation:
      "NMSA §57-12-22(B): unlawful for 'a person' to make a telephone solicitation " +
      "'(5) that are received before 9:00 a.m. or after 9:00 p.m.' — NOTE 09:00, an hour " +
      "later than the federal rule. The absence of a residential limb is deliberate " +
      "drafting, not an oversight: paragraph (2) of the SAME list says 'a residential " +
      "subscriber' and subsection C says it twice, while (5) does not. None of the five " +
      "exclusions in §57-12-22(D)(4) is a B2B carve-out. The statute names no time zone; " +
      "'received' is read as the called party's. Read at lawserver and codes.findlaw.com, " +
      "agreeing — no New Mexico government source was reachable.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-MD": {
    code: "US-MD",
    name: "Maryland",
    verified: true,
    window: EIGHT_TO_EIGHT,
    maxCallsPer24h: 3,
    citation:
      "Md. Com. Law §14-4502(c): no telephone solicitation, 'including a call made " +
      "through automated dialing or a recorded message', 'to a called party during the " +
      "hours between 8 p.m. and 8 a.m. in the called party's time zone' — 'including' " +
      "makes automated calls a subset, not the limit. §14-4501(b)'s 'called party' has no " +
      "residential limb. The B2B exemption claimed in the old note IS real but is " +
      "confined to §14-4502(a) — 'This subsection does not apply to' — which is the " +
      "written-consent rule for autodialers, so it does not reach the hours in (c). " +
      "§14-4502(c)(2) also caps three calls per called party per 24h on the same " +
      "subject. Read at mgaleg.maryland.gov, statute and 2023 ch. 414 session law.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-MI": {
    code: "US-MI",
    name: "Michigan",
    verified: true,
    window: flat(9 * 60, 21 * 60),
    maxCallsPer24h: null,
    citation:
      "MCL 750.540e(1)(f) bars 'an unsolicited commercial telephone call that is received " +
      "between the hours of 9 p.m. and 9 a.m.', defined in the same subdivision as 'a " +
      "call made by a person or recording device … soliciting business or contributions' " +
      "— no residential limb, and human dialling expressly included. CONTESTABLE, in the " +
      "permissive direction: §540e is a criminal harassment statute whose preamble " +
      "requires acting 'maliciously … with intent to … annoy', which an ordinary sales " +
      "call arguably never satisfies. Encoded as binding anyway, because paragraph (f) " +
      "would be surplusage if malice were always absent. Text from codes.findlaw.com — " +
      "the Michigan Legislature's own site fails TLS verification.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-CT": {
    code: "US-CT",
    name: "Connecticut",
    verified: true,
    // 09:00–20:00: narrower at BOTH ends than the courtesy window, so it is
    // the operative constraint rather than a decoration.
    window: flat(9 * 60, 20 * 60),
    maxCallsPer24h: null,
    citation:
      "Conn. Gen. Stat. §42-288a(c) limits a telephonic sales call 'to any consumer " +
      "residential, mobile or telephonic paging device telephone number' to 'between the " +
      "hours of nine o'clock a.m. and eight o'clock p.m. local time'. §42-284(18)(B)(iv) " +
      "excludes a call 'made … as part of a business-to-business contact', which on its " +
      "face removes this call entirely — but the term is UNDEFINED, the window's own " +
      "scope words reach a 'mobile' number, and since P.A. 23-98 the fallback for a " +
      "covered call is PRIOR EXPRESS WRITTEN CONSENT, not a window. So the statutory " +
      "window is applied rather than relying on the carve-out. Read at cga.ct.gov.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-UT": {
    code: "US-UT",
    name: "Utah",
    verified: true,
    window: flat(8 * 60, 21 * 60, [SUNDAY]),
    maxCallsPer24h: null,
    citation:
      "Utah Code §13-25a-103(3) bars a telephone solicitation 'to a residential telephone " +
      "or CELLULAR TELEPHONE without prior express consent' '(a) between the hours of " +
      "9 p.m. and 8 a.m. local time; (b) on a Sunday; or (c) on a legal holiday'. " +
      "'Cellular telephone' is unqualified, so a contractor's business mobile is inside " +
      "it, and §13-25a-102(8) defines the trigger as any call 'for a commercial purpose' " +
      "with no consumer limb. No B2B exemption in ch. 25a. Single-call private action, " +
      "$500 minimum (§13-25a-107). Read in le.utah.gov's official chapter PDF.",
    registration: {
      required: true,
      done: false,
      what:
        "Utah Code §13-26-102 requires annual registration with the Division before " +
        "telephone solicitations that 'are received in Utah', plus a surety bond of " +
        "$25,000 (under 10 employees) or $50,000, plus a fingerprint card and criminal " +
        "background check. None of §13-26-104's fourteen exemptions is a B2B carve-out.",
    },
    dataAcquisition: null,
    prohibition: null,
    handEnforced: [
      {
        code: "closed_holidays",
        title: "Utah also bars solicitation on any legal holiday, and FieldQuo is not counting those.",
        fix:
          "§13-25a-103(3)(c) closes legal holidays outright, on top of the Sunday ban this " +
          "screen does enforce. No holiday calendar is encoded — a half-built one that is " +
          "right about Labor Day and wrong about Pioneer Day would be worse than none — so " +
          "check the date yourself before dialling Utah.",
      },
    ],
  },

  "US-AL": {
    code: "US-AL",
    name: "Alabama",
    verified: true,
    window: flat(8 * 60, 20 * 60, [SUNDAY]),
    maxCallsPer24h: null,
    citation:
      "Ala. Admin. Code r. 770-X-5-.17(2), which applies 'to all live solicitation " +
      "telephone calls to consumers in the State of Alabama': 'No solicitation calls are " +
      "allowed on Sundays or holidays. On the days that calls are allowed, none will be " +
      "placed prior to 8 a.m. or after 8 p.m.' The operative word is 'consumers', which " +
      "the rule leaves undefined — it is NOT residential-limited on its face. Neither " +
      "Ala. Code ch. 19A nor ch. 19C carries any hours provision. CAVEAT: this is a " +
      "Public Service Commission rule made under utility authority, and whether the PSC " +
      "can enforce it against an out-of-state non-utility is genuinely arguable. Read at " +
      "law.cornell.edu — the state's own PDF uses a subset font and will not extract.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: [
      {
        code: "closed_holidays",
        title: "Alabama also bars solicitation on holidays, and FieldQuo is not counting those.",
        fix:
          "r. 770-X-5-.17(2)(b) closes holidays as well as Sundays. Only the Sunday half is " +
          "enforced here; 'holiday' is a moving per-state list and an invented calendar " +
          "would be padding absent data with defaults. Check the date yourself.",
      },
    ],
  },

  "US-MS": {
    code: "US-MS",
    name: "Mississippi",
    verified: true,
    window: flat(8 * 60, 20 * 60, [SUNDAY]),
    maxCallsPer24h: null,
    citation:
      "Miss. Code §77-3-723(1): 'Such calls may only be made between the hours of " +
      "8:00 a.m. and 8:00 p.m. Central Standard Time. No telephone solicitations may be " +
      "made on a Sunday.' Mississippi is the one state that names businesses as protected " +
      "parties outright — §77-3-705 defines 'consumer' as 'a person OR BUSINESS that " +
      "receives a telephone call or text message from a telephone solicitor'. §77-3-711's " +
      "exemptions are occupational and reach nothing here. NOTE the statute says 'Central " +
      "STANDARD Time', a fixed zone, not local time and not CDT; the window is evaluated " +
      "in the called party's zone, which in summer is the stricter reading. Read at " +
      "codes.findlaw.com — the state's own bill server fails TLS.",
    registration: {
      required: true,
      done: false,
      what:
        "Miss. Code §77-3-713: 'All telephone solicitors must register with the Attorney " +
        "General before conducting any telephone solicitations in the State of " +
        "Mississippi', with a $75,000 surety bond (§77-3-605) and a Mississippi agent for " +
        "service. Moved from the PSC to the AG by 2023 HB 1225. No B2B exemption reaches " +
        "it, so calling Mississippi unregistered is unlawful at ANY hour.",
    },
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-PA": {
    code: "US-PA",
    name: "Pennsylvania",
    verified: true,
    // ══ Forward-dated deliberately, and this is the interesting one ═══════
    //
    // TODAY Pennsylvania's window is 08:00–21:00 with no Sunday ban:
    // 73 P.S. §2245(a)(1) bars 'Conducting telemarketing after 9 p.m. or
    // before 8 a.m.', and §2242 defines 'Telemarketing' as a campaign to
    // induce the purchase of 'goods or services' — NOT 'consumer goods or
    // services', which is the term used elsewhere in the same act. So it
    // binds B2B today.
    //
    // Act 47 of 2026 (SB 992, approved by the Governor 2026-07-20) replaces
    // it with 09:00–19:00 and closes Sundays entirely, and broadens
    // 'telephone solicitation' to reach business subscribers expressly.
    // "This act shall take effect in 90 days" — mid-October 2026, six weeks
    // from this read.
    //
    // The NARROWER of the two is encoded, not the current one. Encoding
    // 08:00–21:00 would be correct for six weeks and then wrong-permissive
    // by two hours every evening plus all day Sunday, and the thing that
    // would have to happen for that not to bite is somebody remembering. The
    // cost of the other choice is two hours a day of lawful calling time in
    // one state for six weeks. That trade is not close.
    window: flat(9 * 60, 19 * 60, [SUNDAY]),
    maxCallsPer24h: null,
    citation:
      "73 P.S. §2245(a)(1) bars 'Conducting telemarketing after 9 p.m. or before 8 a.m.', " +
      "with no subscriber-type limiter of any kind; §2242 defines 'Telemarketing' as a " +
      "campaign to induce the purchase of 'goods or services' — not 'consumer goods or " +
      "services', the narrower term the same act uses elsewhere — so it binds B2B. Act 47 " +
      "of 2026 (SB 992, approved 2026-07-20, effective in 90 days) narrows it to 'on a " +
      "Sunday or after 7 p.m. or before 9 a.m.' The narrower FUTURE window is what is " +
      "encoded, so this row cannot go wrong-permissive in October. WARNING: PA's compiled " +
      "statute page silently folds in the not-yet-effective text, so reading it alone " +
      "gives neither the current nor the future rule cleanly. §2245(a)(2) separately " +
      "requires honouring a business's own opt-out today. Read at legis.state.pa.us and " +
      "palegis.us.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-RI": {
    code: "US-RI",
    name: "Rhode Island",
    verified: true,
    // The only jurisdiction here whose Saturday differs from its weekdays,
    // which is why `flat` will not do.
    window: {
      weekday: { startMinute: 9 * 60, endMinute: 18 * 60 },
      weekend: { startMinute: 10 * 60, endMinute: 17 * 60 },
      closedWeekdays: [SUNDAY],
    },
    maxCallsPer24h: null,
    citation:
      "R.I. Gen. Laws §5-61-3.6(a) bars an unsolicited telephonic sales call 'to any " +
      "residential, MOBILE, or telephonic-paging-device telephone number except during " +
      "hours of operation', and §5-61-2(2) defines those as 'Monday through Friday, " +
      "except a state or federal holiday, nine o'clock (9:00 a.m.) to six o'clock " +
      "(6:00 p.m.); Saturday ten o'clock (10:00 a.m.) to five o'clock (5:00 p.m.).' Far " +
      "narrower than the federal window — do not substitute 8-to-9. 'Mobile' carries no " +
      "residential or consumer qualifier. None of the thirteen exclusions in §5-61-2(10) " +
      "is a B2B carve-out. Read at webserver.rilegislature.gov.",
    registration: {
      required: true,
      done: false,
      what:
        "R.I. Gen. Laws §5-61-3 requires registration with the Attorney General's consumer " +
        "protection unit 'Not less than ten (10) days prior to doing business in this " +
        "state', which expressly reaches an out-of-state caller soliciting persons located " +
        "in RI, and §5-61-3.1 requires security of at least $30,000 filed first. No B2B " +
        "escape. Unresolved: §5-61-2(9)'s representation-based gateway may put an honest " +
        "SaaS pitch outside the act entirely — that wants counsel before it is relied on.",
    },
    dataAcquisition: null,
    prohibition: null,
    handEnforced: [
      {
        code: "closed_holidays",
        title: "Rhode Island also closes state and federal holidays, and FieldQuo is not counting those.",
        fix:
          "§5-61-2(2) excepts 'a state or federal holiday' from the Monday-to-Friday window. " +
          "Only the Sunday half is enforced here. Check the date yourself before dialling " +
          "Rhode Island.",
      },
    ],
  },

  // ── Verified: read, and NO statutory window binds this call ──────────────
  //
  // These are the Nevada shape — `window: null` on a verified row, meaning the
  // statute was read and imposes nothing on a business-to-business call. The
  // courtesy window applies and every refusal says whose rule it is.

  "US-TX": {
    code: "US-TX",
    name: "Texas",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Tex. Bus. & Com. Code §301.051(b)(2) is Texas's only calling-hours rule and it " +
      "binds a 'consumer telephone call', defined at §301.001(4) as 'an unsolicited call " +
      "made to a RESIDENTIAL telephone number' soliciting a 'consumer good or service' — " +
      "§301.001(3), 'normally used for personal, family, or household purposes'. Both " +
      "limbs fail for business software on a business line. Ch. 304 (the Texas no-call " +
      "list) has no hours provision at all and §304.004(3) excludes a call 'between a " +
      "telemarketer and a business … unless the business has informed the telemarketer " +
      "that the business does not wish to receive' calls — so a business's own opt-out " +
      "must still be honoured. Read at statutes.capitol.texas.gov (via archive) and " +
      "texas.public.law, agreeing.",
    registration: {
      required: true,
      done: false,
      what:
        "Tex. Bus. & Com. Code §302.101(a): a seller may not solicit 'to a purchaser " +
        "located in this state' without a registration certificate; §302.107 adds $10,000 " +
        "security and §302.106 a $200 fee. The old note guessed this was unverifiable — it " +
        "is now read, and it BINDS. §302.056's 'Certain Commercial Sales' exemption is NOT " +
        "a B2B exemption: it covers only a purchaser who 'intends to (1) resell the item " +
        "purchased; or (2) use the item purchased in a recycling, reuse, remanufacturing, " +
        "or manufacturing process'. A contractor running his own business does neither. " +
        "§302.058 needs an existing customer of two years' standing. Criminal offence " +
        "under §302.251(a); civil penalty to $5,000 per violation.",
    },
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-CA": {
    code: "US-CA",
    name: "California",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "California has NO calling-hours rule for a live call. Its only time-of-day " +
      "provision, Pub. Util. Code §2872, is device-scoped — 'A person shall not operate an " +
      "automatic dialing-announcing device … between the hours of 9 p.m. and 9 a.m.' — and " +
      "a human pressing a tel: link is not one. B&P Code art. 8 (§§17590-17594) is the " +
      "do-not-call article and contains no hours term; §17590(a) scopes it to 'residential " +
      "or wireless telephone subscribers'. The registration article (art. 1.4) reaches " +
      "only a 'telephonic seller' as defined by §17511.1(a)-(d), which requires specific " +
      "representations a plain software pitch does not make. Read at leginfo.legislature." +
      "ca.gov and california.public.law. TWO LIVE CAVEATS: §17511.1(a)(3) captures a " +
      "seller who implies a price 'below the regular price', so a discount-with-a-deadline " +
      "script would pull FieldQuo into registration and a $100,000 bond (§17511.12); and " +
      "§17592(c)'s do-not-call prohibition is NUMBER-scoped with no B2B exception among " +
      "its eight carve-outs, so a sole proprietor's mobile on the national registry is in " +
      "scope. Scrub California against the national registry.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-OH": {
    code: "US-OH",
    name: "Ohio",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Ohio has no calling-hours provision at all: R.C. ch. 4719 contains none, and " +
      "O.A.C. 109:4-3-11 has no time-of-day language and is scoped to 'the residence of " +
      "any consumer'. R.C. §109.87 imports the federal rules, and both federal windows are " +
      "residential — 16 CFR 310.4(c) 'to a person's residence', 47 CFR 64.1200(c)(1) 'any " +
      "residential telephone subscriber' — while 16 CFR 310.6(b)(7) exempts B2B from the " +
      "TSR entirely. WARNING: aggregator tables assert 'Ohio 9am-9pm under §4719.04'; " +
      "§4719.04 is the surety-bond section and says no such thing. Read at " +
      "codes.findlaw.com and ohrules.elaws.us — Ohio's own sites refused connections.",
    registration: {
      required: true,
      done: false,
      what:
        "R.C. §4719.02: 'No person shall act as a telephone solicitor without first having " +
        "obtained a certificate of registration … from the attorney general', and §4719.04 " +
        "requires a $50,000 surety bond. §4719.01(A)(8) reaches a caller 'from a location " +
        "outside this state to persons in this state'. The B2B exemption at §4719.01(B)(12) " +
        "is CONDITIONAL and probably unavailable: it needs three years' continuous trading " +
        "under the same name with 51% repeat sales, or a purchaser who resells or " +
        "remanufactures. Violation is a fifth-degree felony (§4719.99).",
    },
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-MA": {
    code: "US-MA",
    name: "Massachusetts",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "M.G.L. c.159C §3 bars an unsolicited telephonic sales call 'to a consumer' " +
      "outside 08:00-20:00 'local time, at the consumer's location', and §1 defines " +
      "'consumer' as 'AN INDIVIDUAL who is a resident of the commonwealth and a " +
      "prospective recipient of consumer goods or services', with 'consumer goods or " +
      "services' meaning those received 'primarily for personal, family or household " +
      "purposes'. Business software fails the second limb outright. 201 CMR 12.02(2) " +
      "matches the statute. Read at malegislature.gov and law.cornell.edu.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-CO": {
    code: "US-CO",
    name: "Colorado",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "No calling-hours provision exists in either Colorado regime. C.R.S. §6-1-904 (the " +
      "no-call list) and §6-1-304 (unlawful telemarketing practices) were both read in " +
      "full and neither carries a time-of-day term; §6-1-903(9) scopes the list to a " +
      "'residential subscriber'. Read at colorado.public.law, sourced to the " +
      "legislature's own CRS PDF. Gap declared: §§6-1-901, -902 and -905 to -908 were not " +
      "read in full, though an hours term is unlikely in a legislative-declaration or " +
      "enforcement section.",
    registration: {
      required: true,
      done: false,
      what:
        "C.R.S. §6-1-303(1): 'No commercial telephone seller shall conduct business in " +
        "this state without having registered with the attorney general at least ten days " +
        "prior', and the triggering definition at §6-1-302(2)(a) is not residential — it " +
        "reaches unsolicited calls 'to a person'. Fee capped at $250; no bond. The only " +
        "B2B carve-out, §6-1-302(1)(t), requires the business to have PREVIOUSLY " +
        "PURCHASED, so it does not cover a cold call.",
    },
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-TN": {
    code: "US-TN",
    name: "Tennessee",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "T.C.A. §65-4-402 limits calls to 08:00-21:00 only 'without the permission of the " +
      "RESIDENTIAL SUBSCRIBER', defined at §65-4-401 as one who 'has subscribed to " +
      "residential telephone service'. Tenn. Comp. R. & Regs. 1220-04-11 defines " +
      "'Business Telephone Subscriber' separately at .01(3) and then imposes no duty " +
      "toward that class. Rule .01(13)(a)2 is directly on point for the hard case: 'The " +
      "use of residential telephone service for the purpose of operating a business " +
      "constitutes express permission for the purposes of these rules.' Read in the " +
      "official SOS rule PDF plus codes.findlaw.com.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-MN": {
    code: "US-MN",
    name: "Minnesota",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Minn. Stat. §325E.30, headed 'TIME OF DAY LIMIT', bars a 'commercial telephone " +
      "solicitation' before 09:00 or after 21:00 — and §325E.26 subd. 2 defines that term " +
      "as 'any unsolicited call to a RESIDENTIAL SUBSCRIBER'. A call to a business line " +
      "is not one, so the clock never starts. Note it is the word 'residential', not " +
      "'subscriber', that carries the limit. Minnesota's own no-call list (§325E.311) is " +
      "marked expired on the Revisor's page. Read at revisor.mn.gov.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-MO": {
    code: "US-MO",
    name: "Missouri",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "RSMo 407.1076(5) bars telemarketing 'to a CONSUMER'S RESIDENCE at any time other " +
      "than between 8:00 a.m. and 9:00 p.m. local time at the called consumer's " +
      "location', and 407.1070 defines 'consumer' as 'a natural person'. A second, " +
      "independent ground: 407.1085.1(4)(d) exempts calls 'Between a telemarketer and any " +
      "business except calls involving the retail sale of nondurable office and cleaning " +
      "supplies' from 407.1070 to 407.1082, which contains the hours rule. NOTE the " +
      "Missouri AG's own FAQ paraphrases the rule more broadly than the text, dropping " +
      "'residence'. Read at revisor.mo.gov.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-OR": {
    code: "US-OR",
    name: "Oregon",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "ORS 646.563(1)(b) sets an 08:00-20:00 window and a three-call cap, but ORS " +
      "646.561(4)(b)(C) excludes 'A business to business call or text message' from the " +
      "definition of 'telephone solicitation' the window operates on. A second express " +
      "carve-out, ORS 646.567(5)(d) 'Business to business contacts', covers the " +
      "do-not-call chapter. The carve-out attaches to the CALL, not the line, which is " +
      "favourable for a contractor's mobile. Read at oregonlegislature.gov. WARNING: " +
      "oregon.public.law serves a stale §646.563 with no hours provision; do not use it.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-KY": {
    code: "US-KY",
    name: "Kentucky",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "KRS 367.46955(16) limits solicitations 'to A PERSON'S RESIDENCE at any time other " +
      "than between 10 a.m. - 9 p.m. local time, at the called person's location'. " +
      "Independently, KRS 367.46951(2) excludes from 'telephone solicitation' altogether " +
      "'A telephone call made by one (1) merchant to another' — a definitional exclusion, " +
      "so it reaches the whole chapter rather than just the DNC part. Read at " +
      "apps.legislature.ky.gov and codes.findlaw.com. Soft spot: whether FieldQuo is a " +
      "'merchant' as defined turns on 'consumer goods or services'; the contractor being " +
      "called plainly is one. KRS 367.46955(14) — do not call 'a person' who has said " +
      "stop — is NOT residential-scoped and binds regardless.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-LA": {
    code: "US-LA",
    name: "Louisiana",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "The Louisiana PSC's Do Not Call General Order (Docket R-29617) §V(A) applies to " +
      "'any person or entity using telephonic access lines for RESIDENTIAL TELEPHONIC " +
      "SOLICITATION PURPOSES', and only then imposes 08:00-20:00, no Sundays or legal " +
      "holidays. La. R.S. 45:844.12 defines 'telephonic solicitation' as a communication " +
      "'to a residential telephonic subscriber', itself 'any natural person who has " +
      "subscribed to residential telephonic service'; the General Order defines 'Business " +
      "telephonic subscriber' separately and pointedly omits it. Read in the LPSC's own " +
      "General Order PDF and at legis.la.gov. FLAG: General Order §V(A)(12)(b) forbids " +
      "calls to a cellular number without prior express consent; it sits inside the " +
      "residential-gated §V(A) block, but if the LPSC read it as free-standing a cold " +
      "call to a contractor's mobile would violate it at any hour. Worth counsel.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-AR": {
    code: "US-AR",
    name: "Arkansas",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Arkansas has no hours language of its own. Ark. Code §4-99-405(3) imports the " +
      "federal rule — a violation to make a solicitation that 'violates the Federal Trade " +
      "Commission Do-Not-Call rule set out in 16 C.F.R. §310.4' — and 16 CFR 310.4(c) " +
      "reaches only 'outbound telephone calls to a person's residence', while 16 CFR " +
      "310.6(b)(7) removes B2B calls from the TSR entirely, so there is nothing to " +
      "violate. §4-99-403 defines 'consumer' as a holder of 'any residential telephone " +
      "line'. Read at codes.findlaw.com and law.onecle.com. TRAP: §4-99-103(9) keys " +
      "registration to representations including a price 'below the regular price', so a " +
      "discount script would pull FieldQuo into registration and bond.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-ME": {
    code: "US-ME",
    name: "Maine",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Maine's only hours rule is device-scoped: 10 M.R.S. §1498(3) bars using 'an " +
      "AUTOMATED TELEPHONE CALLING DEVICE' outside weekdays 09:00-17:00, and §1498(1)(A) " +
      "defines that as equipment that 'selects, dials or calls telephone numbers and " +
      "plays recorded messages'. The live-agent statute, §1499-B, has no hours provision " +
      "at all and is scoped to a 'residential telephone subscriber' buying 'consumer " +
      "goods or services'. §1498(7)'s registration requirement is REPEALED. The whole of " +
      "ch. 225 was read at mainelegislature.org.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-MT": {
    code: "US-MT",
    name: "Montana",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "MCA 30-14-1412(1)(d) bars telemarketing 'TO A PERSON'S RESIDENCE at any time other " +
      "than between 8 a.m. and 9 p.m. local time at the called person's location'. The " +
      "residence limb is what frees this call — note that MCA 30-14-1405(3)'s " +
      "business-to-business exemption is titled 'Exemptions from registration and " +
      "bonding' and does NOT reach the conduct rules, so do not lean on it for the hours. " +
      "It does mean no registration and no $50,000 bond. Read at mca.legmt.gov. " +
      "30-14-1412(1)(b)-(c) are not residence-limited: an internal do-not-call list is " +
      "still required.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-NE": {
    code: "US-NE",
    name: "Nebraska",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Neb. Rev. Stat. 86-248(1) is doubly limited and this call fails both limbs: 'A " +
      "person shall not make a telephone solicitation USING AN AUTOMATIC " +
      "DIALING-ANNOUNCING DEVICE to a RESIDENTIAL TELEPHONE LINE (a) before 8 a.m. or " +
      "after 9 p.m. at the location of the person called'. The section's own title is " +
      "'Telephone solicitation to residential line; limitations'. 86-250's permit " +
      "requirement is likewise ADAD-only, and the Telemarketing and Prize Promotions Act " +
      "(86-212 to 86-235) carries no time-of-day restriction. Read at " +
      "nebraskalegislature.gov.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-NH": {
    code: "US-NH",
    name: "New Hampshire",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "New Hampshire has no telemarketing calling-hours statute at all. The complete " +
      "text of RSA ch. 359-E — all eleven sections — was read at gc.nh.gov and contains " +
      "no time-of-day provision. Its two subdivisions are scoped to a 'residential " +
      "telephone subscriber' (359-E:1, II) and to a 'customer', 'any natural person who " +
      "is a resident of this state' (359-E:7, II). Registration under 359-E:2 is " +
      "ADAD-only. FLAG: 359-E:8's do-not-call prohibition runs on that natural-person " +
      "'customer' with no residence limit, so a sole proprietor's mobile on the federal " +
      "registry is arguably in scope, with a $5,000 statutory penalty and a private " +
      "action at $1,000 minimum trebled.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-ND": {
    code: "US-ND",
    name: "North Dakota",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "N.D.C.C. §51-28-05 bars a solicitation 'before eight a.m. or after nine p.m. at " +
      "the telephone SUBSCRIBER'S location', and §51-28-01(6) defines 'subscriber' as 'a " +
      "person who has subscribed to a RESIDENTIAL telephone line'. Every operative " +
      "section in ch. 51-28 is keyed to that term; all nine were read. The ND Attorney " +
      "General's own do-not-call page states it plainly: 'The law applies only to " +
      "personal phones, not those used for business purposes.' No registration or bond " +
      "exists in the chapter — a web summary claiming one under '§51-28-02.1' is wrong; " +
      "that section does not exist. Read at codes.findlaw.com and attorneygeneral.nd.gov.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-SD": {
    code: "US-SD",
    name: "South Dakota",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Two hours provisions, neither reaching this call. SDCL 37-30A-3(2) is scoped to " +
      "'unsolicited consumer telephone communications to any RESIDENCE' for 'consumer " +
      "goods or services', defined at 37-30A-1(2) as 'not for resale or for use or " +
      "consumption in a trade or business'. SDCL 37-30-28's weekday 09:00-21:00 window " +
      "has an AUTODIALER predicate (37-30-23). Two express exemptions besides: SDCL " +
      "37-30-24(4) excludes 'Business-to-business contacts', and 37-30A-8(2) exempts a " +
      "transaction 'In which the business establishment making the solicitation is " +
      "establishing a business-to-business relationship'. Read via the legislature's own " +
      "JSON API at sdlegislature.gov. Adding an autodialer flips all of this.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-WV": {
    code: "US-WV",
    name: "West Virginia",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Two independent grounds. W. Va. Code §46A-6F-601(a)(4) bars telemarketing 'TO A " +
      "PERSON'S RESIDENCE at any time other than between eight a.m. and nine p.m. local " +
      "time … at the called person's location'. And §46A-6F-206, titled 'Inapplicability " +
      "of article to business-to-business sale', says 'The provisions of this article do " +
      "not apply to a business-to-business sale' — which reaches the entire Telemarketing " +
      "Act including the $100,000/$500,000 bond in §46A-6F-302. Read at " +
      "code.wvlegislature.gov and cross-checked against the Tax Department's compiled " +
      "act. 'Business-to-business sale' is undefined; the 'consumer goods or services' " +
      "limb in §46A-6F-104 independently excludes this call for a sole proprietor too.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-WI": {
    code: "US-WI",
    name: "Wisconsin",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "No hours provision exists in Wis. Stat. §100.52 or ATCP 127 subch. V. The only " +
      "window, ATCP 127.16(3), binds a call 'to a CONSUMER', and ATCP 127.01(2) says " +
      "\"'Consumer' does not include an individual who purchases consumer goods or " +
      "services in a business capacity\" — a contractor buying FieldQuo is buying in a " +
      "business capacity. Read at docs.legis.wisconsin.gov, current through 2025 Act 247.",
    registration: {
      required: true,
      done: false,
      what:
        "CONDITIONAL, and the condition is likely met. ATCP 127.81(1) requires " +
        "registration ($700 first year, $500 after) to solicit a 'covered telephone " +
        "customer', defined at ATCP 127.80(4) as 'an individual in this state who receives " +
        "basic local exchange service OR COMMERCIAL MOBILE SERVICE' — with no business " +
        "carve-out. A sole proprietor reached on his own cell is one. Company landlines " +
        "are not. Worse, Wis. Stat. §100.52(4)(b)1 forbids requiring an employee to " +
        "solicit 'a person in this state' unless registered, which is broader still. " +
        "Escape: ATCP 127.80(10)(e) excludes a call 'to a number listed in the current " +
        "local business telephone directory' — a per-number fact, not a status.",
    },
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-WY": {
    code: "US-WY",
    name: "Wyoming",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Wyo. Stat. §40-12-302(d) bars an unsolicited telephonic sales call 'to a CONSUMER " +
      "before the hour of 8 a.m. or after 8 p.m. local time at the consumer's location' " +
      "— note 8 p.m., an hour earlier than most states. §40-12-301(a)(ii)-(iii) route " +
      "'consumer' through 'consumer goods or services', 'marketed and intended to be used " +
      "for personal, family or household purposes', which business software is not. " +
      "§40-12-305's notice filing is keyed to the same term. Read in the Wyoming " +
      "Legislature's official Title 40 PDF.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-DE": {
    code: "US-DE",
    name: "Delaware",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "The Delaware Telemarketing Fraud Act (6 Del. C. ch. 25A) has no hours provision — " +
      "all nine sections were read. Delaware's only time-of-day solicitation rule, " +
      "6 Del. C. §4406(a), governs door-to-door sales and §4406(c) expressly excludes a " +
      "sale solicited 'Via telephone, mail, e-mail, or Internet'. And §2505A(3) is the " +
      "broadest B2B exemption found in any state: 'This chapter shall not apply to … " +
      "the use of telephone equipment in connection with any sale of goods or services by " +
      "a business supplier to a business or between businesses' — which reaches the " +
      "§2503A registration and its $50,000 bond. Read at delcode.delaware.gov.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-AK": {
    code: "US-AK",
    name: "Alaska",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Alaska has no telemarketing calling-hours provision at all: AS ch. 45.63 " +
      "(§§.010-.100) and AS 45.50.475 were read in full and no time-of-day term exists in " +
      "any of them, including §45.63.045, the 'Prohibitions' section where one would " +
      "live. AS 45.50.475(g)(4)(B)(iv) also excludes 'business-to-business calls' from " +
      "'telephone solicitation' — but from the do-not-call prohibitions only. Read at " +
      "ak.elaws.us and codes.findlaw.com.",
    registration: {
      required: true,
      done: false,
      what:
        "AS 45.63.010(a): a person may not sell by telephone on substantially the same " +
        "terms to two or more persons 'unless the telephone seller is registered with the " +
        "Department of Law AT LEAST 30 DAYS BEFORE the solicitation campaign', with a " +
        "notice of intent PER CAMPAIGN, irrevocable consent to service of process, and a " +
        "fee. None of §45.63.080's nineteen exemptions is a B2B carve-out — they are " +
        "subject-matter based. This is Alaska's real exposure, not the clock.",
    },
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-GA": {
    code: "US-GA",
    name: "Georgia",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Georgia has no time-of-day rule for a LIVE call. O.C.G.A. §46-5-27(c), the " +
      "no-call prohibition, is scoped 'to the telephone line of any RESIDENTIAL, MOBILE, " +
      "OR WIRELESS SUBSCRIBER in this state who has given notice to the commission', and " +
      "PSC rule 515-14-1-.03(a) matches it; neither carries an hours term, and neither " +
      "does the FBPA (§§10-1-390 to 10-1-408). THE TRAP that produces 'Georgia = 8-9' in " +
      "every vendor cheat sheet: O.C.G.A. §46-5-23 does impose 08:00-21:00, but only on " +
      "ADAD equipment — 'any device or system of devices … for the purpose of " +
      "automatically selecting or dialing telephone numbers and disseminating prerecorded " +
      "messages' — and it also requires a PSC permit for that equipment. Read at " +
      "codes.findlaw.com, rules.sos.ga.gov and the Georgia AG's own FBPA compilation.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-IN": {
    code: "US-IN",
    name: "Indiana",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "IC 24-4.7 has no calling-hours provision — every section of IC 24-4.7-4, the " +
      "operative prohibitions chapter, was read and none mentions a time of day. It could " +
      "not reach this call anyway: IC 24-4.7-2-2 defines 'consumer' as 'a RESIDENTIAL " +
      "TELEPHONE SUBSCRIBER' who is a prospective purchaser of consumer goods or " +
      "services. Indiana runs its own quarterly no-call list (IC 24-4.7-4-1) and the AG " +
      "states business numbers are not eligible for it. Read at codes.findlaw.com and the " +
      "Indiana AG's own compilation — iga.in.gov serves a JavaScript shell. NOTE: IC " +
      "24-5-12's registration regime is a felony offence but attaches only to a 'seller' " +
      "as narrowly defined by IC 24-5-12-8's six circumstances — false prize, " +
      "misrepresented identity, office supplies below usual price, and the like — which a " +
      "truthful pitch does not meet. That reading is the shakiest item in this row and " +
      "wants Indiana counsel before it is leaned on.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-KS": {
    code: "US-KS",
    name: "Kansas",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "The Kansas No-Call Act contains no hours provision at all — the complete text of " +
      "K.S.A. 50-670 was read at ksrevisor.gov, subsections (a) through (h), and no " +
      "time-of-day restriction appears. Its gating definition, §50-670(a)(1), reaches a " +
      "call 'to the RESIDENCE OR MOBILE TELEPHONE NUMBER of a consumer'. Kansas also " +
      "carries an unusually on-point defence at §50-670a(f) for a call where 'the consumer " +
      "affirmatively listed or held out to the public such consumer's residential or " +
      "mobile telephone number as a BUSINESS number' and 'the purpose of the call was " +
      "directly related to the consumer's business' — which describes this call — though " +
      "it is a defence to §50-670a only. K.S.A. 50-673(b) separately exempts a " +
      "solicitation 'establishing a business to business relationship' from the written- " +
      "confirmation act. No registration or bond found.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-HI": {
    code: "US-HI",
    name: "Hawaii",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "HRS §481P-3(8) bars an outbound call 'to a CONSUMER'S RESIDENCE at any time other " +
      "than between 8:00 a.m. and 9:00 p.m. local time at the location of the consumer " +
      "called'. A business line is not a residence. Note that ch. 481P otherwise DOES " +
      "reach B2B — 'consumer' is 'a person who is, or may be, required to pay for goods or " +
      "services' with no natural-person limb — so its other duties bind: §481P-3(7)'s " +
      "company-specific do-not-call duty and §481P-4's two-year recordkeeping. All eight " +
      "sections of the chapter were enumerated; there is no registration or bond section, " +
      "contrary to one commercial compliance site. Read at codes.findlaw.com and " +
      "law.onecle.com — capitol.hawaii.gov is behind Cloudflare.",
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-ID": {
    code: "US-ID",
    name: "Idaho",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Idaho has no calling-hours provision at all, for anyone. Every section of the " +
      "Idaho Telephone Solicitation Act (Title 48 ch. 10, §§48-1001 to 48-1010) was read " +
      "on the Legislature's own site and none mentions a time of day; §48-1003's nine " +
      "unlawful acts are about intimidation, misrepresentation and caller-ID blocking. " +
      "§48-1003A(4)(a) also exempts from the no-contact list any solicitation 'To a " +
      "telephone subscriber's COMMERCIAL OR BUSINESS TELEPHONE NUMBER'. Read at " +
      "legislature.idaho.gov. Separate duty that DOES bind: §48-603A, imported by " +
      "§48-1003(1)(g), requires revealing the sale purpose, the trade name and the kind " +
      "of goods before any other statement — 'any person', 'prospective buyer', no " +
      "residential limit.",
    registration: {
      required: true,
      done: false,
      what:
        "Idaho Code §48-1004(1)(a) requires a telephone solicitor to 'Register with the " +
        "attorney general at least ten (10) days prior to conducting business in Idaho', " +
        "plus an irrevocable consent appointing the AG as agent for service. 'Conducting " +
        "business' means solicitations to or from Idaho, and 'person' expressly includes " +
        "corporations, so B2B is inside it. There is NO B2B exemption. The only realistic " +
        "escape is §48-1005(a)(ii) — fewer than 60% of last year's sales made through " +
        "telephone solicitation — which is a question about FieldQuo's sales mix, not " +
        "about the law, and §48-1005(2) puts the burden of proving it on FieldQuo.",
    },
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  "US-DC": {
    code: "US-DC",
    name: "District of Columbia",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "D.C. Code §22-3226.08 makes it abusive to 'Engage in telephone solicitation to a " +
      "CONSUMER'S RESIDENCE at any time before 8:00 a.m. and after 9:00 p.m., local time " +
      "at the place of the consumer called'. A published business line is not a residence. " +
      "The subchapter otherwise DOES reach B2B — 'consumer' is 'a person who is or may be " +
      "required to pay for goods or services', and none of §22-3226.05's fourteen " +
      "exemptions is a B2B carve-out — so the registration below binds even though the " +
      "hours do not. Read at code.dccouncil.gov.",
    registration: {
      required: true,
      done: false,
      what:
        "D.C. Code §22-3226.02(a): 'No person shall transact any business as a telephone " +
        "solicitor without first having obtained a certificate of registration from the " +
        "Mayor' — filed at least 60 BUSINESS DAYS before soliciting — and §22-3226.03 " +
        "requires a $50,000 surety bond with the application. Registration is with the " +
        "Mayor (DLCP), not the OAG, whatever secondary pages say. No B2B exemption reaches " +
        "it. The longest lead time of any jurisdiction in this table.",
    },
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },

  // ── Verified, and the answer is a flat PROHIBITION rather than a window ──

  "US-AZ": {
    code: "US-AZ",
    name: "Arizona",
    verified: true,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Arizona has no standalone hours statute; A.R.S. §44-1278(B)(6) imports 47 CFR " +
      "64.1200 and 16 CFR 310.4, both of which are residence-scoped and neither of which " +
      "reaches a business line. But the hours are not the Arizona question — see the " +
      "prohibition below. Arizona's definitions are unusually business-inclusive: " +
      "§44-1271(2) defines 'consumer' as 'a person who is solicited by a seller', and " +
      "§44-1271(9) includes corporations and LLCs, so a small contractor is an Arizona " +
      "'consumer'. Registration (§44-1272) and a $100,000 bond (§44-1274) are excused " +
      "only by §44-1273(A)(6), which requires that 'At least fifty percent of the " +
      "person's dollar volume consists of repeat sales to existing businesses' — a test a " +
      "growth-stage seller doing new-logo cold calls will fail. Read at azleg.gov.",
    registration: null,
    dataAcquisition:
      "A.R.S. §39-121.03: obtaining names and addresses from an Arizona public body " +
      "for solicitation requires a written declaration of that purpose. Misstating it " +
      "carries treble damages. This binds the discovery pipeline, not the dialler.",
    prohibition: {
      code: "az_mobile_ban",
      title: "Arizona bans an unsolicited sales call to a mobile number outright, at any hour.",
      fix:
        "A.R.S. §44-1278(B)(3) makes it unlawful to 'Intentionally make or cause to be " +
        "made any unsolicited telephone sales call to any mobile or telephone paging " +
        "device' — no residential limit, no B2B qualifier, and §44-1273(A) preserves it " +
        "against every exemption in the article ('except for section 44-1278, subsection " +
        "B'). A large share of contractors publish a mobile as their business number and " +
        "nothing in this record says which. This is a REFUSAL rather than a warning " +
        "because it is a ban, not a window: waiting does not fix it. It could be lifted " +
        "for a specific prospect by evidence that the number is a landline, which nothing " +
        "in FieldQuo records today.",
    },
    handEnforced: null,
  },

  // ── Named, known to matter, and not read ────────────────────────────────
  //
  // Listed rather than omitted so a refusal can name the statute that is
  // outstanding. An omitted state produces "nobody has read this state";
  // these produce "this is the specific thing nobody has read".
  "US-VT": {
    code: "US-VT",
    name: "Vermont",
    // Deliberately NOT verified, and this is the distinction the Nevada row
    // exists to protect. No Vermont hours provision was FOUND — 9 V.S.A. ch.
    // 63 and the AG's Consumer Protection Rules CP 100-121 were searched — but
    // "we looked and did not find one" is a weaker claim than "we read the
    // scope words and they exclude this call", and only the second earns a
    // verified row. Vermont also carries a criminal registration duty, which
    // makes the cost of being wrong here higher than a window.
    verified: false,
    window: null,
    maxCallsPer24h: null,
    citation:
      "No Vermont calling-hours provision was found in 9 V.S.A. ch. 63 or the AG's " +
      "Consumer Protection Rules, but that is an absence rather than a scope reading, so " +
      "it is not recorded as verified. What IS verified and matters more: 9 V.S.A. " +
      "§2464a(b)(1) — 'No telemarketer shall make a telephone solicitation to a telephone " +
      "number in Vermont without having first registered' — and §2464a(d) punishes it by " +
      "'imprisoned for not more than 18 months or fined not more than $10,000.00, or " +
      "both', with 'Each telephone call … a separate solicitation'. §2464a(a)(1)'s " +
      "'customer' is not residence-limited. Read at legislature.vermont.gov.",
    registration: {
      required: true,
      done: false,
      what:
        "9 V.S.A. §2464b requires registration with the Vermont Secretary of State before " +
        "any solicitation to a Vermont number, and §2464a(d) makes an unregistered call a " +
        "CRIMINAL offence — up to 18 months and $10,000, per call — plus a private action " +
        "at $500 first violation and $1,000 thereafter (§2464c). The statutory defence for " +
        "a telemarketer of five or fewer employees who 'did not know' of the requirement " +
        "is destroyed by this entry.",
    },
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  },
  "US-IA": unread(
    "US-IA",
    "Iowa",
    "Iowa appears to have NO telephone-solicitation statute at all — ch. 476 and ch. 714 " +
      "were searched, §476.57 (the ADAD section) is repealed, and neither the AG's nor the " +
      "Utilities Commission's rules carry one. But that is a negative proven by absence " +
      "across the chapters where such a rule would live, not by reading a governing act " +
      "end to end, because there is no governing act to read. Two commercial cheat sheets " +
      "claim Iowa imposes a stricter 09:00 start; no statutory basis for that was found, " +
      "and 'we could not find one' is not the same claim as 'we read the scope words'. " +
      "Left refusing on that distinction alone.",
  ),
});

function unread(code, name, citation) {
  return {
    code,
    name,
    verified: false,
    window: null,
    maxCallsPer24h: null,
    citation,
    registration: null,
    dataAcquisition: null,
    prohibition: null,
    handEnforced: null,
  };
}

/**
 * FieldQuo's own manners, applied only where a VERIFIED row imposes no window.
 *
 * Nevada is the case that forces the decision. Its law was read and it imposes
 * nothing, so the legally correct answer is that a rep may dial a Nevada
 * contractor at four in the morning. Shipping that would be defensible in court
 * and indefensible on the phone, and it would be the only surface in this
 * product where "legal" was the whole test.
 *
 * So a verified-but-unrestricted jurisdiction gets this window, and every
 * refusal it produces SAYS it is FieldQuo's rule rather than the state's. That
 * distinction is the honesty: a rep told "Nevada forbids this" would be told
 * something false, and would find out.
 *
 * It is the narrower of the two real windows in this file rather than a new
 * number, because inventing a third set of bounds would mean defending them.
 */
export const FIELDQUO_COURTESY_WINDOW = EIGHT_TO_EIGHT;

// ═══════════════════════════════════════════════════════════════════════════
// Where is this prospect, and what time is it there
// ═══════════════════════════════════════════════════════════════════════════

/** Accents folded, punctuation dropped, uppercased. */
function fold(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    // Escaped rather than written as literal combining marks: the literal form
    // is invisible in a diff and a reviewer cannot tell a correct range from a
    // mangled one. lib/sales/discovery/dedupe.js folds the same way.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const COUNTRY_ALIASES = Object.freeze({
  US: "US",
  USA: "US",
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  CA: "CA",
  CAN: "CA",
  CANADA: "CA",
});

/** Full subdivision names → ISO code. Overture writes codes; humans write names. */
const SUBDIVISION_ALIASES = Object.freeze({
  // Canada, including the French forms a Quebec directory row arrives in.
  ALBERTA: "AB",
  "BRITISH COLUMBIA": "BC",
  "COLOMBIE BRITANNIQUE": "BC",
  MANITOBA: "MB",
  "NEW BRUNSWICK": "NB",
  "NOUVEAU BRUNSWICK": "NB",
  "NEWFOUNDLAND AND LABRADOR": "NL",
  "TERRE NEUVE ET LABRADOR": "NL",
  "NORTHWEST TERRITORIES": "NT",
  "NOVA SCOTIA": "NS",
  "NOUVELLE ECOSSE": "NS",
  NUNAVUT: "NU",
  ONTARIO: "ON",
  "PRINCE EDWARD ISLAND": "PE",
  "ILE DU PRINCE EDOUARD": "PE",
  QUEBEC: "QC",
  SASKATCHEWAN: "SK",
  YUKON: "YT",
  // United States.
  ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA",
  COLORADO: "CO", CONNECTICUT: "CT", DELAWARE: "DE", "DISTRICT OF COLUMBIA": "DC",
  FLORIDA: "FL", GEORGIA: "GA", HAWAII: "HI", IDAHO: "ID", ILLINOIS: "IL",
  INDIANA: "IN", IOWA: "IA", KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA",
  MAINE: "ME", MARYLAND: "MD", MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN",
  MISSISSIPPI: "MS", MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV",
  "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
  "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", OHIO: "OH", OKLAHOMA: "OK",
  OREGON: "OR", PENNSYLVANIA: "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD", TENNESSEE: "TN", TEXAS: "TX", UTAH: "UT", VERMONT: "VT",
  VIRGINIA: "VA", WASHINGTON: "WA", "WEST VIRGINIA": "WV", WISCONSIN: "WI",
  WYOMING: "WY",
  // ── Traditional abbreviations: ONLY the ones actually observed ───────────
  //
  // "Calif" is here because it is in the data — two rows, counted in the
  // 2026-08-19.0 Overture places release over the nine trade categories. Fla,
  // Tex, Mass, Wash and the rest of the AP-style set are NOT here, because a
  // scan of all 945,532 US and Canadian rows in that release found none of
  // them, and a table row that matches nothing is the feature flag for a
  // feature that does not exist (AGENTS.md failure class #8). Add one when a
  // measurement puts it in the data, not when it seems likely.
  CALIF: "CA",
});

/** The ISO country code a source's spelling means, or null. */
export function normaliseCountry(value) {
  return COUNTRY_ALIASES[fold(value)] || null;
}

/**
 * The ISO subdivision code a source's spelling means, or null.
 *
 * Null for anything this table does not recognise, INCLUDING a well-formed
 * two-letter code with no time zone behind it — "US-PR" is a real subdivision
 * and FieldQuo holds neither a zone nor a statute for it, so claiming to have
 * resolved it would be claiming to know something.
 */
export function normaliseSubdivision(value) {
  const p = fold(value);
  if (!p) return null;
  // "US-FL" and "CA-ON" are both spellings a source may use.
  const hyphen = p.match(/^(?:US|CA) ([A-Z]{2})$/);
  const bare = hyphen ? hyphen[1] : p;
  if (/^[A-Z]{2}$/.test(bare) && SUBDIVISION_TIME_ZONES[bare]) return bare;
  return SUBDIVISION_ALIASES[p] || null;
}

/**
 * Subdivision → every IANA zone a DISTRICT-SIZED part of it observes.
 *
 * ══ The rule for what goes in a list, written down because it is a judgement ═
 *
 * A subdivision lists every zone observed by a county-, district- or
 * census-area-sized part of it. Sub-municipal and single-town exceptions are
 * named in a comment and NOT listed, because listing one would cost an hour of
 * lawful calling time across an entire province to be right about one town.
 * Where a prospect actually sits in one of those towns, the evaluation below is
 * at most one hour out in the permissive direction, and that is a stated,
 * bounded error rather than a hidden one.
 *
 * ══ Why a state and not an area code ═══════════════════════════════════════
 *
 * SalesLead.timeZone's schema comment already rejects area codes and gives the
 * reason: an area code is wrong for every ported mobile, and small contractors
 * answer on mobiles they carried from a previous city. A registered business
 * address is where the business is, and it is what the directory source
 * actually publishes with provenance attached (Prospect.sourceRelease). It is
 * also the field the JURISDICTION comes from, and having the clock and the
 * statute derive from the same fact is what stops them ever disagreeing about
 * which state a prospect is in.
 *
 * The approximation that remains is the multi-zone state, and it is handled by
 * refusing to guess rather than by picking a side — see `zoneAgreement`.
 */
export const SUBDIVISION_TIME_ZONES = Object.freeze({
  // ── Canada ──────────────────────────────────────────────────────────────
  // NL: south-eastern Labrador observes Atlantic. Sub-district; not listed.
  NL: ["America/St_Johns"],
  NS: ["America/Halifax"],
  PE: ["America/Halifax"],
  NB: ["America/Moncton"],
  // QC: Blanc-Sablon (one municipality, ~1,000 people) is AST year-round.
  // Sub-district; not listed.
  QC: ["America/Toronto"],
  // ON: Kenora and Rainy River districts are Central. District-sized, listed.
  ON: ["America/Toronto", "America/Winnipeg"],
  MB: ["America/Winnipeg"],
  // SK: Lloydminster observes Alberta time by charter. One town; not listed.
  SK: ["America/Regina"],
  AB: ["America/Edmonton"],
  // BC: the Peace River region keeps MST year-round, the East Kootenay keeps
  // Mountain with DST. Both are regional districts, so both are listed.
  BC: ["America/Vancouver", "America/Dawson_Creek", "America/Edmonton"],
  YT: ["America/Whitehorse"],
  // NT: America/Yellowknife is a deprecated alias of America/Edmonton and some
  // ICU builds no longer carry it, so the canonical name is used.
  NT: ["America/Edmonton"],
  NU: ["America/Iqaluit", "America/Rankin_Inlet", "America/Cambridge_Bay"],

  // ── United States ───────────────────────────────────────────────────────
  AL: ["America/Chicago"],
  // AK: the Aleutians West census area is Hawaii-Aleutian. Census-area sized.
  AK: ["America/Anchorage", "America/Adak"],
  // AZ: the state does not observe DST, the Navajo Nation does. Multi-county.
  AZ: ["America/Phoenix", "America/Denver"],
  AR: ["America/Chicago"],
  CA: ["America/Los_Angeles"],
  CO: ["America/Denver"],
  CT: ["America/New_York"],
  DE: ["America/New_York"],
  DC: ["America/New_York"],
  // FL: the western panhandle counties are Central. Multi-county.
  FL: ["America/New_York", "America/Chicago"],
  GA: ["America/New_York"],
  HI: ["Pacific/Honolulu"],
  // ID: the northern panhandle is Pacific.
  ID: ["America/Boise", "America/Los_Angeles"],
  IL: ["America/Chicago"],
  // IN: the north-west and south-west counties are Central.
  IN: ["America/Indiana/Indianapolis", "America/Chicago"],
  IA: ["America/Chicago"],
  KS: ["America/Chicago", "America/Denver"],
  KY: ["America/New_York", "America/Chicago"],
  LA: ["America/Chicago"],
  ME: ["America/New_York"],
  MD: ["America/New_York"],
  MA: ["America/New_York"],
  // MI: four Upper Peninsula counties bordering Wisconsin are Central.
  MI: ["America/New_York", "America/Menominee"],
  MN: ["America/Chicago"],
  MS: ["America/Chicago"],
  MO: ["America/Chicago"],
  MT: ["America/Denver"],
  NE: ["America/Chicago", "America/Denver"],
  // NV: West Wendover observes Mountain. One town; not listed.
  NV: ["America/Los_Angeles"],
  NH: ["America/New_York"],
  NJ: ["America/New_York"],
  NM: ["America/Denver"],
  NY: ["America/New_York"],
  NC: ["America/New_York"],
  ND: ["America/Chicago", "America/Denver"],
  OH: ["America/New_York"],
  OK: ["America/Chicago"],
  // OR: Malheur County is Mountain.
  OR: ["America/Los_Angeles", "America/Boise"],
  PA: ["America/New_York"],
  RI: ["America/New_York"],
  SC: ["America/New_York"],
  SD: ["America/Chicago", "America/Denver"],
  TN: ["America/New_York", "America/Chicago"],
  // TX: El Paso and Hudspeth counties are Mountain.
  TX: ["America/Chicago", "America/Denver"],
  UT: ["America/Denver"],
  VT: ["America/New_York"],
  VA: ["America/New_York"],
  WA: ["America/Los_Angeles"],
  WV: ["America/New_York"],
  WI: ["America/Chicago"],
  WY: ["America/Denver"],
  // PR: a US subdivision with an unambiguous zone and NO law read. It is here
  // for two reasons, and the second is the load-bearing one.
  //
  // First, it is really in the data: the 2026-08-19.0 Overture extract carries
  // Puerto Rico rows, and without this they resolved to "we do not know which
  // state this business is in" — which was false. We know exactly where they
  // are; what nobody has is the statute.
  //
  // Second, once every state and DC had a jurisdiction row, the
  // `jurisdiction_unread` branch of salesCallReadiness became UNREACHABLE, and
  // an unreachable branch cannot be asserted against. A mutation making that
  // branch return "allowed" passed the whole suite green — proving code
  // correct without proving it reached, which is the exact failure this
  // check's own header was written about. PR makes the branch live again with
  // a real jurisdiction rather than a fixture.
  PR: ["America/Puerto_Rico"],
});

/**
 * Country and subdivision codes from whatever the directory source wrote.
 *
 * Returns `{ country, subdivision }`, either of which may be null. Never
 * guesses one from the other: a bare "OK" with no country is Oklahoma to a
 * human and ambiguous to a program, and inventing the country is how a
 * Canadian prospect gets evaluated against an American statute.
 */
export function locationCodes({ country = null, province = null } = {}) {
  return { country: normaliseCountry(country), subdivision: normaliseSubdivision(province) };
}

/**
 * The jurisdiction row governing this prospect, or null.
 *
 * Canada resolves to one federal row whatever the province is, because the
 * rules are federal. The United States resolves per state, because they are
 * not, and there is no national row to fall back to.
 */
export function jurisdictionFor(prospect = {}) {
  const { country, subdivision } = locationCodes(prospect);
  if (country === "CA") return CALLING_JURISDICTIONS.CA;
  if (country === "US" && subdivision) {
    return CALLING_JURISDICTIONS[`US-${subdivision}`] || null;
  }
  return null;
}

/** Every zone a district-sized part of this prospect's subdivision observes. */
export function zonesFor(prospect = {}) {
  const { subdivision } = locationCodes(prospect);
  const zones = subdivision ? SUBDIVISION_TIME_ZONES[subdivision] : null;
  return zones ? [...zones] : [];
}

// ═══════════════════════════════════════════════════════════════════════════
// The clock
// ═══════════════════════════════════════════════════════════════════════════

/** Minutes from local midnight → "08:00". */
export function hhmm(minute) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

/** A window, as a sentence. Derived from the bounds, never retyped beside them. */
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function describeWindow(window) {
  if (!window) return null;
  const { weekday, weekend } = window;
  const closed = Array.isArray(window.closedWeekdays) ? window.closedWeekdays : [];
  // Derived from the same array `insideIn` evaluates, never retyped beside it —
  // a sentence that says "no Sundays" while the evaluator lets Sunday through
  // is the dead control this file exists to prevent.
  const closedText = closed.length
    ? `, and no calls at all on ${closed.map((d) => `${DAY_NAMES[d]}s`).join(" or ")}`
    : "";
  const same =
    weekday.startMinute === weekend.startMinute && weekday.endMinute === weekend.endMinute;
  if (same) {
    return (
      `${hhmm(weekday.startMinute)}–${hhmm(weekday.endMinute)} every day` +
      `${closedText}, in the prospect's own time zone`
    );
  }
  return (
    `${hhmm(weekday.startMinute)}–${hhmm(weekday.endMinute)} weekdays, ` +
    `${hhmm(weekend.startMinute)}–${hhmm(weekend.endMinute)} weekends` +
    `${closedText}, in the prospect's own time zone`
  );
}

/** Is this instant inside the window, in ONE named zone? */
function insideIn(window, zone, now) {
  const local = localTimeIn(zone, now);
  if (!local) return null;
  // A closed day is closed at every minute of it, so it is tested before the
  // bounds rather than folded into them. Alabama, Mississippi, Pennsylvania
  // and Utah each close Sunday while leaving Saturday open.
  if (Array.isArray(window.closedWeekdays) && window.closedWeekdays.includes(local.weekday)) {
    return false;
  }
  const isWeekend = local.weekday === 0 || local.weekday === 6;
  const bounds = isWeekend ? window.weekend : window.weekday;
  return local.minute >= bounds.startMinute && local.minute < bounds.endMinute;
}

/**
 * The three-valued answer across every zone the subdivision might be in.
 *
 * `true` and `false` only when every candidate agrees. When they disagree the
 * answer is `null` — "we cannot tell", which is a different sentence from "no"
 * and gets a different one on screen.
 *
 * ══ Why not pick the majority zone ═════════════════════════════════════════
 *
 * Because being wrong is not symmetric. Florida spans Eastern and Central; a
 * Pensacola contractor evaluated as Miami is rung at 07:00 local when the
 * screen believes it is 08:00, and Fla. Stat. §501.616(6) carries a private
 * right of action. Picking the majority zone is AGENTS.md failure class #5 with
 * a legal bill attached: absence of a stated time zone is not a statement that
 * they are in the populous half.
 *
 * The cost is an hour at each end of the day in a split subdivision, and it
 * lands as "we cannot confirm", which is honest and fixable, rather than as a
 * confident wrong answer, which is neither.
 */
export function zoneAgreement(window, zones, now) {
  if (!window || !Array.isArray(zones) || zones.length === 0) return null;
  let seen = null;
  for (const zone of zones) {
    const inside = insideIn(window, zone, now);
    if (inside === null) return null; // an unusable zone name poisons the answer
    if (seen === null) seen = inside;
    else if (seen !== inside) return null;
  }
  return seen;
}

/**
 * The next instant every candidate zone agrees is inside the window.
 *
 * Stepped rather than solved. Every bound in this file falls on :00 or :30, so
 * five-minute steps from a five-minute-aligned start land exactly on the
 * boundary; solving it analytically would mean re-deriving DST transitions that
 * Intl already knows. Capped at eight days, which is longer than any window's
 * gap — a null back from here means something is wrong with the zones, not that
 * the wait is long.
 */
export function nextOpening(window, zones, now = new Date()) {
  if (!window || !Array.isArray(zones) || zones.length === 0) return null;
  const STEP = 5 * 60 * 1000;
  let t = Math.ceil(now.getTime() / STEP) * STEP;
  const limit = now.getTime() + 8 * 24 * 60 * 60 * 1000;
  while (t <= limit) {
    const at = new Date(t);
    if (zoneAgreement(window, zones, at) === true) return at;
    t += STEP;
  }
  return null;
}

/** "08:00 on Tue 8 Sep, their time" — in the zone named, spelled for a human. */
export function describeLocal(at, zone) {
  if (!at || !zone) return null;
  try {
    const text = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(at);
    return `${text} (${zone})`;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// The single entry point
// ═══════════════════════════════════════════════════════════════════════════

/**
 * May a rep dial this prospect right now, and what does a human need told?
 *
 * ══ Three outcomes, because there are three states ═════════════════════════
 *
 * `allowed`, `refused` and `unknown` are not two states with a shading. The
 * queue screen already renders `has` / `gap` / `unknown` in three colours for
 * exactly this reason, and the mistake it exists to prevent is the same one:
 * "we looked and it is not permitted" and "nobody has looked" are different
 * claims, and collapsing them tells a rep something nobody knows.
 *
 * Only `allowed` may produce a dial control. `dialHref` below is the structural
 * half of that — the page has no `tel:` string of its own to render.
 *
 * ══ The 24-hour cap, and why it is reported rather than enforced ═══════════
 *
 * Oklahoma and Florida both cap calls to the same business on the same subject
 * at three in 24 hours. Nothing in this repository records that a call was
 * attempted — there is no model, and inventing one is the owner's decision, not
 * this session's. So when `attemptsLast24h` is null the cap goes into
 * `unenforced` and onto the screen in the rep's own words, instead of silently
 * not applying. A rule the software claims to keep and does not is worse than a
 * rule it admits it cannot count.
 *
 * Pass a number and it is enforced properly.
 *
 * ══ A stated time zone beats a derived one ════════════════════════════════
 *
 * `timeZone` is the zone a REP stated after speaking to the business — today
 * that is SalesLead.timeZone, written from the texting screen and already read
 * by lib/sales/salesSmsRules.js. When one exists it replaces the whole derived
 * set, because a person who has had the prospect on the phone outranks a
 * subdivision lookup, and because it is the only thing that resolves a split
 * state such as Florida to a single clock. When there is none the derived set
 * stands and its ambiguity is reported rather than averaged away.
 *
 * @param prospect        `{ country, province }` — the rest is ignored.
 * @param timeZone        an IANA zone somebody actually stated, or null.
 * @param attemptsLast24h calls already placed to this prospect in the last 24
 *                        hours, or null for "nothing counts them yet".
 */
export function salesCallReadiness({
  prospect = {},
  timeZone = null,
  now = new Date(),
  attemptsLast24h = null,
} = {}) {
  const blockers = [];
  const warnings = [];
  const unenforced = [];

  const { country, subdivision } = locationCodes(prospect);
  const jurisdiction = jurisdictionFor(prospect);
  // A stated zone is only honoured if Intl can actually read it — a typo would
  // otherwise silently replace a working derived set with an unusable one.
  const stated =
    typeof timeZone === "string" && timeZone.trim() && localTimeIn(timeZone, now)
      ? timeZone.trim()
      : null;
  const zones = stated ? [stated] : zonesFor(prospect);
  const zoneSource = stated ? "stated" : "derived";

  const base = {
    jurisdiction: jurisdiction
      ? { code: jurisdiction.code, name: jurisdiction.name, verified: jurisdiction.verified }
      : null,
    zones,
    zoneSource,
    windowText: null,
    citation: jurisdiction?.citation || null,
    opensAt: null,
    opensAtText: null,
    blockers,
    warnings,
    unenforced,
  };

  // ── Do we know where they are at all? ───────────────────────────────────
  if (!country || !subdivision) {
    blockers.push({
      code: "location_unknown",
      title: "We do not know which state or province this business is in.",
      fix:
        "Calling hours are set by the place the phone rings, and there is no federal " +
        "rule underneath to fall back on — 16 CFR 310.6(b)(7) exempts business calls " +
        "from the whole Telemarketing Sales Rule. Until this record carries a country " +
        "and a state, nobody can say whether ringing them is allowed.",
    });
    return { ...base, decision: CALL_UNKNOWN };
  }

  // ── Has anybody read this jurisdiction's law? ───────────────────────────
  if (!jurisdiction) {
    blockers.push({
      code: "jurisdiction_unread",
      title: `Nobody has read ${subdivision}'s telephone solicitation law.`,
      fix:
        "Federal law does not fill this gap: business-to-business calls are exempt " +
        "from the Telemarketing Sales Rule entirely, so the state's own rule is the " +
        "only one there is. This is the owner's item — a state-law read for the " +
        "states actually being called. Until it comes back, this cannot be confirmed " +
        "as allowed.",
    });
    return { ...base, decision: CALL_UNKNOWN };
  }

  if (!jurisdiction.verified) {
    blockers.push({
      code: "jurisdiction_unverified",
      title: `${jurisdiction.name}'s calling rules have not been verified.`,
      fix: jurisdiction.citation,
    });
    // A registration flag on an unverified row still gets said out loud — Texas
    // is gated twice over and a rep should see both reasons, not the first one.
    pushRegistration(warnings, jurisdiction);
    pushDataAcquisition(warnings, jurisdiction);
    return { ...base, decision: CALL_UNKNOWN };
  }

  pushRegistration(warnings, jurisdiction);
  pushDataAcquisition(warnings, jurisdiction);

  // ── A flat prohibition, which is not a window and cannot be waited out ──
  //
  // Arizona is the only row that carries one, and it is why "verified" could
  // not simply mean "here are the hours". A.R.S. §44-1278(B)(3) bans an
  // unsolicited sales call to ANY mobile number outright, survives every
  // exemption in the article, and cannot be satisfied by calling later. A
  // warning would have been the wrong shape: warnings sit beside a working
  // button, and this one has to remove it.
  //
  // It is checked before the clock so the refusal says the true reason. A
  // prospect refused at 03:00 for being outside the window, then still refused
  // at 10:00 for a reason nobody mentioned, teaches a rep that the screen is
  // unreliable.
  if (jurisdiction.prohibition) {
    blockers.push(jurisdiction.prohibition);
    return { ...base, decision: CALL_REFUSED };
  }

  // ── Rules this table knows and this software cannot evaluate ────────────
  //
  // Holiday bans, in three states. Said out loud rather than silently not
  // applied — the same choice `maxCallsPer24h` makes when nothing counts.
  if (Array.isArray(jurisdiction.handEnforced)) {
    for (const item of jurisdiction.handEnforced) unenforced.push(item);
  }

  // ── Which window applies, and whose rule is it? ─────────────────────────
  const statutory = Boolean(jurisdiction.window);
  const window = jurisdiction.window || FIELDQUO_COURTESY_WINDOW;
  const windowText = describeWindow(window);
  const whose = statutory
    ? `${jurisdiction.name}'s rule`
    : `FieldQuo's own rule — ${jurisdiction.name} imposes none`;

  if (zones.length === 0) {
    blockers.push({
      code: "time_zone_unknown",
      title: "We cannot work out what time it is where this business is.",
      fix:
        `The window is ${windowText} (${whose}), and it is stated in THEIR local ` +
        `time. We hold no time zone for ${subdivision}, so there is nothing to ` +
        `evaluate — and our own clock is the worst available substitute.`,
    });
    return { ...base, windowText, decision: CALL_UNKNOWN };
  }

  const agreement = zoneAgreement(window, zones, now);
  const opensAt = nextOpening(window, zones, now);
  const opensAtText = opensAt ? describeLocal(opensAt, zones[0]) : null;
  const withClock = { ...base, windowText, opensAt, opensAtText };

  if (agreement === null) {
    // Split subdivision, and the halves disagree about this minute.
    blockers.push({
      code: "time_zone_ambiguous",
      title: `${subdivision} spans more than one time zone, and right now they disagree.`,
      fix:
        `It is inside ${windowText} in part of ${subdivision} and outside it in the ` +
        `rest, and this record does not say which part. Rather than guess the ` +
        `populous half, nothing is confirmed. It is safe to call everywhere in ` +
        `${subdivision} from ${opensAtText || "the next time both halves agree"} — ` +
        `or ask them where they are and set their time zone on their lead, which ` +
        `answers this exactly.`,
    });
    return { ...withClock, decision: CALL_UNKNOWN };
  }

  if (agreement === false) {
    blockers.push({
      code: "outside_window",
      title: `It is outside the calling window where they are (${windowText}).`,
      fix: opensAtText
        ? `${whose}. The window opens at ${opensAtText}. Nothing is queued — you press call.`
        : `${whose}. Wait for the window.`,
    });
    return { ...withClock, decision: CALL_REFUSED };
  }

  // ── The cap ─────────────────────────────────────────────────────────────
  if (jurisdiction.maxCallsPer24h != null) {
    if (typeof attemptsLast24h === "number" && Number.isFinite(attemptsLast24h)) {
      if (attemptsLast24h >= jurisdiction.maxCallsPer24h) {
        blockers.push({
          code: "call_cap_reached",
          title:
            `${jurisdiction.name} allows ${jurisdiction.maxCallsPer24h} calls to the same ` +
            `business on the same subject in 24 hours, and ${attemptsLast24h} have been made.`,
          fix: "Nothing more today. The cap is per called party, not per rep.",
        });
        return { ...withClock, decision: CALL_REFUSED };
      }
    } else {
      unenforced.push({
        code: "call_cap_uncounted",
        title:
          `${jurisdiction.name} allows at most ${jurisdiction.maxCallsPer24h} calls to this ` +
          "business on the same subject in 24 hours.",
        fix:
          "Nothing in FieldQuo records call attempts yet, so this cap is not being " +
          "counted for you — keep track yourself. It is a private right of action in " +
          "both states that impose it.",
      });
    }
  }

  return { ...withClock, decision: CALL_ALLOWED };
}

function pushRegistration(warnings, jurisdiction) {
  const reg = jurisdiction.registration;
  if (!reg || !reg.required || reg.done) return;
  warnings.push({
    code: "registration_outstanding",
    title: `FieldQuo must be registered to make sales calls into ${jurisdiction.name}.`,
    fix: reg.what,
  });
}

function pushDataAcquisition(warnings, jurisdiction) {
  if (!jurisdiction.dataAcquisition) return;
  warnings.push({
    code: "data_acquisition_rule",
    title: `${jurisdiction.name} regulates how this prospect's details may be obtained.`,
    fix: jurisdiction.dataAcquisition,
  });
}

/**
 * The dial target — or null, which is the point.
 *
 * ══ Why the href is built HERE and not in the page ═════════════════════════
 *
 * `app/sales/queue/page.js` used to carry `href={`tel:${current.phoneE164}`}`
 * with no check of any kind. The fix that only ADDS a condition around it is
 * one careless edit from regressing, and a check script asserting "the tel:
 * link is inside the right branch" is a regex arguing about JSX, which this
 * project has had produce a false pass more than once.
 *
 * So the page has no `tel:` string of its own. The only way to get one is
 * through this function, which cannot produce one from a refusal or an unknown.
 * That makes the rule executable — the check calls this with each decision and
 * reads the answer — instead of textual. It is the same move
 * lib/sales/salesSmsRules.js makes when it builds the message body only after
 * every blocker has cleared.
 */
export function dialHref(readiness, phoneE164) {
  if (!readiness || readiness.decision !== CALL_ALLOWED) return null;
  const phone = typeof phoneE164 === "string" ? phoneE164.trim() : "";
  if (!phone) return null;
  return `tel:${phone}`;
}
