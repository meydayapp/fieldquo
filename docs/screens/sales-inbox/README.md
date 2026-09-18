# /sales/threads, rendered

The real `app/sales/threads/page.js` (and `EmailComposer.js`) bundled with
esbuild against fixture data — `harness/stubs/fetchJson.js` answers the
page's requests from `harness/fixtures.js` in the exact shapes
`app/api/sales/threads` and `app/api/sales/threads/[id]` return — with the
portal's compiled CSS, in headless Chrome through the DevTools protocol
(`harness/cdp-shot.mjs`; phone frames at 375×812 @2× with device emulation).

Rebuild: `sh docs/screens/sales-inbox/harness/build.sh <out-dir>`, then
`node --experimental-websocket harness/cdp-shot.mjs <png> <w> <h> <scale> "file://<out-dir>/inbox.html?open=t-acme[&do=reply]" [mobile]`.
Scenarios: `?scenario=notConnected`. Scripted steps: `?do=reply|quoted|
compose|keys|context|search|templates` (`harness/actions.js`).

| File | What it shows |
|---|---|
| `desktop-1600-thread.png` | The three panes at 1600: the list (search, Inbox / Archived / All, "Your leads" and "Everything else", unread bold with the time in colour, subject + snippet, Needs a reply / Waiting on them chips, the draft pencil, the group unread counts), the thread with three earlier messages folded to a line and the latest open ("Show quoted text" under it), Reply / Reply all / Forward pinned under it, and the company pane on Details with Open lead and Open texts. |
| `desktop-1600-reply.png` | Reply open: To as a chip from the closed recipient set with "Add…" for the others on the record, "Add Cc", the textarea with a bulleted list typed, the thread's own PDF offered under "Attach from this conversation", Send / Templates / Discard, "Not saved yet" (autosave 1.5 s later), the formatting hint and Ctrl+Enter. |
| `desktop-1280-thread.png` / `desktop-1280-context.png` | At 1280 the company pane gives way (it is a column from 1400); "Contact" opens it as a sheet. |
| `desktop-1600-quoted.png` | Rob Melton's thread with the quoted text unfolded. |
| `desktop-1600-templates.png` | The Templates menu on a reply: Signup link, Follow-up (in the prospect's language; the engine's check-in draft when one exists). |
| `desktop-1600-keys.png` | The `?` sheet: j/k, Enter, r, a, f, c, /, e, u, Ctrl+Enter, Esc. |
| `desktop-1600-compose.png` | `c` → the lead picker → a new email to Acme Painting in the middle pane. |
| `desktop-1600-search.png` | "invite" typed in the search: subject, bodies, names and address searched server-side, the list narrowed. |
| `desktop-1600-not-connected.png` | The rep whose mailbox the owner has not connected yet: *"Your mailbox hasn't been connected yet — ask the owner."* and nothing more. |
| `mobile-list.png` → `mobile-thread.png` → `mobile-reply.png` → `mobile-context.png` | One pane at a time on a phone, like the Texts page: the list, the thread with its back arrow, the reply box, the contact sheet. |
