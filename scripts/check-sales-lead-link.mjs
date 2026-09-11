// scripts/check-sales-lead-link.mjs
//
//   npm run check:sales-lead-link
//
// "This prospect is that company" — the link between a rep's lead and a
// signed-up company, decided from the email the company registered with.
//
// ══ What went wrong, and why a check is the fix ═══════════════════════════
//
// On 2026-09-11 the owner's lead "truefinish cabinets" (emilio.boves@…) was
// linked to "Easy Roofers Inc." (sierra_…@…). The screen listed every company
// attributed to the rep that no lead claimed, Easy Roofers was the only one,
// and the rep took it. Nothing compared the two emails; the "same email" hint
// the list drew was decoration the write never read. A control that appears
// to work and doesn't — AGENTS.md's first rule — and the fix is a DECISION,
// not a hint: lib/sales/leadLink.js's decideLeadLink(), pure over rows, which
// this file executes against every reason it can return.
//
// ══ Three kinds of assertion, in this order ═══════════════════════════════
//
//   §1–§4  EXECUTE the pure functions: every reason, the email normalised
//          both ways, the anti-gaming rule at equal timestamps, the
//          self-dealing rule, the 30-day unlink window and what status an
//          unlink restores.
//   §5     EXECUTE the db halves against a scripted client: the link writes
//          the lead, the event and (on ok_unclaimed only) the attribution
//          with the session's rep and source "lead_link"; a refused claim
//          rolls the lead back; the unlink clears two columns, writes an
//          event and never touches SalesAttribution.
//   §6–§7  READ the route and the screen, comments stripped: the old
//          companyId body form is gone, POST decides inside $transaction,
//          the catalogue has a sentence for every reason in every language,
//          and the screen resolves the reason rather than printing English.
//
// Judged by exit code. Every assertion goes through ok(); do not read a run
// by grepping for FAIL.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LEAD_LINK_REASONS,
  LEAD_LINK_REASON_KEYS,
  UNLINK_REFUSALS,
  UNLINK_WINDOW_MS,
  decideLeadLink,
  decideUnlink,
  linkLeadWithin,
  normaliseEmail,
  pickSignup,
  statusAfterUnlink,
  unlinkLeadWithin,
} from "@/lib/sales/leadLink";
import { ATTRIBUTION_SOURCES } from "@/lib/sales/attribution";
import { REP_OUTREACH_WRITES } from "@/lib/sales/outreachGate";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (title) => console.log(`\n${title}`);

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}
const read = (rel) => stripComments(readFileSync(join(ROOT, rel), "utf8"));

/** The body of one named function, by brace matching — same as check-sales-outreach.mjs. */
function functionBody(src, name) {
  const start = src.search(new RegExp(`(export\\s+)?(async\\s+)?function\\s+${name}\\s*\\(`));
  if (start === -1) return null;
  const paren = src.indexOf("(", start);
  let parens = 0;
  let afterParams = -1;
  for (let i = paren; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) {
        afterParams = i;
        break;
      }
    }
  }
  if (afterParams === -1) return null;
  const open = src.indexOf("{", afterParams);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const T0 = new Date("2026-09-10T00:48:59.733Z"); // the owner's lead
const T1 = new Date("2026-09-10T17:06:31.726Z"); // Easy Roofers signed up
const REP = { id: "rep_daniel", email: "emilio.daniel.boves@gmail.com", active: true, endedAt: null };
const OTHER_REP = { id: "rep_other", email: "other@fieldquo.com", active: true, endedAt: null };
const LEAD = { id: "lead_1", createdAt: T0, convertedCompanyId: null, status: "demoed" };

function company(over = {}) {
  return {
    id: "co_1",
    name: "Truefinish Cabinets",
    email: "info@truefinish.example",
    ownerEmails: ["emilio.boves@gmail.com"],
    createdAt: T1,
    isDemo: false,
    referredByCode: null,
    attribution: null,
    repIsMember: false,
    linkedLeadId: null,
    ...over,
  };
}

const decide = (email, over = {}, extra = {}) =>
  decideLeadLink({ email, lead: LEAD, rep: REP, companies: [company(over)], ...extra });

// ═══════════════════════════════════════════════════════════════════════════
section("1. Every reason, produced by execution");

{
  const seen = new Map();
  const put = (label, v) => seen.set(v.reason, label);

  put("no company", decideLeadLink({ email: "nobody@x.example", lead: LEAD, rep: REP, companies: [] }));
  put("wrong email", decide("someone@else.example"));
  put("lead already linked", decideLeadLink({ email: "info@truefinish.example", lead: { ...LEAD, convertedCompanyId: "co_9" }, rep: REP, companies: [company()] }));
  put("demo tenant", decide("info@truefinish.example", { isDemo: true }));
  put("held by another lead", decide("info@truefinish.example", { linkedLeadId: "lead_other" }));
  put("rep is a member", decide("info@truefinish.example", { repIsMember: true }));
  put("rep's own email", decide("emilio.boves@gmail.com", { email: REP.email }));
  put("colleague's company", decide("info@truefinish.example", { attribution: { salesRepId: OTHER_REP.id } }));
  put("signed up before the lead", decide("info@truefinish.example", { createdAt: new Date(T0.getTime() - 1) }));
  put("already mine", decide("info@truefinish.example", { attribution: { salesRepId: REP.id } }));
  put("referral code", decide("info@truefinish.example", { referredByCode: "FRIEND10" }));
  put("unclaimed", decide("info@truefinish.example"));

  for (const reason of LEAD_LINK_REASONS) {
    ok(`reason "${reason}" is reachable (${seen.get(reason) || "—"})`, seen.has(reason));
  }
  ok("and nothing produced a reason outside the list", [...seen.keys()].every((r) => LEAD_LINK_REASONS.includes(r)), [...seen.keys()]);
  ok("every reason has a catalogue key", [...LEAD_LINK_REASONS, ...UNLINK_REFUSALS].every((r) => typeof LEAD_LINK_REASON_KEYS[r] === "string"));
}

{
  // The wrong link, replayed: the owner's lead against Easy Roofers.
  const easy = company({ id: "co_easy", name: "Easy Roofers Inc.", email: "sierra_redox0p@icloud.com", ownerEmails: ["sierra_redox0p@icloud.com"], attribution: { salesRepId: REP.id } });
  const v = decideLeadLink({ email: "emilio.boves@gmail.com", lead: LEAD, rep: REP, companies: [easy] });
  ok("the 2026-09-11 wrong link is refused: emilio.boves@ does not name Easy Roofers", v.reason === "not_found" && !v.eligible, v);
  const byRoofersEmail = decideLeadLink({ email: "sierra_redox0p@icloud.com", lead: LEAD, rep: REP, companies: [easy] });
  ok("…and typing Easy Roofers' own email against the cabinet lead is ok_already_yours, which the rep would have to assert deliberately", byRoofersEmail.reason === "ok_already_yours");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Eligibility, and what is returned to whom");

{
  const yes = decide("info@truefinish.example");
  ok("ok_unclaimed is eligible and writes both", yes.eligible && yes.writes.link && yes.writes.attribution);
  ok("ok_unclaimed returns the company by name", yes.company?.name === "Truefinish Cabinets" && yes.company?.id === "co_1");
  const mine = decide("info@truefinish.example", { attribution: { salesRepId: REP.id } });
  ok("ok_already_yours links but writes no attribution", mine.eligible && mine.writes.link && !mine.writes.attribution);
  ok("ok_already_yours also returns the name", mine.company?.name === "Truefinish Cabinets");

  for (const [label, v] of [
    ["another rep's", decide("info@truefinish.example", { attribution: { salesRepId: OTHER_REP.id } })],
    ["a referred", decide("info@truefinish.example", { referredByCode: "X" })],
    ["a self-dealt", decide("info@truefinish.example", { repIsMember: true })],
    ["a demo", decide("info@truefinish.example", { isDemo: true })],
    ["an earlier-signup", decide("info@truefinish.example", { createdAt: new Date(T0.getTime() - 1) })],
    ["a held", decide("info@truefinish.example", { linkedLeadId: "lead_x" })],
  ]) {
    ok(`${label} company is found but not eligible`, v.found && !v.eligible, v);
    ok(`…and its name is NOT returned`, v.company === null, v.company);
    ok(`…and nothing is written`, !v.writes.link && !v.writes.attribution);
  }
  ok("not_found is neither found nor eligible", !decide("x@y.example").found && !decide("x@y.example").eligible);
  ok("an already-linked lead is refused before any company is looked at", decideLeadLink({ email: "info@truefinish.example", lead: { ...LEAD, convertedCompanyId: "co_9" }, rep: REP, companies: [company()] }).company === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The email: exact, case-insensitive, trimmed, both addresses");

{
  ok("normaliseEmail trims and lower-cases", normaliseEmail("  Info@TrueFinish.Example \n") === "info@truefinish.example");
  ok("normaliseEmail of a non-string is empty", normaliseEmail(null) === "" && normaliseEmail(42) === "" && normaliseEmail(undefined) === "");
  ok("the business email matches upper-cased and padded", decide("  INFO@TRUEFINISH.EXAMPLE  ").reason === "ok_unclaimed");
  ok("the owner's login email matches", decide("Emilio.Boves@gmail.com").reason === "ok_unclaimed");
  ok("an employee's email does not (only owner-role members count)", decide("crew@truefinish.example", { ownerEmails: ["emilio.boves@gmail.com"] }).reason === "not_found");
  ok("a prefix does not match", decide("info@truefinish").reason === "not_found");
  ok("a superstring does not match", decide("info@truefinish.example.com").reason === "not_found");
  ok("an empty email is not_found, not a crash", decide("").reason === "not_found" && decide("   ").reason === "not_found");
  ok("a non-string email is not_found", decideLeadLink({ email: { $ne: "" }, lead: LEAD, rep: REP, companies: [company()] }).reason === "not_found");
  // The loader queried by email; the decision re-matches anyway, so a loader
  // widened to LIKE tomorrow still cannot produce a link on a near-miss.
  ok("a company handed in that does NOT carry the email is ignored", decideLeadLink({ email: "info@truefinish.example", lead: LEAD, rep: REP, companies: [company({ email: "other@x.example", ownerEmails: [] })] }).reason === "not_found");
  ok("a company with no ownerEmails array still matches on its business email", decideLeadLink({ email: "info@truefinish.example", lead: LEAD, rep: REP, companies: [{ ...company(), ownerEmails: undefined }] }).reason === "ok_unclaimed");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The anti-gaming rule, self-dealing, and several companies on one email");

{
  ok("a company created one ms AFTER the lead is claimable", decide("info@truefinish.example", { createdAt: new Date(T0.getTime() + 1) }).reason === "ok_unclaimed");
  ok("a company created one ms BEFORE the lead is not", decide("info@truefinish.example", { createdAt: new Date(T0.getTime() - 1) }).reason === "signed_up_before_lead");
  ok("EQUAL timestamps refuse", decide("info@truefinish.example", { createdAt: new Date(T0.getTime()) }).reason === "signed_up_before_lead");
  ok("a lead with no createdAt cannot claim anything", decideLeadLink({ email: "info@truefinish.example", lead: { ...LEAD, createdAt: null }, rep: REP, companies: [company()] }).reason === "signed_up_before_lead");
  ok("a company with no createdAt cannot be claimed", decide("info@truefinish.example", { createdAt: undefined }).reason === "signed_up_before_lead");
  ok("ISO strings work the same as Dates", decideLeadLink({ email: "info@truefinish.example", lead: { ...LEAD, createdAt: T0.toISOString() }, rep: REP, companies: [company({ createdAt: T1.toISOString() })] }).reason === "ok_unclaimed");
  // The predate rule applies to ok_already_yours as well: a rep must not be
  // able to write a lead today and "convert" it against last month's signup
  // to pad their pipeline, even when no money moves.
  ok("the predate rule also gates ok_already_yours", decide("info@truefinish.example", { attribution: { salesRepId: REP.id }, createdAt: new Date(T0.getTime() - 1) }).reason === "signed_up_before_lead");

  ok("self-deal by membership refuses even a company already attributed to the rep", decide("info@truefinish.example", { repIsMember: true, attribution: { salesRepId: REP.id } }).reason === "self_deal");
  ok("self-deal by email is case-insensitive", decide("emilio.boves@gmail.com", { email: "EMILIO.DANIEL.BOVES@GMAIL.COM" }).reason === "self_deal");
  ok("self-deal outranks another rep's attribution (refused for the rep's own reason)", decide("info@truefinish.example", { repIsMember: true, attribution: { salesRepId: OTHER_REP.id } }).reason === "self_deal");
  ok("a referral code on a company already attributed to the rep does not block the bookkeeping link", decide("info@truefinish.example", { attribution: { salesRepId: REP.id }, referredByCode: "X" }).reason === "ok_already_yours");
  ok("a blank referral code is not a referral", decide("info@truefinish.example", { referredByCode: "   " }).reason === "ok_unclaimed");

  // One address, three companies: two before the lead, one after.
  const before1 = company({ id: "co_a", name: "Sunset Inc", createdAt: new Date("2026-07-27T13:11:54Z") });
  const before2 = company({ id: "co_b", name: "Teacup Poodle", createdAt: new Date("2026-07-30T02:17:56Z") });
  const after1 = company({ id: "co_c", name: "First after", createdAt: new Date(T0.getTime() + 1000) });
  const after2 = company({ id: "co_d", name: "Second after", createdAt: new Date(T0.getTime() + 2000) });
  const picked = pickSignup(LEAD, [after2, before2, after1, before1]);
  ok("pickSignup chooses the FIRST signup after the lead", picked.company?.id === "co_c" && picked.predates === true, picked.company?.id);
  const none = pickSignup(LEAD, [before2, before1]);
  ok("with no signup after the lead it reports the newest, flagged", none.company?.id === "co_b" && none.predates === false);
  ok("pickSignup of nothing is null", pickSignup(LEAD, []).company === null && pickSignup(LEAD, null).company === null);
  ok("the owner's own address (two July companies, lead in September) is signed_up_before_lead", decideLeadLink({ email: "info@truefinish.example", lead: LEAD, rep: REP, companies: [before1, before2] }).reason === "signed_up_before_lead");
  ok("…and with a later signup present, that one is linked", decideLeadLink({ email: "info@truefinish.example", lead: LEAD, rep: REP, companies: [before1, after1, before2] }).company?.id === "co_c");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Unlink: the 30-day window, and the status that comes back");

{
  const day = 24 * 60 * 60 * 1000;
  ok("UNLINK_WINDOW_MS is thirty days", UNLINK_WINDOW_MS === 30 * day);
  const linkedAt = new Date("2026-09-11T14:20:39.627Z");
  const lead = { id: "l", convertedCompanyId: "co_easy", convertedAt: linkedAt, status: "signed" };
  ok("inside the window is allowed", decideUnlink({ lead, now: new Date(linkedAt.getTime() + 29 * day) }).allowed === true);
  ok("the same instant is allowed", decideUnlink({ lead, now: linkedAt }).allowed === true);
  ok("exactly thirty days is allowed (inclusive)", decideUnlink({ lead, now: new Date(linkedAt.getTime() + 30 * day) }).allowed === true);
  ok("thirty days and one ms is refused as window_expired", decideUnlink({ lead, now: new Date(linkedAt.getTime() + 30 * day + 1) }).reason === "window_expired");
  ok("a link dated in the future is refused, not treated as fresh", decideUnlink({ lead, now: new Date(linkedAt.getTime() - 1) }).reason === "window_expired");
  ok("no convertedAt refuses as no_link_date (absence is not a statement)", decideUnlink({ lead: { ...lead, convertedAt: null } }).reason === "no_link_date");
  ok("an unlinked lead refuses as not_linked", decideUnlink({ lead: { ...lead, convertedCompanyId: null } }).reason === "not_linked");
  ok("every unlink refusal is in UNLINK_REFUSALS", ["window_expired", "no_link_date", "not_linked"].every((r) => UNLINK_REFUSALS.includes(r)));

  ok("the pre-link status is restored when recorded", statusAfterUnlink("demoed") === "demoed");
  ok("a recorded 'signed' is not restored (it is what the link wrote)", statusAfterUnlink("signed") === "contacted");
  ok("nothing recorded falls back to contacted", statusAfterUnlink(null) === "contacted" && statusAfterUnlink(undefined) === "contacted" && statusAfterUnlink("") === "contacted");
  ok("a status the rep already moved off 'signed' is KEPT, over the recorded one", statusAfterUnlink("contacted", "demoed") === "demoed");
  ok("…and over the fallback (the 2026-09-11 row read 'demoed' while linked)", statusAfterUnlink(null, "demoed") === "demoed");
  ok("a current 'signed' defers to the record", statusAfterUnlink("demoed", "signed") === "demoed");
  ok("a recorded 'new' is restored as recorded (the history, not a guess)", statusAfterUnlink("new") === "new");
  ok("the FALLBACK is never 'new'", !["new"].includes(statusAfterUnlink(null)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The db halves, executed against a scripted client");

/**
 * Just enough Prisma to run linkLeadWithin, unlinkLeadWithin and — through
 * them — captureAttributionWithin's loadContext. Every method answers from
 * `store`, so what was written is inspectable, and the @unique on
 * SalesAttribution.companyId is modelled because the retry path depends on it.
 */
function makeTx(seed = {}) {
  const store = {
    company: seed.company || [],
    salesRep: seed.salesRep || [REP, OTHER_REP],
    member: seed.member || [],
    user: seed.user || [],
    salesLead: seed.salesLead || [],
    salesAttribution: seed.salesAttribution || [],
    salesAttributionTouch: [],
    salesLeadLinkEvent: seed.salesLeadLinkEvent || [],
  };
  const ci = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();
  let seq = 0;
  const nextId = (p) => `${p}_${++seq}`;
  const membersOf = (c) => store.member.filter((m) => m.companyId === c.id).map((m) => ({ role: m.role, user: store.user.find((u) => u.id === m.userId) || null }));
  const tx = {
    company: {
      findMany: async ({ where }) => {
        const wanted = where.OR[0].email.equals;
        return store.company
          .filter((c) => ci(c.email, wanted) || membersOf(c).some((m) => m.role === "owner" && ci(m.user?.email, wanted)))
          .map((c) => ({
            ...c,
            salesAttribution: store.salesAttribution.find((a) => a.companyId === c.id) || null,
            members: membersOf(c).filter((m) => m.role === "owner" || ci(m.user?.email, REP.email)),
          }));
      },
      findUnique: async ({ where }) => {
        const c = store.company.find((x) => x.id === where.id);
        return c ? { ...c, members: membersOf(c).filter((m) => m.role === "owner") } : null;
      },
    },
    salesRep: { findUnique: async ({ where }) => store.salesRep.find((r) => r.id === where.id) || null, findFirst: async () => null },
    member: {
      findFirst: async ({ where }) => {
        const wanted = where.user?.email?.equals;
        return store.member.find((m) => m.companyId === where.companyId && ci(store.user.find((u) => u.id === m.userId)?.email, wanted)) || null;
      },
    },
    salesLead: {
      findMany: async ({ where }) => store.salesLead.filter((l) => where.convertedCompanyId.in.includes(l.convertedCompanyId)),
      updateMany: async ({ where, data }) => {
        const rows = store.salesLead.filter((l) => l.id === where.id && l.salesRepId === where.salesRepId && l.convertedCompanyId === where.convertedCompanyId);
        for (const r of rows) Object.assign(r, data);
        return { count: rows.length };
      },
    },
    salesAttribution: {
      findUnique: async ({ where }) => store.salesAttribution.find((a) => a.companyId === where.companyId) || null,
      create: async ({ data }) => {
        if (store.salesAttribution.some((a) => a.companyId === data.companyId)) {
          const err = new Error("Unique constraint failed on SalesAttribution.companyId");
          err.code = "P2002";
          throw err;
        }
        const row = { id: nextId("attr"), capturedAt: new Date(), ...data };
        store.salesAttribution.push(row);
        return row;
      },
    },
    salesAttributionTouch: { create: async ({ data }) => { const row = { id: nextId("touch"), ...data }; store.salesAttributionTouch.push(row); return row; } },
    salesLeadLinkEvent: {
      create: async ({ data }) => { const row = { id: nextId("ev"), occurredAt: new Date(), ...data }; store.salesLeadLinkEvent.push(row); return row; },
      findFirst: async ({ where }) => [...store.salesLeadLinkEvent].reverse().find((e) => e.leadId === where.leadId && e.action === where.action && e.companyId === where.companyId) || null,
    },
  };
  return { tx, store };
}

function seed(over = {}) {
  return {
    company: [{ id: "co_1", name: "Truefinish Cabinets", email: "info@truefinish.example", createdAt: T1, isDemo: false, referredByCode: null }],
    user: [{ id: "u_owner", email: "emilio.boves@gmail.com" }],
    member: [{ id: "m_1", companyId: "co_1", userId: "u_owner", role: "owner" }],
    salesLead: [{ id: "lead_1", salesRepId: REP.id, createdAt: T0, convertedCompanyId: null, convertedAt: null, status: "demoed" }],
    ...over,
  };
}

{
  const { tx, store } = makeTx(seed());
  const lead = store.salesLead[0];
  const r = await linkLeadWithin(tx, { email: "Emilio.Boves@gmail.com", lead, rep: REP });
  ok("executed: an unclaimed company is linked", r.reason === "ok_unclaimed" && r.linked?.companyId === "co_1", r);
  ok("executed: the lead now points at the company, dated, signed", lead.convertedCompanyId === "co_1" && lead.convertedAt instanceof Date && lead.status === "signed");
  ok("executed: ONE attribution row, for the session's rep, source lead_link", store.salesAttribution.length === 1 && store.salesAttribution[0].salesRepId === REP.id && store.salesAttribution[0].source === "lead_link", store.salesAttribution);
  ok("executed: a 'linked' event carrying the pre-link status", store.salesLeadLinkEvent.length === 1 && store.salesLeadLinkEvent[0].action === "linked" && store.salesLeadLinkEvent[0].statusBefore === "demoed" && store.salesLeadLinkEvent[0].reason === "ok_unclaimed");
  ok("executed: no touch was filed", store.salesAttributionTouch.length === 0);

  const again = await linkLeadWithin(tx, { email: "info@truefinish.example", lead: { ...lead }, rep: REP });
  ok("executed: linking the same lead again is refused without writing", again.reason === "lead_already_linked" && again.linked === null && store.salesLeadLinkEvent.length === 1);
}

{
  // Already attributed to this rep: link, no second attribution.
  const { tx, store } = makeTx(seed({ salesAttribution: [{ id: "a0", companyId: "co_1", salesRepId: REP.id, source: "link" }] }));
  const r = await linkLeadWithin(tx, { email: "info@truefinish.example", lead: store.salesLead[0], rep: REP });
  ok("executed: ok_already_yours links and leaves the attribution table alone", r.reason === "ok_already_yours" && r.linked && store.salesAttribution.length === 1 && store.salesAttribution[0].source === "link");
}

{
  // A colleague's company: refused, nothing written, no touch — the refusal
  // is the rep's answer, not evidence for a split policy.
  const { tx, store } = makeTx(seed({ salesAttribution: [{ id: "a0", companyId: "co_1", salesRepId: OTHER_REP.id, source: "link" }] }));
  const r = await linkLeadWithin(tx, { email: "info@truefinish.example", lead: store.salesLead[0], rep: REP });
  ok("executed: another rep's company is refused", r.reason === "attributed_to_another_rep" && r.linked === null);
  ok("executed: …and the lead, the events and the touches are untouched", store.salesLead[0].convertedCompanyId === null && store.salesLeadLinkEvent.length === 0 && store.salesAttributionTouch.length === 0);
}

{
  // The rows moved between decision and capture: the company row seen by
  // loadContext carries a membership the candidate loader did not. The
  // capture refuses, the db half THROWS so the caller's transaction rolls the
  // lead update back — asserted as the throw, since a scripted client cannot
  // roll back.
  const s = seed();
  s.user.push({ id: "u_rep", email: REP.email });
  const { tx, store } = makeTx(s);
  // Membership visible to attribution.js's loadContext (member.findFirst) but
  // hidden from the candidate loader by faking the loader's member filter.
  const realFindMany = tx.company.findMany;
  tx.company.findMany = async (args) => (await realFindMany(args)).map((c) => ({ ...c, members: c.members.filter((m) => m.role === "owner") }));
  store.member.push({ id: "m_rep", companyId: "co_1", userId: "u_rep", role: "employee" });
  let threw = null;
  try {
    await linkLeadWithin(tx, { email: "info@truefinish.example", lead: store.salesLead[0], rep: REP });
  } catch (err) {
    threw = err;
  }
  ok("executed: a capture that disagrees with the decision throws to roll back", threw?.code === "LEAD_LINK_ATTRIBUTION_REFUSED" && threw?.outcome === "self_dealing", threw?.message);
  ok("executed: …and wrote no attribution", store.salesAttribution.length === 0);
}

{
  // Unlink: two columns nulled, status restored from the event, an event
  // written, SalesAttribution untouched.
  const { tx, store } = makeTx(seed());
  const lead = store.salesLead[0];
  await linkLeadWithin(tx, { email: "info@truefinish.example", lead, rep: REP });
  const attributionsBefore = JSON.stringify(store.salesAttribution);
  const u = await unlinkLeadWithin(tx, { lead: { ...lead }, rep: REP, reason: "Wrong company — different email." });
  ok("executed: unlink inside the window succeeds", u.allowed === true && u.unlinked?.companyId === "co_1", u);
  ok("executed: convertedCompanyId and convertedAt are null again", lead.convertedCompanyId === null && lead.convertedAt === null);
  ok("executed: the pre-link status came back (demoed, not contacted)", lead.status === "demoed", lead.status);
  ok("executed: an 'unlinked' event with the rep's reason", store.salesLeadLinkEvent.length === 2 && store.salesLeadLinkEvent[1].action === "unlinked" && /Wrong company/.test(store.salesLeadLinkEvent[1].reason) && /demoed/.test(store.salesLeadLinkEvent[1].reason));
  ok("executed: SalesAttribution is exactly as it was", JSON.stringify(store.salesAttribution) === attributionsBefore);
  ok("executed: the company can now be linked again (and the second link is a new event)", (await linkLeadWithin(tx, { email: "info@truefinish.example", lead: { ...lead }, rep: REP })).reason === "ok_already_yours" && store.salesLeadLinkEvent.length === 3);
}

{
  // A link written before the event table existed: no statusBefore anywhere,
  // so the unlink says "contacted" and says why.
  const { tx, store } = makeTx(seed({ salesLead: [{ id: "lead_1", salesRepId: REP.id, createdAt: T0, convertedCompanyId: "co_1", convertedAt: new Date(), status: "signed" }] }));
  const lead = store.salesLead[0];
  const u = await unlinkLeadWithin(tx, { lead: { ...lead }, rep: REP, reason: "" });
  ok("executed: a pre-table link unlinks to 'contacted'", u.unlinked?.status === "contacted" && lead.status === "contacted");
  ok("executed: …and the event says no pre-link status was on record", /No pre-link status/.test(store.salesLeadLinkEvent[0].reason) && /No reason given/.test(store.salesLeadLinkEvent[0].reason));
}

{
  // The wrong row as it actually stood: linked, but the rep had since moved
  // the status back to "demoed". Unlinking keeps "demoed".
  const { tx, store } = makeTx(seed({ salesLead: [{ id: "lead_1", salesRepId: REP.id, createdAt: T0, convertedCompanyId: "co_1", convertedAt: new Date(), status: "demoed" }] }));
  const u = await unlinkLeadWithin(tx, { lead: { ...store.salesLead[0] }, rep: REP, reason: "Wrong company." });
  ok("executed: a status the rep already moved is kept through the unlink", u.unlinked?.status === "demoed" && store.salesLead[0].status === "demoed" && /kept/.test(store.salesLeadLinkEvent[0].reason));
}

{
  const { tx, store } = makeTx(seed({ salesLead: [{ id: "lead_1", salesRepId: REP.id, createdAt: T0, convertedCompanyId: "co_1", convertedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), status: "signed" }] }));
  const u = await unlinkLeadWithin(tx, { lead: { ...store.salesLead[0] }, rep: REP, reason: "late" });
  ok("executed: a 31-day-old link is refused and nothing is written", u.reason === "window_expired" && store.salesLead[0].convertedCompanyId === "co_1" && store.salesLeadLinkEvent.length === 0);
}

{
  // A stale screen: the lead was re-linked to a different company after the
  // page loaded. The compare-and-set on the OLD company id refuses.
  const { tx, store } = makeTx(seed({ salesLead: [{ id: "lead_1", salesRepId: REP.id, createdAt: T0, convertedCompanyId: "co_new", convertedAt: new Date(), status: "signed" }] }));
  const stale = { ...store.salesLead[0], convertedCompanyId: "co_old" };
  const u = await unlinkLeadWithin(tx, { lead: stale, rep: REP, reason: "" });
  ok("executed: unlinking from a company the lead no longer points at is refused", u.unlinked === null && store.salesLead[0].convertedCompanyId === "co_new");
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The route: the list-and-pick path is gone, and the write re-decides in the transaction");

{
  const route = read("app/api/sales/leads/[id]/link/route.js");
  const get = functionBody(route, "GET");
  const post = functionBody(route, "POST");
  const del = functionBody(route, "DELETE");
  ok("GET, POST and DELETE exist", Boolean(get && post && del));
  ok("no `candidates` function remains", functionBody(route, "candidates") === null);
  ok("no handler reads companyId off a body", !/body\??\.companyId/.test(route));
  ok("no handler reads companyId off the query string", !/searchParams\.get\(["']companyId/.test(route));
  ok("assignedCompanyWhere is no longer how a company is chosen here", !/assignedCompanyWhere/.test(route));
  ok("GET reads exactly one query parameter, `email`", (get.match(/searchParams\.get\(/g) || []).length === 1 && /searchParams\.get\("email"\)/.test(get));
  ok("GET runs the pure decision on one lookup", /loadLinkCandidates\(db/.test(get) && /decideLeadLink\(/.test(get));
  ok("GET sends the reason code for the screen to resolve", /reason: v\.reason/.test(get));
  ok("GET never returns a rep's candidate list", !/candidates/.test(get));
  ok("POST re-reads the lead and decides INSIDE $transaction", /\$transaction\(async \(tx\) => \{[\s\S]*?tx\.salesLead\.findFirst[\s\S]*?linkLeadWithin\(tx/.test(post));
  ok("POST does not run the decision outside the transaction", !/decideLeadLink\(/.test(post) && !/loadLinkCandidates\(db/.test(post));
  ok("POST is wrapped in the unique-constraint retry", /withUniqueRetry\(/.test(post));
  ok("POST answers a refused capture in the rep's vocabulary", /LEAD_LINK_ATTRIBUTION_REFUSED/.test(post) && /ATTRIBUTION_OUTCOME_REASON/.test(post));
  ok("DELETE decides and writes inside $transaction", /\$transaction\(async \(tx\) => \{[\s\S]*?unlinkLeadWithin\(tx/.test(del));
  ok("DELETE never names SalesAttribution", !/salesAttribution/i.test(del));
  ok("the route never writes the attribution table by name", !/salesAttribution\w*\.(create|update|upsert|delete)/.test(route));
  ok("every refusal stamps a code the screen can translate", /code: reason, reason/.test(route));
  ok("the rep-typed email is length-capped and header-sanitised before any query", /sanitiseHeaderText\([\s\S]{0,80}\.slice\(0, 254\)/.test(route) && /isPlausibleEmail\(/.test(route));
  // Loader: exact match, bounded, both addresses.
  const lib = read("lib/sales/leadLink.js");
  const loader = functionBody(lib, "loadLinkCandidates");
  ok("the loader matches Company.email exactly (equals, not contains/startsWith)", /email: \{ equals: typed, mode: "insensitive" \}/.test(loader) && !/contains|startsWith|endsWith/.test(loader));
  ok("the loader also matches an OWNER-role member's login email, and only owner", /role: "owner", user: \{ email: \{ equals: typed/.test(loader));
  ok("the loader is bounded", /take: 10/.test(loader));
  const unlinkBody = functionBody(lib, "unlinkLeadWithin");
  ok("unlinkLeadWithin nulls both link columns and touches no attribution", /convertedCompanyId: null, convertedAt: null/.test(unlinkBody) && !/salesAttribution/i.test(unlinkBody));
  ok("unlinkLeadWithin restores the status from the linked event, unless the rep moved it since", /statusAfterUnlink\(linkedEvent\?\.statusBefore, lead\.status\)/.test(unlinkBody));
  const linkBody = functionBody(lib, "linkLeadWithin");
  ok("linkLeadWithin captures with the session's rep and source lead_link", /salesRepId: rep\.id/.test(linkBody) && /source: "lead_link"/.test(linkBody));
  ok("lead_link is a sanctioned attribution source", ATTRIBUTION_SOURCES.includes("lead_link"));
  ok("salesLeadLinkEvent is on the outreach write list", REP_OUTREACH_WRITES.includes("salesLeadLinkEvent"));
  ok("the schema has the event table", /model SalesLeadLinkEvent \{/.test(readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The screen and the catalogue: every reason, nine languages, resolved not printed");

{
  const languages = Object.keys(APP_MESSAGES);
  ok("nine languages in the catalogue", languages.length === 9, languages);
  for (const [reason, key] of Object.entries(LEAD_LINK_REASON_KEYS)) {
    const missing = languages.filter((l) => typeof APP_MESSAGES[l]?.[key] !== "string" || !APP_MESSAGES[l][key].trim());
    ok(`"${reason}" has a sentence in every language`, missing.length === 0, missing);
  }
  const uiKeys = ["linkByEmailHint", "linkEmailLabel", "linkCheck", "linkDo", "linkedCompanyNotInBook", "unlink", "unlinkConfirm", "unlinkReason", "unlinkDo", "unlinkCancel"];
  for (const k of uiKeys) {
    const missing = languages.filter((l) => typeof APP_MESSAGES[l]?.[`app.salesLeads.${k}`] !== "string");
    ok(`app.salesLeads.${k} exists in every language`, missing.length === 0, missing);
  }
  const retired = ["app.salesLeads.linkASignup", "app.salesLeads.noUnlinkedSignups", "app.salesLeads.candidateDemoAccount", "app.salesLeads.candidateSameEmail"];
  ok("the list-era copy is gone from the catalogue", retired.every((k) => !(k in APP_MESSAGES.en)), retired.filter((k) => k in APP_MESSAGES.en));

  const screen = read("app/sales/leads/[id]/page.js");
  ok("the screen resolves the reason through LEAD_LINK_REASON_KEYS", /LEAD_LINK_REASON_KEYS\[reason\]/.test(screen) && /errorText\(t, err, LEAD_LINK_REASON_KEYS\)/.test(screen));
  ok("the screen imports the vocabulary, not the decider (no db in a client bundle)", /from "@\/lib\/sales\/leadLinkReasons"/.test(screen) && !/from "@\/lib\/sales\/leadLink"/.test(screen));
  ok("the Link button renders only on an eligible verdict", /verdict\?\.eligible \? \(/.test(screen));
  ok("a keystroke clears the verdict", /setLinkEmail\(e\.target\.value\);\s*setVerdict\(null\)/.test(screen));
  ok("the screen checks by GET ?email= and links by POST { email }", /\/link\?email=\$\{encodeURIComponent\(linkEmail\.trim\(\)\)\}/.test(screen) && /jsonBody\(\{ email: linkEmail\.trim\(\) \}, "link"\)/.test(screen));
  ok("the screen never posts a companyId", !/companyId/.test(functionBody(screen, "link") || "x"));
  ok("Unlink is offered only while the server says the window is open", /linkedCompany\?\.canUnlink \?/.test(screen));
  ok("Unlink asks before it acts", /unlinkOpen \?/.test(screen) && /app\.salesLeads\.unlinkConfirm/.test(screen));
  ok("Unlink calls DELETE", /method: "DELETE"/.test(functionBody(screen, "unlink") || ""));
  ok("no candidate list survives on the screen", !/candidates/.test(screen));
  const leadRoute = read("app/api/sales/leads/[id]/route.js");
  ok("the lead route sends linkedCompany with the unlink window on GET and PATCH", (leadRoute.match(/linkedCompany: await linkedCompanyFor\(rep, lead\)/g) || []).length === 2);
  ok("…reading the name under the rep's scope", /assignedCompanyWhere\(rep\.id\)/.test(functionBody(leadRoute, "linkedCompanyFor") || ""));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${failures.length === 0 ? `ALL PASS — ${pass} checks` : `${failures.length} FAILED of ${pass + failures.length}`}`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
