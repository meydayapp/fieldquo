// lib/sales/checkin/materialise.js
//
// Write down the check-ins a rep's attributed companies are owed, so they
// exist somewhere a rep can see them — thread or no thread.
//
// ══ Why a company needed a thread before it could have a check-in ═════════
//
// suggestionForThread() (store.js) is called with a company that was found
// by walking FROM a texts thread: number → lead → convertedCompanyId →
// company. A company that signed up straight through the rep's link has no
// lead and no thread, so that walk never starts, and the day-1 and day-7
// texts the owner designed were computed for nobody. This file walks the
// other way: attribution → company → (lead, number) → draft row, and the
// thread machinery then finds the row by the number it was addressed to.
//
// ══ NOTHING HERE SENDS ════════════════════════════════════════════════════
//
// It writes DRAFTS, in status "draft", and stops. There is no import of the
// send path, no Twilio, no SalesSmsMessage. The cron that calls this
// (app/api/cron/sales-checkins) is scanned by scripts/check-sales-messages.mjs
// for exactly that: it may reach this module and it may not reach store.js,
// which holds the send. A backlog job that could text a contractor is the
// thing the whole feature promised never to be.
//
// ══ The wording is the rule draft, and the model is not asked ═════════════
//
// draftCheckIn() bills a model and is asked once, on a press, when a rep
// opens a draft and asks for a rephrase — the same rule store.js keeps for
// the screen. A job that ran the model over every attributed company every
// morning would spend on drafts nobody reads. The rows carry draftSource
// "rule" and `degraded: true`, which is the honest label: it is the plain
// version, and the screen says so.
//
// ══ Idempotent, and proven so ═════════════════════════════════════════════
//
// Every row is keyed `scheduled:<company>:<touchpoint>` (plan.js), and the
// unique index on (salesRepId, dedupeKey) makes a second run find the first
// run's rows rather than add to them. A lead is created only when no lead
// across ANY rep already points at the company, and its convertedCompanyId
// is @unique too. scripts/check-sales-checkin-materialise.mjs runs this twice
// against an in-memory client and counts the writes.
//
// ══ The number, resolved from the record and never guessed ════════════════
//
// Company.phone first — the business's own number, typed at signup — then an
// owner's or admin's Member.phone, then the phone on the rep's lead for this
// company. plan.js's resolveCompanyNumber() decides; this file reads the
// columns it needs. Reading Company.phone here is a deliberate widening of
// REP_COMPANY_SELECT's list (lib/sales/scope.js says a rep is not shown a
// contractor's phone): the number is not handed to the rep as a column, it
// becomes the address of a text the owner asked reps to send, and it reaches
// the screen only as the thread it names — the same way a lead's phone
// already does.
//
// ══ What it never touches ═════════════════════════════════════════════════
//
// A demo company. assignedCompanyWhere() cannot match one (lib/sales/scope.js
// keeps repDemoWhere separate) and the query re-asserts isDemo false anyway.
// The demo has its own, clearly marked path — materialiseDemoCheckIn() below
// — whose row says "demo" in its origin and in its key and is refused by the
// send path on the company row.
import { db } from "@/lib/db";
import { loadSetupSnapshot } from "@/lib/setupStepsSnapshot";
import { stepsFor } from "@/lib/setupSteps";
import { resolveLeadTimeZone } from "@/lib/sales/leadTimeZone";
import { assignedCompanyWhere, REP_COMPANY_SELECT } from "../scope";
import { createSalesLead } from "../leadCreate";
import { normalisePhone } from "../suppressionRules";
import { checkInSignals, FIRST_CHECKIN_DAY } from "./signals";
import { ruleDraft } from "./draft";
import { nextWindowOpening } from "./schedule";
import { checkInSummary, planCheckIn, resolveCompanyNumber } from "./plan";
import { insertDraftRow } from "./rows";

/**
 * Every table this module writes. Asserted by the check, so the list is the
 * permission and not a description of it.
 */
export const MATERIALISE_WRITES = ["salesCheckIn", "salesLead", "salesLeadLinkEvent"];

/** The origin a demo draft carries. Refused by the send path on sight. */
export const DEMO_ORIGIN = "demo";

/**
 * The fictional number a demo draft is addressed to.
 *
 * NANP reserves NPA-555-0100 through 0199 for fiction (lib/demo/simulatedSpend.js
 * says why the crew lines use the same block), so this can never ring a
 * stranger. One fixed number rather than a random one, so the demo's thread
 * is the same thread on every reset and the key dedupes across runs.
 */
export const DEMO_CHECKIN_E164 = "+16135550150";

/** How many companies one on-request run will load a setup snapshot for. */
export const REQUEST_SNAPSHOT_BUDGET = 8;

/**
 * Company.timezone's schema default. A company that never opened Settings
 * carries it, and a default is not a statement — lib/sales/leadTimeZone.js's
 * rule is that a zone is stated or derived from the province, never assumed.
 * So the column is only believed when somebody changed it from this.
 */
const COMPANY_TIMEZONE_DEFAULT = "America/Toronto";

/**
 * The columns this module reads about a company. REP_COMPANY_SELECT plus the
 * address of the text — see the header for why that widening is deliberate.
 */
export const MATERIALISE_COMPANY_SELECT = {
  ...REP_COMPANY_SELECT,
  phone: true,
  email: true,
  province: true,
  country: true,
  timezone: true,
  subscription: { select: { status: true, trialEndsAt: true } },
  members: {
    where: { role: { in: ["owner", "admin"] }, active: true },
    select: { role: true, phone: true },
    orderBy: { createdAt: "asc" },
  },
};

const CHECKIN_ROW_SELECT = {
  id: true,
  companyId: true,
  leadId: true,
  toE164: true,
  dedupeKey: true,
  status: true,
  scheduledFor: true,
  draftSource: true,
  sendingStartedAt: true,
  sentAt: true,
  reasonCode: true,
  origin: true,
};

/** The engine's shape of a company row, the same mapping the companies route does. */
function engineCompany(c) {
  return {
    id: c.id,
    name: c.name,
    signedUpAt: c.createdAt,
    isDemo: c.isDemo,
    chargesEnabled: c.stripeChargesEnabled,
    onboardingCompletedAt: c.onboardingCompletedAt,
    subscriptionStatus: c.subscription?.status || null,
  };
}

/**
 * The company's zone, by the one rule every other text uses.
 *
 * The rep's own lead first (a zone a rep stated, or a province they typed),
 * then a zone the rep STATED on any other lead of theirs at the same number
 * — the owner's test number sits on two older leads with "America/Toronto"
 * typed on them, and the company that signed up from it is in the same town
 * — then the company's province, derived exactly as resolveLeadTimeZone
 * derives it for a lead (Ontario and BC are split and derive nothing), and
 * only then Company.timezone, and only when it is not the schema default.
 */
export function companyTimeZone({ company, lead = null, statedElsewhere = null } = {}) {
  const fromLead = lead ? resolveLeadTimeZone(lead) : { timeZone: null };
  if (fromLead.timeZone) return { timeZone: fromLead.timeZone, source: fromLead.source };
  const typed = typeof statedElsewhere === "string" ? statedElsewhere.trim() : "";
  if (typed && resolveLeadTimeZone({ timeZone: typed }).timeZone) return { timeZone: typed, source: "stated" };
  const fromProvince = resolveLeadTimeZone({ country: company?.country, province: company?.province });
  if (fromProvince.timeZone) return { timeZone: fromProvince.timeZone, source: "derived" };
  const stated = typeof company?.timezone === "string" ? company.timezone.trim() : "";
  if (stated && stated !== COMPANY_TIMEZONE_DEFAULT) return { timeZone: stated, source: "company" };
  return { timeZone: null, source: null };
}

async function defaultLoadSetup(companyId) {
  return stepsFor(await loadSetupSnapshot(companyId));
}

/**
 * Create the lead that stands for this company in the rep's book.
 *
 * Named after the company, marked "signed", pointing at the company, with a
 * link event whose reason is "signup" so the lead screen can say where it
 * came from. Refuses — returns null — when a lead anywhere already points at
 * the company, and treats the unique index firing as that same answer.
 */
async function ensureLead({ client, rep, company, e164, timeZone, now, dryRun, log }) {
  const held = await client.salesLead.findFirst({
    where: { convertedCompanyId: company.id },
    select: { id: true, salesRepId: true, phone: true, timeZone: true, province: true, country: true },
  });
  if (held) return { lead: held, created: false, foreign: held.salesRepId !== rep.id };
  if (dryRun) return { lead: null, created: false, foreign: false, wouldCreate: true };

  try {
    const lead = await createSalesLead(client, {
      salesRepId: rep.id,
      businessName: company.name,
      email: company.email || null,
      phone: e164 || null,
      country: company.country || null,
      province: company.province || null,
      // Only a STATED zone travels onto the lead — one the rep typed on
      // another lead at this number, or the company's own Settings. A
      // derived one is re-derived from the province on every read, as for
      // any lead.
      timeZone: timeZone?.source === "company" || timeZone?.source === "stated" ? timeZone.timeZone : null,
      status: "signed",
      notes:
        "Created by FieldQuo when this company signed up through your link, so the " +
        "check-in texts have a conversation to sit in.",
      convertedCompanyId: company.id,
      convertedAt: company.salesAttribution?.capturedAt || company.createdAt || now,
    });
    await client.salesLeadLinkEvent.create({
      data: {
        leadId: lead.id,
        salesRepId: rep.id,
        action: "linked",
        companyId: company.id,
        statusBefore: null,
        reason: "signup",
      },
    });
    return { lead, created: true, foreign: false };
  } catch (err) {
    if (err?.code !== "P2002") throw err;
    // Somebody linked it between the read and the insert. Read theirs.
    const again = await client.salesLead.findFirst({
      where: { convertedCompanyId: company.id },
      select: { id: true, salesRepId: true, phone: true, timeZone: true, province: true, country: true },
    });
    log?.(`[sales check-in] lead for ${company.id} was linked concurrently`);
    return { lead: again, created: false, foreign: again ? again.salesRepId !== rep.id : false };
  }
}

/**
 * Materialise this rep's backlog.
 *
 * @param salesRepId      the rep. Re-read here; nothing is trusted from a caller.
 * @param client          injectable, so the check can run it against memory.
 * @param now             injectable.
 * @param snapshotBudget  how many setup snapshots this run may load. The
 *                        on-request callers pass REQUEST_SNAPSHOT_BUDGET so a
 *                        list load stays a list load; the cron passes more.
 * @param dryRun          decide everything, write nothing, report what would be.
 * @param loadSetup       injectable for the check; production uses the real one.
 *
 * @returns {{
 *   ok: boolean, repId, dryRun, considered: number,
 *   created: Array, refreshed: Array, repaired: Array, leadsCreated: Array,
 *   skipped: Array<{ companyId, name, state, code }>,
 *   summaries: Map<companyId, summary>
 * }}
 */
export async function materialiseCheckInsForRep({
  salesRepId,
  client = db,
  now = new Date(),
  snapshotBudget = REQUEST_SNAPSHOT_BUDGET,
  dryRun = false,
  loadSetup = defaultLoadSetup,
  log = null,
} = {}) {
  const out = {
    ok: true,
    repId: salesRepId,
    dryRun,
    considered: 0,
    created: [],
    refreshed: [],
    repaired: [],
    leadsCreated: [],
    skipped: [],
    summaries: new Map(),
  };
  if (!salesRepId) return { ...out, ok: false };

  const rep = await client.salesRep.findUnique({
    where: { id: salesRepId },
    select: { id: true, name: true, commissionPlan: { select: { retentionDays: true } } },
  });
  if (!rep) return { ...out, ok: false };

  const days = rep.commissionPlan?.retentionDays;
  const retentionDays = Number.isFinite(days) && days > 0 ? days : null;

  const companies = await client.company.findMany({
    where: { ...assignedCompanyWhere(rep.id), isDemo: false },
    select: MATERIALISE_COMPANY_SELECT,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  out.considered = companies.length;
  if (!companies.length) return out;

  const ids = companies.map((c) => c.id);
  const [rows, leads] = await Promise.all([
    client.salesCheckIn.findMany({
      where: { salesRepId: rep.id, companyId: { in: ids } },
      select: CHECKIN_ROW_SELECT,
      orderBy: { createdAt: "asc" },
    }),
    client.salesLead.findMany({
      where: { convertedCompanyId: { in: ids } },
      select: { id: true, salesRepId: true, convertedCompanyId: true, phone: true, timeZone: true, province: true, country: true },
    }),
  ]);
  const rowsByCompany = new Map();
  for (const r of rows) {
    if (!rowsByCompany.has(r.companyId)) rowsByCompany.set(r.companyId, []);
    rowsByCompany.get(r.companyId).push(r);
  }
  const leadByCompany = new Map(leads.map((l) => [l.convertedCompanyId, l]));

  // Zones the rep has stated on their own leads, by number — see
  // companyTimeZone(). Newest first, so the rep's latest word wins.
  const statedByNumber = new Map();
  const stated = await client.salesLead.findMany({
    where: { salesRepId: rep.id, timeZone: { not: null }, phone: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: { phone: true, timeZone: true },
  });
  for (const l of stated) {
    const n = normalisePhone(l.phone);
    if (n && !statedByNumber.has(n)) statedByNumber.set(n, l.timeZone);
  }

  let snapshots = 0;

  for (const c of companies) {
    const existing = rowsByCompany.get(c.id) || [];
    const lead = leadByCompany.get(c.id) || null;
    const ownLead = lead && lead.salesRepId === rep.id ? lead : null;
    const company = engineCompany(c);
    const number = resolveCompanyNumber({ phone: c.phone, members: c.members, leadPhone: ownLead?.phone });
    const zone = companyTimeZone({
      company: c,
      lead: ownLead,
      statedElsewhere: number.e164 ? statedByNumber.get(number.e164) || null : null,
    });
    const lastCheckInAt =
      existing
        .filter((r) => r.status === "sent" && r.sentAt)
        .map((r) => r.sentAt)
        .sort((a, b) => new Date(b) - new Date(a))[0] || null;
    const args = {
      company,
      lastCheckInAt,
      retentionDays,
      trialEndsAt: c.subscription?.trialEndsAt ?? null,
      existing,
      timeZone: zone.timeZone,
      now,
    };

    // Pass one: cheap. store.js's header says why a suppression here is final
    // and why the same function is called twice rather than a second
    // predicate written.
    let plan = planCheckIn({ ...args, setup: null });

    if (plan.state === "due" || plan.state === "refresh") {
      // Pass two, for the WORDING: the setup evidence the draft names. A
      // snapshot that fails to load stays null, which reads as unknown_state
      // — never as a thriving company with nothing to say.
      let setup = null;
      if (snapshots < snapshotBudget) {
        snapshots += 1;
        try {
          setup = await loadSetup(c.id);
        } catch (err) {
          log?.(`[sales check-in] setup snapshot unreadable for ${c.id}: ${err?.message}`);
        }
      }
      plan = planCheckIn({ ...args, setup });
    }

    const skip = (state, code = null) => {
      out.skipped.push({ companyId: c.id, name: c.name, state, code });
    };

    if (plan.state === "due" || plan.state === "refresh") {
      const leadResult = await ensureLead({ client, rep, company: c, e164: number.e164, timeZone: zone, now, dryRun, log });
      if (leadResult.created) out.leadsCreated.push({ companyId: c.id, leadId: leadResult.lead.id, name: c.name });
      if (leadResult.wouldCreate) out.leadsCreated.push({ companyId: c.id, leadId: null, name: c.name, dryRun: true });
      const leadId = leadResult.lead && !leadResult.foreign ? leadResult.lead.id : null;

      const draftText = ruleDraft(plan.decision, { repName: rep.name });
      const entry = {
        companyId: c.id,
        name: c.name,
        touchpoint: plan.touchpoint,
        dedupeKey: plan.dedupeKey,
        toE164: number.e164,
        numberSource: number.source,
        reasonCode: plan.decision.primary?.code || null,
        scheduledFor: plan.scheduledFor,
        timeZone: zone.timeZone,
        draftText,
        dryRun,
      };

      if (plan.state === "refresh") {
        if (!dryRun) {
          // Re-aim, compare-and-set on the state the plan saw: still a draft,
          // still rule-worded, not mid-send. A rep who edited it in between
          // keeps their words.
          const { count } = await client.salesCheckIn.updateMany({
            where: { id: plan.row.id, salesRepId: rep.id, status: "draft", draftSource: "rule", sendingStartedAt: null },
            data: {
              draftText,
              reasonCode: entry.reasonCode,
              dedupeKey: plan.dedupeKey,
              scheduledFor: plan.scheduledFor,
              toE164: number.e164,
              leadId: leadId || plan.row.leadId || null,
            },
          });
          if (!count) {
            skip("open");
            continue;
          }
        }
        out.refreshed.push({ ...entry, id: plan.row.id, from: plan.row.dedupeKey });
        const after = existing.map((r) => (r.id === plan.row.id ? { ...r, dedupeKey: plan.dedupeKey, toE164: number.e164, scheduledFor: plan.scheduledFor, reasonCode: entry.reasonCode } : r));
        out.summaries.set(c.id, checkInSummary({ plan: { ...plan, state: "open" }, existing: after, toE164: number.e164 }));
        continue;
      }

      let row = null;
      if (!dryRun) {
        const written = await insertDraftRow(client, {
          salesRepId: rep.id,
          companyId: c.id,
          leadId,
          toE164: number.e164,
          draftText,
          origin: "engine",
          reasonCode: entry.reasonCode,
          draftSource: "rule",
          degraded: true,
          scheduledFor: plan.scheduledFor,
          status: "draft",
          dedupeKey: plan.dedupeKey,
        });
        row = written.checkIn;
        if (written.existed) {
          skip("open");
          out.summaries.set(c.id, checkInSummary({ plan: { ...plan, state: "open" }, existing: [...existing, row], toE164: number.e164 }));
          continue;
        }
      }
      out.created.push({ ...entry, id: row?.id || null });
      const after = [
        ...existing,
        row || { id: null, dedupeKey: plan.dedupeKey, status: "draft", toE164: number.e164, scheduledFor: plan.scheduledFor, reasonCode: entry.reasonCode },
      ];
      out.summaries.set(c.id, checkInSummary({ plan: { ...plan, state: "open" }, existing: after, toE164: number.e164 }));
      continue;
    }

    // ── Repair: a numberless row for a company that now has a number ─────
    //
    // The rep added a phone to the lead since the row was written, or the
    // company filled in Settings. The row is re-addressed so it gains a
    // thread; nothing else about it changes.
    const open = existing.find((r) => r.status === "draft");
    if (open && !open.toE164 && number.e164) {
      if (!dryRun) {
        await client.salesCheckIn.updateMany({
          where: { id: open.id, salesRepId: rep.id, status: "draft", toE164: null },
          data: { toE164: number.e164, leadId: open.leadId || ownLead?.id || null },
        });
      }
      out.repaired.push({ companyId: c.id, name: c.name, id: open.id, toE164: number.e164, numberSource: number.source, dryRun });
      const after = existing.map((r) => (r.id === open.id ? { ...r, toE164: number.e164 } : r));
      out.summaries.set(c.id, checkInSummary({ plan, existing: after, toE164: number.e164 }));
      skip(plan.state, plan.code);
      continue;
    }

    skip(plan.state, plan.code);
    out.summaries.set(c.id, checkInSummary({ plan, existing, toE164: number.e164 }));
  }

  return out;
}

/**
 * The day-1 draft on the rep's OWN demo company, so a new rep sees on their
 * first morning what the backlog will show them for a real signup.
 *
 * ══ Clearly a fixture, in three places ════════════════════════════════════
 *
 *   origin      "demo"          — the row says what it is
 *   dedupeKey   demo:<id>:1     — never the shape a real touchpoint uses
 *   toE164      a 555 number    — reserved for fiction, rings nobody
 *
 * and the send path re-reads the company row and refuses on isDemo, whatever
 * the row says. signals.js would have suppressed this company as
 * `demo_company` and draftCheckIn() would have refused it as
 * `not_contactable`; both are right, and this function does not go near
 * either. The WORDING is produced by ruleDraft() over a decision computed
 * for a stand-in — the demo's real onboarding and payout facts with a signup
 * date of yesterday and the demo flag cleared — because the words are what
 * the rep is meant to see, and "Hi, it is Daniel from FieldQuo, about
 * Cedar & Co. Flooring" is what a day-1 text reads like.
 *
 * Nothing is written to the company. No SalesAttribution is created: a demo
 * that satisfied "attributed to me" would be a sale for commission purposes
 * (lib/sales/scope.js says exactly this), and this feature is not worth that.
 */
export async function materialiseDemoCheckIn({ salesRepId, client = db, now = new Date(), dryRun = false } = {}) {
  if (!salesRepId) return { ok: false, created: false, reason: "no_rep" };
  const rep = await client.salesRep.findUnique({
    where: { id: salesRepId },
    select: { id: true, name: true, demoCompanyId: true, commissionPlan: { select: { retentionDays: true } } },
  });
  if (!rep?.demoCompanyId) return { ok: true, created: false, reason: "no_demo" };

  // Re-read and re-asserted: a demoCompanyId is a pointer, and only the row
  // can say it is a demo. The same rule /api/sales/demo applies.
  const company = await client.company.findUnique({
    where: { id: rep.demoCompanyId },
    select: { id: true, name: true, isDemo: true, onboardingCompletedAt: true, stripeChargesEnabled: true },
  });
  if (!company || company.isDemo !== true) return { ok: true, created: false, reason: "not_a_demo" };

  const dedupeKey = `demo:${company.id}:${FIRST_CHECKIN_DAY}`;
  const existing = await client.salesCheckIn.findFirst({
    where: { salesRepId: rep.id, dedupeKey },
    select: { id: true, status: true },
  });
  if (existing) return { ok: true, created: false, reason: "exists", id: existing.id };

  const days = rep.commissionPlan?.retentionDays;
  const retentionDays = Number.isFinite(days) && days > 0 ? days : null;
  // The stand-in. See the docblock: a signup of yesterday, the demo flag
  // cleared, the demo's own setup facts. It exists to produce words.
  const standIn = {
    id: company.id,
    name: company.name,
    signedUpAt: new Date(now.getTime() - FIRST_CHECKIN_DAY * 24 * 60 * 60 * 1000),
    isDemo: false,
    chargesEnabled: company.stripeChargesEnabled,
    onboardingCompletedAt: company.onboardingCompletedAt,
    subscriptionStatus: "trialing",
  };
  const decision = checkInSignals({ company: standIn, setup: null, lastCheckInAt: null, retentionDays, now });
  const draftText = ruleDraft(decision, { repName: rep.name });
  const scheduledFor = nextWindowOpening(now, COMPANY_TIMEZONE_DEFAULT);

  if (dryRun) return { ok: true, created: false, dryRun: true, wouldCreate: { companyId: company.id, draftText, dedupeKey } };

  const { checkIn, existed } = await insertDraftRow(client, {
    salesRepId: rep.id,
    companyId: company.id,
    leadId: null,
    toE164: DEMO_CHECKIN_E164,
    draftText,
    origin: DEMO_ORIGIN,
    reasonCode: decision.primary?.code || null,
    draftSource: "rule",
    degraded: true,
    scheduledFor,
    status: "draft",
    dedupeKey,
  });
  return { ok: true, created: !existed, id: checkIn.id, companyId: company.id, draftText };
}

/**
 * Every active rep who holds an attribution, in turn — the cron's loop.
 *
 * One rep's failure is logged and the next rep is still processed; a backlog
 * that stopped at the first unreadable snapshot would leave every rep after
 * it with nothing, silently.
 */
export async function materialiseCheckInsForAllReps({
  client = db,
  now = new Date(),
  dryRun = false,
  log = null,
  loadSetup = defaultLoadSetup,
} = {}) {
  const reps = await client.salesRep.findMany({
    where: { active: true, endedAt: null },
    select: { id: true, name: true, demoCompanyId: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const report = { reps: 0, considered: 0, created: 0, refreshed: 0, repaired: 0, leadsCreated: 0, demoCreated: 0, failed: 0, perRep: [] };
  for (const rep of reps) {
    report.reps += 1;
    try {
      const r = await materialiseCheckInsForRep({ salesRepId: rep.id, client, now, snapshotBudget: 200, dryRun, log, loadSetup });
      const demo = rep.demoCompanyId ? await materialiseDemoCheckIn({ salesRepId: rep.id, client, now, dryRun }) : null;
      report.considered += r.considered;
      report.created += r.created.length;
      report.refreshed += r.refreshed.length;
      report.repaired += r.repaired.length;
      report.leadsCreated += r.leadsCreated.length;
      if (demo?.created) report.demoCreated += 1;
      report.perRep.push({
        repId: rep.id,
        name: rep.name,
        considered: r.considered,
        created: r.created,
        refreshed: r.refreshed,
        repaired: r.repaired,
        leadsCreated: r.leadsCreated,
        skipped: r.skipped,
        demo,
      });
    } catch (err) {
      report.failed += 1;
      report.perRep.push({ repId: rep.id, name: rep.name, error: err?.message || String(err) });
      log?.(`[sales check-in] materialise failed for rep ${rep.id}: ${err?.message}`);
    }
  }
  return report;
}
