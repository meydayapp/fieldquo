// lib/jobs/planPayload.js
//
// The plan as the job page and the harness read it — every step with its
// blockers, materials, clocked hours and derived status. Shared by
// GET /api/jobs/[id]/plan and the two POST actions on the same route, which
// each return the fresh plan after writing so the panel never renders a
// stale order beside a saved one.

import { db } from "@/lib/db";
import { hasLevel } from "@/lib/permissions/enforce";
import { can } from "@/lib/permissions";
import { orderPlan, planStatus, planSummary, clockedByTask } from "@/lib/jobs/plan";
import { changeOrderLabel } from "@/lib/jobs/changeOrderAddendum";

export const PLAN_JOB_SELECT = {
  id: true,
  title: true,
  quoteId: true,
  startDate: true,
  endDate: true,
  quote: { select: { id: true, quoteNumber: true, acceptedAt: true, client: { select: { name: true } } } },
  company: { select: { timezone: true } },
};

const STEP_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  sortOrder: true,
  estimatedHours: true,
  quoteLineKey: true,
  quoteLineNo: true,
  categoryKey: true,
  materialKeys: true,
  waitingReason: true,
  waitingOnChangeOrderId: true,
  clientVisible: true,
  scheduledStart: true,
  scheduledEnd: true,
  sourceKey: true,
  requiredPhotoCount: true,
  requiresComment: true,
  completionComment: true,
  createdAt: true,
  assignedToId: true,
  assignedTo: { select: { id: true, name: true } },
  dependsOn: { select: { dependsOn: { select: { id: true, title: true, status: true } } } },
  photos: { select: { id: true, url: true, stage: true, createdAt: true }, orderBy: { createdAt: "asc" } },
  _count: { select: { photos: true } },
};

/**
 * @param job     a row shaped by PLAN_JOB_SELECT
 * @param member  { companyId, role, permissions } — the enforceable member,
 *                for the three "may I" flags the panel draws its buttons from
 */
export async function buildPlanPayload(job, member) {
  const [steps, materials, entries, changeOrders, memberRows] = await Promise.all([
    db.task.findMany({ where: { jobId: job.id, planStep: true }, select: STEP_SELECT }),
    db.jobMaterial.findMany({
      where: { jobId: job.id },
      select: { id: true, name: true, qty: true, unit: true, purchasedAt: true, materialKey: true, categoryKey: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.timeEntry.findMany({
      where: { jobId: job.id },
      select: { taskId: true, hours: true, clockOut: true },
    }),
    db.changeOrder.findMany({
      where: { jobId: job.id },
      select: { id: true, seq: true, createdAt: true, status: true, description: true },
    }),
    // Everyone active on the team, for the assignee picker — the same roster
    // GET /api/settings/members hands the visit form.
    db.member.findMany({
      where: { companyId: member.companyId, active: true },
      select: { userId: true, user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const clocked = clockedByTask(entries);
  const coById = new Map(changeOrders.map((c) => [c.id, { ...c, label: changeOrderLabel(c, changeOrders) }]));

  const rows = orderPlan(steps).map((s) => {
    const blockers = (s.dependsOn || []).map((d) => d.dependsOn).filter(Boolean);
    const co = s.waitingOnChangeOrderId ? coById.get(s.waitingOnChangeOrderId) || null : null;
    const derived = planStatus(s, blockers, co);
    const mats = s.materialKeys?.length
      ? materials.filter((m) => m.materialKey && s.materialKeys.includes(m.materialKey) && (!s.categoryKey || !m.categoryKey || m.categoryKey === s.categoryKey))
      : [];
    const { dependsOn: _d, _count, ...rest } = s;
    return {
      ...rest,
      estimatedHours: s.estimatedHours == null ? null : Number(s.estimatedHours),
      clockedHours: clocked.perTask.get(s.id) || 0,
      photoCount: _count?.photos || 0,
      dependsOn: blockers.map((b) => ({ id: b.id, title: b.title, status: b.status })),
      planStatus: derived.status,
      waitingOn: derived.waitingOn,
      waitingOnChangeOrder: co ? { id: co.id, label: co.label, status: co.status } : null,
      materials: mats.map((m) => ({
        id: m.id,
        name: m.name,
        qty: Number(m.qty),
        unit: m.unit,
        purchased: Boolean(m.purchasedAt),
      })),
      // Set when this step came from a change order the client approved.
      fromChangeOrder: s.sourceKey?.startsWith("change_order_approved:")
        ? coById.get(s.sourceKey.slice("change_order_approved:".length)) || null
        : null,
    };
  });

  const summary = planSummary(rows);
  return {
    job: {
      id: job.id,
      title: job.title,
      startDate: job.startDate,
      endDate: job.endDate,
      quoteNumber: job.quote?.quoteNumber || null,
      acceptedAt: job.quote?.acceptedAt || null,
      clientName: job.quote?.client?.name || null,
      timezone: job.company?.timezone || null,
    },
    steps: rows,
    summary: { ...summary, clockedHours: clocked.total },
    members: memberRows.filter((m) => m.user).map((m) => ({ id: m.user.id, name: m.user.name })),
    canEdit: hasLevel(member, "jobs", "view_create_edit"),
    canAssign: can(member.role, "task:assign"),
    canCreate: can(member.role, "task:create"),
  };
}

