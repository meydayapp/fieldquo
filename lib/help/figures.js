// lib/help/figures.js
//
// How an article names a screenshot, and where that screenshot comes from.
//
// ── Every figure is FieldQuo's own screen ──────────────────────────────────
//
// An article never carries an image path; it carries a REFERENCE to one of
// three capture sets that already exist in the repo, and the build refuses a
// reference nothing answers. No hand-drawn mock-up can enter the help centre
// because there is no syntax for one.
//
//   live:<route-slug>     docs/screens/live/app/<lang>/<route-slug>.png
//                         The owner's real signed-in session, per language;
//                         "app-settings-branding" is /app/settings/branding.
//   create:<route-slug>   docs/screens/live/actions/<lang>/<route-slug>-create.png
//                         What opened when the list page's New / Add button
//                         was pressed. English only today.
//   harness:<slug>        docs/screens/app-guide/<lang>/NN-<slug>.png
//                         The real component rendered against the fixture
//                         company (docs/screens/app-guide/harness) — the set
//                         that can still grow, because the live session that
//                         took the captures above is gone.
//
// A French article referencing live:app-quotes gets the French capture when
// one exists and the English one when it does not: a real capture of the
// real screen in English is still the screen, and the caption is in the
// reader's language either way. Which fallback was taken is reported by the
// build, never hidden.
//
// This module is PURE (no fs) so the pages and the client can import it;
// the file lookup lives in scripts/help-figure-sources.mjs.

export const FIGURE_KINDS = Object.freeze(["live", "create", "harness"]);

/**
 * Parse "live:app-quotes" into { kind, name, publicName } or null.
 * publicName is the file name under public/help/figures/<lang>/.
 */
export function parseFigureRef(ref) {
  const m = /^(live|create|harness):([a-z0-9-]+)$/.exec(String(ref || ""));
  if (!m) return null;
  const [, kind, name] = m;
  return { kind, name, publicName: `${kind}-${name}` };
}
