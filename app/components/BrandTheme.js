// app/components/BrandTheme.js
//
// Applies a company's brand colour to the whole app chrome.
//
// This is the white-label. FieldQuo navy is the default; the moment a company
// sets a colour in Settings → Branding, the sidebar, buttons, active states
// and accents all become theirs. The mechanism is one <style> block
// overriding the CSS variables that globals.css declares — every component
// already reads those tokens after the Phase 5 conversion, so nothing else
// has to change.
//
// Why it's safe with any colour a contractor picks: every derived value comes
// from lib/brand/colour.js, which chooses foregrounds by measured WCAG
// contrast rather than assuming. A lime-green brand gets dark text on its
// sidebar; a navy one gets white. Neither is hardcoded.
//
// Rendered from a SERVER component so the variables are in the HTML on first
// paint. Doing this client-side would show FieldQuo navy for a frame and then
// snap to the company's colour on every navigation.

import { deriveBrandTokens, tokensToCss, isValidHex } from "@/lib/brand/colour";

export default function BrandTheme({ brandColor, brandColors }) {
  // Nothing set — the defaults in globals.css already are FieldQuo's palette,
  // so emit nothing at all rather than a block that restates them.
  if (!isValidHex(brandColor)) return null;

  const accent = brandColors?.secondary;

  const light = deriveBrandTokens(brandColor, { dark: false, accent });
  const dark = deriveBrandTokens(brandColor, { dark: true, accent });

  // Scoped to [data-brand] rather than :root so it can only affect the app
  // shell it wraps. The marketing site and the client-facing pages under the
  // same <html> keep FieldQuo's palette.
  const css = [
    tokensToCss(light, "[data-brand]"),
    tokensToCss(dark, ".dark [data-brand]"),
  ].join("\n");

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
