// lib/costing/crew.js
//
// What a job's labour costs when more than one person does it.
//
// ── The arithmetic that was wrong ───────────────────────────────────────────
//
// The cost panel took ONE rate. A three-person crew therefore had to be
// expressed as a single number, and both ways of doing that are wrong:
//
//   161 hours × $25          — right total hours, but the supervisor is free
//   161 hours × 3 × $25      — triples a total that already counts every
//                              person's hours
//
// A real job: 7 days, 3 crew, ~161 man-hours between them. Two labourers at
// $25 and a supervisor at $35. The hours are a POOL that the crew shares —
// 161 ÷ 3 ≈ 53.67 each — and each person's share is costed at their own rate:
//
//   2 × 53.67 × $25 = $2,683.33
//   1 × 53.67 × $35 = $1,878.33
//                     ─────────
//                     $4,561.67
//
// Which is neither $4,025 nor $12,075.
//
// ── Why hours are per-person and overridable ────────────────────────────────
//
// An even split is the right DEFAULT and a poor assumption. A supervisor is
// often on site half the time, and an apprentice may only come for the base
// prep. So each member carries its own hours, seeded from the even split and
// editable; `totalHours` then reports what the crew actually adds up to rather
// than what was typed in the box above them.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const positive = (v) => {
  const n = num(v);
  return n > 0 ? n : 0;
};
// Finite-safe both ways: `num` catches NaN and Infinity, but 1e308 is finite
// right up until the ×100 the rounding needs, and then every total built on it
// is Infinity.
const round2 = (n) => {
  const r = Math.round(num(n) * 100) / 100;
  return Number.isFinite(r) ? r : 0;
};

/** A crew member with nothing filled in. */
export function newCrewMember(overrides = {}) {
  return { id: null, name: "", rate: 0, hours: null, ...overrides };
}

/**
 * Split a pool of hours across a crew.
 *
 * @param {number} totalHours  man-hours for the whole job, not per person
 * @param {Array}  crew        [{ name, rate, hours }] — `hours` null means
 *                             "take an even share of the pool"
 * @returns {{members:Array, totalHours:number, labourCost:number,
 *            blendedRate:number|null, evenShare:number, unratedCount:number}}
 */
export function crewLabourCost(totalHours, crew) {
  const list = Array.isArray(crew) ? crew.filter(Boolean) : [];
  const pool = positive(totalHours);

  if (list.length === 0) {
    return {
      members: [],
      totalHours: 0,
      labourCost: 0,
      blendedRate: null,
      evenShare: 0,
      unratedCount: 0,
    };
  }

  // Only members who have NOT been given explicit hours share the remaining
  // pool. Setting one person to 20 hours must not silently change what the
  // other two are assumed to have worked — it changes what is left to share.
  // "Set" means a real, finite, non-negative number. NaN and "" are NOT a
  // deliberate zero — they are a half-typed field, and reading them as zero
  // drops that person out of the split without removing them from the crew.
  const isSet = (v) =>
    v != null && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0;
  const explicit = list.filter((m) => isSet(m.hours));
  const sharing = list.filter((m) => !isSet(m.hours));
  const claimed = explicit.reduce((s, m) => s + positive(m.hours), 0);
  const remaining = Math.max(0, pool - claimed);
  const evenShare = sharing.length > 0 ? remaining / sharing.length : 0;

  const members = list.map((m) => {
    const hours = isSet(m.hours) ? positive(m.hours) : evenShare;
    const rate = positive(m.rate);
    return {
      ...m,
      hours: round2(hours),
      rate: round2(rate),
      cost: round2(hours * rate),
      // Flagged rather than guessed at. Somebody on the crew with no rate is
      // working for nothing in the arithmetic, and that understates the job.
      unrated: rate <= 0 && hours > 0,
    };
  });

  const labourCost = round2(members.reduce((s, m) => s + m.cost, 0));
  const hours = round2(members.reduce((s, m) => s + m.hours, 0));

  return {
    members,
    totalHours: hours,
    labourCost,
    // What one hour of this crew costs on average — the single number that
    // used to be the only input, now derived instead of assumed.
    blendedRate: hours > 0 ? round2(labourCost / hours) : null,
    evenShare: round2(evenShare),
    unratedCount: members.filter((m) => m.unrated).length,
  };
}

/**
 * The pool a crew's own hours add up to.
 *
 * A quote runs pool-first: a recipe predicts 161 man-hours and the crew shares
 * them. An invoice runs the other way — each person's hours are a fact off a
 * timesheet, so the pool is whatever they come to. Passing this back into
 * crewLabourCost gives every member explicit hours, nothing left to share, and
 * a total that equals the sum of the rows the user is looking at.
 *
 * A member left blank contributes nothing and, with no remainder to share,
 * ends up on zero hours. On a document about work that already happened that
 * reads correctly: nobody logged time for them.
 */
export function crewHoursPool(crew) {
  const list = Array.isArray(crew) ? crew.filter(Boolean) : [];
  return round2(list.reduce((sum, m) => sum + positive(m?.hours), 0));
}

/**
 * Seed a crew from the company's worker records.
 *
 * Workers with no hourly rate are included with a rate of 0 rather than
 * dropped: they are on the job, the estimator can see the gap, and silently
 * omitting someone is how a crew of three costs like a crew of two.
 */
export function crewFromWorkers(workers, ids) {
  const wanted = Array.isArray(ids) ? ids : [];
  const byId = new Map(
    (Array.isArray(workers) ? workers : []).map((w) => [w.id, w]),
  );
  return wanted
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((w) =>
      newCrewMember({
        id: w.id,
        name: w.name || w.fullName || "Crew member",
        rate: positive(w.hourlyRate),
      }),
    );
}
