// lib/services/newSeedNotice.js
//
// "N new services were added for your trade — review and add them": one
// in-app notification per existing company whose trades gained seeded
// services the company does not hold yet. The owner's ask, 2026-09-24: "A
// notification should be sent to the trades affected about the new services
// being added … in the language of the user."
//
// ── It TELLS, it never adds ────────────────────────────────────────────────
//
// Nothing here writes a Product. The count is exactly what "Add missing
// services for my trade" on Settings › Services would create
// (planServiceSeeds over serviceSeedsForCompanyTrade, the same two calls
// lib/products/seedServices.js makes) and the row links there; the company
// decides. Seeding a price book into somebody's catalogue unasked is a change
// to what their quotes offer, and that is theirs to make.
//
// ── Why the count is "what the button would add", not "keys in the seed" ──
//
// Takeoff-priced services (`pricedBy`) are reference rows the button never
// writes. Counting them would announce services that pressing the button then
// does not add — a notification that promises more than its control does.
//
// ── The reader's language, including the trade's name ─────────────────────
//
// The bell renders `app.notif.type.<type>` from the reader's own catalogue,
// but it interpolates params verbatim, and the trade name is a param. One
// event per company would print a French member's sentence around an English
// trade name. So recipients are grouped by language (User.language, else the
// company's default, else English — lib/notify/push.js's rule) and each group
// gets its own event, narrowed with recipientUserIds, carrying the trade
// names from ServiceCategory.labelTranslations in that language. Every member
// still receives exactly one notification.
//
// ── Idempotent ────────────────────────────────────────────────────────────
//
// No new column. The event's entityId carries NEW_SEEDS_RELEASE, and a member
// who already holds a delivery of this type for this release is skipped — a
// re-run (or a run that died halfway) tells only the people not yet told.
//
// ── Releases, and why bumping the id alone was not enough ─────────────────
//
// The count is "what Add missing services would create" — every seed the
// company lacks, old or new. So a bare bump of the release id would tell a
// company that was already told on 2026-09-24 about the same services again,
// as "new", alongside the ones that really are. NEW_SEEDS_RELEASES therefore
// names, per release, the seed keys it INTRODUCED: a company that already
// holds a delivery of an earlier release is told only about keys introduced
// after the last release it was told about; a company never told is told
// everything the button would add, as the first release did. `keys: null`
// means "no restriction" (the first release, 2026-09-24).
//
// 2026-09-25-handyman: the twelve rows 40d8375b6 added so the locksmith,
// caulking & sealants and baby-proofing quote types open with services. They
// are exactly the seed keys in scripts/service-seeds/source-map/ at HEAD and
// not at b838ad920 (the 09-24 release commit) — computed, not recalled; no key
// was removed. Rows that only gained a trade TAG since 09-24 are existing
// services and are not re-announced; "Add missing services" still offers them.
//
// The next time the seeds grow: append a release with the keys it adds.

import { serviceSeedsForCompanyTrade, planServiceSeeds } from "@/lib/services/seeds";
import { selectRecipients } from "@/lib/notifications/recipients";

export const NEW_SEEDS_TYPE = "services.new_seeds";

/** Every release, oldest first. See the header for what `keys` means. */
export const NEW_SEEDS_RELEASES = Object.freeze([
  Object.freeze({ id: "service-seeds-2026-09-24", keys: null }),
  Object.freeze({
    id: "service-seeds-2026-09-25-handyman",
    keys: Object.freeze([
      "fq.handyman.doors_windows.lock_rekey",
      "fq.handyman.doors_windows.deadbolt_install",
      "fq.handyman.doors_windows.smart_lock_install",
      "fq.handyman.doors_windows.lockset_replacement",
      "fq.handyman.doors_windows.weatherstrip_sweep",
      "fq.handyman.painting.tub_shower_recaulk",
      "fq.handyman.painting.window_door_weatherproofing",
      "fq.handyman.childproofing.home_visit",
      "fq.handyman.childproofing.safety_gate",
      "fq.handyman.childproofing.cabinet_latches",
      "fq.handyman.childproofing.furniture_anchoring",
      "fq.handyman.childproofing.window_safety",
    ]),
  }),
]);

/** The release this run announces — the newest. */
export const NEW_SEEDS_RELEASE = NEW_SEEDS_RELEASES[NEW_SEEDS_RELEASES.length - 1].id;

/**
 * Which seed keys a company may be told about, given the newest release it
 * was already told about (its id, or null for never). Null = no restriction.
 * An unknown id is treated as never told — telling someone twice is the
 * cheaper mistake than never telling them.
 */
export function announceableKeys(lastToldReleaseId = null) {
  const told = NEW_SEEDS_RELEASES.findIndex((r) => r.id === lastToldReleaseId);
  const pending = NEW_SEEDS_RELEASES.slice(told + 1);
  if (pending.some((r) => r.keys === null)) return null;
  return new Set(pending.flatMap((r) => r.keys));
}

/**
 * The seed keys "Add missing services" would create, per trade, for one
 * company. Pure.
 *
 * @param tradeKeys        the company's enabled ServiceCategory keys
 * @param existingSeedKeys every Product.seedKey the company holds (any trade,
 *                         active or not — the button's own rule)
 * @returns {{ byTrade: Array<{ trade, keys: string[] }>, total: number }}
 *          `total` counts a service shared by two trades once.
 */
export function newSeedKeysFor({ tradeKeys = [], existingSeedKeys = [], onlyKeys = null } = {}) {
  const byTrade = [];
  const all = new Set();
  for (const trade of [...new Set(Array.isArray(tradeKeys) ? tradeKeys : [])]) {
    const seed = serviceSeedsForCompanyTrade(trade);
    if (!seed) continue;
    const { toCreate } = planServiceSeeds({ seed, existingSeedKeys });
    // A company told about an earlier release hears only about what came
    // after it (announceableKeys); still only what the button would add.
    const keys = toCreate.map((s) => s.seedKey).filter((k) => !(onlyKeys instanceof Set) || onlyKeys.has(k));
    if (!keys.length) continue;
    for (const k of keys) all.add(k);
    byTrade.push({ trade, keys });
  }
  return { byTrade, total: all.size };
}

/** The reader's language: theirs, else the company's, else English. */
export function readerLanguage(userLanguage, companyLanguage) {
  return (userLanguage || companyLanguage || "en").toLowerCase();
}

/** A trade's name in a language, from ServiceCategory; English label otherwise. */
export function tradeLabelIn(category, language) {
  const tr = category?.labelTranslations;
  const own = tr && typeof tr === "object" && typeof tr[language] === "string" ? tr[language].trim() : "";
  return own || category?.label || category?.key || "";
}

/** "Plumbing, Electrical and HVAC" in the reader's own list grammar. */
export function joinTrades(labels, language) {
  const list = labels.filter(Boolean);
  try {
    return new Intl.ListFormat(language, { style: "long", type: "conjunction" }).format(list);
  } catch {
    return list.join(", ");
  }
}

/**
 * The whole plan for one company, with no database. Pure — the check executes
 * it.
 *
 * @param company   { id, name, defaultLanguage, categories: [{ key, label, labelTranslations }] }
 * @param seedKeys  the company's Product.seedKey values
 * @param members   active members: { id, userId, role, permissions, active, language }
 * @param alreadyTold  Set of member ids already holding this release's delivery
 * @param onlyKeys     announceableKeys() for this company — null for everything
 * @returns null when there is nothing to announce or nobody left to tell, else
 *          { companyId, companyName, total, trades: [{ key, label, count }],
 *            groups: [{ language, userIds, memberIds, params: { count, trades } }] }
 */
export function planCompanyNotice({ company, seedKeys = [], members = [], alreadyTold = new Set(), onlyKeys = null }) {
  const categories = (company?.categories || []).filter((c) => c?.key);
  const { byTrade, total } = newSeedKeysFor({
    tradeKeys: categories.map((c) => c.key),
    existingSeedKeys: seedKeys,
    onlyKeys,
  });
  if (total === 0) return null;

  // Owners and admins, by the catalog's audience — this file names no role.
  const recipients = selectRecipients({ members, type: NEW_SEEDS_TYPE }).filter(
    (m) => m.userId && !alreadyTold.has(m.id),
  );
  if (!recipients.length) return null;

  const categoryByKey = new Map(categories.map((c) => [c.key, c]));
  const groups = new Map();
  for (const m of recipients) {
    const language = readerLanguage(m.language, company.defaultLanguage);
    if (!groups.has(language)) groups.set(language, []);
    groups.get(language).push(m);
  }

  return {
    companyId: company.id,
    companyName: company.name,
    total,
    trades: byTrade.map((t) => ({ key: t.trade, label: tradeLabelIn(categoryByKey.get(t.trade), "en"), count: t.keys.length })),
    groups: [...groups.entries()].map(([language, list]) => ({
      language,
      userIds: list.map((m) => m.userId),
      memberIds: list.map((m) => m.id),
      params: {
        count: total,
        trades: joinTrades(byTrade.map((t) => tradeLabelIn(categoryByKey.get(t.trade), language)), language),
      },
    })),
  };
}

/**
 * Read the database and plan every company. Reads only.
 *
 * Non-demo companies only (`isDemo` — the sales pool and reps' demos are not
 * customers). A company's trades are its ENABLED CompanyServiceCategory rows;
 * a custom quote type has no seed and drops out in newSeedKeysFor.
 */
export async function planNewSeedNotices({ db, companyId = null }) {
  const companies = await db.company.findMany({
    where: { isDemo: false, ...(companyId ? { id: companyId } : {}) },
    select: {
      id: true,
      name: true,
      defaultLanguage: true,
      serviceCategories: {
        where: { enabled: true },
        select: { category: { select: { key: true, label: true, labelTranslations: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!companies.length) return [];
  const ids = companies.map((c) => c.id);

  const [products, members, told] = await Promise.all([
    db.product.findMany({ where: { companyId: { in: ids }, seedKey: { not: null } }, select: { companyId: true, seedKey: true } }),
    db.member.findMany({
      where: { companyId: { in: ids }, active: true },
      select: { id: true, userId: true, role: true, permissions: true, companyId: true, active: true, user: { select: { language: true } } },
    }),
    // Every release's deliveries, not only this one's: who was told THIS
    // release is skipped, and which earlier release a company was told about
    // decides what is still new to it (announceableKeys).
    db.notificationDelivery.findMany({
      where: { companyId: { in: ids }, event: { type: NEW_SEEDS_TYPE, entityId: { in: NEW_SEEDS_RELEASES.map((r) => r.id) } } },
      select: { memberId: true, companyId: true, event: { select: { entityId: true } } },
    }),
  ]);

  const keysBy = new Map();
  for (const p of products) {
    if (!keysBy.has(p.companyId)) keysBy.set(p.companyId, []);
    keysBy.get(p.companyId).push(p.seedKey);
  }
  const membersBy = new Map();
  for (const m of members) {
    if (!membersBy.has(m.companyId)) membersBy.set(m.companyId, []);
    membersBy.get(m.companyId).push({ ...m, language: m.user?.language || null });
  }
  const alreadyTold = new Set(told.filter((d) => d.event?.entityId === NEW_SEEDS_RELEASE).map((d) => d.memberId));
  // The newest EARLIER release each company was told about. The current one
  // is left out on purpose: it is what this run announces, and a member
  // told it already is skipped by alreadyTold — counting it here would leave
  // that member's colleagues with nothing to be told.
  const order = new Map(NEW_SEEDS_RELEASES.map((r, i) => [r.id, i]));
  const current = NEW_SEEDS_RELEASES.length - 1;
  const lastToldBy = new Map();
  for (const d of told) {
    const i = order.get(d.event?.entityId);
    if (i === undefined || i === current || !d.companyId) continue;
    if (!lastToldBy.has(d.companyId) || i > lastToldBy.get(d.companyId)) lastToldBy.set(d.companyId, i);
  }

  const plans = [];
  for (const c of companies) {
    const plan = planCompanyNotice({
      company: { id: c.id, name: c.name, defaultLanguage: c.defaultLanguage, categories: c.serviceCategories.map((s) => s.category) },
      seedKeys: keysBy.get(c.id) || [],
      members: membersBy.get(c.id) || [],
      alreadyTold,
      onlyKeys: announceableKeys(lastToldBy.has(c.id) ? NEW_SEEDS_RELEASES[lastToldBy.get(c.id)].id : null),
    });
    if (plan) plans.push(plan);
  }
  return plans;
}
