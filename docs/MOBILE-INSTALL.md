# Making FieldQuo installable

What changed, why, and — most importantly — the white-label finding, because
that's the part that could have shipped a real leak.

Files touched: `app/layout.js` (added `viewport`, extended `metadata` with
`appleWebApp`), `app/manifest.js` (new). Nothing else — no other agent's files
were touched, and none of `app/globals.css`, `app/app/**`, `app/site/**`, etc.
were edited (read-only, to understand the routing).

---

## 1. The white-label finding (read this first)

**The question:** FieldQuo is white-label by default (AGENTS.md non-negotiable
#1) — a homeowner must never be able to tell the contractor uses FieldQuo. A
web manifest is served at one URL for the whole origin. Contractor sites are
served from tenant subdomains (`sunset.fieldquo.com`). Could a manifest saying
"FieldQuo" reach a homeowner on a contractor's own branded site?

**What I found:** yes, by default, and the failure mode is exactly the one the
task described.

- `app/manifest.js` (the Next 16 file convention) is served at the single URL
  `/manifest.webmanifest`, origin-wide. There's no per-route manifest.
- `middleware.js` rewrites a tenant Host header (`sunset.fieldquo.com`) to
  `/site/sunset` for page routes — but its `config.matcher` explicitly
  excludes any path ending in a file extension:
  `"/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"`.
  `/manifest.webmanifest` ends in `.webmanifest`, so **middleware never runs
  for it**. The request reaches `app/manifest.js` directly, carrying the real
  Host header, completely bypassing the subdomain rewrite that protects every
  page route.
- The root layout has no nested override anywhere in the tree for `/site/**`
  (`find app/site app/quote app/book app/q app/portal app/embed -iname
  layout.js` returns nothing) — every client-facing route inherits the root
  layout's metadata untouched.

Left static, a static `manifest.js` returning `name: "FieldQuo"` would have
meant: a homeowner on `sunset.fieldquo.com`'s booking page, tapping "Install"
in Android Chrome, gets an install prompt for an app named FieldQuo with
FieldQuo's icon — on a page the contractor paid for specifically so their
own name would be the only one visible.

**The fix, scoped inside `app/manifest.js` only:**

```js
import { headers } from "next/headers";
import { subdomainFromHost } from "@/lib/site/subdomain";

export default async function manifest() {
  const headersList = await headers();
  const subdomain = subdomainFromHost(headersList.get("host"));
  if (subdomain) return null; // not FieldQuo's identity to give out
  return { name: "FieldQuo", /* ... */ };
}
```

`headers()` is a documented Request-time API — Next's own manifest doc notes
`manifest.js` "is cached by default unless it uses a Request-time API," which
is exactly this. Reading it here only opts this one small metadata route out
of static caching; it's a standalone route handler, not part of the page
render tree, so it has zero cost anywhere else. Verified against a running
build (see **Verification** below): a request with `Host:
sunset.localhost:3417` gets `null` (an invalid manifest — browsers ignore it,
no install prompt, no name, no icon); a request with the platform's own host
gets the real FieldQuo manifest.

**What this does NOT fully close.** The `<link rel="manifest">` tag itself,
and the `mobile-web-app-capable` / `apple-mobile-web-app-status-bar-style`
meta tags, are `metadata`/`viewport` fields exported statically from the root
layout — they render on **every** page, tenant subdomains included, because
`metadata`/`viewport` are part of the page render tree (unlike the manifest
route). Making them host-aware would mean calling `headers()` inside
`generateMetadata`/`generateViewport` on the root layout, which — per Next's
own docs — "opts the entire application into dynamic rendering," not just one
route. That's a real, app-wide performance cost, and not mine to spend
unilaterally inside a task scoped to two files.

I judged this acceptable because **neither tag discloses "FieldQuo" as text
or an image**:
- `mobile-web-app-capable` / `apple-mobile-web-app-status-bar-style` are pure
  behaviour flags (standalone rendering, status bar colour) — no name, no
  icon.
- The `<link rel="manifest">` tag itself just points at a URL; the URL now
  resolves to `null` on a tenant host, so following it discloses nothing.

**What I deliberately did NOT add, for exactly this reason:** `appleWebApp.
title`. That field becomes `apple-mobile-web-app-title`, which — like the
manifest's `name` — is a single value for the whole origin, and unlike the
manifest, `app/manifest.js`'s per-host trick doesn't apply to it (see above).
Setting it to `"FieldQuo"` would have pre-filled a homeowner's iOS "Add to
Home Screen" sheet with "FieldQuo" on a contractor's own subdomain. I left it
unset. In its absence, iOS falls back to the page's own `<title>`, which for
`/site/**`, `/quote/**`, `/book/**` etc. is already the contractor's business
name (`app/site/[subdomain]/page.js` has its own `generateMetadata`) — so the
omission is a real fix, not just a smaller version of the same leak.

**Residual, pre-existing leak — not introduced by this change, flagging it
because it's the same class of bug.** `app/icon.png` and `app/apple-icon.png`
already existed before this task and are root-level file-convention icons.
Next's static-metadata collector (`next/dist/build/webpack/loaders/metadata/
discover.js`) attaches root icons to every segment that doesn't define its
own, and no segment under `/site`, `/quote`, `/book`, etc. defines its own —
so **the FieldQuo favicon and Apple touch icon were already being served on
every tenant subdomain page before I touched anything**, and still are after.
This task's file list didn't include a place to fix that (it would mean
adding an `icon`/`apple-icon` file under each client-facing route segment,
all of which are other agents' files, or DB-driven per-tenant icon
generation, which is a materially bigger feature). Flagging it here rather
than silently leaving it: **the icon-level white-label leak is real, is not
new, and remains open.**

---

## 2. What was added, briefly

- **`app/manifest.js`** (new): `name`/`short_name` "FieldQuo" (short enough
  not to ellipsize), `display: "standalone"`, icons, `start_url: "/app"` —
  see reasoning below — scoped away from tenant hosts as described above.
- **`app/layout.js`**:
  - `export const viewport` — didn't exist anywhere in the repo before this.
    `width: "device-width"`, `initialScale: 1`, `viewportFit: "cover"` (turns
    on `env(safe-area-inset-*)`, which a parallel agent's bottom tab bar
    needs to clear the home indicator — load-bearing for their work, not
    cosmetic for this one). No `maximumScale`/`userScalable` — the owner's
    zoom/pan complaint is 14px form controls forcing iOS auto-zoom, being
    fixed at the source by other agents; locking zoom would take pinch-zoom
    away from anyone enlarging text, and current iOS Safari ignores the
    property anyway.
  - `themeColor` as a `(prefers-color-scheme)` media-query pair, using the
    real `--background` tokens from `app/globals.css` (`#f6f8fb` light,
    `#0a1220` dark) — not an invented hex, not the brand navy, because the
    status bar should match the colour actually at the top of the page,
    which for nearly every route is the plain background. **Known,
    accepted tradeoff:** `NO_FLASH` (top of `app/layout.js`) forces every
    non-`/app`, non-`/platform` route to light regardless of the visitor's OS
    setting, but `theme-color`'s `media` attribute matches the OS setting
    directly and can't see that override — so a homeowner in system dark
    mode gets a dark status bar over a light client-facing page. That's a
    one-line colour seam at the very top of the screen, not the "document
    renders illegibly" failure `NO_FLASH` exists to prevent. Dropping the
    dark branch entirely would trade that seam for `/app`/`/platform` (the
    only genuinely themeable surfaces) never getting a correct dark status
    bar at all — the worse tradeoff. A proper fix is a nested `viewport`
    export in `app/app/layout.js`; out of scope here (another agent's file).
  - `metadata.appleWebApp`: `capable: true`, `statusBarStyle: "default"`,
    **no `title`** (see white-label section above).

### Next 16 specifics worth knowing (this version differs from older Next)

- `appleWebApp.capable: true` now emits only the modern, unprefixed
  `mobile-web-app-capable` meta tag — **not** the legacy
  `apple-mobile-web-app-capable` one (checked directly against
  `node_modules/next/dist/lib/metadata/metadata.js`; there is no framework
  option to also emit the legacy tag). iOS has honoured the unprefixed tag
  since 16.4. If this product ever needs to support iOS < 16.4 in standalone
  mode, that would need a raw `<meta>` tag added by hand — not attempted
  here since there's no signal that's a real constraint.
- `appleWebApp.title` / `startupImage` / `statusBarStyle` do map to the
  classic `apple-mobile-web-app-*` prefixed tags — the framework covers all
  three, no raw tags needed for those.
- `manifest.js` returning a value keeps the route statically cached; calling
  a Request-time API (`headers()`, `cookies()`) inside it opts *that route
  only* into dynamic rendering, per the doc comment in `manifest.js` — this
  is what makes the white-label fix above possible without an app-wide cost.

---

## 3. Icons: what exists vs. what a complete set needs

Inspected with `sips -g pixelWidth -g pixelHeight -g hasAlpha`:

| File | Size | Alpha | Used as |
|---|---|---|---|
| `app/icon.png` | 256×256 | yes | manifest icon, favicon (existing Next convention) |
| `app/apple-icon.png` | 180×180 | no | manifest icon, `apple-touch-icon` (existing Next convention) |

Both pre-existed this task; I generated no new image assets.

**What's missing for a complete install experience** — said plainly rather
than declared and left to 404:

- **No 512×512 icon.** Android's install/splash UI wants a 512×512 source
  (used for the splash screen and higher-density launcher icons); Chrome will
  upscale the 256×256 I declared, which will look soft on high-DPI devices.
  Not declared in the manifest because it doesn't exist — declaring a size
  that 404s is the "dead control" failure class this codebase has been swept
  for before.
- **No maskable icon.** Android adaptive icons want a `purpose: "maskable"`
  variant with safe padding for the OS's mask shapes (circle, squircle,
  etc.); without one, Android falls back to the regular icon inside its own
  white/coloured backing shape, which is fine but not as polished as a
  purpose-built maskable icon.
- **`app/apple-icon.png` has no alpha channel** (correct — Apple explicitly
  recommends no transparency for `apple-touch-icon`, since iOS composites its
  own rounded-corner mask and a transparent source can look wrong under it).

None of these are blocking — the manifest and icons that exist are real and
declared honestly — but a genuinely polished install experience would want a
512×512 source and a maskable variant added deliberately, not generated by
me guessing at padding/safe-zones for a mask I can't preview.

---

## 4. `start_url` reasoning

Set to `/app`. A contractor adding FieldQuo to their home screen wants the
back office, not the marketing homepage — the marketing site's whole job is
converting a stranger into a signup, which isn't what someone tapping an
already-installed icon needs.

`/app` requires a session and redirects to `/login` when there isn't one
(`middleware.js`). That's not a dead end — it's identical to how any native
app behaves when you're signed out — so I judged it worth the (small) risk of
a logged-out user's first tap landing on a login screen rather than the
marketing site.

---

## 5. Verification

- `npm run build` — **exits 0.** Full log confirms `/manifest.webmanifest`
  compiles as a dynamic route (`ƒ`), `/icon.png` and `/apple-icon.png` remain
  static (`○`), and nothing else in the route list changed shape.
- Ran a production server (`npm run start`) locally and fetched the real
  output:
  - `GET /manifest.webmanifest` (default host) → 200, full FieldQuo manifest
    JSON (`name`, `short_name`, `icons`, `start_url: "/app"`, etc.)
  - `GET /manifest.webmanifest` with `Host: sunset.localhost` → 200, body
    `null` — confirms the white-label scoping actually works, not just reads
    correctly.
  - `GET /icon.png` and `GET /apple-icon.png` → both 200, confirming the
    manifest doesn't declare sizes that 404.
  - Inspected the rendered `<head>` on `/login`: `viewport-fit=cover` present,
    no `maximum-scale`/`user-scalable`, both `theme-color` media variants
    present, `<link rel="manifest">` present, `mobile-web-app-capable`
    present, `apple-mobile-web-app-status-bar-style` present, **no**
    `apple-mobile-web-app-title` — matches what was intended.

**What I could not verify:** actual install behaviour on a phone. I have no
way to add this to an iOS or Android home screen and look at the resulting
icon, label, splash screen, or standalone chrome from this environment — the
above confirms the server produces the right bytes, not that a device does
the right thing with them. If something looks wrong once installed (wrong
icon crop, missing splash, a stray browser bar), start with the icon-size gap
in §3 and the status-bar-style choice in §2 before assuming the manifest
itself is broken.
