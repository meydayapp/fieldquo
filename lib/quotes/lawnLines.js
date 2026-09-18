// lib/quotes/lawnLines.js
//
// A lawn-care selection → the quote lines a lawn_care scope group carries.
//
// The builder has no nested lines: a scope group is a flat list of
// { description, quantity, rate, amount, detail }, and `detail` is the
// paragraph the document prints under a line (lib/documentSections/
// ScopeGroupsSection.js, app/q/[token]). So a PROGRAM is one line whose
// detail lists the treatments it includes, each with its own price — which is
// how the competitor's quote reads too ("Fall Tune-Up 151.76: Weed Control
// 75.88, Fertilization 75.88") — and each ADD-ON is a line of its own.
//
// Every line carries `meta.lawn` so the picker can replace its own lines when
// the estimator changes their mind, and leave the hand-typed ones alone. The
// public instant-quote draft builds its lines from the estimator's breakdown
// instead (createEstimateQuote); lawnLinesFromEstimate below turns that
// breakdown into the same shape, so both doors produce one document.
//
// Pure. scripts/check-lawn-care.mjs executes it.

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

function includedText(services, currencyFormat, language) {
  const lines = (Array.isArray(services) ? services : []).map((s) => {
    const when = s.window ? ` — ${s.window}` : "";
    const price = currencyFormat ? ` (${currencyFormat(s.price)})` : "";
    return `• ${s.name}${price}${when}`;
  });
  const head = language === "fr" ? "Inclus :" : language === "es" ? "Incluido:" : "Includes:";
  return lines.length ? `${head}\n${lines.join("\n")}` : "";
}

/**
 * Lines for a priced offer and a selection.
 *
 * @param offer      { programs, addOns } from priceLawnCare()
 * @param selection  { programKey, addOnKeys }
 * @param opts.currencyFormat  (n) => "CA$75.88" — omitted, prices are not
 *                             repeated in the detail
 * @param opts.language        the document's language, for "Includes:"
 */
export function lawnLinesFromOffer(offer, { programKey = null, addOnKeys = [] } = {}, { currencyFormat = null, language = "en" } = {}) {
  const out = [];
  const program = programKey ? (offer?.programs || []).find((p) => p.key === programKey) : null;
  if (program) {
    const detailParts = [];
    if (program.description) detailParts.push(program.description);
    const included = includedText(program.services, currencyFormat, language);
    if (included) detailParts.push(included);
    out.push({
      description: program.name,
      quantity: 1,
      unit: "season",
      rate: money(program.price),
      amount: money(program.price),
      detail: detailParts.join("\n\n"),
      meta: {
        lawn: {
          kind: "program",
          key: program.key,
          services: (program.services || []).map((s) => ({ key: s.key, name: s.name, price: money(s.price) })),
        },
      },
    });
  }
  const wanted = new Set((Array.isArray(addOnKeys) ? addOnKeys : []).filter((k) => typeof k === "string"));
  for (const a of offer?.addOns || []) {
    if (!wanted.has(a.key)) continue;
    const detailParts = [];
    if (a.description) detailParts.push(a.description);
    if (a.window) detailParts.push(a.window);
    out.push({
      description: a.name,
      quantity: 1,
      unit: "season",
      rate: money(a.price),
      amount: money(a.price),
      detail: detailParts.join("\n"),
      meta: { lawn: { kind: "addon", key: a.key } },
    });
  }
  return out;
}

/** The lines of a group that the picker wrote, and the ones it did not. */
export function splitLawnLines(lineItems) {
  const mine = [];
  const theirs = [];
  for (const li of Array.isArray(lineItems) ? lineItems : []) {
    if (li && typeof li === "object" && li.meta?.lawn) mine.push(li);
    else theirs.push(li);
  }
  return { lawn: mine, other: theirs };
}

/**
 * The instant estimator's flat breakdown (program, then its services
 * indented, then add-ons) folded into the same lines the builder writes, so
 * the draft a homeowner's address produced opens and prints like one an
 * estimator built. `lines` is estimateLawnCare's `lines`.
 */
export function lawnLinesFromEstimate(lines, { currencyFormat = null, language = "en" } = {}) {
  const programs = [];
  const addOns = [];
  for (const l of Array.isArray(lines) ? lines : []) {
    if (l.kind === "program") {
      programs.push({ key: l.key, name: l.name, description: l.description, window: l.window, price: l.price, services: l.services || [] });
    } else if (l.kind === "addon") {
      addOns.push({ key: l.key, name: l.name, description: l.description, window: l.window, price: l.price });
    }
  }
  return lawnLinesFromOffer(
    { programs, addOns },
    { programKey: programs[0]?.key || null, addOnKeys: addOns.map((a) => a.key) },
    { currencyFormat, language },
  );
}
