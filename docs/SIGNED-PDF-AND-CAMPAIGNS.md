# Signed quote PDF + marketing campaign double-send — what changed and why

Two independent fixes. Read `AGENTS.md` first, particularly non-negotiable #6
(a document keeps the language it was created in) and the `lib/documentSections/`
note, before touching either of these files again.

---

## 1. The signed PDF had no signature

### What already existed (this was a wiring bug, not a missing feature)

Everything needed to show a signature on a PDF was already built and already
wired in:

- `Quote.signature` (Json column: `name`, `signatureDataUrl`, `signedAt`, `ip`,
  `userAgent`, `documentHash`, `consent`) — written in
  `app/api/public/quotes/[token]/route.js` via `buildSignatureRecord`
  (`lib/documents/signatureAudit.js`) when a client approves.
- `lib/documentSections/SignatureSection.js` — already drew the exact things
  the owner asked for: the drawn mark (`<Image src={sig.signatureDataUrl}>`),
  the typed name, the signed-at date, and a small audit line with the IP and
  the first 16 hex characters of the document hash. `data.signature ?
  renderSigned : renderBlank` — an unsigned quote already got the three ruled
  fields for a printed signature; this logic was correct and untouched.
- The section was already registered (`lib/documentSections/registry.js`) and
  already included in the default `quote_pdf` sections
  (`app/admin/lib/pdf/defaultSections.js`, `sortOrder: 7`), and already
  excluded from invoices (`isInvoice(data)` guard) and from HTML email
  (`renderEmailHtml()` returns `""`).
- **Both parties already received the signed PDF as an attachment.** On
  acceptance, `dispatchDecisionEmails()` in the same route already sent the
  rendered PDF to the client AND to every active owner/admin member of the
  company — the "does the company get a copy too" question in the brief was
  already answered yes, before this session started.

### The actual bug

`renderApprovedQuotePdf()` built the PDF's `data` from `{ ...quote, ... }`,
where `quote` was the row `loadQuote(token)` fetched **before** this same
request wrote the signature to the database (`db.quote.update(...)` with
`signature: signatureRecord`). So `quote.signature` was always the
pre-signing value — `undefined` — at the exact moment the PDF was rendered.
`SignatureSection`'s branch correctly took the "unsigned" path, on the one PDF
this endpoint exists to send signed. The evidence (the audit trail, the
document hash) was real and stored; it just never reached the renderer.

**Fix:** thread the just-built `signatureRecord` through explicitly —
`dispatchDecisionEmails(updated, quote, decision, priced, signatureRecord)` →
`renderApprovedQuotePdf(quote, companyId, priced, language, signatureRecord)`
→ `data: { ...quote, ..., signature: signatureRecord || quote.signature || null }`.
The `|| quote.signature` fallback keeps a *later* re-render of an
already-accepted quote (e.g. from `app/api/quotes/[id]/send`) working the same
way, since by then `quote.signature` really is populated on the row.

### Also fixed: hardcoded English on a document with a fixed language

`SignatureSection.js`'s copy ("Approval", "Signing below accepts…",
"Signature" / "Name" / "Date", "Date signed", "Electronically signed…") was
plain English JSX text, never translated — a French quote's *signed copy*
would have shown this block in English forever, which is exactly what
non-negotiable #6 exists to prevent. Ten new keys were added to
`lib/i18n/documentLabels.js` (`signatureApproval`, `signatureAcceptWithTotal`,
`signatureAcceptNoTotal`, `signaturePaymentTermsNote`, `signatureFieldLabel`,
`signatureNameFieldLabel`, `signatureDateFieldLabel`,
`signatureDateSignedLabel`, `signatureElectronicallySigned`,
`signatureFromIp`, `signatureDocumentRef`) in all six shipped languages (en,
fr, es, uk, pa, tl), and `SignatureSection.js` now reads them via
`documentLabels(language)` instead of literals. Money in the "Signing below
accepts this quote at {total}…" line still goes through
`documentFormatters(language, company.currency)`, unchanged — the currency
was never the bug, only the surrounding sentence.

### Contrast

No new colour pairing was introduced — the section already used
`t.accentText`, `t.inkMuted`, `t.inkFaint` from `lib/documents/theme.js`,
which are `ensureContrast(...)`-baked against the page background at
construction time (4.5:1 for `inkMuted`/`accentText`, 3:1 for the small
`inkFaint` fine print, consistent with how the rest of the document treats
footnote-sized text). `npm run check:contrast` still passes; it doesn't cover
this file specifically (it exercises `lib/kitchen/designerTheme.js`, a
different theme module), but nothing in this change touches colour math.

### Verified

- `npm run check:document-money` — extended with a new section (source-level,
  regex-over-source, matching that script's existing style) asserting: no
  hardcoded English JSX text remains, all 10 new label keys exist in all 6
  languages, `dispatchDecisionEmails`/`renderApprovedQuotePdf` both accept and
  are called with `signatureRecord`, the PDF payload carries
  `signature: signatureRecord || quote.signature || null`, and both the
  internal (company) and client emails on acceptance attach the signed PDF.
- **Genuine execution, not just source reading:** a one-off throwaway script
  at the repo root (deleted after use, per AGENTS.md's own guidance for
  throwaway checks) rendered the real `SignatureSection.js` — copied to a
  `.jsx` extension only because `tsx`'s esbuild loader refuses to enable JSX
  for a bare `.js` file, even with `jsx: "react-jsx"` set in a `tsconfig.json`
  (confirmed by testing; this is a `tsx` CLI limitation, not anything about
  the shipped file) — via `@react-pdf/renderer`'s real `renderToBuffer`, and
  read the resulting PDF bytes back (decoding content streams, inflating them,
  and pulling text runs, the same technique `scripts/check-kitchen-pdf.jsx`
  already uses). Confirmed: the embedded image XObject is present only when
  signed; the typed name, signed-at date, IP, and document-hash prefix are all
  printed; the invoice guard renders nothing even with a signature present;
  and a French render shows the translated heading/audit line, never the
  English strings.
- Mutation-tested (see below) — every assertion above was confirmed to
  actually fail when the fix it guards was reverted.

---

## 2. Marketing campaigns could double-send

### The actual bug (confirmed, not assumed)

`app/api/marketing/campaigns/[id]/send/route.js`'s subscriber loop did an
unguarded `await ensureSubscriberToken(db, sub)` before each `sendEmail(...)`,
with no `try/catch`, and `campaign.sentAt` was written only **after** the
loop finished. Nothing recorded which individual subscriber had actually been
mailed. So: a Neon cold-start `P1001` (a named, live risk — see AGENTS.md)
thrown mid-loop aborted the whole request, `sentAt` never got written, the
existing "already sent" guard (`if (campaign.sentAt) return 400`) never
fired on retry, and the contractor's only available next move — click Send
again — re-emailed everyone the first attempt had already reached. There was
no model recording delivery per recipient, so there was nothing to recover
from either, confirmed by reading `prisma/schema.prisma` before writing
anything.

### Design: per-recipient delivery, claim-before-send

**New model**, `MarketingCampaignDelivery` (`prisma/schema.prisma`): one row
per `(campaignId, subscriberId)` that a send actually reached, with
`@@unique([campaignId, subscriberId])`. This is the actual enforcement
mechanism, not a convenience index — see below.

**The send loop, now `sendCampaignEmails()`** (split out of `POST` so it's
callable directly, without a session — see "verified" below):

1. Load currently-subscribed `subscribers`, and every existing
   `MarketingCampaignDelivery` row for this campaign. `pending = subscribers
   not already delivered` — an upfront optimisation (skip subscribers we
   already know are done) but **not** the actual safety mechanism.
2. For each pending subscriber: **claim before sending** —
   `db.marketingCampaignDelivery.create({ campaignId, subscriberId })`. This
   is the real guard: if a previous attempt (or, just as importantly, a
   *concurrent* one — a double-click races the exact same way a retry does)
   already has this subscriber, the unique constraint rejects the `create`,
   and this attempt skips them **without ever calling `sendEmail`**. Any
   *other* create failure (the DB itself is unreachable) is treated the same
   way — skip, don't send — because Postgres doesn't partially commit a
   single `INSERT`: either way, no row was written by this call, so it's
   equally safe to leave the subscriber pending for a later attempt.
3. Only after a successful claim does it call `ensureSubscriberToken`,
   render the email, and `sendEmail`. If *that* fails (a bounce, a template
   error, `result.error`), the claim is **deleted** — a delivery row is a
   promise that the email actually left, never merely that an attempt was
   made, so a later resend must be able to try that subscriber again.
4. After the loop, `deliveredCount = MarketingCampaignDelivery.count({
   campaignId })`. `complete = deliveredCount >= subscribers.length`
   (subscribers as counted *at the start of this request* — a subscriber
   added mid-send by a concurrent request isn't held against this pass).

**Why claim-then-send, not send-then-record:** the failure mode named in the
brief is the request dying *between* two subscribers, not mid-send of one
email. Claiming first means the worst case of a truly mid-flight death (the
claim commits, the process dies before `sendEmail` returns) is treated as
"already sent, don't retry" — a vanishingly rare potential *gap*, which the
brief explicitly said was the acceptable failure direction ("a duplicate is
worse than a gap" under CASL). The far more common case — a claim fails
outright, an email fails outright, a whole request aborts — is always
provably safe to retry, because nothing was promised that didn't happen.

### What `sentAt` means now

`sentAt` is set **only** when every subscriber counted at the start of the
request has a delivery row — i.e. the send is actually, fully done.
Anything short of that sets `status: "partial"` instead (new
`MarketingCampaignStatus` enum value) and leaves `sentAt` null, so the
existing "already sent" guard does not block a resend — resending a partial
campaign is not just allowed, it's the intended recovery path. The response
also carries `partial: true/false` and the running `recipientCount`.
`EmailCampaignDetail.js` now shows a distinct "Partially sent — N of M
subscribed recipients have this campaign… Resume send" state (amber, same
visual language as the confirm-send banner) instead of either the green
"Sent" banner or a fresh "Send Campaign" button that would suggest nothing
had happened yet. The campaign list (`app/app/marketing/page.js`) gets a
matching amber `partial` badge.

### What was NOT built (scope discipline)

- No snapshot/freeze of the subscriber list between attempts — a subscriber
  who joins mid-campaign gets included in a later resume pass, which reads as
  correct (they consented, they're on this campaign's audience) rather than a
  bug.
- No retry limit or dead-letter handling for a permanently-bad address (one
  that will bounce every time) — it will keep the campaign in `partial`
  forever unless removed from the list. Not asked for; flagging here rather
  than inventing a design for it.
- No migration that touches existing rows — `MarketingCampaignDelivery` is a
  new, empty table; `MarketingCampaignStatus.partial` is a new enum value
  that doesn't require rewriting any existing `MarketingCampaign` row.

### Verified — genuinely executed, not read

`app/api/marketing/campaigns/[id]/send/route.js` imports `next/server`
(bare Node can't resolve it), `@/lib/db` (a real Prisma client needs Neon),
and `@/lib/email/resend` (a real client needs `RESEND_API_KEY`/network). All
three are stubbed **from inside `scripts/check-consent-mechanisms.mjs`
itself** — the same `node:module` `register()` technique several existing
check scripts already use (e.g. `scripts/check-designer-reach.mjs`) — rather
than by adding another `--import` flag to the npm script, so nothing in
`package.json` needed to change for this half of the fix. `@/lib/db` and
`@/lib/email/resend` are redirected to two real, shared fixture files —
`scripts/fixtures/dbStub.mjs` (extended: `marketingCampaign`,
`marketingSubscriber`, `marketingCampaignDelivery` rows and models, a
unique-constraint-enforcing `create` for the delivery model, generic
`delete`/`count`, and a `failNext` hook to force one `create` to throw once —
the scriptable stand-in for "the connection died right here") and
`scripts/fixtures/emailStub.mjs` (new: records every `sendEmail` call into
`sent`, and can be told to fail for specific addresses via `failFor`, to
simulate a bounce as distinct from a DB outage).

Four scenarios executed against the real `sendCampaignEmails`:

1. **Resume from a pre-existing partial state** — 5 subscribers, 2 already
   have delivery rows (exactly what a mid-loop death would leave behind).
   Confirmed: exactly 3 new claims, `sendEmail` invoked exactly 3 times (not
   5), never for the 2 already-delivered addresses, `sentAt` gets set, and
   `recipientCount` is the full 5.
2. **A claim itself fails mid-loop** (`failNext`) — confirmed the request
   still completes (no crash), reports `partial`, the failed subscriber has
   no delivery row, and a subsequent retry sends to exactly that one
   subscriber and no one else — checked both via the delivery ledger AND by
   counting actual `sendEmail` calls per address (each of the 3 addresses
   mailed exactly once, combined across both passes — the property a
   ledger-only check can't prove, since a ledger can be self-consistent even
   if a send was ever allowed to happen twice).
3. **A send itself fails** (a stubbed bounce, `failFor`) — confirmed the
   claim is released (not left behind), the bounced recipient isn't counted,
   and a later retry (once the address stops "bouncing") reaches exactly that
   one recipient.
4. **The route-level `sentAt` guard** — confirmed by source assertion that it
   still exists and runs before `sendCampaignEmails` is ever called (a fully
   sent campaign is still refused, unchanged one-shot behaviour).

All new assertions were **mutation-tested by hand** (see below) against the
real route file, not merely written and trusted.

### Mutations run, and what each caught

Every mutation was applied to the real file, `check:document-money` or
`check:consent-mechanisms` re-run, the failure inspected, and the file
restored via `cp` from a `/tmp` backup (never `git checkout`, per this
session's working agreement — a restore of that kind reverts the commit, not
just the mutation).

**Signature / PDF (`check:document-money`):**
| Mutation | Caught by |
|---|---|
| `dispatchDecisionEmails(updated, quote, decision, priced)` — drop the signature param | 2 assertions (param present, call site passes it) |
| `renderApprovedQuotePdf(...)` — drop the param, drop `signature:` from the data payload | 2 assertions |
| `{labels.signatureApproval}` → hardcoded `Approval` | 1 assertion (initially missed — see note below) |
| `fr.signatureApproval` deleted from `documentLabels.js` | 1 assertion (`translated in all 6 languages`, got 5) |
| Both emails' `attachments` → only one email keeps it | 1 assertion (`exactly two emails… both attach`) |

*Note on the hardcoded-string check:* the first version of that assertion
(`sig.includes(">Approval<")`) passed even against the mutated file, because
this codebase's JSX formats a text node on its own line between the opening
and closing tag (`>\n  Approval\n</Text>`), not inline — the literal substring
never occurs. Rewritten as a whitespace/newline-tolerant regex
(`>\s*Approval\s*<`) and re-verified to actually fail on the mutation before
being kept. Left as a discovered-and-fixed note rather than a silent redo,
per this session's instruction to name mistakes plainly.

**Marketing campaign (`check:consent-mechanisms`):**
| Mutation | Caught by |
|---|---|
| `for (const sub of pending)` → `for (const sub of subscribers)` (attempt everyone, rely only on the unique constraint) | **Nothing failed.** This is a genuine finding, not a gap: the DB-level `@@unique` is the real safety net, and it held — the duplicate `create()` still threw and was skipped before any second `sendEmail`. Kept as evidence the design has defence in depth, not removed as a "failed" mutation. |
| On a claim failure, `continue` → nothing (send anyway even without a claim) | 2 assertions (`sendEmail` count, per-address count) — but **only** after adding the `emailStub.mjs` call-counting assertions. The earlier, ledger-only assertions did not catch this (see below). |
| On a send failure, remove the `.delete({ where: { id: claim.id } })` claim release | 4 assertions (bounce scenario: partial/count/claim-left-behind/retry-resends) |
| `const complete = deliveredCount >= subscribers.length` → `const complete = true` | 3 assertions (partial-not-sent, status, one from the bounce scenario) |
| Delete the `if (campaign.sentAt)` guard in `POST` | 1 assertion (guard-still-refuses) |

*Note on the ledger-only gap:* the first version of the mid-loop-failure test
only asserted on `MarketingCampaignDelivery` row counts and the response
shape, both of which stayed correct even when a claim-failure was mutated to
send anyway — because the mutated code still ended up with a mathematically
consistent ledger (the failed claim just never got a row, same as the
correct behaviour), while actually having emailed that recipient an extra,
unrecorded time. This is exactly the class of bug the brief warned about
("must not send twice… a duplicate is worse than a gap") and exactly why
`emailStub.mjs` was added — counting real `sendEmail` invocations per address
is the only way to prove the property that actually matters, rather than
proving the bookkeeping is internally consistent. Left in as a documented
near-miss.

### Not verified / needs a human

- **`npx prisma db push` against the real Neon database was not run.** This
  worktree has no `DATABASE_URL` (checked: not in the environment, no `.env`
  file present). `npx prisma validate` and `npx prisma generate` were run
  with a placeholder `DATABASE_URL` and both succeeded — the schema is valid
  and the client was regenerated — but the actual `MarketingCampaignDelivery`
  table does not exist in production until someone with real credentials runs
  `db push`.
- **No browser was used.** `EmailCampaignDetail.js`'s new "partial" banner and
  the campaign list's new amber badge were written and read carefully, but
  never rendered or clicked. Nothing about the PDF was viewed as a PDF either
  — the verification above reads the byte stream (text runs, an embedded
  image XObject), which proves the content is present and correctly ordered,
  not that it looks right on a page.
- `npm run check:contrast` and `npm run check:pdf` were run (both pass) but,
  as noted above, neither one actually exercises `SignatureSection.js` or the
  campaign send path — they're listed as candidates in the task brief, and
  running them was part of confirming nothing broke, not evidence *for*
  either fix specifically.
