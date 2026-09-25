# Form look — the four reference sites (read 2026-09-24)

The owner, asking for configurable fields and a configurable look on the
public request / instant-estimate forms:

> "what if they want to change the look and feel so that it helps them match
> better their website.. can we make some variations in the look and feel of
> the text boxes? i'm sure you are familiar with truefinish cabinets
> www.truefinishcabinets.com or jamiesonkitchenrefinishing.ca or
> theuglyducklingkitchens.com also has a very unique style or
> your-painter.com.au also but not their contact form but i think you
> understand what i'm getting at."

Method: each site loaded headless in Chrome at 1280 and 390 wide, a
screenshot saved under `docs/screens/form-look/references/`, and the
computed styles of `body`, the headings, the first visible inputs and
buttons read with `getComputedStyle` (font family, size, weight, colour,
background, radius, border, padding, transform, letter-spacing). Nothing was
typed into any form and nothing was submitted. The raw HTML was fetched once
more with curl for the font declarations the probe could not reach.

## Per site

| | TrueFinish Cabinets | Jamieson Kitchen Refinishing | The Ugly Duckling | your-painter.com.au |
|---|---|---|---|---|
| Platform | Next.js (the owner's own site, `/Users/emilioboves/truefinish-cabinets`) | Wix | GoDaddy Website Builder | WordPress |
| Body font | **Manrope** (humanist/geometric sans), 16px, colour `#2d2520`, muted `#6b5d52` | **Raleway** (sans) for body, **Questrial** for h1 | **Lora** (serif) body, 19px, `letter-spacing: 1px` | **Inter** (sans); Helvetica Neue stack on the challenge page |
| Display font | Cormorant Garamond declared as `--font-display` (serif); the live h1 renders Manrope 500 at 51px | Questrial 400 at 60px, white over a hero photo | **Cinzel** (display serif, small caps feel) 44px, `letter-spacing: 1.5px`; h2 **Source Sans Pro** 14px 700 uppercase, `letter-spacing: 3px` | **Playfair Display** (serif display, 11 declarations) and **Anton** (condensed display) |
| Light / dark | Light, warm: page `#fafaf9`, surface `#ffffff`, sand border `#e8dcc8`; has a dark mode (`#1a1512` / `#2d2520`) behind a toggle | Light, white with photo heroes | Light; pale grey `#ebebeb` sidebar nav, white content | Light (from markup) |
| Colour use | Gold `#bd9d60` (FieldQuo brand colour on file) for the primary CTA and the underlined nav item; terracotta/forest as accents | Navy `#225372` headline band and button borders, pale blue `#e6eef1` fills | Near-black text `#0a0000`; no accent colour at all — the brand is the type | Solid CTA "Start a project →" (colour not observable) |
| Input style | **Outlined**: 2px solid `#e8dcc8`, radius 8px, padding 14px, background `#fafaf9` | Not on the home page (form on /contact) | **Filled**: background `#cecece`, no border, radius 0, float label, padding `23px 16px 7px` | Not observable |
| Button shape | **Rounded (8px)** solid gold, white label, padding `16px 40px`, `letter-spacing: 1px`, weight 600; secondary is the same shape outlined in gold | **Square (0px)**, 1px navy outline, uppercase 10px tracked label; a second, filled pale-blue square | **Square**, ghost (transparent fill, 1px line), uppercase tracked label — GoDaddy `shape="SQUARE" fill="GHOST"` | 4px / 6px radii in the stylesheet; solid fill |
| Density | Comfortable — 14px input padding, 40px button padding, generous section spacing | Dense uppercase nav, tight 10px CTAs | Loose — wide gutters, 19px body, air around everything | Comfortable (from markup) |
| Form fields (their own contact form) | Name*, Email*, Phone*, Address* (Places autocomplete), Details*, file upload | "Receive your free estimate" link → contact page | Name*, Email*, Phone*, Postcode*, message, file attach, reCAPTCHA | "Get a Free Quote" modal — fields not observable |

Notes:

- your-painter.com.au serves a Cloudflare "Confirm you are human" page to a
  headless browser. That challenge was **not** bypassed (it is a bot check);
  the row above comes from the raw HTML the site does send (font-family and
  border-radius declarations, the CTA copy) and from the text fetch. The
  390/1280 screenshots of that site are of the challenge page.
- The TrueFinish quote page (`/quote`) embeds FieldQuo's instant-estimate
  widget at `https://www.fieldquo.com/embed/truefinish-cabinets-inc-qbaf/instant-quote`
  inside the site's own header; `truefinish-quote-1280.png` is what a
  homeowner sees today — FieldQuo's blue-grey page, white outlined inputs and
  the app's rounded corners, under TrueFinish's warm Manrope masthead.

## The range the presets have to reach

Reading the four together, the looks a contractor might want the form to
match differ on six axes and nothing else that a preset could honestly own:

| Axis | Seen | Preset |
|---|---|---|
| Text-box style | outlined 2px (TrueFinish) · filled grey, no border (Ugly Duckling) · underlined is the other common builder default | `fieldStyle`: outlined · underlined · filled · pill |
| Corners | 8px (TrueFinish) · 0px (Jamieson, Ugly Duckling) · 4–6px (your-painter) · 24px pills (Wix's "skip" button) | `radius`: none · small · medium (today's) · full |
| Type | Manrope (humanist sans) · Lora/Cinzel (serif body + display serif) · Playfair (display serif) · Raleway/Questrial/Poppins-like geometric sans | `fontPreset`: system · humanist (Manrope) · classic_serif (Lora) · display_serif (Cormorant Garamond + Manrope) · geometric (Poppins) |
| Spacing | loose (Ugly Duckling) to tight (Jamieson) | `density`: comfortable · compact |
| Buttons | solid rounded (TrueFinish) · square ghost outline (Jamieson, Ugly Duckling) · pill | `buttonStyle`: solid · outline · pill |
| Background | warm light · white · pale brand tint · TrueFinish's dark mode | `surface`: light · dark · brand-wash |

What is deliberately **not** a preset: uppercase tracked labels (a
typographic choice the form's own copy was not written for — "YOUR
BUDGET *" reads as shouting in a form), free CSS (a stranger on a phone pays
for the contractor's typo, and the white-label promise includes legibility),
and a second accent colour (every colour still derives from the one brand hex
through `lib/documents/theme.js` and is measured).

All of it lives in `lib/estimate/formAppearance.js`; the measured contrast
table for the presets against the real brand colours is printed by
`npm run check:form-look`.
