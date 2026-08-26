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
//   1. WHERE the client's jurisdiction is read from. The resolver reads
//      `client.province` and `client.country`. Production has 55 client rows
//      and ZERO with a country, because six of the seven address-autocomplete
//      consumers threw the structured components away (fixed — see
//      scripts/check-address-fields.mjs, which now stops it recurring). So the
//      resolver was being handed an empty client and correctly saying "I don't
//      know", forever.
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

const num = (v) => Number(v ?? 0);

/** Does this client's own record identify a jurisdiction the resolver can use? */
export function clientJurisdictionKnown(client) {
  // Country is the load-bearing half, and the resolver is right to insist on
  // it: "ON" alone could be Ontario, or a foreign region, or a typo, and
  // picking Canada because most tenants are Canadian is exactly the invented
  // fact this codebase refuses. Three production rows carry a province with no
  // country and resolve to nothing at all because of it.
  return Boolean(normaliseCountry(client?.country));
}

/**
 * The rate for this document, and where it came from.
 *
 * @returns the resolveTaxRate result plus:
 *   basis         "client" | "company_assumed" | "none"
 *   assumed       true when the rate came from the COMPANY's province because
 *                 the client's record could not answer. Surfaces must say so.
 *   assumedRegion the human name of the province that was assumed, for the
 *                 sentence that says so. Null when nothing was assumed.
 */
export function resolveDocumentTax({
  company: companyArg,
  taxRates,
  client,
  workType = null,
  asOf = new Date(),
  lang = "en",
} = {}) {
  const company = companyArg || {};
  const args = { company, taxRates, workType, asOf, lang };

  if (clientJurisdictionKnown(client)) {
    return {
      ...resolveTaxRate({ ...args, client }),
      basis: "client",
      assumed: false,
      assumedRegion: null,
    };
  }

  // ── The assumption ────────────────────────────────────────────────────────
  //
  // Only reached when the client's record cannot answer. The company's own
  // address stands in — which is right far more often than it is wrong, and
  // wrong often enough to label. Note this deliberately does NOT merge the
  // client's stray province over the company's country: a client carrying
  // "ON" with no country next to a company in the US would silently produce a
  // Canadian rate, and half a stored address is not a jurisdiction.
  const assumedClient = {
    province: company.province || null,
    country: company.country || null,
  };
  const result = resolveTaxRate({ ...args, client: assumedClient });

  // The assumption only counts as one if it actually decided the number. When
  // it falls through to the company's flat default, nothing was assumed — that
  // rate was always going to apply — and claiming otherwise puts a warning on
  // a screen that has nothing to warn about.
  const assumed =
    result.source === "client_province" ||
    result.source === "jurisdiction_ca" ||
    result.source === "jurisdiction_vat";

  return {
    ...result,
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
 * @param company,taxRates,client   context for the resolution. All optional:
 *                    without them a zero tax line still refuses to render as a
 *                    settled $0.00, it just cannot name a reason.
 *
 * @returns { kind, amount, resolution, assumed, assumedRegion }
 */
export function taxStatement({
  taxEnabled,
  tax,
  company = null,
  taxRates = null,
  client = null,
  workType = null,
  asOf = new Date(),
  lang = "en",
} = {}) {
  const amount = num(tax);
  const resolution = company
    ? resolveDocumentTax({ company, taxRates, client, workType, asOf, lang })
    : null;

  const base = {
    amount,
    resolution,
    assumed: Boolean(resolution?.assumed),
    assumedRegion: resolution?.assumedRegion || null,
  };

  // A figure was charged. Nothing below can contradict a number already on a
  // document — this file explains tax lines, it never re-prices one.
  if (amount !== 0) return { ...base, kind: "charged" };

  // The sender turned it off. An explicit act, and the one honest way to send
  // a zero-tax document.
  if (taxEnabled === false) return { ...base, kind: "off" };

  // The company has said it charges none. A different sentence, as it should
  // be — "we're below the VAT threshold" is not "nobody has worked this out".
  if (companyStatesNoTax(company)) return { ...base, kind: "none" };

  // A jurisdiction we can stand behind that genuinely levies nothing.
  if (resolution?.source === "vat_not_registered")
    return { ...base, kind: "none" };

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
  if (!normaliseCountry(client?.country)) missing.push("country");
  if (!client?.province) missing.push("province");

  return {
    code: "tax_unresolved",
    // Plain English on the wire so a non-UI caller (the cron follow-up, a
    // future integration) still gets a sentence rather than a bare code. The
    // screens translate from `code` and ignore this.
    error:
      `This document says tax applies but charges none, and there is nothing to work the rate out from. ` +
      `${name} has no ${missing.join(" or ")} on file, and your company has no fallback rate set. ` +
      `Add the client's address details, or switch tax off on this document if none is owed.`,
    clientId: client?.id || null,
    clientName: client?.name || null,
    missing,
  };
}
