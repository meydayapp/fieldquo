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
import { roomCopy } from "@/lib/i18n/roomPresetCopy";

export function measureErrorMessage(reason, language = "en", trade = null) {
  const t = instantQuoteCopy(language);
  switch (reason) {
    // The painting room picker's own refusal: a list with no room in it that
    // the company's region offers, or nothing ticked to paint in any of them.
    // (Rooms under an exterior scope — "rooms_interior_only" — falls to the
    // generic line: the form never offers rooms there, so it is a hand-made
    // request, and "add a room" would be the wrong advice.)
    case "no_rooms":
      return roomCopy(language).noRooms;
    case "needs_site_visit":
      return (trade === "lawn_care" ? lawnEstimateCopy(language) : gutterEstimateCopy(language)).needsSiteVisit;
    case "polygon_too_small":
      return lawnEstimateCopy(language).traceHint;
    default:
      return t.measureErrors[reason] || t.measureErrors.other;
  }
}
