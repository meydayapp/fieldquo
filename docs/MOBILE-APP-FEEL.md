# Mobile "app feel" — primitives

Last updated: 31 August 2026.

## What this is

The owner's ask: "The mobile version should feel like an app. In some ways.
In terms of look and feel." Three primitives live under
`app/components/mobile/` now, built to `AGENTS.md`'s house style:

- **`BottomSheet.js`** — a modal that rises from the bottom below `lg`, and
  presents as an ordinary centred dialog at `lg` and above.
- **`AppBar.js`** — a sticky mobile page header: back chevron, title,
  optional right-hand action.
- **`TouchFeedback.js`** — a pressable wrapper (plus an exported class-string
  escape hatch) giving a real `:active` press state, no tap-highlight flash,
  no 300ms tap delay, no accidental text-selection loupe on long-press.

**None of these are wired into an existing page yet.** That's deliberate, not
an oversight — the brief for this pass was to build the primitives well and
document exactly how to adopt them, not to touch the sixty-some `/app` pages
that would need it. A component nobody has wired is honest; a half-wired one
across forty files is the thing AGENTS.md warns against. The "Where to adopt
this" section below names real files and is the todo list for that pass.

Also added: `docs/MOBILE-APP-FEEL.md` (this file) and a CSS block for another
agent to paste into `app/globals.css` — this task's file list explicitly
excludes that file (seven other agents are editing the repo right now), so
the block is here, ready to copy, rather than applied.

---

## `BottomSheet`

```jsx
import BottomSheet from "@/app/components/mobile/BottomSheet";

<BottomSheet
  open={open}
  onOpenChange={setOpen}
  title={t("app.someFeature.title")}
  description={t("app.someFeature.description")} // optional
  footer={<>{/* action buttons */}</>}            // optional, pinned
>
  {/* body content — scrolls internally if taller than the sheet */}
</BottomSheet>
```

### What it does, and how each requirement in the brief is met

| Requirement | How |
|---|---|
| Rises from the bottom below `lg`; centred dialog at `lg`+ | Two different `@base-ui/react` primitives, chosen by a `matchMedia("(min-width: 1024px)")` hook — **not** one popup restyled by breakpoint. See "Why two primitives, not one restyled popup" below for why that choice was made on purpose rather than by default. |
| Internal scroll; page behind doesn't scroll with it | `Drawer.Content` / the Dialog scroll wrapper both use `overflow-y-auto overscroll-contain` (Tailwind's `overscroll-contain`, i.e. `overscroll-behavior: contain`) — a drag that reaches the top or bottom of the sheet's own content stops there instead of leaking into the page underneath. |
| Body scroll locked while open, restored exactly on close | `@base-ui`'s own `modal` behaviour (the default, not overridden here) — "document page scroll is locked" per its own docs. This is the library's tested implementation, used deliberately instead of a hand-rolled `position: fixed` + scrollY save/restore, which is the classic source of the iOS "page jumps to top on close" bug this task named. Not reimplemented for the same reason `@base-ui`'s focus trap isn't reimplemented — see the brief's own instruction on that. |
| Focus trapped; returned on close; Escape closes | Same `modal` default: focus trap, `finalFocus` (returns focus to whatever opened it), and Escape are all built into `Root`. `initialFocus`/`finalFocus` are exposed as pass-through props for a caller with a specific field to focus. |
| Drag handle + swipe-down-to-dismiss | The handle is a plain decorative bar (`aria-hidden`); the swipe itself is `@base-ui`'s `Drawer` gesture engine — real touch-event tracking that already distinguishes an internal-content scroll from a dismiss-swipe (`Drawer.Content`'s own docs: exempted from swipe interference so its content can still be scrolled/selected). This is the built-in behaviour the brief says to prefer over hand-rolling — see "What I could not verify" for the honest caveat on it. |
| `padding-bottom: env(safe-area-inset-bottom)` | On whichever element is actually bottom-most: the footer's own padding when a `footer` prop is passed, otherwise the scrollable content's own bottom padding. |
| Never `100vh` | `max-h-[85dvh]` on both presentations. |

### Why two primitives, not one restyled popup

The first attempt styled a single `@base-ui` `Drawer.Popup` responsively —
bottom sheet below `lg`, centred box above it. That doesn't work, and the
reason is specific rather than "it looked wrong": `Drawer` drives its
slide/swipe animation through an inline CSS transform bound to a live
`--drawer-swipe-movement-y` custom property the library writes on every
pointer move. A responsive Tailwind override can win the *resting-state*
transform, but it can't stop the library computing and writing a **vertical**
swipe transform in a context — a desktop pointer — that has no vertical drag
gesture to track in the first place. That's not a styling bug to work around;
it's asking a gesture engine to run in a physical direction its whole model
doesn't fit.

So `BottomSheet` renders `@base-ui/react`'s `Drawer` below `lg` (bottom sheet,
real swipe) and its `Dialog` at `lg`+ (centred, no swipe — there's no finger
on a 27-inch monitor to track). Both branches render through the same
`SheetSections` helper for `title`/`description`/`children`/`footer`, so
nothing about what a caller passes in differs; only the chrome differs. One
component, one prop surface, as the brief asked for.

The breakpoint itself is read with `matchMedia` in JS rather than pure CSS
(`lg:hidden`, the way the rest of this pass and
`app/components/designer/StrokeWidthSidebar.js`'s own `md:relative` pattern
do it) for the same reason: `lg:hidden` can hide an element, but it can't
swap *which component tree* React mounted. `Drawer.Root` and `Dialog.Root`
are different subtrees, not one element restyled. The hook defaults to
`false` (mobile-first) on both the server render and the first client render,
then updates once after mount — avoiding a hydration mismatch, at the cost of
one silent re-render on a desktop browser before anything is ever opened
(`open` is caller-controlled and normally starts `false`).

---

## `AppBar`

```jsx
import AppBar from "@/app/components/mobile/AppBar";

<AppBar
  title={t("app.someFeature.title")}
  backHref="/app/some-list"     // used when there's no history to go back to
  rightAction={<button>…</button>}  // optional
/>
```

`lg:hidden`, sticky, translucent-plus-blur — the same technique
`AdminSidebar.js`'s own mobile bar uses (`bg-x/80
supports-[backdrop-filter]:bg-x/65 backdrop-blur-xl backdrop-saturate-150`,
copied verbatim for the fallback behaviour), but on `--background` /
`--foreground` tokens rather than `--sidebar` ones — `AppBar` sits on top of
ordinary page content, not the brand rail, and reusing sidebar tokens would
paint a content header in the company's brand colour under white-label, which
is wrong for a header that isn't the brand chrome.

**This replaces AdminSidebar's mobile bar on a page that adopts it, rather
than stacking under it** — a page wants either "☰ + logo" (the whole nav) or
"< Quote #204" (this page specifically), not both fighting for the same strip
of screen. A page that genuinely wants both should offset `AppBar` by
`top-14` via its `className`, the same way `SettingsSidebar`'s own mobile bar
already stacks below AdminSidebar's (see the comment on AdminSidebar's bar
for why that height is load-bearing).

### Back button: history-first, `backHref` as the deep-link fallback

`next/navigation`'s `useRouter()` has no public "can I go back" API — `push`,
`replace`, `back`, `forward`, `refresh`, `prefetch` are the whole surface.
`AppBar` falls back to `window.history.length > 1`: a link opened from an
SMS, an email, or a QR code (the way a contractor's client, or the
contractor themselves, actually reaches a deep page on a phone) opens a
**new tab**, whose history length is exactly `1` — that's the "chevron that
does nothing on a cold load into a deep link" failure the brief named, and
this check catches it correctly every time. Its known imprecision: it counts
the whole tab's history, not navigation *inside FieldQuo* specifically, so a
tab that visited other sites first before opening the app reads as "has
history" even though pressing back leaves the app — which is what a real
back button does in that situation anyway, so it's a native-browser answer,
not a wrong one.

If `history.length` says there's nothing to go back to, it uses `backHref`.
If neither is available, it logs a `console.warn` in development (never in
production) rather than silently doing nothing — a nudge for whoever adopts
this on a given page to make sure a deep-linkable page always passes
`backHref`.

---

## `TouchFeedback`

```jsx
import TouchFeedback, { TOUCH_FEEDBACK_CLASS } from "@/app/components/mobile/TouchFeedback";

// Wraps and renders its own <button> by default:
<TouchFeedback onClick={...} className="rounded-full bg-inverted px-4 py-2">
  {t("app.action.save")}
</TouchFeedback>

// Or composes with an existing element via `render` (the same pattern
// components/ui/badge.jsx already uses with @base-ui's useRender):
<TouchFeedback render={<Link href="/app/jobs" />} className="...">
  {t("app.nav.jobs")}
</TouchFeedback>

// Or, when wrapping isn't practical (an existing <Link>/<button> that
// already owns its className), apply the class set directly:
<Link href="/app/clients" className={cn(TOUCH_FEEDBACK_CLASS, "existing classes")}>
```

Bundles the four things a phone needs that `hover:` styling can't provide:
a real `:active` state (`scale` by default, `opacity` for elements that are
already a solid fill), `-webkit-tap-highlight-color: transparent`,
`touch-action: manipulation`, and `user-select: none`.

**The iOS `:active` quirk:** Mobile Safari does not apply `:active` styles on
a plain tap unless some touch handler is attached to the element (documented
WebKit behaviour, not a bug in this component) — without it, the CSS press
state is dead code on an iPhone specifically, the device this whole task is
about. `TouchFeedback` attaches a deliberately empty `onTouchStart` handler;
its presence, not its body, is what makes WebKit honour `:active` at all.
Reasoned from documented WebKit behaviour — see "What I could not verify"
below, this specific mechanism was not felt on a real device this session.

---

## CSS to add to `app/globals.css`

This task's file list is `app/components/mobile/**` and this doc only —
`app/globals.css` is another agent's file. The block below is what four of
the requirements need globally rather than per-component (a per-element
opt-in only reaches whatever gets wrapped in it, and almost nothing is
wrapped yet). **Does not include a 16px minimum on form controls for the iOS
auto-zoom bug** — the brief says a separate agent may already be adding that;
adding a second copy here risks two rules setting the same property in two
files, which is worse than one, so this only references it rather than
restating it.

```css
/* ── Mobile "app feel" — global touch/scroll behaviour ──────────────────────
   Added for app/components/mobile/* (see docs/MOBILE-APP-FEEL.md). A blanket
   default here means every existing button and link gets the flat,
   non-bouncy, no-tap-flash baseline immediately, even before any page adopts
   TouchFeedback/AppBar/BottomSheet directly — TouchFeedback's own classes
   still layer a STRONGER press effect (scale/opacity) on top where used.

   Does NOT set a 16px minimum on form controls for the iOS auto-zoom bug —
   see docs/MOBILE-APP-FEEL.md: another agent's pass owns that rule. */

html {
  /* Kills Mobile Safari/Chrome's own grey/blue flash on tap. This is
     unrelated to :focus-visible — a keyboard user's focus ring is a
     completely different mechanism and is untouched by this. */
  -webkit-tap-highlight-color: transparent;
}

html, body {
  /* Stops the whole PAGE rubber-banding when a drag starts past the top or
     bottom of the document — "the entire app wobbles like a website"
     specifically. Deliberately NOT set inside BottomSheet's own scroll area,
     which carries its own `overscroll-behavior: contain` (Tailwind's
     `overscroll-contain`) so ITS content can still settle at its own edges
     without the drag leaking through to the page underneath it. */
  overscroll-behavior: none;
}

a, button, [role="button"], summary {
  /* Removes the historical ~300ms tap-to-click delay a touch browser used to
     insert while waiting to see if a tap was about to become a double-tap
     zoom. Every clickable default element gets this without needing
     TouchFeedback specifically; TouchFeedback also sets it explicitly for
     elements rendered through its `render` prop that aren't one of these
     four tags. */
  touch-action: manipulation;
}

/* Opt-in for a scroll container that needs its own momentum scroll and must
   not leak its drag into whatever it sits inside — a horizontally-scrolling
   line-item table, a tab strip, any overflow-y-auto panel that ISN'T
   BottomSheet (which already carries this inline via Tailwind's
   `overscroll-contain`). Modern iOS Safari inertia-scrolls a plain
   `overflow: auto` element by default; `-webkit-overflow-scrolling: touch`
   is kept here for older WebKit — a no-op where iOS already does this
   itself, not a risk. */
.scroll-momentum {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
```

---

## Where to adopt this — real files, ranked by how often a contractor hits them on a phone

Adoption is a later pass; this is that pass's todo list; grepped for
`"fixed inset-0"` across `app/app` and `app/components` to find every
hand-rolled modal/drawer actually in the codebase today (34 files). Several
already do a crude version of the mobile treatment by hand —
`items-end sm:items-center` — without any of the real requirements (no
focus trap, no scroll lock, no swipe, no safe-area padding); that's the
concrete evidence the "feels like a website" complaint is about these
specific screens, not a general impression.

**Convert to `BottomSheet` first — highest traffic on the pipeline the
product exists to serve:**

1. **`app/components/admin/DeleteConfirmModal.js`** — used from
   `app/app/settings/team/timesheets/page.js`, `app/app/invoices/[id]/page.js`,
   `app/app/quotes/[id]/page.js`, `app/app/jobs/[id]/JobDetail.js`. A confirm
   dialog is the single most-repeated interaction in the product; it is also
   the cheapest possible sheet (title, message, two buttons — no scroll
   concerns).
2. **`app/components/SendConfirmModal.js`** — used from
   `app/app/quotes/[id]/page.js`, `app/app/crew-inbox/page.js`,
   `app/components/quotes/builder/QuoteBuilder.js`. Sending a quote is
   commonly the last thing a contractor does before leaving a driveway.
3. **`app/app/settings/expense-tracking/page.js`** ("Add Expense" modal) —
   logging a receipt from the truck is a canonical on-the-go, on-a-phone
   action; this is exactly the kind of form a bottom sheet with a pinned
   footer (Save button never scrolls out of reach) was built for.
4. **`app/app/invoices/[id]/page.js`** (`showPayment`, `showChase`) —
   recording a payment the moment a client hands it over on site, and
   chasing an unpaid one, both happen away from a desk.
5. **`app/components/quotes/builder/ClientPicker.js`** ("new client" modal)
   — building a quote in the driveway and needing to add the client on the
   spot.
6. **`app/app/quotes/[id]/EmailSectionsBlockedModal.js`** — the guard shown
   when trying to send a quote that isn't ready; hit at the exact moment a
   contractor is trying to send from the field.
7. **`app/app/scheduler/page.js`** and **`app/app/appointments/page.js`** —
   job assignment and calendar-event dialogs, both already doing the
   `items-end sm:items-center` hand-rolled sheet approximation, both things
   checked constantly between jobs rather than at a desk.

**Convert next — real, but lower phone-frequency (mostly settings/admin,
usually done sitting down):** `app/components/settings/BusinessHoursModal.js`,
`app/components/settings/ReplyToPromptModal.js`,
`app/components/team/AddEmployeeModal.js`,
`app/components/tax/TaxUnresolvedModal.js`, and the settings-page modals
under `app/app/settings/*` (custom-fields, follow-ups, email-templates,
payments, products, services, booking-page, team, website).

**A different shape — not a `BottomSheet` candidate as-is:**
`app/app/leads/page.js`'s lead-detail panel (`flex justify-end`, a right-edge
slide-over, not a small confirm/form). "Requests" is the pipeline's first
step and the one nav group AdminSidebar deliberately never folds — this is
opened constantly. Its current header (`sticky top-0`, title, close `X`) is
already shaped almost exactly like `AppBar`; the natural fix on mobile is
`AppBar` for that header plus a full-height sheet presentation (not the
capped `85dvh` `BottomSheet` uses), rather than forcing the existing
component into `BottomSheet`'s API.

**Where `TouchFeedback` matters most:** every `hover:` class in
`AdminSidebar.js`'s `NavLink`, the quick-add menu, and the bottom-of-rail
rows — all invisible on the device this task is about, since the mobile
drawer variant of that same sidebar renders through the identical
`sidebarContent()` function. `AdminSidebar.js` is explicitly off-limits for
this pass (listed in "off limits, though you should READ them"), so this is
named here for whoever picks up that file next, not touched.

---

## What I could not verify

No browser was available this session — everything below was built by
reading `@base-ui/react`'s own documentation and source layout
(`node_modules/@base-ui/react/docs/react/components/{dialog,drawer}.md`), not
by feeling it on a device. Per the brief: stated as unverified, not as
working.

- **The swipe-down-to-dismiss gesture itself.** `@base-ui`'s `Drawer` is a
  real, tested gesture engine (this is why it was used instead of hand-rolling
  one), and its documented contract does distinguish an internal-content drag
  from a dismiss-swipe. Whether the specific feel — swipe distance, velocity
  threshold, how it reads on an actual iPhone — is right was not, and could
  not be, felt this session.
- **The iOS `:active` fix (`onTouchStart={() => {}}` in `TouchFeedback`).**
  Reasoned from documented WebKit behaviour. Not confirmed on a device.
- **The enter/exit animation** on both `BottomSheet` presentations (slide-up
  on mobile, scale/fade on desktop) — code-reviewed against `@base-ui`'s
  documented `data-starting-style` / `data-ending-style` / CSS-variable
  contract, not watched running.
- **Safe-area padding** (`env(safe-area-inset-bottom)`) — correct per the CSS
  spec and applied to the right elements by inspection, not confirmed against
  a notched device's actual home-indicator geometry.
- **The translucent-blur `AppBar` header** against a company's brand colour
  under white-label — uses `--background`/`--foreground` tokens rather than
  `--sidebar` ones specifically to avoid the contrast trap `lib/documents/theme.js`
  exists for, but no live contrast measurement was run against it (unlike a
  client-facing document surface, `AppBar` is `/app`-only, which is not
  currently white-labelled per-brand the way client-facing surfaces are —
  worth confirming against `lib/documents/theme.js`'s scope before assuming
  this needs the same measured-contrast treatment).
- **Full `npm run check:all`** (280+ scripts) — this WAS actually run in
  full this session (not skipped), and passed with `0 failure(s)` in every
  one of its 26 summarised sections. Listed here only because it wasn't a
  given going in — it's a very large chain — and it's worth stating plainly
  that it was run rather than assumed to be fine.

## Verification performed

- `npm run build` — exits `0`. Full production build, including
  `check-imports`, `check-exports`, ESLint (`check-undef` config), env-docs,
  `prisma generate`, and `next build` against the real route tree.
- `npm run check:all` — every one of its ~280 chained scripts, `0 failure(s)`
  in all 26 summarised sections. Includes `check:designer-reach` and
  `check:nav-audit`, both read beforehand per the brief's instruction (to
  confirm an unreferenced new component directory doesn't trip either) and
  both confirmed passing with the new files present.
- `node scripts/check-t-shadow.mjs`, `node scripts/check-translations.mjs` —
  both clean; no shadowed `t`, and the two user-facing strings
  (`app.action.back`, `app.action.close`) reuse existing, already-translated
  keys rather than mint new untranslated ones — the check's own key-typo scan
  only recognises `app.*`-prefixed keys already in the catalogue, so this was
  a deliberate choice, not a lucky pass.
