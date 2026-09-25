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
// re-run (or a run that died halfway) tells only the people not yet told. The
// next time the seeds grow, bump NEW_SEEDS_RELEASE and the same script runs
// again for the new release.

import { serviceSeedsForCompanyTrade, planServiceSeeds } from "@/lib/services/seeds";
import { selectRecipients } from "@/lib/notifications/recipients";

export const NEW_SEEDS_TYPE = "services.new_seeds";

/** The release this run announces. Bump it when the seeds next grow. */
export const NEW_SEEDS_RELEASE = "service-seeds-2026-09-24";

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
export function newSeedKeysFor({ tradeKeys = [], existingSeedKeys = [] } = {}) {
  const byTrade = [];
  const all = new Set();
  for (const trade of [...new Set(Array.isArray(tradeKeys) ? tradeKeys : [])]) {
    const seed = serviceSeedsForCompanyTrade(trade);
    if (!seed) continue;
    const { toCreate } = planServiceSeeds({ seed, existingSeedKeys });
    if (!toCreate.length) continue;
    const keys = toCreate.map((s) => s.seedKey);
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
 * @returns null when there is nothing to announce or nobody left to tell, else
 *          { companyId, companyName, total, trades: [{ key, label, count }],
 *            groups: [{ language, userIds, memberIds, params: { count, trades } }] }
 */
export function planCompanyNotice({ company, seedKeys = [], members = [], alreadyTold = new Set() }) {
  const categories = (company?.categories || []).filter((c) => c?.key);
  const { byTrade, total } = newSeedKeysFor({
    tradeKeys: categories.map((c) => c.key),
    existingSeedKeys: seedKeys,
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
    db.notificationDelivery.findMany({
      where: { companyId: { in: ids }, event: { type: NEW_SEEDS_TYPE, entityId: NEW_SEEDS_RELEASE } },
      select: { memberId: true },
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
  const alreadyTold = new Set(told.map((d) => d.memberId));

  const plans = [];
  for (const c of companies) {
    const plan = planCompanyNotice({
      company: { id: c.id, name: c.name, defaultLanguage: c.defaultLanguage, categories: c.serviceCategories.map((s) => s.category) },
      seedKeys: keysBy.get(c.id) || [],
      members: membersBy.get(c.id) || [],
      alreadyTold,
    });
    if (plan) plans.push(plan);
  }
  return plans;
}
