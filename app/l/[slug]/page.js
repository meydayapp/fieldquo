// app/l/[slug]/page.js
//
// The bio link. One page listing everything a contractor can send traffic to,
// for the single link Instagram and TikTok allow in a profile.
//
// ── Why /l/<slug> ───────────────────────────────────────────────────────────
//
// The string IS the product here. It gets typed into a phone keyboard by the
// contractor, read aloud in a reel, and squeezed into a bio with a character
// limit — so it is as short as it can be while still being a word.
// `fieldquo.com/l/northline` is 24 characters; `/links/` would be four more on
// every one of them for no gain. The slug is the same one /quote, /book and
// /f already use (bookingSlug falling back to slug — see
// lib/booking/findBookingCompany.js), so a company that customised its booking
// address gets one address for everything rather than two.
//
// `l` is a PATH, not a subdomain, so it is outside the reserved-subdomain
// boundary in lib/site/subdomain.js — nothing here can be claimed by a tenant.
// (It could not be a subdomain anyway: that list requires three characters.)
//
// ── Why noindex, but follow ─────────────────────────────────────────────────
//
// Not obvious, and it goes the other way from /quote/<slug>, which is
// deliberately indexed.
//
// Against indexing, decisively: a search result shows its domain. A homeowner
// googling "Northline Painting" and seeing `fieldquo.com/l/northline` has just
// been told which software their contractor uses, on the most public surface
// there is — the exact leak the white-label rule exists to prevent, and one we
// would be creating on purpose. Second, this page is 100% outbound links, so
// ranking it INTERCEPTS a search that would otherwise have landed on the
// contractor's real site or booking page, adds a tap, and costs a lead on a
// bad connection. Third, its traffic comes from a bio, never from a query;
// there is no search intent it is the best answer to.
//
// But `follow: true`, unlike the funnel pages, which are noindex,nofollow. A
// funnel is a closed ad landing page with nothing to pass on. This page is
// nothing BUT links to the contractor's own properties, and nofollowing them
// would throw away the one search signal it can generate — theirs, not ours.
//
// ── "Made by FieldQuo" in the footer — the owner's decision, 2026-09-08 ──────
//
// This used to say the opposite: that the "Site by FieldQuo" credit on free
// websites was a rule about one product, and that extending it here was a
// product decision nobody had made. The owner has now made it. The bio link
// carries a small, muted "Made by FieldQuo" beside the copyright line, as a
// plain link to fieldquo.com.
//
// The reasoning for the exception: unlike a quote or an invoice, a bio link
// is not a document the homeowner reads as coming from the contractor — it is
// a menu, and every menu of this kind on the internet carries its maker's name
// at the bottom. The credit is held to the same measured contrast as the
// copyright line next to it (pageMuted, 4.5:1) so it is legible without being
// the thing you see. Everything ABOVE the footer is still the contractor's
// alone. The settings screen's subtitle says this too, in as many words, so
// nobody discovers it from their own page.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { loadLinkPageData } from "@/lib/links/load";
import { visibleLinks, splitSocial, groupLinks } from "@/lib/links/config";
import { linkGroupLabels } from "@/lib/links/candidates";
import { linkPageTheme } from "@/lib/links/theme";
import { iconForLink, SocialGlyph } from "@/app/components/links/linkIcons";

// The lift on hover and the press on tap. A row that does nothing under the
// thumb reads as a label, not a button, which on a page that is nothing but
// buttons is the whole affordance. Transform and shadow only — the colours
// are literal hex in a style attribute and stay put, so the measured contrast
// on the row is the same at rest, hovered and pressed. motion-reduce turns
// the movement off for people who asked for that; the shadow still marks the
// hover.
const ROW_MOTION =
  "transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] active:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100";

export async function generateMetadata({ params }) {
  // Next 16: params is a Promise.
  const { slug } = await params;
  const data = await loadLinkPageData(slug);
  if (!data || !data.config.published) {
    return { robots: { index: false, follow: false } };
  }
  const { company, config } = data;
  return {
    title: config.headline || company.name,
    // No invented description. A company that wrote nothing gets nothing,
    // rather than a sentence FieldQuo made up appearing under their name.
    ...(config.bio ? { description: config.bio } : {}),
    robots: { index: false, follow: true },
    openGraph: {
      title: config.headline || company.name,
      ...(config.bio ? { description: config.bio } : {}),
      ...(company.logoUrl ? { images: [company.logoUrl] } : {}),
    },
  };
}

export default async function BioLinkPage({ params }) {
  const { slug } = await params;
  const data = await loadLinkPageData(slug);
  if (!data || !data.config.published) notFound();

  const { company, config, candidates } = data;
  const { social, rows } = splitSocial(visibleLinks(candidates, config));
  const sections = groupLinks(rows);
  const headings = linkGroupLabels(company.defaultLanguage);
  const theme = linkPageTheme(company);

  // Every row switched off is still a real state — a contractor may want the
  // page up while they decide. It renders as the header alone rather than as
  // an empty page pretending to be broken.
  return (
    <main
      className="min-h-screen w-full px-5 py-10 sm:py-14"
      style={{ backgroundColor: theme.pageBg }}
    >
      <div className="mx-auto w-full max-w-md">
        <header className="text-center">
          {company.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={company.logoUrl}
              alt={company.name}
              // Fixed box, not intrinsic size: a logo is whatever aspect ratio
              // the contractor uploaded, and a tall one must not push every
              // link below the fold on a phone.
              className="mx-auto h-20 w-20 rounded-2xl object-contain"
              style={{ backgroundColor: theme.cardBg }}
              width={80}
              height={80}
            />
          ) : (
            <span
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-black"
              style={{ backgroundColor: theme.primaryBg, color: theme.primaryFg }}
              aria-hidden="true"
            >
              {initial(company.name)}
            </span>
          )}

          <h1
            className="mt-5 text-xl font-extrabold leading-snug"
            style={{ color: theme.pageInk }}
          >
            {config.headline || company.name}
          </h1>
          {config.bio && (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: theme.pageMuted }}>
              {config.bio}
            </p>
          )}
        </header>

        {/* The icon row sits ABOVE the labelled links: it is where the visitor
            already came from (a profile), so it is context, not the offer,
            and a row of circles under the name reads as part of the header. */}
        {social.length > 0 && (
          <section className="mt-6 text-center" aria-label={headings.follow}>
            <h2
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: theme.pageMuted }}
            >
              {headings.follow}
            </h2>
            <ul className="mt-2 flex flex-wrap justify-center gap-2.5">
              {social.map((link) => (
                <li key={link.key}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener"
                    aria-label={link.label}
                    title={link.label}
                    // 44px circle: the same thumb floor as the rows, in the
                    // shape a social icon is expected to be.
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${ROW_MOTION}`}
                    style={{
                      backgroundColor: theme.cardBg,
                      border: `1px solid ${theme.cardBorder}`,
                    }}
                  >
                    <SocialGlyph platform={link.platform} size={20} style={{ color: theme.cardAccent }} />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav className="mt-8 space-y-7">
          {sections.map((section, sectionIndex) => (
            <section key={section.group} aria-label={headings[section.group]}>
              <h2
                className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: theme.pageMuted }}
              >
                {headings[section.group]}
              </h2>
              <div className="space-y-3">
                {section.rows.map((link, index) => {
                  const Icon = iconForLink(link);
                  // The first row is the offer; the rest are the menu. One
                  // filled button reads as "do this", and a column of nine
                  // identical filled buttons reads as a wall — which is the
                  // thing that makes most link-in-bio pages hard to use
                  // one-handed. Sections follow the contractor's order, so
                  // the first row of the first section is the row they put
                  // first.
                  const primary = sectionIndex === 0 && index === 0;
                  const external = link.kind === "external" || link.kind === "custom";
                  return (
                    <a
                      key={link.key}
                      href={link.url}
                      {...(external
                        ? {
                            target: "_blank",
                            // noopener, but NOT noreferrer: these are the
                            // contractor's own destinations and their
                            // analytics should see where the visit came from.
                            rel: "noopener",
                          }
                        : {})}
                      // min-h-14: a 56px target is the floor for a thumb, and
                      // this page is only ever used with one.
                      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-base font-semibold ${ROW_MOTION}`}
                      style={
                        primary
                          ? { backgroundColor: theme.primaryBg, color: theme.primaryFg }
                          : {
                              backgroundColor: theme.cardBg,
                              color: theme.cardInk,
                              border: `1px solid ${theme.cardBorder}`,
                            }
                      }
                    >
                      <Icon
                        size={20}
                        className="shrink-0"
                        style={{ color: primary ? theme.primaryFg : theme.cardAccent }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">{link.label}</span>
                      <ChevronRight
                        size={18}
                        className="shrink-0 opacity-60"
                        aria-hidden="true"
                      />
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <footer
          className="mt-10 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs"
          style={{ color: theme.pageMuted }}
        >
          <span>
            © {new Date().getFullYear()} {company.name}
          </span>
          <span aria-hidden="true">·</span>
          {/* pageMuted, the same measured colour as the copyright beside it;
              underlined so it is recognisable as a link without a second
              colour to measure. See the header comment for the decision. */}
          <a
            href="https://www.fieldquo.com"
            target="_blank"
            rel="noopener"
            className="underline underline-offset-2"
            style={{ color: theme.pageMuted }}
          >
            Made by FieldQuo
          </a>
        </footer>
      </div>
    </main>
  );
}

function initial(name) {
  const first = String(name || "").trim().charAt(0);
  return first ? first.toUpperCase() : "•";
}
