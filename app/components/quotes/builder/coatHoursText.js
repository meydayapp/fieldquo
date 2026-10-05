// app/components/quotes/builder/coatHoursText.js
//
// "2 coats × 2.07 h a coat = 4.14 h · your rate is for 2 coats" — one line's
// painting hours in coats, from paintCoatHours() in lib/pricing/paintTakeoff.js.
// The quote builder's row and the drawing read's draft line print the same
// words from the same figures, so the two screens cannot explain the same
// hours two ways. Null when coats do not move the line's hours (the company
// turned "Coats change labour time" off, or wallpaper and custom lines).

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function coatHoursText(c, t) {
  if (!c || !c.applies || !(c.coats > 0)) return null;
  const p = {
    coats: c.coats,
    perCoat: r2(c.perCoatHours),
    fixed: r2(c.fixedHours),
    hours: r2(c.workHours),
    standard: c.standardCoats,
  };
  return c.fixedHours > 0.005
    ? t("app.paint.coatsWhyPrep", "{coats} coats × {perCoat} h a coat + {fixed} h of per-piece prep = {hours} h · your rate is for {standard} coats", p)
    : t("app.paint.coatsWhy", "{coats} coats × {perCoat} h a coat = {hours} h · your rate is for {standard} coats", p);
}
