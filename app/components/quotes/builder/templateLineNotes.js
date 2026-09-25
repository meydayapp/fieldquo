// app/components/quotes/builder/templateLineNotes.js
//
// The words the line table prints under a line that came from a service
// template (lib/quotes/serviceTemplateLines.js) — where its quantity came
// from, or which measurement would fill it — and the bar over each template
// run. One function the quote builder and the invoice builder both hand to
// LineItemsTable, so the two screens cannot say it two ways.
//
// Staff-only: none of this is on the line the client reads; it is derived
// from the line's `meta.template` at render time.

import { MEASUREMENT_KEYS } from "@/lib/services/measurementKeys";
import { calculatorFor, templateRunOf, refillableCount } from "@/lib/quotes/serviceTemplateLines";

const CALC_FALLBACK = {
  paint: "room takeoff",
  flooring: "flooring takeoff",
  siding: "siding takeoff",
  roof: "roof takeoff",
  roofSatellite: "satellite roof measurement",
  gutter: "gutter takeoff",
  stairs: "stair takeoff",
  cabinet: "cabinet door and drawer counts",
  lot: "lot measure",
  cleaning: "cleaning details",
  intake: "service details",
};

export function measureLabel(t, key) {
  return t(`app.serviceTemplates.measure_${key}`, MEASUREMENT_KEYS[key]?.label || key);
}

export function calcLabel(t, calc) {
  return t(`app.templateLines.calc_${calc}`, CALC_FALLBACK[calc] || calc);
}

/**
 * @param item            the line
 * @param index           its index in `items`
 * @param items           every line in the table (a run's bar sits over its first)
 * @param groups          the quote's scope groups ([] on an invoice — no calculators)
 * @param measurements    measurementsFromGroups(...) for this table's group, or null
 * @param onOpenCalculator(tempId) or null — opens a group's takeoff
 * @param onRefill(runId) or null
 * @returns { bar, note } — either may be null
 */
export function describeTemplateLine({ t, language, item, index, items, groups = [], measurements = null, onOpenCalculator = null, onRefill = null }) {
  const m = templateRunOf(item);
  if (!m) return { bar: null, note: null };
  const fmt = (n) => Number(n).toLocaleString(language || "en", { maximumFractionDigits: 2 });

  // The bar: over the first line of each run.
  let bar = null;
  const prev = index > 0 ? templateRunOf(items[index - 1]) : null;
  if (!prev || prev.runId !== m.runId) {
    const count = items.filter((x) => templateRunOf(x)?.runId === m.runId && !templateRunOf(x)?.heading).length;
    const canFill = onRefill && measurements ? refillableCount(items, m.runId, measurements) : 0;
    bar = {
      text: t("app.templateLines.runBar", "{service} · from its template · {count} lines", { service: m.service || "", count }),
      action: canFill > 0 ? { label: t("app.templateLines.refill", "Fill {count} from measurements", { count: canFill }), onClick: () => onRefill(m.runId) } : null,
    };
  }

  if (m.heading) return { bar, note: null };

  let note = null;
  if (m.filled) {
    // The group is named too: an interior and an exterior painting group
    // both have walls, and the estimator should see which walls were used.
    const from = m.filled.groupLabel ? `${calcLabel(t, m.filled.calc)} (${m.filled.groupLabel})` : calcLabel(t, m.filled.calc);
    note = {
      tone: "muted",
      text: t("app.templateLines.filledFrom", "From {calc} — {measure}: {value}", { calc: from, measure: measureLabel(t, m.measurementKey), value: fmt(m.filled.value) }),
    };
  } else if (m.awaiting && !(Number(item.amount) > 0)) {
    const where = calculatorFor(m.measurementKey, groups);
    const measure = measureLabel(t, m.measurementKey);
    if (where?.groupTempId && onOpenCalculator) {
      note = {
        tone: "warn",
        text: t("app.templateLines.awaitingOnQuote", "Needs {measure} — measured in {group}.", { measure, group: where.groupLabel || calcLabel(t, where.calc) }),
        action: { label: t("app.templateLines.openCalculator", "Open {calc}", { calc: calcLabel(t, where.calc) }), onClick: () => onOpenCalculator(where.groupTempId) },
      };
    } else if (where) {
      note = {
        tone: "warn",
        text: t("app.templateLines.awaitingNotOnQuote", "Needs {measure} — the {calc} measures it, and it isn't on this document. Type the quantity.", { measure, calc: calcLabel(t, where.calc) }),
      };
    } else {
      note = { tone: "warn", text: t("app.templateLines.awaitingTyped", "Type the quantity — {measure}.", { measure }) };
    }
  } else if (m.unpriced && !(Number(item.rate) > 0)) {
    note = { tone: "warn", text: t("app.templateLines.unpriced", "The template has no price for this line — set your rate.") };
  }
  return { bar, note };
}
