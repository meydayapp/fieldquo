# /sales/messages, rendered

The real `app/sales/messages/page.js` bundled with esbuild against fixture
data (a stubbed `@/lib/fetchJson`, `next/link`, `next/navigation` and
`useTranslation` reading the shipped English catalogue) and the portal's own
compiled CSS, rendered in Chrome. Desktop frames are 1280 wide; phone frames
are 375 wide at 2×, captured through the DevTools protocol with device
emulation because headless Chrome's window will not go below ~500px.

These exist because two previous attempts at this screen were called done on
a green build, and the owner opened them and saw a list with a compose box.

| File | What it shows |
|---|---|
| `desktop-thread-bottom.png` | The three panes. Room list with all four groups (Done collapsed), the thread with a draft check-in in it, the composer with the draft hint and the CASL footer, the contact bar on Details. |
| `desktop-thread-top.png` | Thread scrolled to the top: day dividers, italic system rows (check-in sent, called · voicemail), the red unread line, avatar and name once per group. |
| `desktop-thread-mid.png` | Sequential grouping (two of ours under one header), a "Called · No answer" system row, the sticky day bubble. |
| `desktop-canned.png` | `!chk` in the composer: the canned-response popup filtered to the check-in wordings. |
| `desktop-suppressed.png` | A STOP conversation: red STOP tag, the STOP system row, no composer, the reason printed. |
| `desktop-context-channels.png` / `desktop-context-history.png` | The contact bar's other two tabs. |
| `desktop-new-message.png` | New message: the rep's own leads and claimed prospects, and the New text field. |
| `desktop-new-text-refused.png` | `+1 809 …` (Dominican Republic) refused by the server's sentence. |
| `desktop-new-text-accepted.png` | `+1 514 …` accepted: an empty thread with the first-contact (signup-link) panel as its composer. |
| `mobile-list.png` → `mobile-thread.png` → `mobile-context.png` → `mobile-back.png` | One pane at a time on a phone: list, thread with the back arrow, the contact sheet, back to the list. |
| `mobile-new.png` | The New message picker on a phone. |
