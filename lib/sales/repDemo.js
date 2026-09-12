// lib/sales/repDemo.js
//
// One demo company per rep, per trade — seeded on demand, never shared.
//
// ══ What was wrong with the pool ══════════════════════════════════════════
//
// The ten seeded fixtures (demo1..demo10) were handed out one per rep through
// SalesRep.demoCompanyId, and on paper that was already "unique per rep". In
// practice one of the ten had a login and the rest did not, so every rep who
// wanted to drive a demo signed in as demo1@fieldquo.com — and two reps
// demoing in the same hour watched each other's quotes appear, and a rep who
// changed a price left it changed for the next call. The owner's instruction
// on 2026-09-12: "make sure that each sales rep gets a unique demo account."
//
// So a rep no longer claims from the pool. The first time they open
// /sales/demo (or accept their invite), a company is CREATED for them from the
// same trade preset the pool uses (lib/demo/seedDemo.js's applyIndustry), with
// their name on it and `demoOwnerRepId` pointing back at them. One per trade
// they open, because a roofer and a painter should not be shown the same
// fixture. The ten pool companies are untouched: the platform console still
// runs its own demos on them, and a superadmin can still assign one by hand.
//
// ══ Isolation is by construction, not by this file ═════════════════════════
//
// Every read and write inside /app is scoped by companyId through
// lib/currentMember.js, so two reps' demos are as separate as two customers'
// companies. This file adds nothing to that; it only guarantees that no two
// reps are ever pointed at the same company. scripts/check-demo-per-rep.mjs
// seeds two reps against an in-memory store and reads across — the assertion
// is that a query scoped to one company never returns the other's rows.
//
// ══ Idempotent under two tabs ══════════════════════════════════════════════
//
// Company.demoRepSlot is "<repId>:<trade>" while a demo is live, and @unique.
// Two tabs opening the page at the same instant both read "no demo yet" and
// both try to create; Postgres refuses the second (P2002) and it re-reads the
// winner. Read-then-write would have produced two companies for one rep and
// one trade, which is the shared-demo bug reappearing as a duplicate-demo bug.
//
// ══ A reset deletes nothing ════════════════════════════════════════════════
//
// The pool's reset wipes the company's rows in place (lib/demo/seedDemo.js's
// wipeContent). A rep's reset does not: it RETIRES the company — stamps
// demoRetiredAt, clears the slot so the slot is free again, deactivates its
// memberships — and seeds a fresh company for the same rep and trade. The old
// rows stay exactly as they were, still isDemo, still excluded from every
// figure that excludes demos, and still readable from the platform console.
// This is the standing rule for this codebase ("never delete data") applied to
// the one place a delete looked cheapest.
//
// ══ The login: the pool's mechanism, one per rep ═══════════════════════════
//
// A rep signs into their demo for real — impersonation is superadmin-only and
// read-only (non-negotiable #2), and a demo is worthless unless a quote can be
// written in it. The credential is minted through exactly the mechanism
// lib/demo/demoLogin.js uses for the pool (Better Auth's own sign-up, an owner
// Member row, an Organization row): mintDemoUser() and ensureDemoOrg() are
// imported from there, not re-implemented. What differs is the door — a rep,
// for a company whose demoOwnerRepId is their own, re-read from the row — and
// the address, which is derived from the rep's code (demo-<code>@fieldquo.com)
// rather than the company's slug, so the same login opens every trade the rep
// has and survives a reset. The rep chooses the password; nothing here can
// read or reset one, so a forgotten password is answered by minting a
// replacement login (demo-<code>-2@fieldquo.com) and moving the memberships,
// never by writing a hash.
//
// Which company that one login lands in is decided by which Member row is
// active: lib/currentMember.js falls back to the earliest ACTIVE membership,
// so "Open" on a trade card makes that company's membership the only active
// one and points SalesRep.demoCompanyId at it. The two are written together.
//
// ══ What this file does NOT write ═════════════════════════════════════════
//
// SalesRep. The one column a rep's action may change on their own row is
// demoCompanyId, and every write to it lives in lib/sales/demoAssign.js —
// scripts/check-sales-auth.mjs scans every module a rep-facing route imports
// and this one must come up clean. pointRepAtOwnDemo() is called, not copied.
import { db } from "@/lib/db";
import { INDUSTRIES, INDUSTRY_KEYS } from "@/lib/demo/industries";
import { applyIndustry } from "@/lib/demo/seedDemo";
import { ensureDemoOrg, mintDemoUser, MIN_DEMO_PASSWORD } from "@/lib/demo/demoLogin";
import { pointRepAtOwnDemo } from "./demoAssign";

/** How many "-2", "-3" suffixes a slug or login address will try before refusing. */
export const MAX_GENERATIONS = 20;

const DEMO_SELECT = {
  id: true,
  name: true,
  slug: true,
  isDemo: true,
  authOrgId: true,
  demoIndustry: true,
  demoOwnerRepId: true,
  demoRepSlot: true,
  demoRetiredAt: true,
  createdAt: true,
};

// ── Pure helpers, executed by the check ───────────────────────────────────

/** The @unique key that makes "one live demo per rep per trade" a constraint. */
export function repDemoSlot(repId, trade) {
  const r = typeof repId === "string" ? repId.trim() : "";
  const t = typeof trade === "string" ? trade.trim() : "";
  return r && t ? `${r}:${t}` : null;
}

/**
 * The slug, which is also the subdomain and the booking address.
 *
 * "demo-" first so it can never collide with the pool's demo1..demo10 and so
 * a human reading /platform/companies can tell a rep's fixture from a
 * customer. Never derived from the company NAME — the name carries the trade
 * label and the rep's first name and either can change spelling. `generation`
 * is the reset count: the retired company keeps its slug, so the fresh one
 * needs its own.
 */
export function repDemoSlug(code, trade, generation = 1) {
  const c = String(code || "rep")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  const t = String(trade || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const base = `demo-${c || "rep"}-${t}`;
  const g = Number(generation) > 1 ? `-${Math.floor(Number(generation))}` : "";
  // 63 is the hard limit on one DNS label, not a product choice.
  return (base + g).slice(0, 63).replace(/-+$/, "");
}

/** "<Trade> Demo — <Rep first name>", as the owner specified it. */
export function repDemoName(trade, repName) {
  const label = INDUSTRIES[trade]?.label || String(trade || "").trim() || "Trade";
  const first = String(repName || "").trim().split(/\s+/)[0] || "Rep";
  return `${label} Demo — ${first}`;
}

/**
 * The sign-in address for a rep's demos.
 *
 * Derived from the rep's code, which is re-read from their row by every
 * caller — never accepted from the request, the same guard demoLoginEmail()
 * applies to the pool's slugs. `n` is the replacement count: a rep who has
 * lost their password gets demo-<code>-2, because nothing here can reset one.
 */
export function repDemoLoginEmail(code, n = 1) {
  const c = String(code || "").toLowerCase().replace(/[^a-z0-9-]+/g, "");
  if (!c) return null;
  const suffix = Number(n) > 1 ? `-${Math.floor(Number(n))}` : "";
  return `demo-${c}${suffix}@fieldquo.com`;
}

/**
 * Which trade a rep's first demo should be dressed as.
 *
 * The trade of the pool demo they were holding, if any — a rep who spent a
 * week on demo3 (flooring) should not open their own demo and find a painter.
 * Otherwise the first preset, which is painting. Never null: the page has a
 * picker for every other trade.
 */
export function defaultTradeFor(heldDemo) {
  const key = heldDemo?.demoIndustry;
  return key && INDUSTRIES[key] ? key : INDUSTRY_KEYS[0];
}

/** A rep may act on this company: theirs, a demo, and not retired. */
export function isOwnLiveDemo(company, repId) {
  return Boolean(
    company &&
      company.isDemo === true &&
      company.demoOwnerRepId === repId &&
      !company.demoRetiredAt,
  );
}

// ── Reads ─────────────────────────────────────────────────────────────────

/** Every live demo this rep owns, oldest first. */
export async function listRepDemos(repId, client = db) {
  if (!repId) return [];
  return client.company.findMany({
    where: { demoOwnerRepId: repId, isDemo: true, demoRetiredAt: null },
    select: DEMO_SELECT,
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Every per-rep demo on the platform, live and retired, for the console.
 *
 * Read-only there: the console can see them (non-negotiable #3 — view
 * everything) and gets no Reset or Assign on them, because those are the
 * rep's own controls on /sales/demo and a reset from the console would land
 * mid-walkthrough with no warning on the rep's screen.
 */
export async function listAllRepDemos(client = db) {
  return client.company.findMany({
    where: { isDemo: true, demoOwnerRepId: { not: null } },
    select: {
      ...DEMO_SELECT,
      demoOwnerRep: { select: { id: true, name: true, email: true } },
      _count: { select: { quotes: true, jobs: true, clients: true } },
    },
    orderBy: [{ demoRetiredAt: "asc" }, { createdAt: "desc" }],
  });
}

/**
 * The Better Auth user that signs into this rep's demos, or null.
 *
 * Derived from the rows rather than stored on SalesRep: the newest Member row
 * across the rep's own demo companies belongs to the login that currently
 * works (a replacement login is minted with its own, newer rows, and the old
 * one's are deactivated). Storing a userId on SalesRep would be a second
 * SalesRep column written from the rep's side, which lib/sales/gate.js's
 * REP_FORBIDDEN_WRITES exists to prevent.
 */
export async function repDemoUser(repId, client = db) {
  const demos = await client.company.findMany({
    where: { demoOwnerRepId: repId, isDemo: true },
    select: { id: true },
  });
  if (demos.length === 0) return null;
  // Owner only: a rep may invite a fictional employee into their demo from
  // Settings → Team while showing that screen, and that row must not be
  // mistaken for the login. The demo login is always minted as owner.
  const member = await client.member.findFirst({
    where: { companyId: { in: demos.map((d) => d.id) }, role: "owner" },
    orderBy: { createdAt: "desc" },
    select: { userId: true, user: { select: { id: true, email: true } } },
  });
  return member?.user || null;
}

/**
 * Everything /sales/demo needs, in one shape.
 *
 *   demos      the rep's live demos, each with `current` and `loginReady`
 *   current    the id SalesRep.demoCompanyId points at, if it is one of them
 *   login      { email, exists } — the address that opens them, if minted
 */
export async function repDemoState(rep, client = db) {
  const [demos, user] = await Promise.all([
    listRepDemos(rep.id, client),
    repDemoUser(rep.id, client),
  ]);
  const members = user
    ? await client.member.findMany({
        where: { userId: user.id, companyId: { in: demos.map((d) => d.id) } },
        select: { companyId: true, active: true },
      })
    : [];
  const active = new Set(members.filter((m) => m.active).map((m) => m.companyId));
  const current = demos.find((d) => d.id === rep.demoCompanyId)?.id || null;
  return {
    demos: demos.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      demoIndustry: d.demoIndustry,
      tradeLabel: INDUSTRIES[d.demoIndustry]?.label || d.demoIndustry,
      createdAt: d.createdAt,
      current: d.id === current,
      // "Ready" means the address can actually open THIS company: a user, an
      // active membership, and the organization /app resolves it through.
      loginReady: Boolean(user) && active.has(d.id) && Boolean(d.authOrgId),
    })),
    current,
    login: {
      email: user?.email || null,
      exists: Boolean(user),
      // What the address WILL be, so the password form can name it before it
      // exists. First choice only; ensureRepDemoLogin picks the first free one.
      plannedEmail: repDemoLoginEmail(rep.code),
    },
  };
}

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * Attach the rep's login to one of their demos. Owner, because a demo is
 * walked through as the business owner. `active` decides whether this is the
 * company the login lands in — see the header on which membership is active.
 */
async function attachLogin({ userId, company, active, client, createOrg }) {
  await ensureDemoOrg({ company, userId, client, createOrg });
  await client.member.upsert({
    where: { userId_companyId: { userId, companyId: company.id } },
    update: { role: "owner", active },
    create: { userId, companyId: company.id, role: "owner", active },
  });
}

/**
 * The rep's demo for this trade — created if they have none, theirs if they do.
 *
 * @param rep     { id, name, code, demoCompanyId }, read fresh by the caller.
 * @param trade   an INDUSTRIES key. Defaults to defaultTradeFor(the demo the
 *                rep is pointed at), so a rep coming off the pool keeps their
 *                trade.
 * @param dress   what fills the company: lib/demo/seedDemo.js's applyIndustry
 *                in production, a stub in the check. It re-reads the company
 *                and refuses unless isDemo is true, which is the guard that
 *                makes creating tenant rows from a rep-facing route acceptable.
 *
 * @returns { company, created }
 */
export async function ensureRepDemo({
  rep,
  trade = null,
  client = db,
  dress = applyIndustry,
  createOrg,
  now = new Date(),
} = {}) {
  if (!rep?.id) throw Object.assign(new Error("Sign in to the sales portal."), { status: 401 });

  let key = typeof trade === "string" && trade.trim() ? trade.trim() : null;
  if (!key) {
    const held = rep.demoCompanyId
      ? await client.company.findUnique({
          where: { id: rep.demoCompanyId },
          select: { demoIndustry: true, isDemo: true },
        })
      : null;
    key = defaultTradeFor(held?.isDemo ? held : null);
  }
  if (!INDUSTRIES[key]) {
    throw Object.assign(new Error("That is not one of the trades a demo can be set up as."), { status: 400 });
  }

  // Where the rep is pointed today: nothing, a pool demo, a retired demo of
  // theirs, or a live one. Only the last is left alone below — a second trade
  // must not steal the pointer from the demo they are mid-walkthrough in, and
  // anything else gets pointed at the demo this call returns.
  const pointed = rep.demoCompanyId
    ? await client.company.findUnique({
        where: { id: rep.demoCompanyId },
        select: { id: true, isDemo: true, demoOwnerRepId: true, demoRetiredAt: true },
      })
    : null;
  const settle = async (company, created) => {
    if (!isOwnLiveDemo(pointed, rep.id)) {
      const opened = await openRepDemo({ rep, companyId: company.id, client, createOrg });
      if (!opened.ok) throw Object.assign(new Error(opened.error), { status: opened.status });
    }
    return { company, created };
  };

  const slot = repDemoSlot(rep.id, key);
  const existing = await client.company.findUnique({ where: { demoRepSlot: slot }, select: DEMO_SELECT });
  if (existing) return settle(existing, false);

  // The generation is how many demos this rep has ever had on this trade,
  // live or retired — the retired ones keep their slugs.
  const priorCount = await client.company.count({
    where: { demoOwnerRepId: rep.id, demoIndustry: key },
  });

  let company = null;
  for (let generation = priorCount + 1; generation <= priorCount + MAX_GENERATIONS; generation++) {
    const slug = repDemoSlug(rep.code, key, generation);
    try {
      company = await client.company.create({
        data: {
          name: repDemoName(key, rep.name),
          slug,
          bookingSlug: slug,
          email: repDemoLoginEmail(rep.code),
          isDemo: true,
          demoIndustry: key,
          demoOwnerRepId: rep.id,
          demoRepSlot: slot,
          createdAt: now,
        },
        select: DEMO_SELECT,
      });
      break;
    } catch (err) {
      if (err?.code !== "P2002") throw err;
      // Two things share the constraint that just fired. The slot: another
      // tab won, and its company is the answer. The slug: a company already
      // owns it (a retired generation whose count we under-read, or a real
      // tenant with an unlucky name), so try the next generation.
      const winner = await client.company.findUnique({ where: { demoRepSlot: slot }, select: DEMO_SELECT });
      if (winner) return settle(winner, false);
    }
  }
  if (!company) {
    throw new Error(`Could not find a free slug for ${rep.code}'s ${key} demo after ${MAX_GENERATIONS} tries.`);
  }

  // Fill it. applyIndustry() names the company after the preset (the pool's
  // convention, "Northside Painting Co."); the owner asked for a rep's own
  // demo to carry the trade and the rep's first name instead, so the name is
  // put back after dressing. wipeContent() runs inside applyIndustry and finds
  // nothing to delete on a company created a moment ago.
  await dress(company.id, key);
  company = await client.company.update({
    where: { id: company.id },
    data: { name: repDemoName(key, rep.name) },
    select: DEMO_SELECT,
  });

  // If this rep already has a login, it opens this company too — inactive
  // until they press Open (settle() below activates it when this is the demo
  // they end up pointed at).
  const user = await repDemoUser(rep.id, client);
  if (user) await attachLogin({ userId: user.id, company, active: false, client, createOrg });

  return settle(company, true);
}

/**
 * Make this demo the one the rep's login lands in, and the one the portal
 * treats as theirs.
 */
export async function openRepDemo({ rep, companyId, client = db, createOrg } = {}) {
  const company = await client.company.findUnique({ where: { id: companyId }, select: DEMO_SELECT });
  if (!isOwnLiveDemo(company, rep?.id)) {
    return { ok: false, status: 404, error: "That is not one of your demo companies." };
  }

  const user = await repDemoUser(rep.id, client);
  if (user) {
    const mine = await listRepDemos(rep.id, client);
    await client.member.updateMany({
      where: { userId: user.id, companyId: { in: mine.map((d) => d.id).filter((id) => id !== company.id) } },
      data: { active: false },
    });
    await attachLogin({ userId: user.id, company, active: true, client, createOrg });
  }

  const pointed = await pointRepAtOwnDemo({ repId: rep.id, companyId: company.id }, client);
  if (!pointed.ok) return pointed;
  return { ok: true, company, loginReady: Boolean(user) };
}

/**
 * Retire this demo and seed a fresh one for the same trade. Deletes nothing.
 */
export async function resetRepDemo({ rep, companyId, client = db, dress = applyIndustry, createOrg, now = new Date() } = {}) {
  const company = await client.company.findUnique({ where: { id: companyId }, select: DEMO_SELECT });
  if (!isOwnLiveDemo(company, rep?.id)) {
    return { ok: false, status: 404, error: "That is not one of your demo companies." };
  }
  const wasCurrent = rep.demoCompanyId === company.id;

  // Retire first, so the slot is free for the fresh one. The rows stay; the
  // membership goes inactive so the login cannot land in the retired copy.
  await client.company.update({
    where: { id: company.id },
    data: { demoRetiredAt: now, demoRepSlot: null },
  });
  await client.member.updateMany({ where: { companyId: company.id }, data: { active: false } });

  const fresh = await ensureRepDemo({ rep: { ...rep, demoCompanyId: wasCurrent ? null : rep.demoCompanyId }, trade: company.demoIndustry, client, dress, createOrg, now });
  if (wasCurrent) {
    const opened = await openRepDemo({ rep, companyId: fresh.company.id, client, createOrg });
    if (!opened.ok) return opened;
  }
  // Re-read: opening attached the login and the organization to it, and the
  // copy ensureRepDemo handed back predates that.
  const current = await client.company.findUnique({ where: { id: fresh.company.id }, select: DEMO_SELECT });
  return { ok: true, retired: company, company: current || fresh.company };
}

/**
 * Mint (or replace) the login that opens this rep's demos.
 *
 * The same mechanism as the pool's createDemoLogin(): Better Auth's sign-up,
 * an owner Member row, an Organization row. The door is different — a rep,
 * for companies whose demoOwnerRepId is theirs — and so is the address, which
 * comes from the rep's code. A rep who already has a login and asks again is
 * asking because they lost the password; they get demo-<code>-N, and the old
 * login's memberships go inactive rather than being deleted.
 */
export async function ensureRepDemoLogin({ rep, password, client = db, signUp, createOrg } = {}) {
  if (!rep?.id) return { ok: false, status: 401, error: "Sign in to the sales portal." };
  if (!password || String(password).length < MIN_DEMO_PASSWORD) {
    return { ok: false, status: 400, error: `Use at least ${MIN_DEMO_PASSWORD} characters.` };
  }

  const demos = await listRepDemos(rep.id, client);
  if (demos.length === 0) {
    return { ok: false, status: 409, error: "You have no demo company yet. Open the demo page first." };
  }
  const previous = await repDemoUser(rep.id, client);

  // The first free address. A taken one is a previous login of this rep's (or,
  // after a code change, somebody's); either way it is not ours to reuse.
  let email = null;
  for (let n = 1; n <= MAX_GENERATIONS; n++) {
    const candidate = repDemoLoginEmail(rep.code, n);
    if (!candidate) break;
    const taken = await client.user.findUnique({ where: { email: candidate }, select: { id: true } });
    if (!taken) { email = candidate; break; }
  }
  if (!email) return { ok: false, status: 409, error: "No free demo address is left for this rep." };

  const userId = await mintDemoUser({ email, name: rep.name, password, signUp });

  if (previous) {
    await client.member.updateMany({
      where: { userId: previous.id, companyId: { in: demos.map((d) => d.id) } },
      data: { active: false },
    });
  }
  const currentId = demos.find((d) => d.id === rep.demoCompanyId)?.id || demos[0].id;
  for (const company of demos) {
    await attachLogin({ userId, company, active: company.id === currentId, client, createOrg });
  }
  if (currentId !== rep.demoCompanyId) {
    await pointRepAtOwnDemo({ repId: rep.id, companyId: currentId }, client);
  }
  return { ok: true, email, userId, replaced: Boolean(previous) };
}
