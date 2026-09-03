// scripts/check-currency-render.jsx
//
// The other half of check-app-currency.mjs.
//
// That script proves the hardcoded "$" is GONE from the source. This one
// proves what replaced it WORKS: it renders three real takeoff forms through
// the real provider at three currencies and reads the output.
//
// The distinction matters because a source scan can be satisfied by deleting
// the amount, and because "no literal dollar" is not the same claim as "a
// British painter sees pounds". Only rendering answers the second.
//
// Bundled with esbuild rather than run directly, for the reason
// check-takeoff-render.jsx already carries: these are JSX modules behind the
// @/ alias, which bare Node resolves neither of.
//
// Run: npm run check:currency-render
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TradeTakeoff from "../app/components/quotes/builder/TradeTakeoff.js";
import PaintAreas from "../app/components/quotes/builder/PaintAreas.js";
import { LanguageProvider } from "../app/providers/LanguageProvider.js";
import CompanyPreferencesProvider from "../app/providers/CompanyPreferencesProvider.js";
import { getPriceBook } from "../app/data/tradePriceBooks.js";

let fail = 0;
const t = (name, cond, extra = "") => {
  if (!cond) { fail++; console.log(`FAIL ${name} ${extra}`); }
  else console.log(`pass ${name}`);
};

function render(currency, node) {
  return renderToStaticMarkup(
    <LanguageProvider initialLanguage="en">
      <CompanyPreferencesProvider initialCurrency={currency}>
        {node}
      </CompanyPreferencesProvider>
    </LanguageProvider>,
  );
}

const interior = (
  <TradeTakeoff
    categoryKey="interior_painting"
    takeoff={{ rooms: [{ roomType: "bedroom", floorSqft: 200, ceiling: true, trim: true, doors: true, doorCount: 2 }] }}
    book={getPriceBook("interior_painting")}
    onChange={() => {}}
  />
);
const gutters = (
  <TradeTakeoff
    categoryKey="gutter_services"
    takeoff={{ workType: "replacement", gutterFt: 120, storeys: "two", downspoutsInstalled: 3 }}
    book={getPriceBook("gutter_services")}
    onChange={() => {}}
  />
);
const paint = (
  <PaintAreas
    takeoff={{ model: "area_substrate", areas: [{ areaType: "den", label: "Den", measurement: "room", lengthFt: 12, widthFt: 14, heightFt: 8, substrates: [{ key: "walls", coats: 2 }] }] }}
    book={getPriceBook("interior_painting")}
    onChange={() => {}}
  />
);

for (const [label, node] of [["interior painting", interior], ["gutters", gutters], ["paint areas", paint]]) {
  const gbp = render("GBP", node);
  const usd = render("USD", node);
  const cad = render("CAD", node);
  t(`${label}: GBP renders £`, gbp.includes("£"), gbp.slice(0, 0));
  t(`${label}: GBP renders NO $`, !gbp.includes("$"),
    (gbp.match(/.{0,40}\$.{0,25}/) || [""])[0]);
  t(`${label}: USD says US$`, usd.includes("US$"));
  t(`${label}: CAD says $ and not US$`, cad.includes("$") && !cad.includes("US$"));
  t(`${label}: GBP groups thousands`, !/£\d{4}/.test(gbp),
    (gbp.match(/£\d{4}[^<]*/) || [""])[0]);
}

// The number itself must not have changed — only its label.
const digits = (h) => (h.match(/[\d,]+\.\d\d/g) || []).join("|");
const a = digits(render("CAD", gutters)).replace(/,/g, "");
const b = digits(render("GBP", gutters)).replace(/,/g, "");
t("the amounts are identical across currencies, only the symbol moves", a === b && a.length > 0,
  `\n  CAD ${a}\n  GBP ${b}`);

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — the back office renders the company's own currency\n");
process.exit(fail ? 1 : 0);
