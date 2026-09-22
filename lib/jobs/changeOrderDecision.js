// lib/jobs/changeOrderDecision.js
//
// What a change order's status change does to the job's PLAN. The one place —
// the staff PATCH, the client's signature and the send route all come through
// here, so "an approved change order adds its step" cannot be true on one
// door and false on another (AGENTS.md failure class #4).
//
// ── The rules ──────────────────────────────────────────────────────────────
//
// Against a STEP (ChangeOrder.taskId):
//   sent      → the step is put on hold: Task.waitingOnChangeOrderId = co.id,
//               and lib/jobs/plan.js reads it as "Waiting on your approval of
//               CO-2" until the client signs.
//   approved  → the hold is released and the change is written INTO the step:
//               the change order's title and body are appended to the step's
//               description, so the crew's phone says what changed.
//   rejected  → the hold is released; the step stays what it was.
//   pending   → (withdrawn by staff) the hold is released.
//
// Against a LINE, or nothing:
//   approved  → a NEW step is created, idempotently, through the same
//               sourceKey path "Schedule the job" uses
//               (change_order_approved:<id>) — so a client's double-tap on
//               Approve & sign cannot add two steps. It depends on the step
//               the changed line produced, when there is one: extra coats on
//               the hallway ceiling come after the hallway ceiling.
//   anything else → no step. A change order the client has not agreed to is
//               not work anyone is assigned.
//
// The schedule impact: an approved change order with scheduleDeltaDays moves
// Job.endDate by that many days when the job has one. The addendum told the
// client "finish moves to Wed Sep 23"; the job record then says the same.
// A job with no end date is not given one — that would be a date nobody
// chose.
//
// ── Best effort ────────────────────────────────────────────────────────────
//
// Every entry point returns and never throws: a plan edit that fails must not
// fail the client's approval, which is the record that matters. The status
// write itself is the caller's, in its own transaction.

import { db } from "@/lib/db";
import { fallbackAuthorId } from "@/lib/tasks/autoCreate";
import { planSourceKey } from "@/lib/jobs/plan";
import { changeOrderBodyText, changeOrderLabel } from "@/lib/jobs/changeOrderAddendum";

const CO_SELECT = {
  id: true,
  jobId: true,
  seq: true,
  createdAt: true,
  description: true,
  bodyHtml: true,
  taskId: true,
  quoteLineKey: true,
  scheduleDeltaDays: true,
  status: true,
  job: { select: { id: true, companyId: true, clientId: true, quoteId: true, endDate: true } },
};

/**
 * Apply the plan-side consequences of `status` for change order `id`.
 *
 * @param {string} changeOrderId
 * @param {"pending"|"waiting_client"|"approved"|"rejected"} status
 * @param {{ byUserId?: string|null, previousStatus?: string|null, db?: object }} [opts]
 *   previousStatus: the status BEFORE this change, so the finish-date shift
 *   happens once.
 * @returns {{ ok: boolean, taskId?: string|null, reason?: string }}
 */
export async function applyChangeOrderDecision(changeOrderId, status, { byUserId = null, previousStatus = null, db: prisma = db } = {}) {
  // The finish moves once, on the transition INTO approved. A row already
  // approved (a retried request, a second tab) must not move it again.
  const newlyApproved = status === "approved" && previousStatus !== "approved";
  try {
    const co = await prisma.changeOrder.findUnique({ where: { id: changeOrderId }, select: CO_SELECT });
    if (!co || !co.job) return { ok: false, reason: "not_found" };

    if (co.taskId) {
      if (status === "waiting_client") {
        await prisma.task.updateMany({ where: { id: co.taskId, jobId: co.jobId }, data: { waitingOnChangeOrderId: co.id } });
        return { ok: true, taskId: co.taskId };
      }
      // Any decision releases the hold. Only this change order's own hold:
      // a step can be waiting on a different, later change order.
      await prisma.task.updateMany({
        where: { id: co.taskId, jobId: co.jobId, waitingOnChangeOrderId: co.id },
        data: { waitingOnChangeOrderId: null },
      });
      if (status === "approved") {
        const task = await prisma.task.findFirst({ where: { id: co.taskId, jobId: co.jobId }, select: { description: true } });
        if (task) {
          const label = changeOrderLabel(co);
          const body = changeOrderBodyText(co.bodyHtml) || "";
          const stamp = [`${label} · ${co.description}`, body].filter(Boolean).join("\n");
          // Appended once: a re-applied approval (a retried request) must not
          // write the same paragraph twice under the step.
          const already = String(task.description || "").includes(`${label} · ${co.description}`);
          if (!already) {
            await prisma.task.update({
              where: { id: co.taskId },
              data: { description: [String(task.description || "").trim(), stamp].filter(Boolean).join("\n\n").slice(0, 4000) },
            });
          }
        }
        if (newlyApproved) await shiftEndDate(prisma, co);
      }
      return { ok: true, taskId: co.taskId };
    }

    if (status !== "approved") return { ok: true, taskId: null };

    const createdById = byUserId || (await fallbackAuthorId(co.job.companyId, prisma));
    if (!createdById) return { ok: false, reason: "no_author" };

    const sourceKey = planSourceKey.changeOrder(co.id);
    let step = await prisma.task.findUnique({ where: { sourceKey }, select: { id: true } });
    if (!step) {
      const last = await prisma.task.aggregate({ where: { jobId: co.jobId, planStep: true }, _max: { sortOrder: true } });
      try {
        step = await prisma.task.create({
          data: {
            companyId: co.job.companyId,
            title: co.description,
            description: changeOrderBodyText(co.bodyHtml) || null,
            createdById,
            sourceKey,
            clientId: co.job.clientId,
            quoteId: co.job.quoteId,
            jobId: co.jobId,
            planStep: true,
            clientVisible: true,
            sortOrder: (last?._max?.sortOrder ?? -1) + 1,
            quoteLineKey: co.quoteLineKey,
          },
          select: { id: true },
        });
        // After the line it changes, when that line has a step in this plan.
        if (co.quoteLineKey) {
          const parent = await prisma.task.findFirst({
            where: { jobId: co.jobId, planStep: true, quoteLineKey: co.quoteLineKey, NOT: { id: step.id } },
            select: { id: true },
          });
          if (parent) {
            await prisma.taskDependency.createMany({ data: [{ taskId: step.id, dependsOnId: parent.id }], skipDuplicates: true });
          }
        }
      } catch (err) {
        if (err?.code !== "P2002") throw err;
        step = await prisma.task.findUnique({ where: { sourceKey }, select: { id: true } });
      }
    }
    if (newlyApproved) await shiftEndDate(prisma, co);
    return { ok: true, taskId: step?.id || null };
  } catch (err) {
    console.error("[changeOrderDecision]", changeOrderId, status, "failed:", err?.message);
    return { ok: false, reason: err?.message || "failed" };
  }
}

/**
 * Move the job's finish by the agreed days. Only on a genuine transition into
 * approved (see `newlyApproved` above), and only when the job HAS a finish —
 * a job with no end date is not given one.
 */
async function shiftEndDate(prisma, co) {
  const days = Number(co.scheduleDeltaDays);
  if (!Number.isInteger(days) || days === 0 || !co.job?.endDate) return;
  const end = new Date(co.job.endDate);
  end.setDate(end.getDate() + days);
  await prisma.job.update({ where: { id: co.jobId }, data: { endDate: end } });
}
