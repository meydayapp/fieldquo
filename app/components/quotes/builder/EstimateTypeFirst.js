// app/components/quotes/builder/EstimateTypeFirst.js
//
// A painting company's first screen on New quote: "What kind of estimate is
// this?" — Interior · Exterior · Cabinets & millwork · Staining · Commercial
// (mockup b1, approved 2026-09-21).
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// The cards shipped inside PaintAreas, which only renders after a service
// tile is picked and the takeoff opened — and createTradeConfig preselects
// the type from the tile, so the question was answered before anyone saw
// it. The owner, on production: "I don't see the changes in the UI/UX for
// painting." The approved screen was never the first thing on the page.
//
// So: for a company whose enabled trades include painting, this renders
// BEFORE the client box, the tiles and everything else, in both builder
// layouts. The pick adds the matching painting service itself — exterior →
// exterior_painting, everything else → interior_painting (the interior book
// carries the cabinet, staining and commercial substrates) — with
// `takeoff.estimateType` set, so there is no tile step for painting. A
// mixed-trade company gets the cards plus "Other trades", which unfolds the
// tiles it always had.
//
// Draws the SAME EstimateTypeCards PaintAreas draws inside the takeoff, so
// the pick made here is the pick shown there — one component, not a copy.
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { EstimateTypeCards } from "./PaintAreas";
import ServiceTiles from "./ServiceTiles";

export const PAINTING_KEYS = Object.freeze(["interior_painting", "exterior_painting"]);

/** The painting categories a company has switched on. */
export function paintingCategoriesOf(categories) {
  return (Array.isArray(categories) ? categories : []).filter((c) => PAINTING_KEYS.includes(c?.key));
}

/**
 * Which painting service an estimate type opens. Exterior work prices from
 * the exterior book; every other type — interior, cabinets, staining,
 * commercial — lives in the interior book's substrate list. Falls back to
 * whichever painting service the company has when it has only one.
 */
export function paintingCategoryFor(estimateType, categories) {
  const painting = paintingCategoriesOf(categories);
  if (painting.length === 0) return null;
  const want = estimateType === "exterior" ? "exterior_painting" : "interior_painting";
  return painting.find((c) => c.key === want) || painting[0];
}

export default function EstimateTypeFirst({ categories = [], onPickType, onAddOther, documentLanguage }) {
  const { t } = useTranslation();
  const [othersOpen, setOthersOpen] = useState(false);
  const others = (Array.isArray(categories) ? categories : []).filter((c) => !PAINTING_KEYS.includes(c?.key));
  // The mockup's card (b1 `.card`): "New painting quote" at 15px/600, the
  // one-line hint, the five tiles, then the sentence with "Other trades ›"
  // for a company that also sells something else.
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3" data-estimate-type-first data-tour="service-picker">
      <div>
        <h2 className="text-[15px] font-semibold text-foreground">{t("app.paint.newPaintingQuote", "New painting quote")}</h2>
        <p className="text-xs text-muted-foreground">
          {t("app.paint.typeTitle", "What kind of estimate is this?")}{" "}
          {t("app.paint.typeHint", "The pick decides which areas, surfaces and rates you see next.")}
        </p>
      </div>
      <EstimateTypeCards value={null} onPick={onPickType} t={t} legacyNote={false} bare />
      {others.length > 0 && (
        <div>
          <p className="text-[13px] text-muted-foreground">
            {t("app.paint.otherTradesHint", "Something else on this quote (a countertop, flooring)?")}{" "}
            <button
              type="button"
              onClick={() => setOthersOpen((v) => !v)}
              aria-expanded={othersOpen}
              className="font-medium text-foreground hover:underline underline-offset-4 inline-flex items-center gap-0.5"
              data-other-trades
            >
              {t("app.paint.otherTrades", "Other trades")}
              {othersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </p>
          {othersOpen && (
            <div className="mt-2">
              <ServiceTiles categories={others} onAdd={onAddOther} documentLanguage={documentLanguage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
