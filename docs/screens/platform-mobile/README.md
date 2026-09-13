# /platform on a phone — every console screen at 375 and 768, before and after

The owner, 2026-09-13: "take a look at the platform because it is not mobile
friendly — you can fix this." This folder is the evidence on both sides of
that sentence: `before/` is every /platform route as it rendered that morning,
`after/` the same routes after the fixes, both at 375×812 (an iPhone) and
768×1024 (an iPad), and `audit.json` beside each set is what the DOM measured
— not what a screenshot looks like.

Nothing here is drawn by hand. `harness/` bundles every real
`app/platform/**/page.js` inside the real `app/platform/layout.js`
(PlatformSidebar and all) with esbuild, answers every `/api/*` request from
`harness/fixtures/` (shapes copied from the route handlers, data dense
enough to stress a table's width), and renders through headless Chrome with
device emulation. `harness/audit.js` runs inside each frame and reports
sideways overflow, tables outside a scroll container, tap targets under
44px, eliding text, dialogs taller than the viewport, fixed elements, and
the rail's width. `scripts/check-platform-mobile.mjs` executes the same
audit on every route and fails the build on the first four.

    OUT=/tmp/fq-platform-harness sh docs/screens/platform-mobile/harness/build.sh
    node --experimental-websocket docs/screens/platform-mobile/harness/shoot.mjs after
    #   ROUTES=/platform,/platform/growth  SIZES=375  SCENE=open  DEST=/elsewhere

Frames are named `<route with / as __>-<width>.png`; the dashboard is
`dashboard-375.png`. A scene (a control pressed before the frame — the
drawer, an accordion opened, a ticket expanded) is
`<route>-<scene>-<width>.png`.

## What was wrong (before/audit.json, 375)

| Defect | Where | Evidence |
|---|---|---|
| The 240px rail never collapsed; `<main>` got 135px | every route | `asides[0].w = 240`, `mainRect.w = 135` |
| Pages scrolled sideways — grids and flex rows wider than the phone | see the table in the session report | `docW` up to 1234 |
| Primary buttons at 36–40px | Sign in, Sign out, most forms | `tapPrimary` |
| Tables wider than the phone — all already in scroll containers | payouts, growth, performance, floor… | `tables[].inScroller = true` |

## What changed

- `app/components/platform/PlatformSidebar.js` — below `lg` the rail is a
  sticky top bar (hamburger `data-tour-open="platform-nav"`, the wordmark,
  the two badges) plus a slide-over drawer carrying the same rows and the
  sign-out; from `lg` up it is the rail it was, now sticky for the viewport
  and scrolling its own rows. The drawer is
  `app/components/layout/NavDrawer.js`, the one slide-over the /app and
  /sales sidebars now render too.
- `app/platform/layout.js` — `flex-col lg:flex-row`, phone padding.
- Per-page layout fixes — listed in the session report and in each file's
  comment.
