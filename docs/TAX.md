# Tax on quotes and invoices

How the rate on a document is chosen, in the order it is chosen, and where
each piece lives. `docs/US-SALES-TAX.md` is the US rung in detail; this is
the whole ladder.

## The rule (owner, 2026-09-21)

On a new quote for a client in Ottawa, ON, the builder opened on
"Subtotal $0.00 · Tax: Not worked out · No tax rate is known for Ottawa, ON
yet — enter the rate, or switch tax off for this quote."

> "That should not be true — taxes should be automatically set based on the
> province / state."

Two things were wrong. `lib/tax/resolveTaxRate.js` opened with
`if (!company.autoApplyLocalTax) return fallback;`, so the published table
was only consulted for a company that had opted in, and the fallback was
`Company.taxRate`, a column the settings screen never exposed and which is
0 for every real company. And the builder printed "not worked out" whenever
the tax AMOUNT was $0 — which on an empty quote it always is, at any rate.

Both are gone. The rate is worked out automatically from the job's province
or state for every company unless the company switches to manual, and the
screens key "not worked out" on the RATE being unknown, never on the amount.

## Which place is taxed — the place of supply

Services on real property are taxed where the property is (CRA place-of-
supply rules, Excise Tax Act Schedule IX Part IV; every US state with a
sales tax sources to the destination). So the province the ladder is asked
about comes from, in order (`lib/tax/documentTax.js` `placeOfSupply`):

| Source | Read from | The line says |
|---|---|---|
| `site` | `Quote.siteAddress`, parsed by `lib/tax/addressRegion.js` | "From the job address" |
| `client` | `Client.province` + `Client.country` in any spelling ("Ontario", "Canada") | "From the client's address" |
| `client_address` | `Client.address`, parsed, when the columns are empty (the 55 legacy rows) | "From the client's address line" |
| `company` | the company's own address — a guess, tagged `assumed` | "Assumed from your own address …" |

A province code with no country is accepted only when the code settles the
country ("ON" is Ontario, "TX" is Texas — the two tables do not overlap)
AND it is on the company's own side of the border. A Texas company's client
carrying "ON" with no country stays unknown rather than getting Canadian
HST; a postal code or the country's name on the line is enough to cross.

`lib/tax/addressRegion.js` reads a province or state out of one line of
address text: full names in English, French and Spanish; two-letter codes
only in upper case as their own token ("on the road" is not Ontario); a
Canadian postal code or a five-digit ZIP settles the country; the country's
name at the end does the same. Anything else returns nulls and the ladder
falls to the next source.

## The ladder (`lib/tax/resolveTaxRate.js`)

Given that place, and the company's mode:

1. **A company TaxRate whose name matches the province** ("HST Ontario",
   "GST + QST (QC)", "Texas sales tax") — that rate wins, whatever the
   table says. Word-boundary matched; codes only in upper case.
   *`manual` mode stops here and takes step 4.*
2. **`Company.usTaxOverrides`** — US only: the company's own word for that
   state, a typed rate or "we collect nothing there".
3. **`lib/tax/jurisdictions.js`** — the published rate. Canada by province
   (CRA rates with sources and effective dates; GST 5% everywhere, HST
   13–15% in the participating provinces, GST + QST 14.975% in Quebec, GST
   + PST/RST in BC/MB/SK with a real-property caution in BC/MB); the EU
   only when the company has said it is VAT registered; the United States
   by ZIP from the states' own files, by state where the state has no local
   tax, and by the state floor with a sentence saying so otherwise. The US
   full combined rate goes on the whole quote (owner, 2026-09-19) and the
   state's own rule rides beside it as a hint.
4. **The company's default** — the TaxRate row flagged default, else
   `Company.taxRate` (`lib/tax/taxMode.js` `companyDefaultRate`).
5. **Nothing** — rate 0 with an `unknown_*` source, which every screen
   prints as "Not worked out", never as $0.00, and which the send gate
   refuses.

## The mode (`Company.taxMode`, `lib/tax/taxMode.js`)

| Value | Meaning |
|---|---|
| `auto` | the ladder above. **Default.** |
| `manual` | steps 1 and 4 only: the company's own rows and default, never the table. |
| `null` | never chosen — read as `manual` when `autoApplyLocalTax` is false, else `auto`. |

**Migration rule.** The column is nullable with no database default. Every
production row on 2026-09-21 had `autoApplyLocalTax = true` (the old
column's default), so every existing company reads as `auto` — the ladder
it was already on — and nothing any company typed changes: its own named
rates still win over the table, and its default still applies where the
table has no answer. Only a company that had switched `autoApplyLocalTax`
off becomes `manual`, which is the choice it made. New rows get `auto`.
Settings → Tax writes `taxMode` and keeps `autoApplyLocalTax` in step with
it (`app/api/settings/business-info/route.js`); after that the derivation is
never consulted for that company.

The column was added with `prisma db execute` (CREATE TYPE + ADD COLUMN)
because the schema diff on the day carried another agent's DROPs.

## What the screens say

`lib/tax/taxLine.js` turns a live resolution or a stored record into words:

- **Headline:** "HST 13% (Ontario)", "GST 5% + QST 9.975% (Quebec)" — HST's
  federal and provincial parts collapsed into the one figure the homeowner
  sees; "TVH 13 % (Ontario)" / "TPS 5 % + TVQ 9,975 % (Québec)" in French;
  "Texas sales tax 8.25%"; "HST Ontario 13%" for a company's own row;
  "Default rate 12%"; "13%" for a typed rate.
- **Source:** the place-of-supply row above, or "Your default rate — the
  province is not known", or "Typed on this quote".
- **Resolved?** a rate above zero, or a stated zero (`us_company_none`,
  `vat_not_registered`). The builder shows the headline with a **Change**
  link that unfolds the existing rate box and tax switch; an unresolved line
  opens on the box.
- **Unresolved hint:** what to ADD — "Add the client's province, or a job
  address, and the rate is worked out automatically…" — never "no rate is
  known" when the missing thing is a province. The old "No tax rate is
  known for {place} yet" stays for a place we hold no table for.

Surfaces: the quote builder (`QuoteTotalsBar`), the new-invoice page, the
quote and invoice detail pages (headline + source under the tax row, read
from `taxResolution` so a sent document explains itself from its record),
Settings → Tax (the mode, a preview of the company's own province through
the same resolver, the rates list worded per mode, the US per-state card),
the platform company page (the effective mode), and the send-refusal modal
(`TaxUnresolvedModal`), which now says "the rate works out to 13% — open the
document and re-save it" when the address is fine and the document merely
carries $0.

`Quote.taxResolution` gained `placeSource` and `components` so the record
carries the words as well as the number (`lib/tax/taxResolution.js`).

## Checks

`npm run check:tax-auto` executes the parser, the record reader, the mode,
the ladder on the owner's cases (Ottawa ON → 13% from the client's
province; QC → GST 5% + QST 9.975%; AB → 5%; job in NS over a client in ON
→ NS 14% from the job address; a Gatineau client with only an address line
→ 14.975%, not assumed Ontario; a US TX company and client → the combined
rate with the hint; no address anywhere → unresolved with the "add the
province" hint; an existing company that opted out with a typed 12% stays
12% manual; a new company gets auto), the statement keyed on the rate, the
stored record, all 30 new strings in nine languages with their
placeholders, and that every route and screen reads what was written.
`check:tax-jurisdictions`, `check:us-tax`, `check:tax-send` and
`check:quote-builder` cover the rest.
