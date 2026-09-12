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
clicks the real controls.

Build: `harness/build-review.sh` (paths point at the session scratchpad; edit
`SP` to wherever `app.css` and the stubs live), then
`node --experimental-websocket harness/cdp-shot.mjs out.png 1280 1000 1 "file://…/review.html?scene=folder&do=1"`.

| File | What it shows |
|---|---|
| `folder-1280.png` | The folder: filters (reason · source · province · campaign · search · website · shop-word), "46,485 waiting", rows with name, city · province, phone, website or "none", source + licence number, the licence's authorisations in the Régie's words (folded after four), the classification reason, the reason chip, numbered suggestion chips with their basis (`name: 'toitur'`, `name: 'electro'` + `name: 'plomb'`), the trade picker and the four decisions. First row active. |
| `picked-1280.png` | After `j` then `2`: the second row is active, its second chip (Plumbing) is picked, the select follows and the button reads "Accept as Plumbing". |
| `confirm-1280.png` | Search "toiture" → 583 matching → "Select all 583 matching this filter" → Roofing chosen → the confirmation with three sample names and "Assign to 583 rows". |
| `shopwords-1280.png` | The "Name carries a shop word" filter: 1,093 rows, the row "Peinture Dépôt Rive-Sud" with no chip and the sentence saying why, and the bulk panel offering "Reject all 1,093 as shops" — offered on this filter only. |
| `maintenance-1280.png` | The maintenance panel after a dry run: the per-provider counts, Apply enabled. |
| `sidebar-badge-1280.png` | The tall frame: "Review folder · 255k" on the rail under Discovery campaigns, and the licence-only row ("9410-5111 Québec inc." — `licence: only 16 électricité`). |
| `folder-375.png` / `picked-375.png` | The phone: full-width controls, one column, the active row scrolled into view. |
