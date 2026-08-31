# Mobile bottom tab bar

Added: 31 August 2026, per the owner's direct ask — "the mobile version should
feel like an app... the navigation model is the single biggest thing standing
in the way." Below `lg`, `/app` now shows a fixed bottom tab bar
(`app/components/layout/MobileTabBar.js`) instead of only AdminSidebar's
sticky top bar + full-screen drawer, which is the web pattern this replaces
(the top bar and drawer both still exist and still work — the tab bar sits
alongside them, not instead of them, for everything past the four tabs it
holds).

## The four tabs, and why not others

**Requests → Quotes → Jobs → Invoices.**

This is not a guess. It is AdminSidebar's own stated order for `NAV_GROUPS`'s
"Work" group — its comment reads "the order inside Work is the order work
actually moves" — and it is the same order AGENTS.md's pipeline diagram
draws: `Lead → Quote → (client approves) → Job → Invoice → Payment`. Two
independent places in this codebase already agree on what a contractor's four
busiest screens are; the tab bar just puts them one thumb-reach away instead
of two taps (open drawer, find row) deep.

They are also, not coincidentally, the one part of the whole nav that carries
**no feature gate** — `lib/features/registry.js`'s `FEATURES` table has no
entry whose `navKeys` names `app.nav.requests`, `app.nav.quotes`,
`app.nav.jobs` or `app.nav.invoices`. Every other candidate row (Insights,
KPIs, Marketing, the Designer, the receptionist, crew inbox, funnels) either
depends on a company's plan or a feature flag, or both. A tab that can vanish
because a trial expired is a worse anchor for "the four things you always
reach for" than one that can only be narrowed by the member's own permission
grid — so the choice doubles as the most stable one available, not just the
most central.

**What did NOT make the cut, on purpose:**

- **Calendar/Appointments** — real, and close behind Invoices in how often a
  crew opens it, but a fifth pipeline stop pushes the bar to six slots
  (4 + Calendar + More), which the brief explicitly rules out ("FOUR or FIVE
  tabs. Not six.").
- **Home** — not a tab at all. The mobile top bar AdminSidebar already
  renders (still visible below `lg`, unchanged by this work) links its own
  logo to `/app`. Spending one of five slots on a destination that already
  has a permanent one-tap path felt like the weaker use of the space than a
  fourth pipeline stop.
- **Clients** — the nav audit's own reasoning for *why* Requests/Quotes/
  Jobs/Invoices sit first in "Work" and Clients sits in a separate "People"
  group applies here too: Clients is who the work is *for*, not a stage the
  work moves *through*. It stays one tap away in the drawer via "More."
- **AI copilot / crew inbox / marketing** — all feature-gated, all narrower
  audiences than "everyone who opens `/app` on a phone."

## "More" opens the SAME drawer — it does not duplicate the nav

The brief was explicit that this must not become a second menu. AdminSidebar
holds `mobileOpen` as private `useState` with no exported setter, no context,
no custom event — and this task's file list does not include
`AdminSidebar.js`, so adding one was out of scope.

This is not a new problem in this codebase, and it already has a precedent:
`app/components/OnboardingTour.js` opens the exact same drawer from *outside*
AdminSidebar for the exact same reason — the first-run walkthrough has to
point at rows that live inside it — by finding the real DOM node AdminSidebar
renders for its own hamburger button, `[data-tour-open="nav"]`, and calling
`.click()` on it. That runs AdminSidebar's own `setMobileOpen(true)`, so it is
the same open, not a second one, and it is a technique this codebase already
trusts (the welcome tour exercises it on every first run). `MobileTabBar.js`
follows the same pattern for its "More" tab.

**This is not the ideal shape, and the file says so at the point it matters.**
A shared `mobileOpen`/`setMobileOpen` — lifted into a small context both
AdminSidebar and MobileTabBar read, or into `app/app/layout.js` and passed to
both as props — would be strictly better: it would let MobileTabBar know the
drawer is open (to style "More" as active, or to close it when a tab is
tapped) instead of firing a DOM click and never hearing back, and it would not
depend on AdminSidebar keeping that exact `data-tour-open="nav"` attribute on
that exact element. It was not done here because it requires editing
`AdminSidebar.js`, which this task's file list places out of scope (five other
agents were editing it concurrently). If a future pass touches AdminSidebar
for any other reason, lifting this state at the same time would remove the
DOM-click dependency for both this component and OnboardingTour.

## Gating: the same two filters AdminSidebar runs, not a reimplementation

`MobileTabBar` calls `filterNavItemsByPermission(filterNavItems(TAB_ITEMS,
featureFlags), caller)` — the identical pipeline, identical order, identical
shared helpers (`lib/features/nav.js` and `lib/permissions/nav.js`) AdminSidebar
runs on its own `NAV_GROUPS`/`BOTTOM_ITEMS`. `featureFlags` comes from
`useFeatureFlags()`, `caller` from `usePermissions()` — the same two providers
`app/app/layout.js` already resolves server-side and wraps the whole `/app`
subtree in, so this costs no extra query and can never disagree with what the
drawer decides to show the same member, because it asks the exact same
functions the exact same question.

Concretely, for the pipeline's four rows (from `lib/permissions/nav.js`):
`NAV_REQUIREMENTS` gates all four at `view_only` on their own category
(`requests`, `quotes`, `jobs`, `invoices`) — "the bottom rung of each ladder,
so this hides the row from exactly one audience: somebody explicitly set to
'No access'," per that file's own comment. Anyone with at least view access
keeps all four tabs; a member set to `none` on all four (the file names Crew
as the audience this exists for) sees zero of them.

**If gating removes every tab, "More" alone must not look like a hole.**
Each tab (including "More") is `flex-1` up to a `max-w-[7rem]` cap and the row
is `justify-center`, so with the normal 4–5 tabs they fill the bar edge to
edge exactly as the brief asks, and in the rare all-four-hidden case a single
centred "More" button reads as a deliberate compact control rather than one
button stretched across a 390px screen. This was reasoned through, not
screenshotted — see "What I could not verify" below.

## App-feel details and where each requirement was met

- **Breakpoint** — `lg:hidden` on the `<nav>`, matching the exact class
  AdminSidebar already uses for its own mobile top bar and drawer. No new
  breakpoint was invented.
- **Safe area** — `pb-[env(safe-area-inset-bottom)]` on the bar, added as
  space *below* a fixed `h-16` (4rem) content row rather than squeezed inside
  it, so the safe-area inset is additive rather than eating into the tap
  targets. **This depends on `viewport-fit=cover` on `<html>`/the meta
  viewport tag, which a parallel change (per the brief) is adding to the root
  layout.** At the time this was written, `app/layout.js` in this worktree
  has no `viewport-fit=cover` — `grep -n "viewport-fit" app/layout.js`
  returns nothing. The padding is written correctly regardless (`env()`
  simply resolves to `0` until that meta tag lands, which degrades to "no
  extra padding," not to a broken layout), but the actual home-indicator
  clearance on a real iPhone will not appear until that other change merges.
- **Content clearance** — `app/app/layout.js`'s `<main>` gained
  `pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0`. The `4rem` is not a
  guess pulled from a screenshot; it is the literal `h-16` given to the tab
  bar's own content row, kept in the two places as the same written number
  precisely so a future change to one has to touch the other on purpose.
- **Icon above a short label, same accent when active** — measured, not
  assumed (AGENTS.md's own recurring-failure-class #6). The obvious version —
  an accent-coloured label directly on the bar's navy background — was
  checked against `app/globals.css`'s actual tokens the same way
  `scripts/check-sidebar.mjs` checks AdminSidebar: `--sidebar-primary`
  (`#ff5a00`) as text on `--sidebar` (`#06356b` light / `#081729` dark) comes
  out to roughly **3.9:1**, under the 4.5:1 floor this codebase holds body
  text to. So the active tab instead gets the *same* fill-and-foreground pair
  AdminSidebar's own "rail selected row" already uses and
  `check-sidebar.mjs` already proves clears 4.5:1 in both themes —
  `bg-sidebar-primary` / `text-sidebar-primary-foreground` — applied to a
  rounded pill wrapping icon and label together, so both genuinely share one
  colour rather than two separately-tinted pieces that happen to match.
- **44px minimum target, even fill** — each tab's inner pill is
  `min-h-[44px] min-w-[44px]`, and the row uses `flex-1` (capped at
  `max-w-[7rem]`) so 4 or 5 tabs divide the width evenly.
- **`:active` feedback** — every tab and the "More" button carry
  `active:bg-sidebar-accent/50`, the CSS pseudo-class (distinct from the
  per-tab "is this the current route" JS boolean of the same English word).
  There is no `hover:` anywhere in the file — a phone has no hover state, and
  a control whose only feedback is a hover style that can never fire is
  exactly the "appears to work and doesn't" class AGENTS.md names.
- **Active tab from the route, nested routes included** — `isActive` mirrors
  AdminSidebar's own: exact match for `/app`, `pathname.startsWith(href)` for
  everything else, so `/app/quotes/abc123` lights the Quotes tab the same way
  it lights the sidebar's Quotes row.
- **Backdrop blur, degrading the same way** — the bar's background classes
  are copied verbatim from AdminSidebar's mobile top bar:
  `bg-sidebar/80 supports-[backdrop-filter]:bg-sidebar/65 backdrop-blur-xl
  backdrop-saturate-150`. Same fallback behaviour on a browser without
  `backdrop-filter` support, because it is the same rule, not a re-derived
  one.
- **Layering** — `z-40`, matching the top bar's own `z-40` (same mobile-chrome
  layer); the drawer it opens is `z-50`, so the tab bar never renders above
  it.

## The Jennifer collision — reported, not fixed here

`app/components/jennifer/JenniferPanel.js`'s toggle button is
`fixed bottom-5 right-5 z-50 h-14 w-14` (`app/components/jennifer/
JenniferPanel.js`, unread — not edited, per the brief). `bottom-5` /
`right-5` are measured from the *viewport's* corner, not from anything that
knows the tab bar exists, so on any screen below `lg` that button now sits
**directly on top of the tab bar's rightmost tab** — the button's 56×56 box,
20px off the bottom and right edges, lands squarely inside the bar's fixed
`h-16` (64px) + safe-area-inset footprint, which is exactly where "More" (or
Invoices, whichever ends up rightmost) renders. It is `z-50` against the tab
bar's `z-40`, so the chat button wins visually and blocks the tap target
underneath it.

**What should change, in `JenniferPanel.js` (not done here):** the button's
position needs to account for the tab bar's height below `lg` — something
like `bottom-5 lg:bottom-5` becoming a responsive pair, e.g.
`bottom-[calc(4rem+env(safe-area-inset-bottom)+1.25rem)] lg:bottom-5`, so the
chat bubble floats *above* the tab bar on a phone and keeps its current
position at `lg` and up, where the tab bar does not render at all. The `4rem`
and `env(safe-area-inset-bottom)` terms should stay in lockstep with the same
two numbers this change put in `app/app/layout.js`'s `<main>` padding, for the
same reason: one written constant instead of a magic number nobody can trace
back to its source if the bar's height ever changes.

## What could not be verified

This session has no way to open a real browser against this worktree's build.
A `fieldquo-dev` preview server was found running, but its `cwd` is the main
checkout (`/Users/emilioboves/StudioProjects/fieldquo`), not this isolated
worktree — visiting it would render the *unmodified* AdminSidebar/layout, not
this change, so it was not used for verification and nothing here should be
read as a confirmed screenshot. Reaching `/app` in any real browser also needs
an authenticated session and a working `DATABASE_URL`, neither of which exists
in this worktree (per `AGENTS.md`'s own note that `.env` never travels with a
checkout). So, specifically unverified by eye, only reasoned through against
measured tokens and the existing sidebar's own proven-safe pairings:

- The actual rendered spacing/overlap between the tab bar and the Jennifer
  button on a real phone viewport (described above from the two components'
  literal class values, not from a screenshot).
- Whether `env(safe-area-inset-bottom)` truly resolves to a non-zero value
  once `viewport-fit=cover` lands — it could not be tested locally either way
  (no real iOS Safari available to this session).
- Visual balance of the tab bar with 3 tabs (a supervisor-level grid that
  lacks one category) rather than the full 4 — reasoned about via the
  `max-w-[7rem]` + `justify-center` combination, not seen.

## Verification that WAS run

- `npm run build` — exits 0 (needed a throwaway local `DATABASE_URL` for
  `prisma generate`/`next build` to run at all in this worktree; no schema or
  data was touched).
- `npm run check:nav-audit` — 20/20 checks pass. `MobileTabBar.js` reuses
  `app.nav.requests`/`quotes`/`jobs`/`invoices`, which this check already
  audits via AdminSidebar's own `NAV_GROUPS`, so there was nothing new for it
  to catch — confirmed rather than assumed by actually running it.
- `npm run check:rbac-nav` — 35/35 checks pass (untouched: this audits
  `lib/permissions/nav.js` directly, which this change reads but does not
  modify).
- `npm run check:sidebar` — 101/101 checks pass (1 pre-existing warning about
  a dark-mode logo asset, unrelated to this change and not introduced by it).
- `npm run check:translations` — English and French app coverage stay at
  100%; Spanish/Ukrainian/Punjabi/Pyjabi/Tagalog stay at the same 82% they
  were at before this change, because `app.nav.more` was added to all six
  language blocks in `app/i18n/appMessages.js`, not just English — adding it
  to English alone would have dropped French below 100% and silently removed
  French from `APP_LANGUAGES` (the offered-and-reviewed set), which is exactly
  the kind of quiet regression this file exists to catch.
- `npm run check:all` — see the session's final report for the full-suite
  result; it was launched after the four checks above and covers hundreds of
  scripts unrelated to navigation, most of which this change cannot plausibly
  touch (voice, billing, pricebooks, etc.) but which the brief asked to be run
  in full regardless.
