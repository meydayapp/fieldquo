# The scheduler's day board — proof it renders

Captures of the real `app/app/scheduler/page.js` (DayBoard.js, ShiftModal.js)
driven by `harness/board.jsx`: the page is bundled with esbuild, `fetch` is
stubbed to answer `/api/shifts` from a fixture built for "today" in the
browser's own zone (so the live dots and the now-line line up), and headless
Chrome captures each scene through the DevTools protocol at 1280 and, through
a 375px iframe (`harness/mobile.html`), at phone width.

Every scene is a state a user can reach: the board, a block clicked open
(Edit shift with its lunch row), an empty hour clicked (New shift prefilled
with the person and the hour), the worker's own read-only row, and the week
list with its new Edit and break lines.

The fixture: five people — one clocked in (green), one on a running lunch from
the time clock (amber), one on approved vacation (OUT), one on a draft shift
outside their stated availability (dashed, warning glyph, grey cells after
18:00), one not scheduled but with a job visit on their row — and a coverage
gap at 16:30 inside opening hours (red).

`harness/build.sh` rebuilds the bundle; the stubs it aliases (next/link,
next/navigation, useTranslation) live beside the team-chat harness's copies
in the scratchpad and are the same files. `stubs/permissions.js` is the one
this harness adds: `?as=owner|dispatcher|worker`.
