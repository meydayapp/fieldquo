// app/api/cron/follow-ups/route.js
//
// Vercel Cron hits this on a schedule (same CRON_SECRET pattern as
// large-quote-check) and executes every active FollowUpRule: for each,
// find entities that crossed the rule's trigger + delay and haven't
// already gotten this rule's email (FollowUpLog dedupe), render the
// rule's template, send it, and log it.
//
// ── Two channels since 2026-11-02 ──────────────────────────────────────────
//
// Each rule carries a `channel`: "email" (every rule that existed before the
// column, and the default) or "sms". An SMS rule sends through
// lib/sms/followUpText.js and carries no DocumentTemplate — its wording is a
// message type on Settings › Messages, because a 160-character text cannot
// render an email template's blocks — and it answers to
// Company.followUpSmsOn, which is OFF until a company switches it on.
//
// Every reason a text did NOT go out is counted by reason in the response
// (`smsSkipped`), the way the email stop reasons already are. The three a
// person can fix — no mobile on the client, a STOP, the switch off — are
// decided BEFORE the FollowUpLog claim, so the one chase this rule gets at
// this lead is not spent on a send that never happened.
//
// job_completed keys off Job.completedAt, stamped once when the job first
// flips to completed and cleared if it's reopened. It used to use updatedAt
// as a proxy, which meant renaming a job three weeks later reset the clock on
// every follow-up attached to it. Jobs completed before that column existed
// have a null completedAt and are skipped rather than guessed at.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { recordSentEmail } from "@/lib/email/sentEmailHistory";
import { sendOutcome, reportQuoteNotDelivered } from "@/lib/email/sendFailure";
import { resolveSender } from "@/lib/email/companySender";
import { renderSubject } from "@/lib/email/renderTemplateSections";
import { ensurePortalToken } from "@/lib/clientPortal";
import { ensureSubscriber, unsubscribeHeaders } from "@/lib/marketing/unsubscribe";
import { TRIGGER_META, followUpChannel } from "@/lib/followUps/triggers";
import {
  buildBuiltInFollowUpEmail,
  buildBuiltInLeadEmail,
  builtInEntityType,
} from "@/lib/followUps/defaults";
// The second channel (2026-11-02). lib/followUps/triggers.js used to end with
// `FOLLOW_UP_CHANNEL = "email"` and a comment saying to widen it only when
// this route genuinely gained a channel; these three imports are that.
import { sendFollowUpText, followUpTextVerdict, FOLLOW_UP_TEXT_TYPE } from "@/lib/sms/followUpText";
import { preQuoteVideoFor } from "@/lib/followUps/preQuoteVideo";
import { quoteChaseBlocker, gatherQuoteChaseFacts } from "@/lib/followUps/stopConditions";
import { companyMaySend, quoteTaxReady } from "@/lib/followUps/readiness";
import { templateBody } from "@/lib/email/templateBody";
import { localizeTemplate } from "@/lib/email/templateTranslation";
import { translationsForSend } from "@/lib/email/templateTranslationStore";
import { mergeDataFor, followUpLanguage } from "@/lib/followUps/mergeData";
import { runCallbackRotation } from "@/lib/callbacks/build";
import { runPriceRequestReminders } from "@/lib/subRequests/server";
import { sendPriceRequestEmail } from "@/lib/subRequests/send";
import { getAppOrigin } from "@/lib/appUrl";
import { autoMessageGate } from "@/lib/clients/autoMessages";

function cutoffFor(rule) {
  const ms =
    rule.delayUnit === "hours"
      ? rule.delayValue * 60 * 60 * 1000
      : rule.delayValue * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

async function alreadySentEntityIds(ruleId) {
  const logs = await db.followUpLog.findMany({
    where: { ruleId },
    select: { entityId: true },
  });
  return logs.map((l) => l.entityId);
}

// ── Past jobs are never followed up ────────────────────────────────────────
//
// A job entered after the fact (POST /api/jobs/import) lands with a completed
// job, an accepted quote and a paid invoice carrying the REAL dates — all of
// them months old, all of them past every cutoff below on the first run. These
// finders have no time floor on purpose (a rule created today should catch up
// on last month), so the column is the only thing standing between a company
// that typed in its 2024 and forty "how did we do?" emails going out at 8am.
const NOT_HISTORICAL = { historicalImportedAt: null };

// ── An enquiry nobody has answered ────────────────────────────────────────
//
// The one finder that starts BEFORE a quote exists. status "new" is the
// column a person or the lifecycle flips the moment anything happens to the
// lead — a quote sent moves it to "contacted" (lib/quotes/quoteLifecycle.js),
// a hand-set status is anything but "new" — and quoteId is the second guard,
// so a lead someone converted but never sent is not chased either: the
// quote_no_response rule owns it from there.
//
// LeadRequest has no client relation and no historicalImportedAt (leads are
// never back-filled). The cron's shared code reads `entity.client.email` and
// `entity.client.name` for every entity type, so the lead's own columns are
// shaped into that slot rather than teaching four downstream sites a fifth
// shape — the lead IS the client here, before a Client row exists for them.
async function findLeadNoResponse(rule, channel = "email") {
  const excluded = await alreadySentEntityIds(rule.id);
  const leads = await db.leadRequest.findMany({
    where: {
      companyId: rule.companyId,
      status: "new",
      quoteId: null,
      // ── The column the CHANNEL needs ──────────────────────────────────
      //
      // This was `email: { not: null }` unconditionally, which was right
      // while email was the only channel and became a silent exclusion the
      // moment a rule could text: a homeowner who left a mobile and no
      // address — common on a phone-first lead form, and the whole reason
      // texting them is worth doing — was filtered out of the query before
      // anything could decide to text them. The other three finders need no
      // equivalent because they go through a Client row, which carries both.
      ...(channel === "sms" ? { phone: { not: null } } : { email: { not: null } }),
      createdAt: { lte: cutoffFor(rule) },
      ...(excluded.length > 0 && { id: { notIn: excluded } }),
    },
    include: { company: true, category: { select: { label: true } } },
  });
  return leads.map((lead) => ({
    ...lead,
    client: {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      // Where the job is lives inside the intake blob when the form asked
      // (lib/leads/intakeShape.js); the lead row has no address column.
      address: lead.intake?.address || "",
      // The language the homeowner filled the form in — the only language
      // this person has ever stated to the company (lib/followUps/mergeData.js).
      language: lead.language || null,
    },
  }));
}

// The scope groups a quote's lines live on, for the template's "Itemized
// list" block (lib/email/templateLineItems.js). A quote built in the builder
// stores its lines HERE, not on Quote.lineItems — reading only the quote row
// is what left the block empty on every real quote chase. Label and category
// for the group heading, lineItems and subtotal for the rows; nothing else
// (takeoff holds supplier cost on some trades and is never needed here).
const SCOPE_GROUPS_FOR_LINES = {
  orderBy: { sortOrder: "asc" },
  select: {
    id: true,
    label: true,
    sortOrder: true,
    subtotal: true,
    lineItems: true,
    category: { select: { key: true, label: true } },
  },
};

async function findQuoteNoResponse(rule) {
  const excluded = await alreadySentEntityIds(rule.id);
  return db.quote.findMany({
    where: {
      companyId: rule.companyId,
      status: "sent",
      sentAt: { not: null, lte: cutoffFor(rule) },
      ...NOT_HISTORICAL,
      ...(excluded.length > 0 && { id: { notIn: excluded } }),
    },
    include: { client: true, company: true, scopeGroups: SCOPE_GROUPS_FOR_LINES },
  });
}

async function findInvoiceOverdue(rule) {
  const excluded = await alreadySentEntityIds(rule.id);
  return db.invoice.findMany({
    where: {
      companyId: rule.companyId,
      status: { in: ["sent", "overdue"] },
      dueDate: { not: null, lte: cutoffFor(rule) },
      ...NOT_HISTORICAL,
      ...(excluded.length > 0 && { id: { notIn: excluded } }),
    },
    // The originating quote's groups give the invoice's flat lines their
    // trades back (lib/invoices/documentGroups.js) — the same bridge the
    // invoice document uses, so the chase groups the bill the way the bill
    // groups itself.
    include: {
      client: true,
      company: true,
      quote: { select: { scopeGroups: SCOPE_GROUPS_FOR_LINES } },
    },
  });
}

async function findJobCompleted(rule) {
  const excluded = await alreadySentEntityIds(rule.id);
  return db.job.findMany({
    where: {
      companyId: rule.companyId,
      status: "completed",
      completedAt: { not: null, lte: cutoffFor(rule) },
      ...NOT_HISTORICAL,
      ...(excluded.length > 0 && { id: { notIn: excluded } }),
    },
    include: { client: true, company: true },
  });
}

// The {{token}} values, the itemised block's lines and the progress stage
// live in lib/followUps/mergeData.js — pure, so a check can execute them
// against a CAD French quote and a EUR Spanish invoice rather than read this
// file. The local money() that printed "$" for every company in every
// language was there; it is gone, not wrapped.

const FINDERS = {
  lead_no_response: { entityType: "lead", find: findLeadNoResponse },
  quote_no_response: { entityType: "quote", find: findQuoteNoResponse },
  invoice_overdue: { entityType: "invoice", find: findInvoiceOverdue },
  job_completed: { entityType: "job", find: findJobCompleted },
};

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  // deletedAt: a FieldQuo default the company deleted is a tombstone, not a
  // paused rule — see the schema comment on FollowUpRule.deletedAt.
  const rules = await db.followUpRule.findMany({
    where: { active: true, deletedAt: null },
    include: { template: true },
  });

  let sent = 0;
  let failed = 0;
  let texted = 0;
  let skippedNoTemplate = 0;
  let skippedNoEmail = 0;
  let skippedUnsubscribed = 0;
  // An "sms" rule on a trigger with no SMS wording. The settings routes
  // refuse to save one, so this counts rules that got in before the refusal
  // existed or by another door — named rather than silently skipped.
  let skippedNoSmsWording = 0;
  // Per reason, the way `stopped` works below: lib/sms/followUpTextRules.js
  // FOLLOW_UP_TEXT_REASONS. "nothing went out" must never be reported as
  // "nothing was due".
  const smsSkipped = {};
  const smsSkip = (reason) => {
    smsSkipped[reason] = (smsSkipped[reason] || 0) + 1;
  };
  // Per stop reason, so the response says WHY nothing went out rather than
  // just that it didn't. Keys are lib/followUps/stopConditions.js's reasons
  // plus the two readiness gates.
  const stopped = {};
  const stop = (reason) => {
    stopped[reason] = (stopped[reason] || 0) + 1;
  };
  // One plan-gate answer per company per run — see lib/followUps/readiness.js.
  const planCache = new Map();
  // Each template's approved translations, read once per run.
  const translationCache = new Map();

  for (const rule of rules) {
    const finder = FINDERS[rule.triggerEvent];
    // FollowUpRule.channel, read through followUpChannel() so a value nobody
    // recognises degrades to email — the channel that has always worked —
    // rather than to silence or to an unasked-for text.
    const channel = followUpChannel(rule);
    // A hand-made rule with no template has nothing to send. A FieldQuo
    // default with no template sends the built-in wording in the client's
    // language (lib/followUps/defaults.js) — that is the normal state for it.
    const builtIn = Boolean(rule.builtInKey) && !rule.template;
    if (!finder) {
      if (!rule.template) skippedNoTemplate++;
      continue;
    }
    if (channel === "sms") {
      // An SMS rule's wording is a message type, not a DocumentTemplate, so
      // none of the three template checks below apply to it. What does apply
      // is that the trigger HAS wording: two of the four do
      // (lib/sms/followUpTextRules.js), and triggers.js says why the other
      // two don't.
      if (!FOLLOW_UP_TEXT_TYPE[rule.triggerEvent]) {
        skippedNoSmsWording++;
        continue;
      }
    } else {
      if (!rule.template && !builtIn) {
        skippedNoTemplate++;
        continue;
      }
      // The built-in wording is written for ONE entity — a quote for the
      // quote chases, an enquiry for the enquiry ones. A company that
      // re-pointed a default at another trigger keeps the trigger but must
      // pick a template. This was `finder.entityType !== "quote"`, which was
      // true while every built-in chased a quote and would have refused the
      // three enquiry defaults the day they were seeded.
      if (builtIn && builtInEntityType(rule.builtInKey) !== finder.entityType) {
        skippedNoTemplate++;
        continue;
      }
      // A template whose chosen body is an empty canvas has nothing to send
      // either — decided once per rule, before any quote is claimed, so an
      // empty canvas never "uses up" a (rule, quote) pair.
      if (!builtIn && templateBody(rule.template, {}, { company: {} }) === "") {
        skippedNoTemplate++;
        continue;
      }
    }

    // The channel reaches the finder because one of them narrows by it: a
    // lead row carries its own email and phone, and asking for an address on
    // a rule that texts would drop exactly the people worth texting.
    const entities = await finder.find(rule, channel);
    for (const entity of entities) {
      // ── Can this client be reached on THIS rule's channel? ───────────────
      //
      // An email rule needs an address; a text rule needs a mobile that has
      // not said STOP, and the company's follow-up-text switch on
      // (lib/sms/followUpText.js followUpTextVerdict re-reads it fresh from
      // the row). Every outcome is reported by reason — a client with no
      // mobile is not "nothing was due".
      //
      // Both checks sit BEFORE the FollowUpLog claim, for the same reason the
      // stop conditions do: each of these three is a state somebody can
      // change — add the number, reply START, flip the switch — and a claim
      // here would spend the one chase this rule ever gets at this entity on
      // a send that never happened.
      const to = channel === "sms" ? null : entity.client?.email;
      if (channel === "sms") {
        const verdict = await followUpTextVerdict({
          companyId: entity.companyId,
          phone: entity.client?.phone,
        });
        if (!verdict.send) {
          smsSkip(verdict.reason);
          continue;
        }
      } else if (!to) {
        skippedNoEmail++;
        continue;
      }

      // ── Stop conditions, before the claim ─────────────────────────────────
      //
      // Decided by lib/followUps/stopConditions.js so the settings page can
      // print the same list. Checked BEFORE the FollowUpLog claim on purpose:
      // every one of these reasons is a state the quote will stay in (accepted,
      // expired, re-quoted, replied), so there is nothing to "use up", and a
      // claim here would make a quote that expired on day 6 look, in the log,
      // like one that was chased.
      if (finder.entityType === "quote") {
        const blocker = quoteChaseBlocker({
          quote: entity,
          rule,
          facts: await gatherQuoteChaseFacts(db, entity),
        });
        if (blocker) {
          stop(blocker);
          continue;
        }
      }

      // ── The same two gates the quote's own send route holds ───────────────
      //
      // A company that never finished checkout does not get to send from the
      // cron what it may not send from the button, and a quote the send route
      // would refuse for an unresolved tax line is not chased either. Neither
      // is permanent — the company may pay, the client's address may be fixed
      // — so neither claims the log row.
      if (!(await companyMaySend(entity.companyId, planCache))) {
        stop("plan");
        continue;
      }
      if (finder.entityType === "quote" && !(await quoteTaxReady(db, entity, entity.company))) {
        stop("tax");
        continue;
      }

      // ── "No automatic emails or texts" on this client ─────────────────────
      //
      // lib/clients/autoMessages.js — the one gate every automatic sender
      // asks, which records the held-back chase on the client page. Before
      // the claim, like the two gates above: the switch is a state a person
      // can turn off again, and when they do the chase resumes rather than
      // having been used up. A lead has no client row to carry the switch.
      if (finder.entityType !== "lead") {
        const gate = await autoMessageGate(db, {
          companyId: entity.companyId,
          clientId: entity.clientId || entity.client?.id || null,
          sender: "follow_up",
          ref: { type: finder.entityType, id: entity.id },
          refLabel: entity.quoteNumber || entity.invoiceNumber || entity.title || null,
        });
        if (!gate.allowed) {
          stop(gate.reason);
          continue;
        }
      }

      try {
        // Claim this (rule, entity) pair first — the unique constraint
        // means a concurrent cron run can't double-send even if two
        // invocations overlap.
        await db.followUpLog.create({
          data: { ruleId: rule.id, entityType: finder.entityType, entityId: entity.id },
        });
      } catch {
        continue; // already logged (race or already handled) — skip silently
      }

      // ── The SMS channel: send, then stop ────────────────────────────────
      //
      // Placed immediately after the claim and ahead of everything below it,
      // because everything below it is email: the marketing unsubscribe
      // token (a text has no room for an unsubscribe link, which is one of
      // the two reasons the commercial trigger has no SMS wording at all —
      // see TRIGGER_META), the portal token, the template render, the
      // sender, and the kept copy in the email history. The text's own
      // record is the SmsDelivery row sendSms opens, filed under this
      // message type as its purpose, so the platform's SMS health page can
      // say which KIND of text a carrier is dropping.
      if (channel === "sms") {
        const language = followUpLanguage(finder.entityType, entity);
        // The SAME url expression the covering email's button uses, from the
        // one module that builds it: one link per document, or there are two
        // things to keep working and the second is the one that rots. Empty
        // for an enquiry — there is no quote yet, which is the trigger's
        // whole premise.
        const merge = mergeDataFor(finder.entityType, entity, request, null, language);
        const outcome = await sendFollowUpText({
          trigger: rule.triggerEvent,
          // Explicit, never read off the company row: the cron's four
          // finders include their company row differently, and
          // lib/sms/documentText.js's header records what reading
          // `company.id` cost when one of them didn't select it.
          companyId: entity.companyId,
          company: entity.company || {},
          client: entity.client,
          language,
          // What the homeowner asked about, for the enquiry chase. The
          // lead's own category label — null when the form captured none,
          // and the wording drops the clause rather than inventing one.
          service: finder.entityType === "lead" ? entity.category?.label || null : null,
          number: finder.entityType === "quote" ? entity.quoteNumber || null : null,
          quoteUrl: merge.quoteUrl || null,
          ref: { type: finder.entityType, id: entity.id },
          // A lead has no Client row yet — the cron shapes the lead itself
          // into the `client` slot, and it carries no id.
          clientId: entity.clientId || entity.client?.id || null,
        });
        if (outcome.texted) {
          texted++;
          continue;
        }
        smsSkip(outcome.reason);
        // ── The one claim that IS released ────────────────────────────────
        //
        // A card-free trial has not verified a mobile yet
        // (lib/trial/phoneGate.js). That is a company-level state fixed in a
        // minute on one screen — unlike a carrier refusing the number, which
        // the email path's own comment explains must NOT be retried hourly
        // forever. So this one claim goes back, and the lead is chased when
        // the company verifies. deleteMany, not delete: a row that somehow
        // isn't there must not throw mid-run.
        if (outcome.reason === "phone_unverified") {
          await db.followUpLog
            .deleteMany({ where: { ruleId: rule.id, entityId: entity.id } })
            .catch(() => {});
        }
        continue;
      }

      // Commercial only (job_completed — see TRIGGER_META in
      // lib/followUps/triggers.js for the classification and why): has this
      // person unsubscribed from this company's marketing mail?
      // ensureSubscriber also mints the row this send needs a token from —
      // most job_completed recipients have never been on this list, same as
      // a review-request recipient. Claimed above either way: an unsubscribed
      // recipient still "used up" this (rule, entity) pair, so the cron
      // doesn't re-evaluate them every hour forever — there's nothing that
      // will ever change the answer.
      let unsubscribeToken = null;
      if (TRIGGER_META[rule.triggerEvent]?.commercial) {
        const subscriber = await ensureSubscriber(db, {
          companyId: entity.companyId,
          email: to,
          name: entity.client?.contactName || entity.client?.name,
          source: "follow_up",
        });
        if (subscriber?.subscribed === false) {
          skippedUnsubscribed++;
          continue;
        }
        unsubscribeToken = subscriber?.unsubscribeToken || null;
      }

      // Minted here rather than inside mergeDataFor: it is a write, it is
      // idempotent, and it only runs for an invoice send that is already
      // committed to going out (the followUpLog claim above succeeded). A
      // client who never opens the link simply carries an unused token, which
      // is what ensurePortalToken already does for the invoice email.
      let portalToken = null;
      if (finder.entityType === "invoice") {
        portalToken = await ensurePortalToken(db, entity.clientId, entity.companyId).catch(
          () => null,
        );
      }
      // One language for the whole email — the tokens, the blocks' own words
      // and the built-in wording: the document's, else the client's
      // (lib/i18n/clientLanguage.js, through followUpLanguage).
      const language = followUpLanguage(finder.entityType, entity);
      const mergeData = mergeDataFor(finder.entityType, entity, request, portalToken, language);

      let subject;
      let html;
      let text;
      if (builtIn) {
        // `language` above is the client's language resolved exactly as the
        // quote email's was: the quote's own language first. Not the
        // company's, not English. For an enquiry it is the language the
        // homeowner filled the form in (LeadRequest.language) — the only
        // language this person has ever stated to the company.
        //
        // Two builders because the two chases are two letters: the quote one
        // is built around the button that opens the quote, the enquiry one
        // has no document to link to and asks for a time instead. One
        // builder taking an entity type would have had to decide what an
        // enquiry's "url" is, and the honest answer is that there isn't one.
        const built =
          finder.entityType === "lead"
            ? buildBuiltInLeadEmail({
                key: rule.builtInKey,
                client: entity.client,
                company: entity.company || {},
                service: entity.category?.label || null,
                // The company's pre-quote video, or nothing — read through
                // preQuoteVideoFor so a half-typed address cannot become a
                // dead link in a homeowner's inbox. No video, no section:
                // not a placeholder, not "video coming soon".
                videoUrl: preQuoteVideoFor(entity.company),
                language,
              })
            : buildBuiltInFollowUpEmail({
                key: rule.builtInKey,
                quote: entity,
                client: entity.client,
                company: entity.company || {},
                url: mergeData.quoteUrl,
                language,
              });
        subject = built.subject;
        html = built.html;
        text = built.text;
      } else {
        // The company's reviewed translation for `language` (the document's,
        // else the client's), or the template as written — read once per
        // template per run, never drafted here (lib/email/templateTranslation.js).
        if (!translationCache.has(rule.template.id)) {
          translationCache.set(rule.template.id, await translationsForSend(db, rule.template.id));
        }
        const { template } = localizeTemplate(
          rule.template,
          translationCache.get(rule.template.id),
          language,
          entity.company || null,
        );
        // templateBody renders whichever body the template says is sent —
        // its blocks or its canvas — and nothing else reads that column.
        html = templateBody(template, mergeData, {
          company: entity.company || {},
          // The words FieldQuo prints inside the blocks ("Quote", "Done",
          // the unsubscribe line) — company-typed text stays as written.
          language,
          ...(unsubscribeToken && { unsubscribe: { token: unsubscribeToken, request } }),
        });
        // template.name is the internal label ("Quote follow-up (default)") —
        // only fall back to it if no client-facing subject is set.
        subject = renderSubject(template.subject, mergeData, rule.template.name);
      }

      // Resolved once: the send and the kept copy name the same sender.
      const sender = await resolveSender(entity.company || {}, entity.companyId);
      const result = await sendEmail({
        // The quote/invoice's own company. A demo's follow-up cron still runs,
        // still writes its FollowUpLog, still stops on reply — it just never
        // chases a real homeowner on behalf of a company that doesn't exist.
        companyId: entity.companyId,
        to,
        subject,
        html,
        ...(text && { text }),
        // Sends from the company's own verified domain when it has one,
        // otherwise FieldQuo's shared domain under the company's name.
        // Replies go to the company's inbox, falling back to the account
        // owner's email so a reply is never silently lost.
        ...sender,
        ...(unsubscribeToken && unsubscribeHeaders({ token: unsubscribeToken, request })),
      });

      // ── The return value used to be thrown away ──────────────────────────
      //
      // `sent++` ran unconditionally on a result nobody read, and the
      // FollowUpLog row above had already been written — so a chase that
      // Resend refused was counted as delivered AND could never be retried.
      // A quote follow-up that failed this way was indistinguishable from one
      // the homeowner is ignoring, which is Manny Conto's loss with a cron
      // job's name on it.
      //
      // The claim is deliberately NOT rolled back. Retrying on the next run
      // would mean re-sending to a permanently undeliverable address every
      // hour forever; the fix is a person seeing the failure, which is what
      // the notification is for.
      const outcome = sendOutcome(result);
      if (outcome.ok) {
        sent++;
        // The chase as it went, for the History tab on the client and job
        // pages (lib/email/sentEmailHistory.js). Automatic: nobody sent it.
        // A lead's chase has no client page to keep it on, so it is not kept.
        const keptKind = { quote: "quote_follow_up", invoice: "reminder", job: "job_follow_up" }[finder.entityType];
        if (keptKind) await recordSentEmail(db, {
          companyId: entity.companyId,
          kind: keptKind,
          clientId: entity.clientId || entity.client?.id || null,
          jobId: finder.entityType === "job" ? entity.id : entity.jobId || null,
          quoteId: finder.entityType === "quote" ? entity.id : entity.quoteId || null,
          invoiceId: finder.entityType === "invoice" ? entity.id : null,
          mail: { to, subject, html, text, from: sender?.from || null, replyTo: sender?.replyTo || null },
          result,
          language,
        });
        continue;
      }
      failed++;
      // Only the QUOTE trigger raises a feed row today, because
      // "quote.undelivered" is the one type the catalog declares and a quote
      // nobody received is the failure that costs the job. An invoice or
      // job-completed chase that fails is counted here and recorded by
      // sendEmail's own recordError; giving each of them a feed row means
      // another catalog type and another translated sentence, and inventing
      // one now without the strings behind it would be a notification that
      // renders its own key at somebody.
      if (finder.entityType === "quote") {
        await reportQuoteNotDelivered({
          companyId: entity.companyId,
          quoteId: entity.id,
          quoteNumber: entity.quoteNumber || null,
          clientName: entity.client?.name || null,
          cause: outcome.cause,
          // No actor: a cron is nobody, so everyone eligible is told.
          actorUserId: null,
        });
      }
    }
  }

  // ── Past-client callback rotation ─────────────────────────────────────────
  //
  // Same 8am schedule, same secret: once a day, every company's CallbackRule
  // gets the chance to build this week's list (lib/callbacks/build.js — it
  // builds only on the rule's weekday and only once per week). Rides here
  // rather than on a cron of its own because Vercel's cron count is a
  // billed ceiling, and this is a lookup over the company's own client book,
  // not a send. Best-effort: a failure here must not fail the follow-ups
  // that already went out above.
  let callbacks = null;
  try {
    callbacks = await runCallbackRotation({ now: new Date() });
  } catch (err) {
    console.error("[follow-ups] callback rotation failed:", err?.message);
    callbacks = { error: err?.message || "failed" };
  }

  // ── The one reminder to a sub who hasn't answered a price request ─────────
  //
  // Same daily run, same reasoning as the callbacks above: a lookup and a few
  // sends, not worth a cron of its own. Each company sets the delay on the
  // Subcontractors page (Company.subRequestReminderDays; 0 = off). Never a
  // second reminder (lib/subRequests/model.js reminderDue).
  let priceRequestReminders = null;
  try {
    const origin = getAppOrigin(request);
    priceRequestReminders = await runPriceRequestReminders(db, {
      now: new Date(),
      send: (recipientId) => sendPriceRequestEmail({ recipientId, origin, reminder: true }),
    });
  } catch (err) {
    console.error("[follow-ups] price request reminders failed:", err?.message);
    priceRequestReminders = { error: err?.message || "failed" };
  }

  return NextResponse.json({
    success: true,
    sent,
    failed,
    texted,
    skippedNoTemplate,
    skippedNoEmail,
    skippedUnsubscribed,
    skippedNoSmsWording,
    smsSkipped,
    stopped,
    callbacks,
    priceRequestReminders,
  });
}
