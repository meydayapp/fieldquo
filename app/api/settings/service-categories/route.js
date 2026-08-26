// app/api/settings/service-categories/route.js
export const runtime = "nodejs";

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  getPriceBook,
  PRICE_BOOK_FIELDS,
  defaultTradeRate,
} from "@/app/data/tradePriceBooks";
import { toStoredFields } from "@/app/data/intakeFieldLibrary";
import { resolveServiceContent } from "@/lib/documents/serviceContent";
import { reprovisionIfLive } from "@/lib/voice/provision";
import { getAppOrigin } from "@/lib/appUrl";
import { loadEnforceableMember, canSeeMoney } from "@/lib/permissions/enforce";

// GET — system catalog + this company's own custom quote types, merged with
// this company's settings (enabled/rate/unit). Custom categories are scoped
// by companyId so one company never sees another's — a system category has
// companyId: null and is visible to everyone; a custom one only shows up
// for the company that created it.
//
// ── Why this REDACTS where /api/products REFUSES ───────────────────────────
//
// The two screens are siblings and QA read the second one straight through:
// Products & Services answers 403 to a member without showPricing, and
// Settings > Services — which carries the same company's rate card, $150 per
// door, the complexity uplifts, add-ons to $1,000 and a $3,800 job minimum —
// had no check of any kind on any verb's read.
//
// The check is the same one (`showPricing`); the SHAPE of the answer has to
// differ, because the two payloads are not the same thing. A price book is
// nothing but prices, so a stripped one is a broken screen. This payload is
// the company's SERVICE CATALOGUE — which trades are switched on, what a quote
// says about each, what fields the intake asks — and four other screens read
// it for exactly that: Company Settings, Checklists, Products & Services and
// New Service Plan. Refusing here would break all four to protect a rate that
// is one field of the row.
//
// So the rate card is removed from the payload and the removal is declared,
// the same way redactQuoteMoney does it. `pricingHidden` is what stops the
// settings screen rendering empty rate boxes over the absence — which would be
// the dead control AGENTS.md names, and would also let someone type a number
// into an input whose save the PATCH below refuses anyway.
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  const showMoney = canSeeMoney(full);

  const categories = await db.serviceCategory.findMany({
    where: { OR: [{ isSystem: true }, { companyId: member.companyId }] },
    orderBy: { sortOrder: "asc" },
    include: {
      companySettings: { where: { companyId: member.companyId } },
    },
  });

  const merged = categories.map((c) => {
    const setting = c.companySettings[0] || null;
    return {
      id: c.id,
      key: c.key,
      label: c.label,
      icon: c.icon,
      isSystem: c.isSystem,
      customFields: c.customFields || null,
      enabled: setting?.enabled ?? false,
      // No `pricingModel`: see the PATCH below. The column still exists but
      // nothing reads it, so returning it only invited a new caller to.
      unit: setting?.unit ?? defaultTradeRate(c.key)?.unit ?? null,
      // ── The three money fields, present only for members who may see money ──
      //
      // `defaultRate` is the opening rate for a trade with no price book, when
      // this company has not set its own. Read-time only — nothing writes it,
      // so a company keeps inheriting changes to the default and the benchmark
      // data stays built from rates real companies chose. See defaultTradeRate.
      //
      // `priceBook` is the trade's structured rates: code defaults with this
      // company's sparse overrides merged in. `rateOverrides` is sent alongside
      // so the settings screen can show which fields have actually been
      // customised — and so a save round-trips the patch rather than writing
      // back a full copy of the defaults, which would detach the company from
      // future improvements.
      //
      // Spread conditionally rather than nulled: `priceBook: null` is a real
      // and different statement ("this trade has no rate card"), which the
      // screen keys its whole rate-and-unit fallback off. Absent means
      // withheld, and `pricingHidden` below says which.
      //
      // `unit` stays. "per sq ft" is how the work is counted, not what it
      // costs — the same line redactQuoteMoney draws between `quantity` and
      // `rate`.
      ...(showMoney
        ? {
            defaultRate:
              setting?.defaultRate ?? defaultTradeRate(c.key)?.rate ?? null,
            priceBook: getPriceBook(c.key, setting?.rates) || null,
            rateOverrides: setting?.rates ?? null,
          }
        : { pricingHidden: true }),
      // What this company's quotes SAY about the trade. The columns existed and
      // resolveServiceContent read them, but nothing ever wrote one — so every
      // company sat on the defaults with no way off them. Sent here, edited in
      // Settings > Services, saved by the PATCH below.
      //
      // `content` is the RESOLVED result, defaults included, so the editor can
      // show what a quote would actually print. `contentOverrides` is the
      // sparse patch, so it can tell "customised" from "inherited" — the same
      // pair as priceBook / rateOverrides above, for the same reason.
      content: resolveServiceContent(c.key, setting || null),
      contentOverrides: {
        includedItems: setting?.includedItems ?? null,
        processSteps: setting?.processSteps ?? null,
        scopeDescription: setting?.scopeDescription ?? null,
      },
    };
  });

  return NextResponse.json(merged);
}

// POST — create a custom (company-owned) quote type: a name plus a subset of
// fields chosen from the shared library (app/data/intakeFieldLibrary.js),
// rather than a from-scratch form builder. Auto-enabled immediately since
// there's no reason to create one you can't use yet — from then on it's
// toggled/priced through the same PATCH below as any system category.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners/admins can change settings" },
      { status: 403 },
    );
  }

  const { label, fieldKeys } = await request.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const customFields = toStoredFields(
    Array.isArray(fieldKeys) ? fieldKeys : [],
  );

  const category = await db.serviceCategory.create({
    data: {
      // Never user-typed — sidesteps any risk of colliding with the ~26
      // seeded system keys or another company's custom key, since `key`
      // stays globally unique across every ServiceCategory row.
      key: `custom_${randomUUID()}`,
      label: label.trim(),
      isSystem: false,
      companyId: member.companyId,
      customFields,
      companySettings: {
        create: { companyId: member.companyId, enabled: true },
      },
    },
  });

  return NextResponse.json(
    {
      id: category.id,
      key: category.key,
      label: category.label,
      icon: null,
      isSystem: false,
      customFields: category.customFields,
      enabled: true,
      defaultRate: null,
      unit: null,
    },
    { status: 201 },
  );
}

// PATCH — bulk upsert company's category settings
// body: { categories: [{ categoryId, enabled, defaultRate, unit, rates,
//                        includedItems, processSteps, scopeDescription }] }
//
// `pricingModel` (flat | per_unit | hourly) is deliberately NOT accepted any
// more. It was written on every save and read by nothing: no quote, PDF,
// invoice or estimator ever branched on it, so a company that picked "hourly"
// got exactly the same prices as one that picked "flat". The real answer is
// per-trade — a cabinet shop charges per door and per drawer, a stair
// refinisher per tread and riser, a painter per square foot — and that lives
// in the price book (app/data/tradePriceBooks.js, stored as `rates`). Trades
// with no book keep `defaultRate` + `unit`, both of which ARE read when a
// quote line item is seeded.
//
// The CompanyServiceCategory.pricingModel column is left in place: dropping it
// is a data migration, not a code change. Existing rows keep whatever they
// last stored, and nothing looks at it.
export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners/admins can change settings" },
      { status: 403 },
    );
  }

  const { categories } = await request.json();
  if (!Array.isArray(categories)) {
    return NextResponse.json(
      { error: "categories array required" },
      { status: 400 },
    );
  }

  // Resolve categoryId -> key here rather than trusting the client to send it.
  // sanitiseRates needs the key to know which fields the trade has, and the
  // settings screen only ever posts categoryId — reading c.key would quietly
  // discard every saved rate.
  const known = await db.serviceCategory.findMany({
    where: { id: { in: categories.map((c) => c.categoryId).filter(Boolean) } },
    select: { id: true, key: true },
  });
  const keyById = new Map(known.map((k) => [k.id, k.key]));

  const results = await Promise.all(
    categories.map((c) =>
      db.companyServiceCategory.upsert({
        where: {
          companyId_categoryId: {
            companyId: member.companyId,
            categoryId: c.categoryId,
          },
        },
        update: {
          enabled: c.enabled,
          defaultRate: c.defaultRate ?? null,
          unit: c.unit || null,
          // Only touched when the caller sends it — a settings screen that
          // saves enabled/rate must not blank a company's rate book.
          ...(c.rates !== undefined && {
            rates: sanitiseRates(keyById.get(c.categoryId), c.rates),
          }),
          ...(c.includedItems !== undefined && {
            includedItems: sanitiseIncluded(c.includedItems),
          }),
          ...(c.processSteps !== undefined && {
            processSteps: sanitiseSteps(c.processSteps),
          }),
          ...(c.scopeDescription !== undefined && {
            scopeDescription: sanitiseDescription(c.scopeDescription),
          }),
        },
        create: {
          companyId: member.companyId,
          categoryId: c.categoryId,
          enabled: c.enabled,
          defaultRate: c.defaultRate ?? null,
          unit: c.unit || null,
          ...(c.rates !== undefined && {
            rates: sanitiseRates(keyById.get(c.categoryId), c.rates),
          }),
          ...(c.includedItems !== undefined && {
            includedItems: sanitiseIncluded(c.includedItems),
          }),
          ...(c.processSteps !== undefined && {
            processSteps: sanitiseSteps(c.processSteps),
          }),
          ...(c.scopeDescription !== undefined && {
            scopeDescription: sanitiseDescription(c.scopeDescription),
          }),
        },
      }),
    ),
  );

  // ── The phone receptionist's closed list of services lives here ─────────
  //
  // buildAgentPrompt says "they do exactly these things, and nothing else",
  // built from the enabled rows this PATCH just wrote — and nothing re-pushed
  // it. So a company could switch a trade on, see it on this screen, and have
  // an agent still telling callers they don't do it. Pushed here for the same
  // reason provisionAgent pushes on every voice save: the provider holds a
  // cache and this is the write that invalidates it.
  //
  // Best-effort and never creates an agent — see reprovisionIfLive.
  await reprovisionIfLive(member.companyId, getAppOrigin(request)).catch((err) =>
    console.error("[settings/service-categories] couldn't refresh the receptionist:", err?.message),
  );

  return NextResponse.json({ success: true, updated: results.length });
}

// How much of either list a company may store. Not a style rule — this text is
// rendered into a PDF with a fixed page, and an unbounded array arriving from a
// browser is both a layout bug and a payload nobody bounded.
const MAX_ITEMS = 20;
const MAX_LEN = 400;

const cleanText = (v, max = MAX_LEN) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * A company's "what's included" list.
 *
 * Strings only, trimmed, empty ones dropped. An empty result stores NULL rather
 * than [], because resolveServiceContent treats a non-empty array as an
 * override and anything else as "not customised" — storing [] would hand a
 * company a quote with no included list and no way to tell why.
 */
function sanitiseIncluded(items) {
  if (!Array.isArray(items)) return null;
  const out = items
    .map((i) => cleanText(i))
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
  return out.length ? out : null;
}

/**
 * A company's process steps.
 *
 * `timeline` is optional and STAYS optional: a company that clears it gets a
 * step with no duration printed, which is the honest rendering of "we are not
 * committing to one". A step with no title is dropped rather than stored — it
 * would render as a numbered bubble beside nothing.
 */
function sanitiseSteps(steps) {
  if (!Array.isArray(steps)) return null;
  const out = [];
  for (const s of steps) {
    if (!s || typeof s !== "object") continue;
    const title = cleanText(s.title, 120);
    if (!title) continue;
    const step = { title, body: cleanText(s.body) };
    const timeline = cleanText(s.timeline, 40);
    if (timeline) step.timeline = timeline;
    out.push(step);
    if (out.length >= MAX_ITEMS) break;
  }
  return out.length ? out : null;
}

/**
 * A company's scope paragraph for a trade.
 *
 * One string, not a list, and an empty one stores NULL so the trade goes back
 * to inheriting the default — including the per-choice variants a stored
 * paragraph cannot express. Same rule as sanitiseIncluded: blank un-customises,
 * it does not blank the document.
 *
 * The cap is four times a bullet's, because this is a paragraph and a hard trim
 * mid-sentence on a client-facing document is worse than a long one.
 */
function sanitiseDescription(value) {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, MAX_LEN * 4) || null;
}

/**
 * Keep a company's rate override to the fields its trade actually has.
 *
 * The browser sends this, and it is merged over the price book on every quote,
 * so an arbitrary object here would let a tenant graft junk (or a "__proto__")
 * onto the pricing model. Only paths declared in PRICE_BOOK_FIELDS survive, and
 * each value must be a finite number — a rate is never a string or an object.
 * Nothing left after filtering is stored as null, which correctly means
 * "this company has not customised anything".
 */
function sanitiseRates(categoryKey, rates) {
  const fields = PRICE_BOOK_FIELDS[categoryKey];
  if (!fields || !rates || typeof rates !== "object" || Array.isArray(rates))
    return null;

  const out = {};
  let count = 0;
  for (const field of fields) {
    const value = readPath(rates, field.path);
    if (value === undefined || value === null || value === "") continue;
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    writePath(out, field.path, n);
    count += 1;
  }
  return count > 0 ? out : null;
}

function readPath(obj, path) {
  return String(path)
    .split(".")
    .reduce((node, part) => (node == null ? undefined : node[part]), obj);
}

function writePath(obj, path, value) {
  const parts = String(path).split(".");
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === "__proto__" || part === "constructor" || part === "prototype")
      return;
    if (!node[part] || typeof node[part] !== "object") node[part] = {};
    node = node[part];
  }
  const last = parts[parts.length - 1];
  if (last === "__proto__" || last === "constructor" || last === "prototype")
    return;
  node[last] = value;
}
