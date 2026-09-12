# /app/messages, rendered

The real `app/app/messages/page.js` — the contractor's Facebook / Instagram /
WhatsApp inbox, rebuilt on the shared chat kit (`app/components/chat`) — bundled
with esbuild against fixture data and the app's own compiled CSS, rendered in
headless Chrome. `window.fetch` is answered from `harness/fixtures.js`;
`next/link`, `next/navigation`, `useTranslation` (the shipped English
catalogue), the permission provider and the company-preferences provider are
stubbed (`harness/stubs/`). Desktop frames are 1280 wide; phone frames are
375 wide at 2×, captured through the DevTools protocol with device emulation
(`harness/cdp-shot.mjs`). The demo scenario's threads come from the REAL
`lib/messaging/demoThreads.js`, so the mock on screen is the shipped one.

These exist because looking is how the last two rebuilds found what the checks
missed. This one found four things before the owner could: raw
`app.messages.activity.*` keys on every system row, `Waiting {n} min` on every
badge, `Conversation {n}` in every header, and a thread that landed a screen
above its newest row whenever the last message was a photo.

Rebuild: `sh docs/screens/app-messages/harness/build.sh` (paths inside point at
the scratchpad the harness was built in; copy the folder and adjust `SP`).

| File | What it shows |
|---|---|
| `desktop-facebook.png` | The three panes. Room list grouped Needs a reply · Waiting on them · Snoozed · Done (collapsed), each with its unread total; a Facebook thread with day dividers, system rows (quote linked, assigned), the red unread line, sequential grouping; the Reply / Note tabs over the kit composer; the context bar on Details with the status and assignee controls. |
| `desktop-instagram-unread.png` | An Instagram thread: the unread line above three new messages, a photo attachment drawn in the row, the thread pinned to its bottom after the photo loaded. |
| `desktop-outcome-menu.png` | The outcome chip in the thread header, open: Won · Lost · No reply · Not a job · Open. |
| `desktop-context-outcome.png` | The context bar's Outcome tab: the temperature panel, the four-chip outcome control, and what each outcome means. |
| `desktop-context-history.png` | The History tab: the conversation's activity rows and the review month it counts in, linking to the monthly review. |
| `desktop-whatsapp-window.png` | A WhatsApp thread with the 24-hour window closed: the failed reply in red with Meta's sentence, the undated system row, the template picker, the typing box off with Send alive. |
| `desktop-refused.png` | A reply the server refused: the sentence under the box, the failed row in the thread, the words kept in the box. |
| `desktop-readonly.png` | A member at `requests: view_only`: the outcome chip disabled, no Mark done, status read-only, the composer off with the reason. |
| `desktop-blocked.png` | A real company with nothing connected: the connect card with its link to Meta Ads settings, an honest empty list, no invented conversations. |
| `desktop-awaiting.png` | A real company waiting on Meta's `pages_messaging` approval: the card says so and where the Page lives. |
| `desktop-demo.png` | The demo company: the shipped mock threads, the Sample tag, the composer off with the demo reason. |
| `mobile-list.png` → `mobile-thread.png` → `mobile-context.png` → `mobile-back.png` | One pane at a time on a phone: list, thread with the back arrow and the composer as the last flex child, the context sheet, back to the list. |
| `mobile-blocked.png` | The connect card on a phone. |
