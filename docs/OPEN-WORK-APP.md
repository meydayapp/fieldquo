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

## 2. Tours are rendering in UKRAINIAN

  * `TODO` `/app/crew-inbox`, `/app/settings/refer`, `/app/settings/ai-credit` —
    the tour appears in Ukrainian for a Spanish user. A language-resolution bug,
    not a missing translation: the copy exists, the wrong locale is chosen.
    Suspect the same class as the note in app/sales/layout.js about the portal
    once coming up in German because localStorage is shared with the marketing
    site on this origin.

## 3. Screens with untranslated or half-translated text

Half-translated is worse than untranslated — it reads as broken rather than as
unsupported. Every one of these was seen with the account set to Spanish.

  * `TODO` `/app/scheduler` — dates and day names in English; the whole warning
    "No working hours set for Jon Smith… Set their hours".
  * `TODO` `/app/schedule` — day names; "set hours"; "everyone's weekly availability".
  * `TODO` `/app/settings/availability` — day names in English.
  * `TODO` `/app/time-off` — "No leave policies have been set up yet. An owner or
    admin can add them in Settings → Time off policies." beside Spanish headings.
  * `TODO` `/app/payroll` — the intro sentence is half-and-half in ONE sentence
    ("FieldQuo works out what each person should be paid… Pagas a través de tu
    propio banco"); "THIS PERIOD", "GROSS · 2026", "DEDUCTIONS · 2026", "NET ·
    2026", "0 approved hours", "No hourly rate is set on your record…".
  * `TODO` `/app/settings/payroll` — "When you pay", "not set — using the default
    below", "How often", "The period closes", "Payday", "This period", "Last one
    closed", and the whole cadence explainer.
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

  * `TODO` The finance "Resumen de IA" has a Spanish heading and an English body.
    Any AI-written summary shown to a user must be produced in that user's
    language, not translated after the fact.

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
  * `TODO` `/app/settings/payroll` — "not set — using the default below" should be
    a link to where you set it.

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
