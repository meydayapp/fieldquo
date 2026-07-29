// lib/booking/bookableMembers.js
//
// Who a homeowner can book on a company's site — the member-first layer over
// the existing EventType/availability engine.
//
// A team member is bookable when BOTH are true:
//   1. their role can quote (can(role, "quote:create")) — the estimator gate,
//      so a member who only does field work never appears as a consultation
//      option; and
//   2. they have set availability — the practical opt-in. Setting your hours is
//      how you say "yes, book me", exactly like Calendly.
//
// Each bookable member is backed by ONE default "Consultation" EventType tied
// to their user. That's the row Booking.eventTypeId points at and the object
// computeAvailableSlots already knows how to price a calendar from — so this
// reuses the whole existing slot/conflict engine instead of a second one.
// ensureConsultationEventType is idempotent, so a member who set availability
// before this feature becomes bookable the first time the list is read.

import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { computeAvailableSlots } from "@/lib/booking/computeAvailability";

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Find or create the member's single default consultation event. Idempotent. */
export async function ensureConsultationEventType(companyId, userId, name) {
  const existing = await db.eventType.findFirst({ where: { companyId, userId } });
  if (existing) {
    if (!existing.active) {
      return db.eventType.update({ where: { id: existing.id }, data: { active: true } });
    }
    return existing;
  }

  const base = `consult-${slugify(name) || userId.slice(0, 6)}`;
  let slug = base;
  let n = 1;
  // slug is unique per company — walk a suffix until it's free.
  while (await db.eventType.findFirst({ where: { companyId, slug } })) {
    slug = `${base}-${n++}`;
  }

  return db.eventType.create({
    data: {
      companyId,
      userId,
      name: `Consultation with ${name || "our team"}`,
      slug,
      durationMinutes: 60,
      active: true,
      location: "Phone or on-site visit",
    },
  });
}

/**
 * The bookable members for a company, each with their consultation event slug
 * and (best-effort) next available slot. Ensures the event type exists so a
 * member with availability is immediately bookable.
 */
export async function listBookableMembers(companyId, { withNextSlot = true } = {}) {
  const members = await db.member.findMany({
    where: { companyId, active: true },
    select: {
      id: true,
      role: true,
      userId: true,
      user: { select: { name: true } },
    },
  });

  const out = [];
  for (const m of members) {
    if (!m.userId) continue;
    if (!can(m.role, "quote:create")) continue; // estimator gate

    const scheduleCount = await db.availabilitySchedule.count({
      where: { userId: m.userId },
    });
    if (scheduleCount === 0) continue; // hasn't opted in

    const name = m.user?.name || "Team member";
    const eventType = await ensureConsultationEventType(companyId, m.userId, name);

    let nextSlot = null;
    if (withNextSlot) {
      try {
        const from = new Date();
        const to = new Date(from.getTime() + 21 * 24 * 60 * 60 * 1000);
        const byDate = await computeAvailableSlots({ eventType, fromDate: from, toDate: to });
        const firstDay = Object.keys(byDate).sort()[0];
        nextSlot = firstDay ? byDate[firstDay][0] : null;
      } catch {
        nextSlot = null;
      }
    }

    out.push({
      memberId: m.id,
      userId: m.userId,
      name,
      role: m.role,
      eventSlug: eventType.slug,
      durationMinutes: eventType.durationMinutes,
      nextSlot,
    });
  }

  // Members with an upcoming opening first; then by name for a stable order.
  return out.sort((a, b) => {
    if (Boolean(a.nextSlot) !== Boolean(b.nextSlot)) return a.nextSlot ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
