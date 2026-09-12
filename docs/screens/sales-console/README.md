# /sales/queue — the rep console, rendered

The real `app/sales/queue/page.js` inside the real `app/sales/SalesShell.js`,
bundled with esbuild against fixture data (a stubbed `@/lib/fetchJson`,
`next/link`, `next/navigation`, `useTranslation` reading the shipped English
catalogue, and a fake `@twilio/voice-sdk` Device that can be rung from the
console) and the portal's compiled Tailwind CSS, rendered in headless Chrome.
Desktop frames are 1280×1000; phone frames are 375×812 at 2×, captured through
the DevTools protocol with device emulation. `harness/` is everything that
produced them (`build.sh`, then `shot.sh` / `mshot.sh` with a `scene=`).

The fixture call script passes `validateCallScript` (no digits anywhere) and
its ask names no day and no clock time.

| File | What it shows |
|---|---|
| `first-cut-*.png` | The three earlier frames the owner redirected from (three cards; dialler on the right; two columns). Kept as history. |
| `desktop-idle.png` | The approved frame: sidebar, top bar (search · status menu · name), the queue rail folded, Previous · 1 of 11 · Next + Next in queue, the phone-style Dialer on the left, the tall tabbed card on the right with Script open — numbered steps, Key talking points, Goal. |
| `desktop-call.png` | On a call: the live block (timer, caller-id notice, Mute, Hang up) in the Dialer, the keypad in DTMF mode. |
| `desktop-typed.png` | A number keyed in on the pad; the note that Call saves it on this lead first. |
| `desktop-typed-refused.png` | A typed number the numbers route refused (a do-not-contact record): the sentence under the display, no dial. |
| `desktop-typed-call.png` | The typed number dialled (saved, then rung by its id) and a DTMF key pressed on the call. |
| `desktop-dial-button.png` | The Dial button beside a number on the Contact tab: pasted into the display and rung through the same gate. |
| `desktop-tab-company.png` … `desktop-tab-leads.png` | Each tab: Company (Edit, Dial per number, tags, capabilities), Contact (owner + why, numbers, published email, add-number, Call history), Research (the three layers), Notes, Disposition (no call to write up → the ten outcomes listed; Next steps; the wrap-up), Tasks (callbacks, check-in drafts), Leads (the batch, grouped by window). |
| `desktop-rail-expanded.png` | The queue rail unfolded: trade picker, the grouped day, the current row highlighted. |
| `desktop-ring.png` / `desktop-ring-closed.png` | The incoming-call drawer down from under the top bar (business · number · Claimed by you · Pick up · Decline), and the same screen after Decline. |
| `desktop-ring-answered.png` | Picked up: the drawer gone, the inbound call's controls in the Dialer's live-call slot. |
| `desktop-zone-pt.png` | The zone chips (All · ET · CT · MT · PT) with PT selected: the list filtered inside its window groups, "closed — opens 11:00 AM" under the chip, the walk (Next, Next in queue) following the filter. |
| `desktop-all-shut.png` | 9:20 pm Eastern with every held row shut: "All 8 of your leads are outside their calling window right now" and the one button, Claim the next 25 (open now only). |
| `desktop-top-up.png` | The rolling batch topping itself up: fewer than 5 open → three Pacific rows appended, two dead Eastern rows released, the quiet toast "Added 3 leads open now (PT). 2 closed leads released.", the header line "3 open now · 6 closed · next batch auto-adds below 5". |
| `desktop-status-menu.png` | The rep-status dropdown open. |
| `desktop-maximized.png` | The tabbed card taking the viewport. |
| `mobile-idle.png` / `mobile-drawer.png` / `mobile-tab-contact.png` / `mobile-tab-script.png` | The phone: dialler first, then the tabbed card; the queue as a drawer. |
