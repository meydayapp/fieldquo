// app/components/public/FormLook.js
//
// The wrapper that gives a public form the company's chosen look.
//
// ── Nothing happens on the default ─────────────────────────────────────────
//
// `useFormLook` answers null for no look, a malformed one, or the default
// preset, and `FormLook` then renders its children with no wrapper element,
// no stylesheet and no font link — the DOM a company gets today, byte for
// byte. The "look" only ever ADDS: one div carrying data attributes and CSS
// custom properties, one scoped stylesheet (lib/estimate/formAppearance.js
// FORM_LOOK_CSS), and, for a Google font preset, one stylesheet link that
// React hoists into <head> and dedupes.
//
// The variables the div sets are Tailwind's own theme variables (--card,
// --foreground, --border …), which every utility inside compiles to, plus the
// --fq-* set the scoped stylesheet reads. That is how a dark surface reaches
// `bg-card` and `text-muted-foreground` on four hundred lines of JSX without
// any of them being edited.
"use client";

import { useMemo } from "react";
import {
  normaliseFormAppearance,
  isDefaultAppearance,
  formPalette,
  formLookVars,
  fontStylesheetUrl,
  FORM_LOOK_CSS,
} from "@/lib/estimate/formAppearance";

/**
 * @param look  { appearance, brandColor } from lib/estimate/publicFormLook.js
 *              (the page's server read) or the settings preview, or null.
 * @returns null, or { appearance, palette, vars, fontUrl } for FormLook and
 *          for the flow's own inline colours (the palette's button and chip
 *          pairs, its accentText).
 */
export function useFormLook(look) {
  return useMemo(() => {
    if (!look || !look.appearance) return null;
    const { appearance } = normaliseFormAppearance(look.appearance);
    if (isDefaultAppearance(appearance)) return null;
    const palette = formPalette(look.brandColor, appearance);
    return {
      appearance,
      palette,
      vars: formLookVars(palette),
      fontUrl: fontStylesheetUrl(appearance.fontPreset),
    };
  }, [look]);
}

export default function FormLook({ look, children }) {
  if (!look) return children;
  const a = look.appearance;
  return (
    <>
      {look.fontUrl && (
        // precedence: React 19 hoists a stylesheet link that carries one into
        // <head> and renders it once, however many times this mounts.
        <link rel="stylesheet" href={look.fontUrl} precedence="fq-form-look" />
      )}
      <style>{FORM_LOOK_CSS}</style>
      <div
        className="fq-look"
        data-field={a.fieldStyle}
        data-button={a.buttonStyle}
        data-density={a.density}
        data-surface={a.surface}
        data-font={a.fontPreset}
        data-radius={a.radius}
        style={look.vars}
      >
        {children}
      </div>
    </>
  );
}
