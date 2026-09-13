# Team management in the Homebase shape — proof it renders

Captures of the real components driven by `harness/*.jsx`: each page is
bundled with esbuild, `fetch` is stubbed to answer its API from a fixture
built for "today" in the browser's own zone, and headless Chrome captures
the scene through the DevTools protocol at 1280 and, through a 375px
iframe (`harness/mobile*.html`), at phone width. Same pattern and the same
stubs as `docs/screens/scheduler-board/harness/`, plus a
`CompanyPreferencesProvider` stub (CAD money).

- `board-cost-attendance-1280.png` — the day board as the owner: the labour
  line (This day / This week, hours, overtime, "Rate not set: Luis Ortega"),
  the Labour Day band, "47.5h this week · over 40h" under Marc, the
  **Late 12 min** and **On time** chips on the blocks.
- `board-week-hours-1280.png` — the Week view with the Hours-this-week panel.
- `board-dispatcher-no-cost-1280.png` — the same board for a Dispatcher
  (no payroll access): hours and overtime, no money, the sentence saying why.
- `my-schedule-375.png` / `my-schedule-1280.png` — `/app/me/schedule` as a
  worker: a card per day, co-workers as initials, the note quoted, the
  override flag, Clock in on today's card, the holiday line.
- `time-off-team-1280.png` — the manager's Time off in the Homebase layout;
  `time-off-detail-375.png` — the details sheet on a phone (post-balance,
  other employees off); `time-off-add-1280.png` — Add time off on behalf.

`harness/build.sh` rebuilds the three bundles (paths are the scratchpad's;
edit `H=` for another machine); `python3 -m http.server` in the harness
directory and the scheduler-board harness's `cdp-shot.mjs` take the shots.
