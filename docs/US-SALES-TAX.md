# US sales tax on quotes and invoices

Owner's decision (2026-09-19): a company anywhere — Canada included — quoting
a US address charges that address's sales tax automatically, the way Canada
is automated by province, and the tax lives on the document so it holds when
the client pays by cash, e-transfer, cheque or wire. Nothing here touches
Stripe Checkout.

## What happens on a quote

1. The client's country is `US` and their state is known. The ZIP comes from
   `Client.postalCode`, or from the end of the address line for older rows.
2. **The rate.** `UsSalesTaxRate` is read by ZIP (`lib/tax/usRates.js`
   attaches the row to the client object; the resolver itself is pure and
   also runs in the browser). No row → a state with no local sales tax
   answers with its state rate; any other state answers with the state
   floor **and the sentence "state rate only; county and city not known"**.
   A date before the table → unknown → the company default.
3. **Taxability.** `lib/tax/usTaxability.js` says whether that state puts
   sales tax on a contractor's lump-sum contract at all:
   - 31 states + DC: **exempt** — the contractor pays tax on materials at
     purchase, labour on real property is not taxed, the document carries a
     *stated* zero with the reason.
   - 4 states: **taxable** — WA and HI and NM on the whole contract, SD at
     its fixed 2% contractor's excise.
   - 16 states: **depends** — the builder asks one question in one tap
     (capital improvement vs repair in NY/NJ/NC/WV, residential vs
     commercial in TX/KS/MS, building vs landscaping in OH/WI/PA/MN/KY/AR,
     CT's listed residential services, AZ's modification vs MRRA, IA's
     construction vs repair). The state's stated default applies until
     tapped, and every surface prints "Assumed: … — tap to change".
4. **Precedence** (`lib/tax/resolveTaxRate.js`): a rate typed on the quote →
   a company `TaxRate` named after the state ("Texas", "NY") →
   `Company.usTaxOverrides[state]` (Settings → Tax) → the tables → the
   company default. Automation only ever adds a rate where nobody typed one.
5. **The record.** What the line said — rate, ZIP, split, what it applied
   to, the answer, the rates-table month — is stored on
   `Quote.taxResolution` (`lib/tax/taxResolution.js`) and copied verbatim to
   any invoice raised from the quote. The PDF, the email, the public quote
   page and the portal print their sentence from the record, never from
   today's table (non-negotiable #6). A rate a human typed is recorded as
   `manual` and prints no sentence.

Builder sentence examples (English; nine languages in `app.tax.us.*`):

> 8.875% New York sales tax (ZIP 10001: state 4% + local 4.875%), on the
> whole quote — repair, maintenance and installation work is taxable in New
> York. Rates table: September 2026. Assumed: Repair, maintenance or
> installation — tap to change.

> No Texas sales tax on this quote — residential work is not taxed to the
> customer in Texas; you pay tax on materials when you buy them. If this job
> were taxable: 6.25% Texas sales tax — state rate only; county and city
> rates for this address are not known.

Document sentence (eight document languages, `lib/i18n/documentLabels.js`):

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
ID, MS) falls back to the state floor with the sentence saying so. In most
of those states a lump-sum real-property contract charges the homeowner
nothing, so the local rate never reaches the document; where it does (TX
commercial remodel, NY repair, NM, AZ modification) the estimator sees the
caution and can type the address's full rate.

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

`npm run check:us-tax` — ZIP hit, ZIP miss → state fallback sentence,
taxability per sample state (NY, TX, CA, FL, WA), the split and the
sentence, a Canadian company quoting a US address, override precedence,
unknown → status not zero, invoice inheritance, and the loader composing
the same rows twice from a fixture. `check:tax-jurisdictions`,
`check:tax-send` and `check:tax-id` cover the rest of the tax library.
