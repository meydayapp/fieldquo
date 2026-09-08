// app/components/links/LinkPageView.js
//
// The bio-link page, as markup. app/l/[slug]/page.js loads the data and hands
// it here; nothing in this file touches a database, a request or a hook, so
// a check script can render it to static HTML with fixture data and look at
// it — which is how the look below was verified against three hostile brand
// colours in both schemes before it shipped.
//
// ── The look, and where it comes from ───────────────────────────────────────
//
// The owner's verdict on the first version was that it did not look modern
// next to nxt lnk (realvjy's "My Tiny Page"), and asked for THAT look rather
// than something inspired by it. So the proportions below are its: a single
// centred column, the oval avatar in a thin ring, the name at 38px/800 with
// tight tracking, a small muted handle line, the bio as a 22px medium-weight
// paragraph, a row of circular social icons, then sections under 12px
// letter-spaced uppercase headings, each row a bordered 12px-radius card with
// the icon left, the title at 600, and a small solid "opens elsewhere" arrow
// at the right — which on hover lifts a pixel, deepens its border and fades
// in a gradient wash behind the text, and on press scales to .98.
//
// What is NOT its: every colour. nxt lnk ships one fixed palette (and a
// pink-to-blue hover) for one person's page; this page is a different
// contractor's every time, so every value is derived from their brand hex and
// measured in lib/links/theme.js, in a light and a dark scheme. The classes
// below never name a colour — they read `--lp-*` custom properties that
// linkPageTokenCss writes into the <style> at the top of the page, with the
// dark values under a prefers-color-scheme media query. No JavaScript is
// needed for any of it.
//
// Tailwind, not styled-components: nxt lnk is a styled-components project,
// and adding that dependency to carry one page's CSS would be the wrong
// trade. Everything it expresses is expressible in the utilities this app
// already ships, including the ::before gradient (isolate + a negative
// z-index pseudo, which paints above the card's own background and below its
// text — the same trick, in classes).
//
// The typeface is the one the app already loads (Geist, via next/font in
// app/layout.js — `font-sans`). nxt lnk uses Inter; loading a second webfont
// for a page a stranger opens on a driveway connection is not worth the
// weight, and Geist is cut on the same model. No external stylesheet is
// requested by this page beyond what every page requests.

import { linkPageHandle } from "@/lib/links/handle";
import { visibleLinks, splitSocial, groupLinks } from "@/lib/links/config";
import { linkGroupLabels } from "@/lib/links/candidates";
import { linkPageSchemes, linkPageTokenCss } from "@/lib/links/theme";
import { iconForLink, SocialGlyph, NewUpIcon } from "@/app/components/links/linkIcons";

// ── Motion ──────────────────────────────────────────────────────────────────
//
// The lift on hover, the press on tap, and the wash that fades in behind the
// text. Transform, border and the pseudo-element's opacity only — the text
// colours never change, so the measured contrast on a row is the same at
// rest, hovered and pressed (the wash is measured too, against the darker of
// its two stops). Tailwind 4 moves elements with the `translate` and `scale`
// properties, not `transform`, so those are what the transition names.
// motion-reduce turns every movement off for people who asked for that; the
// border change still marks the hover.
const MOTION =
  "transition-[translate,scale,border-color] duration-300 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100";

// The gradient wash. `isolate` gives the card its own stacking context, so a
// `-z-10` ::before paints ABOVE the card's background and BELOW its content —
// exactly nxt lnk's `&::before { z-index: -1 }`, which only works there
// because its boxes have no background. inset-0 keeps it inside the border.
const WASH =
  "relative isolate before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:bg-(image:--lp-hover) before:opacity-0 before:scale-[0.8] before:transition-[opacity,scale] before:duration-300 before:ease-out hover:before:opacity-100 hover:before:scale-100 motion-reduce:before:transition-none motion-reduce:before:scale-100 before:content-['']";

// One bordered card. Border deepens on hover (a second measured token) —
// nxt lnk turns its border transparent and lets the wash bleed 2px past the
// edge; ours keeps the edge because the edge is held to 3:1 against the
// page and is what makes a card a control before anyone hovers it.
const BOX = `${MOTION} ${WASH} border border-(color:--lp-border) bg-(color:--lp-card) text-(color:--lp-card-ink) hover:border-(color:--lp-border-hover)`;

/**
 * @param company     name, logoUrl, brandColor, website, city, province, defaultLanguage
 * @param config      from sanitiseLinkConfig — published, headline, bio, items
 * @param candidates  from linkCandidates
 * @param year        for the footer; injectable so a render check is stable
 * @param scheme      "auto" follows the visitor's prefers-color-scheme — the
 *                    public page. "light"/"dark" pins one, for the settings
 *                    preview's toggle. See linkPageTokenCss.
 * @param inFrame     true inside the settings preview, where the page fills
 *                    a phone-sized box rather than the viewport. It changes
 *                    the two min-heights and nothing else: same tokens, same
 *                    markup, same rows — the preview IS this component, so
 *                    the settings screen cannot drift from the public page.
 */
export default function LinkPageView({
  company,
  config,
  candidates,
  year = new Date().getFullYear(),
  scheme = "auto",
  inFrame = false,
}) {
  const { social, rows } = splitSocial(visibleLinks(candidates, config));
  const headings = linkGroupLabels(company.defaultLanguage);
  const schemes = linkPageSchemes(company);
  const handle = linkPageHandle(company);
  const fill = inFrame ? "min-h-full" : "min-h-screen";

  // The featured pill is nxt lnk's "new product" banner, and it is the row
  // the contractor put first: sections follow their order, so the first row
  // of the first section is the one they chose to lead with. It is lifted
  // OUT of its section rather than shown twice, and a section emptied by
  // that is not rendered as a heading over nothing. A page with no rows at
  // all has no pill — absence is not padded with a button we invented.
  const grouped = groupLinks(rows);
  const featured = grouped[0]?.rows[0] || null;
  const sections = grouped
    .map((section, i) => (i === 0 ? { ...section, rows: section.rows.slice(1) } : section))
    .filter((section) => section.rows.length > 0);

  // Every row switched off is still a real state — a contractor may want the
  // page up while they decide. It renders as the header alone rather than as
  // an empty page pretending to be broken.
  return (
    <main className={`lp ${fill} w-full bg-(color:--lp-page) font-sans text-(color:--lp-ink) antialiased`}>
      <style dangerouslySetInnerHTML={{ __html: linkPageTokenCss(schemes, ".lp", { scheme }) }} />
      <div className={`mx-auto flex ${fill} w-full max-w-[680px] flex-col items-center justify-between px-6 py-6 text-center`}>
        <div className="w-full">
          <header className="mt-5 flex flex-col items-center sm:mt-[60px]">
            {/* The company's LOGO when they uploaded one (Settings →
                Branding), the first letter of their name otherwise — never
                a FieldQuo mark. nxt lnk's oval-clipped avatar with a 3px
                border layer behind it, as a padded circle: the outer ring is
                the brand (or ink, when the brand would vanish against the
                page), the inner disc is the card colour so a transparent
                logo sits on paper in both schemes. The initials fallback is
                painted in the featured pill's tokens, so a brand the page
                can only show ON ink (yellow, light scheme) shows there too.
                A fixed box, not the logo's intrinsic size: a logo is whatever
                aspect ratio the contractor uploaded, and a tall one must not
                push every link below the fold on a phone. */}
            <div className="mb-3 h-24 w-24 rounded-full bg-(color:--lp-ring) p-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.12)] sm:h-28 sm:w-28">
              {/* p-[3px] again inside: nxt lnk's avatar-border and avatar-fill
                  are two layers 6px apart, and without the gap a black brand
                  with no logo is one black disc rather than a ring around
                  one. */}
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-(color:--lp-card) p-[3px]">
                {company.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={company.logoUrl}
                    alt={company.name}
                    className="h-full w-full rounded-full object-contain p-1.5"
                    width={100}
                    height={100}
                  />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center rounded-full bg-(color:--lp-primary) text-4xl font-black text-(color:--lp-on-primary)"
                    aria-hidden="true"
                  >
                    {initial(company.name)}
                  </span>
                )}
              </div>
            </div>

            <h1 className="text-[32px] font-extrabold leading-[1.15] tracking-[-0.05em] sm:text-[38px]">
              {config.headline || company.name}
            </h1>
            {handle && (
              <p className="mt-0.5 text-[15px] font-medium tracking-[-0.02em] text-(color:--lp-muted) sm:mt-1.5 sm:text-lg">
                {handle}
              </p>
            )}
          </header>

          {config.bio && (
            <p className="mx-auto mt-3 max-w-[560px] px-2 text-lg font-medium leading-[26px] tracking-[-0.02em] sm:px-5 sm:text-[22px] sm:leading-[30px]">
              {config.bio}
            </p>
          )}

          {/* The icon row sits ABOVE the labelled links: it is where the
              visitor already came from (a profile), so it is context, not
              the offer, and a row of circles under the name reads as part of
              the header. Its heading is for assistive tech only — nxt lnk
              gives the row no visible label and neither does this. */}
          {social.length > 0 && (
            <section className="mt-5 mb-[18px] sm:mt-6" aria-label={headings.follow}>
              <h2 className="sr-only">{headings.follow}</h2>
              <ul className="flex flex-wrap justify-center gap-1 sm:gap-2">
                {social.map((link) => (
                  <li key={link.key}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener"
                      aria-label={link.label}
                      title={link.label}
                      // 44px on a phone is the thumb floor; 56px on a desktop
                      // is nxt lnk's 24px glyph in 16px of padding.
                      className={`flex h-11 w-11 items-center justify-center rounded-full sm:h-14 sm:w-14 ${BOX}`}
                    >
                      <SocialGlyph
                        platform={link.platform}
                        size={22}
                        className="text-(color:--lp-accent) sm:h-6 sm:w-6"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mx-auto w-full max-w-[440px]">
            {/* The one filled control. Its fill is the brand where the brand
                can be seen against the page; where it can't (yellow on
                light, black on dark) the fill is ink and the TEXT and arrow
                are the brand — lib/links/theme.js, "The brand must be
                SEEN". Either way this pill is the element that says whose
                page it is. */}
            {featured && (
              <div className="pt-3 pb-1">
                <LinkRow
                  link={featured}
                  className={`${MOTION} min-h-14 rounded-full bg-(color:--lp-primary) px-5 py-3.5 text-(color:--lp-on-primary) shadow-[0_1px_2px_rgba(0,0,0,0.12)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.14)] active:shadow-none sm:py-[18px]`}
                  iconClassName="text-(color:--lp-on-primary)"
                  // No fade on the arrow here: on-primary is measured to
                  // 4.5:1 and a 70% blend of exactly that can land under
                  // the 3:1 a glyph needs. The card rows fade theirs
                  // because ink on card never measures under 12:1.
                  arrowClassName=""
                />
              </div>
            )}

            {sections.length > 0 && (
              <nav>
                {sections.map((section) => (
                  <section key={section.group} className="py-3" aria-label={headings[section.group]}>
                    <h2 className="mb-1 text-[11px] uppercase tracking-[4px] text-(color:--lp-muted) sm:text-xs">
                      {headings[section.group]}
                    </h2>
                    {section.rows.map((link) => (
                      <LinkRow
                        key={link.key}
                        link={link}
                        className={`${BOX} my-2 min-h-14 rounded-xl px-4 py-3 sm:px-5 sm:py-[18px]`}
                        iconClassName="text-(color:--lp-accent)"
                      />
                    ))}
                  </section>
                ))}
              </nav>
            )}
          </div>
        </div>

        {/* nxt lnk's LinkFoot: 16px/500 on a 32px line, 12px on a phone,
            in the muted colour. "Made by FieldQuo" is the owner's decision
            (see app/l/[slug]/page.js) and is the same measured colour as the
            copyright beside it, underlined so it is recognisable as a link
            without a second colour to measure. */}
        <footer className="mt-10 mb-4 flex flex-wrap items-center justify-center gap-x-2 text-xs font-medium leading-8 tracking-[-0.2px] text-(color:--lp-muted) sm:mb-6 sm:text-base">
          <span>
            © {year} {company.name}
          </span>
          <span aria-hidden="true" className="text-[10px] leading-8">
            ·
          </span>
          <a
            href="https://www.fieldquo.com"
            target="_blank"
            rel="noopener"
            className="underline underline-offset-2 text-(color:--lp-muted)"
          >
            Made by FieldQuo
          </a>
        </footer>
      </div>
    </main>
  );
}

/**
 * One row: icon, title, arrow. Shared by the featured pill and the cards so
 * the two cannot drift apart in what they render, only in how they are
 * painted.
 */
function LinkRow({ link, className, iconClassName, arrowClassName = "opacity-70" }) {
  const Icon = iconForLink(link);
  const external = link.kind === "external" || link.kind === "custom";
  return (
    <a
      href={link.url}
      {...(external
        ? {
            target: "_blank",
            // noopener, but NOT noreferrer: these are the contractor's own
            // destinations and their analytics should see where the visit
            // came from.
            rel: "noopener",
          }
        : {})}
      className={`flex w-full items-center justify-between gap-3 text-left font-semibold tracking-[-0.03em] ${className}`}
    >
      <span className="flex min-w-0 items-center gap-2.5 text-[15px] sm:text-lg">
        <Icon size={20} className={`shrink-0 ${iconClassName}`} aria-hidden="true" />
        <span className="min-w-0 truncate">{link.label}</span>
      </span>
      <NewUpIcon size={20} className={`shrink-0 scale-[0.8] ${arrowClassName}`} />
    </a>
  );
}

function initial(name) {
  const first = String(name || "").trim().charAt(0);
  return first ? first.toUpperCase() : "•";
}
