# Sales — what is done, what is not, and what is waiting on a decision

Written because things were being dropped. The alternate-number engine
(`lib/sales/contact/numbers.js`) sat finished and unwired for six hours because
it lived only in a sentence in a chat window. Anything not finished in one
sitting goes here, or it evaporates.

Last updated 2026-09-10.

---

## Live and verified

Everything below is on `main`, deployed, and has a check in `check:all`.

| | |
|---|---|
| Inbound calls | A callback rings the rep whose number it is, then whoever rang them last, then whoever is free (longest idle first), then a transfer number, then voicemail. Answerable in the browser. |
| Transfer | Warm and cold. If the target does not answer the caller comes back to the rep — never dropped. |
| Hold queue | Speaks between rings, never silent, bounded, ends at voicemail. |
| Voicemail | `/sales/voicemail`. Streamed through FieldQuo, never the provider's URL. A zero-second message means they rang, heard the beep and hung up — worth a callback. |
| Opt-outs | A texted STOP blocks calls, texts and email. The dial control and the handset link both disappear. Fails closed if the list cannot be read. |
| Texts | `/sales/messages`, grouped like a messenger. Two-way. Check-in drafts appear in the thread, unsent. |
| Check-ins | Day 1 (setup) and day 7 (how is it going). Drafted, never auto-sent. Lapse after 14 days; 3-day floor between any two texts. |
| Support | `/sales/support`, and from a linked lead. Assigned to the first active superadmin. |
| Pay | Upwork, PayPal, Interac, Wise, bank transfer. Language picker. First run at `/sales/welcome`. |
| Demo | A rep claims one of ten demo companies; login minted by a superadmin. |
| Prospect → lead | "Work this one as a lead" carries the name, number and location across and links the records. |
| Tour | 18 steps, in the rep's language. |
| Plan gate | A company that never finished checkout cannot send a quote or an invoice. |

---

## In flight

- **Free dial and editing from the queue.** Record a number a contractor gives
  you on the call ("ring him on his cell"), choose which number to dial, and
  correct the record. Uses `lib/sales/contact/numbers.js`, which already knows
  that a landline can be called and not texted — texting one is a SILENT
  success, accepted by the carrier and delivered to nobody.

---

## Waiting on the owner

1. **Instant quotes.** He is right that an instant quote is a reflection of
   services and pricing, so a separate on/off toggle is the bug. The open
   question is only whether adding a rate card should publish a price to
   homeowners immediately, or after one look. Publishing is not reversible in
   the eyes of whoever saw it.
2. **A real tech-support destination.** Every ticket assigns to the one
   superadmin. There is no team, tier or routing. "Level 2" is a new concept,
   not a setting.
3. **Retention on `ProspectEvidence`.** Storage per prospect is now ~106 rows
   (was 405), but the 418 MB already written stays until somebody decides.
   Proposed: keep `page_fetch`, `contact` and `source_field` forever — they are
   the compliance and provenance trail — and keep only the latest crawl for
   `link`, `dom_attr`, `meta`, `script_src`, `page_content`, which is all
   `loadCrawl` reads anyway. Archive rather than delete if it might be wanted
   for signature back-testing.

---

## Known and not fixed

- **`check:interconnections` is red.** `docs/INTERCONNECTIONS.md` is three
  models behind the schema. Pre-existing, does not block deploys.
- **The rep portal is only partly translated.** The shell, sign-in, invite and
  companies book go through `t()`; the prospecting screens are English
  literals. Choosing French moves the frame, not most pages. The picker says so.
- **`html.js` caps extraction at 200 links per page**, so on a link-heavy page
  the footer's off-host links — social profiles, Google reviews — never reach
  the writer. Fixing it changes `contentHash` and re-writes every prospect's
  evidence once.
- **Two faults found in the SOP audit, not yet fixed:** a queue comment that
  contradicts `queueWhere`, and two different do-not-contact controls (the
  queue button writes one prospect row; the `do_not_call` disposition writes
  the row AND the platform list).
- **`docs/sales/decks/train.js` is stale** on two slides — day-3 check-in (it
  is 1 and 7) and a "gap" where the queue ignores the suppression list (it
  reads it now).

---

## Things that were wrong and are worth remembering

Not a confession list — each one is a trap that will be walked into again.

- **A gate in the screen is not a gate.** The dialler refused a suppressed
  number in the route while the queue still drew a handset `tel:` link, which
  reaches no server. Twice in one day: the same shape caught the plan gate,
  which had never once fired.
- **A check that matches its own header comment proves nothing.** Four checks
  were fooled this way. Strip comments before asserting on source, and judge a
  mutation by EXIT CODE — one mutation crashed the runner and printed no
  failures at all, which reads exactly like a pass.
- **An index-ordering slice passes against nothing.** `indexOf("data: {")` to
  `indexOf("select: {")` where `select` comes first is an empty string, and
  every assertion over it passes. Three times.
- **A name in JavaScript is not a column.** `ourE164` broke voicemail for
  exactly the reps who had a number, and passed for everyone else.
- **Two call sites of one function can disagree for months.** `deliverReplySms`
  checked `result.ok`; `sendSms` returns `success`. Every reply was delivered
  and reported as failed, so reps texted contractors twice.
