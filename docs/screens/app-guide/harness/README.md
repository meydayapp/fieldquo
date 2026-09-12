# App guide harness

Renders every `/app` sidebar row and every Settings row — the REAL page
modules inside the REAL shell (AdminSidebar, SettingsSidebar, the providers
`app/app/layout.js` mounts) — against a fixture company, in en / fr / es, and
photographs each at 1280 wide for the sales guide's "Every screen" chapter.

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

- `screens.js` — the rows, in the order the two sidebars draw them.
- `guide.jsx` — the shell, composed provider-for-provider like the app's.
- `stubs/` — next/link, next/navigation, next/image, next/dynamic, the auth
  client and the service-worker client. Nothing else is stubbed: the
  translation hook, the providers, the pages and every component are the
  shipped ones.
- `fixtures/company.js` — the cabinet maker, its people, client, quote, job
  and invoice; `fixtures/routes-*.js` — the API answers, by sidebar group.
