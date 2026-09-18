# Texting a company that said "text me instead" — before and after

The owner's report (2026-09-18): a company told the rep "text me instead",
and the reps "find it a bit hard to send a new text — maybe it's not
linked". Then, live: a rep on a 1600px screen with "no options to send the
text or any text".

`harness/shoot.mjs` walks the flow through the portal harness
(`docs/screens/sales-portal/harness`) at 375, 1280 and 1600 and records every
sentence, every disabled control and every request into `record.json`
beside a frame per scene. `before/` is `origin/main` at `946b1b19`; `after/`
is this branch. The queue-card and ring-dialog frames come from
`docs/screens/sales-mobile/harness/shoot.mjs` (`queue-text-them`,
`queue-ring`, `messages-new`, `messages-compose-own`).

## What was measured before

| Scene | What the rep met |
|---|---|
| `a-history` — a number with four prior texts | The composer. Nothing in the way. |
| `b-held-no-history` — a held lead, no text yet | Only "First text: the introduction with your signup link … The wording is fixed". An empty "Pick their time zone…" select with Send disabled until chosen. No free-text box anywhere. |
| `c-typed-open` — New message → type a number → Open | Two extra presses, then the same fixed-introduction panel. |
| `d-thread-url-unknown` — `?thread=+1…` on nobody's lead | "This number is not on one of your leads, so the introduction cannot be sent from here." No control at all. |
| any first text | Free text posted to the reply route was refused: "You have not texted this number before. Start from the lead — the first message carries your signup link and the identification the law wants on a first contact." |
| 1600 × 900 | The middle pane ~300px between the list, the contact bar and a centred `max-w-7xl` band; the signup panel taller than the space under an empty thread inside the fixed-height, overflow-hidden frame — "Send the text" clipped below a fold nothing scrolled. |

## What is there now

- **A first-message picker** on an empty thread: *Write your own* / *As
  discussed on the call* / *Signup link*. The first two are the ordinary
  composer (the reply route, with the compliance footer and every gate);
  the third is the fixed introduction in a capped scroller. `?compose=own`
  opens on the blank box — the "Text them" control and the "They asked to
  be texted instead" outcome link here with it.
- **The composer is pinned**: the last flex item, drawn whole; whatever
  grows above it scrolls on its own.
- **The thread takes the width**: `/sales/messages` has no cap (like the
  queue) and the contact bar is a column only from 1400px (`ChatLayout
  contextColumnFrom="wide"`) — a sheet below that.
- **The time zone is answered in a row above the box**, pre-filled with
  the area code's suggestion (`lib/sales/areaCodeZone.js`, a suggestion the
  rep confirms by sending; the rule in `leadTimeZone.js` still never
  consults the area code), written on the lead by Send.
- **A number on nobody's lead prints why**, with "Text this number now"
  and "Save as a new lead"; a number another rep holds says whose.
- **"Text them" beside every Call button** (`app/components/sales/TextThem.js`):
  the Dialer card, the lead page, the call panel idle / live / after, the
  no-dial states, the ring dialog and the live strip.
- **"They asked to be texted instead"** as an outcome: no re-dial, the
  composer opens on save.

Rules that still stop a rep, on purpose: a number on the do-not-contact
list; a number another rep holds a lead or claim on; a number outside
Canada and the US; the 08:00–21:00 texting window in the prospect's zone;
FieldQuo's mailing address unset. Each is printed as the server's sentence
where the box would be.

Checks: `npm run check:sales-text-them`, `check:sales-messages`,
`check:sales-call-panel`, `check:area-code-zone`.
