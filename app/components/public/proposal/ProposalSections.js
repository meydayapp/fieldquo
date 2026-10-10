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
// estimate page is a server component, and both render these as-is. The one
// interactive piece, the before/after slider, is its own client component
// (app/components/public/BeforeAfter.js) — an island on the estimate page,
// an ordinary child on the quote page. The data
// is the projection lib/proposal/load.js#projectProposal builds for both —
// a section with nothing behind it never reaches here, and nothing here
// selects or prints a price.
//
// Colour: the measured theme (lib/documents/theme.js) for everything derived
// from the brand; the ink is the page's fixed #2d2520 at /70 or darker on
// white, which scripts/check-client-proposal.mjs measures at 5.65:1.

import { FileText, Play, Star } from "lucide-react";
import BeforeAfter from "@/app/components/public/BeforeAfter";
import { fillPair } from "@/lib/documents/theme";

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
 * The grid for N projects. 3 across on a desktop, 2 on a tablet, 1 on a
 * phone (owner, 2026-10-10, from TrueFinish's quote page) — capped at the
 * number of projects, so two projects are two wide sliders rather than two
 * thirds and a hole, and one is the section's hero, as on the website block.
 * Whole class strings, not built ones, so Tailwind's scanner sees them.
 */
export const PROPOSAL_GALLERY_GRID = {
  1: "grid gap-5 items-start",
  2: "grid gap-5 items-start sm:grid-cols-2",
  3: "grid gap-5 items-start sm:grid-cols-2 lg:grid-cols-3",
};

/**
 * Before & after on the WEB proposal: one slider per project — the website's
 * own component (app/components/public/BeforeAfter.js), not a second one.
 * Same pairs, same order, labels and alt text in the document's language,
 * the grip in the measured brand fill. The PDF and the covering email cannot
 * slide and keep their side-by-side pairs (lib/email/quoteSections.js
 * beforeAfterHtml); nothing here is shared with them.
 *
 * A project with only one photo (the gallery refuses half pairs today —
 * lib/company/gallery.js — so this is belt and braces) is a plain picture
 * under the label of the side it is, never a slider with a broken half.
 */
export function ProposalGallery({ gallery, copy, theme }) {
  const items = (Array.isArray(gallery) ? gallery : []).filter((p) => p && (p.before || p.after));
  if (!items.length) return null;
  const p = copy.proposal;
  const handle = fillPair(theme);
  const sliders = items.filter((x) => x.before && x.after).length;
  return (
    <>
      <div className={PROPOSAL_GALLERY_GRID[Math.min(items.length, 3)]}>
        {items.map((x, i) =>
          x.before && x.after ? (
            <BeforeAfter
              key={i}
              before={x.before}
              after={x.after}
              caption={x.caption || ""}
              radius="rounded-xl"
              theme={theme}
              labels={{ before: p.before, after: p.after }}
              compareLabel={p.compareHint}
              handle={handle}
              fitToPhoto
            />
          ) : (
            <SinglePhoto key={i} src={x.before || x.after} label={x.before ? p.before : p.after} caption={x.caption} theme={theme} />
          ),
        )}
      </div>
      {sliders > 0 && <p className="mt-3 text-xs text-[#2d2520]/70">{p.compareHint}</p>}
    </>
  );
}

function SinglePhoto({ src, label, caption, theme }) {
  return (
    <figure className="m-0">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`${label}${caption ? ` — ${caption}` : ""}`} className="block w-full h-auto rounded-xl" loading="lazy" />
        <span
          className="absolute top-3 left-3 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider pointer-events-none"
          style={{ backgroundColor: theme.paper, color: theme.ink, borderRadius: 4 }}
        >
          {label}
        </span>
      </div>
      {caption && (
        <figcaption className="mt-2.5 text-sm" style={{ color: theme.inkMuted }}>
          {caption}
        </figcaption>
      )}
    </figure>
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
          <ProposalGallery gallery={proposal.gallery} copy={copy} theme={theme} />
        </ProposalSection>
      )}

      {proposal.documents?.length > 0 && on("documents") && (
        <ProposalSection id={ids.documents} kicker={copy.proposal.importantDocuments} title={copy.proposal.documentsHeading} theme={theme}>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            {proposal.documents.map((d, i) => {
              const card = (
                <>
                  <div className="h-14 rounded-md border border-black/10 flex items-center justify-center" style={{ backgroundColor: wash.bg, color: wash.accent }}>
                    <FileText size={22} />
                  </div>
                  <p className="text-sm font-semibold text-[#2d2520] mt-2 leading-snug">{d.title}</p>
                  {d.summary && <p className="text-xs text-[#2d2520]/70 mt-0.5">{d.summary}</p>}
                </>
              );
              // d.url is the page's own token route (lib/media/fileOpen.js
              // clientFileHref), never the stored Cloudinary URL, which this
              // account answers with 401 for a PDF. A document the server could
              // not link is shown without "View document" — never a dead link.
              if (!d.url) {
                return (
                  <div key={i} className="rounded-lg border border-black/10 p-3 flex flex-col">
                    {card}
                  </div>
                );
              }
              return (
                <a
                  key={i}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-black/10 p-3 hover:border-black/25 flex flex-col"
                >
                  {card}
                  <span className="text-xs font-bold mt-auto pt-2" style={{ color: theme.accentText }}>
                    {copy.proposal.viewDocument}
                  </span>
                </a>
              );
            })}
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
