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
import { clientFacingGaps, PROFILE_READINESS_SELECT } from "@/lib/company/profileReadiness";
import { computeAvailableSlots } from "@/lib/booking/computeAvailability";
import { schedulePhrases } from "@/lib/i18n/autoTranslateSchedule";

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

  // The company's own answer, not a hardcoded hour. A 15-minute quote call and a
  // two-hour kitchen measure are both "a visit"; assuming 60 made every trade
  // book like the same trade.
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { defaultVisitMinutes: true },
  });

  const created = await db.eventType.create({
    data: {
      companyId,
      userId,
      name: `Consultation with ${name || "our team"}`,
      slug,
      durationMinutes: company?.defaultVisitMinutes || 60,
      active: true,
      // No label. This wrote "Phone or on-site visit", and the booking page
      // printed it as if it were information — the owner booked one and could
      // not tell which he had booked. The mode is a Booking column the client
      // chooses, and lib/booking/bookingModes.js has its words in the client's
      // language; a free-text string here is the one thing no surface should
      // ever print again.
      location: null,
    },
  });

  // The name is printed to the homeowner — the /book menu, the confirmation
  // letter and text, the manage page — in THEIR language, so it is drafted
  // into the other document languages like a name the company typed (lib/i18n/
  // phrases.js). Source "en" because this literal IS English whatever the
  // company's default is. Best-effort: every caller is a request (the
  // availability routes, the public members list, the availability-apply
  // cron), but after() throws outside one, and a missing draft only means the
  // English name is printed — never a failed booking setup.
  try {
    schedulePhrases({ companyId, ns: "eventTypeName", texts: [created.name], sourceLanguage: "en" });
  } catch (err) {
    console.error("[booking] consultation name not queued for translation:", err?.message);
  }
  return created;
}

/**
 * The bookable members for a company, each with their consultation event slug
 * and (best-effort) next available slot. Ensures the event type exists so a
 * member with availability is immediately bookable.
 */
/**
 * The estimator gate, as one predicate both readers share.
 *
 * Extracted so hasBookableMember() below cannot drift from
 * listBookableMembers() — "can a homeowner book themselves" and "who can they
 * book" have to be the same question, or a follow-up text offers a booking
 * link to a page with nobody on it.
 *
 * `scheduleCount` is passed in rather than read here so the batch check can
 * count once for every candidate instead of once per member.
 */
export function memberIsBookable(member, scheduleCount) {
  if (!member?.userId) return false;
  if (!can(member.role, "quote:create")) return false; // estimator gate
  return Number(scheduleCount) > 0; // setting your hours is how you opt in
}

/**
 * Can a homeowner actually book this company themselves?
 *
 * ── Three conditions, and the slug is only one of them ───────────────────
 *
 * A follow-up that offers a booking link must not offer one that 404s, so
 * this asks what the PAGE asks, not what looks plausible:
 *
 *   1. a resolvable slug — bookingSlug or slug (findBookingCompany prefers
 *      the first and falls back to the second, so either will do);
 *   2. a complete enough public profile — findBookingCompany returns null
 *      for a company with no name or country (lib/company/profileReadiness.js),
 *      so /book/<slug> is a 404 for it however good the slug is;
 *   3. at least one bookable member. NOT "at least one active EventType":
 *      the consultation EventType is created LAZILY the first time the
 *      members endpoint is read (ensureConsultationEventType above), so a
 *      company that is perfectly bookable can have zero EventType rows, and
 *      a company with a stale active EventType and nobody on availability has
 *      a page that lists nothing. Counting EventTypes would get both wrong in
 *      opposite directions.
 *
 * @returns {Promise<{ ok: boolean, reason: string, slug: string|null }>}
 */
export async function hasBookableMember(companyId) {
  if (!companyId) return { ok: false, reason: "no_company", slug: null };
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { bookingSlug: true, slug: true, ...PROFILE_READINESS_SELECT },
  });
  if (!company) return { ok: false, reason: "no_company", slug: null };

  const slug = String(company.bookingSlug || company.slug || "").trim() || null;
  if (!slug) return { ok: false, reason: "no_slug", slug: null };
  if (clientFacingGaps(company).length > 0) return { ok: false, reason: "profile_incomplete", slug };

  const members = await db.member.findMany({
    where: { companyId, active: true },
    select: { role: true, userId: true },
  });
  const userIds = members.filter((m) => m.userId && can(m.role, "quote:create")).map((m) => m.userId);
  if (!userIds.length) return { ok: false, reason: "no_estimator", slug };

  // One count for all of them, then the shared predicate per member — so this
  // and listBookableMembers answer with the same rule.
  const schedules = await db.availabilitySchedule.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true },
  });
  const perUser = new Map();
  for (const s2 of schedules) perUser.set(s2.userId, (perUser.get(s2.userId) || 0) + 1);
  const bookable = members.some((m) => memberIsBookable(m, perUser.get(m.userId) || 0));
  if (!bookable) return { ok: false, reason: "no_availability", slug };

  return { ok: true, reason: "ok", slug };
}

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
    const scheduleCount = m.userId
      ? await db.availabilitySchedule.count({ where: { userId: m.userId } })
      : 0;
    // The shared predicate, so this list and hasBookableMember() above can
    // never disagree about who is bookable.
    if (!memberIsBookable(m, scheduleCount)) continue;

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
