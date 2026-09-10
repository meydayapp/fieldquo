# App-wide open work — reported 2026-09-10

Everything the owner reported in one pass, written down because the last time a
list this long arrived, things fell off it. Nothing is marked done here until it
is deployed and verified on www.fieldquo.com — "the code is committed" is not
the same claim, and this session has already proved that twice.

Status key: `TODO` · `IN PROGRESS (agent)` · `DONE + verified` · `NEEDS DECISION`

---

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
