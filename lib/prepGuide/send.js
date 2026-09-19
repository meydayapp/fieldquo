// lib/prepGuide/send.js
//
// ONE email per job: the preparation guide, rendered, attached, sent from the
// company, filed on the job, stamped on the job, written to the activity
// trail. Called by the cron (app/api/cron/prep-guides) and by the job page's
// "Send now" (app/api/jobs/[id]/prep-guide), and by nothing else.
//
// ── The stamp is claimed BEFORE the send, the same as review requests ──────
//
// Job.prepGuideSentAt is written first, with a conditional update that only
// matches a null. Two overlapping cron runs, or a cron and a person clicking
// "Send now" in the same minute, cannot both mail the client. If the send
// then fails, the claim is RELEASED — the opposite trade from the review
// cron, on purpose: a review request asked twice costs the relationship,
// but a preparation guide never sent costs the job's first morning, and the
// worst case of releasing (Resend accepted the mail and then reported an
// error, so the client gets it twice) is a duplicate of something useful.
//
// A person's "Send again" passes force: true and skips the null check; that
// is an explicit human act on a job that says "sent on <date>" in front of
// them, and the page labels the button accordingly.
//
// ── Attachments ─────────────────────────────────────────────────────────────
//
// The guide PDF is always attached. Technical documents are attached in the
// office's order while the running total stays under ATTACHMENT_CAP_BYTES;
// the rest ride as links, which the guide and the email both already carry.
// Resend's own ceiling is 40 MB per message; the cap here is half that, so a
// company that attaches a 30 MB brochure still gets its guide delivered
// rather than a bounce nobody sees.
//
// ── Seams ───────────────────────────────────────────────────────────────────
//
// Every side effect is injectable (`deps`), and scripts/check-prep-guide.mjs
// drives this file with fakes: it proves the claim-before-send, the release
// on failure, the once-only, the skip reasons and the attachment cap without
// a database, a mailbox or Cloudinary.

import { loadPrepGuideJob, buildPrepGuide } from "@/lib/prepGuide/build";
import { prepGuideDecision } from "@/lib/prepGuide/schedule";
import { prepGuideCopy } from "@/lib/prepGuide/copy";

export const ATTACHMENT_CAP_BYTES = 20 * 1024 * 1024;

/** JobDocument.kind and .source for a filed guide. */
export const PREP_GUIDE_DOCUMENT_KIND = "prep_guide";
export const PREP_GUIDE_DOCUMENT_SOURCE = "prep_guide";

async function defaultRender(data) {
  const { renderPrepGuidePdf } = await import("@/lib/prepGuide/renderPdf");
  return renderPrepGuidePdf(data);
}
async function defaultEmail(data) {
  const { buildPrepGuideEmail } = await import("@/lib/prepGuide/email");
  return buildPrepGuideEmail(data);
}
async function defaultSend(payload) {
  const { sendEmail } = await import("@/lib/email/resend");
  return sendEmail(payload);
}
async function defaultSender(company, companyId) {
  const { resolveSender } = await import("@/lib/email/companySender");
  return resolveSender(company, companyId);
}
async function defaultFetchDocument(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
async function defaultUpload(buffer, { folder, publicId }) {
  const { uploadBuffer } = await import("@/lib/cloudinary");
  const uploaded = await uploadBuffer(buffer, { folder, publicId, resourceType: "raw" });
  return { url: uploaded?.secure_url || null, bytes: uploaded?.bytes ?? null };
}
async function defaultRecordError(payload) {
  const { recordError, errorDetail } = await import("@/lib/platform/errorLog");
  const { err, ...rest } = payload;
  return recordError({ ...rest, detail: errorDetail(err, rest.detail || {}) });
}
async function defaultRecordActivity(member, event) {
  const { recordActivity } = await import("@/lib/activity/log");
  return recordActivity(member, event);
}
async function defaultDb() {
  const { db } = await import("@/lib/db");
  return db;
}

function resolveDeps(deps) {
  return {
    db: deps.db || null,
    render: deps.render || defaultRender,
    email: deps.email || defaultEmail,
    send: deps.send || defaultSend,
    sender: deps.sender || defaultSender,
    fetchDocument: deps.fetchDocument || defaultFetchDocument,
    upload: deps.upload || defaultUpload,
    recordError: deps.recordError || defaultRecordError,
    recordActivity: deps.recordActivity || defaultRecordActivity,
    cloudName: deps.cloudName ?? process.env.CLOUDINARY_CLOUD_NAME,
    now: deps.now || (() => new Date()),
  };
}

const safeName = (s) => String(s || "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/**
 * Pure: which documents ride as attachments under the cap, in order.
 * `sizes` is a list of byte counts already known; unknown sizes are counted
 * as fetched. Returns the indexes to attach.
 */
export function planAttachments(documents, guideBytes, cap = ATTACHMENT_CAP_BYTES) {
  let total = guideBytes;
  const attach = [];
  for (let i = 0; i < documents.length; i++) {
    const size = Number(documents[i]?.sizeBytes);
    if (!Number.isFinite(size) || size <= 0) continue; // unknown size: link only
    if (total + size > cap) continue;
    total += size;
    attach.push(i);
  }
  return attach;
}

/**
 * @param jobId, companyId  the job
 * @param member   the person clicking, for the activity trail; null from the cron
 * @param force    resend even though prepGuideSentAt is set (a person's "Send again")
 * @returns {{ sent: boolean, reason: string, to?: string, documentId?: string, attached?: number }}
 */
export async function sendPrepGuide({ jobId, companyId, member = null, force = false }, deps = {}) {
  const d = resolveDeps(deps);
  const db = d.db || (await defaultDb());
  const now = d.now();

  const loaded = await loadPrepGuideJob(db, { jobId, companyId });
  if (!loaded) return { sent: false, reason: "no_job" };
  const { job } = loaded;

  const decision = prepGuideDecision({ job, company: job.company, client: job.client, now });
  // A person may send early ("not_yet"), on the start day ("started" is
  // only after it), or again ("already_sent" with force). Nobody may send
  // to a job with no client email or no start date — there is nothing to
  // say and nowhere to say it.
  const manualOverridable = new Set(["not_yet", "already_sent", "suppressed"]);
  if (!decision.send && !(force && manualOverridable.has(decision.reason))) {
    return { sent: false, reason: decision.reason };
  }

  // ── Claim ────────────────────────────────────────────────────────────────
  const claim = await db.job.updateMany({
    where: force ? { id: job.id } : { id: job.id, prepGuideSentAt: null },
    data: { prepGuideSentAt: now },
  });
  if (claim.count === 0) return { sent: false, reason: "already_sent" };

  const release = () => db.job.updateMany({ where: { id: job.id, prepGuideSentAt: now }, data: { prepGuideSentAt: job.prepGuideSentAt || null } });

  let data;
  let pdf;
  let mail;
  try {
    data = buildPrepGuide(loaded, { cloudName: d.cloudName });
    pdf = await d.render(data);
    if (!pdf?.length) throw new Error("renderer returned an empty document");
    mail = await d.email(data);
  } catch (err) {
    await release();
    await d.recordError({
      area: "prep_guide",
      code: "render_failed",
      message: `Could not build the preparation guide for job ${job.title}: ${err?.message || "unknown"}`,
      companyId,
      detail: { jobId },
      err,
    });
    return { sent: false, reason: "render_failed" };
  }

  // ── Attachments ──────────────────────────────────────────────────────────
  const attachments = [{ filename: `${safeName(data.copy.attachmentName)}.pdf`, content: pdf }];
  const plan = planAttachments(data.documents, pdf.length);
  let attached = 0;
  for (const i of plan) {
    const doc = data.documents[i];
    try {
      const content = await d.fetchDocument(doc.url);
      if (!content?.length) continue;
      attachments.push({ filename: `${safeName(doc.title) || "document"}.pdf`, content });
      attached++;
    } catch (err) {
      // A document that cannot be fetched is still linked; the guide goes.
      await d.recordError({
        area: "prep_guide",
        code: "document_fetch_failed",
        message: `Could not attach "${doc.title}" to the preparation guide; it was linked instead`,
        companyId,
        detail: { jobId, documentId: doc.id, url: doc.url },
        err,
      });
    }
  }

  // ── Send ─────────────────────────────────────────────────────────────────
  const { from, replyTo } = await d.sender(job.company, companyId);
  const to = String(job.client.email).trim();
  const result = await d.send({ companyId, to, subject: mail.subject, html: mail.html, text: mail.text, from, replyTo, attachments });
  if (!result || result.error || result.skipped) {
    await release();
    await d.recordError({
      area: "prep_guide",
      code: result?.skipped ? "email_unconfigured" : "send_failed",
      message: `The preparation guide for ${job.title} was not sent to ${to}: ${result?.skipped ? "email is not configured" : result?.error?.message || result?.error || "unknown"}`,
      companyId,
      detail: { jobId, to },
    });
    return { sent: false, reason: result?.skipped ? "email_unconfigured" : "send_failed" };
  }

  // ── File on the job ──────────────────────────────────────────────────────
  let documentId = null;
  try {
    const uploaded = await d.upload(pdf, {
      folder: `fieldquo/${companyId}/prep-guides`,
      publicId: `${job.id}-${now.getTime()}`,
    });
    if (uploaded?.url) {
      const head = await db.jobDocument.findFirst({
        where: { jobId: job.id, kind: PREP_GUIDE_DOCUMENT_KIND, supersededBy: { is: null } },
        orderBy: { uploadedAt: "desc" },
        select: { id: true },
      });
      const officeCopy = prepGuideCopy(job.company.defaultLanguage);
      const row = await db.jobDocument.create({
        data: {
          companyId,
          jobId: job.id,
          name: `${officeCopy.documentLabel} — ${data.startDateText}`,
          kind: PREP_GUIDE_DOCUMENT_KIND,
          url: uploaded.url,
          sizeBytes: Number.isInteger(uploaded.bytes) && uploaded.bytes > 0 ? uploaded.bytes : pdf.length,
          mimeType: "application/pdf",
          supersedesId: head?.id || null,
          uploadedById: member?.userId || null,
          source: PREP_GUIDE_DOCUMENT_SOURCE,
        },
        select: { id: true },
      });
      documentId = row.id;
    }
  } catch (err) {
    // The client has the guide; the office's copy failing to file is logged,
    // not fatal.
    await d.recordError({
      area: "prep_guide",
      code: "file_failed",
      message: `The preparation guide was sent but could not be filed on the job: ${err?.message || "unknown"}`,
      companyId,
      detail: { jobId },
      err,
    });
  }

  // ── Activity trail ───────────────────────────────────────────────────────
  await d.recordActivity(member || { companyId, actorName: null }, {
    action: "job.prep_guide_sent",
    entityType: "job",
    entityId: job.id,
    summary: `Preparation guide sent to ${to} for ${job.title}${member ? "" : " (scheduled)"}`,
    summaryKey: member ? "app.activity.event.prepGuideSent" : "app.activity.event.prepGuideSentScheduled",
    summaryParams: { email: to, job: job.title },
    metadata: { language: data.language, attached, documentId, force },
  });

  return { sent: true, reason: "sent", to, documentId, attached, language: data.language };
}
