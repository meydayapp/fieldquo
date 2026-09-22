# Working without signal: the offline layer, and the same layer in the mobile app

What the phone does in a basement, where each piece lives, and the two
decisions the mockups flagged as the owner's.

## The pieces

| Piece | File | Job |
|---|---|---|
| App-shell cache | `public/sw.js` | Network-first cache of the field screens (`/app/invoices/new`, `/app/jobs/*`, `/app/clock`, `/app/settings/team/timesheets`, `/app/daily-sheets`) and the GET reads they make (`/api/clients`, `/api/settings/business-info`, `/api/time-clock`, `/api/invoices/labour-line`, `/api/jobs/*`, `/api/daily-sheets*`, `/api/settings/custom-fields`). Same-origin GET only, never a non-200, off means off. |
| The switch | `Company.offlineCachingEnabled` (default **on**) — Settings → Team & scheduling → Field work | `app/components/offline/OfflineShell.js` posts `{ type: "fq:offline-config", enabled }` to the worker on every /app load; `false` empties the cache. |
| The queue | `lib/offline/store.js` (IndexedDB, `fieldquo-offline` / `queue`), `lib/offline/queue.js` | Items: `invoice`, `photo`, `timesheet`, each with a client-minted key. Replay order: punches (tap order) → photos → invoices. A thrown fetch stops the pass; a 4xx marks the item "Needs attention" with the server's sentence; a 5xx/429 retries up to five times. |
| The ledger | `lib/offline/idempotency.js`, `OfflineSyncItem` | `X-Offline-Key` header. The write and the key are one transaction; a second replay of the same key answers with the first write's id. **Server wins**: the phone never invents an id. |
| The bar | `OfflineShell.js` | "Offline — N invoices and M timesheets waiting to sync" · Details (per item: queued / Synced ✓ / Needs attention, Retry, Remove from phone) · "Synced ✓" toast with a link to the invoice. |
| Replayed routes | `POST /api/invoices` (`offline: true`, `labour`, `jobId`), `POST /api/time-clock` (`at`, honoured only with a key — `lib/offline/punchMoment.js`), `POST /api/upload` | |

## The clocked-hours line

`GET /api/invoices/labour-line?jobId=` lists the job's billable `TimeEntry`
rows (closed, unbilled, positive hours, not rejected) and the company's
hourly rate options: `Company.labourSellRate` and every enabled service
priced by the hour (`lib/invoices/labourRates.js`). The editor posts
`labour: { timeEntryIds, rateKey }` — ids and a key, never an amount — and
the route prices it (`lib/invoices/labourLine.js`), appends the line,
re-derives subtotal/tax/total from the lines, and stamps
`TimeEntry.billedInvoiceId` in the same transaction so an hour is offered
once. No rate set → the offer links to Settings → Field work instead of
pricing anything.

## Inside the Capacitor shell (branch `mobile`, ../fieldquo-mobile)

The mobile app wraps this web app in a WebView. The service worker, the
IndexedDB queue and the bar are all web-platform features that run inside
that WebView unchanged — nothing here is native, and nothing on branch
`mobile` needs to change for it. Two things to know when that branch is
next touched:

- **Service workers in a WebView** need the app to be served over
  `https` (Capacitor's default scheme on iOS is `capacitor://`, on Android
  `https://localhost`). If the shell ever serves from a custom scheme that
  is not secure-context, the worker will not register and only the queue
  (which needs no worker) keeps working — the bar says so ("sends when
  you're back online" still holds, through the page's own `online` event).
- **Background Sync** is Chrome/Android only. On iOS the queue replays when
  the app is opened with signal, which is what the bar promises.

## What the owner still decides

- The **performance-pay rule**: none by default. The rule editor is under
  Settings → Field work; until a rule is written, no sheet and no pay run
  shows a bonus figure (`lib/dailySheets/bonus.js`).
- **AI outbound for past clients**: the voice agent places outbound calls
  today, but only with live consent, and a finished job's consent lasts
  three months (`lib/voice/outbound.js` CONSENT_SOURCES). Every client the
  callback rotation lists is past that window, so the assignee picker
  offers people only and says why. Widening the consent rule is the owner's
  call, and a cost decision (a Retell call minute is metered against the
  company's phone credit).
