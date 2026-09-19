# The day on a map — proof it renders

Captures of the real `app/app/appointments/page.js` (`?view=map`) and
`app/app/settings/work-areas/page.js`, bundled with esbuild, `fetch`/`fetchJson`
answered from a fixture built for "today" around Laval QC, the REAL Google Maps
SDK with the project's own key, and headless Chrome through the DevTools
protocol at 1280×720 and, with device emulation, 375×812.

- `map-owner-1280.png` — the owner: everyone, Marc 1–3 (teal), Ana 1–2
  (fuchsia), Dani 1–2 (indigo), an unassigned "?" (grey), Marc's second stop
  "No location on the map" in the list; stop 1 clicked, popover open.
- `map-owner-375.png` — the phone: the list first, "Show map" a button.
- `map-crew-1280.png` — Crew (Dani): their own two stops and the unassigned
  appointment; client name and address only.
- `map-estimator-1280.png` — an Estimator (Ana): own rows and the unassigned
  ones.
- `workareas-drawing-1280.png` — Settings → Work areas, owner, four corners
  placed for "South shore" (black draft with Maps' vertex handles), North
  Laval's saved zone in its colour.
- `workareas-drawn-1280.png` — the first corner clicked again: the zone saved
  through PUT /api/work-areas/[id]/polygon and drawn in South shore's colour.
- `workareas-readonly-1280.png` — a crew member: "Zone drawn" / "No zone
  drawn" as words, no drawing controls, the zones drawn read-only.

The harness (stubs for next/link, next/navigation, next/dynamic,
useTranslation, PermissionProvider, SettingsAccessProvider, auth-client,
fetchJson; `?as=owner|estimator|crew`, `?click=<kind:id>`, `?draw=<area name>`)
lives in the scratchpad beside the other screen harnesses; the drawing capture
drives real mouse clicks through `Input.dispatchMouseEvent`. The harness picks
which fixture rows to hand the page per role; the route's scoping itself is
proven by `scripts/check-schedule-map.mjs`, which executes it.
