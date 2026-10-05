// lib/planRead/review.js
//
// "What this price includes / Check before sending" — the owner (2026-10-05):
// "it should say things it didn't take into consideration that are worth
// having reviewed by a human, and what it took into consideration."
//
// Two lists, built in code from what the first pass produced:
//
//   included   what the price rests on, each with its basis and source:
//              quantities per area (and the sheet), coats, height, prep,
//              access, the crew plan, overhead, the target margin, past jobs,
//              the assumptions it priced on.
//   checks     what it could NOT price or verify and a person should look at,
//              each with why and what to check — from the model (its open
//              questions, what the drawings show but it could not measure)
//              and from deterministic rules (a FieldQuo default used instead
//              of the company's own figure, a low-confidence quantity, the
//              client's exclusions, permits and approvals, lifts on a road,
//              lead paint on an old building, weather on exterior work, colour
//              samples…). Only the ones that apply, ranked by likely price
//              impact, at most MAX_CHECKS — read rather than skimmed.
//
// Each check has a stable key; the estimator ticks "Looks right" or "Change"
// (PATCH op review_check), stored on the read with who and when, and carried
// into the draft quote's office notes. Office-only: none of this reaches a
// client document.
//
// Also here: the access status lines ("Scaffold tower — FieldQuo default, not
// your rate…", "Step ladders — you own these, no rental") and the one
// sentence the first pass states about access.
//
// Pure.

import { ACCESS_REASONS, accessReasonLabel } from "./accessReasons";

export const MAX_CHECKS = 8;

const money = (n, currency) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const s = Math.round(v).toLocaleString("en-US");
  return currency ? `${s} ${currency}` : s;
};

/**
 * One line per access item, in plain words: how it is counted in this price.
 * @param access  priceProject().access (first pass)
 * @param model   the stored model (for left-out lines and their reasons)
 */
export function accessStatus(access, model, { currency = null, settingsHref = "/app/settings/services#equipment-access" } = {}) {
  const lines = [];
  for (const a of Array.isArray(access) ? access : []) {
    const name = `${a.label}${a.heightFt ? ` ${Math.round(a.heightFt)} ft` : ""}${a.areaName ? ` — ${a.areaName}` : ""}`;
    const stored = (model?.access || []).find((x) => x.id === a.id) || null;
    const reason = stored?.zeroReason ? accessReasonLabel(stored.zeroReason) : null;
    if (a.price === 0) {
      lines.push({ id: a.id, status: "owned", text: `${name} — ${reason || "you own this, no rental"}${stored?.zeroBy ? ` (${stored.zeroBy}${stored.zeroAt ? `, ${String(stored.zeroAt).slice(0, 10)}` : ""})` : ""}` });
    } else if (a.priceSource === "company") {
      lines.push({ id: a.id, status: "yours", text: `${name} — priced at your rate (${a.rental?.text || ""}, ${money(a.price, currency)})` });
    } else if (a.priceSource === "reference") {
      lines.push({ id: a.id, status: "default", text: `${name} — FieldQuo default, not your rate (${money(a.price, currency)} for ${a.rental?.text || `${a.days} days`}) · set yours`, href: settingsHref });
    } else if (a.priceSource === "person" || a.priceSource === "ai") {
      lines.push({ id: a.id, status: "typed", text: `${name} — ${a.confirmed ? "confirmed" : "your price"} (${money(a.price, currency)})${a.priceSource === "ai" ? " — entered by FieldQuo AI from the conversation, verify" : ""}` });
    } else {
      lines.push({ id: a.id, status: "unpriced", text: `${name} — NOT priced: ${a.why || "no rate"}`, href: settingsHref });
    }
  }
  for (const x of model?.access || []) {
    if (x.included !== false) continue;
    const reason = x.zeroReason ? accessReasonLabel(x.zeroReason) : "no reason given";
    lines.push({ id: x.id, status: "left_out", text: `${x.label || x.equipment} — left out: ${reason}${x.zeroBy ? ` (${x.zeroBy}${x.zeroAt ? `, ${String(x.zeroAt).slice(0, 10)}` : ""})` : ""}`, needsReason: !x.zeroReason });
  }
  return lines;
}

/** The first pass's one sentence about access. */
export function accessSentence(access, { highestFt = 0 } = {}) {
  const list = Array.isArray(access) ? access : [];
  if (!list.length) {
    return highestFt > 12
      ? `No access equipment priced — but the drawings show work up to about ${Math.round(highestFt)} ft. Check how it is reached.`
      : "No access equipment priced — the drawings show nothing above ladder height.";
  }
  const name = (a) => String(a.label || a.equipment || "").toLowerCase();
  const byDefault = list.filter((a) => a.priceSource === "reference").map(name);
  const yours = list.filter((a) => a.priceSource === "company" || a.priceSource === "person").map(name);
  const owned = list.filter((a) => a.price === 0).map(name);
  const none = list.filter((a) => a.price === null).map(name);
  const parts = [];
  if (byDefault.length) parts.push(`${byDefault.join(" and ")} at FieldQuo defaults — no rental if you own them`);
  if (yours.length) parts.push(`${yours.join(" and ")} at your rates`);
  if (owned.length) parts.push(`${owned.join(" and ")} your own (no rental)`);
  if (none.length) parts.push(`${none.join(" and ")} NOT priced`);
  return `Priced with ${parts.join("; ")}.`;
}

/**
 * Both lists for one priced read (or one scoped part of it). Pure.
 *
 * @param o.computed   computeProject() (+ trades) for the read or the part
 * @param o.priced     priceProject() with the first pass
 * @param o.pricing    readPricing() — null for a member who cannot see prices
 * @param o.model      the stored model (assumed, review ticks, questions)
 * @param o.firstPass  firstPassOptions() — the figures in force
 * @param o.ownRates   loadPaintBooks().own — did the company set painting rates
 * @param o.compare    the part's compareToPast() (or null)
 * @param o.currency
 */
export function buildReview({ computed, priced, pricing = null, model = null, firstPass = null, ownRates = {}, compare = null, currency = null } = {}) {
  const included = [];
  const checks = [];
  const add = (c) => checks.push(c);
  const surfaces = (computed?.surfaces || []).filter((s) => s.active);
  const lines = priced?.lines || [];
  const paint = Number(priced?.paintTotal) || 0;
  const assumed = model?.assumed || {};

  // ── Taken into account ──
  const areas = new Map();
  for (const s of surfaces) {
    if (!(s.quantity?.value > 0)) continue;
    const k = s.areaName || "—";
    const sheets = new Set(areas.get(k)?.sheets || []);
    for (const m of String(s.quantity.sourceText || "").matchAll(/\b([A-Z]{1,2}-?\d{1,3})\b/g)) sheets.add(m[1]);
    areas.set(k, { n: (areas.get(k)?.n || 0) + 1, sheets: [...sheets].slice(0, 4) });
  }
  for (const [name, a] of areas) included.push({ key: `qty:${name}`, label: "Quantities", text: `${name}: ${a.n} surface${a.n === 1 ? "" : "s"}${a.sheets.length ? ` from ${a.sheets.join(", ")}` : ""}` });
  const coats = [...new Set(lines.map((l) => l.coats).filter(Boolean))];
  // Which rule priced them: coats change the hours unless the company turned
  // that off (each line's coatHours, lib/pricing/paintTakeoff.js).
  const coatsMoveHours = lines.some((l) => l.coatHours?.applies);
  if (coats.length)
    included.push({
      key: "coats",
      label: "Coats",
      text: coatsMoveHours
        ? `${coats.join(" / ")} coats — each coat adds its share of the hours (your rates are for each surface's standard coats), and its paint`
        : `${coats.join(" / ")} coats — coats move the paint, not the hours (you price the coats into your rates)`,
    });
  const high = lines.filter((l) => l.height && l.height.factor > 1);
  if (high.length) included.push({ key: "height", label: "Height", text: `${high.length} line${high.length === 1 ? "" : "s"} above the rates' ${high[0].height.basisFt} ft: ${high.slice(0, 3).map((l) => `${l.label} ×${l.height.factor}`).join(", ")} — ${firstPass?.figures?.bandsSource?.name || "High Time Difficulty Factors"}` });
  const prepH = lines.reduce((n, l) => n + (Number(l.prepHours) || 0), 0);
  if (prepH > 0) included.push({ key: "prep", label: "Prep", text: `${Math.round(prepH * 10) / 10} h as the lines' prep hours (substrate, colours, setup)` });
  for (const a of accessStatus(priced?.access, model, { currency })) included.push({ key: `access:${a.id}`, label: "Access", text: a.text, href: a.href || null });
  if (priced?.materials?.items?.length) {
    const m = priced.materials;
    included.push({ key: "materials", label: "Materials", text: `${m.items.length} items: ${m.items.slice(0, 4).map((i) => `${i.qty} ${i.unit} ${String(i.label).toLowerCase()}`).join(", ")}${m.items.length > 4 ? "…" : ""} — total ${money(m.total, currency)}` });
    const byDefault = m.items.filter((i) => i.priceSource === "default");
    if (byDefault.length) add({ key: "default:materials", source: "rule", impact: byDefault.reduce((n, i) => n + (i.total || 0), 0), text: `${byDefault.length} material price${byDefault.length === 1 ? "" : "s"} at FieldQuo defaults (${byDefault.map((i) => i.label).slice(0, 3).join(", ")})`, why: "No price of yours on file", check: "Set your prices in Settings → Services → Access, height and prep", href: "/app/settings/services#prep-materials" });
    if (m.unpriced) add({ key: "unpriced:materials", source: "rule", impact: 500, text: `${m.unpriced} material(s) with no price`, why: "Counted but not costed", check: "Set the price", href: "/app/settings/services" });
  }
  if (priced?.plan) included.push({ key: "crew", label: "Crew plan", text: `${priced.plan.hours} h: ${priced.plan.days} days for ${priced.plan.crew.size} painters at ${priced.plan.crew.hoursPerDay} h a day (${priced.plan.crew.sizeWhy})` });
  const r = pricing?.recommendation || null;
  if (r) {
    const o = r.overhead;
    included.push({ key: "overhead", label: "Overhead", text: o.basis === "per_hour" ? `${o.share ? Math.round(o.share * 1000) / 10 : 0}% of your month by crew time` : o.basis === "per_job" ? "your month split by jobs a month" : `${o.pct}% of the price (FieldQuo estimate)` });
    included.push({ key: "target", label: "Target margin", text: `${r.targetPct}%${r.targetIsDefault ? " (FieldQuo default)" : ""}` });
  }
  if (compare) included.push({ key: "past", label: "Past jobs", text: `${compare.count} of your jobs of this trade: ${compare.range.low}–${compare.range.high} per sq ft; this one is ${compare.position} the range` });
  const ASSUMED_WORDS = { exteriorSurface: "Outside walls", interiorSurface: "Inside walls", colours: "Colours", heritage: "Heritage", siteHours: "Site hours", occupied: "Occupied" };
  const said = Object.entries(assumed).filter(([, v]) => v?.value);
  if (said.length) included.push({ key: "assumed", label: "Assumptions", text: said.map(([k, v]) => `${ASSUMED_WORDS[k] || k}: ${String(v.value).replace(/_/g, " ")}`).join(" · ") });

  // ── Not taken into account — worth a human check ──
  // (a) the model's own open questions and assumptions: merged here, not
  // listed twice on the screen.
  for (const q of (computed?.questions || []).filter((x) => !x.resolved)) add({ key: `q:${q.id}`, source: "model", impact: 40, text: q.text, why: "The read could not settle this from the drawings", check: "Answer it, or confirm the draft's assumption" });
  for (const [i, a] of (computed?.assumptions || []).entries()) add({ key: `a:${i}`, source: "model", impact: 20, text: a, why: "Assumed by the read", check: "Confirm it holds for this job" });
  // (b) deterministic rules.
  if (paint > 0 && !ownRates?.interior_painting && !ownRates?.exterior_painting) add({ key: "default:rates", source: "rule", impact: paint, text: "Priced at FieldQuo's default painting rates, not yours", why: "You have not set your own production rates", check: "Set your rates in Settings → Services", href: "/app/settings/services" });
  if (r?.labour?.source === "fallback") add({ key: "default:labour", source: "rule", impact: r.labour.cost || 0, text: `Labour cost at FieldQuo's ${r.labour.rate}/h default`, why: "No crew pay rate on file", check: "Set pay rates in Team", href: "/app/settings/team/workers#pay-rates" });
  if (r?.overhead?.basis === "pct_of_price") add({ key: "default:overhead", source: "rule", impact: r.overhead.amountAtRecommended || 0, text: `Overhead as ${r.overhead.pct}% of the price — a FieldQuo estimate`, why: "Overhead and billable hours are not set", check: "Set them in Settings → Overhead", href: "/app/settings/overhead" });
  if (r?.targetIsDefault) add({ key: "default:target", source: "rule", impact: (r.recommended || 0) * 0.05, text: `Target margin at FieldQuo's ${r.targetPct}% default`, why: "No target margin set", check: "Set yours in Settings → Overhead", href: "/app/settings/overhead" });
  for (const a of (priced?.access || []).filter((x) => x.priceSource === "reference")) add({ key: `default:access:${a.id}`, source: "rule", impact: a.price || 0, text: `${a.label} at a FieldQuo default rental rate (${money(a.price, currency)})`, why: a.why, check: "Confirm it, enter your rate, or mark it owned", href: "/app/settings/services#equipment-access" });
  for (const a of (priced?.access || []).filter((x) => x.price === null)) add({ key: `unpriced:access:${a.id}`, source: "rule", impact: 2000, text: `${a.label} is not priced`, why: a.why, check: "Type your price or set your rate", href: "/app/settings/services#equipment-access" });
  if (priced?.plan?.crew?.sizeWhy && /FieldQuo's default/.test(priced.plan.crew.sizeWhy)) add({ key: "default:crew", source: "rule", impact: 50, text: "Crew of 2 painters assumed", why: priced.plan.crew.sizeWhy, check: "Set the crew on this read, or add your field crew in Team" });
  for (const s of (computed?.unmeasured || [])) add({ key: `unmeasured:${s.id}`, source: "rule", impact: 3000, text: `${s.areaName ? `${s.areaName} — ` : ""}${s.label} has no quantity and is not priced`, why: "Nothing measured it", check: "Measure it on the sheet or tell the chat its size" });
  const low = surfaces.filter((s) => s.quantity?.confidence === "low" || (s.quantity?.estimated && !s.quantity.confidence)).map((s) => ({ s, value: lines.filter((l) => l.surfaceId === s.id).reduce((n, l) => n + (Number(l.amount) || 0), 0) })).sort((a, b) => b.value - a.value);
  for (const { s, value } of low.slice(0, 3)) add({ key: `low:${s.id}`, source: "rule", impact: value, text: `${s.label}: ${s.quantity.value} ${s.quantity.unit} is low confidence`, why: String(s.quantity.sourceText || "").slice(0, 160), check: "Check it against the sheet" });
  if (surfaces.some((s) => /assumed .* (?:storey|wall) height/.test(s.heightBasis || ""))) add({ key: "assumed:height", source: "rule", impact: 600, text: "A wall height was assumed — nothing on the set states it", why: "No section or printed height", check: "Confirm the ceiling height" });
  if (lines.some((l) => l.height?.bands?.some((b) => b.key === "b6"))) add({ key: "height:extrapolated", source: "rule", impact: 800, text: "Work above 21 ft — the height factor is extrapolated", why: "The book's table stops at 21 ft; FieldQuo carries ×2.2 on", check: "Check the hours for the highest work" });
  for (const [i, e] of (computed?.exclusions || []).entries()) add({ key: `excl:${i}`, source: "rule", impact: 300, text: `Excluded: ${e}`, why: "Left out of this price", check: "Confirm with the client that it is excluded" });
  const exterior = surfaces.some((s) => s.itemKey === "siding_trim" || s.itemKey === "soffit_fascia" || s.itemKey === "ext_trim");
  const lifts = (priced?.access || []).some((a) => ["boom_lift", "scissor_lift", "swing_stage", "crane"].includes(a.equipment));
  if (assumed.heritage?.value === "listed") add({ key: "heritage:consent", source: "rule", impact: 900, text: "Heritage / conservation consent", why: "A listed or heritage building usually needs approval for colours and methods", check: "Confirm consent, permitted coatings and methods" });
  if (lifts && exterior) add({ key: "lift:road", source: "rule", impact: 500, text: "Lift on site: parking, ground and any road or pavement closure", why: "Lifts need hard standing and sometimes a permit", check: "Check access for the lift and any permit or closure cost" });
  if (/church|historic|heritage|victorian|chapel|listed/i.test(`${computed?.buildingType || ""} ${computed?.summary || ""}`) || assumed.heritage?.value === "listed") add({ key: "lead", source: "rule", impact: 700, text: "Lead paint — an older building", why: "Paint on buildings from before 1980 may contain lead", check: "Test before sanding; price the safe-removal method if positive" });
  if (assumed.siteHours?.value === "out_of_hours") add({ key: "after_hours", source: "rule", impact: 600, text: "Out-of-hours work", why: "Any premium you pay the crew is not in this price", check: "Add the premium" });
  if (exterior) add({ key: "weather", source: "rule", impact: 200, text: "Weather and season for the exterior", why: "Exterior coatings need dry weather and minimum temperatures", check: "Check the programme and any allowance for lost days" });
  if (Number(assumed.colours?.value) > 1) add({ key: "samples", source: "rule", impact: 100, text: "Colour samples and sign-off", why: `${assumed.colours.value} colours`, check: "Allow for samples or a mock-up if the client wants one" });
  if (priced?.plan?.deliveryNote) add({ key: "delivery", source: "rule", impact: 300, text: "Delivery and pickup of lifts and towers", why: priced.plan.deliveryNote, check: "Add delivery or set your per-trip figure", href: "/app/settings/services#equipment-access" });
  if (paint > 0 && priced?.unpricedCount > 0) add({ key: "default:paint", source: "rule", impact: 400, text: `${priced.unpricedCount} line(s) use a paint with no price`, why: "Their paint is counted but not costed", check: "Set paint prices in Settings → Services", href: "/app/settings/services" });

  // Rank by price impact; keep the ticks; cap.
  const ticks = model?.review && typeof model.review === "object" ? model.review : {};
  // The read's own open questions are never cut: the screen shows them HERE
  // instead of in a list of their own, so a cap that dropped one would lose
  // it. The rest fill up to MAX_CHECKS by impact; whatever falls past the cap
  // is returned as `more` (shown collapsed), never thrown away.
  const all = checks
    .filter((c, i) => checks.findIndex((x) => x.key === c.key) === i)
    .sort((a, b) => (Number(b.impact) || 0) - (Number(a.impact) || 0))
    .map((c) => ({ ...c, impact: undefined, tick: ticks[c.key] || null }));
  const questions = all.filter((c) => c.key.startsWith("q:"));
  const others = all.filter((c) => !c.key.startsWith("q:"));
  const room = Math.max(0, MAX_CHECKS - questions.length);
  const top = new Set([...questions, ...others.slice(0, room)].map((c) => c.key));
  const ranked = all.filter((c) => top.has(c.key));
  const more = all.filter((c) => !top.has(c.key));
  return {
    included,
    checks: ranked,
    more,
    unreviewed: ranked.filter((c) => !c.tick).length,
    accessSentence: accessSentence(priced?.access, { highestFt: Math.max(0, ...surfaces.map((s) => Number(s.topFt) || 0)) }),
    reasons: ACCESS_REASONS,
  };
}
