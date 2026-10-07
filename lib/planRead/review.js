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

const andList = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

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
    if (a.priceSource === "not_needed") {
      lines.push({ id: a.id, status: "not_needed", text: `${name} — ${a.why}` });
    } else if (a.price === 0 && a.priceSource === "default_owned") {
      lines.push({ id: a.id, status: "owned", text: `${name}${a.covers?.length > 1 ? ` (one set, ${a.covers.length} areas)` : ""} — you own these, no rental (FieldQuo assumes so) · set a rental rate if you hire them`, href: settingsHref });
    } else if (a.price === 0) {
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
  // Grouped and counted — "boom lift, 7 scaffolds and a scissor lift", not
  // the church's "scaffolding and scaffolding and scaffolding…" — each
  // group said once, unpriced kinds listed once.
  const items = list.filter((a) => a.equipment !== "delivery");
  const group = (rows) => {
    const n = new Map();
    for (const a of rows) n.set(a.equipment, (n.get(a.equipment) || 0) + 1);
    return [...n].map(([eq, count]) => countName(eq, count));
  };
  const and = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const byDefault = group(items.filter((a) => a.priceSource === "reference" && a.price > 0));
  const yours = group(items.filter((a) => (a.priceSource === "company" || a.priceSource === "person" || a.priceSource === "ai") && a.price > 0));
  const owned = group(items.filter((a) => a.price === 0 && a.priceSource !== "not_needed"));
  const notNeeded = group(items.filter((a) => a.priceSource === "not_needed"));
  const none = group(items.filter((a) => a.price === null));
  const parts = [];
  if (byDefault.length) parts.push(`${and(byDefault)} at FieldQuo defaults — no rental if you own them`);
  if (yours.length) parts.push(`${and(yours)} at your rates`);
  if (owned.length) parts.push(`${and(owned)} your own (no rental)`);
  if (none.length) parts.push(`${and(none)} NOT priced`);
  if (notNeeded.length) parts.push(`${and(notNeeded)} not needed — the inside walls are low`);
  return `Priced with ${parts.join("; ")}.`;
}

const PLURAL = { step_ladder: "ladders", extension_ladder: "ladders", scaffold: ["scaffold", "scaffolds"], scissor_lift: ["scissor lift", "scissor lifts"], boom_lift: ["boom lift", "boom lifts"], swing_stage: ["swing stage", "swing stages"], crane: ["crane", "cranes"] };
/** "boom lift", "7 scaffolds", "ladders" — ladders are one set, never counted. */
export function countName(equipment, count) {
  const p = PLURAL[equipment];
  if (typeof p === "string") return p;
  const [one, many] = Array.isArray(p) ? p : [String(equipment).replace(/_/g, " "), `${String(equipment).replace(/_/g, " ")}s`];
  return count > 1 ? `${count} ${many}` : one;
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
export function buildReview({ computed, priced, pricing = null, model = null, firstPass = null, ownRates = {}, compare = null, currency = null, parts = null } = {}) {
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
    // The pages the measured faces are on ("p5" -> page 5); otherwise sheet
    // numbers in the source sentence -- never "A3", the paper size.
    for (const id of s.quantity.faceIds || []) sheets.add(`page ${String(id).split(".")[0].replace(/^p/, "")}`);
    if (!(s.quantity.faceIds || []).length) for (const m of String(s.quantity.sourceText || "").matchAll(/\b([A-Z]{1,2}-\d{1,3}[A-Z]?|[A-Z]{1,2}\d{3})\b/g)) sheets.add(m[1]);
    const prev = areas.get(k) || { n: 0, sqft: 0 };
    areas.set(k, { n: prev.n + 1, sqft: prev.sqft + (s.quantity.unit === "sqft" ? Number(s.quantity.value) || 0 : 0), sheets: [...sheets].slice(0, 5), source: s.quantity.source });
  }
  for (const [name, a] of areas) included.push({ key: `qty:${name}`, label: "Quantities", text: `${name}: ${a.sqft ? `${Math.round(a.sqft).toLocaleString("en-US")} sq ft` : `${a.n} surface${a.n === 1 ? "" : "s"}`}${a.sheets.length ? ` — measured on ${a.sheets.join(", ")}` : a.source === "estimate" ? " — estimated, verify" : ""}` });
  // One room, one wall, one state of the building, however many sheets draw
  // it (lib/planRead/sameSurface.js) — what was merged, and which state.
  const ss = computed?.sameSurface || null;
  if (ss?.merged?.length) {
    const names = ss.merged.slice(0, 6).map((g) => `${g.name} (${g.others.length + 1} drawings)`);
    included.push({ key: "qty:same", label: "Quantities", text: `Drawn on more than one sheet, counted once: ${andList(names)}${ss.merged.length > 6 ? ` and ${ss.merged.length - 6} more` : ""} — each from its best drawing (printed sizes, then the larger scale, then the drawing as existing)` });
  }
  if (ss?.state) {
    const existingTitles = andList(ss.drawings.existing.map((x) => `“${x}”`));
    const proposedTitles = andList(ss.drawings.proposed.map((x) => `“${x}”`));
    included.push({ key: "qty:state", label: "Quantities", text: ss.state.value === "existing" ? `Priced on the existing layout (${existingTitles}), not the proposed one (${proposedTitles})` : `Priced on the existing layout (${existingTitles}) with the proposed new rooms (${proposedTitles})` });
    const whoChose = ss.state.source === "person" ? "Your team chose it" : ss.state.source === "request" ? `The request says “${ss.state.words}”` : "A repaint prices the rooms that exist now, and the request does not mention the extension or new rooms";
    if (ss.state.value === "existing" && ss.outNames?.length) {
      add({
        key: "plan_state:existing",
        source: "rule",
        impact: 3500,
        text: `Priced the existing layout; the proposed extension rooms ${andList(ss.outNames)} are not included — include them?`,
        why: `The drawings show the building as it stands (${existingTitles}) and as proposed (${proposedTitles}) — one is priced, never both. ${whoChose}.`,
        check: "Include them if the extension is part of this job",
        choices: [{ op: "set_plan_state", value: "with_new", label: "Include them" }],
      });
    }
    if (ss.state.value === "with_new" && ss.newNames?.length) {
      add({
        key: "plan_state:with_new",
        source: "rule",
        impact: 3500,
        text: `Priced the existing layout plus the proposed new rooms ${andList(ss.newNames)} — leave them out?`,
        why: `The drawings show the building as it stands (${existingTitles}) and as proposed (${proposedTitles}). ${whoChose}.`,
        check: "Leave them out if the extension is not part of this job",
        choices: [{ op: "set_plan_state", value: "existing", label: "Existing rooms only" }],
      });
    }
  }
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
  // Heights and bands -- always said when the read has them, factor or not.
  const high = lines.filter((l) => l.height && l.height.factor > 1);
  const tops = surfaces.filter((s) => Number(s.topFt) > 0).sort((a, b) => b.topFt - a.topFt);
  if (tops.length || high.length) {
    const basis = high[0]?.height?.basisFt ?? firstPass?.figures?.book?.heightBasisFt ?? 9;
    const tallest = tops.slice(0, 3).map((s) => `${s.label} to ${Math.round(s.topFt * 10) / 10} ft`).join(", ");
    included.push({
      key: "height",
      label: "Height",
      text: `${tallest ? `${tallest}. ` : ""}${high.length ? `${high.length} line${high.length === 1 ? "" : "s"} above the rates' ${basis} ft, banded: ${high.slice(0, 3).map((l) => `${l.label} ×${l.height.factor}`).join(", ")}` : `nothing above the rates' ${basis} ft — no height factor`} — ${firstPass?.figures?.bandsSource?.name || "High Time Difficulty Factors"}`,
    });
  }
  // Where each inside wall height came from: a section, a photo, or the
  // outside eaves as a lower bound (lib/planRead/takeoff.js wallHeight).
  const ft1 = (v) => Math.round(Number(v) * 10) / 10;
  const bySource = (src) => surfaces.filter((s) => s.wallCap && !s.wallCap.roofOnly && s.wallCap.source === src);
  const fromSection = bySource("section");
  const fromPhoto = bySource("photo");
  const lowerBound = bySource("outside_eaves");
  const listOf = (xs) => xs.slice(0, 4).map((s) => `${s.label} ${ft1(s.wallCap.toFt)} ft`).join(", ");
  if (fromSection.length) included.push({ key: "height:section", label: "Height", text: `Inside wall height from the section: ${listOf(fromSection)}` });
  if (fromPhoto.length) included.push({ key: "height:photo", label: "Height", text: `Inside wall height estimated from the interior photos: ${listOf(fromPhoto)}` });
  if (lowerBound.length) included.push({ key: "height:outside-eaves", label: "Height", text: `Inside wall height taken from the outside eaves as a lower bound (no section or photo gives it): ${listOf(lowerBound)} — never the ridge` });
  // Prep, broken down: each allowance by the area it covers (the condition
  // the read assumed), the daily setup and clean-up, and anything typed — so
  // "130 h of 242" can be read, and an assumption behind it changed.
  const prepH = lines.reduce((n, l) => n + (Number(l.prepHours) || 0), 0);
  if (prepH > 0) {
    const steps = new Map();
    let typed = 0;
    for (const l of lines) {
      if (l.setup || !l.prep) continue;
      if (l.prep.manual !== null && l.prep.manual !== undefined) {
        typed += Number(l.prep.manual) || 0;
        continue;
      }
      for (const x of l.prep.auto?.lines || []) {
        const cur = steps.get(x.key) || { label: x.label, sqft: 0, hours: 0, perSqft: x.perSqft };
        cur.sqft += Number(x.quantity) || 0;
        cur.hours += Number(x.hours) || 0;
        steps.set(x.key, cur);
      }
    }
    const h1 = (v) => Math.round(v * 10) / 10;
    const parts = [...steps.values()].sort((x, y) => y.hours - x.hours).map((x) => `${x.label} ${h1(x.perSqft * 100)} h/100 sq ft × ${Math.round(x.sqft).toLocaleString("en-US")} sq ft = ${h1(x.hours)} h`);
    const setupH = Number(priced?.plan?.setupHours) || 0;
    const said = (k) => assumed[k]?.value && assumed[k]?.source !== "person";
    const setupWhy = assumed.occupied?.value === "yes" ? `building in use${said("occupied") ? " — ASSUMED by the read, change it under “Priced on”" : ""}` : assumed.heritage?.value === "listed" ? `heritage building${said("heritage") ? " — ASSUMED by the read, change it under “Priced on”" : ""}` : null;
    if (setupH > 0) parts.push(`daily setup and clean-up ${h1(setupH)} h (${setupWhy || "setup each day"})`);
    if (typed > 0) parts.push(`typed by your team ${h1(typed)} h`);
    const condition = [assumed.interiorSurface?.value && `inside walls “${String(assumed.interiorSurface.value).replace(/_/g, " ")}”`, assumed.exteriorSurface?.value && `outside walls “${String(assumed.exteriorSurface.value).replace(/_/g, " ")}”`].filter(Boolean).join(", ");
    included.push({ key: "prep", label: "Prep", text: `${h1(prepH)} h of prep${condition ? ` for ${condition}` : ""}: ${parts.join("; ") || "on the lines"}` });
  }
  for (const a of accessStatus(priced?.access, model, { currency })) included.push({ key: `access:${a.id}`, label: "Access", text: a.text, href: a.href || null });
  if (priced?.materials?.items?.length) {
    const m = priced.materials;
    included.push({ key: "materials", label: "Materials", text: `${m.items.length} items: ${m.items.slice(0, 4).map((i) => `${i.qty} ${i.unit} ${String(i.label).toLowerCase()}`).join(", ")}${m.items.length > 4 ? "…" : ""} — total ${money(m.total, currency)}` });
    const byDefault = m.items.filter((i) => i.priceSource === "default");
    if (byDefault.length) add({ key: "default:materials", source: "rule", impact: byDefault.reduce((n, i) => n + (i.total || 0), 0), text: `${byDefault.length} material price${byDefault.length === 1 ? "" : "s"} at FieldQuo defaults (${byDefault.map((i) => i.label).slice(0, 3).join(", ")})`, why: "No price of yours on file", check: "Set your prices in Settings → Services → Access, height and prep", href: "/app/settings/services#prep-materials" });
    if (m.unpriced) add({ key: "unpriced:materials", source: "rule", impact: 500, text: `${m.unpriced} material(s) with no price`, why: "Counted but not costed", check: "Set the price", href: "/app/settings/services" });
  }
  // Crew and days: per quote when the read makes several (an exterior and
  // an interior are two jobs on site), else the read's own plan.
  const planText = (p) => `${p.hours} h ÷ (${p.crew.size} painters × ${p.crew.hoursPerDay} h a day) = ${p.days} days (${p.wholeDays} on site); with 2 / 3 / 4 painters: ${(p.options || []).map((o) => o.days).join(" / ")} days`;
  if (Array.isArray(parts) && parts.length > 1) {
    for (const pt of parts.filter((x) => x.plan)) included.push({ key: `crew:${pt.key}`, label: "Crew plan", text: `${pt.label}: ${planText(pt.plan)} — ${pt.plan.crew.sizeWhy}` });
  } else if (priced?.plan) included.push({ key: "crew", label: "Crew plan", text: `${planText(priced.plan)} — ${priced.plan.crew.sizeWhy}` });
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
  if (lowerBound.length) add({ key: "height:outside-eaves", source: "rule", impact: 3000, text: `Interior wall height taken from outside eaves — measure on site (${lowerBound.length} surface${lowerBound.length === 1 ? "" : "s"}, ${ft1(lowerBound[0].wallCap.toFt)} ft)`, why: "No section or interior photo gives the inside wall height; inside walls under an open roof often rise above the outside eaves, so this is a LOWER bound", check: "Measure the inside wall height (floor to wall plate / truss foot) and give it on the read" });
  if (fromPhoto.length) add({ key: "height:photo", source: "rule", impact: 1500, text: `Interior wall height estimated from a photo (${ft1(fromPhoto[0].wallCap.toFt)} ft) — verify on site`, why: "Judged against a door, a person or a pew in the photo, not measured", check: "Confirm the wall height on site" });
  const roofOnly = surfaces.filter((s) => s.wallCap?.roofOnly);
  if (roofOnly.length) add({ key: "height:roof", source: "rule", impact: 2500, text: `${roofOnly[0].label}: wall height taken from a roof / ridge figure`, why: "No eaves or wall-plate height on the set to stop the wall at", check: "Give the wall height — a ridge height overstates walls" });
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
