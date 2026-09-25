// app/components/public/proposal/ProposalSections.js
//
// The company beside the document — About us, Before & after, Important
// documents, Testimonials, Services — and the numbered "how the work runs"
// steps, as ONE set of components read by both proposal pages:
//
//   app/q/[token]/QuoteApproval.js             the quote (exact prices)
//   app/estimate-report/[token]/ReportView.js  the instant estimate (a range)
//
// ── Why shared, and why here ────────────────────────────────────────────────
//
// The owner asked for "the same presentation but with the range": a homeowner
// who got an instant estimate should see the page a quote opens on — cover,
// story, photos, process, reviews — with the range where the prices would be.
// The sections were written inline in QuoteApproval, so the estimate page had
// two ways to get them: copy the JSX, or share it. A copy is the one that
// rots (AGENTS.md recurring failure 4) — the next change to the gallery lands
// on the quote and not on the estimate, and the two pages a homeowner reads
// from one company drift apart. So the JSX lives here, both pages import it,
// and scripts/check-range-presentation.mjs fails if either grows its own.
//
// No "use client" and no hooks: the quote page is a client component and the
// estimate page is a server component, and both render these as-is. The data
// is the projection lib/proposal/load.js#projectProposal builds for both —
// a section with nothing behind it never reaches here, and nothing here
// selects or prints a price.
//
// Colour: the measured theme (lib/documents/theme.js) for everything derived
// from the brand; the ink is the page's fixed #2d2520 at /70 or darker on
// white, which scripts/check-client-proposal.mjs measures at 5.65:1.

import { FileText, Play, Star } from "lucide-react";

/** The anchors the contents jump to; keys match the server's `sections`. */
export const PROPOSAL_SECTION_IDS = {
  project: "project",
  estimate: "estimate",
  next: "next-steps",
  about: "about",
  beforeAfter: "before-after",
  documents: "documents",
  testimonials: "testimonials",
  services: "services",
};

/** A section's name in the contents, in the document's language. */
export function proposalSectionLabel(key, copy) {
  const p = copy?.proposal || {};
  switch (key) {
    case "project":
      return p.yourProject;
    case "estimate":
      return copy?.rangeProposal?.yourEstimate || p.yourProject;
    case "next":
      return copy?.rangeProposal?.whatHappensNext || copy?.howTheWorkRuns;
    case "about":
      return p.aboutUs;
    case "beforeAfter":
      return p.beforeAfter;
    case "documents":
      return p.importantDocuments;
    case "testimonials":
      return p.testimonials;
    default:
      return p.services;
  }
}

export function SectionKicker({ theme, children }) {
  return (
    <h2
      className="text-xs font-bold tracking-wider mb-3 uppercase"
      style={{ color: theme.accentText }}
    >
      {children}
    </h2>
  );
}

export function ProposalSection({ id, kicker, title, theme, children }) {
  return (
    <section id={id} className="scroll-mt-24 bg-white border border-black/10 rounded-2xl shadow-sm px-6 sm:px-8 py-6">
      <p className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: theme.accentText }}>
        {kicker}
      </p>
      {title && <h2 className="text-lg font-semibold text-[#2d2520] mt-0.5 mb-3">{title}</h2>}
      {!title && <div className="mb-3" />}
      {children}
    </section>
  );
}

/**
 * The trade's numbered process steps — { num, title, body, timeline? }[] from
 * lib/documents/serviceContent.js#dominantProcessSteps. `fill` is the
 * measured fillPair the numbers sit on; the rule between them is the theme's
 * accentRule.
 */
export function ProcessStepList({ steps, theme, fill, className = "space-y-0 mb-3" }) {
  if (!Array.isArray(steps) || !steps.length) return null;
  return (
    <ol className={className}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{ backgroundColor: fill.bg, color: fill.fg }}
              >
                {s.num}
              </span>
              {!last && <span className="w-px flex-1 my-1" style={{ backgroundColor: theme.accentRule }} />}
            </div>
            <div className={last ? "pb-0" : "pb-4"}>
              <p className="text-sm font-semibold text-[#2d2520]">
                {s.title}
                {s.timeline && (
                  <span className="ml-2 text-xs font-normal text-[#2d2520]/70">{s.timeline}</span>
                )}
              </p>
              <p className="text-xs text-[#2d2520]/70 leading-relaxed mt-0.5">{s.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The five company sections, each only when the server listed it in
 * `sectionKeys` AND sent something behind it — the same two tests the quote
 * page always applied.
 */
export function CompanySections({ proposal, sectionKeys, copy, theme, rule, wash }) {
  if (!proposal) return null;
  const on = (key) => Array.isArray(sectionKeys) && sectionKeys.includes(key);
  const ids = PROPOSAL_SECTION_IDS;
  return (
    <>
      {proposal.about && on("about") && (
        <ProposalSection id={ids.about} kicker={copy.proposal.aboutUs} title={proposal.about.headline} theme={theme}>
          <div className={proposal.about.teamPhotoUrl ? "grid gap-4 sm:grid-cols-[1fr_200px] items-start" : ""}>
            <p className="text-sm leading-relaxed text-[#2d2520]/80 whitespace-pre-line">{proposal.about.story}</p>
            {proposal.about.teamPhotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proposal.about.teamPhotoUrl} alt={copy.proposal.teamPhotoAlt} className="w-full rounded-lg border border-black/10 object-cover aspect-[4/3]" />
            )}
          </div>
          {proposal.about.videoUrl && (
            <a
              href={proposal.about.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-sm font-semibold min-h-11"
              style={{ color: theme.accentText }}
            >
              <Play size={14} /> {copy.proposal.watchVideo}
            </a>
          )}
        </ProposalSection>
      )}

      {proposal.gallery?.length > 0 && on("beforeAfter") && (
        <ProposalSection id={ids.beforeAfter} kicker={copy.proposal.beforeAfter} title={copy.proposal.recentWork} theme={theme}>
          <div className="grid gap-4 sm:grid-cols-2">
            {proposal.gallery.map((p, i) => (
              <figure key={i}>
                <div className="grid grid-cols-2 gap-1">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.before} alt={`${copy.proposal.before}${p.caption ? ` — ${p.caption}` : ""}`} className="w-full aspect-[4/3] object-cover rounded-l-md border border-black/10" />
                    <span className="absolute left-1.5 top-1.5 text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#20242b]/80 text-white">{copy.proposal.before.toUpperCase()}</span>
                  </div>
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.after} alt={`${copy.proposal.after}${p.caption ? ` — ${p.caption}` : ""}`} className="w-full aspect-[4/3] object-cover rounded-r-md border border-black/10" />
                    <span className="absolute left-1.5 top-1.5 text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#20242b]/80 text-white">{copy.proposal.after.toUpperCase()}</span>
                  </div>
                </div>
                {p.caption && <figcaption className="text-xs text-[#2d2520]/70 mt-1.5">{p.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </ProposalSection>
      )}

      {proposal.documents?.length > 0 && on("documents") && (
        <ProposalSection id={ids.documents} kicker={copy.proposal.importantDocuments} title={copy.proposal.documentsHeading} theme={theme}>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            {proposal.documents.map((d, i) => (
              <a
                key={i}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-black/10 p-3 hover:border-black/25 flex flex-col"
              >
                <div className="h-14 rounded-md border border-black/10 flex items-center justify-center" style={{ backgroundColor: wash.bg, color: wash.accent }}>
                  <FileText size={22} />
                </div>
                <p className="text-sm font-semibold text-[#2d2520] mt-2 leading-snug">{d.title}</p>
                {d.summary && <p className="text-xs text-[#2d2520]/70 mt-0.5">{d.summary}</p>}
                <span className="text-xs font-bold mt-auto pt-2" style={{ color: theme.accentText }}>
                  {copy.proposal.viewDocument}
                </span>
              </a>
            ))}
          </div>
        </ProposalSection>
      )}

      {proposal.testimonials?.length > 0 && on("testimonials") && (
        <ProposalSection id={ids.testimonials} kicker={copy.proposal.testimonials} title={copy.proposal.whatClientsSaid} theme={theme}>
          <div className="grid gap-3 sm:grid-cols-2">
            {proposal.testimonials.map((r, i) => (
              <blockquote key={i} className="rounded-lg border border-black/10 p-3.5 text-sm">
                <Star size={13} className="inline -mt-0.5 mr-1" style={{ color: "#b45309" }} aria-hidden="true" />
                <span className="text-[#2d2520]/85">“{r.quote}”</span>
                {r.author && <footer className="text-xs text-[#2d2520]/70 mt-2">— {r.author}</footer>}
              </blockquote>
            ))}
          </div>
        </ProposalSection>
      )}

      {proposal.services?.length > 0 && on("services") && (
        <ProposalSection id={ids.services} kicker={copy.proposal.services} title={copy.proposal.whatElseWeDo} theme={theme}>
          <ul className="grid gap-2 grid-cols-2 sm:grid-cols-3">
            {proposal.services.map((sv) => (
              <li key={sv.key} className="rounded-lg border border-black/10 px-3 py-2.5 text-sm font-semibold text-[#2d2520]" style={{ borderLeft: `3px solid ${rule}` }}>
                {sv.label}
              </li>
            ))}
          </ul>
        </ProposalSection>
      )}
    </>
  );
}
