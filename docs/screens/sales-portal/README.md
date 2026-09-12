# Sales-portal frames — the real components, rendered against fixtures

`NN-<key>.<lang>.png` (en / fr / es, 1280 wide) are the /sales pages the
queue-console and Texts harnesses do not cover, rendered by
`harness/portal.jsx`: the shipped page components inside the shipped
SalesShell, fed by `harness/fixtures.js` through a `window.fetch` stub
that answers every `/api/sales/*` read. The fixture is the training
manual's worked example — Daniel (code `danielboves`), Easy Roofers Inc.
signed up 10 Sep 2026 17:06 UTC, Activated CA$20 at 19:19 UTC — so the
frames agree with the prose beside them (docs/sales/manual/). NN is the
manual chapter the frame sits in.

    OUT=/tmp/fq-portal-harness sh docs/screens/sales-portal/harness/build.sh
    OUT=/tmp/fq-portal-harness sh docs/screens/sales-portal/harness/capture-all.sh

Nothing here is drawn by hand: every frame is Chrome's own render of the
component, and the scene driver only presses shipped controls. The lead
detail and the note detail carry `params` as a resolved Promise, the way
Next 16 hands them over; the playbook page (a server component) is stood
in for by PlaybookView with the built-in seeds, which is what the route
renders when the playbook tables are absent.

Two things a fixture cannot be: the real session's data, and the real
clock. Dates are pinned (only the calendar's month cursor is the machine's
clock), and a rep's browser locale formats them — these were taken on an
en-US Chrome, so the French and Spanish frames carry en-US dates, exactly
as a French rep on an en-US Chrome would see them.

LIVE captures from the owner's signed-in session land in
`docs/screens/live/sales/<lang>/` and take precedence in the manual
(docs/sales/manual/figures.js) wherever the figure is a whole route.

---

## Earlier note — the live capture that was not possible on 2026-09-12

Attempted 2026-09-12. The Claude-in-Chrome extension reported exactly one
connected browser ("Browser 1", macOS, local — the profile holding the
Upwork tabs). In a fresh tab in that profile:

- `https://www.fieldquo.com/app` → redirected to `/login` (see `../public/07-login.png`)
- `https://www.fieldquo.com/sales` → redirected to `/sales/login` (see `../public/08-sales-login.png`)
- `https://fieldquo.com/app` and `https://fieldquo.com/sales` (apex, in case the cookie was host-scoped) → the same two login pages

The profile has used the app before (localStorage carries the `tour_seen_*`
flags and `fq-settings-groups`), and its Better Auth broadcast key records
`{"event":"session","data":{"trigger":"signout"}}` — so the sign-in the owner
refers to happened in a different Chrome profile, an incognito window, or a
different browser, none of which had the extension connected. No second
browser or profile was offered by `list_connected_browsers`, so there was
nothing else to try. Signing in is not something this capture may do.

To redo this folder: sign in to the URL above in the Chrome profile that has
the Claude extension connected, then rerun the capture. The frame list this
folder is meant to hold:


`/sales`: today; queue with a lead selected and each of the eight tabs
(company, contact, script, research, notes, disposition, tasks, leads); the
zone chips; the status menu open; the sidebar collapsed; playbook; my-leads
(+ detail); conversations; texts (+ thread, + new-message picker, + new-text
form, unsent); team (+ new-group modal, cancelled); notes; calendar;
my-companies (+ one company); demo; support; voicemail; pay (languages,
payout, earnings). Never Claim, Call, Auto-dial, Send, Accept or Reset.

Rendered frames driven from a fixture rather than a session already exist
for the queue screen in `../sales-console/` and for the texts screen in
`../sales-messages/`.
