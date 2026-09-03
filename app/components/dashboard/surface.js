// app/components/dashboard/surface.js
//
// One card surface for the dashboard, and the two decisions behind it.
//
// ══ 1. The radius contradiction ═════════════════════════════════════════════
//
// app/globals.css sets `--radius: 0`, and the whole Tailwind radius scale is
// computed off it — `--radius-sm/-md/-lg/-xl/-2xl/-3xl/-4xl` are all
// `calc(var(--radius) * n)`, so every one of them resolves to 0. The dashboard
// nevertheless carried `rounded-xl` on eight cards. Those classes rendered
// nothing at all: the token had already won, and the classes were decoration
// describing an intention the stylesheet did not share.
//
// The token is the deliberate one. The three widest rungs — `--radius-2xl`,
// `-3xl`, `-4xl` — are NOT in shadcn's shipped globals; somebody added them
// specifically so that `rounded-2xl` and friends would collapse to zero as
// well. That is not a default left unedited, it is a square-corner decision
// made on purpose, and the owner endorsed a square-cornered mock.
//
// So the token wins and the classes go. The alternative — giving `--radius` a
// real value — was measured before it was rejected: `rounded-*` appears 3,098
// times across app/, lib/ and components/ (1,264 `rounded-lg`, 830
// `rounded-xl`, 111 `rounded-2xl`), so setting the token non-zero restyles the
// entire product, not this page. Out of scope for a dashboard brief, and
// reported rather than done quietly.
//
// `rounded-full` stays wherever it appears: it is `9999px`, not a rung on the
// scale, and pills are genuinely round today.
//
// ══ 2. The card that vanishes in daylight ═══════════════════════════════════
//
// `--card: #ffffff` on `--background: #f6f8fb` is a contrast ratio of 1.06:1.
// The fill does essentially nothing and the border does all the work — and
// `--border: #d7e2ef` against the page is only 1.23:1, which on a phone held
// at arm's length outdoors is a card with no visible edge.
//
// Fixing it in the tokens is NOT safe here. `#f6f8fb` is mirrored literally in
// app/components/theme.js (`paper`, `cream`, `light.bg` — the values HTML
// emails and PDFs use, where CSS variables cannot reach), in app/layout.js's
// theme-color meta, in app/manifest.js's background_color, and in
// docs/MOBILE-INSTALL.md. Four of those five files belong to other surfaces,
// and moving the page background is a product-wide visual change.
//
// So it is fixed on this page, with the two levers that need no token:
//
//   the edge   `border-foreground/20` composites the ink token at 20% over the
//              card's own white (background-clip is border-box, so the card
//              paints under its border) → rgb(206,209,213), which is 1.44:1
//              against the page rather than 1.23:1. In dark mode the same
//              expression resolves to a LIGHTER edge over #111d31, which is
//              the right direction there too — one declaration, both themes,
//              no hard-coded hex on either side.
//
//   the lift   a real drop shadow. This is the part the border cannot do: a
//              shadow darkens the page just outside the card, which is the
//              only way to separate two surfaces 1.06:1 apart without moving
//              one of them.
//
// Measured, not guessed — the numbers above are sRGB relative luminance per
// WCAG, the same arithmetic lib/documents/theme.js does for client-facing
// colour.

/** The dashboard's card. No radius class: the token says square, so it is square. */
export const CARD =
  "bg-card border border-foreground/20 shadow-[0_1px_2px_rgba(11,26,46,0.07),0_6px_16px_-8px_rgba(11,26,46,0.14)]";

/** The same surface for something that clips its own children (a divided list). */
export const CARD_CLIPPED = `${CARD} overflow-hidden`;

/** An inset box inside a card — an aging rung, a metric well. */
export const INSET = "border border-foreground/15 bg-background/60";
