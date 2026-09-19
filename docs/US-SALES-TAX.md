# US sales tax on quotes and invoices

A company anywhere — Canada included — quoting a US address charges that
address's sales tax automatically, the way Canada is automated by province,
and the tax lives on the document so it holds when the client pays by cash,
e-transfer, cheque or wire. Nothing here touches Stripe Checkout.

## The rule (owner, 2026-09-19)

> "The contractor can charge the tax, I'm not here to police them — they
> are responsible for what they charge. If they charge the full tax then
> the system should allow them to, by default — just like how we quote in
> Canada right now."

So the US rung applies the **full combined rate to the whole quote**,
exactly as a Canadian province's rate is applied. The state's own rule
about contractor work (`lib/tax/usTaxability.js`) is a **hint beside the
rate**, never a stated zero, never a share, never a fixed excise applied
on the contractor's behalf. Switching tax off on a quote is one press and
the contractor's call. An earlier version of this work zeroed the rate in
the states that do not tax construction; documents stored under it
(`taxResolution.source === "us_exempt"`) keep printing what they said.

## What happens on a quote

1. The client's country is `US` and their state is known. The ZIP comes from
   `Client.postalCode`, or from the end of the address line for older rows.
2. **The rate.** `UsSalesTaxRate` is read by ZIP (`lib/tax/usRates.js`
   attaches the row to the client object; the resolver itself is pure and
   also runs in the browser). No row → a state with no local sales tax
   answers with its state rate; any other state answers with the state
   floor **and the sentence "state rate only; county and city not known"**.
   A date before the table → unknown → the company default.
3. **The hint.** `lib/tax/usTaxability.js` names the case in which the
   state's own rule leaves the customer untaxed — the generic rule in the
   31 "exempt" states + DC (the contractor pays tax on materials at
   purchase, labour on real property is not taxed), the untaxed kind of job
   in the 16 "depends" states (a capital improvement in NY/NJ/NC/WV,
   residential work in TX/KS/MS, building work in OH/WI/PA/MN/KY/AR, other
   residential work in CT, MRRA in AZ, new construction in IA), South
   Dakota's excise; nothing in WA, HI, NM. The builder prints it as
   "Note: … — switch tax off on this quote if that applies to you; what you
   charge is your call."
4. **Precedence** (`lib/tax/resolveTaxRate.js`): a rate typed on the quote →
   a company `TaxRate` named after the state ("Texas", "NY") →
   `Company.usTaxOverrides[state]` (Settings → Tax: "charge this rate" /
   "collect nothing" — the latter is the one stated zero the US rung still
   produces, because the company said it) → the tables → the company
   default. Automation only ever adds a rate where nobody typed one.
5. **The record.** What the line said — rate, ZIP, split, the rates-table
   month — is stored on `Quote.taxResolution` (`lib/tax/taxResolution.js`)
   and copied verbatim to any invoice raised from the quote. The PDF, the
   email, the public quote page and the portal print their sentence from
   the record, never from today's table (non-negotiable #6). A rate a human
   typed is recorded as `manual` and prints no sentence.

Builder sentence examples (English; nine languages in `app.tax.us.*`):

> 8.875% New York sales tax (ZIP 10001: state 4% + local 4.875%), on the
> whole quote. Rates table: September 2026. Note: a capital improvement is
> not taxed in New York; you pay tax on materials when you buy them —
> switch tax off on this quote if that applies to you; what you charge is
> your call.

> 6.25% Texas sales tax — state rate only; county and city rates for this
> address are not known, on the whole quote. Note: residential work is not
> taxed to the customer in Texas; you pay tax on materials when you buy
> them — switch tax off on this quote if that applies to you; what you
> charge is your call.

> 8% Ohio sales tax (ZIP 43215: state 5.75% + local 2.25%), on the whole
> quote. Rates table: September 2026. Note: the contractor pays tax on
> materials at purchase and construction on real property is not taxed in
> Ohio — switch tax off on this quote if that applies to you; what you
> charge is your call.

> 10.55% Washington sales tax (ZIP 98101: state 6.5% + local 4.05%), on
> the whole quote. Rates table: September 2026.

Document sentence (eight document languages, `lib/i18n/documentLabels.js`;
the hint is the estimator's and never reaches the homeowner):

> New York sales tax at 8.875% (ZIP 10001). Rates as of September 2026.

## Where the ZIP rates come from

There is no free, login-free, machine-readable table of combined rates by
ZIP for all fifty states. Avalara's monthly tables are behind an e-mail
form; Texas keys its downloads to a login; New York and California publish
jurisdiction lists, not ZIP lists. What is published openly:

| Source | States | Format | Refresh |
|---|---|---|---|
| Streamlined Sales Tax rate + boundary files — https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and `…/Boundary/` (each state's own file, dated in the name, e.g. `OHR2026Q4SEP17.csv`) | AR GA IA IN KS KY MI MN NC ND NE NJ NV OH OK RI SD TN UT VT WA WI WV WY | CSV / zip, SST Technology Guide ch. 5 layout (read from the files; see `lib/tax/usRatesLoad.js`) | quarterly with mid-quarter corrections |
| Census 2020 ZCTA→county relationship file + Pennsylvania DOR's two county surcharges | PA | pipe-delimited | annual / static |
| No local sales tax — state rate is the rate (`localTax: "none"` in `lib/tax/jurisdictions.js`) | CT DC DE HI IN KY ME MD MA MI MT NH NJ OR RI | — | — |

Everything else (TX, CA, NY, FL, IL, CO, AZ, AL, LA, MO, NM, SC, VA, AK,
ID, MS) falls back to the state floor with the sentence saying so, and the
estimator can type the address's full rate on the quote.

A ZIP is not a jurisdiction. Where a ZIP's +4 ranges fall in different
districts the row stores the **lowest** rate (the one the Streamlined
agreement assigns to a five-digit lookup), the highest in `maxRate`, and
`zipSpansRates`; the document says "addresses in this ZIP may pay up to
7.9%".

## Loading the table — monthly, from the owner's Mac

```
npm run us-tax:load                     # fetch every source, upsert into DATABASE_URL
npm run us-tax:load -- --dry-run        # fetch and count, write nothing
npm run us-tax:load -- --states OH,WA   # only these (PA = the Census adapter)
npm run us-tax:load -- --cache /tmp/ustax
```

Not a cron route: the boundary files are 300–400 MB each and a full run
pulls a few gigabytes, past what a Vercel function may hold; there is no
login anywhere in the path, so a laptop does it in a few minutes. First
week of the month, after the states' quarter-boundary updates. The script
upserts by ZIP and never deletes; every row carries `source`, `sourceKind`,
`effectiveFrom` and `fetchedAt`. Settings → Tax shows the month, the state
count and the row count from `usRatesTableStatus()`.

First load, 2026-09-19: 25,337 rows across 25 states (24 SST + PA).

## Settings → Tax

Shown to a company in the US, a company with a US client on file, or one
that has already saved an override. One paragraph on the automatic
behaviour, the rates-table month, and per-state overrides: "charge this
rate" (a contractor-retailer, a separated-contract seller, an accountant's
number) or "collect nothing" (no nexus; pays at the counter). Stored on
`Company.usTaxOverrides` through `lib/tax/usOverrides.js`.

## Checks

`npm run check:us-tax` — ZIP hit, ZIP miss → state fallback sentence, the
full rate on the whole quote for NY/TX/CA/OH/AZ/SD with the right hint
beside it, the sentences in nine languages, a Canadian company quoting a
US address, override precedence, unknown → status not zero, older stated-
zero records still printing, invoice inheritance, and the loader composing
the same rows twice from a fixture. `check:tax-jurisdictions`,
`check:tax-send` and `check:tax-id` cover the rest of the tax library.
