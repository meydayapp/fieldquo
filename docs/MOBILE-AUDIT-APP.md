# Mobile usability audit — `/app` back office

Scope: `app/app/page.js`, `app/app/quotes/**`, `app/app/invoices/**`,
`app/app/jobs/**`, `app/app/clients/**`, `app/app/leads/**`,
`app/app/appointments/**`, `app/app/crew-inbox/**`, `app/app/settings/**`,
`app/app/analytics/**`, and the components under `app/components/` those
pages use. (No `app/app/expenses/**` exists — expense tracking lives at
`app/app/settings/expense-tracking/**`, which is in scope and was audited.)

**Nothing below is visually confirmed.** This environment has no browser.
Every fix is a reasoned Tailwind/CSS change verified by reading the
surrounding layout, `npm run build`, and the targeted `check:*` scripts —
not by looking at a rendered phone screen. Treat this as a strong first
pass that still wants a real device or simulator check before it's called
done.

Also not touched, per instructions: `app/globals.css` (a parallel agent is
adding a global 16px form-control rule there for the iOS zoom bug) and
`app/components/layout/**`, `app/components/designer/**`,
`app/components/jennifer/**`.

---

## 1. Fixed/sticky bars colliding with MobileTabBar — FIXED

`app/components/layout/MobileTabBar.js` renders a `fixed inset-x-0 bottom-0
z-40` row below `lg`, and `app/app/layout.js`'s `<main>` reserves
`pb-[calc(4rem+env(safe-area-inset-bottom))]` for it. Any page with its own
fixed-to-viewport bottom bar sits *outside* that padding (fixed elements
escape normal flow) and was landing directly on top of the tab bar below
`lg`. Found by grepping the whole scope for `fixed.*bottom` / `sticky.*bottom`
and checking each hit's breakpoints against `MobileTabBar`'s own `lg:hidden`.

| File | What broke | Width |
|---|---|---|
| `app/components/quotes/builder/QuoteTotalsBar.js:342` | `fixed bottom-0 ... z-40` — same z-layer as the tab bar. Save/Send buttons and the tab bar's Jobs/Invoices row occupied the same pixels. Used by both quotes/new and invoices/new (via `QuoteBuilder.js`). | < 1024px (`lg`) |
| `app/components/HelpButton.js` | `fixed bottom-6 right-6 z-50` — sat inside the tab bar's own row (bottom-6 to bottom-6+44px overlaps the tab bar's 0–64px+ band). Only caller is `QuoteBuilder.js`, always alongside `QuoteTotalsBar`. | < 1024px |
| `app/app/invoices/new/page.js:534` | Same pattern, its own `fixed bottom-0` save bar (`data-tour="invoice-save"`). | < 1024px |
| `app/app/settings/availability/page.js:335` | Same pattern, the "Save hours" bar. | < 1024px |
| `app/app/settings/links/page.js:411` | Same pattern, the bio-link "Save" bar. | < 1024px |

**Fix:** each bar's `bottom-0`/`bottom-6` became
`bottom-[calc(4rem+…env(safe-area-inset-bottom))] lg:bottom-0` (or `lg:bottom-6`
for HelpButton) — the exact height MobileTabBar occupies, matching the calc
`app/app/layout.js` already uses for `<main>`'s padding. `lg:bottom-*`
restores the original position once the tab bar stops rendering.

**Also fixed while in these same lines:** `QuoteTotalsBar.js`,
`invoices/new/page.js` and `settings/availability/page.js` were offsetting
their `left` position at `sm:left-60`/`sm:left-64` for the desktop sidebar —
but `AdminSidebar` only becomes a rail at `lg` (`hidden lg:flex`, see
`AdminSidebar.js`). Between 640–1024px these bars were indenting for a
sidebar that doesn't exist yet. Changed to `lg:left-*`.
`settings/links/page.js` already had this right (`lg:left-64`).

`app/app/settings/team/page.js:867` has a `sticky bottom-0` inside its access
modal — checked and left alone: the modal is `fixed inset-0 z-50`, above the
tab bar, and the sticky footer is bounded to the modal panel's own
`max-h-[90vh] overflow-y-auto`, not the viewport. No collision.

Every other `fixed inset-0` in scope (confirmation modals in
`quotes/[id]`, `invoices/[id]`, `clients/[id]`, `leads/page.js`,
`appointments/page.js`) is a full-screen `z-50` overlay, not a
viewport-bottom bar — no tab-bar interaction to fix.

---

## 2. `100vh` → `100dvh` — FIXED (1 instance in scope)

`app/app/settings/website/Builder.js:528` used
`h-[calc(100vh-3.5rem)] lg:h-screen`. Two problems: `vh` includes the space
behind iOS Safari's retracting chrome (the classic "bottom of the page is
under the browser bar" bug), and the calc never subtracted MobileTabBar's
height, so the chat input at the bottom of this flex column would render
behind the tab bar below `lg`.

**Fix:** `h-[calc(100dvh-3.5rem-4rem-env(safe-area-inset-bottom))]
lg:h-[100dvh]` — `3.5rem` clears `AdminSidebar`'s mobile top bar (`h-14`,
`lg:hidden`), `4rem+safe-area` clears MobileTabBar, `dvh` instead of `vh`.

The only other `100vh` hits in scope-adjacent files
(`app/app/copilot/page.js`, `app/components/auth/AuthShell.js`) are outside
this task's path list and were left alone.

---

## 3. Tables / dense-grid layouts — mostly already fine; one real clip bug fixed

The quotes, invoices, jobs, clients, and leads **list** pages
(`app/app/{quotes,invoices,jobs,clients}/page.js`,
`app/app/leads/page.js`) are **not** literal `<table>` markup — they're
already flex-row / card lists with `truncate`, `min-w-0`, `shrink-0` used
correctly, and the leads board is a `grid md:grid-cols-2 xl:grid-cols-4`
kanban that already documents its own mobile design (single column below
`md`, chips collapse to dots below `sm`). No work needed there; this was
the pleasant surprise of the audit.

Two real table/grid bugs found and fixed:

### `app/app/analytics/win-loss/page.js:401` — FIXED
The "By whoever wrote the quote" `<table>` had no `overflow-x-auto` wrapper,
unlike the other tables in this codebase (`estimate-accuracy/page.js`,
`settings/overhead/page.js`, and win-loss's own `<ul>` above it all wrap
theirs). A long name in the "Who" column next to three more columns was the
row that would scroll the whole document sideways at 375px. **Fix:** wrapped
in `<div className="overflow-x-auto">`, added `whitespace-nowrap` to the
name cell.

### `app/app/settings/products/page.js:275-338` — FIXED (the worst bug in this audit)
Each product row was a CSS grid with an **arbitrary column template**,
`grid-cols-[1fr_1.5fr_auto_auto]`, inside a parent using `overflow-hidden`
(not `overflow-x-auto`). Tailwind's *built-in* `grid-cols-N` utilities
compile to `repeat(N, minmax(0,1fr))` — the `minmax(0,…)` is what lets a
column shrink below its content. An arbitrary `grid-cols-[1fr_...]` template
does **not** get that treatment; a grid item's default `min-width` is its
content's min-content size. Net effect at 375px: the row neither reflowed
nor scrolled — it **clipped**. The edit/delete column could be cut off
entirely, which is worse than an undiscoverable scrollbar (`settings/team/
page.js` has the same arbitrary-grid pattern but was already wrapped in
`overflow-x-auto`, so it only scrolls, correctly, and is the pattern this
fix follows).

**Fix:** below `sm` each row now stacks into a card — name + edit/delete on
one line, description below, type badge below that; the `sm:grid` returns
the original 4-column layout at `sm` and up. The header row is
`hidden sm:grid`. Also gave the edit/delete buttons (previously bare 14px
icons, *zero* padding, no `aria-label`) a 44×44 target and a label — they
had neither.

Checked every other `grid-cols-[…]` (arbitrary) instance in scope: only
`settings/team/page.js` (already safe, wrapped) and this one existed.

### Checked and found already correct
- `app/app/settings/team/page.js:592-599` — arbitrary grid template,
  correctly wrapped in `overflow-x-auto`, with an explicit comment about
  dropping the "last login" column below `lg` rather than forcing a
  scrollbar over the checkbox column.
- `app/app/settings/expense-tracking/import/page.js` — literal `<table>`,
  already wrapped in `overflow-x-auto`.
- `app/app/settings/overhead/page.js`, `app/app/analytics/estimate-accuracy/
  page.js` — literal `<table>`s, already wrapped.
- `app/app/appointments/page.js:449,465` — `grid-cols-7` month calendar.
  Uses Tailwind's built-in utility (safe `minmax(0,1fr)`), and the file has
  its own comment explaining the deliberate mobile design (dots replace
  chips below `sm`, never scrolls sideways). Left alone.

---

## 4. Horizontal overflow beyond tables

Grepped scope for `w-[NNNpx]` / `min-w-[NNNpx]` fixed-pixel widths. Besides
the two table cases above, nothing else forces page-level horizontal
scroll:
- `app/app/settings/website/Builder.js` mobile device-preview iframe
  (`width: 390`) sits inside its own `overflow-auto` pane deliberately
  simulating a phone frame — contained, not a page-level overflow.
- Assorted `max-w-[Npx]` (logo caps, description truncation column widths)
  are all upper bounds paired with `truncate`/`object-contain`, not fixed
  lower bounds — safe.

No other page-level horizontal-scroll bugs found in scope.

---

## 5. Tap targets under 44×44px — partially fixed

This app is, as warned, full of icon-only buttons on `p-1`/`p-1.5`/`p-2`
around 14–20px icons (roughly 24–36px targets). A full inventory would be
its own multi-session project; **fixed the ones that were both clearly
under-44 and safe to grow without visual-overlap risk** (isolated in a row,
not packed edge-to-edge against a sibling control):

**Fixed** (grown to `min-h-[44px] min-w-[44px] flex items-center
justify-center`, icon size unchanged):
- `app/app/leads/page.js` — card drag handle (`GripVertical`, was `p-1.5`)
- `app/app/settings/email-templates/[id]/page.js` — stage remove (×1),
  block remove, block drag handle (3 buttons, were `p-1`)
- `app/app/settings/checklists/page.js` — step remove (`p-1`)
- `app/app/settings/instant-quotes/page.js` — material remove (`p-1`)
- `app/app/settings/templates/[id]/edit/page.js` — section move-up,
  move-down, remove (3 buttons, were `p-1.5`)
- `app/app/settings/expense-tracking/page.js` — month prev/next (`p-1.5`)
- `app/app/settings/products/page.js` — edit/delete (were bare icons, no
  padding *and* no `aria-label` at all)
- `app/app/appointments/page.js` — month-view prev/next chevrons (`p-1.5`)

**Found, not fixed — needs a design decision, not a blind resize:**
- `app/app/settings/website/SectionEditor.js:253,320` — the photo-remove
  `X` button on gallery thumbnails (`absolute -top-2 -right-2 ... p-1`,
  12px icon ≈ 20px target). These sit on 80–128px thumbnails in a
  `flex flex-wrap gap-2` grid (only 8px gap). Growing the hit area to 44px
  risks the invisible tap zones of adjacent photos overlapping each other,
  which would make clicking near a boundary hit the wrong photo's delete —
  a worse failure than a small-but-precise target. Fixing this properly
  needs either more gap between thumbnails or a different remove-button
  placement, which is a layout call for whoever owns that screen, not
  something to guess at without a device to test on.
- `app/app/crew-inbox/page.js:381` — inline copy-to-clipboard icon inside a
  `<p>` sentence (`align-middle`, no padding, 14px icon). Enlarging it to
  44px inline would visibly disrupt the paragraph's line height; needs a
  restructure (icon out of the text flow) rather than a padding bump.
  (Also noticed in passing: its `aria-label` reuses the `"app.crewSetup.
  textThis"` string instead of a "copy" label — an accessibility bug, not
  a mobile-usability one, left as found.)
- Every other icon-only button found via `aria-label=` grep across scope
  (89 total hits) that wasn't in the "fixed" list above — most are already
  ≥40px via generous existing padding, but a full one-by-one measurement of
  all 89 wasn't completed. This is the single biggest remaining item if
  this audit continues.

---

## 6. Grids with no single-column fallback

Grepped every `grid-cols-[3-9]` in scope. Result: **every one already has a
responsive prefix** (`sm:grid-cols-N` or `lg:grid-cols-N` with a 1- or
2-column base) — the dashboard's KPI grid, quotes/invoices/clients stat
tiles, settings stat grids, the analytics KPI dashboard. Nothing to fix
here; this was the second pleasant surprise.

The one non-Tailwind-utility grid template bug (`settings/products/page.js`)
is covered in §3, not this section, since the failure mode there was
clipping, not a naive 3-up grid.

---

## 7. Hover-only affordances

Grepped scope for `group-hover:opacity|group-hover:visible|group-hover:flex
|group-hover:block` and `opacity-0 ... hover:opacity-100`. **Zero hits.**
No row action in scope is hover-only/unreachable on a phone.

---

## 8. Settings forms with a fixed two-column layout that doesn't stack

Checked for `w-1/3`/`w-1/4` label columns and arbitrary `grid-cols-[Npx...]`
form templates. Found none in scope beyond the two table-shaped grids
already covered in §3. The settings forms that do use side-by-side
label/field pairs (material-costs, overhead, leave, etc.) all use
`grid-cols-1 sm:grid-cols-N` or plain stacked `space-y-*` — already
mobile-safe.

---

## 9. Recorded for the global 16px form-control rule (NOT fixed here)

Per instructions, `app/globals.css` is owned by a parallel agent adding a
global 16px rule for native form controls (the iOS zoom-on-focus bug). Below
is every native `<input>`/`<select>`/`<textarea>` in scope carrying
`text-xs`/`text-sm` that the global rule needs to catch. Found by scanning
each scope file for these tags and checking their `className` (including
multi-line JSX attribute blocks) for `text-xs`/`text-sm`. **126 elements**
across 40 files — grouped below by file, with the tag's opening line:

```
app/app/quotes/page.js:135 <input> text-sm
app/app/invoices/page.js:137 <input> text-sm
app/app/jobs/page.js:150 <input> text-sm
app/app/quotes/[id]/ImportedCostsPanel.js:211 <input> text-xs
app/app/clients/page.js:86 <input> text-sm
app/app/leads/page.js:306 <input> text-sm; :786,:801,:868 <select> text-sm; :942 <input> text-sm
app/app/appointments/page.js:839 <select> text-sm; :1203,:1226 <input> text-sm
app/app/crew-inbox/page.js:735 <input> text-sm
app/app/invoices/new/page.js:301,425,472 <input> text-sm; :435 <textarea> text-sm
app/app/invoices/[id]/page.js:1283 <textarea> text-sm
app/app/invoices/[id]/edit/page.js:248,255,267,317,330,352,391 <input> text-sm; :365 <textarea> text-sm
app/app/jobs/[id]/JobDetail.js:288 <select> text-sm
app/app/jobs/[id]/edit/page.js:160,178,188 <input> text-sm; :210,242 <select> text-sm
app/app/settings/account-billing/CancelFlow.js:449 <textarea> text-sm
app/app/settings/messages/page.js:120 <textarea> text-sm
app/app/settings/booking-page/page.js:717 <select> text-sm; :852,891 <input> text-sm
app/app/settings/refer/page.js:193,301,325 <input> text-sm
app/app/settings/email-templates/page.js:295 <input> text-sm
app/app/settings/website/SectionEditor.js:81 <textarea> text-sm; :90,175 <input> text-sm
app/app/settings/website/PairPhotos.js:166 <input> text-sm
app/app/settings/website/Builder.js:729 <textarea> text-sm; :767 <input> text-xs
app/app/settings/work-areas/page.js:116 <input> text-sm
app/app/settings/instant-quotes/page.js:502,560,574,1479,1507,1523 <input> text-sm; :1453 <textarea> text-sm
app/app/settings/team/page.js:645 <select> text-xs
app/app/settings/voice/page.js:1556,2270,3148,3253 <input> text-sm; :1595,1726 <textarea> text-sm
app/app/settings/links/page.js:269,284,328 <input> text-sm; :336 <input> text-xs
app/app/settings/availability/page.js:69,76 <input> text-sm; :265 <select> text-sm
app/app/settings/templates/page.js:194 <input> text-sm
app/app/settings/quote-email/page.js:461,483,491 <input> text-sm
app/app/settings/expense-tracking/page.js:871 <select> text-xs
app/app/settings/email-templates/[id]/page.js:172,223,407,883 <select> text-sm
app/app/settings/expense-tracking/import/page.js:141,597 <select> text-xs
app/app/settings/payroll/page.js:91,100,398,459,500,510 <input> text-sm
app/app/settings/translations/page.js:203 <select> text-sm
app/app/settings/overhead/page.js:505,825,831,1025,1211,1219,1230,1243,1255,1387,1393,1404 <input> text-sm; :1264 <select> text-sm; :1169 <select> text-xs
app/app/settings/notifications/page.js:208 <input> text-sm
app/app/settings/services/page.js:333,535 <input> text-sm; :643 <input> text-xs
app/app/settings/leave/page.js:627,673,688,703 <input> text-sm; :638,655 <select> text-sm
app/app/settings/company/page.js:785 <input> text-sm; (also :1214 flex-1 min-w-[120px], noted in §4 — no overflow risk, has flex-wrap)
app/app/settings/reviews/page.js:120 <input> text-sm
app/app/settings/reviews/Testimonials.js:231,349 <input> text-sm; :237,356,377 <textarea> text-sm
app/app/settings/team/workers/page.js:233,270,352 <input> text-sm; :290,316 <select> text-sm
app/app/settings/team/payroll/page.js:89 <input> text-sm
app/app/settings/templates/[id]/edit/page.js:168 <input> text-sm
```

This list was produced by a heuristic line-scanner (open tag → first line
matching `text-xs|text-sm` before the tag's closing `>`), not a full JSX
parser — it should catch the overwhelming majority but a handful of
unusually-formatted attribute blocks could be missed. Worth a `grep -rn
'text-xs\|text-sm'` sanity pass on native form controls after the global
rule lands, rather than trusting this list as exhaustive.

---

## What this audit did not get to

- **Full 44px tap-target inventory.** ~80 of the 89 `aria-label=`d controls
  in scope were not individually measured; §5 lists what was fixed and
  what needs a design call rather than a blind resize.
- **Visual confirmation of anything.** No browser/simulator was available.
  Every fix here is a reasoned code change, checked against `npm run build`
  and the specific `check:*` scripts that touch the files edited
  (`check:leads-drag`, `check:win-loss`, `check:kpis`, `check:undef`,
  `check:t-shadow`, `check:translations` — all pass) — not against a
  rendered phone.
- `npm run check:all`'s full chain (300+ sub-checks) was not run in full —
  it would take far longer than this session's budget and the vast
  majority check unrelated business logic. The checks specific to files
  touched here were run individually and pass. `check:mobile-safety`,
  mentioned in the task brief, does not exist in `package.json` in this
  worktree yet — presumably landing from the parallel `globals.css` agent.
  Nothing in this change adds `maximum-scale` or `user-scalable=no`
  anywhere.

## Verification run

```
DATABASE_URL=<dummy> npm run build   # exits 0 (no real DB in this worktree —
                                      # see AGENTS.md's Neon/env note; a dummy
                                      # DATABASE_URL is enough for `prisma
                                      # generate` + `next build`, never
                                      # committed)
npm run check:leads-drag             # 84 checks, 0 failures
npm run check:win-loss                # 92/92 assertions
npm run check:kpis                    # 172/172 assertions
npm run check:undef                   # clean
npm run check:t-shadow                # clean
npm run check:translations            # clean, all gated languages complete
```
