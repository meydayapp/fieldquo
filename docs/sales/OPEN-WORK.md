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
| Free dial | A number a contractor gives you on the call ("ring him on his cell") is recorded against the business and can be dialled or texted. The browser sends an ID, never a number — the server re-reads the row, checks it belongs to the record being dialled, and re-runs the do-not-contact flag, the suppression list (across EVERY number of theirs), the calling window and the 24-hour cap against the number that will actually ring. A landline is refused for text with the reason said out loud. `check:free-dial`, 161 assertions. |
| Editing from the queue | "What you learned on the call" writes the rep's OWN lead — contact name, email, phone, status — through the route that already writes it. It never touches the discovered Prospect: `phoneE164` is the dedupe key every past call, text and opt-out is filed against, and `country`/`province` decide which calling statute applies to every rep who will ever hold that row. |
| Plan gate | A company that never finished checkout cannot send a quote or an invoice. |

---

## In flight

Nothing. Free dial landed on 2026-09-10 — see the two rows above.

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
- **The queue judges the calling window from the PROSPECT's location only.**
  A rep who learns on the call that a business is actually in Ohio can say so
  on their lead, and the lead screen and the calls route both read the lead's
  pair ahead of the prospect's — but the queue's own compliance panel still
  reads the discovered row. Deliberately not changed with free dial: letting a
  rep move a business into a jurisdiction with a wider calling window, for
  every rep at once, is a compliance decision and not a UI one.
- **A number recorded in error cannot be removed**, only corrected — set its
  kind, or record that it must not be called or texted. There is no delete, on
  purpose: a gap invites the next rep to re-type the same wrong number, and a
  row saying "do not ring this" is a statement they can read.
- **`docs/sales/decks/train.js` is stale** on two slides — day-3 check-in (it
  is 1 and 7) and a "gap" where the queue ignores the suppression list (it
  reads it now).

---

## Done 2026-09-10 — roof measurement and sales milestones

- **The roof quote measured the wrong building.** 917 Littlerock St, Ottawa
  returned 119 sqft; a competitor returned 2,197.5 for the same address.
  `buildingInsights:findClosest` had found an 11 m² shed 23 m from the geocode
  pin. Fixed by discarding candidates too small to be a house and taking the
  nearest of what is left — now 2,163 sqft. One Solar request when the pin is
  good; the ring only fires on an implausible answer.
- **Six of the seven linear details now prefill** from the same facet geometry
  (`lib/measure/roofGeometry.js`). Step flashing does not, on purpose: it is
  roof meeting wall and a roof model has no walls.
- **The measure panel has an address field** instead of appearing only when the
  selected client had one saved.
- **Satellite stills are captured to Cloudinary** at quote creation instead of
  being hotlinked with a public key in the query string.
- **Milestone 1 was never recorded for most companies.** Two routes write
  `stripeChargesEnabled`; only the webhook recorded the milestone, and the
  other route exists because that webhook so often never fires. Both call
  `recordActivation` now, and a nightly sweep catches the backlog.

---

## Still open from this round

- **The measurement runs short on sprawling buildings.** The footprint
  perimeter comes from the bounding box's aspect ratio, which is exact for a
  rectangle-ish house and under-reads a rambling one: 24 Sussex Dr reports 273
  ft around a 4,577 sqft footprint. Every number is editable and labelled
  derived, but a mansion is quoted light on drip edge until this reads a real
  outline.
- **Predominant pitch disagrees with the competitor** at 917 Littlerock — 14/12
  against their 11/12, from the same Solar segments. That straddles a labour
  band (steep vs very steep), so it is worth settling. Their method is unknown;
  ours is area-weighted by rounded rise.
- **Penetrations are still all manual** — vent boots, skylights and chimneys
  cannot be seen in a roof model. Box vents and ridge vent are calculated from
  the code ventilation rule, which is the only part of that panel that can be.

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
