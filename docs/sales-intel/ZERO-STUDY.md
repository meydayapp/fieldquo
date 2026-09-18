# Zero (0.email) — design and architecture study for `/sales/threads`

Read in place from `/Users/emilioboves/Downloads/Zero-staging` on 2026-09-18.
Nothing was copied: no code, markup, styles, icons or assets from that tree
appear in this document or in FieldQuo. Every claim below cites the Zero file
it was read from; paths are relative to the Zero repo root.

The purpose is to inform a rebuild of FieldQuo's sales-portal inbox
(`/sales/threads`) for a 1–20-person outbound floor that emails contractors.
FieldQuo keeps its own three-pane shape — thread list · thread view · the
right-hand company pane its Texts page (`/sales/messages`) already has — and
takes Zero's inbox *craft*, not its plumbing.

---

## 1. What Zero is

Zero is an open-source, self-hostable Gmail/Outlook front end with an AI layer
(summaries, auto-labels, a chat sidebar, compose assistance). It is **MIT
licensed** (`LICENSE`, "Copyright (c) 2025 Zero Email"); reading it for design
ideas is unrestricted and nothing from it has been copied into FieldQuo.
Monorepo: pnpm + Turbo (`package.json`, `pnpm-workspace.yaml`). The web app
`apps/mail` is React 19 + React Router 7 (SPA mode) + Vite, Tailwind 4, shadcn
/ Radix, TanStack Query, Jotai for local state, `nuqs` for URL state, tRPC to
the server, TipTap for compose, `virtua` for list virtualisation, and
`react-hotkeys-hook` for shortcuts (`apps/mail/package.json`). The server
`apps/server` is a Cloudflare Worker (Hono + tRPC) using Durable Objects with
embedded SQLite per mailbox shard, R2 for message bodies, KV for snooze /
scheduled-send / pending state, Queues for delayed send, Vectorize + Workers AI
for summaries and embeddings, and Postgres (Drizzle, via Hyperdrive) for users,
settings, notes, templates and hotkeys (`apps/server/wrangler.jsonc`,
`apps/server/src/db/schema.ts`, `apps/server/src/routes/agent/db/schema.ts`).
Auth is Better Auth with Google / Microsoft OAuth
(`apps/server/src/lib/auth.ts`). `packages/` holds only a CLI for env sync
(`packages/cli`), a Playwright harness (`packages/testing`), and shared
eslint/tsconfig — nothing product-level.

---

## 2. Inbox / thread list

Primary file: `apps/mail/components/mail/mail-list.tsx` (1109 lines), shell
`apps/mail/components/mail/mail.tsx`.

### Layout of the panes
`mail.tsx` renders a `ResizablePanelGroup` (react-resizable-panels,
`autoSaveId="mail-panel-layout"`): the list panel is pinned at 35 % (min = max
= 35), the thread panel takes the rest (min 30). On `< md` the thread view is a
`fixed inset-0` overlay instead of a pane; on `md`–`lg` the list hides when a
thread is open. The list header carries a search button that opens the command
palette (shows active filters as text, a `⌘K` kbd hint, and a "Clear" pill),
a Google-only category dropdown, and a refresh button. When rows are
bulk-selected the whole header swaps to "*n* selected" + an "ESC" exit button.
A 2-px coloured bar under the header fades in while fetching.

### Virtualisation
`VList` from **`virtua`** (`mail-list.tsx` ~line 985), `count`, `overscan={5}`,
`itemSize={100}` as an *estimate* — virtua measures real rendered heights, so
rows can differ (a row with a 2-line snippet vs. one without). Infinite scroll
is done in `onScroll`: when `findEndIndex()` is within 7 of the last row and
`hasNextPage`, call `loadMore()` (TanStack `useInfiniteQuery`, cursor =
`nextPageToken`, `apps/mail/hooks/use-threads.ts`). A small spinner renders
after the last row while `isFetchingNextPage`. Draft folder swaps the row
component (`Comp = folder === 'draft' ? Draft : Thread`).

### Data shape and the N+1 row fetch
`mail.listThreads` returns **ids only** (`{ id, historyId }`) —
`apps/server/src/lib/driver/types.ts` `IGetThreadsResponseSchema`. Each row
then calls `useThread(id)` → `mail.get` (`use-threads.ts`), cached 1 h. So a
list of 50 rows is 50 requests on first paint. It works because Zero's DO holds
everything locally, but it is a design FieldQuo should not copy (§9).

### Row anatomy (`Thread` component, `mail-list.tsx` lines ~200–520)
- Left: 32-px round avatar — BIMI brand logo when the sender's domain
  publishes one (`apps/mail/components/ui/bimi-avatar.tsx`, `bimi` tRPC route),
  else initial; a "group" icon when the latest message has > 1 recipient
  (`isGroupThread` in `use-threads.ts`); a blue tick-avatar when bulk-selected.
- Line 1: sender display name (quotes stripped, `cleanNameDisplay`), a 8-px
  blue dot immediately after the name when unread, `[n]` reply count when
  `totalReplies > 1`, a pencil icon when the thread has a draft
  (`latestDraft`), then system-label badges (`MailLabels` — only STARRED
  survives; UNREAD/INBOX are filtered out). Right-aligned: relative time.
- Line 2: subject (1 line, 95 % width) and, right-aligned, user labels as
  coloured chips (`RenderLabels`, `render-labels.tsx`) — first `count` shown,
  rest folded into a `+n` tooltip; clicking a chip toggles `label:<name>` in
  the search string.
- Line 3: 2-line clamped snippet (`latest.body`) in muted 12-px text.
- In the **Sent** folder line 1 becomes the subject and line 2 the `To:` list.
- Search hits are highlighted in name/subject/snippet (`highlightText`,
  `apps/mail/lib/email-utils.client.tsx`, driven by `searchValue.highlight`).
- Read rows are dimmed to 60 % opacity; unread name is bold.
- Time format (`apps/mail/lib/utils.ts` `formatDate`): `h:mm a` if today or
  within 12 h; `MMM dd` this or last month; else `MM/dd/yy`.

**Density**: `py-2` rows, `text-sm`, three lines — roughly 80–100 px per row;
no compact/comfortable setting exists (grepped `density|compact` — none).

### Hover actions
A floating pill (`absolute right-2`, translated −50 % so it straddles the top
edge of the row; on row 0 it drops inside to `top-4`) appears on `group-hover`
with four 24-px icon buttons: star, important, archive, bin (bin hidden in
Bin folder). Each stops propagation and calls the optimistic action.

### Unread / important / starred
All three are Gmail-style **labels on the thread** (`UNREAD`, `IMPORTANT`,
`STARRED`) — `apps/server/src/routes/agent/db/schema.ts` `thread_labels`;
`hasUnread = labelIds.includes('UNREAD')` in `getThreadFromDB`
(`apps/server/src/routes/agent/index.ts` ~1454). Google driver maps Gmail
`labelIds` straight through (`apps/server/src/lib/driver/google.ts` `parse`);
the Microsoft driver synthesises `unread: !isRead` and toggles Graph's
`isRead` (`apps/server/src/lib/driver/microsoft.ts` ~107, ~1098). Opening a
thread marks it read *optimistically* unless the user setting `autoRead` is
off (`mail-list.tsx` `handleMailClick`; `apps/server/src/lib/schemas.ts`).

### Optimistic state and undo (the pattern worth copying)
`apps/mail/hooks/use-optimistic-actions.ts` + `store/optimistic-updates.ts`
+ `lib/optimistic-actions-manager.ts` + `components/mail/optimistic-thread-state.tsx`.
An action (MOVE, STAR, READ, LABEL, IMPORTANT, SNOOZE, UNSNOOZE, DELETE_DRAFT)
is written to a Jotai atom keyed by thread id; each row reads its own
overlay (`useOptimisticThreadState`) — hidden for MOVE/SNOOZE, starred/read/
important overridden, labels added/removed. The **server mutation is
deferred**: a sonner toast with an "Undo" action is shown for 5 s and the
mutation runs only in `onAutoClose`/`onDismiss`; Undo simply drops the
overlay, nothing was sent (`createPendingAction`, lines ~100–180).
`mod+z` undoes the most recent pending action. Bulk actions show "(n items)".
On failure the overlay is removed and a toast says "Action failed".

### Selection
`use-mail.ts` holds `{ selected, bulkSelected[] }` in Jotai. Click modes come
from a global key-state map (`hooks/use-hot-key.ts` tracks Shift/Alt/Ctrl/Meta
down-state): plain click opens; **Ctrl/Meta+click** toggles; **Shift+click**
selects a range from the anchor; **Alt+Shift+click** selects everything from
that row down (`getSelectMode`, `handleSelectMail`). Escape clears the anchor
and selection; changing folder clears selection (`mail.tsx`). `mod+a` selects
all *loaded* rows. `select-all-checkbox.tsx` (not mounted in the current list
header, but complete) does the Gmail two-step: select the loaded page, then a
toast offers "Select all conversations" which pages through `listThreads` at
500/page to collect every id matching the folder + query.

### Keyboard navigation
`hooks/use-mail-navigation.ts`: `j`/`k`/`↑`/`↓` move a `focusedIndex` atom;
the focused row gets a ring and is opened *immediately* (navigate + mark
read), with `scrollIntoView(block:'nearest')` via `data-thread-id` lookup —
virtua keeps focused rows mounted because navigation is one step at a time.
Held arrow keys are throttled to one move per 100 ms via `requestAnimationFrame`.
`Enter` re-opens, `Escape` closes and clears focus. After archive/delete from
the thread view, `mailNavigationCommandAtom = 'next'` advances to the next
row (`thread-display.tsx` `handleNext`, `lib/hotkeys/thread-display-hotkeys.tsx`).

### Snooze
Dialog `components/mail/snooze-dialog.tsx`: native `date` + `time` inputs,
shows the resolved IANA timezone, refuses past times. Server
(`apps/server/src/trpc/routes/mail.ts` `snoozeThreads`): swaps labels
INBOX→SNOOZED in the DO SQLite and writes `threadId__connectionId → wakeAt`
to KV `snoozed_emails`. Waking is done **on access** — `listThreads` for the
Snoozed folder deletes expired keys and flips labels back — and was meant to
also run from the hourly cron (`apps/server/src/main.ts` `scheduled()`), but
the dispatch there is commented out (line ~1209), so in this tree a snoozed
thread only returns to Inbox when somebody opens the Snoozed folder. Snooze is
reachable from the row's right-click menu only (`components/context/thread-context.tsx`).

### Labels
`apps/server/src/trpc/routes/label.ts` (list/create/update/delete, proxied to
the provider), `hooks/use-labels.ts`, palette of six fixed text/background
pairs in `apps/mail/lib/label-colors.ts` (validated server-side —
`isValidLabelColor`). Applied from the right-click menu's "Labels" submenu
(`thread-context.tsx` `LabelsList`) with a "create new label" entry.

### Categories
Gmail-only tabs (Important / All Mail / Personal / Updates / Promotions /
Unread) are *saved search strings* per user
(`hooks/use-categories.ts`, `lib/utils.ts` `categorySearchValues`, e.g.
`is:important NOT is:sent NOT is:draft`); keys `1`–`0` toggle them
(`mail.tsx` `CategoryDropdown` `useHotkeys`, scope `mail-list`,
`enableOnFormTags: false`). Rendered only when the active connection is
Google and folder is inbox.

### Realtime
The Durable Object pushes `zero_mail_list_threads` / `zero_mail_get_thread`
over a PartySocket websocket; the client invalidates the matching TanStack
query keys (`components/party.tsx` enums; handler in
`components/ui/ai-sidebar.tsx` ~358–369). The list query also refetches on
mount with 1-min staleness.

### Right-click menu (`components/context/thread-context.tsx`)
Open in new tab · Reply · Reply all · Forward · (folder-dependent) Move to
inbox / Archive / Unarchive / Move to spam / Move to bin / Restore / Delete
from bin / Unsnooze · Snooze · Labels ▸ · Mark read/unread · Mark/unmark
important. Acts on the bulk selection if the clicked row is in it.

---

## 3. Thread view

Files: `components/mail/thread-display.tsx` (shell, toolbar, message list,
sticky reply), `components/mail/mail-display.tsx` (one message),
`components/mail/mail-content.tsx` (body renderer),
`apps/server/src/lib/email-processor.ts` (sanitise + quote collapse).

### Toolbar (`thread-display.tsx` ~760–900)
Left: close (X). Right: a **"Reply all" text button** (the primary action —
opens the composer on the latest message), notes panel toggle, star,
archive, bin (red-tinted), and a `⋯` menu: Print thread, Move to spam,
Unsubscribe (only when `List-Unsubscribe` headers exist), Mark as important,
or Move to inbox when in spam/archive/bin. The subject bar itself is inside
the first message card (below). `thread-subject.tsx` is a 1-line clamp with
"(no subject)" fallback at 50 % opacity, used elsewhere.

### Message grouping and collapsing (`mail-display.tsx` ~690–712, ~1640)
Messages render oldest→newest, divided by a top border. Default state: **only
the last non-draft message is expanded**; every earlier one is collapsed to
its header (avatar, bold sender name, verification badge, "Details" popover
trigger, date, `⋯` menu, `To:` line with the first 3 recipients + "+n
others", or "You" when you were the sole recipient). The message being replied
to is force-expanded. Collapse is a CSS grid `0fr → 1fr` height transition on
click of the header; clicks inside the Details popover are debounced 300 ms so
closing the popover does not collapse the card. If the thread has > 5
messages the last one is scrolled into view on open. Message index 0 also
carries the **thread header**: subject with `[n]` count, system-label badges
(overlapping coloured squares), user label chips, the participant list (first
two, "+n others" tooltip), the AI summary disclosure, and a "Thread
Attachments [n]" strip that aggregates attachments from every message.

### Body rendering and quoted text
The body is never rendered as React. `mail-content.tsx` sends the raw HTML to
`mail.processEmailContent` (tRPC) which runs `email-processor.ts`:
`sanitize-html` with an allow-list (adds `img`, `style`, `details`,
`summary`; `a` forced to `target=_blank rel=noopener`), a CSS sanitiser on
`<style>` blocks (8 allowed properties, no `url()`/`@import`), **quote
collapsing** — every `blockquote` and `.gmail_quote` not already inside a
collapsed block is wrapped in `<details class="quoted-toggle"><summary>Show
quoted text</summary>…</details>` — plus removal of `<title>`, 1×1 / 0×0
tracking pixels and hidden preheader divs. The client then injects a theme
`<style>` (light/dark colours for `:host`, links, the quoted-toggle rule) and
sets the result as `innerHTML` of an **open Shadow DOM root** so mail CSS
cannot leak out. Link clicks are intercepted inside the shadow root
(`window.open` for http(s), same-window for `mailto:`). Detection is purely
structural (tag/class); no "On … wrote:" text heuristics. Plain-text-only
messages are turned into HTML by replacing `\n` with `<br>` in the Google
driver (`google.ts` ~408–414) — there is no plain-text render path.

### Images
External images are blocked by default: the processor replaces non-`cid:`
`<img>` with a hidden comment and reports `hasBlockedImages`; an amber bar
offers "Show images" (session-only) or "Trust sender" (appends to
`settings.trustedSenders`). `settings.externalImages` allows all.

### Attachments
Per message: chips with file-type icon, name (15 ch), size, plus a download
button; `⋯` → "Download All Attachments" (zips with `jszip`). Attachment
bodies are fetched lazily (`mail.getMessageAttachments`, base64). The older
`attachments-accordion.tsx` (thumbnail cards in a collapsible) is not mounted
in the current thread view.

### Reply / reply-all / forward inline
`setMode('reply'|'replyAll'|'forward')` + `setActiveReplyId(messageId)` (both
URL state via `nuqs`). If the target is the **last** message the composer is
rendered **sticky at the bottom** of the pane; otherwise it is inserted
directly under that message (`MessageList` in `thread-display.tsx`). The
composer scrolls into view 100 ms after mount. `reply-composer.tsx` computes
recipients (reply: sender, or first `To` if you sent it; reply-all: sender +
To + Cc minus you, de-duplicated), sends `In-Reply-To` / `References` /
`Thread-Id` headers, prepends the quoted original as "On <date>, <name>
wrote:" (`lib/utils.ts` `constructReplyBody`) or a "---------- Forwarded
message ----------" block, and hands the result to `useUndoSend`.

### Mark unread / archive / etc. from the view
Star, archive, bin and important are on the toolbar; mark-unread is only in
the row's context menu. Archive/bin advance to the next thread with a
directional slide animation (80 ms) when `settings.animations` is on.

### Notes
A per-thread notes panel (`note-panel.tsx`, `notes` tRPC router, Postgres
`mail0_note` with colour + pinned) is private to the user, not the thread.

---

## 4. Compose

Files: `components/create/email-composer.tsx` (1170 lines),
`create/create-email.tsx` (modal wrapper), `hooks/use-compose-editor.ts`,
`create/extensions.ts`, `create/editor-autocomplete.ts`,
`create/email-phrases.ts`, `create/template-button.tsx`,
`create/schedule-send-picker.tsx`, `components/ui/recipient-autosuggest.tsx`,
`hooks/use-undo-send.ts`, `hooks/use-drafts.ts`.

### Editor
**Rich text: TipTap 2.23 / ProseMirror** with the `novel` extension bundle
(`extensions.ts`: StarterKit, underline, link with exit-on-space, images with
upload plugin + drag/paste `FileHandler` inlining as data URLs, task lists,
colour/highlight, horizontal rule, drag handle, character count, Markdown
input rules, emoji shortcodes). A toolbar (bold/italic/underline/lists/
blockquote/link/colour) is hidden behind a "Type" toggle. The body is sent as
`editor.getHTML()`. There is no plain-text mode.

### Ghost-text autocomplete (no model call)
`editor-autocomplete.ts` is a ProseMirror decoration plugin that shows a grey
inline suggestion from a **static phrase list** (`email-phrases.ts`: openers,
closers, follow-ups; time-of-day greetings with the recipient's name) when the
typed prefix matches; **Tab** accepts. Purely local, zero cost.

### AI (model calls, see §7)
"Generate" button → `ai.compose` (gpt-4o-mini) rewrites the typed prompt into
a full email using the thread as context and shows it blurred behind an
accept/reject preview; a sparkle next to Subject → `ai.generateEmailSubject`
(gpt-4o). Both disabled until there is body text.

### Recipients
`recipient-autosuggest.tsx`: chips (avatar initial + address + ×) bound to
react-hook-form arrays. Enter/Tab commit a valid address or the highlighted
suggestion; Backspace on empty input pops the last chip; paste splits on
`[,;\s]+` and keeps valid unique addresses; ↑/↓ browse suggestions from
`mail.suggestRecipients` (debounced 300 ms, limit 10, provider contact
search). Cc/Bcc rows are hidden until their toggles are clicked. A `From:`
select appears only when the connection has > 1 alias.

### Drafts autosave
`email-composer.tsx` ~443–545: any edit sets `hasUnsavedChanges`; an effect
starts a **3 000 ms timer** that calls `saveDraft()` → `drafts.create`
(provider draft API; `id` reused so the same draft is updated). Guards: skip
if body equals `initialMessage`, if **To, Subject or body is empty** (so a
subject-less reply is never autosaved), or while AI generation is running.
The returned id is stored in the `draftId` URL param. Send always saves first
then calls `mail.send` with `draftId` so the provider's `sendDraft` is used.
Closing with content prompts a confirm dialog. Reply composers open with the
thread's latest draft (`latestDraft` in `use-threads.ts`) as initial body.

### Templates and signature
`template-button.tsx`: per-user templates (Postgres `mail0_email_template`:
name, subject, body, to/cc/bcc) — a dropdown with search, "Save current as
template" (name dialog), delete; applying inserts body HTML at the cursor and
fills empty subject/recipients. There is **no signature feature** beyond a
`zeroSignature` boolean that appends "Sent via Zero" (`reply-composer.tsx`).

### Scheduling and undo-send
`schedule-send-picker.tsx`: calendar + `HH:mm` input, refuses the past. On
the server (`mail.ts` `send`): if `scheduleAt` **or** the user's
`undoSendEnabled` setting is on, the payload is written to KV and either
enqueued on `send_email_queue` with `delaySeconds` (≤ 12 h) or stored in
`scheduled_emails` KV for the cron (> 12 h); undo-send is simply a 15-s
delay. `mail.unsend` marks the status `cancelled` and deletes the payload.
Client toast (`use-undo-send.ts`) shows "Undo" while `sendAt` is in the
future. Sending also feeds a "writing style matrix" (Gemini 2.0 Flash) in the
background.

### Attachments
File input (`image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt`, multiple), paste
anywhere in the document, drag onto the editor. Images are recompressed
client-side (`lib/image-compression.ts`, quality low/medium/original from
settings). A paperclip pill with a popover lists files with size and remove.
A keyword check ("attached", "see the files", …) with no attachment shows a
"did you forget the attachment?" warning before send.

### Compose keys
`Mod+Enter` sends (TipTap keymap in `use-compose-editor.ts`); `Escape` closes
the compose modal (`lib/hotkeys/compose-hotkeys.tsx`). The `compose` hotkey
scope is enabled while a reply composer is mounted (`reply-composer.tsx`).

---

## 5. Keyboard shortcuts — the full map Zero ships

Declared in `apps/mail/config/shortcuts.ts` (single source, Zod-validated,
each with `scope`), wired by `apps/mail/lib/hotkeys/*.tsx` through
`useShortcuts` (`lib/hotkeys/use-hotkey-utils.ts`) on top of
`react-hotkeys-hook`. Scopes: `global` and `navigation` are always on
(`components/providers/hotkey-provider-wrapper.tsx`); `mail-list` and
`thread-display` are mutually exclusive, switched by whether `threadId` is in
the URL (`mail.tsx` ~345–363); `compose` is on while a composer is open.
`mod` = ⌘ on Mac, Ctrl elsewhere. Dvorak and non-QWERTY layouts are remapped
via the KeyboardLayoutMap API (`utils/keyboard-layout-map.ts`). A settings
page lists them (`app/(routes)/settings/shortcuts/page.tsx`) but editing is
commented out; the `shortcut.update` route exists with no caller.

| Scope | Keys | Action | Notes |
|---|---|---|---|
| global | `c` | Compose new email | preventDefault |
| global | `mod+k` | Open command palette (search) | |
| global | `mod+shift+f` | Clear all filters | preventDefault |
| global | `mod+z` | Undo last optimistic action | preventDefault |
| global | `v` | Open voice | declared, no handler wired in `global-hotkeys.tsx` |
| navigation | `g` `i` | Go to inbox | chord |
| navigation | `g` `d` | Go to drafts | chord |
| navigation | `g` `t` | Go to sent | chord |
| navigation | `g` `a` | Go to archive | chord |
| navigation | `g` `b` | Go to bin | chord |
| navigation | `g` `s` | Go to settings | chord |
| navigation | `shift+?` | Show keyboard shortcuts page | |
| list (always, `use-mail-navigation.ts`) | `j` / `↓` | Focus + open next thread | held arrows throttled 100 ms |
| list | `k` / `↑` | Focus + open previous thread | |
| list | `Enter` | Open focused thread | |
| list | `Escape` | Close thread, clear focus, clear selection anchor | |
| mail-list | `r` | Mark as read | bulk selection only (hover tracking is commented out) |
| mail-list | `u` | Mark as unread | bulk selection only |
| mail-list | `i` | Mark as important | bulk selection only |
| mail-list | `e` | Archive | bulk selection only |
| mail-list | `a` | Bulk archive | same handler as `e` |
| mail-list | `d` | Bulk delete (move to bin) | |
| mail-list | `s` | Bulk star | |
| mail-list | `escape` | Exit selection mode | |
| mail-list | `mod+a` | Select all loaded rows / clear | preventDefault |
| mail-list | `1`–`6` (config) / `1`–`0` (live) | Toggle category tab | live binding is in `mail.tsx` `CategoryDropdown`, Google inbox only |
| mail-list | `alt+shift+click` | Select this row and all below | documented only (`ignore: true`); implemented in `getSelectMode` |
| (mouse) | `shift+click` | Range select from anchor | `mail-list.tsx` |
| (mouse) | `ctrl/⌘+click` | Toggle row in selection | |
| thread-display | `r` | Reply to latest | |
| thread-display | `a` | Reply all to latest | |
| thread-display | `f` | Forward latest | |
| thread-display | `⌘+backspace` | Move thread to bin (delete if already in bin), then advance | |
| compose | `mod+Enter` | Send | TipTap keymap |
| compose | `escape` | Close compose | |
| composer field | `Tab` | Accept ghost-text suggestion / commit recipient chip | `editor-autocomplete.ts`, `recipient-autosuggest.tsx` |
| composer field | `Enter`, `Backspace`, `↑/↓` | Commit chip / pop last chip / browse suggestions | `recipient-autosuggest.tsx` |
| AI sidebar | `meta+0` | Toggle AI sidebar | `components/ui/ai-sidebar.tsx` |

Commented-out (never shipped): `i` details, `mod+p` print, `m` mute, `!`
spam, `v` move to folder, `o` expand, `#` delete, `u` unstar.

---

## 6. Search

**Syntax**: provider syntax passed through verbatim — Gmail operators
`from: to: subject: has:attachment is:unread|read|starred|important label:
after: before: in:` and boolean `NOT`/`OR`. The client builds the string from
"filters": the command palette (`components/context/command-palette-context.tsx`,
1905 lines, `cmdk`) offers From / To / Has attachment / Starred / Unread /
After / Before / Date range / Label filters, "Recent searches" (localStorage),
quick results, and "Try natural language". Active filters are chips above the
palette and are persisted to `localStorage['mail-active-filters']`; the search
button in the list header shows them joined by ", ". Clicking a label chip on
a row toggles `label:<name>` (`render-labels.tsx`).

**Natural language** has two tiers: a regex pass (`lib/utils.ts`
`parseNaturalLanguageSearch`: "from x", "to x", "subject x", "has attachment",
"is unread") and, for anything else typed into the palette, an **LLM call**
`ai.generateSearchQuery` (gpt-4o, `apps/server/src/trpc/routes/ai/search.ts`)
that emits a Gmail/Outlook query string. `getMainSearchTerm` picks a word to
highlight in rows.

**Where it runs**: if `q` is non-empty, `mail.listThreads` calls the
provider's search API (`agent.rawListThreads` → Gmail `users.threads.list`
with `q`, folder folded in by `normalizeSearch` in `google.ts` ~1017:
`in:trash`, `in:archive AND (…)`, `label:Snoozed AND (…)`); if `q` is empty
it reads the local DO SQLite (`getThreadsFromDB`). The DO has a `LIKE` search
over `latest_subject` / `latest_sender` only (`routes/agent/db/index.ts` ~370)
used for the AI agent's tools, not for the inbox. So: **server-side (provider)
search, client-side highlighting**. Results are highlighted but not ranked.
Fields searched are whatever Gmail/Graph index — full bodies, headers,
attachment names.

---

## 7. AI features, what they cost, and what depends on them

| Feature | Where | Model / provider | When it runs |
|---|---|---|---|
| Per-message summary + embedding | `apps/server/src/thread-workflow-utils/workflow-functions.ts` ~230–260 | Workers AI `@cf/meta/llama-4-scout-17b-16e-instruct` + `@cf/baai/bge-large-en-v1.5` (`pipelines.effect.ts`) | On every synced message (workflow), stored in Vectorize `VECTORIZE_MESSAGE` |
| Thread summary / re-summary | same file ~660–700 | llama-4-scout | On every thread sync; stored as Vectorize metadata |
| Auto-label suggestion | same file ~490–510 | llama-4-scout | After summary, when "brain" is enabled |
| Summary shown in thread header | `apps/server/src/trpc/routes/brain.ts` `generateSummary` → `mail-display.tsx` `AiSummary` | `@cf/facebook/bart-large-cnn` shortening the stored summary | **Every time a thread is opened** (TanStack query, no staleTime) |
| Compose "Generate" | `trpc/routes/ai/compose.ts` ~89 | OpenAI `gpt-4o-mini` | On click |
| Generate subject | `compose.ts` ~270 | OpenAI `gpt-4o` | On click, and automatically before Generate if subject empty |
| Natural-language search | `trpc/routes/ai/search.ts` | OpenAI `gpt-4o` (`generateObject`) | On any free-text palette search |
| Writing-style matrix | `services/writing-style-service.ts` ~342 | Google `gemini-2.0-flash` | After every send |
| Sender research / web search | `trpc/routes/ai/webSearch.ts`, `routes/agent/tools.ts` ~464 | Perplexity `sonar` | On click in message header ("More about person") |
| Chat sidebar / agent | `routes/chat.ts`, `routes/agent/index.ts` ~1129, ~1775 | `gpt-4o`, Groq `openai/gpt-oss-120b`, Anthropic `claude-3-7-sonnet` | Per chat turn; Pro-gated via Autumn billing (`hooks/use-billing.ts`) |
| Interests analysis | `lib/analyze/interests.ts` | `gpt-4o-mini` | Background |
| Voice | ElevenLabs (`components/voice-button.tsx`, `elevenlabs-tools.ts`) | ElevenLabs agent | On click |

Cost shape: Workers AI is billed per neuron and runs on **every message
ingested**, so cost scales with mailbox volume, not with use. OpenAI calls are
per-token on user action. The only inbox behaviour that *depends* on AI is the
"Summary" disclosure and auto-labels; search, list, thread view and compose
all work without it (the summary component returns `null` when nothing is
stored). The ghost-text autocomplete and the templates are not AI.

---

## 8. What fits a 1–20-person sales floor emailing leads

Concrete, in order of value:

1. **Sticky reply composer at the bottom of the thread pane** with `r`
   opening it on the latest message and `Mod+Enter` sending. A rep answers
   dozens of contractors a day; reply is the one action that must be zero
   friction.
2. **Optimistic action + 5-second deferred mutation with Undo** (archive,
   mark unread, snooze). It makes bulk triage feel instant and makes mistakes
   free. FieldQuo already has `readAt`/`archivedAt` columns on `SalesThread`;
   the overlay-then-commit pattern is UI only.
3. **`j`/`k` open-as-you-move, `e` archive, `u` unread, `s` star, `Escape`
   close** with exclusive `list`/`thread` scopes switched by whether a thread
   is open, and `g i` / `g a` chords for folders. A floor works from the
   keyboard once shown; the scope model prevents `r` meaning two things.
4. **Row anatomy**: avatar/initial, bold name + unread dot, `[n]` reply
   count, pencil when a draft exists, relative time; subject line; 2-line
   snippet; hover pill with archive / unread / snooze. Three lines is right
   for a list that is 35 % of the width.
5. **Sent-folder inversion** (subject first, `To:` second) — the floor's
   outbound view.
6. **Only the last message expanded, earlier ones collapsed to headers**, and
   **quoted text folded structurally** (`blockquote`, `.gmail_quote`) into
   a "Show quoted text" disclosure. Contractors reply from Gmail and iPhone
   Mail; every reply drags the whole thread with it.
7. **Attachment strip at the thread head** aggregating every message's files
   — a lead's licence, COI or photos arrive mid-thread.
8. **Snooze with a real wake time** (date + time, timezone shown) surfaced
   as "follow up on" — the thread leaves the list and comes back. FieldQuo
   must do the wake with a cron/queue that actually runs (see the Zero bug in
   §2).
9. **Draft autosave on a 3-s timer keyed to the thread**, pencil badge in the
   row, composer re-opens with the draft. `SalesEmailDraft` exists already.
10. **Templates as a searchable dropdown in the composer footer** with
    "save current as template" — a floor runs on a handful of playbook
    emails; Zero's per-user model should become per-rep + shared playbook
    templates.
11. **Recipient chips** with Enter/Tab/Backspace/paste behaviour — but for
    FieldQuo the To is the lead's address and rarely edited; chips matter
    mostly for Cc'ing a colleague.
12. **Ghost-text openers/closers accepted with Tab** — free, no model, and a
    good place to put the playbook's own phrases.
13. **Select-all two-step** (page, then "all *n* matching") for bulk
    archive/assign.
14. **Search filter chips** (`from:`, `has:attachment`, `is:unread`, date
    range) persisted per user, and the "clear filters" empty state.
15. **Realtime invalidation on inbound** — FieldQuo's `useThreadRefresh.js`
    already polls; a push on `SalesMessage` insert is the equivalent.
16. **Read-state dimming (60 % opacity) rather than a second colour** — cheap
    and survives any brand palette.

---

## 9. What NOT to take

- **Gmail / Microsoft OAuth and the driver architecture** —
  `apps/server/src/lib/driver/{google,microsoft}.ts`, `MailManager` interface
  in `driver/types.ts`, `auth-providers.ts`, history/sync workflows
  (`workflows/`, `routes/agent/sync-worker.ts`). FieldQuo's mail is its own
  Resend-sent outbound plus an inbound webhook into `SalesMessage`; there is
  no third-party mailbox to mirror, no labels to proxy, no `historyId`.
- **The self-host stack**: Cloudflare Workers, Durable Objects with embedded
  SQLite sharded per connection (`ShardRegistry`, `ZeroDB`, `ZeroDriver`),
  R2 `THREADS_BUCKET` for bodies, ten KV namespaces, Queues, Workflows,
  Vectorize, Workers AI, Hyperdrive, PartyServer websockets
  (`apps/server/wrangler.jsonc`), Docker Compose for Postgres/Valkey
  (`docker-compose.*.yaml`, `docker/`). FieldQuo is Next.js on Vercel with
  Neon Postgres; none of this maps.
- **Ids-only list + one `mail.get` per row.** FieldQuo's `/api/sales/threads`
  should return row data (name, subject, snippet, time, unread, draft flag,
  attachment flag) in one query.
- **Every per-message / per-thread model call**: summaries and embeddings on
  ingest, BART shortening on every thread open, auto-labelling, writing-style
  matrix after every send, LLM search-query generation, sender research via
  Perplexity, the chat agent. All cost money per lead touched and none earn
  it on a floor whose emails are short and templated. The "AI summary"
  disclosure in particular runs a model call on every open with no cache.
- **Compose "Generate" / "Generate subject".** Replies to contractors are
  playbook text; a model rewriting them is a liability, not a feature.
- **Shadow-DOM HTML rendering with a CSS sanitiser and image-blocking bar.**
  FieldQuo stores inbound bodies as text (`parseInboundEmail` strips markup)
  and renders `whitespace-pre-wrap`; keep that (§10) and only borrow the
  *idea* of folding quoted text, applied to text ("On … wrote:" / `>` lines).
- **Anything assuming a personal mailbox**: BIMI brand avatars, categories
  (Promotions/Updates), spam/bin folders and "delete all spam", unsubscribe,
  trusted-sender image settings, email aliases and `From:` selection,
  Zero's per-user private notes (FieldQuo notes belong to the lead, shared
  across the floor), `autoRead` as a personal preference (on a shared floor
  "read" needs to say *who* read it), undo-send via a 15-s queue delay (a
  send gate that refuses beforehand is the honest version), and the
  "Sent via Zero" signature toggle (white-label rule).
- **Per-user hotkey persistence** (`shortcut.update` with no caller, view-only
  settings page) — a dead control; either ship rebinding or don't render it.
- **Print-to-iframe** (`thread-display.tsx` `printThread`) and the
  motion slide between threads — polish with no floor value.

---

## 10. What FieldQuo keeps from its own design

- **The company pane on the right**, exactly as `/sales/messages` has it
  (`app/sales/messages/page.js` `ContextBar` with tabs Details / Channels /
  History; `ContactDetails` with the lead's business, contact, the
  `CallHistoryStrip`, the "Open lead" link to `/sales/leads/<id>`, the
  customer-status line, and the `EscalatePanel`; `ContactHistory` listing
  calls, email threads and check-ins). Zero has nothing like it — its
  "Details" is a header popover about the message. On the floor the thread is
  a side effect of the lead, so the pane stays, and the list/thread panes
  take Zero's craft only.
- **Server-side refusals stay server-side.** `requireOutreachRep` gates the
  rep, `contactOptedOut` refuses on suppression before any send (409 with
  `optedOut: true`), and `deliverOutreach` returns named `blockers` from
  `outreachReadiness.js` (`app/api/sales/threads/[id]/messages/route.js`,
  `lib/sales/outreachSender.js`). The composer must show those blockers as
  the reason a send did not happen — never disable the button on a
  client-side guess, and never queue a send it cannot make (Zero's
  queue-then-cancel undo-send is the opposite model).
- **Plain-text bodies rendered as text.** Inbound HTML is stripped on the way
  in and shown `whitespace-pre-wrap` (`app/sales/threads/[id]/page.js` lines
  8–9). No HTML rendering, no Shadow DOM, no sanitiser surface, no image
  blocking. Quote folding is done on text.
- **One thread per lead per subject with a reply token** (`SalesThread.replyToken`) —
  threading is FieldQuo's own, not `In-Reply-To` heuristics.
- **`readAt`, `archivedAt`, `lastInboundAt` on `SalesThread`** as the
  unread/archive model — a shared floor needs *who* and *when*, not a Gmail
  `UNREAD` label.
- **Drafts in `SalesEmailDraft`, notes in `SalesRepNote`** — already keyed to
  the thread and rep.
- **i18n through `useTranslation` / `appMessages.js`** (EN/FR/ES), the
  `fetchJson` error path, and the FieldQuo shell (`SalesShell.js`).

---

## 11. Ten takeaways for `/sales/threads`

1. Return row data from `/api/sales/threads` in one query (name, subject, snippet, time, unread, draft, attachment flags); never one request per row.
2. Virtualise the list (`virtua`-style measured rows, ~5 overscan, load-more when within ~7 rows of the end) with three-line rows: name + unread dot + `[n]` + pencil, subject, 2-line snippet; dim read rows to 60 %.
3. `j`/`k`/arrows move focus *and* open the thread; `Enter` opens, `Escape` closes; exclusive `list` / `thread` hotkey scopes switched by whether a thread is open, plus `g i` / `g a` / `g s` chords and `c` for new.
4. Every triage action (archive, unread, snooze, star) is optimistic with a 5-second "Undo" toast and the server call deferred until the toast closes; `mod+z` undoes the last one.
5. Reply composer is sticky at the bottom of the thread pane, opened by `r`, sent by `Mod+Enter`, closed by `Escape`; recipients are chips (Enter/Tab/Backspace/paste), Cc hidden behind a toggle.
6. Only the latest message expanded; earlier ones collapse to a header row; quoted text in a message folds into a "Show quoted text" disclosure — detected structurally on the stored text (`On … wrote:` / leading `>`), never with a model.
7. Autosave the draft 3 s after the last keystroke, keyed to the thread, only when there is body text; show a pencil in the row and reopen the composer with it; send reuses the draft.
8. Snooze = a real wake time (date + time, timezone shown) that removes the row and a server job that actually brings it back — verify the wake path runs, because Zero's cron dispatch is commented out and the feature quietly depends on someone opening the Snoozed folder.
9. Templates live in the composer footer as a searchable dropdown with "save current as template"; ghost-text openers/closers from the playbook accepted with Tab; no model calls anywhere in the inbox.
10. Search is server-side with filter chips (`from:`, `has:attachment`, `is:unread`, date range) persisted per rep and hits highlighted client-side; the empty state offers "clear filters"; the company pane, the send gate, the suppression refusal and plain-text rendering stay exactly as FieldQuo has them.
