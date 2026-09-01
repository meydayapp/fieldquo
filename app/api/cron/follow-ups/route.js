// app/api/cron/follow-ups/route.js
//
// Vercel Cron hits this on a schedule (same CRON_SECRET pattern as
// large-quote-check) and executes every active FollowUpRule: for each,
// find entities that crossed the rule's trigger + delay and haven't
// already gotten this rule's email (FollowUpLog dedupe), render the
// rule's template, send it, and log it.
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
import { resolveSender } from "@/lib/email/companySender";
import {
  renderTemplateSections,
  renderSubject,
} from "@/lib/email/renderTemplateSections";
import { getAppOrigin } from "@/lib/appUrl";
import { ensurePortalToken, portalInvoiceUrl } from "@/lib/clientPortal";
import { ensureSubscriber, unsubscribeHeaders } from "@/lib/marketing/unsubscribe";
import { TRIGGER_META } from "@/lib/followUps/triggers";

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

async function findQuoteNoResponse(rule) {
  const excluded = await alreadySentEntityIds(rule.id);
  return db.quote.findMany({
    where: {
      companyId: rule.companyId,
      status: "sent",
      sentAt: { not: null, lte: cutoffFor(rule) },
      ...(excluded.length > 0 && { id: { notIn: excluded } }),
    },
    include: { client: true, company: true },
  });
}

async function findInvoiceOverdue(rule) {
  const excluded = await alreadySentEntityIds(rule.id);
  return db.invoice.findMany({
    where: {
      companyId: rule.companyId,
      status: { in: ["sent", "overdue"] },
      dueDate: { not: null, lte: cutoffFor(rule) },
      ...(excluded.length > 0 && { id: { notIn: excluded } }),
    },
    include: { client: true, company: true },
  });
}

async function findJobCompleted(rule) {
  const excluded = await alreadySentEntityIds(rule.id);
  return db.job.findMany({
    where: {
      companyId: rule.companyId,
      status: "completed",
      completedAt: { not: null, lte: cutoffFor(rule) },
      ...(excluded.length > 0 && { id: { notIn: excluded } }),
    },
    include: { client: true, company: true },
  });
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "";
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Quote.lineItems / Invoice.lineItems are untyped `Json?` columns, so the key
// names vary depending on which screen wrote them. Normalise to the shape the
// "Itemized list" block expects, and drop anything unrecognisable rather than
// rendering a row of blanks.
function normalizeLineItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const name = item.name || item.description || item.title || "";
      if (!name) return null;
      const quantity = Number(item.quantity ?? item.qty ?? 1);
      const unitPrice = Number(item.unitPrice ?? item.price ?? item.rate);
      const total = Number(
        item.total ??
          item.amount ??
          (Number.isFinite(unitPrice) ? unitPrice * quantity : NaN),
      );
      return {
        name,
        quantity: Number.isFinite(quantity) ? quantity : null,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
        total: Number.isFinite(total) ? total : null,
      };
    })
    .filter(Boolean);
}

// Which project-lifecycle stage a follow-up is sent at. Mirrors
// LIFECYCLE_STAGES in app/data/emailTemplateBlocks.js:
//   0 Quote · 1 Deposit & scheduling · 2 Project start · 3 Project complete
function stageFor(entityType, entity) {
  if (entityType === "quote") return 0;
  if (entityType === "invoice") {
    return Number(entity.amountPaid || 0) > 0 ? 1 : 0;
  }
  if (entityType === "job") {
    return entity.status === "completed" ? 3 : 2;
  }
  return 0;
}

// `portalToken` is resolved by the caller, not looked up here, so this stays
// synchronous and pure. It is the client's portal token — minting one is a
// WRITE, and a write does not belong inside a formatter.
function mergeDataFor(entityType, entity, request, portalToken) {
  const base = {
    clientName: entity.client?.contactName || entity.client?.name || "",
    clientAddress: entity.client?.address || "",
    clientPhone: entity.client?.phone || "",
    companyName: entity.company?.name || "",
    companyPhone: entity.company?.phone || "",
    companyEmail: entity.company?.email || "",
    progressStage: stageFor(entityType, entity),
    lineItems: normalizeLineItems(entity.lineItems),
    subtotal: money(entity.subtotal),
    discount: money(entity.discount),
    tax: money(entity.tax),
  };
  if (entityType === "quote") {
    return {
      ...base,
      quoteNumber: entity.quoteNumber,
      quoteTotal: money(entity.total),
      jobTitle: entity.quoteType || "",
      quoteUrl: entity.shareToken
        ? `${getAppOrigin(request)}/q/${entity.shareToken}`
        : "",
    };
  }
  if (entityType === "invoice") {
    const balanceDue = Number(entity.total || 0) - Number(entity.amountPaid || 0);
    return {
      ...base,
      invoiceNumber: entity.invoiceNumber,
      invoiceTotal: money(entity.total),
      amountPaid: money(entity.amountPaid),
      balanceDue: money(balanceDue),
      dueDate: entity.dueDate
        ? new Date(entity.dueDate).toLocaleDateString()
        : "",
      // The default "Payment received" template ships a "View your invoice"
      // button whose url is {{invoiceUrl}}, and nothing had ever supplied it.
      // mergeIntoAttr resolves an unknown token to "", so that button rendered
      // with an EMPTY href — a link to nowhere, in a homeowner's inbox, under
      // the contractor's brand. Deep-linked to the invoice rather than the
      // portal home for the reason portalInvoiceUrl's own comment gives: a
      // client landing on a list has to hunt for the thing they came to pay.
      invoiceUrl: portalToken ? portalInvoiceUrl(portalToken, entity.id, request) : "",
      projectStartDate: entity.startDate
        ? new Date(entity.startDate).toLocaleDateString()
        : "",
      projectEndDate: entity.endDate
        ? new Date(entity.endDate).toLocaleDateString()
        : "",
    };
  }
  if (entityType === "job") {
    return { ...base, jobTitle: entity.title };
  }
  return base;
}

const FINDERS = {
  quote_no_response: { entityType: "quote", find: findQuoteNoResponse },
  invoice_overdue: { entityType: "invoice", find: findInvoiceOverdue },
  job_completed: { entityType: "job", find: findJobCompleted },
};

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const rules = await db.followUpRule.findMany({
    where: { active: true },
    include: { template: true },
  });

  let sent = 0;
  let skippedNoTemplate = 0;
  let skippedNoEmail = 0;
  let skippedUnsubscribed = 0;

  for (const rule of rules) {
    const finder = FINDERS[rule.triggerEvent];
    if (!finder || !rule.template) {
      if (!rule.template) skippedNoTemplate++;
      continue;
    }

    const entities = await finder.find(rule);
    for (const entity of entities) {
      const to = entity.client?.email;
      if (!to) {
        skippedNoEmail++;
        continue;
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
      const mergeData = mergeDataFor(finder.entityType, entity, request, portalToken);
      const html = renderTemplateSections(rule.template.sections, mergeData, {
        company: entity.company || {},
        theme: rule.template.theme || null,
        ...(unsubscribeToken && { unsubscribe: { token: unsubscribeToken, request } }),
      });

      await sendEmail({
        to,
        // template.name is the internal label ("Quote follow-up (default)") —
        // only fall back to it if no client-facing subject is set.
        subject: renderSubject(
          rule.template.subject,
          mergeData,
          rule.template.name,
        ),
        html,
        // Sends from the company's own verified domain when it has one,
        // otherwise FieldQuo's shared domain under the company's name.
        // Replies go to the company's inbox, falling back to the account
        // owner's email so a reply is never silently lost.
        ...(await resolveSender(entity.company || {}, entity.companyId)),
        ...(unsubscribeToken && unsubscribeHeaders({ token: unsubscribeToken, request })),
      });
      sent++;
    }
  }

  return NextResponse.json({ success: true, sent, skippedNoTemplate, skippedNoEmail, skippedUnsubscribed });
}
