// lib/estimate/lawnPublicView.js
//
// What a homeowner may read about their lawn on the public instant-quote
// page, the confirmation and the estimate email: the size, whether it was
// measured or estimated, and the sentences that say which — in the
// company's language. Never the parcel's lot number, the roof model's
// figures or the provider: those stay on the draft for the reviewer.
//
// Shared by the /measure and /request routes so the panel reads the same
// words before and after submit.

import { lawnBand } from "@/lib/estimate/lawnCare";
import { lawnEstimateCopy, lawnSourceSentence } from "@/lib/i18n/lawnEstimateCopy";

export function lawnPublicView(m, language = "en") {
  if (!m || !(Number(m.areaSqft) > 0)) return null;
  const t = lawnEstimateCopy(language);
  const band = lawnBand(m.areaSqft, m.minSqft);
  return {
    areaSqft: Math.round(Number(m.areaSqft) || 0),
    bandSqft: band.bandSqft,
    source: m.source || null,
    basis: m.basis || null,
    estimated: m.estimated !== false,
    minSqft: band.minSqft,
    belowMinimum: band.belowMinimum,
    sizeText: t.lawnSize(band.bandSqft),
    notes: [lawnSourceSentence(m.source, language), band.belowMinimum ? t.belowMinimum : null, t.notAContract].filter(Boolean),
  };
}
