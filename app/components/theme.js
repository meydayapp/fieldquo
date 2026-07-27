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
// Keep it in sync with the --brand-* variables in globals.css. Two sources of
// truth here by necessity, not by choice.

export const colors = {
  // Primary — warm gold. Matches Company.brandColor's schema default, so a
  // company that never touches branding still gets FieldQuo's own accent.
  primary: "#bd9d60",
  primaryDark: "#a68850",
  primaryLight: "#d1b87d",

  // Secondary — rich brown, for supporting accents.
  secondary: "#6c2f1d",
  secondaryDark: "#4a2013",
  secondaryLight: "#8d4427",

  // Neutrals — the "paper and ink" that make the accent read as deliberate.
  cream: "#f5f0e8",
  sand: "#e8dcc8",
  terracotta: "#c85a3c",
  forest: "#4a3428",
  charcoal: "#2d2520",

  light: {
    bg: "#fafaf9",
    surface: "#ffffff",
    surfaceElevated: "#f5f0e8",
    text: "#2d2520",
    textMuted: "#6b5d52",
    border: "#e8dcc8",
  },

  // Dark surfaces carry a brown undertone rather than pure grey — neutral grey
  // next to a gold accent reads as cheap. Elevation gets lighter, per
  // Material's convention, so stacked cards stay distinguishable.
  dark: {
    bg: "#12100e",
    surface: "#2d2520",
    surfaceElevated: "#3e342b",
    text: "#f5f0e8",
    textMuted: "#c4b5a0",
    border: "#4a3428",
  },
};

export const fonts = {
  sans: "var(--font-geist-sans)",
  mono: "var(--font-geist-mono)",
};

export const THEME_OPTIONS = ["light", "dark", "system"];
