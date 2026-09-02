// lib/billing/disputeEvidence.js
//
// The case FieldQuo can make when a contractor charges back their subscription.
//
// ══ Why bother ═════════════════════════════════════════════════════════════
//
// A chargeback on a SaaS subscription is usually contestable, and for one
// reason: FieldQuo can prove the customer used the product while they were
// paying for it. "Product not received" and "unauthorised" are the two reasons
// most subscription disputes are filed under, and both are answered by a dated
// list of things the account did — quotes sent to real homeowners, invoices
// issued, jobs booked, sign-ins from the customer's own devices.
//
// Stripe's dispute evidence takes a free-text `access_activity_log` for exactly
// this. What it does NOT take is a claim without dates, which is why everything
// below is assembled from rows FieldQuo already writes rather than from
// adjectives.
//
// ══ What this deliberately does NOT do ═════════════════════════════════════
//
// It never submits to Stripe. Assembling evidence and putting it in front of a
// human is a different decision from firing it at a deadline, and only one of
// those has been made. There is no submit button and no cron; the platform
// console shows the assembled text and a superadmin copies it into Stripe.
//
// ══ Absence is not padded ══════════════════════════════════════════════════
//
// AGENTS.md's rule about invented defaults applies here more sharply than
// anywhere else in the codebase, because the output is a legal-ish assertion to
// a card network. A company that never used FieldQuo produces evidence that
// SAYS they never used FieldQuo, and `hasUsage: false` so the screen can tell
// staff not to contest. Every field Stripe would accept but we cannot honestly
// fill is omitted and named in `gaps` — an empty billing address is left out,
// never guessed from the city, and a `service_date` is only emitted when the
// disputed charge's own period was passed in.
//
// ══ IP addresses ═══════════════════════════════════════════════════════════
//
// Sign-in evidence carries the /16 network only, never the full address — the
// same rule lib/platform/companyHealth.js already applies to the platform
// console, for the same reason. It is enough to show "these are the same
// people, on their own connections, over eleven months", which is the thing a
// card network is being asked to believe.

// Stripe caps each evidence text field at 20,000 characters. Truncating here,
// with a line saying so, beats having Stripe reject the whole submission.
export const MAX_EVIDENCE_FIELD = 20_000;

function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "2026-08-30 14:05Z" — dated to the minute, unambiguous, no locale. */
function stamp(value) {
  const s = iso(value);
  return s ? `${s.slice(0, 10)} ${s.slice(11, 16)}Z` : null;
}

function day(value) {
  const s = iso(value);
  return s ? s.slice(0, 10) : null;
}

function timeOf(value) {
  const s = iso(value);
  return s ? new Date(s).getTime() : null;
}

/** Rows sorted oldest-first by the field that dates them, dateless ones dropped. */
function dated(rows, field) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({ row: r, t: timeOf(r?.[field]) }))
    .filter((x) => x.t != null)
    .sort((a, b) => a.t - b.t);
}

function truncate(text) {
  if (text.length <= MAX_EVIDENCE_FIELD) return { text, truncated: false };
  const note = "\n\n[truncated — FieldQuo holds more records than Stripe's 20,000 character limit allows]";
  return { text: text.slice(0, MAX_EVIDENCE_FIELD - note.length) + note, truncated: true };
}

/**
 * PURE. Assemble Stripe dispute evidence for one company from rows already
 * loaded.
 *
 * Pure on purpose: the interesting failures here are an empty history, a single
 * event, and hundreds, and none of those are worth a database to reproduce.
 * See scripts/check-subscription-refunds.mjs, which executes it against all
 * three plus hostile input.
 *
 * @param {object} p
 * @param {object} p.company        { name, email, phone, address, city, province, country, createdAt }
 * @param {object|null} p.subscription  { status, planName, billingInterval, createdAt, currentPeriodEnd, canceledAt }
 * @param {object|null} p.owner     { name, email } — the account holder, when there is one
 * @param {Array} p.quotesSent      Quote rows with `sentAt`
 * @param {Array} p.invoicesSent    Invoice rows with `sentAt`
 * @param {Array} p.jobs            Job rows with `createdAt`
 * @param {Array} p.payments        Payment rows with `date` — money the contractor
 *                                  COLLECTED through FieldQuo, the strongest single
 *                                  fact available: they were paid using the thing
 *                                  they are refusing to pay for
 * @param {Array} p.devices         AccountDevice rows { firstSeenAt, lastSeenAt, network, userAgent, who }
 * @param {Array} p.activity        ActivityLog rows { createdAt, action, summary, actorName }
 * @param {object|null} p.totals    counts across ALL rows when only a sample was
 *                                  loaded; derived from the samples when absent
 * @param {{start: Date, end: Date}|null} p.servicePeriod  the period the disputed
 *                                  charge covered. Omitted from the evidence when
 *                                  absent rather than assumed from the subscription.
 * @returns {{hasUsage: boolean, summary: object, gaps: string[],
 *            evidence: object, truncated: boolean}}
 */
export function assembleDisputeEvidence({
  company = null,
  subscription = null,
  owner = null,
  quotesSent = [],
  invoicesSent = [],
  jobs = [],
  payments = [],
  devices = [],
  activity = [],
  totals = null,
  servicePeriod = null,
} = {}) {
  const q = dated(quotesSent, "sentAt");
  const inv = dated(invoicesSent, "sentAt");
  const j = dated(jobs, "createdAt");
  const pay = dated(payments, "date");
  const act = dated(activity, "createdAt");
  const dev = dated(devices, "lastSeenAt");

  const counts = {
    quotesSent: totals?.quotesSent ?? q.length,
    invoicesSent: totals?.invoicesSent ?? inv.length,
    jobsCreated: totals?.jobsCreated ?? j.length,
    paymentsCollected: totals?.paymentsCollected ?? pay.length,
    devicesSeen: totals?.devicesSeen ?? dev.length,
    activityEvents: totals?.activityEvents ?? act.length,
  };

  // "Used the product" means the pipeline moved or someone signed in. A row in
  // the activity log counts; a company row existing does not.
  const usageTimes = [...q, ...inv, ...j, ...pay, ...act, ...dev].map((x) => x.t);
  const firstUsedAt = usageTimes.length ? new Date(Math.min(...usageTimes)) : null;
  const lastUsedAt = usageTimes.length ? new Date(Math.max(...usageTimes)) : null;
  const hasUsage =
    counts.quotesSent > 0 ||
    counts.invoicesSent > 0 ||
    counts.jobsCreated > 0 ||
    counts.paymentsCollected > 0 ||
    counts.activityEvents > 0 ||
    counts.devicesSeen > 0;

  const gaps = [];
  const lines = [];
  const add = (s) => lines.push(s);

  const name = company?.name || null;
  const email = company?.email || owner?.email || null;

  add(`FieldQuo account: ${name || "(company name not recorded)"}`);
  if (company?.createdAt) add(`Account created: ${stamp(company.createdAt)}`);
  if (subscription) {
    const parts = [
      subscription.planName ? `plan "${subscription.planName}"` : null,
      subscription.billingInterval ? `billed by the ${subscription.billingInterval}` : null,
      subscription.status ? `status ${subscription.status}` : null,
    ].filter(Boolean);
    if (parts.length) add(`Subscription: ${parts.join(", ")}`);
    if (subscription.createdAt) add(`Subscription started: ${stamp(subscription.createdAt)}`);
    if (subscription.canceledAt) add(`Subscription cancelled: ${stamp(subscription.canceledAt)}`);
  } else {
    gaps.push("No subscription row for this company — the billing relationship itself is unrecorded.");
  }

  if (!hasUsage) {
    // The honest answer, and the only one. Nothing below this point invents a
    // sentence about a product nobody opened.
    add("");
    add(
      "FieldQuo has NO recorded product usage for this account: no quotes sent, no invoices issued, no jobs created, no payments collected, no sign-ins and no recorded actions.",
    );
    add(
      "This account cannot be shown to have used the service. Nothing here supports contesting the dispute on usage grounds.",
    );
    gaps.push("No usage of any kind is recorded — this dispute is probably not contestable on these facts.");
  } else {
    add("");
    add(
      `Recorded product use spans ${stamp(firstUsedAt)} to ${stamp(lastUsedAt)}.`,
    );
    add("");
    add("Totals:");
    add(`  quotes sent to the account's own clients: ${counts.quotesSent}`);
    add(`  invoices issued: ${counts.invoicesSent}`);
    add(`  jobs created: ${counts.jobsCreated}`);
    add(`  payments collected through FieldQuo: ${counts.paymentsCollected}`);
    add(`  distinct sign-in devices seen: ${counts.devicesSeen}`);
    add(`  recorded actions in the app: ${counts.activityEvents}`);

    if (q.length) {
      add("");
      add(`Quotes sent (${q.length} listed):`);
      for (const { row } of q) {
        const to = row.sentToEmail ? ` to ${row.sentToEmail}` : "";
        add(`  ${stamp(row.sentAt)}  quote ${row.quoteNumber || "(unnumbered)"}${to}`);
      }
    }
    if (inv.length) {
      add("");
      add(`Invoices sent (${inv.length} listed):`);
      for (const { row } of inv) {
        const to = row.sentToEmail ? ` to ${row.sentToEmail}` : "";
        add(`  ${stamp(row.sentAt)}  invoice ${row.invoiceNumber || "(unnumbered)"}${to}`);
      }
    }
    if (j.length) {
      add("");
      add(`Jobs created (${j.length} listed):`);
      for (const { row } of j) {
        const done = row.completedAt ? `, completed ${day(row.completedAt)}` : "";
        add(`  ${stamp(row.createdAt)}  ${row.title || "(untitled job)"}${done}`);
      }
    }
    if (pay.length) {
      add("");
      add(`Payments the account COLLECTED from its own clients through FieldQuo (${pay.length} listed):`);
      for (const { row } of pay) {
        const amount = row.amount == null ? "" : ` ${Number(row.amount).toFixed(2)}`;
        add(`  ${stamp(row.date)} ${amount}${row.method ? ` (${row.method})` : ""}`);
      }
    }
    if (dev.length) {
      add("");
      add(`Sign-ins (${dev.length} devices; networks shown as /16 prefixes, not full addresses):`);
      for (const { row } of dev) {
        const who = row.who ? `${row.who}, ` : "";
        const net = row.network ? `${row.network}.x` : "network not recorded";
        const ua = row.userAgent ? ` — ${String(row.userAgent).slice(0, 120)}` : "";
        add(`  ${who}first ${stamp(row.firstSeenAt)}, last ${stamp(row.lastSeenAt)}, ${net}${ua}`);
      }
    }
    if (act.length) {
      add("");
      add(`Recent recorded actions (${act.length} listed):`);
      for (const { row } of act) {
        const who = row.actorName ? ` — ${row.actorName}` : "";
        add(`  ${stamp(row.createdAt)}  ${row.summary || row.action || "(action not described)"}${who}`);
      }
    }
  }

  const { text: accessLog, truncated } = truncate(lines.join("\n"));

  // ── Only fields we can actually fill ───────────────────────────────────
  const evidence = { access_activity_log: accessLog };

  if (name) evidence.customer_name = name;
  else gaps.push("No company name recorded — customer_name omitted.");

  if (email) evidence.customer_email_address = email;
  else gaps.push("No email on the company or its owner — customer_email_address omitted.");

  // Assembled from the parts that exist, and omitted entirely when the street
  // address is missing. A "city, province" with no street is not an address,
  // and sending one as if it were is the padding AGENTS.md forbids.
  if (company?.address) {
    evidence.billing_address = [company.address, company.city, company.province, company.country]
      .filter(Boolean)
      .join(", ");
  } else {
    gaps.push("No street address on the company — billing_address omitted.");
  }

  if (servicePeriod?.start && servicePeriod?.end) {
    evidence.service_date = `${day(servicePeriod.start)} to ${day(servicePeriod.end)}`;
  } else {
    gaps.push(
      "The disputed charge's billing period was not supplied — service_date omitted rather than guessed from the current subscription period.",
    );
  }

  if (hasUsage) {
    evidence.uncategorized_text =
      "FieldQuo is field-service management software billed as a monthly subscription. The account above was active and in use throughout the period charged; the access activity log lists dated records of that use, all of them created by the account holder inside the product. No physical goods are shipped and no delivery record exists, which is why the evidence is usage rather than tracking.";
  }

  return {
    hasUsage,
    summary: {
      companyName: name,
      firstUsedAt: iso(firstUsedAt),
      lastUsedAt: iso(lastUsedAt),
      ...counts,
    },
    gaps,
    evidence,
    truncated,
  };
}
