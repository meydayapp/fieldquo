# Client-facing mobile usability audit

Scope: `app/quote/**`, `app/book/**`, `app/q/**`, `app/portal/**`, `app/site/**`,
`app/embed/**`, `app/plan/**`, and the shared components those pages render
(`app/components/SignaturePad.js`, `app/components/MediaUploader.js`,
`app/components/AddressAutocomplete.js`, `app/components/public/*`).

No browser was available for this pass. Every fix below is a code-level,
reasoned change — some are provable from source alone (a fixed pixel size, a
missing responsive prefix), one is verified against the actual compiled
Tailwind output (see §1). None were watched rendering in Safari/Chrome. Where
I could not get past "this looks right" to something checkable, it's marked
**unverified** rather than claimed as fixed.

---

## 1. iOS Safari auto-zoom on focus — FIXED, verified two ways

**Where it happened:** essentially every text input in scope. `text-sm`
(14px) inputs/selects/textareas appear in `SelfQuoteFlow.js`,
`KitchenSelfQuote.js`, `BookingFlow.js`, `QuoteApproval.js`,
`ContractorImportPanel.js`, `plan/[token]/page.js`, etc. Safari forces a zoom
whenever a focused control computes under 16px, and the page stays panned
after blur. Confirmed pattern, not a one-off — `grep` for `<input`, `<select`,
`<textarea` across scope turned up 26 controls, nearly all styled with
`text-sm`.

**Fix:** `app/globals.css:309`, a single unlayered rule:

```css
@media (max-width: 767px) {
  input:not([type="checkbox"], [type="radio"], [type="range"],
      [type="color"], [type="file"], [type="submit"], [type="button"],
      [type="reset"], [type="image"]),
  select,
  textarea {
    font-size: 16px;
  }
}
```

Not `maximum-scale=1` / `user-scalable=no` — forbidden by the task, disables
pinch-zoom for everyone, ignored by current Safari, and `app/layout.js`'s own
`viewport` export already documents the same decision.

**Why this wins the cascade, checked, not assumed:**

1. Read `node_modules/tailwindcss/index.css` directly. Its preamble is
   `@layer theme, base, components, utilities;`, and every utility class
   (including `.text-sm`) is emitted inside `@layer utilities { @tailwind
   utilities; }`. Per the CSS Cascade Layers spec, a rule outside any
   `@layer` beats every rule inside a named layer, regardless of selector
   specificity or source order. So this rule is deliberately **not** nested
   in the existing `@layer base { ... }` block above it in globals.css —
   that would put it back inside the losing side.
2. Ran the real `npm run build` and inspected the compiled CSS
   (`.next/static/chunks/450d3zzbp44tj.css`, 140KB). I wrote a small script
   to walk brace-depth from `@layer utilities{` and found it closes at byte
   131871 — `.text-sm{font-size:.875rem...}` sits at byte 63445, well inside
   that range. Our rule (`@media (max-width:767px){input:not(...)...}`)
   compiles to byte 135607 — **after** the utilities layer closes, i.e.
   genuinely unlayered in the actual output, not just in source. This is a
   grep-and-count check anyone can redo; it isn't a visual confirmation.

**Not verified:** nobody opened Safari on a real device to watch the zoom
not happen.

---

## 2. Fixed/sticky element collisions

Grepped scope for `fixed` and `sticky`. Two hits, both benign:

- `app/quote/[companySlug]/kitchen/KitchenSelfQuote.js:107` — `sticky top-0`
  header. No floating bottom control exists on this page to collide with it,
  and nothing scrolls under it without clearance (it's the first element).
- `app/site/[subdomain]/SiteBlocks.js:256` — `sticky top-0` site header.
  Same: no fixed bottom bar in this scope to collide with.

Every other file in scope explicitly avoids `position: fixed` by design —
`SelfQuoteFlow.js:45`, `BookingFlow.js:8`, and `EmbedFrame.js:8` all have
comments stating "no fixed positioning" because these render inside
iframes/embeds of unknown width and the surrounding page owns scroll. I found
no instance of the confirmed bug pattern (a floating button landing on
another control) inside this scope. **Not fixed because I found nothing to
fix** — the previously-fixed example elsewhere in the codebase does not
appear to have a sibling here.

---

## 3. Signature canvas (`app/components/SignaturePad.js`) — reviewed, no change made

Rendered by `app/q/[token]/QuoteApproval.js:887` — the highest-stakes control
in scope, since it's how a contractor gets paid.

- Uses Pointer Events (`onPointerDown/Move/Up/Leave`), which unify mouse,
  touch and stylus — not a mouse-only or touch-only implementation.
- `touch-none` (→ `touch-action: none`) on the `<canvas>` plus
  `e.preventDefault()` in the handlers stops the page from scrolling under a
  drawing finger, which is the classic way a touch signature pad breaks.
- Backing-store sizing (`canvas.width/height = rect.width/height * devicePixelRatio`)
  runs once in a mount-only `useEffect`, sized from
  `getBoundingClientRect()` at mount time. Since it only renders after
  `confirming === "accepted"` (a plain conditional render, not a
  display-toggle), the container already has real layout by the time it
  measures — so this should be correct on first paint.
- **Unverified, not fixed:** there is no resize/orientation-change handler.
  If a homeowner rotates their phone mid-signature, the canvas's CSS box
  changes but the backing store and existing strokes do not, which would
  skew a strokes-in-progress. I judged this a narrow edge case (most people
  don't rotate mid-signature) and left it alone rather than add resize
  handling I couldn't test — re-sizing a canvas after ink exists also clears
  it (a `canvas.width =` assignment always does), so a naive fix would trade
  one bug for a worse one (silently erasing a signature) without a way to
  verify the replacement. Flagging for a human with a real device rather
  than guessing.

---

## 4. `100vh` → `100dvh` — FIXED

**What breaks:** iOS Safari's `100vh` is measured with the browser chrome
(address bar) collapsed, which is taller than what's actually visible on
first paint. `min-h-screen` (Tailwind → `min-height: 100vh`) on a
`flex items-center justify-center` container can render its centered content
partly below the fold until the user scrolls or the chrome collapses. Several
of these pages use exactly that pattern for a loading/empty/confirmation
state — the two states most likely to be the very first thing a stranger
sees on the link.

`min-h-dvh` is already used elsewhere in this app
(`app/components/mobile/BottomSheet.js`, out of scope but proof Tailwind ^4
here ships dynamic-viewport utilities), so this is a drop-in swap, not a new
capability.

Fixed, `min-h-screen` → `min-h-dvh`, all in scope:

| File | Line(s) |
|---|---|
| `app/quote/[companySlug]/kitchen/KitchenSelfQuote.js` | 85, 106 |
| `app/q/[token]/QuoteApproval.js` | 958 |
| `app/q/[token]/not-found.js` | 26 |
| `app/portal/[token]/ClientPortal.js` | 314 |
| `app/portal/[token]/invoices/[id]/PortalInvoice.js` | 331 |
| `app/site/[subdomain]/not-found.js` | 23 |
| `app/plan/[token]/page.js` | 159, 170, 185 |

`app/quote/[companySlug]/SelfQuoteFlow.js:897` and
`app/book/[companySlug]/BookingFlow.js:1064` were already correctly avoiding
`min-h-screen` (comments explain why — they render inside a 600px iframe and
a forced viewport height would fight the host page's own scroll). Left
untouched.

**Not verified:** didn't watch Safari's chrome collapse/expand against
either version.

---

## 5. Grid with no mobile fallback — FIXED (one instance)

`app/q/[token]/QuoteApproval.js:659` (was line 651 before the edit) —
payment-schedule badges were `grid-cols-3` with no responsive prefix: three
fixed columns on a 375px phone.

This one is a real risk, not a hypothetical: `parsePaymentSchedule`
(`lib/documents/paymentSchedule.js`) reads the company's own free-text
payment terms field, so a stage's label can be `"At rough-in inspection"`
rather than `"Deposit"`, and the parser allows any number of stages that sum
to ~100% (`sum >= 95 && sum <= 105`) — not capped at three. Three columns on
~327px of usable width (page has `px-6 sm:px-8`) gives each badge roughly
100px, which a longer label wraps awkwardly into.

Fixed: `grid-cols-3` → `grid-cols-2 sm:grid-cols-3`.

Other `grid-cols-N` hits in scope were reviewed and left alone as
low-risk — all have either a responsive prefix already, or a `grid-cols-2`
base with short, bounded content (chip-style options from a fixed option
list, not free text): `SelfQuoteFlow.js:370/417/438` (field inputs and
timeline/budget chips, 2–5 short options), `SiteBlocks.js` (multiple
`grid-cols-2 sm:...` stat/gallery blocks). `SlotCalendar.js`'s `grid-cols-7`
day grid and `grid-cols-3 md:grid-cols-2` time-slot grid are unchanged — its
own comments already document a deliberate 40px-minimum thumb-size
calculation from a prior fix, and I had no evidence to override it.

---

## 6. Horizontal overflow from unbroken strings (email/phone/address) — FIXED (2 spots)

**`app/site/[subdomain]/SiteBlocks.js:1161–1173`** — the site footer contact
block renders `company.phone`, `company.email`, and the company's address
inside a `flex flex-wrap` row, each item `inline-flex` with no width
constraint. `flex-wrap` moves whole items to a new line when they don't fit —
it does not shrink text within one item. An email address has no spaces to
wrap at, so a company with a long email
(`reallylongfirstname.reallylonglastname@really-long-domain-name.com`, which
is realistic — this is user-entered company data, not validated for
display-length) would render past the viewport edge instead of wrapping,
pushing the whole page into horizontal scroll on a phone.

Fixed: added `break-words` to all three items, plus `min-w-0` on the email
link specifically (the one most likely to be long and spaceless).

**`app/quote/[companySlug]/SelfQuoteFlow.js:719–726`** — the same shape, on
the confirmation "prepared for" card: `[doc.client.email, doc.client.phone]`
joined with `" · "` inside a plain `<p>`. This is the address the *visitor
themself* just typed into step 3, echoed back inside a narrow document card
(and that card can render inside a 600px iframe on an embedded quote form,
narrower than a full page). Fixed with `break-words`.

I did not find a third instance — `QuoteApproval.js`, `PortalInvoice.js` and
`ClientPortal.js` do not render a client email/address directly (checked by
grep for `client.email` / `client.address` / `c.address` in each; no hits).

**Not verified:** didn't render an actual long email through either page to
watch it wrap instead of overflow.

---

## 7. Tap targets under 44×44px — FIXED (3 of the icon-only ones found)

Icon-only buttons/controls found and their status:

| Control | File:line | Before | After | Status |
|---|---|---|---|---|
| Mobile hamburger menu (`<summary>`, only nav on a multi-page mobile site) | `SiteBlocks.js:386` | `w-9 h-9` (36px) | `w-11 h-11` (44px) | **Fixed** |
| "Change service" step-back link | `BookingFlow.js:734` | `text-xs`, zero padding (~16–18px tall) | `+py-2` | **Fixed** |
| `BackLink` (shared by all 3 self-quote steps) | `SelfQuoteFlow.js:962` | same, zero padding | `+py-2` | **Fixed** |
| Photo-remove badge on upload thumbnails | `app/components/MediaUploader.js:135` | `h-6 w-6` (24px) | `h-8 w-8` (32px) | **Partially fixed** — see below |
| `SlotCalendar.js` nav arrows (prev/next month) | `NavButton`, `h-10 w-10` (40px) | — | unchanged | **Left alone, deliberately** |
| `SlotCalendar.js` day cells / time-slot buttons | `h-10 sm:h-11`, `min-h-10` | — | unchanged | **Left alone, deliberately** |

The two `-my-*` negative-margin attempts I first tried on the back-link
fixes were reverted before committing: combining `mb-3`/`mb-0.5` with a
`-my-*` utility on the same box means two Tailwind classes write the same
CSS property (`margin-bottom`), and which one wins is decided by Tailwind's
generated stylesheet order, not by position in the `className` string — a
fragile thing to rely on for a few pixels of cosmetic spacing. Went with
plain `py-2` instead: simple, provably correct, costs a few pixels of extra
whitespace around the link.

**MediaUploader's remove badge is not grown to 44px.** At `grid-cols-3` on a
375px phone the thumbnail tile itself is only ~110px square (page padding +
two 8px gaps eat the rest); a 44px corner badge would cover roughly 40% of a
single thumbnail. 32px (up from 24px) is a real, measurable improvement
without dominating the tile. Documented as a judgement call, not silently
shipped as "done."

**`SlotCalendar.js`'s 40px controls were left alone on purpose, not missed.**
The file's own header comment already states the reasoning: *"h-10 rather
than aspect-square, because a square cell is 38px on a 375px phone and a
thumb needs 40."* That's a considered, already-shipped decision from a
previous pass at this exact problem, with the constraint (7 columns fit on a
phone) spelled out. I had no new evidence to override it, so I didn't.

**Not checked exhaustively:** I grepped for `aria-label` and `<button` as
proxies for "icon-only control" rather than rendering every page and
measuring every element. A control that's icon-only but has neither
`aria-label` nor an obvious icon-import pattern could have been missed.

---

## 8. Grids/modals/hover — swept, nothing else found

- **Modals taller than viewport:** no modal pattern (`fixed inset-0` +
  dialog) exists in this scope. `app/components/mobile/BottomSheet.js`
  already handles `max-h-[85dvh]` + internal scroll, but it's explicitly out
  of scope (another agent's file) and wasn't touched.
- **Hover-only affordances:** grepped for `opacity-0 group-hover`,
  `invisible group-hover`, `hidden group-hover` (the pattern for content that
  only appears on a mouse hover) — zero hits in scope. Existing `hover:`
  classes found elsewhere are progressive-enhancement on already-visible,
  already-tappable controls (e.g. `hover:-translate-y-0.5` on a CTA button),
  not gates on functionality.
- **`EmbedFrame.js`** (iframe auto-resize via `ResizeObserver` +
  `postMessage`) was read in full — no fixed heights, already handles the
  "confirmation renders below the fold of a box that doesn't scroll" failure
  mode by design, with its own detailed comment explaining exactly that
  history. Nothing to fix.

---

## Verification performed

- `npm run build` — **exit 0**. (Required copying `.env`'s `DATABASE_URL`
  from the main worktree into this one — `prisma generate` needs it to
  resolve even without a live connection, per AGENTS.md; `.env` is
  gitignored and was not committed. Also symlinked `node_modules` from the
  main worktree rather than reinstalling — not committed, already
  gitignored.)
- `npm run check:all` — **all suites pass, 0 failures**, including
  `check:contrast` (`check-designer-contrast.mjs`) and `check:public-payload`
  — the two suites the task called out as things this scope could break. No
  new entry was added to the `check:all` chain.
- The cascade-layer claim in §1 was checked against the actual compiled
  `.next/static/chunks/*.css`, not just reasoned about — see that section
  for the exact method.
- Everything else in this document that isn't explicitly called "verified"
  above is a code-level judgement, not a rendered-and-observed one. No
  browser was available in this environment.
