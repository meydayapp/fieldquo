# /platform/sales/review — the Review folder, rendered

The real `app/platform/sales/review/page.js` beside the real
`app/components/platform/PlatformSidebar.js`, bundled with esbuild against a
fixture (`harness/reviewFetch.js` stubs `@/lib/fetchJson` with rows shaped
exactly like `app/api/platform/sales/review/route.js`'s response — the names
are real Quebec licence-holders read off the production folder; `window.fetch`
answers the rail's count route with 255,842) and the compiled Tailwind CSS
(`harness/css.mjs`), rendered in headless Chrome through the DevTools protocol
(`harness/cdp-shot.mjs`). Desktop frames are 1280×1000 (the sidebar one
1280×1700 so the badge is in frame); phone frames are 375×812 at 2×.
`harness/review.jsx` carries a `?scene=` driver that presses the real keys and
clicks the real controls (`folder`, `picked`, `bar`, `bulk`, `confirm`, `dups`,
`pagesize`, `shopwords`, `maintenance`).

Build: `harness/build-review.sh` (paths point at the session scratchpad; edit
`SP` to wherever `app.css` and the stubs live), then
`node --experimental-websocket harness/cdp-shot.mjs out.png 1280 1000 1 "file://…/review.html?scene=folder&do=1"`.

| File | What it shows |
|---|---|
| `folder-1280.png` | The folder: filters (reason · source · province · campaign · search · website · shop-word), "46,485 waiting", rows with name, city · province, phone, website or "none", source + licence number, the licence's authorisations in the Régie's words (folded after four), the classification reason, the reason chip, numbered suggestion chips with their basis (`name: 'toitur'`, `name: 'electro'` + `name: 'plomb'`), the trade picker and the four decisions. First row active. |
| `picked-1280.png` | After `j` then `2`: the second row is active, its second chip (Plumbing) is picked, the select follows and the button reads "Accept as Plumbing". |
| `confirm-1280.png` | *(before 2026-09-14)* Search "toiture" → 583 matching → "Select all 583 matching this filter" → Roofing chosen → the confirmation. Superseded by the `bulkbar-*` frames below; kept so the change is visible. |
| `shopwords-1280.png` | *(before 2026-09-14)* The "Name carries a shop word" filter with the old bulk panel offering "Reject all 1,093 as shops". The reject is now the bar's secondary button on any narrowed filter. |
| `bulkbar-bar-1280.png` | **The bulk bar (2026-09-14).** Search "toiture" → the sticky bar directly above the list: "432 rows match “toiture” · 1 unticked", the trade select first, the primary button reading "Pick the trade to assign" (disabled, with the hint) until a trade is picked, "Reject all 432 (not contractors)" as the secondary, a "this page" tick-all. Every row carries a checkbox; the third is unticked. "Hide duplicates" is on in the filter bar. |
| `bulkbar-confirm-1280.png` | Shift+A → Roofing chosen → the button reads "Assign Roofing to all 432" → the confirmation: "Assign Roofing to 432 rows (1 excluded)?", the sentence saying the unticked row stays as it is, two sample names. |
| `bulkbar-dups-1280.png` | "Hide duplicates" switched off: the flagged row (Gestion Immobilière Arpin, trading as Toitures Arpin) with its "Duplicate of Les Entreprises Arpin inc." chip, its checkbox off and disabled, the bar saying "431 rows match · 2 duplicates left for row by row", and the pager with "Rows per page 50". |
| `bulkbar-pagesize-1280.png` | "Rows per page" set to 200: two hundred real cards drawn (the fixture repeats its rows with fresh ids), "Page 1 of 233". The scene driver timed the change at ~200 ms from the select to the two-hundredth card on screen, fixture fetch included — the suggestion chips are computed once per row by the route, never by the component, which is what keeps it there. |
| `maintenance-1280.png` | The maintenance panel after a dry run: the per-provider counts, Apply enabled. |
| `sidebar-badge-1280.png` | The tall frame: "Review folder · 255k" on the rail under Discovery campaigns, and the licence-only row ("9410-5111 Québec inc." — `licence: only 16 électricité`). |
| `folder-375.png` / `picked-375.png` | The phone: full-width controls, one column, the active row scrolled into view. |

Since 2026-09-13 the page has a second mode, **By suggestion**
(`?mode=suggested`): cards per stored suggestion, fifty names a page with the
matched word highlighted, tick / untick, accept or reject the ticked rows
through the same bulk route. The platform-mobile harness
(`docs/screens/platform-mobile/harness/fixtures/salesDiscovery.js`) answers its
routes (`/api/platform/sales/review/suggested`, `…/suggested/ai`); no frame of
it is filed here yet.
