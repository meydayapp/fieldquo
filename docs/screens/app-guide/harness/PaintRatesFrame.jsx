// docs/screens/app-guide/harness/PaintRatesFrame.jsx
//
// The painting rate card as Settings › Services draws it on the Interior
// Painting row — the REAL PaintRateSets.js with the merged book and its
// overrides held in state, the way ServicesEditor holds them, and opened so
// the frame shows the sets rather than a closed row. The fixture company is
// a cabinet maker whose Services list hides the painting trades, which is
// why the card is framed on its own here rather than through that page.
import React, { useState } from "react";
import CompanyPreferencesProvider from "@/app/providers/CompanyPreferencesProvider";
import PaintRateSets from "@/app/app/settings/services/PaintRateSets";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import { COMPANY } from "./fixtures/company.js";

export default function PaintRatesFrame() {
  const [overrides, setOverrides] = useState({
    takeoff: { rateSets: { interior: { rates: { walls_16ft: { label: "16 ft walls", substrate: "walls", basis: "production", productionRate: 85 } } } } },
  });
  const book = getPriceBook("interior_painting", overrides);
  return (
    <CompanyPreferencesProvider initialCurrency={COMPANY.currency}>
      <div className="min-h-screen bg-background p-6" data-paint-rates-frame="">
        <div className="mx-auto rounded-xl border border-border bg-card p-5" style={{ width: 900 }}>
          <h2 className="text-lg font-semibold text-foreground">Interior Painting</h2>
          <PaintRateSets book={book} overrides={overrides} onChange={setOverrides} />
        </div>
      </div>
    </CompanyPreferencesProvider>
  );
}
