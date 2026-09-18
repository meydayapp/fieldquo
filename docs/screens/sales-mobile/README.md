# /sales on a phone — every portal screen at 375 and 768, before and after

The second half of the owner's 2026-09-13 mobile ask: the reps' portal,
because "the owner and reps use phones too". `before/` and `after/` hold
every /sales screen — the twenty pages the shipped SalesShell wraps
(docs/screens/sales-portal/harness, extended that day to cover Texts, Team,
Conversations, a thread, Settings, Welcome, Login and the invite screen)
plus the queue console in nine states (docs/screens/sales-console/harness:
idle, on a call, ringing, answered, the lead drawer, maximised, the Contact
and Disposition tabs, a typed number) — at 375×812 and 768×1024, with the
same `audit.json` the platform folder carries.

    OUT=/tmp/fq-portal-harness  sh docs/screens/sales-portal/harness/build.sh
    OUT=/tmp/fq-console-harness sh docs/screens/sales-console/harness/build.sh
    node --experimental-websocket docs/screens/sales-mobile/harness/shoot.mjs after
    #   FRAMES=today,queue-ring  SIZES=375  DEST=/elsewhere

The audit is `docs/screens/platform-mobile/harness/audit.js` — one
measurement for both consoles.

## What was wrong (before/audit.json, 375)

The portal already had its phone chrome (top bar, five-tab bottom bar,
drawer — the 2026-09-11 work), and no screen scrolled sideways. What the
numbers found instead:

| Defect | Where |
|---|---|
| Primary buttons at 36–40px: Add lead, Send the text, Send, New event, the month arrows (34px), New message, New, Send reply, Sign in, Set password | leads, lead, calendar, messages, team, thread, login, invite |
| The queue's Dial buttons, script-language switch and zone chips at 36px | queue |
| The chat kit's section toggles at 32px | messages, team |
| Lead rows truncated the business name to 118px beside three badges | leads |
| The month grid needed 640px, so a phone saw Sunday to Wednesday | calendar |
| "Conversations" broke to "Conversation / s" in the bottom bar | every screen |
| The demo page crashed against a stale fixture (not a product defect) | demo |

The incoming-call drawer was already full-width at 375 and the dialler pad
already thumb-sized (56px keys) — `queue-ring-375.png`, `queue-375.png`.

## What changed

Every primary action is a 44px target; the deliberately dense 36px controls
are 44px below `lg` and unchanged above it (`min-h-[44px] lg:min-h-[36px]`).
Lead rows wrap. The calendar below `md` is a seven-column month of dots plus
an agenda list of the month's events — every day still opens "new event",
every event still opens itself. The bottom bar's label has the padding it
needs. The drawer container moved to `app/components/layout/NavDrawer.js`
with no change to its markup.

## 2026-09-17 — the drawer's status grid

The owner, from his phone: "the drawer menu of the mobile version of the
sales platform clogs all the statuses in a grid and stays on top of the
top menu buttons, not allowing me to see and click on Queue etc."

Reproduced at 375×660 — a 812px phone once Safari's toolbars are counted.
The drawer's status picker was the pill plus a two-column grid of six 44px
buttons, always open: 200px before the first nav row, so Texts, Team and
Notes showed and the other seven sat under "Signed in as" in a scroll box
nothing suggested was one. With the drawer open the scrim covers the bottom
bar, which is where Queue lives — so from the owner's seat the drawer was
all statuses and no way to Queue.

Now `layout="list"` in `app/components/sales/RepStatus.js` is the header's
own status button, full width, opening the six as one column IN the drawer's
flow behind one tap (`today-status-menu-375.png`); the status control and
the rows share one scroll box; and the foot is one row. All ten drawer rows
fit collapsed at 375×660, 375×812 and 390×844 (`today-drawer-375.png`).
The header's menu-mode picker is inside `hidden lg:block` and measured
`display:none` below lg; with the drawer closed every bottom-bar tab
hit-tests to itself.

## 2026-09-17 — the ring is an alert dialog

The owner rang his own number back and never saw a way to pick up: the
top drawer read as part of the page. Now a ring is a centred alert dialog
over a scrim (`app/components/AlertDialog.js`, shared with the Off
reminder) — `today-incoming-call-375.png`, `queue-ring-375.png`: a
full-width card inside 16px gutters, Pick up (52px, focused) above Decline
(52px), the ring clock top-right, Escape and the scrim inert. Answered on
the queue the call sits in the Dialer card as before
(`queue-ring-answered-375.png`); on any other screen it collapses to a
strip under the top bar. Under the caller line: Open the company · Notes
for a business the rep holds (`today-incoming-call-375.png`), the name
and "Held by …" with no link for another rep's
(`today-incoming-call-held-375.png`), "Not one of your leads · Save as a
new lead" for a number nobody holds (`today-incoming-call-unknown-375.png`).
Scenes: `portal.html?page=today&scene=incoming-call` (`-held`, `-unknown`)
on any page, and `&presence=offline&scene=reminder-then-ring` for the
reminder closing under a ring; the shooter's frames are the three
`today-incoming-call*`.
