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
  return (
    <div className="space-y-3" data-estimate-type-first data-tour="service-picker">
      <EstimateTypeCards value={null} onPick={onPickType} t={t} legacyNote={false} />
      {others.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOthersOpen((v) => !v)}
            aria-expanded={othersOpen}
            className="text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            data-other-trades
          >
            {othersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {t("app.paint.otherTrades", "Other trades")}
          </button>
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
