# App guide harness

Renders every `/app` sidebar row and every Settings row — the REAL page
modules inside the REAL shell (AdminSidebar, SettingsSidebar, the providers
`app/app/layout.js` mounts) — against a fixture company, in en / fr / es, and
photographs each at 1280 wide for the sales guide's "Every screen" chapter.
The rows after those (`chapter: "help"`) are the help centre's figures
(`lib/help/figures.js`, `harness:<slug>`): the detail pages, the pages a
homeowner opens from a link, the crew's phone.

```sh
sh docs/screens/app-guide/harness/build.sh          # bundle + Tailwind CSS (once)
node --experimental-websocket docs/screens/app-guide/harness/shoot.mjs           # all
node --experimental-websocket docs/screens/app-guide/harness/shoot.mjs en quotes # one
OUT=/some/dir sh build.sh && OUT=/some/dir node --experimental-websocket shoot.mjs
```

Output: `docs/screens/app-guide/<lang>/NN-<slug>.png`, NN the row's position
in `screens.js`. `shoot.mjs` prints, per frame, any uncaught error and every
API route the page asked for that `fixtures/` does not answer — an empty
list because a request 404ed is not a real render, and the fix is a fixture
in the right `fixtures/routes-*.js`, never a retouched image.

- `screens.js` — the rows, in the order the two sidebars draw them, then
  the help-centre rows (appended, never inserted — NN is the row's index).
  A row may carry `params` (what useParams() returns), `props` (the
  component's props, or a builder name in `fixtures/public.js`), `mode:
  "public"` (mounted the way app/layout.js mounts a client-facing route: no
  shell, no session), `wrap` (the page.js wrapper around a public
  component), `member` ("crew" / "dispatcher" instead of the owner),
  `scene` (controls operated before the frame — guide.jsx runScene),
  `width` and `height` (375 for the phone; taller for a document whose
  point is below the fold).
- `guide.jsx` — the shell, composed provider-for-provider like the app's.
- `stubs/` — next/link, next/navigation, next/image, next/dynamic, the auth
  client, the service-worker client and the AI provider (which reads
  process.env at import). Nothing else is stubbed: the translation hook,
  the providers, the pages and every component are the shipped ones.
- `fixtures/company.js` — the cabinet maker, its people, client, quote, job
  and invoice; `fixtures/routes-*.js` — the API answers, by sidebar group;
  `fixtures/routes-help.js` — the detail pages, the client-facing routes and
  what the same routes answer the crew (consulted first; a reply may call
  `ctx.next()` to defer to the group file's answer); `fixtures/public.js` —
  props for the two client pages whose page.js reads the database.
- The page is served at `https://app.fieldquo.com` (shoot.mjs intercepts
  that origin and answers from the build output and `public/`), so every
  control that prints `window.location.origin` prints the real address.
