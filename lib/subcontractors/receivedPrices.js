// lib/subcontractors/receivedPrices.js
//
// "Quotes from my subs" — one place a general contractor sees every price
// their subs have sent them, where each one stands, and the way to use it.
// The owner, 2026-10-10: a page listing every price their subs have sent
// them, with status and "Add to my quote".
//
// This file is every DECISION on that page, pure — no database, no request —
// so scripts/check-sub-quotes.mjs executes each one against fixtures.
// ./receivedPricesServer.js does the reads these decide over.
//
// ══ What counts as a price the GC received ═════════════════════════════════
//
// Only what already reached the GC's own tenant through a link the GC (or
// the sub's own action) made. Two sources, both rows in the GC's company:
//
//   1. QuoteImport (targetCompanyId = the GC). Every kind of price that is in
//      a compare: a sub's FieldQuo quote pasted in by its link, a sub's quote
//      that answered a price request (landRequestedQuote), a no-account
//      reply the GC confirmed, and a PDF or photo the GC uploaded and
//      confirmed. The sub's company name comes through the import's own
//      sourceCompany relation — exactly what the compare panel shows.
//   2. SubPriceRequestRecipient (companyId = the GC) with a reply the GC has
//      not yet put in the compare — the "not yet used" row. A linked sub's
//      sent quote never waits here: it lands as an import by itself.
//
// NOT listed: a sub's quote addressed to the GC as a business client that
// the GC has opened by its /q/<token> link but never added. That quote lives
// in the SUB's tenant, nothing in the GC's tenant records the opening, and
// finding it would mean querying another company's quotes by
// Client.linkedCompanyId — which no link the GC made authorises. Once the GC
// adds it (/q/<token>/add), it is a QuoteImport and is listed.
//
// ══ Who sees it, and what of it ════════════════════════════════════════════
//
// The same gates as the compare panel these rows come from
// (app/api/quotes/[id]/imports): quotes view_only to read at all, and
// showPricing — below it that route returns no importer rows, so a page of
// them would be the same margin leaking through a side door. The sub's
// price is the GC's COST: shown only with jobCosting, and below it the row
// keeps the client price the compare shows and says the cost is withheld.
// A reply not yet in the compare has no client price; its figure is cost
// only, and the roster gate the price-request panel asks (user:manage) is
// asked for those rows too.
//
// ══ Actions go where they already go ═══════════════════════════════════════
//
// No money is worked out here. "Add to my quote" POSTs the compare's own
// select route — the server reprices from its stored rows
// (lib/quotes/importQuote.js placeImportOption) — and "Add to compare" POSTs
// the price request's confirm route. "Open" and "Request a price" are links
// to the quote page's own panels. Every action is offered only when the
// route behind it would accept it.

import { hasLevel, hasToggle } from "@/lib/permissions/enforce";
import { canReadSubcontractors, canWriteSubcontractors } from "@/lib/subcontractors/access";
import { compareImportOptions, comparisonKey, DEFAULT_IMPORT_LABEL } from "@/lib/quotes/importOptions";
import { changeOrderStatus } from "@/lib/jobs/changeOrderValue";
import { awaitingConfirmation } from "@/lib/subRequests/model";
import { normaliseBusinessName } from "@/lib/quotes/subMatch";
export { RECEIVED_PRICE_STATUSES, filterReceivedPrices, receivedPriceFilterOptions, ALL } from "@/lib/subcontractors/receivedPriceFilters";

const round2 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

// ── Access ──────────────────────────────────────────────────────────────────

/**
 * May this member open the page at all? The compare's own pair: quotes
 * view_only (GET /api/quotes/[id]/imports) and showPricing (below it that
 * route returns no importer rows). The sidebar row
 * (lib/permissions/nav.js "app.nav.subQuotes") asks exactly this.
 */
export function canSeeReceivedPrices(member) {
  return hasLevel(member, "quotes", "view_only") && hasToggle(member, "showPricing");
}

/**
 * Everything the page may show or offer this member, decided once. Each
 * action flag is the gate of the route that action calls:
 *
 *   mayCost     jobCosting — the sub's price is the GC's cost
 *   mayReplies  user:manage — the price-request rows (GET /api/price-requests)
 *   mayJobs     jobs view_only — the job a quote became, as a link
 *   choose      POST /api/quotes/[id]/imports/[importId]/select on an open
 *               quote: quotes view_create_edit + showPricing
 *   offerExtra  …on an approved quote: + jobs view_create_edit
 *   confirm     POST /api/price-requests/recipients/[id]/confirm:
 *               quotes view_create_edit + showPricing
 *   request     POST /api/price-requests: quotes view_create_edit + the
 *               roster's write gate
 *
 * A read-only support session (no userId) is offered no write.
 */
export function receivedPriceAccess(member) {
  const see = canSeeReceivedPrices(member);
  const writer = Boolean(member?.userId) && !member?.impersonation;
  const editQuotes = hasLevel(member, "quotes", "view_create_edit");
  const pricing = hasToggle(member, "showPricing");
  const choose = see && writer && editQuotes && pricing;
  return {
    see,
    mayCost: see && hasToggle(member, "jobCosting"),
    mayReplies: see && canReadSubcontractors(member),
    mayJobs: see && hasLevel(member, "jobs", "view_only"),
    choose,
    offerExtra: choose && hasLevel(member, "jobs", "view_create_edit"),
    confirm: choose,
    request: see && writer && editQuotes && canWriteSubcontractors(member),
  };
}

// ── Status ──────────────────────────────────────────────────────────────────

/**
 * The status of an import, from the compare's placement and the change
 * orders that carried it. `placement` is importPlacement's answer (line,
 * change_order with the live change order, or option); `changeOrders` are
 * ALL of this import's change orders, so a declined one is still seen.
 */
export function importStatus(placement, changeOrders = []) {
  if (placement?.kind === "line") return "on_quote";
  if (placement?.kind === "change_order") {
    return changeOrderStatus(placement.changeOrder) === "approved" ? "extra_approved" : "extra_pending";
  }
  const rejected = (Array.isArray(changeOrders) ? changeOrders : []).some(
    (co) => co && typeof co === "object" && changeOrderStatus(co) === "rejected",
  );
  return rejected ? "extra_declined" : "option";
}

// ── Actions ─────────────────────────────────────────────────────────────────

const OPEN_QUOTES = new Set(["draft", "sent"]);
// lib/subRequests/server.js quoteTakesRequests — the same three.
const TAKES_REQUESTS = new Set(["draft", "sent", "accepted"]);

/** The quote page's compare panel (ImportedCostsPanel renders id="sub-compare"). */
export function comparePath(quoteId) {
  return `/app/quotes/${encodeURIComponent(quoteId)}#sub-compare`;
}

/** The quote page's price-request panel (PriceRequestsPanel renders id="price-requests"). */
export function priceRequestsPath(quoteId) {
  return `/app/quotes/${encodeURIComponent(quoteId)}#price-requests`;
}

/** …with the request dialog opened on arrival (PriceRequestsPanel reads requestPrices=1). */
export function requestPricePath(quoteId) {
  return `/app/quotes/${encodeURIComponent(quoteId)}?requestPrices=1#price-requests`;
}

/** May a price request be raised on this quote from here? */
export function quoteTakesPriceRequest(quote) {
  return Boolean(quote && TAKES_REQUESTS.has(quote.status) && !quote.historicalImportedAt);
}

/**
 * "Add to my quote" for an import, or null. The select route's own rules
 * (lib/quotes/importQuote.js placeImportOption): only an option moves; an
 * open quote takes it as the trade's line (stepping the current one back —
 * "use_instead"); an approved quote with a job takes it as a pending change
 * order; a declined quote takes nothing.
 */
export function addActionForImport({ importId, quote, status, lineInTrade, access }) {
  if (status !== "option" && status !== "extra_declined") return null;
  if (!quote?.id || !importId) return null;
  const url = `/api/quotes/${encodeURIComponent(quote.id)}/imports/${encodeURIComponent(importId)}/select`;
  if (OPEN_QUOTES.has(quote.status)) {
    if (!access?.choose) return null;
    return { kind: "select", method: "POST", url, mode: lineInTrade ? "use_instead" : "use" };
  }
  if (quote.status === "accepted" && quote.hasJob) {
    if (!access?.offerExtra) return null;
    return { kind: "select", method: "POST", url, mode: "offer_extra" };
  }
  return null;
}

/**
 * "Add to compare" for a reply not yet used, or null. confirmReply's own
 * rules: the reply is still awaiting confirmation and the quote still takes
 * prices.
 */
export function addActionForReply({ recipient, quote, access }) {
  if (!recipient?.id || !access?.confirm) return null;
  if (!awaitingConfirmation(recipient)) return null;
  if (!quote || !TAKES_REQUESTS.has(quote.status)) return null;
  return {
    kind: "confirm",
    method: "POST",
    url: `/api/price-requests/recipients/${encodeURIComponent(recipient.id)}/confirm`,
    mode: "add_to_compare",
  };
}

// ── The rows ────────────────────────────────────────────────────────────────

function subKeyFor({ subcontractorId, sourceCompanyId, name }) {
  if (subcontractorId) return `sub:${subcontractorId}`;
  if (sourceCompanyId) return `co:${sourceCompanyId}`;
  const n = normaliseBusinessName(name);
  return n ? `name:${n}` : null;
}

function quoteRef(quote, access) {
  if (!quote) return null;
  const job = access?.mayJobs && quote.jobs?.[0] ? { id: quote.jobs[0].id, title: quote.jobs[0].title || null } : null;
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber || null,
    status: quote.status || null,
    clientName: quote.client?.name || null,
    job,
  };
}

/**
 * Every price the GC received, as the page shows it. Newest first.
 *
 * @param companyId     the GC — every input row must belong to it; a row
 *                      that does not is DROPPED here as well as never being
 *                      read, so a loader bug cannot put another tenant's
 *                      price on this page
 * @param imports       QuoteImport rows (sourceCompany { name } included)
 * @param recipients    SubPriceRequestRecipient rows with replies, each with
 *                      request { quoteId, trade, companyId } and
 *                      subcontractor { id, name, trade }
 * @param quotes        the GC's quotes those rows name, with client { name },
 *                      jobs [{ id, title }], historicalImportedAt
 * @param changeOrders  every change order carrying one of the imports
 *                      (live or not)
 * @param roster        the GC's Subcontractor rows (id, name, trade,
 *                      linkedCompanyId, insurance and clearance dates)
 * @param access        receivedPriceAccess(member)
 */
export function buildReceivedPrices({
  companyId,
  imports = [],
  recipients = [],
  quotes = [],
  changeOrders = [],
  roster = [],
  access,
  asOf,
} = {}) {
  if (!companyId || !access?.see) return [];
  const quoteById = new Map(
    (Array.isArray(quotes) ? quotes : []).filter((q) => q && q.companyId === companyId).map((q) => [q.id, q]),
  );
  const subsById = {};
  const subsByCompanyId = {};
  for (const s of Array.isArray(roster) ? roster : []) {
    if (!s || s.companyId !== companyId) continue;
    subsById[s.id] = s;
    if (s.linkedCompanyId && !subsByCompanyId[s.linkedCompanyId]) subsByCompanyId[s.linkedCompanyId] = s;
  }
  const cos = Array.isArray(changeOrders) ? changeOrders : [];

  // The GC's own imports, on the GC's own quotes. Grouped per quote so the
  // compare's per-quote reading (which line the trade has now) is the same.
  const own = (Array.isArray(imports) ? imports : []).filter(
    (imp) => imp && imp.id && imp.targetCompanyId === companyId && quoteById.has(imp.targetQuoteId),
  );
  const byQuote = new Map();
  for (const imp of own) {
    if (!byQuote.has(imp.targetQuoteId)) byQuote.set(imp.targetQuoteId, []);
    byQuote.get(imp.targetQuoteId).push(imp);
  }

  const rows = [];
  for (const [quoteId, list] of byQuote) {
    const quote = quoteById.get(quoteId);
    const groups = compareImportOptions({ imports: list, changeOrders: cos, subsByCompanyId, subsById, asOf });
    for (const g of groups) {
      const lineInTrade = g.options.some((o) => o.placement === "line");
      for (const o of g.options) {
        const imp = list.find((x) => x.id === o.id);
        const status = importStatus(
          { kind: o.placement, changeOrder: o.changeOrder },
          cos.filter((co) => co?.quoteImportId === o.id),
        );
        const named = imp.subcontractorId ? subsById[imp.subcontractorId] : null;
        const rosterRow = named || (imp.sourceCompanyId ? subsByCompanyId[imp.sourceCompanyId] : null) || null;
        const trade = imp.label || rosterRow?.trade || DEFAULT_IMPORT_LABEL;
        const subName = o.sourceCompanyName || rosterRow?.name || null;
        rows.push({
          id: `imp:${o.id}`,
          kind: "import",
          importId: o.id,
          recipientId: null,
          source: imp.sourceQuoteId ? "fieldquo_quote" : o.viaUpload ? "upload" : "reply",
          subName,
          subKey: subKeyFor({ subcontractorId: rosterRow?.id, sourceCompanyId: imp.sourceCompanyId, name: subName }),
          trade,
          tradeKey: comparisonKey(trade),
          // The sub's price is the GC's cost; the client price is what the
          // compare shows a showPricing reader without jobCosting.
          ...(access.mayCost ? { cost: o.costAmount, markupPercent: o.markupPercent } : { costHidden: true }),
          clientPrice: o.clientPrice,
          receivedAt: imp.createdAt ?? null,
          quote: quoteRef(quote, access),
          status,
          changeOrder: o.changeOrder ? { label: o.changeOrder.label, status: o.changeOrder.status } : null,
          credentials: o.credentials,
          actions: {
            open: comparePath(quoteId),
            add: addActionForImport({
              importId: o.id,
              quote: { id: quote.id, status: quote.status, hasJob: (quote.jobs?.length || 0) > 0 },
              status,
              lineInTrade: lineInTrade && o.placement !== "line",
              access,
            }),
            request: access.request && quoteTakesPriceRequest(quote) ? requestPricePath(quoteId) : null,
          },
        });
      }
    }
  }

  // Replies the GC has not put in the compare. Behind the roster gate, the
  // same as the price-request panel that lists them.
  if (access.mayReplies) {
    for (const r of Array.isArray(recipients) ? recipients : []) {
      if (!r || r.companyId !== companyId || r.request?.companyId !== companyId) continue;
      if (!awaitingConfirmation(r)) continue;
      const quote = quoteById.get(r.request.quoteId);
      if (!quote) continue;
      const sub = r.subcontractor && subsById[r.subcontractor.id] ? subsById[r.subcontractor.id] : r.subcontractor || null;
      const trade = r.request.trade || sub?.trade || DEFAULT_IMPORT_LABEL;
      const subName = sub?.name || null;
      rows.push({
        id: `req:${r.id}`,
        kind: "reply",
        importId: null,
        recipientId: r.id,
        source: "reply",
        subName,
        subKey: subKeyFor({ subcontractorId: r.subcontractorId || sub?.id, name: subName }),
        trade,
        tradeKey: comparisonKey(trade),
        // Not in the compare, so there is no markup and no client price yet
        // — only what the sub asked, which is cost.
        ...(access.mayCost ? { cost: round2(r.replyAmount), markupPercent: null } : { costHidden: true }),
        clientPrice: null,
        receivedAt: r.repliedAt ?? null,
        quote: quoteRef(quote, access),
        status: "not_used",
        changeOrder: null,
        credentials: null,
        actions: {
          open: priceRequestsPath(quote.id),
          add: addActionForReply({ recipient: r, quote, access }),
          request: access.request && quoteTakesPriceRequest(quote) ? requestPricePath(quote.id) : null,
        },
      });
    }
  }

  rows.sort((a, b) => new Date(b.receivedAt || 0) - new Date(a.receivedAt || 0));
  return rows;
}

/**
 * The quotes "Request a price" may start from on this page — the GC's own
 * quotes that take a request — or [] when this member may not send one.
 */
export function requestTargets(quotes, { companyId, access } = {}) {
  if (!access?.request || !companyId) return [];
  return (Array.isArray(quotes) ? quotes : [])
    .filter((q) => q && q.companyId === companyId && quoteTakesPriceRequest(q))
    .map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber || null,
      clientName: q.client?.name || null,
      status: q.status,
      path: requestPricePath(q.id),
    }));
}
