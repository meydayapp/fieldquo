// app/components/document/QuoteDocument.js
//
// The quote document, drawn for a browser in the back office — ONE set of
// sections shared by the quote page (app/app/quotes/[id]/page.js, read-only)
// and the document-shaped builder (app/components/quotes/builder/
// DocumentBuilder.js, editable).
//
// ── Why this file exists ────────────────────────────────────────────────────
//
// The builder's whole premise (mockup b7, approved 2026-09-21) is that what
// the estimator edits IS what the client reads. That premise dies the day the
// editor's read view and the quote page's mirror are two copies of the same
// markup — the copy nobody looks at drifts, exactly as AGENTS.md says. So
// there is one copy: the masthead, the parties block, a scope-group card and
// the totals live here, and both screens compose them. The quote page
// passes no edit callbacks and gets the document; the builder passes them
// and gets the same document with dashed underlines where a click opens an
// editor.
//
// ── What it mirrors ─────────────────────────────────────────────────────────
//
// lib/documentSections/* (the PDF and the email) and app/q/[token] (the
// homeowner's page): same order, same blocks, same helpers for the words —
// jobAddressLine, visibleLineItems, lineShowsAmount, offlineDiscountLine,
// documentLabels. Those files are react-pdf views and literal-hex HTML for a
// stranger with no session; a browser in /app draws with the semantic tokens
// BrandTheme sets from the company's colour (see app/components/BrandTheme.js
// for why /app never uses literal hex), so the markup is here and the words
// are shared. `bg-inverted` inside the frame IS the brand colour, with a
// foreground picked by measured contrast.
//
// ── `edit` is a slot, not a mode ────────────────────────────────────────────
//
// Every editable region takes an optional callback. Absent, the region is a
// plain element. Present, it is a <button> with the mockup's dashed
// underline, and the CALLER owns what opens — the sections never hold form
// state, so the quote page cannot accidentally render a control.
//
// Nothing here is a fixed FieldQuo colour, and nothing here says FieldQuo.
"use client";

import { Building2 } from "lucide-react";
import BrandTheme from "@/app/components/BrandTheme";
import RichTextBody from "@/app/components/quotes/RichTextBody";
import { lineShowsAmount } from "@/lib/quotes/textBlocks";

/**
 * A region that opens an editor when the caller says it can.
 *
 * A <button> only when there is something to open: an editable-looking span
 * that does nothing is the dead control this codebase is swept for.
 */
export function Editable({ onClick, label, className = "", block = false, children }) {
  if (!onClick) return <span className={className}>{children}</span>;
  const ring =
    "text-left rounded-sm border-b border-dashed border-muted-foreground/60 hover:bg-muted/70 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  // A <div role="button"> for a region holding block content (a heading, a
  // paragraph, a list): a <button> may only hold phrasing content, and a
  // heading inside one is invalid HTML that some assistive tech flattens.
  if (block) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick(e);
          }
        }}
        title={label}
        aria-label={label}
        className={`block w-full ${ring} ${className}`}
        data-editable
      >
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline ${ring} ${className}`}
      data-editable
    >
      {children}
    </button>
  );
}

/**
 * The frame: the company's colour scoped to the document, and the brand rule
 * before anything else (two weights of the colour, as HeaderSection's PDF
 * band) so the quote reads as being ON their letterhead.
 *
 * `data-brand` and the <style> are on the same element deliberately — a
 * wrapper is one refactor away from being flattened, and the attribute would
 * survive it while the theme quietly stopped applying.
 */
export function DocumentFrame({ company, children, className = "", ...rest }) {
  return (
    <article
      data-brand
      className={`bg-card border border-border rounded-2xl overflow-hidden ${className}`}
      {...rest}
    >
      <BrandTheme brandColor={company?.brandColor} brandColors={company?.brandColors} />
      <div className="flex h-1.5" aria-hidden="true">
        <div className="flex-[2] bg-inverted" />
        <div className="flex-1 bg-inverted opacity-50" />
      </div>
      {children}
    </article>
  );
}

/**
 * The masthead: identity on the left, the document's facts on the right.
 *
 * @param company   { name, logoUrl, phone, email, address? }
 * @param word      the document word in the document's language ("QUOTE")
 * @param number    the reference, or null before the first save
 * @param status    a rendered chip, or null
 * @param meta      [{ label, value }] under the number — the date, "valid
 *                  until". Only what is known: an absent date stays absent.
 * @param edit      { company, number, meta } callbacks
 */
export function DocumentMasthead({ company, word, number, status = null, meta = [], edit = {}, numberPlaceholder = "" }) {
  const lines = [company?.address, company?.email, company?.phone, company?.website].filter(Boolean);
  return (
    <header className="px-5 sm:px-7 pt-5 pb-4 border-b border-border" data-doc-masthead>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <Editable onClick={edit.company} label={edit.companyLabel} block className="min-w-0 sm:w-auto">
          <div className="flex items-center gap-3 min-w-0">
            {company?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoUrl}
                alt={company.name || ""}
                className="h-10 w-auto max-w-[160px] object-contain"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-inverted text-inverted-foreground flex items-center justify-center shrink-0">
                <Building2 size={18} />
              </div>
            )}
            {/* Only what came back. A placeholder company name here would be
                inventing the one thing on the page that has to be theirs. */}
            {company?.name && (
              <div className="min-w-0">
                <div className="font-semibold text-foreground truncate">{company.name}</div>
                {lines.map((line) => (
                  <div key={line} className="text-xs text-muted-foreground truncate">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Editable>

        <div className="sm:text-right shrink-0">
          <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
            {word}
          </div>
          <Editable onClick={edit.number} label={edit.numberLabel} block>
            <h1 className="text-xl font-bold text-foreground tabular-nums">
              {number || <span className="text-muted-foreground font-normal text-base">{numberPlaceholder}</span>}
            </h1>
          </Editable>
          {meta.length > 0 && (
            <Editable onClick={edit.meta} label={edit.metaLabel} block>
              <dl className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                {meta.map(({ label, value }) => (
                  <div key={label}>
                    <dt className="inline">{label} </dt>
                    <dd className="inline text-foreground font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </Editable>
          )}
          {status}
        </div>
      </div>
    </header>
  );
}

/**
 * Who it's for, and where the work is.
 *
 * @param client      { name, contactName, email, phone } — `address` is the
 *                    formatted string the caller already resolved
 *                    (lib/format/address.js), never re-joined here.
 * @param jobAddress  { label, value } from jobAddressLine, or null. The
 *                    builder passes the raw site with `forceJobAddress`
 *                    because the estimator must see the box even when it
 *                    equals the client's — that is the field they type in.
 * @param facts       [[label, value]] on the right (date, valid until, the
 *                    custom fields flagged for documents)
 * @param edit        { client, jobAddress, facts } callbacks; `clientSlot`
 *                    replaces the whole left panel (the builder's picker
 *                    before a client is chosen)
 */
export function DocumentParties({ label, client, clientAddress = "", jobAddress = null, facts = [], edit = {}, clientSlot = null }) {
  return (
    <div className="px-5 sm:px-7 py-5 border-b border-border grid gap-4 sm:grid-cols-2" data-doc-parties>
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">{label}</p>
        {clientSlot ? (
          clientSlot
        ) : (
          <>
            <Editable onClick={edit.client} label={edit.clientLabel} block>
              <p className="text-base font-semibold text-foreground mt-0.5 break-words">{client?.name}</p>
              {client?.contactName && <p className="text-sm text-muted-foreground">{client.contactName}</p>}
              {client?.email && <p className="text-sm text-muted-foreground break-all">{client.email}</p>}
              {client?.phone && <p className="text-sm text-muted-foreground">{client.phone}</p>}
              {clientAddress && <p className="text-sm text-muted-foreground">{clientAddress}</p>}
            </Editable>
            {/* Where the work is — the same rule the PDF's panel uses
                (jobAddressLine): printed when the quote names a site that is
                not simply the client's own address. */}
            {jobAddress && (
              <Editable onClick={edit.jobAddress} label={edit.jobAddressLabel} block className="mt-1">
                <p className="text-sm text-muted-foreground" data-job-address>
                  <span className="text-[10px] font-bold tracking-wider uppercase block">{jobAddress.label}</span>
                  {jobAddress.value || <span className="italic">{jobAddress.placeholder}</span>}
                </p>
              </Editable>
            )}
          </>
        )}
      </div>

      {facts.length > 0 && (
        <Editable onClick={edit.facts} label={edit.factsLabel} block className="sm:text-right">
          <dl className="text-sm space-y-1 sm:text-right">
            {facts.map(([factLabel, value]) => (
              <div key={factLabel}>
                <dt className="inline text-muted-foreground">{factLabel} </dt>
                <dd className="inline text-foreground font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </Editable>
      )}
    </div>
  );
}

/**
 * One service, as a card: its name and subtotal in the head, its lines
 * beneath — exactly the shape the approval page and the PDF give it, so a
 * three-trade quote has seams.
 *
 * @param lines       already through visibleLineItems (the caller decides
 *                    what the reader sees; this draws what it is given)
 * @param money       formatter for this document's currency
 * @param showAmounts false when the API withheld amounts (pricingHidden):
 *                    a coerced "$0.00" beside real work is a false claim
 * @param lineExtras  (item, index) => node under a line, for what staff see
 *                    and the client does not (the price reasoning, the
 *                    hidden-on-work-order chip)
 * @param edit        { group, line(index) } callbacks
 * @param children    drawn INSIDE the card after the lines — the builder's
 *                    per-area options and its inline editor
 */
export function DocumentScopeGroup({
  label,
  subtotal,
  lines = [],
  money,
  showAmounts = true,
  lineExtras = null,
  edit = {},
  headExtra = null,
  children,
  ...rest
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden" data-doc-group {...rest}>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted">
        <Editable onClick={edit.group} label={edit.groupLabel} block className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground text-sm truncate">{label}</h2>
        </Editable>
        <span className="flex items-center gap-2 shrink-0">
          {headExtra}
          {showAmounts && Number(subtotal) > 0 && (
            <span className="text-sm font-semibold text-foreground tabular-nums">{money(subtotal)}</span>
          )}
        </span>
      </div>
      <div className="px-4 py-1">
        {lines.map((item, i) => (
          <div
            key={i}
            className="flex justify-between gap-4 text-sm text-foreground py-1.5 border-b border-border last:border-0"
            data-doc-line
          >
            <Editable onClick={edit.line ? () => edit.line(i, item) : null} label={edit.lineLabel} block className="min-w-0 flex-1">
              <span className="min-w-0">
                {item.description}
                {/* The scope the client will read, on the same row: a
                    paragraph that only appears on the version the homeowner
                    receives is a paragraph nobody proofreads. */}
                {item.detail ? (
                  <RichTextBody body={item.detail} className="mt-0.5 text-xs leading-relaxed text-muted-foreground" />
                ) : null}
                {item.quantity > 1 && <span className="text-muted-foreground"> × {item.quantity}</span>}
              </span>
            </Editable>
            {/* An unpriced text block prints no amount, not a $0.00
                (lib/quotes/textBlocks.js lineShowsAmount). */}
            {showAmounts && lineShowsAmount(item) && (
              <span className="tabular-nums shrink-0">{money(item.amount)}</span>
            )}
            {lineExtras ? lineExtras(item, i) : null}
          </div>
        ))}
        {children}
      </div>
    </div>
  );
}

/**
 * The foot of the document: quiet rows, then the one filled band.
 *
 * @param rows   [{ key, label, value, tone?, note? }] — subtotal, discount,
 *               the e-transfer / cheque line, tax. Only rows the caller
 *               chose to print: a "Discount $0.00" row invites the question
 *               of why nothing was discounted, so the caller omits it.
 * @param total  { label, value }
 * @param after  drawn under the band (the approved-with-extras band)
 * @param edit   { row(key) } callback — a row with an editor opens it
 */
export function DocumentTotals({ rows = [], total, after = null, edit = {}, children }) {
  return (
    <div className="px-5 sm:px-7 py-5 border-t border-border" data-doc-totals>
      {/* Right-aligned and narrow above sm, exactly as TotalsSection lays
          the PDF out: a totals block spanning the full width reads as
          another table, kept to a column it reads as a summary. */}
      <div className="sm:w-3/5 sm:ml-auto space-y-1 text-sm">
        {rows.map((row) => (
          <div key={row.key} data-doc-total-row={row.key}>
            <Editable onClick={edit.row ? () => edit.row(row.key) : null} label={row.editLabel} block>
              <div
                className={`flex justify-between gap-3 ${
                  row.tone === "warn"
                    ? "text-amber-700 dark:text-amber-300"
                    : row.tone === "good"
                      ? "text-green-700 dark:text-green-400"
                      : "text-muted-foreground"
                }`}
              >
                <span>{row.label}</span>
                <span className={row.tone === "warn" ? "font-medium" : "tabular-nums"}>{row.value}</span>
              </div>
            </Editable>
            {row.note ? <p className="text-xs text-muted-foreground mt-0.5 mb-1">{row.note}</p> : null}
          </div>
        ))}
        {children}
        {/* The headline figure in a filled band in their colour, matching the
            PDF and the approval page. Everything above it is quiet, so the eye
            lands on the one number that matters. */}
        {total && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-inverted text-inverted-foreground px-4 py-3 mt-2" data-doc-total-band>
            <span className="text-xs font-bold uppercase tracking-wide">{total.label}</span>
            <span className="text-xl font-bold tabular-nums">{total.value}</span>
          </div>
        )}
        {after}
      </div>
    </div>
  );
}
