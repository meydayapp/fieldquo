// app/components/theme.js
//
// FieldQuo's brand palette as plain JS values.
//
// Note what this file is NOT: it isn't how components get styled. The app
// already uses Tailwind v4 with shadcn's CSS variables and a `.dark` variant
// (see globals.css), so components style themselves with `bg-background`,
// `text-muted-foreground` and so on, and dark mode works by toggling one class
// on <html>. Passing a theme object down through props and writing
// style={{ color: theme.text }} on every element — the pattern TrueFinish
// uses — would mean abandoning that and rewriting every component in the app.
//
// This file exists for the places CSS variables can't reach:
//   * HTML emails, which have no stylesheet and need literal hex values
//   * generated PDFs
//   * chart libraries that take colours as JS props
//
// Keep it in sync with :root and .dark in globals.css. Two sources of truth
// here by necessity, not by choice — an HTML email has no stylesheet to read.

export const colors = {
  // Navy — the logo's structural colour. Matches Company.brandColor's schema
  // default, so a company that never touches branding still gets FieldQuo's.
  primary: "#06356b",
  primaryDark: "#04264d",
  primaryLight: "#0d4a90",

  // Orange — the logo's accent. Used for the one thing on a page that should
  // be clicked, and nothing else.
  //
  // Two values because it has two jobs: as a FILL it carries dark text at
  // 5.6:1; as TEXT on a light background it's only 2.9:1, under the floor.
  // accentText is the darkened version for the second case.
  accent: "#ff5a00",
  accentDark: "#c34300",
  accentLight: "#ff8c47",
  accentText: "#c34300",

  // Kept under the old names so existing email/PDF code doesn't break.
  secondary: "#ff5a00",
  secondaryDark: "#c34300",
  secondaryLight: "#ff8c47",

  // Neutrals. Not grey — every one is a low-saturation tint of the navy hue,
  // which is what stops the palette reading as a default template.
  paper: "#f6f8fb",
  mist: "#eef3f9",
  steel: "#d7e2ef",
  slate: "#4d6076",
  ink: "#0b1a2e",

  // Old names, same role, so nothing that imported them has to change.
  cream: "#f6f8fb",
  sand: "#d7e2ef",
  terracotta: "#ff5a00",
  forest: "#06356b",
  charcoal: "#0b1a2e",

  light: {
    bg: "#f6f8fb",
    surface: "#ffffff",
    surfaceElevated: "#eef3f9",
    text: "#0b1a2e",
    textMuted: "#4d6076",
    border: "#d7e2ef",
  },

  // Mirrors the .dark block in globals.css: same navy hue, lightness
  // inverted, surfaces getting lighter with elevation.
  dark: {
    bg: "#0a1220",
    surface: "#111d31",
    surfaceElevated: "#1a2942",
    text: "#e9eef6",
    textMuted: "#9fb2c8",
    border: "#27384f",
  },
};

export const fonts = {
  sans: "var(--font-geist-sans)",
  mono: "var(--font-geist-mono)",
};

export const THEME_OPTIONS = ["light", "dark", "system"];
