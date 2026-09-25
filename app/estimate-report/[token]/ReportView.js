// app/estimate-report/[token]/ReportView.js
//
// The instant estimate, presented the way the company's quotes are.
//
// ── "The same presentation but with the range" (owner, 2026-09-22) ──────────
//
// A homeowner who submits the instant-estimate form lands here. It used to be
// a single report card; it is now the company's proposal — the page a quote
// link opens (app/q/[token]) — with the RANGE where a quote's prices would
// be: a sticky header with the logo, the range and the call to action, the
// contents beside the document, "Your estimate" first, then what happens
// next and the company's own sections (About us, Before & after, documents,
// testimonials, services).
//
// Those company sections and the numbered process steps are not re-drawn
// here: they are app/components/public/proposal/ProposalSections.js, the
// components the quote page itself renders, fed by the same projection
// (lib/proposal/load.js#projectProposal via lib/estimate/report/
// presentation.js). scripts/check-range-presentation.mjs fails if this file
// grows its own copy.
//
// ── No exact price, anywhere ────────────────────────────────────────────────
//
// This is a server component and nothing priced is handed to a client
// component: the only figures on the page are the one range string the model
// formats (report.estimate.rangeText, from the range the homeowner was shown,
// never the point estimate) and the "starting at" option cards the report has
// always carried — both behind the owner's per-trade visibility setting. No
// line, no rate, no breakdown is in the model, so none can be rendered. The
// check renders this component against a fixture whose line prices and point
// estimate are distinctive numbers and asserts none of them is in the HTML.
//
// Every colour is a literal from lib/documents/theme.js (measured pairs —
// fillPair for the range band and the call to action, washPair for cards,
// never the raw brand hex under text); the only script on the page is the
// call-back form.

import { documentTheme, fillPair, washPair, neutralPair, ruleColor } from "@/lib/documents/theme";
import { outlinePointsAttr } from "@/lib/estimate/report/mapOverlay";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import {
  PROPOSAL_SECTION_IDS,
  proposalSectionLabel,
  ProposalSection,
  ProcessStepList,
  CompanySections,
} from "@/app/components/public/proposal/ProposalSections";
// From the pure section module, not from lib/estimate/report/presentation.js:
// that one reads the database, and this component is rendered by a check
// script with none.
import { EMPTY_PROPOSAL } from "@/lib/proposal/sections";
import CallbackForm from "./CallbackForm";

const EMPTY_PRESENTATION = { proposal: EMPTY_PROPOSAL, processSteps: [] };

function Tile({ tile, fill }) {
  return (
    <a
      href={tile.href}
      target={tile.href.startsWith("http") ? "_blank" : undefined}
      rel={tile.href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-center no-underline"
      style={{ backgroundColor: fill.bg, color: fill.fg }}
    >
      <div className="text-[10px] font-bold tracking-[0.12em] uppercase">{tile.label}</div>
      <div className="text-xs mt-0.5 truncate" style={{ color: fill.fg }}>
        {tile.text || tile.href.replace(/^https?:\/\//, "").replace(/\/$/, "")}
      </div>
    </a>
  );
}

function Heading({ children, theme }) {
  return (
    <h2
      className="text-[11px] font-bold tracking-[0.14em] uppercase pb-1.5 mb-3"
      style={{ color: theme.accentText, borderBottom: `1px solid ${theme.accentRule}` }}
    >
      {children}
    </h2>
  );
}

function Rows({ rows, theme }) {
  return (
    <dl className="m-0">
      {rows.map((r, i) => (
        <div
          key={r.label}
          className="flex justify-between gap-4 py-2 text-sm"
          style={{ borderBottom: i === rows.length - 1 ? "none" : `1px solid ${theme.borderSoft}` }}
        >
          <dt className="m-0" style={{ color: theme.inkMuted }}>{r.label}</dt>
          <dd className="m-0 font-semibold text-right" style={{ color: theme.ink }}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ReportView({ report, company, token, presentation = EMPTY_PRESENTATION }) {
  const theme = documentTheme(company);
  const fill = fillPair(theme);
  const wash = washPair(theme);
  const neutral = neutralPair(theme);
  const rule = ruleColor(theme);
  const copy = clientDocCopy(report.language);
  const rp = copy.rangeProposal;
  const h = report.header;
  const tiles = [h.call, h.email, h.website].filter(Boolean);
  const o = report.options;
  const q = report.questions;
  const m = report.measurement;
  const p = report.property;
  const n = report.notes;
  const est = report.estimate || { rangeText: null, optionLabel: null };
  const outline = p.map?.outline || null;
  const pdfHref = `/estimate-report/${encodeURIComponent(token)}/pdf`;
  const ids = PROPOSAL_SECTION_IDS;

  const proposal = presentation?.proposal || EMPTY_PROPOSAL;
  const processSteps = presentation?.processSteps || [];
  const hasNext = n.nextSteps.length > 0 || processSteps.length > 0;
  // The contents: "Your estimate" always, then what happens next, then the
  // company sections the server listed (on AND with something behind them).
  const sectionKeys = ["estimate", ...(hasNext ? ["next"] : []), ...(proposal.sections || [])];

  // The one call to action: book the visit the range is subject to, when the
  // company can take one; otherwise the call-back form on this page. Never
  // an "Accept" — a range is not a price anyone can accept, and a button
  // that looked like acceptance and created nothing would be the dead
  // control AGENTS.md's first rule forbids.
  const cta = q.book ? { href: q.book.href, label: rp.bookVisit } : { href: "#callback", label: rp.talkToUs };
  const ctaStyle = { backgroundColor: fill.bg, color: fill.fg, border: `1px solid ${theme.accentText}` };

  const button = (primary) =>
    primary
      ? { backgroundColor: fill.bg, color: fill.fg }
      : { backgroundColor: wash.bg, color: wash.accent, border: `1px solid ${theme.accentRule}` };

  const tocLink = (key, mobile) => (
    <a
      key={key}
      href={`#${ids[key]}`}
      className={
        mobile
          ? "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap min-h-9 inline-flex items-center no-underline"
          : "block w-full text-left rounded-md px-3 py-2 text-sm min-h-10 no-underline"
      }
      // Measured against what each link actually sits on: the wash pair's
      // own ink on a chip, and full ink on the #f5f2ec page — inkMuted is
      // measured against white paper and reads 4.33:1 on that page.
      style={{ color: mobile ? wash.ink : theme.ink, backgroundColor: mobile ? wash.bg : "transparent" }}
    >
      {proposalSectionLabel(key, copy)}
    </a>
  );

  return (
    <main className="min-h-dvh bg-[#f5f2ec] px-4 pb-24 sm:pb-10" lang={report.language} style={{ color: theme.ink }}>
      {/* ── Sticky header: logo · range · the call to action ─────────────
          The same bar the quote carries (logo · total · Accept), with the
          range where the total is and the visit where Accept is. */}
      <div className="sticky top-0 z-30 -mx-4 px-4 bg-white/95 backdrop-blur border-b border-black/10">
        <div className="max-w-5xl mx-auto flex items-center gap-3 py-2.5 min-h-14">
          {h.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={h.logoUrl} alt={h.companyName} className="h-8 w-auto max-w-[120px] object-contain" />
          ) : (
            <div className="h-8 w-8 rounded-md shrink-0" style={{ backgroundColor: fill.bg, border: `1px solid ${theme.accentText}` }} aria-hidden="true" />
          )}
          <span className="font-semibold text-[#2d2520] truncate text-sm sm:text-base">{h.companyName}</span>
          {est.rangeText && (
            <span className="ml-auto text-right leading-tight shrink-0">
              <span className="hidden sm:inline text-xs text-[#2d2520]/70 mr-2">{rp.estimatedRange}</span>
              <span className="font-bold tabular-nums text-[#2d2520] text-sm sm:text-base">{est.rangeText}</span>
            </span>
          )}
          <a
            href={cta.href}
            className={`${est.rangeText ? "" : "ml-auto "}hidden sm:inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold min-h-10 no-underline`}
            style={ctaStyle}
          >
            {cta.label}
          </a>
        </div>
        {sectionKeys.length > 1 && (
          <nav aria-label={copy.proposal.contents} className="md:hidden max-w-5xl mx-auto flex gap-2 overflow-x-auto pb-2 -mb-px [scrollbar-width:none]">
            {sectionKeys.map((k) => tocLink(k, true))}
          </nav>
        )}
      </div>

      <div className="max-w-5xl mx-auto md:grid md:grid-cols-[176px_1fr] md:gap-6 pt-5">
        {sectionKeys.length > 1 ? (
          <nav aria-label={copy.proposal.contents} className="hidden md:block">
            <div className="sticky top-20 space-y-0.5">
              {sectionKeys.map((k) => tocLink(k, false))}
              {n.reportId && (
                <div className="pt-4 px-3 text-[10px] uppercase tracking-wider" style={{ color: theme.ink }}>
                  {rp.estimateWord} {n.reportId}
                </div>
              )}
            </div>
          </nav>
        ) : (
          <div className="hidden md:block" />
        )}

        <div className="min-w-0 space-y-5">
          <section id={ids.estimate} className="scroll-mt-24">
            <article
              className="rounded-2xl overflow-hidden shadow-sm"
              style={{ backgroundColor: theme.paper, border: `1px solid ${theme.border}` }}
            >
              {/* Brand rule */}
              <div className="flex">
                <div className="h-1.5 flex-[2]" style={{ backgroundColor: rule }} />
                <div className="h-1.5 flex-1" style={{ backgroundColor: theme.accentSoft }} />
              </div>

              <div className="px-5 py-6 sm:px-8">
                {/* Masthead: identity left, the document's name right — the
                    quote's "QUOTE Q-0042", as "ESTIMATE" and its reference. */}
                <header>
                  <div className="flex items-start justify-between gap-x-4 gap-y-3 flex-wrap">
                    <div className="min-w-0 basis-[58%] grow">
                      {h.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.logoUrl} alt={h.companyName} className="h-10 max-w-[180px] object-contain object-left" />
                      ) : null}
                      <div className={h.logoUrl ? "text-sm mt-1" : "text-xl font-extrabold"} style={{ color: h.logoUrl ? theme.ink : theme.accentText }}>
                        {h.companyName}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-auto">
                      <div className="text-lg font-bold tracking-[0.15em] leading-none uppercase" style={{ color: theme.accentText }}>
                        {rp.estimateWord}
                      </div>
                      {n.reportId && <div className="font-mono text-sm mt-1" style={{ color: theme.ink }}>{n.reportId}</div>}
                    </div>
                  </div>
                  {tiles.length > 0 && (
                    <div className="mt-4 flex gap-2">
                      {tiles.map((t) => (
                        <Tile key={t.label} tile={t} fill={fill} />
                      ))}
                    </div>
                  )}
                </header>

                {/* Title */}
                <section className="mt-6 pb-5" style={{ borderBottom: `1px solid ${theme.accentRule}` }}>
                  <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight m-0" style={{ color: theme.ink }}>
                    {report.title.text}
                  </h1>
                  {report.title.preparedFor && (
                    <p className="mt-3 text-sm m-0" style={{ color: theme.inkMuted }}>
                      <span className="font-bold tracking-[0.12em] uppercase text-[11px]" style={{ color: theme.accentText }}>
                        {report.title.preparedForLabel}
                      </span>{" "}
                      {report.title.preparedFor}
                    </p>
                  )}
                  <p className="mt-1 text-xs m-0" style={{ color: theme.inkMuted }}>
                    {[report.title.preparedBy, report.title.date].filter(Boolean).join(" · ")}
                  </p>
                </section>

                {/* ── The range, where a quote's total would be ───────────
                    One band in the measured fill pair, labelled as an
                    estimate subject to a site visit in the same breath as
                    the figure. With no figure allowed (a gated trade, or
                    one switched off since), the band says who confirms the
                    price instead of going blank. */}
                <section className="mt-6">
                  <div className="rounded-xl px-5 py-5" style={{ backgroundColor: fill.bg, color: fill.fg }}>
                    <div className="text-[11px] font-bold tracking-[0.14em] uppercase">
                      {est.rangeText ? rp.estimatedRange : rp.yourEstimate}
                    </div>
                    {est.rangeText ? (
                      <div className="text-3xl sm:text-4xl font-extrabold leading-tight mt-1 tabular-nums">{est.rangeText}</div>
                    ) : (
                      <div className="text-lg font-bold leading-snug mt-1">{rp.noRange(h.companyName)}</div>
                    )}
                    {est.rangeText && est.optionLabel && <div className="text-sm mt-1">{rp.rangeFor(est.optionLabel)}</div>}
                    <div className="text-sm font-semibold mt-3">{rp.subjectToVisit}</div>
                  </div>
                  {est.rangeText && (
                    <p className="text-xs mt-2 m-0" style={{ color: theme.inkMuted }}>{rp.rangeNote(h.companyName)}</p>
                  )}
                </section>

                {/* Options */}
                {o.cards.length > 0 && (
                  <section className="mt-6">
                    <Heading theme={theme}>{o.title}</Heading>
                    <p className="text-sm m-0 mb-3" style={{ color: theme.inkMuted }}>{o.intro}</p>
                    <div className={`grid gap-3 ${o.cards.length > 1 ? "sm:grid-cols-2" : ""}`}>
                      {o.cards.map((c, i) => (
                        <div key={c.key || i} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
                          {c.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.imageUrl} alt={c.label || ""} className="w-full h-36 object-cover" />
                          ) : (
                            <div className="h-24 flex items-center justify-center px-4 text-center" style={{ backgroundColor: wash.bg }}>
                              <span className="text-base font-bold" style={{ color: wash.ink }}>{c.label || o.startingAtLabel}</span>
                            </div>
                          )}
                          <div className="p-4">
                            {c.tier && (
                              <div className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: theme.accentText }}>
                                {c.tier}
                                {c.chosen ? ` · ${o.yourPickLabel}` : ""}
                              </div>
                            )}
                            {c.label && <div className="text-base font-bold mt-1" style={{ color: theme.ink }}>{c.label}</div>}
                            {c.startingAt && (
                              <div className="mt-3 rounded-lg px-3 py-2" style={{ backgroundColor: fill.bg, color: fill.fg }}>
                                <div className="text-[10px] tracking-[0.12em] uppercase">{o.startingAtLabel}</div>
                                <div className="text-2xl font-extrabold leading-tight">
                                  {c.startingAt}
                                  <sup className="text-sm">*</sup>
                                </div>
                                {c.unit && <div className="text-[11px]">{c.unit}</div>}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Questions — the call-back form lives here, and the header's
                    "Talk to us" jumps to it when there is no calendar. */}
                <section className="mt-6 scroll-mt-24" id="callback">
                  <Heading theme={theme}>{q.title}</Heading>
                  <p className="text-sm m-0 mb-3" style={{ color: theme.inkMuted }}>{q.body}</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {q.book && (
                      <a href={q.book.href} className="rounded-full px-4 py-3 text-sm font-bold text-center no-underline" style={button(true)}>
                        {q.book.label}
                      </a>
                    )}
                    <CallbackForm callback={q.callback} theme={{ paper: theme.paper, ink: theme.ink, inkMuted: theme.inkMuted, border: theme.border, positive: theme.positive, negative: theme.negative }} button={button(!q.book)} />
                    {q.website && (
                      <a
                        href={q.website.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full px-4 py-3 text-sm font-bold text-center no-underline"
                        style={button(false)}
                      >
                        {q.website.label}
                      </a>
                    )}
                  </div>
                </section>

                {/* Measurement */}
                {m.rows.length > 0 && (
                  <section className="mt-6">
                    <Heading theme={theme}>{m.title}</Heading>
                    <Rows rows={m.rows} theme={theme} />
                    <p className="text-xs mt-2 m-0" style={{ color: theme.inkMuted }}>** {m.verifyNote}</p>
                  </section>
                )}

                {/* Property */}
                <section className="mt-6">
                  <Heading theme={theme}>{p.title}</Heading>
                  {p.rows.length > 0 && <Rows rows={p.rows} theme={theme} />}
                  <div className="mt-4">
                    <div className="text-[11px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: theme.accentText }}>
                      {p.map.title}
                    </div>
                    {p.map.imageUrl ? (
                      <div className="relative rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.map.imageUrl} alt="" className="block w-full h-auto" />
                        {outline && (
                          <svg
                            viewBox={`0 0 ${outline.width} ${outline.height}`}
                            className="absolute inset-0 w-full h-full"
                            preserveAspectRatio="none"
                            aria-hidden="true"
                          >
                            <polygon points={outlinePointsAttr(outline)} fill="none" stroke="#ffffff" strokeWidth={Math.max(6, outline.width / 100)} />
                            <polygon points={outlinePointsAttr(outline)} fill={rule} fillOpacity="0.25" stroke={rule} strokeWidth={Math.max(3, outline.width / 200)} />
                          </svg>
                        )}
                      </div>
                    ) : null}
                    <p className="text-xs mt-2 m-0" style={{ color: theme.inkMuted }}>{p.map.caption}</p>
                  </div>
                </section>

                {/* Notes */}
                <section className="mt-6">
                  <Heading theme={theme}>{n.title}</Heading>
                  <p className="text-sm m-0" style={{ color: theme.ink }}>{n.emailed}</p>
                  <div className="mt-4 pt-3 space-y-1" style={{ borderTop: `1px solid ${theme.border}` }}>
                    {n.disclaimers.map((d) => (
                      <p key={d} className="text-xs m-0 leading-relaxed" style={{ color: theme.inkMuted }}>{d}</p>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span style={{ color: theme.inkMuted }}>
                      {n.reportIdLabel}: <strong style={{ color: theme.ink }}>{n.reportId || "—"}</strong>
                    </span>
                    <span className="flex gap-3">
                      <a href={pdfHref} className="font-semibold underline" style={{ color: theme.accentText }}>PDF</a>
                      {n.viewOnline && (
                        <a href={n.viewOnline} className="font-semibold underline" style={{ color: theme.accentText }}>{n.viewOnlineLabel}</a>
                      )}
                    </span>
                  </div>
                </section>
              </div>

              <footer className="px-5 py-4 text-center text-xs" style={{ backgroundColor: neutral.bg, color: neutral.fg }}>
                {[company.name, company.email, company.phone].filter(Boolean).join(" · ")}
              </footer>
            </article>
          </section>

          {/* ── What happens next ─────────────────────────────────────────
              The report's own next steps (the visit, then a firm quote),
              then the trade's numbered process — the steps the quote this
              becomes will print, from the same component. */}
          {hasNext && (
            <ProposalSection id={ids.next} kicker={rp.whatHappensNext} title={null} theme={theme}>
              {n.nextSteps.length > 0 && (
                <ol className="m-0 p-0 list-none space-y-2">
                  {n.nextSteps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm text-[#2d2520]">
                      <span
                        className="shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
                        style={{ backgroundColor: fill.bg, color: fill.fg }}
                      >
                        {i + 1}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              )}
              {processSteps.length > 0 && (
                <div className={n.nextSteps.length > 0 ? "mt-6" : ""}>
                  <p className="text-xs font-bold tracking-wider mb-3 uppercase" style={{ color: theme.accentText }}>
                    {copy.howTheWorkRuns}
                  </p>
                  <ProcessStepList steps={processSteps} theme={theme} fill={fill} className="space-y-0" />
                </div>
              )}
            </ProposalSection>
          )}

          <CompanySections proposal={proposal} sectionKeys={proposal.sections} copy={copy} theme={theme} rule={rule} wash={wash} />
        </div>
      </div>

      {/* Phone: the range and the call to action stay pinned at the foot,
          as the quote's total and Accept do. */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-black/10 px-4 py-2.5 flex items-center gap-3">
        {est.rangeText && <span className="font-bold tabular-nums text-[#2d2520] text-sm">{est.rangeText}</span>}
        <a
          href={cta.href}
          className="ml-auto inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-semibold min-h-11 no-underline"
          style={ctaStyle}
        >
          {cta.label}
        </a>
      </div>
    </main>
  );
}
