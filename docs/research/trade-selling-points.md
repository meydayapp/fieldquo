# What FieldQuo sells to each trade — the research behind `lib/sales/tradeSellingPoints.js`

**Written 2026-09-19.** The owner's ask, verbatim: *"each trade should have the
selling points for that, right? Electricians should include the self-booking,
the paid booking, and scheduling, similar to plumbers; while roofers is the
selling points for them, and painters too. Can you make sure you understand and
research what is most beneficial for each trade for them to be amazed and
efficient and reduce their administrative burden?"*

This document is the argument. The code is `lib/sales/tradeSellingPoints.js`
(one ordered list per discovery trade, EN/FR/ES), checked by
`scripts/check-trade-selling-points.mjs`, and read by the call script, the
queue's pitch layer, the intro email, the demo cards and the marketing
industry pages. **Every selling point below names a `lib/marketing/featureMatrix.js`
row that is `shipped`.** A pain whose only answer is `partial`, or is built but
has no matrix row, is listed under **Not yet** at the end — in this document,
never in a pitch.

## How the research was done, and what it is worth

Twelve web searches on 2026-09-19 across trade press (Roofing Contractor,
ACHR News, NAHB, PHAM News), contractor forums (PaintTalk, ContractorTalk,
Houzz), the home-service software vendors' own reports (Jobber's Home Service
Economic Report and 2026 Trends Report, Housecall Pro's missed-call page,
CompanyCam on claim documentation), and the competitor pages already studied
in `lib/marketing/competitors.js`. Vendor reports are self-interested and say
so where it matters; a forum thread is one contractor's day, not a survey. The
figures quoted here are the sources' own and stay in this document — the
selling points themselves carry no digit, because the talking-point gate
(`lib/sales/playbook/talkingPoints.js`) refuses a figure in a rep's mouth and
the call-script model copies what it is fed.

### The findings that hold across every trade

- **Speed to a price wins the job.** 78% of homeowners hire the first
  contractor who responds, and a business is far likelier to connect with a
  lead answered in five minutes than in thirty ([Housecall Pro, missed
  calls](https://www.housecallpro.com/resources/missed-calls/); [Vida,
  booking guide](https://vida.io/blog/home-service-booking-guide)). Jobber's
  2026 Trends Report has 60% of pros replying the same day and only 20% within
  the hour — HVAC slowest at 11% ([Jobber 2026 Home Service Trends
  Report](https://www.getjobber.com/home-service-trends-report/)). This is why
  the *instant price* and the *quote built in the driveway* lead for every
  trade that can be priced from a measure.
- **Missed calls are the biggest single leak.** 27% of calls go unanswered in
  busy periods and 62% at small businesses in normal hours; 80% of callers do
  not leave a message and 67% ring a competitor
  ([Contractor in Charge](https://contractorincharge.com/blog/missed-call-statistics-for-home-service-companies);
  [Housecall Pro](https://www.housecallpro.com/resources/missed-calls/)). The
  *AI receptionist* answers this for every trade that works alone on a ladder,
  under a sink or in a crawlspace.
- **Admin eats a day a week.** Powered Now's survey of UK tradespeople: seven
  hours a week, forty-eight days a year, on paperwork; for HVAC that is the
  equivalent of over £17,000 a year
  ([PHAM News](https://phamnews.co.uk/the-hidden-cost-of-being-over-burdened-by-admin/);
  [Installer Online](https://www.installeronline.co.uk/news/admin-overload-could-cost-over-17000-a-year-for-hvac-professionals-survey-finds/)).
  Only 65% of an HVAC tech's day is billable
  ([ACHR News](https://www.achrnews.com/articles/166324-report-only-65-of-hvac-technician-time-is-billable-hours)).
  The quote → job → invoice chain, the invoice sent from the van and card
  payment on the spot are the administrative-burden answer in every list.
- **Roughly 70% of consumers prefer to book online** for routine services
  ([Vida](https://vida.io/blog/home-service-booking-guide)). The *booking
  page* is first for every trade where the visit is the product.

---

## The trades

Format: what the day looks like → the top three administrative pains, each
with its source → the FieldQuo answers by feature-matrix key, in the order the
pitch says them. The first three keys are what the call, the email and the
page lead with.

### Electrical (`electrical`)

**The day.** Service calls between larger installs (panels, EV chargers,
basement circuits). The owner is the estimator, the dispatcher and the person
who answers the phone, usually with a meter in the other hand. Most work is
priced from a rate card (service call, hourly, per-item), not from a takeoff.

**Pains.**
1. Dispatch by phone and whiteboard — double bookings and wasted drive time
   ([Fieldproxy, challenges for small electrical businesses](https://www.fieldproxy.ai/resources/blog/8-reasons-electrical-contractors-fail-and-how-fsm-software-prevents-it-d1-37)).
2. Out-of-hours and mid-job calls go unanswered; the caller rings the next
   electrician ([SalesApe, out-of-hours callouts](https://www.salesape.ai/articles/how-electrical-contractors-dont-lose-out-of-hours-callouts);
   [Housecall Pro](https://www.housecallpro.com/resources/missed-calls/)).
3. Invoicing days after the job, and the "door that does not open" — a
   diagnostic visit driven to and not paid ([Fieldified case study](https://fieldified.com/case-study/electrical-contractor)).

**FieldQuo, in order.** `booking_page` · `booking_deposit` · `scheduling` ·
`voice_receptionist` · `call_to_quote` · `card_payments` · `price_book`.
The owner named the first three by name.

### Plumbing (`plumbing`)

**The day.** Same shape as electrical, with more emergencies: the leak at
seven in the morning, the water heater that quit. Diagnostic fees are
standard and disputed when the customer is not home.

**Pains.** The same three as electrical, plus the photo problem: "what does the
tag on your water heater say?" asked over the phone
([Jobber 2026 Trends Report](https://www.getjobber.com/home-service-trends-report/);
[Housecall Pro](https://www.housecallpro.com/resources/missed-calls/);
[PHAM News](https://phamnews.co.uk/the-hidden-cost-of-being-over-burdened-by-admin/)).

**FieldQuo.** `booking_page` · `booking_deposit` · `scheduling` ·
`voice_receptionist` · `card_payments` · `self_quote` (the water heater's label
photo arrives on the started quote).

### Heating and cooling (`hvac`)

**The day.** Seasonal peaks, maintenance visits between them, and big-ticket
replacements. The maintenance agreement is the whole business model of the
shops that survive the shoulder season.

**Pains.**
1. Maintenance agreements chased by hand — the renewal, the visit, the
   payment, three separate reminders ([ACHR News, billable hours](https://www.achrnews.com/articles/166324-report-only-65-of-hvac-technician-time-is-billable-hours)).
2. Slowest trade to respond to a lead — 11% within the hour ([Jobber 2026
   Trends Report](https://www.getjobber.com/home-service-trends-report/)).
3. Admin: seven hours a week ([Installer Online](https://www.installeronline.co.uk/news/admin-overload-could-cost-over-17000-a-year-for-hvac-professionals-survey-finds/)).

**FieldQuo.** `service_plans` · `booking_page` · `scheduling` ·
`voice_receptionist` · `card_payments` · `clients` (the address shows the
furnace you put in and every visit since). *Installed-equipment records* exist
in the product (`check:installed-equipment`) but have no matrix row — see Not yet.

### Appliance repair (`appliance_repair`), Locksmith (`locksmith`), Garage doors (`garage_door`), Chimney (`chimney`), Home inspection (`home_inspection`)

**The day.** Visit-shaped trades: the job IS the appointment, the fee is
disputed if nobody is home, and the phone rings while the tech is under the
machine (or, for the locksmith, at eleven at night).

**Pains.** Missed calls and no-shows ([Contractor in Charge](https://contractorincharge.com/blog/missed-call-statistics-for-home-service-companies);
[FieldPie, no-show reduction](https://www.fieldpie.com/blog/home-service-no-show-reduction/));
online booking expected ([Vida](https://vida.io/blog/home-service-booking-guide));
paperwork after every visit ([PHAM News](https://phamnews.co.uk/the-hidden-cost-of-being-over-burdened-by-admin/)).

**FieldQuo.** `booking_page` · `booking_deposit` · `scheduling` · (locksmith:
`voice_receptionist` first) · `card_payments` · (garage door and inspection:
`quotes` — both have their own takeoff card) · (chimney: `recurring_jobs`,
`service_plans` for the annual sweep).

### Roofing (`roofing`)

**The day.** Storm season is a stampede; the rest is estimates. An estimate
means a ladder, forty-five minutes to an hour on site, and a homeowner who is
collecting three of them. Tickets are large enough that how they pay matters.

**Pains.**
1. The ladder measurement: over 75% of high-volume roofers have left
   ladder-and-tape; satellite reports save 45–60 minutes per site visit
   ([1ESX, satellite measurement guide](https://www.1esx.com/satellite-roof-measurement-report-the-professional-guide-for-2026/);
   [ABC Supply, estimating faster](https://www.abcsupply.com/news-events/roofing-estimating-software-guide/)).
2. Poor communication is the homeowner's biggest complaint (two in five), with
   surprise costs and delays behind it ([Roofing Contractor, Homeowner's
   Journey 2026](https://www.roofingcontractor.com/articles/102121-the-homeowners-roofing-journey-in-2026);
   [2025 Homeowner Roofing Survey](https://www.roofingcontractor.com/articles/100649-2025-homeowner-roofing-survey-tracking-the-journey)).
3. Material take-off by hand from the squares; every competitor's page sells
   financing on the ticket ([QuoteIQ, roofing estimating software](https://myquoteiq.com/top-10-roofing-estimating-software-in-2026/)).

**FieldQuo.** `aerial_measure` (Google Solar through
`lib/measure/roofMeasurement.js`: area, pitch, facets, eave/rake) ·
`instant_quotes` (the roofing instant estimate) · `online_approval` ·
`material_costs` (bundles from squares — `check:roof-materials`) ·
`job_photos` · `card_payments`. **Financing is NOT pitched**: the matrix has
it `partial` (Affirm at Stripe checkout, no monthly figure unless the
contractor typed a rate). See Not yet.

### Painting (`painting`)

**The day.** Walkthroughs of fifteen to thirty minutes, the quote typed up that
evening — or a week later. Colour and finish decisions drag; ceilings, trim and
the second coat are where the margin is and where the homeowner says "I didn't
know that was extra".

**Pains.**
1. Slow quotes: "at least 80% of painters never get the quote back within a
   week" (a contractor on PaintTalk), and the walkthrough that skips the
   details becomes a surprise later ([PaintTalk, a serious question on
   quotes](https://www.painttalk.com/threads/a-serious-question-on-quotes-estimates.21269/);
   [Pearl Painters, the two-hour estimate](https://pearlpainters.com/blog/professional-advice/why-2-hour-estimate/)).
2. Manual measurement and material maths per room
   ([ContractorTalk, how to price a paint job](https://www.contractortalk.com/threads/how-to-price-a-paint-job.434679/)).
3. Extras negotiated on the doorstep instead of ticked on the quote.

**FieldQuo.** `quotes` (room-by-room wall and ceiling takeoff —
`check:paint-takeoff`) · `add_on_upsell` (ceilings, trim, second coat as ticks)
· `job_photos` · `instant_quotes` · `online_approval` · `material_costs`
(litres from square footage).

### Cabinets (`cabinets`) and Countertops (`countertops`)

**The day.** The sale happens at the kitchen table with samples. Pricing is per
door / per drawer front / per linear foot; the finish and hardware upsells
are the margin. Deposits are large and disputed if the scope is a single number
([Houzz, deposits for cabinet and flooring jobs](https://www.houzz.com/discussions/5296922/initial-deposit-for-cabinet-and-flooring-jobs-how-much-to-expect);
[SlabWise, countertop complaints](https://slabwise.com/guides/what-are-common-homeowner-complaints-about-countertop-installation)).

**FieldQuo — cabinets.** `kitchen_designer` · `price_book` (per door, per
drawer front) · `add_on_upsell` (glaze, soft-close, hardware) ·
`instant_quotes` · `job_photos` · `online_approval`.
**Countertops.** `instant_quotes` · `quotes` (the countertop card: run, sink
cut-out, edge) · `online_approval` · `job_photos` · `card_payments`.

### Flooring (`flooring`) and Tiling (`tiling`)

**The day.** Room measurements and stairs by the step; a showroom-shaped sale
with a site visit to confirm. Upsells (niche, heated floor, edge profile) are
where a tiler's margin is.

**FieldQuo — flooring.** `instant_quotes` · `quotes` (flooring card, stairs by
the step) · `add_on_upsell` · `online_approval` · `materials`.
**Tiling.** `quotes` · `add_on_upsell` · `job_photos` · `online_approval` · `materials`.

### Landscaping (`landscaping`), Snow removal (`snow_removal`), Irrigation (`irrigation`), Gutters (`gutters`)

**The day.** Routes. The same addresses every week (or every storm), a crew
that has to know the run, and a season contract that has to be paid before
the season. Cash flow is the named challenge; recurring commercial contracts
are the named fix ([Wexford Insurance, snow removal economics](https://www.wexfordins.com/post/is-snow-removal-business-profitable);
[Joist, seasonal cash flow](https://www.joist.com/blog/7-tips-for-seasonal-cash-flow-management-for-lawn-care-businesses/);
[ProValet, landscaping challenges](https://www.provalet.io/guides-posts/challenges-in-landscaping-field-service)).

**FieldQuo — landscaping.** `recurring_jobs` · `service_plans` ·
`aerial_measure` (lot outline on the satellite still —
`lib/measure/lotTakeoff.js`) · `instant_quotes` (lawn) · `scheduling` · `crew_shifts`.
**Snow.** `recurring_jobs` · `service_plans` · `scheduling` · `quotes` (the snow
card: driveway size, plan, salting) · `card_payments`. The driveway is *picked*
by size on that card, not traced — the satellite sentence was removed from
this trade after reading `SnowRemovalTakeoff`.
**Irrigation.** `recurring_jobs` (start-up and blow-out) · `service_plans` ·
`booking_page` · `scheduling` · `card_payments`.
**Gutters.** `aerial_measure` (eave feet and downspouts off the Solar model —
`lib/measure/gutterMeasurement.js`) · `instant_quotes` · `booking_page` ·
`recurring_jobs` (autumn clean-out) · `card_payments`.
*Route days* as such are not a shipped row — see Not yet.

### House cleaning (`house_cleaning`), Carpet (`carpet_cleaning`), Window (`window_cleaning`), Pressure washing (`pressure_washing`)

**The day.** Recurring residential visits, rotating staff, small invoices.
Only 38% of cleaning businesses use scheduling software; owners spend 7.4
hours a week scheduling; 41% of households buy on a recurring plan; late
payment is the named frustration ([Jobber, cleaning industry trends](https://www.getjobber.com/academy/cleaning/cleaning-industry-trends/);
[SAS Cleaning Suite, the scheduling crisis](https://sascleaningsuite.com/blogs/the-scheduling-crisis-in-cleaning-businesses-and-the-only-way-to-permanently-fix-it);
[Janitorial Manager, late-paying clients](https://www.janitorialmanager.com/blog/how-to-navigate-late-paying-clients-in-your-cleaning-business/)).

**FieldQuo — house cleaning.** `recurring_jobs` · `checklists` · `booking_page`
· `card_payments` · `crew_shifts`.
**Carpet.** `booking_page` · `booking_deposit` · `recurring_jobs` · `card_payments` · `review_requests`.
**Window.** `booking_page` · `recurring_jobs` · `checklists` · `card_payments` · `review_requests`.
**Pressure washing.** `self_quote` (photo of the driveway) · `booking_page` ·
`recurring_jobs` (spring wash) · `job_photos` · `card_payments` · `review_requests`.
Pressure washing has no instant estimator in the catalogue, so `instant_quotes`
is deliberately absent.

### Junk removal (`junk_removal`), Tree care (`tree_care`), Pest control (`pest_control`), Pools and spas (`pool_spa`)

**The day.** Priced from a photo or a load size; the homeowner wants the number
before anyone drives over ([Arborgold, structuring tree estimates](https://arborgold.com/blog/tree-care-arborist/how-to-structure-tree-service-estimates/);
[Invoice Fly, pest control estimates](https://invoicefly.com/academy/pest-control-estimate/)).
Pest and pool are plan businesses (quarterly treatment, weekly service).

**FieldQuo — junk.** `instant_quotes` (load size) · `self_quote` · `booking_page` · `card_payments` · `job_photos`.
**Tree care.** `self_quote` (photos of the tree and the access) · `quotes` · `job_photos` · `online_approval` · `review_requests`.
**Pest.** `service_plans` · `recurring_jobs` · `booking_page` · `scheduling` · `card_payments` · `clients`.
**Pool/spa.** `service_plans` · `recurring_jobs` · `booking_page` · `scheduling` · `card_payments`.

### Paving (`paving`), Masonry and concrete (`masonry_concrete`), Excavation (`excavation`), Siding (`siding`), Insulation (`insulation`), Fencing (`fencing`)

**The day.** Site measurement is the estimate. Small measurement errors get
expensive at volume; the site visit is the bottleneck ([The Virtual
Estimation, sitework estimating](https://thevirtualestimation.com/blog/Sitework%20Estimating:%20Excavation,%20Grading,%20Utilities%20and%20Paving/);
[MudMixer, estimating concrete](https://mudmixer.com/blogs/news/how-to-estimate-concrete-jobs-more-accurately-and-profitably)).

**FieldQuo — paving.** `aerial_measure` (trace the driveway — `PavingTakeoff`
with `PolygonMeasure`) · `instant_quotes` · `online_approval` · `card_payments` · `job_photos`.
**Masonry/concrete.** `self_quote` · `instant_quotes` (parging) · `quotes` ·
`job_photos` · `online_approval`. No satellite trace: the concrete categories
have no takeoff card, so the sentence was not written.
**Excavation.** `quotes` · `self_quote` · `job_costing` · `materials` · `invoice_send`.
**Siding.** `quotes` (the siding card, elevations minus openings) · `job_photos` · `online_approval` · `material_costs` · `card_payments`.
**Insulation.** `quotes` (the insulation card) · `self_quote` · `online_approval` · `card_payments` · `job_photos`.
**Fencing.** `quotes` · `self_quote` · `online_approval` · `materials` · `job_photos`.

### Carpentry (`carpentry`), Drywall (`drywall`), Demolition (`demolition`), Handyman (`handyman`)

**The day.** Small, varied jobs; the list is the product. Priced by the hour
or the half day.

**FieldQuo.** `quotes` · `self_quote` · `online_approval` / `scheduling` ·
`job_photos` · `card_payments` (handyman: `booking_page` first, `price_book`
for the hourly and half-day lines; demolition: `job_costing`).

### Damage restoration (`restoration`)

**The day.** Emergency calls at any hour; the insurance adjuster reads the
photos; a ZIP of two hundred unfiled photos is the named friction
([CompanyCam, claim documentation](https://companycam.com/resources/blog/photo-documentation-that-gets-insurance-claims-approved-faster);
[Scan Manifold, water damage documentation](https://www.scanmanifold.com/blog-posts/water-damage-documentation-restoration-contractors)).

**FieldQuo.** `job_photos` (filed against the job, on the invoice) ·
`voice_receptionist` · `scheduling` · `invoice_changes` · `checklists`.
The *photo report* as a document exists (`check:photo-report`) but has no
matrix row — Not yet.

### Remodelling (`remodeling`) and General contracting (`general_contracting`)

**The day.** Multi-week jobs, six to eight trades, allowances and change
orders; 44% of 2025 renovators wanted better schedule tracking, 35% clearer
communication, 26% more cost transparency ([Buildertrend, 2026 construction
statistics](https://buildertrend.com/blog/2026-construction-statistics-and-trends/);
[NAHB, builders' top concerns](https://www.nahb.org/blog/2026/02/builders-top-concerns-2026)).
Signed change orders "every time" is the named best practice
([Acorn Finance, the remodeling market](https://www.acornfinance.com/contractor-resources/remodeling-market-slowing-contractors/)).

**FieldQuo — remodelling.** `job_costing` · `work_areas` · `invoice_changes`
(the amended invoice keeps its history) · `subcontractor_bids` · `quotes` · `contract_terms`.
**GC.** `job_costing` · `subcontractor_bids` · `work_areas` · `invoice_changes` · `contract_terms` · `crew_shifts`.
*Change orders*, *payment schedules* and *job documents* — see Not yet.

---

## Not yet — real pains with no shipped answer to pitch

These stay here. A rep who says one of them is selling a control that does not
work, in words.

| Trade(s) | The pain | Where it stands | What it would take |
|---|---|---|---|
| Roofing, HVAC, remodelling — any big ticket | Pay-over-time on the estimate | `financing` is **partial**: Affirm is offered at Stripe checkout, the lender decides, and the monthly figure on a quote appears only if the contractor types a rate and term | A matrix row can go `shipped` when FieldQuo shows a monthly figure it stands behind; until then the rep may say "card and Affirm at checkout through Stripe" only if asked, never as a selling point |
| GC, remodelling, electrical (mid-job extras) | Change orders as a signed document | Built (`check:change-order-money`) but **no feature-matrix row**, so no pitch may cite it | Add a `change_orders` row with proof paths and a feature page — the matrix's rule is name it after it is on a page |
| GC, remodelling | Payment schedules / milestone billing | Not a matrix row; deposits exist on quotes and `booking_deposit` on visits | Product decision: milestone invoices off the quote |
| GC, remodelling, restoration | Job documents (permits, drawings, the adjuster's letter) filed on the job | Built (`check:job-documents-autofile`), **no matrix row** | Add a row + page |
| HVAC, appliance, plumbing | Installed-equipment records (model, serial, warranty end) and warranty reminders | Built (`check:installed-equipment`), **no matrix row**; warranty reminders do not exist | Add a row + page; reminders are new work |
| Restoration, roofing, painting | A photo *report* the homeowner or adjuster receives as one document | Built (`check:photo-report`), **no matrix row** | Add a row + page |
| Landscaping, snow, cleaning | Route days — the crew's run ordered by drive time | `door_hanger_routes` is **partial** and is about flyers, not service routes; `recurring_jobs` + `scheduling` put the work on the day but do not order the stops | New work |
| Snow removal | The driveway traced on the satellite still | The snow card picks a size band; only paving and the lot trades trace | Extend `PolygonMeasure` to the snow card |
| Masonry, concrete, excavation | Measure the pad or the dig from the sky | No takeoff card for those categories | New card |
| Every trade | Appointment reminders by email, editable wording | `appointment_reminders` is **partial** (SMS only, wording fixed) — not pitched | Finish the row |
| Every trade | Good/better/best on one quote | `priced_options` is **partial** (API only, no screen) — not pitched | Build the screen |

## Where each surface reads the list

| Surface | Read | Language |
|---|---|---|
| Rules playbook, every fit stage | `{tradePitch}` → `tradePitchClause(prospect.tradeKey)` at render (`lib/sales/playbook/script.js`) | English, like every rules line |
| Call screen, under the AI script and with no script | `app/components/sales/TradePoints.js` | the script's language |
| Queue → Research → "What to pitch" | same component, under the evidence-cited recommendations, labelled as not evidence | the rep's language, English fallback named |
| AI call-script prompt | `callScriptInputs().tradePoints` → "WHAT WE DO FOR THEIR TRADE"; the pitch is told to lead with the first | the script's language; in the hash, so stored scripts regenerate on next open |
| Intro email | numbered three between the gap paragraph and the eight points | the email's language |
| Demo card (`/sales/demo`) | `pitchTrade` on each preset → "What to show them" | the rep's language |
| `/industries/[slug]` | `tradeKey` on `app/data/industries.js` → "Built for {trade} businesses" | visitor's language for EN/FR/ES, English with a note otherwise |
