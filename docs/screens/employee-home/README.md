# The employee home — screens

Rendered from the real components against a fixture by `harness/home.jsx`
(no server, no login, nothing written): `sh harness/build.sh <out>` bundles
it, `harness/cdp-shot.mjs` captures it. `?screen=home|requests|availability|
week`, `&as=worker|manager|owner`, `&scene=form|cover|modal`.

| File | What |
|---|---|
| home-375 / home-1280 | the worker's Home: next shift, quick actions, Today, Coming up, shout-outs |
| cover-375 | the Find cover sheet |
| manager-home-375 / -1280 | the manager's Home: today line, report tiles, Dispatch, Team status, Needs review, quick links |
| requests-375 / -1280 | the Requests hub |
| availability-375 / -1280 | the availability request form (effective date, days and times, Cancel / Submit) |
| week-1280 / week-375 | the scheduler's week grid: Events and Open shifts rows, wages / hours footer |
| week-modal-1280 | the shift modal with Apply-to weekday toggles and the open-shift option |

`docs/screens/app-guide/en/119-my-home.png` is home-375, for the help
centre's `harness:my-home` figure.
