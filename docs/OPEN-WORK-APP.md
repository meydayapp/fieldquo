# App-wide open work — reported 2026-09-10

Everything the owner reported in one pass, written down because the last time a
list this long arrived, things fell off it. Nothing is marked done here until it
is deployed and verified on www.fieldquo.com — "the code is committed" is not
the same claim, and this session has already proved that twice.

Status key: `TODO` · `IN PROGRESS (agent)` · `DONE + verified` · `NEEDS DECISION`

---

## 0. LAUNCH LIST — kept current (owner: "make a list so you don't forget and update it")

Updated 2026-09-12 13:20 ET. One line each; move a line down when it lands.

**Running now (agents, in parallel)**
1. Check-in drafts for EVERY company attributed to a rep, thread or not (Easy Roofers has none today because drafts were only produced inside an existing text thread) — Texts → Drafts due, My companies, console Tasks; 07:00 UTC cron; backfill; demo company gets one. (started 2026-09-12 ~12:45 ET)
2. Call script + brief in EN / FR / ES — default from the lead's language (Quebec → fr), switch on the Script tab, on-demand generation ≈ $0.001. (started ~12:25 ET)
3. Sales Portal Training Manual EN/FR/ES (docs/sales/manual) — Daniel → Easy Roofers as the pay example; index, glossary, resources; console/Texts/Team screenshots now, /sales captures when the owner's Chrome is signed in. (started ~12:45 ET)

**Waiting on the owner**
4. **Meta webhooks are NOT configured in the App Dashboard** (checked 2026-09-12 17:40 UTC: Page and Instagram objects — empty Callback URL, empty Verify token, every field Unsubscribed). That is why Facebook/Instagram messages to Truefinish Cabinets never arrive. Steps: App Dashboard → Webhooks → **Page**: Callback URL `https://www.fieldquo.com/api/meta/messaging/webhook`, Verify token = `META_WEBHOOK_VERIFY_TOKEN`, Verify and save, Subscribe `messages`, `message_echoes`, `message_deliveries`, `message_reads`, `messaging_postbacks`, `leadgen`; **Instagram**: same URL + token, Subscribe `messages`, `messaging_postbacks`, `messaging_seen`, `message_reactions`; then switch **App Mode → Live** (Meta: an unpublished app gets no production webhooks, even from admins). Exact clicks: docs/META-DASHBOARD-CURRENT.md. Page connect itself works (`ae66b297`); the 84 existing Facebook conversations were imported by the cron on 2026-09-12 17:30 UTC.
5. Sign in to /app and /sales in the Chrome with the Upwork tabs → product-guide screenshots (every sidebar + Settings item), RBAC section (Crew/Estimator/Dispatcher/Manager/Owner + Custom), sales-portal captures.
6. Upwork offer to Rachel K. — unsent in the owner's tab (US$90 = 14/29/47 for CA$125).
7. Set "Sells in" French on Rachel/Daniel in /platform/sales/reps when hired.
8. Access Verification (WhatsApp) — Meta's review, ≤5 business days from Sep 11.
8b. Browser push keys — run `npx web-push generate-vapid-keys` once and set `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` (`mailto:…`) in Vercel (docs/VERCEL.md). Until then the Notifications block on all three surfaces says push is not set up and only the in-tab half works (toasts + system notifications while a tab is open). The toast layer itself (one portal, all surfaces; the half-hidden bell popover and the sales top-up toast under the tour pill) is done — docs/screens/notifications/.

**Queued next**
9. Per-jurisdiction calling-window override in /platform (enforce / warn only / off; OK/FL caps enforced by default; registration gate untouched — owner: "don't feed it to the companies until I check off the registration").
10. Retry-pool cadence (no answer → scheduled retry, time-block rotation, max attempts, exhausted/recycle) — OMniLeads' ReglasIncidencia model as the reference.
11. AI triage of inbound text replies (roadblock / question / fine) — owner asked "just in case we lose them on a roadblock".
12. Call recording + transcription + daily AI review (owner's Twilio question) — needs the owner's yes on recording consent and ≈$5/day.
13. Company-side crew chat in /app on the chat kit (#general, room per job, DMs).
14. Mobile app native feel (branch `mobile`) — on hold: "don't work on that yet".
15. Pre-existing reds: check:mobile (app/sales/messages whitespace-nowrap), check:playbook-voice (app/api/sales/leads/route.js), check:snapshot-campaigns (shouldPoll), check:platform-console (two brand-accent classes in the sales shell).

**Done 2026-09-12** — symmetric language rule (French-only ⇒ Quebec only); rolling batch 25 / top-up under 5 / zone chips; rep console (dialer left, tabbed card); Texts, Team, /platform/chat and /app/messages on one chat kit; Review folder + 115,526 licensees reclassified; Amish Valley text zone + "Open now" + playbook on leads + held list not narrowed by trade; growth table months + blended rates + fill-from-measured; Meta: login configuration, three-way diagnosis, error log, auth_type=rerequest, direct Page read; Twilio token 20104 recovery; California campaign denominator; sales guide PDFs EN/FR/ES (+ Desktop copies); "leads and leads" strings.

## 1. PRIORITY — a company is using a number it did not buy

  * `CODE FIXED, LIVE ROWS NOT` — root cause found and gated (commit 67ee6cd0).
    claimCrewLine had two guards and both worked: "does FieldQuo's Twilio account
    own this number" (yes — it is FieldQuo's own rep line) and "is another
    company holding this as a CREW line" (no — it was a SALES line, another
    table). "Not somebody else's crew line" is not "not in use", and every rep
    line and every receptionist number sat in that gap, claimable by any tenant,
    free, because a claim never charges. lib/voice/numberCommitment.js now asks
    the right question before the row is written and before the webhook moves.
  * `NEEDS OWNER DECISION` The LIVE ROWS are untouched on purpose. Easy Roofers
    Inc. still holds +17166383616 and Daniel's inbound texts still arrive in
    their crew inbox. Remediation is three steps and every one of them is
    outward-facing, so it is the owner's call, not mine:
      1. Disconnect the crew line for company cmtvs4kha000004js8lf58ls2.
      2. Repoint the number's SMS webhook away from /api/crew/inbound.
      3. Decide whether Easy Roofers gets a real crew number, and who pays for
         the month already marked paid.

  * `TODO` A tenant's crew inbox reads **"Tu equipo escribe a este número
    +17166383616"** — a number the owner had assigned to **Daniel, a sales rep**.
    The tenant "didn't buy the phone number and they didn't add credit". Its
    activity log says `Crew texting turned on — crew text +17166383616`, and the
    panel offers texting at 2¢/message against a US$0.00 balance.
    Three separate questions, and they are not the same bug:
      1. HOW did a sales rep's number end up on a tenant's crew inbox — is the
         number pool shared, or is the lookup unscoped?
      2. Why is crew texting ON for a company that bought no number?
      3. Why is it offering to send at $0.00 credit — where is the gate?
    Owner: "look into this and prioritize".

## 1c. RED ON MAIN — check:compare-pages, since 2026-09-09 22:19

  * `IN PROGRESS (agent)` Bisected: `c4fc2509` broke it and `e8724441` added the
    check that catches it TWO MINUTES LATER and pushed it red. Eighteen hours
    ago, a previous session. Not this session's, and not the agents'.
  * The failing amounts are the COST COMPARISON the owner demanded — Jobber
    4800/3960, HCP 1080/1920, Projul 3600/2760, QuoteIQ 611.88/1560/6360,
    ServiceTitan 245/300/5000/15000 — against a check rule that every printed
    amount must be a figure the competitor PUBLISHES.
  * Two different questions, being answered separately:
      A. 12 × a published monthly is arithmetic a reader can do, and refusing it
         guts the feature. The CHECK is what should learn the rule.
      B. ServiceTitan's figures came from a pricing video, and ServiceTitan does
         not publish prices. That is a comparative-advertising decision and is
         `NEEDS OWNER DECISION`, not an agent's to take. The owner has already
         been angry once about these being missing, so nothing gets cut.
  * Section 7 — "ninety-five days on, no amount of theirs survives" — is a
    STALENESS rule and is probably a genuine bug rather than a policy question:
    derived totals may not be covered by the staleness path.

## 1d. The tour follows the language — the PORTAL AROUND IT does not

  * `VERIFIED FIXED` The tour itself is correct. Confirmed live in the owner's
    own Spanish rep session: "TU GUÍA DEL PORTAL", "1 de 20", "Hoy: qué hacer a
    continuación", "Siguiente", "No volver a mostrarme esto".
  * `IN PROGRESS (agent)` The portal around it is HALF translated, which reads as
    broken rather than as unsupported. One screenshot of the tab bar:
        Today | Cola | Playbook | Mis prospectos | Conversaciones | Texts | Team
    and the tour renders "Abrir Today" — a Spanish verb around an English tab
    name, because it interpolates the tab's literal label.
  * SalesShell documents that split ON PURPOSE: a tab gets a key only when the
    screen behind it is translated, because a translated tab onto an English
    page is the worse inconsistency. That reasoning was right when written and
    stops being right the moment the screens are done. The order is: translate
    the screen, THEN switch its tab.
  * `MINE` /sales/pay and app/components/sales/EarningsPanel.js were written by
    me today in English and never keyed. Handed to the agent with that said
    plainly, so it is not mistaken for somebody's careful decision.

## 1e. /login is Spanish on the left and English on the right

  * `IN PROGRESS (agent)` Verified live. The form is Spanish; the entire right
    panel — "Everything your day runs on" and its three bullets, the free-month
    line, "Built for 12 trades" — is English. It is the first screen a new
    contractor sees.

## 1f. /savings is English in every language, and its money is formatted wrong

  * `IN PROGRESS (agent)` Owner: "this is still english only even if i changed
    it to ukrainian spanish ... its missing proper dollar formatting". The
    /compare pages had the same money bug this morning — amounts grouped with a
    hardcoded en-US/en-CA, so a French-Canadian reader saw 1,250 where the
    locale writes 1 250. `numberLocaleFor()` already exists; the agent is told
    to use it rather than write a second one.
  * Also being checked: whether /savings prints competitor figures WITHOUT going
    through the truth gates the comparison pages now enforce. If it does, that
    matters more than the translation.

## 2. Tours are rendering in UKRAINIAN

  * `CODE FIXED, NOT YET VERIFIED LIVE` — and the suspicion was right, down to
    the mechanism. /app nests two LanguageProviders: the inner one is handed
    the account's language with `fromAccount`, the root one (app/layout.js) has
    no account to ask and follows localStorage, a key this origin shares with
    the marketing site. `<AppTours />` is mounted AFTER `</LanguageProvider>` in
    app/app/layout.js — a sibling of the account provider, a child of the root
    one — so the tour, and only the tour, read the marketing site's leftover
    "uk" while every other string on the same screen was Spanish.
    Nothing was special about those three pages: EVERY tour was Ukrainian, and
    those were the three he had not already dismissed. ErrorToast,
    PlanRequiredPrompt and JenniferPanel are mounted out there too, and
    `<html lang>` was being written twice, outer last, so the page was
    announcing "uk" to screen readers.
    Fixed in lib/i18n/statedLanguage.js: a stated account preference is a fact
    about the PERSON, so once any provider on the page has been told one, every
    other provider defers to it instead of to a browser guess. Deliberately not
    "move the JSX tag" — that repairs one mount point and leaves the trap armed
    for the next thing added beside it. `npm run check:tour-language` executes
    the resolver against the owner's exact inputs; 7 mutations, all caught.

## 3. Screens with untranslated or half-translated text

Half-translated is worse than untranslated — it reads as broken rather than as
unsupported. Every one of these was seen with the account set to Spanish.

  * `CODE DONE, NOT YET VERIFIED LIVE` `/app/scheduler`, `/app/schedule`,
    `/app/settings/availability`, `/app/time-off`, `/app/payroll`,
    `/app/settings/payroll` — 77 strings, nine languages, one commit.
    Three things worth knowing beyond "it is translated now":
      - **Day and date names are not translation keys and never will be.**
        They come from Intl through `lib/format/localeDate.js`, keyed on the
        user's app language. CLDR already ships that table for every language,
        including the ones this catalogue has not been translated into, and it
        also gets the ORDER right — "Jan 7" is "7 janv." and "1月7日". Seven
        keys per language would have been 171 strings and still wrong.
        `orderedWeekdays` in `lib/format/companyDate.js` now delegates there;
        its English output is byte-identical to the array it replaced, so the
        opening-hours modal did not move.
      - **The payroll intro was not a missing translation.** It was one
        sentence assembled from an English fragment, a `t()` call and a second
        English fragment, so translating the middle produced a sentence half in
        Spanish and half in English. Fixed by making the SENTENCE the unit —
        two whole keys — not by adding more fragments. The same shape was in
        five other places on these screens and all five are gone.
      - **`/app/settings/payroll`'s cadence explainer came from the SERVER** as
        a finished English sentence (`describePayCycle`). The card builds it
        from the structured values instead, with the day count going through
        CLDR plural rules, so Ukrainian gets its three forms. The route still
        returns `describe`; nothing on this card reads it.
    "not set — using the default below" now carries a link, as asked (§7).
    Guarded by `npm run check:schedule-i18n`, wired into `check:all`: it
    EXECUTES the date helper against a known Sunday in every language, fails on
    a bare English literal in these eight files, and fails on a key that holds
    half a sentence. Twelve mutation tests, each confirmed to fail by exit
    code. Still English on these screens, and NOT mine to fix: the shift-fit
    refusal reasons and the pay-run warnings, both composed in API routes.
  * `TODO` `/app/purchasing` — English.
  * `TODO` `/app/funnels` — English, including everything behind "New funnel".
  * `TODO` `/app/marketing/designer/[id]` — English.
  * `TODO` `/app/help` — most guides English only.
  * `TODO` `/app/settings/product-updates` — English content.
  * `TODO` `/app/settings/checklists` — every checklist is English only.
  * `TODO` `/app/settings/follow-ups` — English inside "new rule".
  * `TODO` `/app/settings/company` — opening hours: day names, "Closed", "Apply
    Sunday's times to every open day", "Reset to typical trade hours", "Save
    opening hours".
  * `TODO` `/app/settings/voice` — large blocks: "Keep my number, forward missed
    calls", "You keep the number that's on your van…", "Get a new number", "Local
    number — US$4.00/mo", "Move my number over", "Two to four weeks…".
  * `TODO` `/app/activity` — some entries English ("Crew texting turned on",
    "Added client…"), and the intro paragraph.

## 4. Machine translation for CLIENT-FACING free text

The owner's rule: text a contractor types that a HOMEOWNER will read must reach
that homeowner in the homeowner's language. This is different from UI strings.

  * `TODO` `/app/settings/company` — scope of work and terms.
  * `TODO` Financing blurb ("Qué decir al propietario" — their own words).
  * `NEEDS DECISION` `/app/settings/email-templates` — are custom emails
    auto-translated? Owner asked.
  * `NEEDS DECISION` `/app/settings/templates` — same question for PDFs.
  * `NEEDS DECISION` `/app/settings/translations` — owner: "not sure what this is
    for?" Either it is not doing what it looks like it does, or it is unexplained.
  * CONSTRAINT: AGENTS.md non-negotiable #6 — a document keeps the language it
    was created in, and a signed PDF must keep saying what it said. Whatever is
    built here must not retranslate an already-sent document.

## 5. AI output must follow the reader's language

  * `CODE FIXED, NOT YET VERIFIED LIVE` The expense summary is now GENERATED in
    the reader's language — lib/i18n/aiLanguage.js adds the clause to the system
    prompt, and there is no translation step after generation. Same treatment
    for the two biggest blocks of AI prose a contractor reads: FieldQuo AI
    (lib/ai/copilotClient.js) and Jennifer (lib/ai/jennifer/client.js). The
    rule-based flags printed under the expense summary are computed in code, not
    by the model, so they come from a template table (lib/i18n/aiSummaryCopy.js)
    rather than being handed back to the model — the arithmetic stays in code.
  * `TODO` Still English regardless of the reader:
      - `lib/ai/monthlyDigest.js` — the whole monthly email. Subject line is
        `toLocaleString("en-US")`, the flag bullets are English, and the digest
        is stored ONCE per company but emailed to several owners. Half-fixing
        it (Spanish paragraph, English subject and bullets) would be worse than
        leaving it; it needs subject + flags + body together, and a decision on
        whether one company gets one language or one call per recipient.
      - `lib/ai/quoteReview.js` — its `rewrites` restate the contractor's own
        document text, so the reader's language is the WRONG axis there:
        non-negotiable #6 says a document keeps the language it was created in.
        The review's commentary could follow the reader; the rewrites cannot.
      - `lib/ai/conversationTemperature.js`, `lib/ai/callTranscriptDigest.js`,
        `lib/ai/callLeadRecovery.js`, `lib/tasks/suggestFromJob.js`,
        `lib/voice/knowledgeDraft.js` — all write prose a contractor reads, all
        English-only. Same one-line fix each: `withLanguage(system, language)`
        plus a `readerLanguage()` at the caller.

## 6. Broken

  * `TODO` `/app/settings/ai-employee` — stuck on "Loading…", nothing happens.
    Owner: "i thought this was completed".
  * `TODO` `/app/activity` — missing the settings sidebar entirely.

## 6b. FOUND WHILE INVESTIGATING — client texts have NO gate at all

  * `NEEDS OWNER DECISION` The owner suspected "there is no gate i think for
    this" and he is right, in a bigger way than the question implied. The
    "on my way" client text (app/api/jobs/[id]/visits/[visitId]/route.js) calls
    sendSms WITHOUT a `from`, so lib/sms/twilioClient.js falls back to
    systemSmsNumber() — FIELDQUO'S OWN number. There is no balance check, no
    credit reservation and no per-company number requirement anywhere on that
    path. Crew texting has crewSpendVerdict; this has nothing.
    Two consequences, and the second is the worse one:
      - FieldQuo pays for every client text every tenant sends.
      - The homeowner's phone shows FIELDQUO'S NUMBER, not the contractor's,
        which contradicts the first paragraph of AGENTS.md: white-label by
        default, "a homeowner comparing three contractors should not be able to
        tell that two of them use the same software".

## 7. Answers to the owner's direct questions

  * `/app/settings/messages` is NOT a conversation screen and the Rocket.Chat UI
    does not apply to it: it is the EDITOR for the wording of automated client
    texts, and today exactly one of them actually sends ("on my way"). The gate
    concern behind the question is real and is 6b above.
  * "can that be the same retell number for the AI agent and text message?"
    NO. VoicePhoneNumber.provider defaults to "retell" — the receptionist number
    is provisioned at Retell, not Twilio, and nothing in the schema records SMS
    capability on it. Voice and SMS are two providers here. Texting from the
    contractor's own number needs an SMS-capable TWILIO number.
  * `/app/settings/translations` is the review screen for translated wording on
    CLIENT DOCUMENTS — source beside translation, one row per service, with a
    "draft the missing ones" action. It is already the mechanism section 4 is
    asking for; the question is whether it covers scope-of-work, terms and the
    financing blurb, or only service names.

## 8. Product gaps the owner has raised before

  * `TODO` `/app/settings/messages` should use the Rocket.Chat-style thread UI,
    because it IS a text message. It also needs a Twilio number and credit —
    owner believes there is NO GATE today. Open question he asked: are these sent
    automatically, and can the Retell AI number double as the SMS number or does
    Twilio need its own?
  * `TODO` `/app/settings/follow-ups` — he asked previously for a drag-and-drop
    process-flow builder in the style of Power Automate, and it was not done.
  * `TODO` Instant quotes still do not match the services actually offered — the
    "Tus cotizaciones instantáneas no coinciden con tus servicios" warning still
    fires for Roofing. He expected these to be driven by the services list.
  * `DONE (code)` `/app/settings/payroll` — "not set — using the default below"
    now carries a "Set it up" link beside it, which focuses the "How often"
    control directly below rather than navigating somewhere else: the place to
    set it IS below, and a link to another screen would have been a lie. Shown
    only to someone who may edit — for everyone else the card already says
    "Set by an owner or admin.", and a link that 403s is the dead control this
    codebase keeps finding.

---

## 9. The eight PARTIAL features — why, and the plan (2026-09-11)

The owner saw PARTIAL badges in the sales guide and asked what each one meant.
Two of the ten were STALE and are now shipped in the matrix (`languages`: the
caveat outlived the PDF font bug it described; `checklists`: a template can be
applied to any visit after the fact, so the caveat described a starting state,
not a gap). The guide no longer prints badges or caveats — they live here.

Each row: what actually works today / what the caveat means / the plan.

| key | works | the caveat | plan |
|---|---|---|---|
| `appointment_reminders` | Cron texts the client N hours before, from the company's own number when they have one, the shared number with the company name otherwise. Opt-in per company. | SMS only, wording not editable, **English only with en-US dates regardless of client language**. | (a) Render the text in `client.language` via the same catalogue the emails use; localise the date. (b) Expose `appointment_reminder` in the message-templates editor — `renderTemplate.js` already declares it. (c) Email fallback when the client has no mobile. Then shipped. |
| `subcontractor_bids` | Importing a sub's quote as a marked-up cost line — fully works when the sub is on FieldQuo. | No sub roster, no assigning a sub to a job/visit, no paying the sub's company, no COI/T5018 tracking. | Rename to what it is ("Sub quotes as a cost line") and mark shipped; open a NEW matrix entry "Subcontractor management" for the roster/assign/pay/insurance work, which is a real feature, not a caveat. |
| `financing` | Affirm at Stripe checkout when eligible; a monthly figure on the quote when the company enters its own rate and term. | "FieldQuo does not lend" — this is a description, not a gap. It will never lend. | Move the sentence into the summary and mark shipped. The only real gap: no Canadian pay-over-time provider (Affirm is US). |
| `marketing_spend` | Spend by channel, Meta import, blended cost per lead, per-campaign cost per lead / quotes / jobs / revenue for Meta lead-form leads (`lib/analytics/campaignRollup.js`). | Every non-Meta channel, and a homeowner who saw the ad and phoned, is still blended — nothing ties that spend to that lead. | Phone attribution needs call tracking numbers per campaign; other channels need their own import. Not small. |
| `payroll` | Gross pay, payslips, export. | Does not remit, does not file. | Statement, not a gap — a bookkeeping export is the product. Move to summary, mark shipped. Filing = a Wagepoint/ADP integration decision, owner's call. |
| `contractor_payouts` | Approved hours × hourly rate → Stripe Connect transfer to a person on the roster. | Hours-only (no fixed amount), **CAD hardcoded** (`lib/stripe.js:231`). | Currency from the company (one line + a check). Fixed-amount payout = one more input on the same route. Then shipped. Answer to "how is it different from paying an invoice": an invoice is money IN from a client; this is money OUT to a person you employ by the hour. It is closer to payroll than to accounts payable — payroll produces a payslip and a file, this actually moves the money. Paying a sub COMPANY a fixed bid is the subcontractor-management entry above. |
| `priced_options` | Good/better/best pricing and the three-quote group exist server-side (`tier-group` route). | No screen. | Build the screen or delete the route. Owner's call — it was started for a reason. |
| `door_hanger_routes` | Route planning and stop tracking. | Does not print or deliver the hangers. | Statement, not a gap. Move to summary, mark shipped. |

**Found on the way — client-facing text that ignores the client's language:**
- `lib/sms/templates.js`: on-my-way, appointment reminder, booking confirmation — all English, `toLocaleString("en-US")`. `client.language` is never read.
- `app/api/cron/follow-ups/route.js`: follow-up / marketing / custom email templates render the sections the company wrote, in whatever language they wrote them — a French client gets the English follow-up. `DocumentTemplate` has no `language` column and `FollowUpRule` points at one template.
- Quote/invoice PDFs, covering emails, portal: **verified working in all eight** (`documentLabels`, `emailCopy`, `clientDocCopy`, PDF font stack).
- Portuguese: the owner listed it. Not in `LANGUAGES`. Adding a ninth language is a catalogue-wide job (every `check:translations` floor), not a switch.

## 10. Flags from the subcontractor / fleet / location builds (2026-09-11)

- **`Job` carries two coordinate pairs.** `siteLatitude / siteLongitude /
  siteGeocodedAt` (from 37b4e9f3, read by nothing) and `latitude / longitude /
  geocodedAt` (d24980e3, now written by `lib/geo/geocodeJob.js` and read by the
  timesheet distance flag). One pair should go. Dropping the older three is a
  column deletion — **owner's call**, not taken here. Nothing reads them.
- **Meta Ads screen has no uk / pa / tl keys at all** (`app.setMetaAds.*` is
  absent from those three catalogues — falls back to English). Pre-existing;
  the screen is 37 keys.
- Position stamps: no 30-day sweep of geocoded coordinates (Google's terms
  suggest one); `geocodedAt` is written so a cron can be. A deleting cron is a
  decision, not a default. `lib/crew/inbox.js` still hands the GPS matcher
  `lat: undefined` and could now read `job.latitude`.
- Fleet: `PATCH /api/expenses/[id]` writes `projectId` without ownership
  proof — pre-existing, flagged by the fleet agent, not fixed.
- Pre-existing red checks noticed by the agents, none from this work:
  `check:credit-currency` (`lib/ai/creditBundle.js` is a fifth crediter, from
  f4b4c5dd), `check:tenant-scope` (support-ticket routes).

## 11. Shipped 2026-09-11 (evening) — sales portal, pipeline, Meta, mobile

Landed on main, each with its own check script and mutation test:
- Sales portal mobile (tab bar + drawer), tour pinned to 17 real targets, activation language picker — `73a5a260`
- Link a signup BY EMAIL with predate + no-other-rep + no-referral rules; unlink ≤30d; the wrong link undone — `3b1fcc50`
- "Claim the next 100" per trade, researched first, window-aware, daily cap 150, hourly day-end release; sticky-card overlap fixed — `0155071e` (superseded by the rolling batch of 25 below)
- Research on claim (`ensureResearchQueued`), backlog slice + DNS backoff, AI call script (9th stage) — `ec3bdecb` `203aaf28` `0f8fae29` + 3 live-run fixes
- `researching` status admitted to the claim filter (13,734 researched rows were unclaimable) — `84d99ec9`
- Agent status (Available/Break/Dinner/Meeting/Training/Off) + ledger; progressive autodial (5 s countdown, manual path reused) — `7f0eec23`
- Human-voice script prompt v2 with page excerpts + citations; stage notes folded; demo offer replaces "I'll put that button"; no times in closes; email into the lead (1,748 backfilled); three next steps (demo 30m / signup → onboarding progress / walkthrough 60m on DemoHostAvailability) — `113fc22d`…`33969113`
- Freelancer/employee control on /platform/sales/reps; rep no longer shown the sentence — `da1ed268`
- Rep queue on the console: held/dialled/untouched, presence incl. stale, Release, Move to rep, deactivation gate — `4ac108e4`
- Overture snapshot reader: a complete part with a larger manifest count is accepted; mid-line cut still refused; both California campaigns unblocked and re-enqueued by hand — `d26d9b01`
- Meta: env set in prod, four permissions added, redirect URIs saved, Access Verification submitted (in review ≤5 d), sync date bug + NUL-byte bug fixed, full metrics + currency ≈ + per-campaign CPL, KPI crash on `cancelled` status — `a41f2b90` `3f1b6770`…`a5f9cbba`
- Growth card labelled as a forecast — `90eab8db`
- **Quebec leads go only to reps with French** — the owner's rule, verbatim: "the leads from quebec will be most likely french speakers so they can't be handed out to anybody unless they have a French profile in their settings." `SalesRep.sellsIn String[]` (ISO codes; empty = English-only for allocation, shown as "not answered" so the rep is asked) is set by the rep under **Languages I can sell in** on Pay & settings and the first-run pass, and by a superadmin in the **Sells in** row on /platform/sales/reps (the Quebec closer gets `["fr","en"]` there before their first shift). `lib/sales/leadLanguage.js` is the pure rule (QC in any spelling → fr; NB and no-province → no requirement; the eleven Quebec area codes for inbound). Enforced in the database WHERE of the single and batch claim (`claimCandidateWhere({ rep })`), counted back to the rep as "N Quebec leads not offered — add French", refused with 409 by Move / the deactivation hand-off (pickers grey ineligible reps and say why), and applied to the inbound ring plan (a 514/438/450/… caller, or a matched QC row, rings only reps with French; nobody live falls through to the hold queue and voicemail as today). Discovery untouched. `scripts/check-lead-language.mjs` + extensions to the batch-claim, rep-queue, inbound-distribution and rep-settings checks; five mutations caught by exit code. — `60b3850d` + the enforcement commit.

- **The rolling batch (owner's decision, 2026-09-11 at 9:20 pm Eastern — "a batch of 25, and if there are fewer than 5 leads left it auto-fetches a new set from the current time").** `QUEUE_BATCH_MAX` is 25; the daily cap stays 250 and the rep can still press Claim. Selection is OPEN NOW, closing soonest first (researched first inside the same closing; the shift-end bound stays) — a row that opens later, even inside the shift, is skipped and counted, and a short batch says "N open now — more open at 8:00 AM ET" from the earliest opening among the rest (`partial_open`; nothing open → `none_open_now`). The console tops up on its own when the rep's held-and-callable rows drop under 5, at most once a minute, posting only `auto: true`; the server first releases the rep's untouched rows whose window is shut for the rest of the shift (`releaseClosedUntouched`, reason `closed`, never a row with an attempt or a callback; counted back as `releasedClosed`), then claims; a quiet toast says "Added 25 leads open now (PT)". Two tabs cannot double-claim (the claim's updateMany carries the candidate WHERE inside one transaction and winners are read back by rep and instant — asserted). Zone chips (All · ET · CT · MT · PT · AT · NT from `zoneAcronym`) filter the list and the walk. The rep console layout is the owner's two-column dialler (docs/screens/sales-console). `check:sales-batch-claim`, `check:queue-windows`, `check:sales-autodial`.

**Open, owner's call:** Job's duplicate coordinate pair (§10); WhatsApp needs Access Verification approval; Facebook Page reconnect still not done (grant zero pages → "doesn't administer any Page"); Capacitor 8 for geofences (mobile branch); Apple/Play accounts; platform AI budget cap (scripts ≈ $5.2/day at 4,000 claims, inferences ≈ $4/day); "Assign to me" needs a SalesRep row on the admin's email; automatic night-before reminder (SalesEvent.reminderSentAt); a merge screen for `possibleDuplicateOf` pairs.

**In flight:** AI inference stage + unblock-re-enqueues-discovery (agent).

## Already in flight this session (separate agents)

  * Roofing: material coverage from real products, editable price AND quantity on
    every line, Google Places autocomplete on the measure address, builder i18n.
  * Marketing i18n: /compare, /compare/*, /pricing, /app/leads/import.
  * Sales playbook: cold-call script rebuilt on the Cognism/Close/Gong
    frameworks, plus competitor battlecards for reps.

## Done and verified today

  * Roof measurement was reading a shed 23 m from the pin — now 2,163 sqft at
    917 Littlerock, within 1.6% of a competitor's figure.
  * Six of seven roofing linear details prefill from the facet geometry.
  * Satellite stills captured to Cloudinary instead of hotlinked with a live key.
  * Milestone 1 was never recorded for companies whose Connect status came from
    the polling route rather than the webhook.
  * A rep can see what they have earned, and which company is at which stage.
  * Staff chat across /sales and /platform.
  * The sales tour opens itself and looks like the tours we sell.


---

## How seven agents in one tree actually went wrong

Two failures today, and neither was a mistake inside an agent. Both lived in the
space between them, where no agent could see and my per-agent instructions did
not reach.

**1. A committed file imported one that was never committed.** Every deploy
after `b11b6643` failed at the first build gate: `lib/format/localeDate.js`
imports `@/lib/format/dayNames`, and only the importer was on main. One agent
created dayNames.js and was still working elsewhere; another built on it —
correctly, rather than shipping a second Intl weekday table in the same
directory — and committed. Each verified its own paths honestly. Only a build of
the COMMITTED STATE could have caught it, and nobody was running one.

  → Verify main after every agent lands, not at the end.

**2. `git add <path>` is not enough when the index is shared.** Agents and I
share one working tree AND one git index. `git add` puts a file in that shared
index; `git commit` then commits THE WHOLE INDEX, not the paths just added. So
another agent's staged-but-uncommitted files ride along silently.

It happened twice, both mine: `67ee6cd0` ("A contractor was given a sales rep's
phone number") carries 12 files of the roofing agent's work, and `8838851d`
carries 1,353 lines of appMessages.js when the change was a ten-line tour step.
The code is correct and on main; what is wrong is that two commit messages
describe a fraction of their contents, which makes the history lie.

  → `git commit -- <paths>` — the pathspec form commits ONLY those paths
    whatever else is staged. `git add` by name does not protect anything.

History is NOT being rewritten. Other agents have already built on these
commits, and rewriting shared history to tidy an attribution is a worse problem
than the attribution. The real explanations live in follow-up ledger commits
instead — `f606abc7` for the roofing work.
