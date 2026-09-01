// app/site/[subdomain]/SiteBlocks.js
//
// Renders the blocks. Shared by the public page and the editor's preview, so
// what a company sees while editing is the same component a visitor gets.
//
// ── Mostly a server component ───────────────────────────────────────────────
// Everything renders on the server and works with JS off. Two blocks are the
// only exceptions — the booking calendar and the quote form — and they mount
// the SAME components /book and /quote use, never copies. Both degrade to a
// plain link if the island fails to load.
//
// ── Every colour comes from their brand ─────────────────────────────────────
// Same documentTheme the quotes and invoices use; contrast is measured, not
// guessed (lib/documents/theme.js). `accent2` is the optional secondary brand
// colour (brandColors.secondary) used only for small, low-risk accents —
// eyebrow rules, stars — never for text that must hit 4.5:1, so an unmeasured
// second hue can't create an unreadable pairing.
//
// ── Variants are layout, never style ────────────────────────────────────────
// A block's `variant` picks between arrangements each checked on a phone. It
// never becomes a colour or a raw style string. See app/data/siteBlocks.js.

import {
  Phone, Mail, MapPin, FileText, CalendarDays, Clock, Menu,
  Wrench, Home, Paintbrush, Hammer, Ruler, Sparkles, ShieldCheck, Star,
} from "lucide-react";
import { neutralPair } from "@/lib/documents/theme";
import { HOME_SLUG } from "@/lib/site/pages";
import { resolveSiteStyle, DEFAULT_SITE_STYLE } from "@/lib/site/siteStyles";
import { groupHours, openState, formatTime } from "@/lib/company/businessHours";
import BookingFlow from "@/app/book/[companySlug]/BookingFlow";
import SelfQuoteFlow from "@/app/quote/[companySlug]/SelfQuoteFlow";
import BeforeAfter from "./BeforeAfter";
import { siteCopy, fill } from "@/lib/site/siteCopy";

// A rotating set of trade-flavoured icons so service cards aren't text-only.
// Cycled by index — we can't map a category to an icon reliably, but variety
// reads as "designed" where a single repeated glyph reads as filler.
const SERVICE_ICONS = [Wrench, Home, Paintbrush, Hammer, Ruler, Sparkles];

// The secondary brand accent, or the primary if none set. Only ever used where
// contrast doesn't gate legibility (rules, star fills, icon tints on wash).
function accent2Of(company, theme) {
  const s = company?.brandColors?.secondary;
  return typeof s === "string" && /^#[0-9a-f]{3,8}$/i.test(s) ? s : theme.accentText;
}

// `showFieldquoCredit` defaults to FALSE, not true. A caller that forgets to
// pass it renders a plain footer, which is merely a missing line; the other
// default puts our name on a paying contractor's website, which is the bug this
// prop exists to stop. Resolved from the plan in page.js — see
// isPaidSubscription in lib/billing/access.js.
export default function SiteBlocks({ blocks, company, theme, fill: fillPairIn, subdomain, style, language, languages = [], menu = [], currentPage, linkBase = "", linkSuffix = "", showFieldquoCredit = false }) {
  // `t` is the copy table for THIS site's language. Threaded to every block
  // rather than imported inside each, so one page always renders in one language
  // and a block can't accidentally read a different one.
  const t = siteCopy(language);
  const visible = blocks.filter((b) => b.visible !== false);
  const fill = fillPairIn;
  const accent2 = accent2Of(company, theme);
  // The design style (lib/site/siteStyles.js) — type scale, weight, rhythm,
  // corner treatment. Falls back to the modern default so a row saved before
  // styles existed still renders.
  const S = style || resolveSiteStyle(DEFAULT_SITE_STYLE);

  return (
    <>
      <SiteHeader company={company} theme={theme} fill={fill} accent2={accent2} blocks={visible} S={S} t={t} language={language} languages={languages} subdomain={subdomain} menu={menu} currentPage={currentPage} linkBase={linkBase} linkSuffix={linkSuffix} />
      <main>
        {visible.map((block) => {
          const props = { block, company, theme, fill, subdomain, accent2, S, t };
          let el = null;
          switch (block.type) {
            case "hero": el = <Hero {...props} />; break;
            case "beforeafter": el = <BeforeAfterBlock {...props} />; break;
            case "process": el = <Process {...props} />; break;
            case "areas": el = <Areas {...props} />; break;
            case "cta": el = <CtaBand {...props} />; break;
            case "credentials": el = <Credentials {...props} />; break;
            case "services": el = <Services {...props} />; break;
            case "about": el = <About {...props} />; break;
            case "gallery": el = <Gallery {...props} />; break;
            case "testimonials": el = <Testimonials {...props} />; break;
            case "faq": el = <Faq {...props} />; break;
            case "quoteform": el = <QuoteForm {...props} />; break;
            case "booking": el = <BookingBlock {...props} />; break;
            case "hours": el = <Hours {...props} />; break;
            case "contact": el = <Contact {...props} />; break;
            default: return null;
          }
          // The anchor the header nav scrolls to. scroll-mt clears the sticky
          // header so the section heading isn't hidden under it.
          const anchorId = NAV_IDS[block.type];
          return (
            <div key={block.id} id={anchorId} className={anchorId ? "scroll-mt-20" : undefined}>
              {el}
            </div>
          );
        })}
      </main>
      <SiteFooter company={company} theme={theme} accent2={accent2} t={t} showFieldquoCredit={showFieldquoCredit} />
    </>
  );
}

/* ── shared scaffold ── */

// `alt` is the section ASKING for a tinted band; the STYLE decides whether it
// gets one. Minimal and editorial set `alternate: false` because their whole
// point is one continuous page separated by rules rather than by colour changes
// — and before this, that field was written by siteStyles.js and read by nothing,
// so those two styles quietly looked like all the others.
//
// A component that passed `onWash` still passes it when the band is suppressed.
// That is safe rather than sloppy: inkOnWash and inkMutedOnWash are contrast-
// adjusted to be legible on a TINT, which makes them darker than their on-paper
// counterparts — so using them on white can only exceed 4.5:1, never fall under.
const Section = ({ children, alt, theme, wide, id, S }) => {
  const banded = Boolean(alt) && S?.alternate !== false;
  const divider = S?.divider || "none";
  return (
    <section
      id={id}
      className={`px-5 sm:px-8 ${S?.sectionPad || "py-16 sm:py-24"}`}
      style={{
        // Always accentWash, never theme.page.
        //
        // `accentUse: "detail"` originally put a neutral page grey here. It
        // measured at 4.40:1 for inkMuted against every brand colour tested —
        // because inkMuted is contrast-checked against PAPER, and theme.page is
        // a shade darker. inkMutedOnWash exists precisely because a wash costs
        // that ~0.1, and a second background with no measured ink pair
        // reintroduced the bug the theme file was written to kill.
        //
        // So "detail" is expressed where it cannot fail a contrast check
        // instead: see CtaBand, which fills with ink rather than the brand.
        ...(banded ? { backgroundColor: theme.accentWash } : null),
        ...(divider === "hairline" ? { borderTop: `1px solid ${theme.border}` } : null),
        ...(divider === "thick" ? { borderTop: `3px solid ${theme.ink}` } : null),
      }}
    >
      <div className={`${wide ? "max-w-6xl" : "max-w-5xl"} mx-auto`}>{children}</div>
    </section>
  );
};

// An eyebrow: a short brand-coloured label with a rule, the device that gives
// each section a considered opening instead of a bare heading.
const Eyebrow = ({ children, accent2 }) =>
  children ? (
    <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em] mb-3" style={{ color: accent2 }}>
      <span className="w-6 h-[2px] rounded-full" style={{ backgroundColor: accent2 }} />
      {children}
    </span>
  ) : null;

// Headings step up a real scale. onWash swaps to the contrast-measured ink for
// tinted backgrounds (inkMuted vs paper drops below 4.5:1 on a wash).
const Heading = ({ children, theme, center, onWash, eyebrow, accent2, S }) =>
  children ? (
    <div className={`mb-8 ${center ? "text-center" : ""} ${center ? "" : "max-w-2xl"}`}>
      {eyebrow && <div className={center ? "flex justify-center" : ""}><Eyebrow accent2={accent2}>{eyebrow}</Eyebrow></div>}
      <h2
        className={`${S?.h2 || "text-3xl sm:text-4xl font-extrabold tracking-[-0.02em]"} leading-[1.08]`}
        style={{
          color: onWash ? theme.inkOnWash : theme.ink,
          textWrap: "balance",
          ...(S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}),
        }}
      >
        {children}
      </h2>
    </div>
  ) : null;

const Intro = ({ children, theme, center, onWash }) =>
  children ? (
    <p
      className={`text-lg leading-relaxed -mt-4 mb-10 ${center ? "text-center max-w-2xl mx-auto" : "max-w-2xl"}`}
      style={{ color: onWash ? theme.inkMutedOnWash : theme.inkMuted }}
    >
      {children}
    </p>
  ) : null;

// Which sections exist → anchor nav, so the single scrolling page navigates
// like a multi-page site (Services / Our Work / Book / FAQ). Order follows the
// page. IDs match the id= passed to each Section.
// Anchor ids stay in English — they are URL fragments, not prose, and a
// translated #services would break every link a company had shared.
const NAV_IDS = {
  services: "services",
  beforeafter: "work",
  gallery: "work",
  about: "about",
  quoteform: "quote",
  booking: "book",
  faq: "faq",
  contact: "contact",
};

const navEntry = (type, t) =>
  NAV_IDS[type]
    ? {
        id: NAV_IDS[type],
        label: {
          services: t.navServices,
          beforeafter: t.navWork,
          gallery: t.navWork,
          about: t.navAbout,
          quoteform: t.navQuote,
          booking: t.navBook,
          faq: t.navFaq,
          contact: t.navContact,
        }[type],
      }
    : null;

function SiteHeader({ company, theme, fill, blocks = [], S, t, language, languages = [], subdomain, menu = [], currentPage, linkBase = "", linkSuffix = "" }) {
  const state = openState(company.businessHours, company.timezone);
  const neutral = neutralPair(theme);
  // Deduped by anchor id, not by block type: `beforeafter` and `gallery` both
  // scroll to #work, so a page with both was showing "Our Work" twice in the
  // nav — two links to the same place, which reads as a bug.
  const nav = [];
  for (const b of blocks) {
    const entry = navEntry(b.type, t);
    if (entry && !nav.some((n) => n.id === entry.id)) nav.push(entry);
  }

  // Multi-page (real menu) vs single-page (anchor nav). A site with more than
  // just Home gets true page links; a one-pager keeps scrolling-section anchors.
  const isMulti = menu.length > 1;
  // Language prefix so a menu link on the French page stays French: primary
  // language lives at the root, others under /<code>.
  const langPrefix = language && language !== languages[0] ? `/${language}` : "";
  // linkBase/linkSuffix let the editor preview build full in-iframe URLs; in
  // production they're empty and the subdomain rewrite handles routing.
  const pageHref = (slug) =>
    slug === HOME_SLUG
      ? `${linkBase}${langPrefix}${linkSuffix}` || "/"
      : `${linkBase}${langPrefix}/${slug}${linkSuffix}`;
  const homeHref = `${linkBase}${langPrefix}${linkSuffix}` || "/";

  // The header is always a solid, in-flow sticky bar. It used to float over the
  // hero (absolute) for some styles, but on a phone the clearance was tight and
  // the top line of the heading slipped UNDER it — reported repeatedly. A solid
  // in-flow header takes its own space, so the hero always starts below it and
  // nothing can ever render under it. Templates still differ by hero layout,
  // type, buttons and section rhythm; losing the transparent-over-photo trick is
  // a cheap price for a header that never eats the headline.
  const overlay = false;

  return (
    <header
      className={`${overlay ? "absolute inset-x-0 top-0" : "sticky top-0 border-b backdrop-blur"} z-40`}
      style={
        overlay
          ? // A gradient rather than a tint: over a photo, a translucent white
            // bar is a grey smear and a transparent one leaves the links fighting
            // whatever is behind them.
            { background: "linear-gradient(to bottom, rgba(0,0,0,.45), transparent)" }
          : { borderColor: theme.border, backgroundColor: `color-mix(in srgb, ${theme.paper || "#ffffff"} 82%, transparent)` }
      }
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-[68px] flex items-center justify-between gap-4">
        {/* min-w-0 WITHOUT shrink-0: this is the part that must give way when a
            long company name meets a phone-width header. It was shrink-0, so at
            375px the name held its full width and pushed the "Get a quote"
            button off the right edge of the screen. */}
        <a href={homeHref} className="flex items-center gap-3 min-w-0 flex-1 lg:flex-initial overflow-hidden">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt={company.name} className="h-9 w-auto max-w-[170px] object-contain" />
          ) : (
            <span
              className="text-base sm:text-lg font-extrabold tracking-[-0.02em] truncate"
              style={{ color: overlay ? "#fff" : theme.accentText }}
            >
              {company.name}
            </span>
          )}
          {state && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={state.open ? { color: theme.positive, backgroundColor: theme.positiveWash } : { color: neutral.fg, backgroundColor: neutral.bg }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: state.open ? theme.positive : neutral.fg }} />
              {state.open
                ? `${t.openUntil} ${formatTime(state.closesAt)}`
                : state.opensAt
                  ? `${t.closedOpens} ${state.opensDay ? `${state.opensDay} ` : ""}${formatTime(state.opensAt)}`
                  : t.closed}
            </span>
          )}
        </a>

        {/* The menu. Multi-page sites get real page links; a one-pager keeps
            the scrolling-section anchors. Desktop only — mobile uses the
            disclosure menu on the right. */}
        {isMulti ? (
          <nav className="hidden md:flex items-center gap-6 mx-auto">
            {menu.map((p) => (
              <a
                key={p.slug}
                href={pageHref(p.slug)}
                aria-current={p.slug === currentPage ? "page" : undefined}
                className={`text-sm transition-colors hover:opacity-70 ${p.slug === currentPage ? "font-bold" : "font-medium"}`}
                style={{ color: overlay ? "rgba(255,255,255,.92)" : (p.slug === currentPage ? theme.accentText : theme.inkMuted) }}
              >
                {p.title}
              </a>
            ))}
          </nav>
        ) : nav.length > 0 ? (
          <nav className="hidden md:flex items-center gap-6 mx-auto">
            {nav.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: overlay ? "rgba(255,255,255,.92)" : theme.inkMuted }}
              >
                {n.label}
              </a>
            ))}
          </nav>
        ) : null}

        <div className="flex items-center gap-3 shrink-0">
          {/* ── Language switcher ────────────────────────────────────────────
              Plain links, not a <select> with JavaScript: each language is a
              real URL, so a search engine indexes the French page as French
              (see the hreflang tags on the page) and a visitor can bookmark or
              share it. A JS-only toggle gives you one indexable page in one
              language, which defeats the point of translating it.

              Shown only when the company has enabled more than one. */}
          {languages.length > 1 && (
            <nav aria-label={t.chooseLanguage} className="hidden sm:flex items-center gap-1">
              {languages.map((code) => {
                const active = code === language;
                return (
                  <a
                    key={code}
                    href={code === languages[0] ? "/" : `/${code}`}
                    hrefLang={code}
                    aria-current={active ? "true" : undefined}
                    className={`px-1.5 py-0.5 text-[11px] font-bold uppercase rounded ${
                      active ? "" : "opacity-50 hover:opacity-100"
                    }`}
                    style={{ color: overlay ? "#fff" : theme.inkMuted }}
                  >
                    {code}
                  </a>
                );
              })}
            </nav>
          )}
          {company.phone && (
            <a href={`tel:${company.phone}`} className="hidden lg:inline text-sm font-semibold whitespace-nowrap" style={{ color: theme.accentText }}>
              {company.phone}
            </a>
          )}
          <a
            href={`/quote/${company.slug}`}
            className={`inline-flex items-center gap-1.5 text-sm px-3.5 sm:px-4 py-2.5 whitespace-nowrap transition-transform hover:-translate-y-0.5 ${S?.button?.weight || "font-bold"} ${S?.button?.shape || S?.pill || "rounded-full"}`}
            style={{ backgroundColor: fill.bg, color: fill.fg }}
          >
            {/* Shorter label on a phone. "Get a quote" plus a long company name
                does not fit in 375px, and the button is the point of the page —
                the name is the part that can be abbreviated. */}
            <span className="sm:hidden">{t.ctaQuoteShort}</span>
            <span className="hidden sm:inline">{t.ctaQuote}</span>
          </a>

          {/* Mobile menu — a native <details> disclosure so it needs no client
              JavaScript (this header is server-rendered). Only for multi-page
              sites; a one-pager has nowhere to navigate but the scroll. */}
          {isMulti && (
            <details className="md:hidden relative">
              <summary
                // w-11 h-11 (44px), not w-9 h-9 (36px): the only nav control
                // on a multi-page mobile site, and it was under the 44px
                // touch-target floor. The icon stays 22px; only the box grew.
                className="list-none cursor-pointer grid place-items-center w-11 h-11 rounded-lg"
                aria-label={t.menu || "Menu"}
                style={{ color: overlay ? "#fff" : theme.accentText }}
              >
                <Menu size={22} />
              </summary>
              <div
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border shadow-xl p-2 z-50"
                style={{ borderColor: theme.border, backgroundColor: theme.paper || "#ffffff" }}
              >
                {menu.map((p) => (
                  <a
                    key={p.slug}
                    href={pageHref(p.slug)}
                    aria-current={p.slug === currentPage ? "page" : undefined}
                    className={`block px-3 py-2.5 rounded-lg text-sm hover:bg-black/5 ${p.slug === currentPage ? "font-bold" : "font-medium"}`}
                    style={{ color: p.slug === currentPage ? theme.accentText : theme.ink }}
                  >
                    {p.title}
                  </a>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────────── Hero ────────────────────────────── */

function HeroActions({ company, theme, fill, ctaLabel, onImage, center, t, S }) {
  const b = S?.button || {};
  const base = `inline-flex items-center gap-2 text-sm transition-transform hover:-translate-y-0.5 ${b.pad || "px-7 py-3.5"} ${b.shape || "rounded-full"} ${b.weight || "font-bold"}`;
  return (
    <div className={`mt-9 flex flex-wrap gap-3 ${center ? "justify-center" : ""}`}>
      <a
        href={`/quote/${company.slug}`}
        className={`${base} ${b.shadow || "shadow-lg"}`}
        style={{ backgroundColor: fill.bg, color: fill.fg }}
      >
        {ctaLabel || t.ctaFreeQuote}
      </a>
      {company.phone && (
        <a
          href={`tel:${company.phone}`}
          className={`${base} border-2`}
          style={{ borderColor: onImage ? "#ffffff" : theme.border, color: onImage ? "#ffffff" : theme.accentText }}
        >
          <Phone size={15} /> {t.call} {company.phone}
        </a>
      )}
    </div>
  );
}

// A trust strip — years/rating/etc aren't in the data model, so instead of
// inventing numbers we surface a single honest reassurance when we have the
// material (a phone to call). Kept minimal precisely to avoid fabrication.
function Hero({ block, company, theme, fill, accent2, S, t }) {
  const { headline, subhead, ctaLabel, backgroundImage } = block.content;
  // Image-led variants degrade to centered with no photo. Listing them rather
  // than testing for "not centered" so adding a text-only variant later can't
  // silently get swallowed by this rule — `minimal` is deliberately absent.
  const IMAGE_LED = ["split", "banner", "overlay", "sidebyside"];
  const variant =
    IMAGE_LED.includes(block.content.variant) && !backgroundImage
      ? "centered"
      : block.content.variant || "centered";
  const title = headline || company.name;
  const place = [company.city, company.province].filter(Boolean).join(", ");
  const serif = S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {};

  // ── minimal: type only, no photo even when one exists ──
  if (variant === "minimal") {
    return (
      <section className={`px-5 sm:px-8 ${S?.heroPad || "py-24 sm:py-32"}`} style={{ backgroundColor: theme.paper || "#fff" }}>
        <div className="max-w-5xl mx-auto">
          <Eyebrow accent2={accent2}>{place || t.localTrusted}</Eyebrow>
          <h1 className={`${S?.h1 || "text-4xl sm:text-6xl font-extrabold"} max-w-[22ch]`} style={{ color: theme.ink, textWrap: "balance", ...serif }}>
            {title}
          </h1>
          {subhead && (
            <p className="mt-6 text-xl sm:text-2xl leading-relaxed max-w-[46ch]" style={{ color: theme.inkMuted }}>
              {subhead}
            </p>
          )}
          <HeroActions company={company} theme={theme} fill={fill} ctaLabel={ctaLabel} t={t} S={S} />
        </div>
      </section>
    );
  }

  // ── editorial: oversized type in a narrow column, photo bleeding off-edge ──
  if (variant === "editorial") {
    return (
      <section className="relative overflow-hidden" style={{ backgroundColor: theme.paper || "#fff" }}>
        <div className={`px-5 sm:px-8 ${S?.heroPad || "py-24 sm:py-32"}`}>
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-10 lg:gap-14 items-center">
            <div>
              <Eyebrow accent2={accent2}>{place || t.localTrusted}</Eyebrow>
              <h1
                className={`${S?.h1 || "text-4xl sm:text-6xl font-extrabold"} max-w-[18ch]`}
                style={{ color: theme.ink, textWrap: "balance", ...serif }}
              >
                {title}
              </h1>
              {subhead && (
                <p className="mt-6 text-lg sm:text-xl leading-relaxed max-w-[40ch]" style={{ color: theme.inkMuted }}>
                  {subhead}
                </p>
              )}
              <HeroActions company={company} theme={theme} fill={fill} ctaLabel={ctaLabel} t={t} S={S} />
            </div>
            {/* Bleeds past the container on the right — the asymmetry is the
                point. -mr on desktop only; on a phone it sits normally, because
                an image running off a 375px screen is just a cropped image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={backgroundImage}
              alt=""
              className={`w-full object-cover aspect-[4/5] lg:aspect-[3/4] lg:-mr-8 xl:-mr-24 ${
                S?.imageTreatment === "square" ? "" : "rounded-3xl"
              }`}
            />
          </div>
        </div>
      </section>
    );
  }

  // ── overlay: words directly on a full-bleed photo, no card ──
  if (variant === "overlay") {
    return (
      <section className="relative min-h-[520px] sm:min-h-[640px] flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={backgroundImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {/* A scrim, not a flat overlay: a flat 55% black over a dark photo kills
            it and over a bright one still leaves white text marginal. Two stops
            keep the top of the image readable and the text area reliably dark. */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(105deg, rgba(0,0,0,.82) 0%, rgba(0,0,0,.55) 45%, rgba(0,0,0,.15) 100%)" }} />
        <div className="relative px-5 sm:px-8 py-20 w-full">
          <div className="max-w-6xl mx-auto">
            <Eyebrow accent2="#ffffff">{place || t.localTrusted}</Eyebrow>
            <h1 className={`${S?.h1 || "text-4xl sm:text-6xl font-extrabold"} max-w-[20ch]`} style={{ color: "#fff", textWrap: "balance", ...serif }}>
              {title}
            </h1>
            {subhead && (
              <p className="mt-5 text-lg sm:text-xl leading-relaxed max-w-[42ch]" style={{ color: "rgba(255,255,255,.92)" }}>
                {subhead}
              </p>
            )}
            <HeroActions company={company} theme={theme} fill={fill} ctaLabel={ctaLabel} onImage t={t} S={S} />
          </div>
        </div>
      </section>
    );
  }

  if (variant === "split" || variant === "sidebyside") {
    // sidebyside is split with the photo first. On mobile both stack text-first,
    // because a phone visitor should read the headline before scrolling past a
    // photo — the flip is a desktop-only decision.
    const photoFirst = variant === "sidebyside";
    return (
      <section className={`px-5 sm:px-8 ${S?.sectionPad || "py-16 sm:py-24"}`} style={{ backgroundColor: theme.accentWash }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className={photoFirst ? "md:order-2" : undefined}>
            <Eyebrow accent2={accent2}>{place || t.localTrusted}</Eyebrow>
            <h1 className={`${S?.h1 || "text-4xl sm:text-6xl font-extrabold tracking-[-0.03em]"} leading-[1.03]`} style={{ color: theme.ink, textWrap: "balance", ...(S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}) }}>
              {title}
            </h1>
            {subhead && <p className="mt-5 text-lg sm:text-xl leading-relaxed max-w-[34ch]" style={{ color: theme.inkMutedOnWash }}>{subhead}</p>}
            <HeroActions company={company} theme={theme} fill={fill} ctaLabel={ctaLabel} t={t} S={S} />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundImage}
            alt=""
            className={`${S?.imageTreatment === "square" ? "" : "rounded-3xl"} w-full object-cover aspect-[4/3] md:aspect-square shadow-2xl ${photoFirst ? "md:order-1" : ""}`}
            style={{ border: `1px solid ${theme.border}` }}
          />
        </div>
      </section>
    );
  }

  if (variant === "banner") {
    return (
      <section className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={backgroundImage} alt="" className="w-full object-cover h-[420px] sm:h-[560px]" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.78), rgba(0,0,0,.25) 45%, transparent)" }} />
        <div className="absolute inset-x-0 bottom-0 px-5 sm:px-8 pb-12 sm:pb-16">
          <div className="max-w-6xl mx-auto">
            <h1 className={`${S?.h1 || "text-4xl sm:text-6xl font-extrabold tracking-[-0.03em]"} leading-[1.02] max-w-2xl`} style={{ color: "#fff", textWrap: "balance", ...(S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}) }}>{title}</h1>
            {subhead && <p className="mt-4 text-lg sm:text-xl leading-relaxed max-w-xl" style={{ color: "rgba(255,255,255,.92)" }}>{subhead}</p>}
            <HeroActions company={company} theme={theme} fill={fill} ctaLabel={ctaLabel} onImage t={t} S={S} />
          </div>
        </div>
      </section>
    );
  }

  // `stat` degrades to centered here and renders its strip separately below —
  // see the statStrip prop threaded from SiteBlocks. An empty strip would be
  // worse than none, so it only appears when there are real numbers.
  return (
    <section className={`relative px-5 sm:px-8 ${S?.heroPad || "py-24 sm:py-32"} overflow-hidden`} style={{ backgroundColor: theme.accentWash }}>
      {backgroundImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={backgroundImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/55" />
        </>
      ) : (
        // A soft brand glow instead of a flat wash — depth without a photo.
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(60% 55% at 50% 0%, ${theme.accentSoft} 0%, transparent 70%)` }} />
      )}
      <div className="relative max-w-3xl mx-auto text-center">
        {!backgroundImage && (
          <div className="flex justify-center"><Eyebrow accent2={accent2}>{place || t.localTrusted}</Eyebrow></div>
        )}
        <h1 className={`${S?.h1 || "text-4xl sm:text-6xl font-extrabold tracking-[-0.03em]"} leading-[1.03]`} style={{ color: backgroundImage ? "#fff" : theme.ink, textWrap: "balance", ...(S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}) }}>
          {title}
        </h1>
        {subhead && (
          <p className="mt-5 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: backgroundImage ? "rgba(255,255,255,.92)" : theme.inkMutedOnWash }}>
            {subhead}
          </p>
        )}
        <HeroActions company={company} theme={theme} fill={fill} ctaLabel={ctaLabel} onImage={Boolean(backgroundImage)} center t={t} S={S} />
      </div>
    </section>
  );
}

/* ──────────────────────────── Services ──────────────────────────── */

function Services({ block, theme, fill, accent2, S, t }) {
  const { heading, intro, items, variant } = block.content;
  if (!items?.length) return null;

  if (variant === "list") {
    return (
      <Section theme={theme} S={S}>
        <Heading theme={theme} eyebrow={t.eyebrowServices} accent2={accent2} S={S}>{heading}</Heading>
        <Intro theme={theme}>{intro}</Intro>
        <div className="divide-y" style={{ borderColor: theme.border }}>
          {items.map((item, i) => (
            <div key={i} className="py-6 first:pt-0 sm:flex sm:gap-8 sm:items-baseline">
              <h3 className="text-xl font-bold sm:w-1/3 shrink-0 tracking-[-0.01em]" style={{ color: theme.accentText }}>{item.name}</h3>
              {item.description && <p className="text-base leading-relaxed mt-1.5 sm:mt-0" style={{ color: theme.inkMuted }}>{item.description}</p>}
            </div>
          ))}
        </div>
      </Section>
    );
  }

  if (variant === "numbered") {
    return (
      <Section theme={theme} wide S={S}>
        <Heading theme={theme} center eyebrow={t.eyebrowProcess} accent2={accent2} S={S}>{heading}</Heading>
        <Intro theme={theme} center>{intro}</Intro>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div key={i} className="rounded-2xl p-6 border" style={{ borderColor: theme.border, backgroundColor: theme.paper || "#fff" }}>
              <span className="inline-grid w-10 h-10 rounded-xl place-items-center text-base font-extrabold mb-4" style={{ backgroundColor: fill.bg, color: fill.fg }}>{i + 1}</span>
              <h3 className="text-lg font-bold" style={{ color: theme.ink }}>{item.name}</h3>
              {item.description && <p className="text-sm mt-2 leading-relaxed" style={{ color: theme.inkMuted }}>{item.description}</p>}
            </div>
          ))}
        </div>
      </Section>
    );
  }

  if (variant === "tiles") {
    // Filled brand tiles. Loud on purpose — this is what pairs with the bold
    // style. fill.bg/fg is the measured pair, so a yellow or mid-grey brand gets
    // a legible tile instead of white-on-yellow.
    return (
      <Section theme={theme} wide S={S}>
        <Heading theme={theme} eyebrow={t.eyebrowServices} accent2={accent2} S={S} center={S?.headingAlign === "center"}>{heading}</Heading>
        <Intro theme={theme} center={S?.headingAlign === "center"}>{intro}</Intro>
        <div className={`grid sm:grid-cols-2 lg:grid-cols-3 ${S?.gap || "gap-4"}`}>
          {items.map((item, i) => {
            const Icon = SERVICE_ICONS[i % SERVICE_ICONS.length];
            return (
              <div key={i} className={`${S?.radius || "rounded-none"} p-7`} style={{ backgroundColor: fill.bg, color: fill.fg }}>
                <Icon size={26} style={{ opacity: 0.85 }} />
                <h3 className={`${S?.h3 || "text-lg font-bold"} mt-5`} style={{ color: fill.fg }}>{item.name}</h3>
                {item.description && (
                  <p className="text-sm mt-2 leading-relaxed" style={{ color: fill.fg, opacity: 0.85 }}>{item.description}</p>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    );
  }

  if (variant === "feature") {
    // Full-width rows, each with a large photograph, sides alternating. The
    // device Montage, S-bottles and Opus all use — the slowest, most premium
    // option, and the reason it's capped at four rows: this is a page you scroll
    // slowly, and twelve of them is a chore rather than a portfolio.
    //
    // Images come from the GALLERY's pool, threaded on the block by the page, so
    // a company doesn't upload the same photo twice. With none, this falls back
    // to `alternating`, which is the same rhythm without pictures.
    const images = Array.isArray(block.content.featureImages) ? block.content.featureImages : [];
    if (images.length) {
      return (
        <Section theme={theme} wide S={S}>
          <Heading theme={theme} eyebrow={t.eyebrowServices} accent2={accent2} S={S} center={S?.headingAlign === "center"}>
            {heading}
          </Heading>
          <Intro theme={theme} center={S?.headingAlign === "center"}>{intro}</Intro>
          <div className="space-y-14 sm:space-y-20">
            {items.slice(0, 4).map((item, i) => {
              const flip = i % 2 === 1;
              const img = images[i % images.length];
              return (
                <div key={i} className="grid sm:grid-cols-2 gap-8 sm:gap-12 items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt=""
                    loading="lazy"
                    className={`w-full object-cover aspect-[4/3] ${
                      S?.imageTreatment === "square" ? "" : S?.radius || "rounded-2xl"
                    } ${flip ? "sm:order-2" : ""}`}
                  />
                  <div className={flip ? "sm:order-1" : undefined}>
                    <span
                      className={`${S?.eyebrow || "text-[11px] font-bold uppercase tracking-[0.18em]"} block mb-2`}
                      style={{ color: accent2 }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3
                      className={S?.h2 || "text-3xl font-extrabold"}
                      style={{ color: theme.ink, ...(S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}) }}
                    >
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className={`${S?.body || "text-base leading-relaxed"} mt-3`} style={{ color: theme.inkMuted }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      );
    }
    // No photos — fall through to the text-only alternating rhythm below.
  }

  if (variant === "alternating" || variant === "feature") {
    // Full-width rows, text side flipping each row. Slow and editorial; the
    // schema comment says three or fewer, and this caps at four so a company
    // that switches to it with twelve services gets a long-but-sane page rather
    // than twelve full-width rows.
    return (
      <Section theme={theme} wide S={S}>
        <Heading theme={theme} eyebrow={t.eyebrowServices} accent2={accent2} S={S}>{heading}</Heading>
        <Intro theme={theme}>{intro}</Intro>
        <div className="divide-y" style={{ borderColor: theme.border }}>
          {items.slice(0, 4).map((item, i) => {
            // Two sides, swapping — not three columns. A 12-column mirror left
            // the heading in the SAME middle column on every row, so the
            // headings ran down the centre of the page and only the body text
            // moved: it read as a broken grid rather than as an alternating one.
            const flip = i % 2 === 1;
            return (
              <div key={i} className="py-10 first:pt-0 grid sm:grid-cols-2 gap-6 sm:gap-12 items-baseline">
                <div className={flip ? "sm:order-2" : undefined}>
                  <span
                    className={`${S?.eyebrow || "text-[11px] font-bold uppercase tracking-[0.18em]"} block mb-2`}
                    style={{ color: accent2 }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3
                    className={S?.h2 || "text-3xl font-extrabold"}
                    style={{ color: theme.ink, ...(S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}) }}
                  >
                    {item.name}
                  </h3>
                </div>
                {item.description && (
                  <p
                    className={`${S?.body || "text-base leading-relaxed"} ${flip ? "sm:order-1" : ""}`}
                    style={{ color: theme.inkMuted }}
                  >
                    {item.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    );
  }

  // cards (default) — elevated with an icon, hover lift, brand-tinted badge.
  return (
    <Section theme={theme} wide S={S}>
      <Heading theme={theme} eyebrow={t.eyebrowServices} accent2={accent2} S={S}>{heading}</Heading>
      <Intro theme={theme}>{intro}</Intro>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((item, i) => {
          const Icon = SERVICE_ICONS[i % SERVICE_ICONS.length];
          return (
            <div
              key={i}
              className={`group ${S?.radius || "rounded-2xl"} p-6 border transition-transform hover:-translate-y-1 hover:shadow-xl`}
              style={{ borderColor: theme.border, backgroundColor: theme.paper || "#fff" }}
            >
              <span className="inline-grid w-12 h-12 rounded-xl place-items-center mb-4" style={{ backgroundColor: theme.accentWash, color: theme.accentText }}>
                <Icon size={22} />
              </span>
              <h3 className="text-lg font-bold tracking-[-0.01em]" style={{ color: theme.ink }}>{item.name}</h3>
              {item.description && <p className="text-sm mt-2 leading-relaxed" style={{ color: theme.inkMuted }}>{item.description}</p>}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ───────────────────────── About / Gallery ──────────────────────── */

function About({ block, theme, accent2, S, t }) {
  const { heading, body, image, variant } = block.content;
  if (!body && !image) return null;
  const serif = S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {};

  // ── quote: the first sentence pulled out large ──
  if (variant === "quote" && body) {
    // Split on the first sentence end, not on a fixed character count: cutting
    // mid-sentence to hit a length is how a pull-quote ends up saying something
    // the company didn't write.
    const match = body.match(/^([^.!?]+[.!?])\s*([\s\S]*)$/);
    const lead = match ? match[1] : body;
    const rest = match ? match[2] : "";
    return (
      <Section theme={theme} alt S={S}>
        <Heading theme={theme} onWash eyebrow={t.eyebrowAbout} accent2={accent2} S={S} center={S?.headingAlign === "center"}>{heading}</Heading>
        <blockquote className={`${S?.h2 || "text-3xl sm:text-4xl font-extrabold"} max-w-3xl m-0 leading-[1.15]`} style={{ color: theme.inkOnWash, textWrap: "balance", ...serif }}>
          {lead}
        </blockquote>
        {rest && (
          <p className="mt-6 text-lg leading-relaxed whitespace-pre-wrap max-w-2xl" style={{ color: theme.inkMutedOnWash }}>
            {rest}
          </p>
        )}
      </Section>
    );
  }

  // ── simple: one readable column, no photo slot ──
  if (variant === "simple" || !image) {
    return (
      <Section theme={theme} alt S={S}>
        <Heading theme={theme} onWash eyebrow={t.eyebrowAbout} accent2={accent2} S={S} center={S?.headingAlign === "center"}>{heading}</Heading>
        {body && (
          <p className={`${S?.body || "text-lg leading-relaxed"} whitespace-pre-wrap max-w-2xl ${S?.headingAlign === "center" ? "mx-auto text-center" : ""}`} style={{ color: theme.inkMutedOnWash }}>
            {body}
          </p>
        )}
      </Section>
    );
  }

  // ── withphoto (default when an image exists) ──
  return (
    <Section theme={theme} alt S={S}>
      <div className="grid sm:grid-cols-2 gap-10 items-center">
        <div>
          <Heading theme={theme} onWash eyebrow={t.eyebrowAbout} accent2={accent2} S={S}>{heading}</Heading>
          {body && <p className={`${S?.body || "text-lg leading-relaxed"} whitespace-pre-wrap`} style={{ color: theme.inkMutedOnWash }}>{body}</p>}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className={`${S?.imageTreatment === "square" ? "" : "rounded-3xl"} w-full object-cover aspect-[4/3] shadow-2xl`} style={{ border: `1px solid ${theme.border}` }} />
      </div>
    </Section>
  );
}

function Gallery({ block, theme, accent2, S, t }) {
  const { heading, intro, images, variant } = block.content;
  if (!images?.length) return null;
  const round = S?.imageTreatment === "square" ? "" : S?.radius || "rounded-2xl";

  if (variant === "strip") {
    // One horizontal scrolling row. The right answer with two or three photos —
    // a 4-column grid with three items leaves a visible hole — and the best
    // answer on a phone whatever the count.
    return (
      <Section theme={theme} wide S={S}>
        <Heading theme={theme} eyebrow={t.eyebrowWork} accent2={accent2} S={S} center={S?.headingAlign === "center"}>{heading}</Heading>
        <Intro theme={theme} center={S?.headingAlign === "center"}>{intro}</Intro>
        {/* Negative margin so the row bleeds to the screen edge on a phone,
            which is the cue that it scrolls. snap-x makes the swipe land. */}
        <div className="-mx-5 sm:-mx-8 px-5 sm:px-8 overflow-x-auto snap-x snap-mandatory flex gap-4 pb-2">
          {images.map((src, i) => (
            <div key={i} className={`shrink-0 snap-start w-[78%] sm:w-[42%] lg:w-[30%] overflow-hidden ${round}`} style={{ border: `1px solid ${theme.border}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover" />
            </div>
          ))}
        </div>
      </Section>
    );
  }

  if (variant === "masonry") {
    // CSS columns, not a grid: images keep their own aspect ratio and stack into
    // whatever height they are, which is what makes it read as curated rather
    // than cropped. Needs four or more to look deliberate.
    return (
      <Section theme={theme} wide S={S}>
        <Heading theme={theme} eyebrow={t.eyebrowWork} accent2={accent2} S={S} center={S?.headingAlign === "center"}>{heading}</Heading>
        <Intro theme={theme} center={S?.headingAlign === "center"}>{intro}</Intro>
        <div className="columns-2 lg:columns-3 gap-4 [&>*]:mb-4">
          {images.map((src, i) => (
            <div key={i} className={`overflow-hidden ${round} break-inside-avoid`} style={{ border: `1px solid ${theme.border}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="w-full h-auto object-cover" />
            </div>
          ))}
        </div>
      </Section>
    );
  }

  // A mixed masonry-ish rhythm: the first image spans two columns so the grid
  // reads as a portfolio, not a contact sheet of identical squares.
  return (
    <Section theme={theme} wide S={S}>
      <Heading theme={theme} eyebrow={t.eyebrowWork} accent2={accent2} S={S}>{heading}</Heading>
      <Intro theme={theme}>{intro}</Intro>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {images.map((src, i) => (
          <div
            key={i}
            className={`overflow-hidden rounded-2xl ${i % 5 === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`}
            style={{ border: `1px solid ${theme.border}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
          </div>
        ))}
      </div>
    </Section>
  );
}

function Testimonials({ block, theme, accent2, S, t }) {
  const { heading, items, variant } = block.content;
  if (!items?.length) return null;
  const initials = (name) =>
    String(name || "").replace(/[^a-zA-Z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "★";
  if (variant === "single" || items.length === 1) {
    // One quote, very large. A grid of one card looks like three failed to load,
    // and one good testimonial is the common case for a company just starting
    // out — so this is the honest treatment of it, not a consolation prize.
    const item = items[0];
    return (
      <Section theme={theme} alt S={S}>
        <div className={S?.headingAlign === "center" ? "text-center" : ""}>
          <div className={S?.headingAlign === "center" ? "flex justify-center" : ""}>
            <Eyebrow accent2={accent2}>{item.eyebrowTestimonials}</Eyebrow>
          </div>
          <div className="flex gap-1 mb-6" style={{ color: accent2, justifyContent: S?.headingAlign === "center" ? "center" : "flex-start" }} aria-label={item.fiveStars}>
            {[0, 1, 2, 3, 4].map((x) => <Star key={x} size={20} fill="currentColor" strokeWidth={0} />)}
          </div>
          <blockquote
            className={`${S?.h2 || "text-3xl sm:text-4xl font-extrabold"} m-0 max-w-4xl leading-[1.2] ${S?.headingAlign === "center" ? "mx-auto" : ""}`}
            style={{ color: theme.inkOnWash, textWrap: "balance", ...(S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}) }}
          >
            “{item.quote}”
          </blockquote>
          {item.author && (
            <p className="mt-6 text-base font-semibold" style={{ color: theme.inkMutedOnWash }}>
              — {item.author}
            </p>
          )}
        </div>
      </Section>
    );
  }

  if (variant === "strip") {
    return (
      <Section theme={theme} alt wide S={S}>
        <Heading theme={theme} onWash center={S?.headingAlign === "center"} eyebrow={t.eyebrowTestimonials} accent2={accent2} S={S}>{heading}</Heading>
        <div className="-mx-5 sm:-mx-8 px-5 sm:px-8 overflow-x-auto snap-x snap-mandatory flex gap-4 pb-2">
          {items.map((item, i) => (
            <figure key={i} className={`shrink-0 snap-start w-[82%] sm:w-[46%] lg:w-[32%] ${S?.radius || "rounded-2xl"} p-6 m-0 shadow-sm`} style={{ backgroundColor: theme.paper || "#fff", border: `1px solid ${theme.border}` }}>
              <div className="flex gap-0.5 mb-3" style={{ color: accent2 }} aria-label={item.fiveStars}>
                {[0, 1, 2, 3, 4].map((x) => <Star key={x} size={15} fill="currentColor" strokeWidth={0} />)}
              </div>
              <blockquote className="text-base leading-relaxed m-0" style={{ color: theme.ink }}>{item.quote}</blockquote>
              {item.author && <figcaption className="mt-4 text-sm font-semibold" style={{ color: theme.ink }}>{item.author}</figcaption>}
            </figure>
          ))}
        </div>
      </Section>
    );
  }

  return (
    <Section theme={theme} alt wide S={S}>
      <Heading theme={theme} onWash center eyebrow={t.eyebrowTestimonials} accent2={accent2} S={S}>{heading}</Heading>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((item, i) => (
          <figure key={i} className={`${S?.radius || "rounded-2xl"} p-6 shadow-sm`} style={{ backgroundColor: theme.paper || "#fff", border: `1px solid ${theme.border}` }}>
            <div className="flex gap-0.5 mb-3" style={{ color: accent2 }} aria-label={item.fiveStars}>
              {[0, 1, 2, 3, 4].map((s) => <Star key={s} size={15} fill="currentColor" strokeWidth={0} />)}
            </div>
            <blockquote className="text-base leading-relaxed" style={{ color: theme.ink }}>{item.quote}</blockquote>
            {item.author && (
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="grid w-10 h-10 rounded-full place-items-center text-sm font-bold" style={{ backgroundColor: theme.accentWash, color: theme.accentText }}>{initials(item.author)}</span>
                <span className="text-sm font-semibold" style={{ color: theme.ink }}>{item.author}</span>
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </Section>
  );
}

// FAQ — an accordion using <details> so it's interactive with zero JavaScript
// (native disclosure), which keeps the server-only guarantee intact.
function Faq({ block, theme, accent2, S, t }) {
  const { heading, items } = block.content;
  if (!items?.length) return null;
  return (
    <Section theme={theme} S={S}>
      <Heading theme={theme} eyebrow={t.eyebrowFaq} accent2={accent2} S={S}>{heading}</Heading>
      <div className="max-w-3xl">
        {items.map((qa, i) => (
          <details key={i} className="group border-b" style={{ borderColor: theme.border }}>
            <summary className="flex items-center justify-between gap-4 cursor-pointer py-5 list-none text-lg font-semibold" style={{ color: theme.ink }}>
              {qa.question}
              <span className="shrink-0 grid w-7 h-7 rounded-lg place-items-center text-lg leading-none transition-transform group-open:rotate-45" style={{ backgroundColor: theme.accentWash, color: theme.accentText }}>+</span>
            </summary>
            {qa.answer && <p className="pb-5 text-base leading-relaxed max-w-[64ch]" style={{ color: theme.inkMuted }}>{qa.answer}</p>}
          </details>
        ))}
      </div>
    </Section>
  );
}

/* ──────────────────── Blocks driven by company data ─────────────── */

function QuoteForm({ block, company, theme, accent2, S, t }) {
  const { heading, intro } = block.content;
  return (
    <Section theme={theme} alt wide S={S}>
      <Heading theme={theme} center onWash eyebrow={t.eyebrowQuote} accent2={accent2} S={S}>{heading}</Heading>
      <Intro theme={theme} center onWash>{intro}</Intro>
      <div className="rounded-3xl border overflow-hidden shadow-xl" style={{ borderColor: theme.border, backgroundColor: theme.paper || "#fff" }}>
        <SelfQuoteFlow companySlug={company.slug} />
      </div>
      <noscript>
        <p className="text-sm mt-4 text-center" style={{ color: theme.inkMutedOnWash }}>
          <a href={`/quote/${company.slug}`} className="underline">{t.openQuoteForm}</a>
        </p>
      </noscript>
    </Section>
  );
}

function BookingBlock({ block, company, theme, accent2, S, t }) {
  const { heading, intro } = block.content;
  // Works off the company slug even without a custom bookingSlug — findBooking
  // Company resolves either. The BookingFlow degrades to a friendly message if
  // no one has set availability yet, so this is never a dead calendar.
  const slug = company.bookingSlug || company.slug;
  if (!slug) return null;
  return (
    <Section theme={theme} wide S={S}>
      <Heading theme={theme} center eyebrow={t.eyebrowBook} accent2={accent2} S={S}>{heading}</Heading>
      <Intro theme={theme} center>{intro}</Intro>
      <div className="rounded-3xl border overflow-hidden shadow-xl" style={{ borderColor: theme.border, backgroundColor: theme.paper || "#fff" }}>
        <BookingFlow companySlug={slug} />
      </div>
      <noscript>
        <p className="text-sm mt-4 text-center" style={{ color: theme.inkMuted }}>
          <a href={`/book/${slug}`} className="underline">{t.openBookingCalendar}</a>
        </p>
      </noscript>
    </Section>
  );
}

// Google Static Map for the contact section — a real map reads as a real
// business. Centres on the address string (no geocoding needed) when the
// public Maps key is set. An <img>, so the key only ever appears in a src
// (referrer-restrict it to fieldquo.com).
function staticMapUrl(address) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key || !address) return null;
  const c = encodeURIComponent(address);
  return `https://maps.googleapis.com/maps/api/staticmap?center=${c}&zoom=14&size=640x260&scale=2&markers=color:0x33333300%7C${c}&key=${key}`;
}

function Hours({ block, company, theme, accent2, S, t }) {
  const { heading, note } = block.content;
  const runs = groupHours(company.businessHours, { weekStartsOn: company.weekStartsOn ?? 0 });
  if (!runs.some((r) => !r.closed)) return null;
  const state = openState(company.businessHours, company.timezone);
  return (
    <Section theme={theme} S={S}>
      <div className="max-w-md mx-auto text-center">
        <span className="inline-grid w-12 h-12 rounded-2xl place-items-center mb-4 mx-auto" style={{ backgroundColor: theme.accentWash, color: theme.accentText }}>
          <Clock size={22} />
        </span>
        <Heading theme={theme} center accent2={accent2} S={S}>{heading}</Heading>
        {state && (
          <p className="text-sm font-semibold -mt-4 mb-7" style={{ color: state.open ? theme.positive : theme.inkMuted }}>
            {state.open ? t.openNow : t.closedNow}
          </p>
        )}
        <dl className="text-left rounded-2xl border overflow-hidden" style={{ borderColor: theme.border }}>
          {runs.map((run) => (
            <div key={run.days.join("-")} className="flex justify-between gap-6 px-5 py-3 border-b last:border-0" style={{ borderColor: theme.border }}>
              <dt className="font-semibold" style={{ color: theme.ink }}>{run.label}</dt>
              <dd className="text-right tabular-nums" style={{ color: run.closed ? theme.inkFaint : theme.inkMuted }}>{run.hours}</dd>
            </div>
          ))}
        </dl>
        {note && <p className="text-sm mt-5 leading-relaxed" style={{ color: theme.inkMuted }}>{note}</p>}
      </div>
    </Section>
  );
}

function Contact({ block, company, theme, fill, accent2, S, t }) {
  const { heading, intro, showQuoteLink, showBookingLink } = block.content;
  // The address field already holds the full formatted address from signup, so
  // appending city/province again produced "…Scarborough, ON…, Toronto, ON".
  // Use the address as-is; fall back to city/province only when it's absent.
  const place = company.address || [company.city, company.province].filter(Boolean).join(", ");
  const mapUrl = staticMapUrl(place);
  return (
    <Section theme={theme} S={S}>
      <div className="text-center">
        <Heading theme={theme} center eyebrow={t.eyebrowContact} accent2={accent2} S={S}>{heading}</Heading>
        {intro && <p className="text-lg leading-relaxed max-w-2xl mx-auto -mt-4 mb-2" style={{ color: theme.inkMuted }}>{intro}</p>}
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          {showQuoteLink !== false && (
            <a href={`/quote/${company.slug}`} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold shadow-lg transition-transform hover:-translate-y-0.5" style={{ backgroundColor: fill.bg, color: fill.fg }}>
              <FileText size={16} /> {t.ctaQuote}
            </a>
          )}
          {showBookingLink !== false && (
            <a href={`/book/${company.bookingSlug || company.slug}`} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold border-2" style={{ borderColor: theme.border, color: theme.accentText }}>
              <CalendarDays size={16} /> {t.ctaBook}
            </a>
          )}
        </div>
        {/* break-words on each item: a company's own email/address is free
            text with no length cap, and an email address in particular has
            no spaces to wrap at. Without it, one long enough email pushes
            this flex row past the viewport width on a phone instead of
            wrapping inside its own pill — flex-wrap only moves whole items
            to a new line, it doesn't shrink the text within one. */}
        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 justify-center text-sm" style={{ color: theme.inkMuted }}>
          {company.phone && <a href={`tel:${company.phone}`} className="inline-flex items-center gap-2 break-words"><Phone size={15} /> {company.phone}</a>}
          {company.email && <a href={`mailto:${company.email}`} className="inline-flex items-center gap-2 break-words min-w-0"><Mail size={15} /> {company.email}</a>}
          {place && <span className="inline-flex items-center gap-2 break-words"><MapPin size={15} /> {place}</span>}
        </div>
        {mapUrl && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(place)}`}
            target="_blank"
            rel="noreferrer"
            className="block mt-8 rounded-2xl overflow-hidden border max-w-3xl mx-auto"
            style={{ borderColor: theme.border }}
          >
            {/* A background-image, not an <img>, and deliberately.
                //
                // The Maps key is referrer-restricted (which is correct — see
                // staticMapUrl), and Google refuses any request it doesn't like:
                // wrong referrer, Static Maps not enabled on the key, quota. An
                // <img> that fails renders the browser's broken-image glyph in
                // the contact section of a live customer-facing page. A
                // background-image that fails renders the tinted panel underneath
                // and nobody can tell.
                //
                // The map is decoration — the address text above it is the actual
                // information — so failing invisibly is the right behaviour, and
                // it costs no JavaScript to get. */}
            <div
              role="img"
              aria-label={`Map of ${place}`}
              className="w-full aspect-[64/26] bg-center bg-cover"
              style={{
                backgroundImage: `url("${mapUrl}")`,
                backgroundColor: theme.accentWash,
              }}
            />
          </a>
        )}
      </div>
    </Section>
  );
}


/* ─────────────────── Before & after (the slider) ────────────────── */

function BeforeAfterBlock({ block, theme, accent2, S, t }) {
  const { heading, intro, pairs } = block.content;
  // A pair with one side missing was already dropped by the sanitiser; this is
  // the "company removed both photos" case. Rendering a heading over nothing is
  // the empty-section failure, so the whole block goes.
  const usable = (pairs || []).filter((x) => x?.before && x?.after);
  if (!usable.length) return null;

  return (
    <Section theme={theme} wide S={S}>
      <Heading theme={theme} eyebrow={t.eyebrowBeforeAfter} accent2={accent2} S={S} center={S?.headingAlign === "center"}>
        {heading}
      </Heading>
      <Intro theme={theme} center={S?.headingAlign === "center"}>{intro}</Intro>
      {/* One pair gets the full width — it's the hero of the section. Several go
          two-up, because a column of full-width sliders is a very long page. */}
      <div className={usable.length === 1 ? "" : `grid sm:grid-cols-2 ${S?.gap || "gap-6"}`}>
        {usable.slice(0, 6).map((pair, i) => (
          <BeforeAfter
            key={i}
            before={pair.before}
            after={pair.after}
            caption={pair.caption}
            radius={S?.radius || "rounded-2xl"}
            theme={theme}
          />
        ))}
      </div>
      <p className="mt-4 text-sm" style={{ color: theme.inkMuted }}>
        {t.dragToCompare}
      </p>
    </Section>
  );
}

/* ──────────────────────── How it works ─────────────────────── */

function Process({ block, theme, fill, accent2, S, t }) {
  const { heading, intro, steps } = block.content;
  // Empty when AI didn't run: there is no honest way to invent a company's
  // process, so the section simply isn't there rather than showing four
  // placeholder cards.
  if (!steps?.length) return null;

  return (
    <Section theme={theme} alt wide S={S}>
      <Heading theme={theme} onWash eyebrow={t.eyebrowProcess} accent2={accent2} S={S} center={S?.headingAlign === "center"}>
        {heading}
      </Heading>
      <Intro theme={theme} onWash center={S?.headingAlign === "center"}>{intro}</Intro>
      <ol className={`grid sm:grid-cols-2 lg:grid-cols-4 ${S?.gap || "gap-6"} list-none p-0 m-0`}>
        {steps.slice(0, 4).map((step, i) => (
          <li key={i} className="relative">
            {/* The connector line between steps. Hidden on the last one and on
                mobile, where the steps stack and a horizontal rule would point
                at nothing. */}
            {i < Math.min(steps.length, 4) - 1 && (
              <span
                aria-hidden="true"
                className="hidden lg:block absolute top-5 left-12 right-0 h-px"
                style={{ backgroundColor: theme.accentRule }}
              />
            )}
            <span
              className={`relative inline-grid w-10 h-10 ${S?.radiusSm || "rounded-xl"} place-items-center text-base font-extrabold mb-4`}
              style={{ backgroundColor: fill.bg, color: fill.fg }}
            >
              {i + 1}
            </span>
            <h3 className={S?.h3 || "text-lg font-bold"} style={{ color: theme.inkOnWash }}>
              {step.title}
            </h3>
            {step.body && (
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: theme.inkMutedOnWash }}>
                {step.body}
              </p>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ──────────────────────── Areas we serve ─────────────────────── */

function Areas({ block, company, theme, accent2, S, t }) {
  const { heading, intro } = block.content;
  // From the company's own WorkArea rows, passed down on `company`. Never a
  // typed list: a typed list of towns is the first thing to go stale, and a
  // homeowner in a town you quietly dropped is a wasted call for both of you.
  const areas = Array.isArray(company?.workAreas) ? company.workAreas : [];
  if (!areas.length) return null;

  return (
    <Section theme={theme} S={S}>
      <Heading theme={theme} eyebrow={t.eyebrowAreas} accent2={accent2} S={S} center={S?.headingAlign === "center"}>
        {heading}
      </Heading>
      <Intro theme={theme} center={S?.headingAlign === "center"}>{intro}</Intro>
      <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
        {areas.slice(0, 40).map((area, i) => (
          <li
            key={i}
            className={`px-3.5 py-1.5 text-sm font-medium border ${S?.pill || "rounded-full"}`}
            style={{ borderColor: theme.accentRule, color: theme.ink, backgroundColor: theme.paper || "#fff" }}
          >
            {typeof area === "string" ? area : area?.name}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ──────────────────── Credentials & numbers ─────────────────── */

function Credentials({ block, theme, fill, accent2, S, t }) {
  const { heading, intro, items, variant } = block.content;
  const usable = (items || []).filter((i) => i?.value || i?.label || i?.logo);
  // Empty until the company types their own. Nothing here is inferable and
  // several of these are legal claims — see the schema note.
  if (!usable.length) return null;

  // ── badges: manufacturer logos in a row ──
  if (variant === "badges") {
    return (
      <Section theme={theme} wide S={S}>
        <Heading theme={theme} eyebrow={t.eyebrowCredentials} accent2={accent2} S={S} center={S?.headingAlign === "center"}>
          {heading}
        </Heading>
        <Intro theme={theme} center={S?.headingAlign === "center"}>{intro}</Intro>
        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ${S?.gap || "gap-4"}`}>
          {usable.map((item, i) => (
            <div
              key={i}
              className={`flex flex-col items-center justify-center text-center p-5 border ${S?.radius || "rounded-2xl"}`}
              style={{ borderColor: theme.border, backgroundColor: theme.paper || "#fff" }}
            >
              {item.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.logo} alt="" className="h-10 w-auto max-w-[8rem] object-contain mb-2.5" loading="lazy" />
              ) : (
                <ShieldCheck size={24} style={{ color: accent2 }} className="mb-2.5" />
              )}
              <span className="text-sm font-bold" style={{ color: theme.ink }}>{item.value || item.label}</span>
              {item.value && item.label && (
                <span className="text-xs mt-0.5" style={{ color: theme.inkMuted }}>{item.label}</span>
              )}
            </div>
          ))}
        </div>
      </Section>
    );
  }

  // ── strip: a slim band, no heading. Sits directly under a hero. ──
  if (variant === "strip") {
    return (
      <section className="px-5 sm:px-8 py-8 sm:py-10" style={{ backgroundColor: fill.bg }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {usable.slice(0, 4).map((item, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl sm:text-4xl font-extrabold tabular-nums" style={{ color: fill.fg }}>
                {item.value}
              </div>
              <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: fill.fg, opacity: 0.8 }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ── stats (default): big numerals on a wash ──
  return (
    <Section theme={theme} alt wide S={S}>
      <Heading theme={theme} onWash eyebrow={t.eyebrowNumbers} accent2={accent2} S={S} center={S?.headingAlign === "center"}>
        {heading}
      </Heading>
      <Intro theme={theme} onWash center={S?.headingAlign === "center"}>{intro}</Intro>
      <div className={`grid grid-cols-2 lg:grid-cols-4 ${S?.gap || "gap-6"}`}>
        {usable.map((item, i) => (
          <div key={i}>
            {/* The number, deliberately oversized. On the reference sites this is
                the one place type goes bigger than the headline. */}
            <div
              className="text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] tabular-nums"
              style={{ color: theme.accentText, ...(S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}) }}
            >
              {item.value}
            </div>
            <div className="text-sm mt-1.5 leading-snug" style={{ color: theme.inkMutedOnWash }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────────── Call-to-action band ──────────────────── */

function CtaBand({ block, company, theme, fill, S, t }) {
  const { heading, sub, buttonLabel } = block.content;
  if (!heading && !sub) return null;

  // This is where `accentUse` lives. A style that says "brand colour for details
  // only" gets an INK band rather than a brand-coloured one — a real and obvious
  // visual difference between, say, Minimal and Bold, expressed as a choice
  // between two pairs that are both already contrast-measured. The alternative
  // (a third background colour) is how the 4.40:1 bug above happened.
  const band =
    S?.accentUse === "detail" ? { bg: theme.ink, fg: "#ffffff" } : fill;

  const quoteHref = company?.slug ? `/quote/${company.slug}` : null;
  const bookHref = company?.bookingSlug || company?.slug ? `/book/${company.bookingSlug || company.slug}` : null;

  // ── image: full-bleed photograph, words over it ──
  //
  // The closing device on almost every site in the reference set. Needs an image;
  // with none it falls through to the filled band below rather than rendering a
  // scrim over nothing.
  const bg = block.content.backgroundImage;
  if (block.content.variant === "image" && bg) {
    return (
      <section className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        {/* Two stops, same reasoning as the overlay hero: a flat scrim kills a
            dark photo and still leaves white text marginal over a bright one. */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.82), rgba(0,0,0,.45))" }} />
        <div className={`relative px-5 sm:px-8 ${S?.sectionPad || "py-16 sm:py-24"}`}>
          <div className="max-w-4xl mx-auto text-center">
            {heading && (
              <h2
                className={`${S?.h2 || "text-3xl sm:text-4xl font-extrabold"} leading-[1.08]`}
                style={{ color: "#fff", textWrap: "balance", ...(S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}) }}
              >
                {heading}
              </h2>
            )}
            {sub && (
              <p className="mt-4 text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,.92)" }}>
                {sub}
              </p>
            )}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              {quoteHref && (
                <a
                  href={quoteHref}
                  className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold ${S?.pill || "rounded-full"}`}
                  style={{ backgroundColor: "#fff", color: theme.ink }}
                >
                  <FileText size={16} /> {buttonLabel || t.ctaFreeQuote}
                </a>
              )}
              {bookHref && (
                <a
                  href={bookHref}
                  className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold border-2 ${S?.pill || "rounded-full"}`}
                  style={{ borderColor: "#fff", color: "#fff" }}
                >
                  <CalendarDays size={16} /> {t.ctaBook}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // A filled band in the brand colour. band.bg/fg is the MEASURED pair from
  // lib/documents/theme.js, not "is it dark, use white" — a mid-grey or yellow
  // brand needs the fill moved rather than the text, and that maths lives there.
  return (
    <section className={`px-5 sm:px-8 ${S?.sectionPad || "py-16 sm:py-24"}`} style={{ backgroundColor: band.bg }}>
      <div className="max-w-4xl mx-auto text-center">
        {heading && (
          <h2
            className={`${S?.h2 || "text-3xl sm:text-4xl font-extrabold"} leading-[1.08]`}
            style={{ color: band.fg, textWrap: "balance", ...(S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}) }}
          >
            {heading}
          </h2>
        )}
        {sub && (
          <p className="mt-4 text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: band.fg, opacity: 0.9 }}>
            {sub}
          </p>
        )}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          {quoteHref && (
            <a
              href={quoteHref}
              className={`inline-flex items-center justify-center gap-2 text-sm ${S?.button?.pad || "px-6 py-3.5"} ${S?.button?.weight || "font-bold"} ${S?.button?.shape || S?.pill || "rounded-full"}`}
              style={{ backgroundColor: band.fg, color: band.bg }}
            >
              <FileText size={16} /> {buttonLabel || t.ctaFreeQuote}
            </a>
          )}
          {bookHref && (
            <a
              href={bookHref}
              className={`inline-flex items-center justify-center gap-2 text-sm ${S?.button?.pad || "px-6 py-3.5"} ${S?.button?.weight || "font-bold"} border-2 ${S?.button?.shape || S?.pill || "rounded-full"}`}
              style={{ borderColor: band.fg, color: band.fg }}
            >
              <CalendarDays size={16} /> {t.ctaBook}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

// The credit line is the price of a free website, and nothing else in this
// component may mention FieldQuo. A contractor on a paid plan gets a footer
// carrying their name and their copyright and no trace of ours — a homeowner
// comparing three quotes must not be able to tell which of them share software.
function SiteFooter({ company, theme, t, showFieldquoCredit = false }) {
  return (
    <footer className="px-5 sm:px-8 py-12 border-t" style={{ borderColor: theme.border }}>
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt={company.name} className="h-8 w-auto max-w-[150px] object-contain" />
          ) : (
            <span className="text-base font-extrabold" style={{ color: theme.accentText }}>{company.name}</span>
          )}
        </div>
        <div className="text-center sm:text-right text-xs" style={{ color: theme.inkFaint }}>
          <p>© {new Date().getFullYear()} {company.name}</p>
          {showFieldquoCredit && (
            <p className="mt-1">{t.siteBy} <a href="https://www.fieldquo.com" className="underline">FieldQuo</a></p>
          )}
        </div>
      </div>
    </footer>
  );
}
