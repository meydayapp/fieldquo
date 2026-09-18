// docs/screens/app-guide/harness/TakeoffFrame.jsx
//
// One trade's quote card, as the estimator sees it in the builder — for the
// intro email's per-trade screenshot (lib/sales/outreach/introScreenshots.js).
//
// The owner: "make sure that little screenshot image represents the trade of
// the company it is being sent to — a plumber gets the plumbing quote, the
// roofing one has the little satellite image, paving has the polygons and
// measurements". So this renders the REAL builder card for a trade — the
// TradeTakeoff the quote builder mounts for the trades quoted by counting
// things, the LotAreaMeasure the landscaping trades draw on — seeded with a
// filled takeoff, inside the same providers the builder runs under. Nothing
// here is a mock of the product: a takeoff that will not render here will
// not render in the builder either (scripts/check-takeoff-render.jsx makes
// the same point for the blank state).
//
// Two of the cards ask the server to measure — roofing and gutters — and the
// picture the owner wants is the one AFTER that answer. The scene
// ("takeoff-measure", guide.jsx) types the address and presses "Measure from
// satellite"; fixtures/routes-help.js answers /api/measure/roof and
// /api/measure/gutters with a fixed measurement whose satellite still is a
// live Google Static Maps tile of a real house (the key comes in on the
// query string from shoot.mjs; without one the fixture answers with no
// image and the frame is the numbers alone).
import React, { useState } from "react";
import CompanyPreferencesProvider from "@/app/providers/CompanyPreferencesProvider";
import TradeTakeoff from "@/app/components/quotes/builder/TradeTakeoff";
import LotAreaMeasure from "@/app/components/quotes/builder/LotAreaMeasure";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import { createTradeConfig } from "@/lib/pricing/tradeScope";
import { TRADE_CATALOG } from "@/lib/trades/catalog";
import { hasTakeoff } from "@/lib/pricing/takeoffTrades";
import { isLotMeasureTrade } from "@/lib/measure/lotTakeoff";
import { COMPANY } from "./fixtures/company.js";
import { SITE_IMAGE, SITE_ADDRESS, TAKEOFF_SEEDS, LOT_INTAKE } from "./fixtures/takeoffs.js";

export default function TakeoffFrame({ trade }) {
  const label = TRADE_CATALOG[trade]?.label || trade;
  const seed = TAKEOFF_SEEDS[trade] || {};
  // Held in state, the way the builder holds a group's takeoff: the roofing
  // and gutter panels APPLY the measurement through onChange, and the frame
  // is the card with those fields filled.
  const [takeoff, setTakeoff] = useState(() => (hasTakeoff(trade) ? { ...(createTradeConfig(trade) || {}), ...seed } : null));
  const book = getPriceBook(trade);
  return (
    <CompanyPreferencesProvider initialCurrency={COMPANY.currency}>
      <div className="min-h-screen bg-background p-6" data-takeoff-frame={trade}>
        <div className="mx-auto rounded-xl border border-border bg-card p-5 space-y-4" style={{ width: 1120 }}>
          {/* The trade's catalogue label — the one word on this card that is
              not the product's own, and a proper noun in every language. */}
          <h2 className="text-lg font-semibold text-foreground">{label}</h2>
          {takeoff && book ? (
            <TradeTakeoff
              categoryKey={trade}
              takeoff={takeoff}
              book={book}
              onChange={setTakeoff}
              siteImageUrl={SITE_IMAGE.url}
              siteImageScale={SITE_IMAGE.scale}
              siteAddress={SITE_ADDRESS}
            />
          ) : isLotMeasureTrade(trade) ? (
            <LotAreaMeasure
              intakeValues={LOT_INTAKE[trade]?.intakeValues || {}}
              fields={LOT_INTAKE[trade]?.fields || []}
              onIntakeChange={() => {}}
              imageUrl={SITE_IMAGE.url}
              imageScale={SITE_IMAGE.scale}
              siteLocation={SITE_IMAGE.location}
              siteAddress={SITE_ADDRESS}
              onTakeoffChange={() => {}}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No takeoff card for {trade}.</p>
          )}
        </div>
      </div>
    </CompanyPreferencesProvider>
  );
}
