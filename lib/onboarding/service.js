// lib/onboarding/service.js
//
// The database half of onboarding: the lazily-created default template,
// starting a run, and reconciling a run against the person's file after
// anything on that file changes. The decisions are in lib/onboarding/run.js
// and lib/onboarding/defaultTemplate.js (pure); this file is the reads,
// the writes, and the notifications that follow a write.
import { defaultTemplateFor } from "@/lib/onboarding/defaultTemplate";
import { openItems, reconcile, runPatch, checkHandIn, attachHandIn } from "@/lib/onboarding/run";
import { notifyWorker, notifyManagers } from "@/lib/hr/notify";
import { parseWorkerDocumentBody, WORKER_DOCUMENT_SELECT } from "@/lib/hr/documents";

const TEMPLATE_SELECT = { id: true, name: true, items: true, isDefault: true, archivedAt: true, createdAt: true, updatedAt: true };
export const RUN_SELECT = { id: true, workerId: true, templateId: true, items: true, startedAt: true, completedAt: true, startedById: true };

/**
 * The company's templates — and, the first time, the default one.
 *
 * Created here rather than by a migration: only a company that opens the
 * onboarding screen (or invites somebody with the checklist ticked) gets
 * one. The country decides the tax-form items (lib/onboarding/
 * defaultTemplate.js). A company that later archives every template gets
 * no new default — "we deleted it" and "we never had one" are different.
 */
export async function ensureTemplates(db, companyId) {
  const existing = await db.onboardingTemplate.findMany({
    where: { companyId },
    select: TEMPLATE_SELECT,
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (existing.length > 0) return existing;

  const company = await db.company.findUnique({ where: { id: companyId }, select: { country: true, address: true, province: true } });
  const seed = defaultTemplateFor(company || {});
  const created = await db.onboardingTemplate.create({
    data: { companyId, name: seed.name, items: seed.items, isDefault: true },
    select: TEMPLATE_SELECT,
  });
  return [created];
}

/** The template a new run uses when none is named: the default, else the
 *  oldest live one. */
export async function pickTemplate(db, companyId, templateId = null) {
  if (templateId) {
    return db.onboardingTemplate.findFirst({ where: { id: templateId, companyId, archivedAt: null }, select: TEMPLATE_SELECT });
  }
  const templates = (await ensureTemplates(db, companyId)).filter((t) => !t.archivedAt);
  return templates.find((t) => t.isDefault) || templates[0] || null;
}

/**
 * Start a run for a worker. Idempotent per open run: a worker already on
 * an unfinished checklist is not given a second one — the existing one is
 * returned with `created: false`.
 */
export async function startRun(db, { companyId, worker, templateId = null, actorUserId = null }) {
  const open = await db.onboardingRun.findFirst({
    where: { companyId, workerId: worker.id, completedAt: null },
    select: RUN_SELECT,
  });
  if (open) return { run: open, created: false };

  const template = await pickTemplate(db, companyId, templateId);
  if (!template) return { run: null, created: false, error: "This company has no onboarding checklist to start." };

  const run = await db.onboardingRun.create({
    data: {
      companyId,
      workerId: worker.id,
      templateId: template.id,
      items: openItems(template.items),
      startedById: actorUserId,
    },
    select: RUN_SELECT,
  });

  // Evidence that already exists — a licence filed last week — ticks its
  // item on day one rather than asking for it again.
  const reconciled = await reconcileRun(db, run, { companyId, actorUserId });

  // Day one, told now. The cron's day-one pass is for a run whose worker
  // had no login at the time; `dayOneNotifiedAt` stops the two doubling up.
  if (worker.userId) {
    await notifyWorker(
      worker,
      {
        companyId,
        type: "hr.onboarding.started",
        entityId: run.id,
        params: { count: reconciled.items.filter((it) => it.status !== "done").length },
        actorUserId,
      },
      { db },
    );
    await db.onboardingRun.update({ where: { id: run.id }, data: { dayOneNotifiedAt: new Date() } });
  }
  return { run: reconciled, created: true };
}

/** The evidence a run's items are checked against. */
export async function loadEvidence(db, { companyId, workerId }) {
  const [documents, acknowledgements, policies, taxForms] = await Promise.all([
    db.workerDocument.findMany({ where: { companyId, workerId }, select: { id: true, kind: true, archivedAt: true, createdAt: true } }),
    db.policyAcknowledgement.findMany({ where: { companyId, workerId }, select: { id: true, policyId: true, policyVersion: true, acknowledgedAt: true } }),
    db.companyPolicy.findMany({ where: { companyId }, select: { id: true, version: true } }),
    db.taxFormSubmission.findMany({ where: { companyId, workerId }, select: { id: true, formKind: true, submittedAt: true } }),
  ]);
  return { documents, acknowledgements, policies, taxForms };
}

/**
 * Re-derive one run's evidence items and write the difference, stamping
 * completion (or un-stamping it). Tells the managers on the first
 * completion. Returns the run as it now stands.
 */
export async function reconcileRun(db, run, { companyId, actorUserId = null, evidence = null }) {
  const ev = evidence || (await loadEvidence(db, { companyId, workerId: run.workerId }));
  const { items, changed } = reconcile(run.items, ev);
  const patch = runPatch(run, items);
  if (!changed && !("completedAt" in patch.data)) return run;

  const updated = await db.onboardingRun.update({ where: { id: run.id }, data: patch.data, select: RUN_SELECT });
  if (patch.justCompleted) await announceCompletion(db, updated, { companyId, actorUserId });
  return updated;
}

/** Every open run for a worker, reconciled. Called after a document, a
 *  signature or a form lands on their file. */
export async function reconcileRunsForWorker(db, { companyId, workerId, actorUserId = null }) {
  const runs = await db.onboardingRun.findMany({ where: { companyId, workerId, completedAt: null }, select: RUN_SELECT });
  if (runs.length === 0) return [];
  const evidence = await loadEvidence(db, { companyId, workerId });
  const out = [];
  for (const run of runs) out.push(await reconcileRun(db, run, { companyId, actorUserId, evidence }));
  return out;
}

/** The managers are told once per run, and the stamp says so. */
export async function announceCompletion(db, run, { companyId, actorUserId = null }) {
  if (run.completedNotifiedAt) return;
  const worker = await db.worker.findFirst({ where: { id: run.workerId, companyId }, select: { id: true, name: true } });
  await notifyManagers(
    { companyId, type: "hr.onboarding.completed", entityId: run.workerId, params: { workerName: worker?.name || "" }, actorUserId },
    { db },
  );
  await db.onboardingRun.update({ where: { id: run.id }, data: { completedNotifiedAt: new Date() } });
}

/**
 * A manager files a document or a signed form against one checklist item,
 * on the person's behalf (lib/onboarding/run.js attachHandIn). The file is
 * stored exactly as the Documents card stores it — a WorkerDocument holding
 * a private Cloudinary URL (uploadFile purpose "hr"), validated by the same
 * parseWorkerDocumentBody — so the two can never disagree about where a
 * person's ID lives. The document and the item's pointer are written in one
 * transaction: a filed TD1 the checklist doesn't know about is the
 * half-write this exists to avoid.
 *
 * Every lookup takes companyId from the caller's session; a run id from
 * another company is "Not found", never a write.
 *
 * @returns {{ document, run, worker }} or {{ error, status }}
 */
export async function handInForItem(db, { companyId, runId, key, body, cloudName, actorUserId = null }) {
  if (!companyId || typeof runId !== "string" || !runId) return { error: "Not found", status: 404 };
  const run = await db.onboardingRun.findFirst({ where: { id: runId, companyId }, select: RUN_SELECT });
  if (!run) return { error: "Not found", status: 404 };

  const check = checkHandIn(run.items, key, { sizeBytes: body?.sizeBytes, mimeType: body?.mimeType });
  if (check.error) return check;

  const worker = await db.worker.findFirst({ where: { id: run.workerId, companyId }, select: { id: true, name: true } });
  if (!worker) return { error: "Not found", status: 404 };

  const parsed = parseWorkerDocumentBody(
    {
      kind: check.kind,
      // The item's own wording when the browser sends no name: "Fill in the
      // provincial TD1" says which TD1 this is; "scan_0012.pdf" does not.
      title: typeof body?.title === "string" && body.title.trim() ? body.title : check.item.label,
      fileUrl: body?.fileUrl,
      sizeBytes: body?.sizeBytes,
      mimeType: body?.mimeType,
    },
    { cloudName, companyId, by: "manager" },
  );
  if (parsed.error) return parsed;

  const written = await db.$transaction(async (tx) => {
    const document = await tx.workerDocument.create({
      data: { ...parsed.data, companyId, workerId: worker.id, uploadedById: actorUserId },
      select: WORKER_DOCUMENT_SELECT,
    });
    // Re-read inside the transaction: the items are one Json column, and
    // writing back the copy read before the upload would drop a tick made
    // in between.
    const fresh = await tx.onboardingRun.findFirst({ where: { id: run.id, companyId }, select: RUN_SELECT });
    const attached = attachHandIn(fresh?.items, key, { documentId: document.id, at: document.createdAt });
    if (attached.error) throw Object.assign(new Error(attached.error), { status: attached.status });
    const patch = runPatch(fresh, attached.items);
    const updated = await tx.onboardingRun.update({ where: { id: run.id }, data: patch.data, select: RUN_SELECT });
    return { document, run: updated, justCompleted: patch.justCompleted };
  });

  if (written.justCompleted) await announceCompletion(db, written.run, { companyId, actorUserId });
  // The same file may complete an item on another open run — the ordinary
  // reconcile, as after any upload.
  await reconcileRunsForWorker(db, { companyId, workerId: worker.id, actorUserId });
  const final = await db.onboardingRun.findFirst({ where: { id: run.id, companyId }, select: RUN_SELECT });
  return { document: written.document, run: final || written.run, worker };
}

/**
 * The files the checklist rows point at, for the manager's screen: title,
 * when, and who filed it — a name, never a user id — and no URL: the row
 * links to /api/hr/documents/[id]/open (hrDocumentOpenPath). Only documents on
 * THIS worker's file in THIS company come back, whatever ids the items carry.
 */
export async function handInFiles(db, { companyId, workerId, runs }) {
  const ids = [...new Set((runs || []).flatMap((r) => (r.items || []).map((it) => it.documentId)).filter((x) => typeof x === "string" && x))];
  if (ids.length === 0) return {};
  const docs = await db.workerDocument.findMany({
    where: { id: { in: ids }, companyId, workerId },
    select: { id: true, title: true, createdAt: true, uploadedById: true, uploadedByKind: true, archivedAt: true },
  });
  const userIds = [...new Set(docs.map((d) => d.uploadedById).filter(Boolean))];
  const users = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  const out = {};
  for (const d of docs) {
    out[d.id] = {
      id: d.id,
      title: d.title,
      createdAt: d.createdAt,
      uploadedByKind: d.uploadedByKind,
      uploadedByName: (d.uploadedById && names.get(d.uploadedById)) || null,
      archivedAt: d.archivedAt,
    };
  }
  return out;
}
