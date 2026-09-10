# App-wide open work — reported 2026-09-10

Everything the owner reported in one pass, written down because the last time a
list this long arrived, things fell off it. Nothing is marked done here until it
is deployed and verified on www.fieldquo.com — "the code is committed" is not
the same claim, and this session has already proved that twice.

Status key: `TODO` · `IN PROGRESS (agent)` · `DONE + verified` · `NEEDS DECISION`

---

## 1. PRIORITY — a company is using a number it did not buy

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

## 7. Product gaps the owner has raised before

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
