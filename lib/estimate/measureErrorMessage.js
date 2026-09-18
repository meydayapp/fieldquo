// lib/estimate/measureErrorMessage.js
//
// The one sentence a homeowner reads when a measurement fails, in the
// language the form is in. Shared by /measure and /request so the preview
// and the submit cannot explain the same failure two different ways — and
// so the trade-specific refusals (a gutter model that would not stand
// behind a roofline, a lawn with no parcel) keep coming from the tables that
// own them.

import { gutterEstimateCopy } from "@/lib/i18n/gutterEstimateCopy";
import { lawnEstimateCopy } from "@/lib/i18n/lawnEstimateCopy";
import { instantQuoteCopy } from "@/lib/i18n/instantQuoteCopy";

export function measureErrorMessage(reason, language = "en", trade = null) {
  const t = instantQuoteCopy(language);
  switch (reason) {
    case "needs_site_visit":
      return (trade === "lawn_care" ? lawnEstimateCopy(language) : gutterEstimateCopy(language)).needsSiteVisit;
    case "polygon_too_small":
      return lawnEstimateCopy(language).traceHint;
    default:
      return t.measureErrors[reason] || t.measureErrors.other;
  }
}
