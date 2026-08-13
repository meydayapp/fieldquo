// app/components/BrandTheme.js
//
// Puts a company's brand colour into the semantic CSS variables, for one
// region of the page.
//
// ── What this is NOT ────────────────────────────────────────────────────────
//
// It used to wrap the entire /app shell, so a company's colour became the
// sidebar, every primary button and every active state in the back office.
// That was the wrong reading of "white-label". The promise is that the
// HOMEOWNER can't tell which software the contractor uses — the quote, the
// invoice, the emails, the PDF, the booking page, the portal, the public site.
// Staff stare at /app all day, and a contractor who picks lime green should
// not be handed an unusable back office for it. So /app is FieldQuo's palette
// now, and this component is mounted per-surface instead.
//
// ── Where it belongs ────────────────────────────────────────────────────────
//
// Around an /app region that is SHOWING the client-facing document — the quote
// detail page's document mirror is the case this exists for, because that page
// is where someone checks a quote before sending it, and checking it against
// the wrong colours is a weaker check. Client-facing routes themselves never
// use this: /q, /quote, /book, /portal, /site, /embed, /f and the PDF and email
// renderers compute literal hex from Company.brandColor, because a stranger's
// browser may have no JS and @react-pdf/renderer has no cascade at all.
//
// Why it's safe with any colour a contractor picks: every derived value comes
// from lib/brand/colour.js, which chooses foregrounds by measured WCAG
// contrast rather than assuming. A lime-green brand gets dark text on its
// total band; a navy one gets white. Neither is hardcoded.
//
// Emits a plain <style> tag and nothing else, so it renders from a server
// component (variables present on first paint) or a client one (the page
// already had to fetch the company). It has no server-only imports on purpose.

import { deriveBrandTokens, tokensToCss, isValidHex } from "@/lib/brand/colour";

export default function BrandTheme({ brandColor, brandColors }) {
  // Nothing set — the defaults in globals.css already are FieldQuo's palette,
  // so emit nothing at all rather than a block that restates them.
  if (!isValidHex(brandColor)) return null;

  const accent = brandColors?.secondary;

  const light = deriveBrandTokens(brandColor, { dark: false, accent });
  const dark = deriveBrandTokens(brandColor, { dark: true, accent });

  // Scoped to [data-brand] rather than :root so it can only affect the element
  // that carries the attribute and its children. Everything else under the same
  // <html> — the sidebar, the command strip, the rest of the back office —
  // keeps FieldQuo's palette. The attribute and this <style> belong in the same
  // file: an attribute with no style block is a region that silently doesn't
  // theme, and a style block with no attribute is dead CSS. check:brand-scope
  // fails on either.
  const css = [
    tokensToCss(light, "[data-brand]"),
    tokensToCss(dark, ".dark [data-brand]"),
  ].join("\n");

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
