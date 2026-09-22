// lib/tax/documentTax.js
//
// The tax picture for ONE document: is a figure owed, is none owed, or does
// nobody know yet — and if a rate was used, whose jurisdiction it came from.
//
// ── Why this sits on top of resolveTaxRate rather than inside it ────────────
//
// lib/tax/resolveTaxRate.js answers a narrow question correctly: given a
// client, what rate can be stood behind? Its refusal to invent one is the
// whole safety argument of that file and nothing here weakens it — it is
// called unmodified, and every rate below still comes out of it.
//
// What this file adds is the two things a resolver has no business deciding:
//
//   1. WHERE the jurisdiction is read from — the place of supply. Services
//      on real property are taxed where the property is, so the document's
//      own job address (Quote.siteAddress) answers first, then the client's
//      record, then the company's address (placeOfSupply() below). The
//      resolver reads `client.province` and `client.country`; production
//      had 55 client rows and ZERO with a country, because six of the seven
//      address-autocomplete consumers threw the structured components away
//      (fixed — see scripts/check-address-fields.mjs, which now stops it
//      recurring), and those rows' address LINES are now read too. So the
//      resolver was being handed an empty client and correctly saying "I
//      don't know", forever.
//
//   2. What to do with "I don't know". The owner's instruction is to fall back
//      to the company's OWN province rather than to nothing. That is a real
//      improvement on 0% and it is also a guess, so it is tagged `assumed` and
//      every surface that shows it has to say so. It is never silent.
//
// ── Why the assumption is dangerous enough to label ─────────────────────────
//
// The owner's company is in Ottawa, Ontario. His client "Emilio Boves" is at
// 755 Rue Saint-Louis, Gatineau — across the river, Quebec, 14.975%, not 13%.
// Assuming the company's province on that job undercharges it AND remits to
// the wrong authority. Ottawa/Gatineau contractors cross that line every week,
// and so do Vancouver/Surrey, Lloydminster and every other border town.
//
// So an assumed rate is a starting point for a human, not an answer:
//   - it is labelled as an assumption on the builder, the document and the PDF,
//     naming the province it assumed;
//   - it is overridable per quote without editing the client (QuoteBuilder's
//     `taxRateTouched` guard already protects a hand-typed rate from being
//     re-resolved when the client changes);
//   - and it never fires when the client's own record CAN answer.
//
// ── The three statements a tax line can make ────────────────────────────────
//
// A money row saying "$0.00" is a statement: "tax was considered and came to
// nothing". Q-2026-0011 made that statement on $5,250 of Ontario work with
// taxEnabled true — $682.50 of HST the contractor eats or has to go back for.
// Absence of a statement is not a statement (AGENTS.md), so `taxStatement`
// separates them and no surface may render `unresolved` as a figure:
//
//   charged     a rate applied, an amount is owed        → the money row
//   off         the sender switched tax off              → "No tax"
//   none        nobody is owed any — a stated position   → "No tax" + the reason
//   unresolved  tax is on, nothing is charged, and no
//               jurisdiction anywhere explains why       → NEVER "$0.00"
//
// `unresolved` is also the send-time stop. See app/api/quotes/[id]/send.

import { resolveTaxRate } from "@/lib/tax/resolveTaxRate";
import { isVatJurisdiction, normaliseCountry } from "@/lib/tax/jurisdictions";
import { readTaxResolution, resolutionStatesZero } from "@/lib/tax/taxResolution";
import { regionFromAddressText, regionFromClientRecord } from "@/lib/tax/addressRegion";

const num = (v) => Number(v ?? 0);

/** Does this client's own record identify a jurisdiction the resolver can use? */
export function clientJurisdictionKnown(client, company = null) {
  // The columns in any spelling ("Canada", "Ontario"), a province whose code
  // settles the country on its own — on the company's side of the border —
  // or the address line. See lib/tax/addressRegion.js for what is and is
  // not read.
  return Boolean(regionFromClientRecord(client, { companyCountry: company?.country || null }).country);
}

/**
 * ── Place of supply ─────────────────────────────────────────────────────────
 *
 * Services on real property are taxed where the PROPERTY is: CRA's
 * place-of-supply rules (Excise Tax Act, Schedule IX, Part IV) and every US
 * state's destination sourcing say the same thing. So the province the
 * ladder is asked about comes from, in order:
 *
 *   site     the document's own job address (Quote.siteAddress), parsed —
 *            a Gatineau job for an Ottawa client is Quebec's 14.975%
 *   client   the client record: its province and country columns, or its
 *            address line when the columns are empty (the 55 legacy rows)
 *   company  the company's own address — a guess, tagged `assumed`, and
 *            every surface that shows it says so
 *
 * The result says which one answered (`place.source`) so the screen can
 * print "from the job address" rather than a bare number.
 *
 * @returns {{ source: "site"|"client"|"client_address"|"company"|null,
 *            country, region, postalCode, client }}
 *          `client` is the { province, country, postalCode, usTaxRate,
 *          name } shape the resolver reads for that place.
 */
export function placeOfSupply({ siteAddress, client, company } = {}) {
  const site = regionFromAddressText(siteAddress);
  const home = normaliseCountry(company?.country);
  // A job address whose country rests on the region code alone ("Ottawa,
  // ON") is trusted on the company's own side of the border; across it, a
  // postal code or the country's name has to be on the line.
  const siteTrusted = site.region && (site.countryEvidence !== "code" || !home || home === site.country);
  if (site.country && site.region && siteTrusted) {
    // The client's ZIP row rides along only when the site is that same ZIP;
    // a job across town is a different rate row, and the state floor with
    // its caution is the honest figure until the loader knows the site's ZIP.
    const sameZip = client?.usTaxRate && site.postalCode && String(client.usTaxRate.zip) === String(site.postalCode);
    return {
      source: "site",
      country: site.country,
      region: site.region,
      postalCode: site.postalCode,
      client: {
        name: client?.name || "",
        province: site.region,
        country: site.country,
        postalCode: site.postalCode,
        usTaxRate: sameZip ? client.usTaxRate : null,
      },
    };
  }

  const own = regionFromClientRecord(client, { companyCountry: company?.country || null });
  if (own.country) {
    return {
      source: own.from === "address" ? "client_address" : "client",
      country: own.country,
      region: own.region,
      postalCode: own.postalCode || client?.postalCode || null,
      client: {
        ...(client || {}),
        province: own.region,
        country: own.country,
        // Keep the attached ZIP row only when it is for this client's own
        // ZIP — which it always is when lib/tax/usRates.js attached it.
        usTaxRate: client?.usTaxRate || null,
      },
    };
  }

  const companyCountry = normaliseCountry(company?.country);
  if (companyCountry) {
    return {
      source: "company",
      country: companyCountry,
      region: company?.province || null,
      postalCode: null,
      client: { name: client?.name || "", province: company?.province || null, country: companyCountry, usTaxRate: null },
    };
  }
  return { source: null, country: null, region: null, postalCode: null, client: null };
}

/**
 * The rate for this document, and where it came from.
 *
 * @param siteAddress  the document's job address, when it has one
 * @returns the resolveTaxRate result plus:
 *   place         see placeOfSupply(): which address answered, and the
 *                 province and country it named
 *   basis         "site" | "client" | "client_address" | "company_assumed" | "none"
 *   assumed       true when the rate came from the COMPANY's province because
 *                 neither the job address nor the client's record could
 *                 answer. Surfaces must say so.
 *   assumedRegion the human name of the province that was assumed, for the
 *                 sentence that says so. Null when nothing was assumed.
 */
export function resolveDocumentTax({
  company: companyArg,
  taxRates,
  client,
  siteAddress = null,
  workType = null,
  asOf = new Date(),
  lang = "en",
} = {}) {
  const company = companyArg || {};
  const args = { company, taxRates, workType, asOf, lang };
  const place = placeOfSupply({ siteAddress, client, company });

  if (place.source && place.source !== "company") {
    return {
      ...resolveTaxRate({ ...args, client: place.client }),
      place: { source: place.source, country: place.country, region: place.region, postalCode: place.postalCode },
      basis: place.source,
      assumed: false,
      assumedRegion: null,
    };
  }

  // ── The assumption ────────────────────────────────────────────────────────
  //
  // Only reached when neither the job address nor the client's record can
  // answer. The company's own address stands in — which is right far more
  // often than it is wrong, and wrong often enough to label: the owner's
  // company is in Ottawa and his client across the river in Gatineau owes
  // Quebec's 14.975%, not Ontario's 13%.
  const result = resolveTaxRate({ ...args, client: place.client || { province: null, country: null } });

  // The assumption only counts as one if it actually decided the number. When
  // it falls through to the company's flat default, nothing was assumed — that
  // rate was always going to apply — and claiming otherwise puts a warning on
  // a screen that has nothing to warn about.
  const assumed =
    result.source === "client_province" ||
    result.source === "jurisdiction_ca" ||
    result.source === "jurisdiction_vat" ||
    // The US rung: Texas's rate assumed from the company's own Texas
    // address is still an assumption about where the client is, and a
    // Louisiana client owes something else. us_exempt is no longer
    // produced; kept for the records that carry it.
    result.source === "jurisdiction_us" ||
    result.source === "us_exempt" ||
    result.source === "us_company_override" ||
    result.source === "us_company_none";

  return {
    ...result,
    place: assumed
      ? { source: "company", country: place.country, region: place.region, postalCode: null }
      : { source: null, country: null, region: null, postalCode: null },
    basis: assumed ? "company_assumed" : "none",
    assumed,
    assumedRegion: assumed ? result.label || result.detail?.label || null : null,
  };
}

/**
 * Has this company stated that it charges no tax, as opposed to simply never
 * having entered a rate?
 *
 * The distinction is the whole of AGENTS.md rule 5. `vatRegistered === false`
 * is a company answering a direct question and is a statement. `taxRate: 0` is
 * a column nobody has typed into — every one of the 29 companies in production
 * has it, including the ones that certainly do charge HST — and treating that
 * as "we charge no tax" is what let Q-2026-0011 out of the building.
 */
export function companyStatesNoTax(company) {
  return (
    company?.vatRegistered === false && isVatJurisdiction(company?.country)
  );
}

/**
 * What this document's tax line actually says.
 *
 * @param taxEnabled  the document's "apply tax" flag. Undefined is read as
 *                    true, matching the Quote/Invoice column default — a
 *                    caller that hasn't loaded the field must not accidentally
 *                    assert "the sender switched tax off".
 * @param tax         the stored money AMOUNT, never a rate.
 * @param stored      the document's own Quote/Invoice.taxResolution — what
 *                    the line said when it was written. When present it is
 *                    the record the document explains itself from, and the
 *                    live rows are not consulted for the sentence; a stated
 *                    zero in it ("no Texas sales tax on this work") is a
 *                    "none", not an "unresolved", however the company's
 *                    settings look today.
 * @param company,taxRates,client   context for a LIVE resolution. All
 *                    optional: without them a zero tax line still refuses to
 *                    render as a settled $0.00, it just cannot name a reason.
 *
 * @returns { kind, amount, resolution, stored, assumed, assumedRegion }
 */
export function taxStatement({
  taxEnabled,
  tax,
  stored = null,
  company = null,
  taxRates = null,
  client = null,
  siteAddress = null,
  // subtotal − discount, when the caller knows it. A document with nothing
  // on it yet has a tax of $0 at ANY rate; that is a figure, not an
  // unresolved blank, and the builder's empty first screen used to say
  // "not worked out" over a perfectly good 13% (owner, 2026-09-21).
  taxableBase = null,
  workType = null,
  asOf = new Date(),
  lang = "en",
} = {}) {
  const amount = num(tax);
  const record = readTaxResolution(stored);
  const resolution = company
    ? resolveDocumentTax({ company, taxRates, client, siteAddress, workType, asOf, lang })
    : null;

  const base = {
    amount,
    resolution,
    stored: record,
    // The record wins over a live guess: what the document said is what it
    // says.
    assumed: record ? Boolean(record.assumed) : Boolean(resolution?.assumed),
    assumedRegion: record ? record.assumedRegion || null : resolution?.assumedRegion || null,
  };

  // A figure was charged. Nothing below can contradict a number already on a
  // document — this file explains tax lines, it never re-prices one.
  if (amount !== 0) return { ...base, kind: "charged" };

  // The sender turned it off. An explicit act, and the one honest way to send
  // a zero-tax document.
  if (taxEnabled === false) return { ...base, kind: "off" };

  // Nothing to tax yet, and a rate that is known: 13% of $0 is $0, charged.
  // Only when the caller has said the base is empty — a caller that does
  // not know it must not turn a blank into a figure.
  const knownRate = record ? num(record.rate) > 0 && record.source !== "manual" : num(resolution?.rate) > 0;
  if (taxableBase != null && num(taxableBase) <= 0 && knownRate) return { ...base, kind: "charged" };

  // The document recorded a stated zero when it was written.
  if (resolutionStatesZero(record)) return { ...base, kind: "none" };

  // The company has said it charges none. A different sentence, as it should
  // be — "we're below the VAT threshold" is not "nobody has worked this out".
  if (companyStatesNoTax(company)) return { ...base, kind: "none" };

  // A jurisdiction we can stand behind that genuinely levies nothing: below
  // the VAT threshold, a US state that does not tax the contract, a US state
  // the company has said it collects nothing in.
  if (resolutionStatesZero(resolution)) return { ...base, kind: "none" };

  // Tax is on, nothing is charged, and nothing anywhere explains it.
  return { ...base, kind: "unresolved" };
}

/**
 * The 409 payload for a send that must not go out, or null when it may.
 *
 * ── Hard refusal, not confirm-anyway ────────────────────────────────────────
 *
 * A confirmation dialog on the way to a stranger's inbox is a button people
 * learn to click. This is the last moment a number is still a draft; one
 * keystroke later it is a price a homeowner has been quoted and there is no
 * unsend. The two other money gates on this route — needsReview and the
 * empty-section gate — are both hard 409s for the same reason, and a third
 * one behaving differently would be the surprise.
 *
 * It is only defensible because it is never a dead end: the payload carries
 * both ways out, and both are one action.
 */
export function taxSendRefusal(statement, { client } = {}) {
  if (statement?.kind !== "unresolved") return null;

  const name = client?.name || "this client";
  const missing = [];
  const known = regionFromClientRecord(client);
  if (!known.country) missing.push("country");
  if (!known.region) missing.push("province");

  // The address is fine and a rate IS known — the document simply carries
  // $0 of tax against it (saved before the rate was worked out, or with 0
  // typed over it). Nothing to add to the client; the fix is to save the
  // document again with tax on, or to send it with tax off. Said as such,
  // rather than "has no  on file" with a blank where the field should be.
  const live = statement?.resolution;
  const resolvable =
    live && Number(live.rate) > 0
      ? { rate: Number(live.rate), label: live.label || live.detail?.label || null }
      : null;

  return {
    code: "tax_unresolved",
    // Plain English on the wire so a non-UI caller (the cron follow-up, a
    // future integration) still gets a sentence rather than a bare code. The
    // screens translate from `code` and ignore this.
    error: resolvable
      ? `This document says tax applies but charges none. The rate works out to ${resolvable.rate}%` +
        `${resolvable.label ? ` (${resolvable.label})` : ""} — open the document and save it again with tax on, ` +
        `or switch tax off on it if none is owed.`
      : `This document says tax applies but charges none, and there is nothing to work the rate out from. ` +
        `${name} has no ${missing.join(" or ") || "province"} on file, and your company has no fallback rate set. ` +
        `Add the client's address details, or switch tax off on this document if none is owed.`,
    clientId: client?.id || null,
    clientName: client?.name || null,
    missing,
    resolvable,
  };
}
