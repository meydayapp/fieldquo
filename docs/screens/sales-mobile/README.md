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
