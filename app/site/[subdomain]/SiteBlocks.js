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
  Phone, Mail, MapPin, FileText, CalendarDays, Clock,
  Wrench, Home, Paintbrush, Hammer, Ruler, Sparkles, ShieldCheck, Star,
} from "lucide-react";
import { neutralPair } from "@/lib/documents/theme";
import { resolveSiteStyle, DEFAULT_SITE_STYLE } from "@/lib/site/siteStyles";
import { groupHours, openState, formatTime } from "@/lib/company/businessHours";
import BookingFlow from "@/app/book/[companySlug]/BookingFlow";
import SelfQuoteFlow from "@/app/quote/[companySlug]/SelfQuoteFlow";
import BeforeAfter from "./BeforeAfter";

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

export default function SiteBlocks({ blocks, company, theme, fill, subdomain, style }) {
  const visible = blocks.filter((b) => b.visible !== false);
  const accent2 = accent2Of(company, theme);
  // The design style (lib/site/siteStyles.js) — type scale, weight, rhythm,
  // corner treatment. Falls back to the modern default so a row saved before
  // styles existed still renders.
  const S = style || resolveSiteStyle(DEFAULT_SITE_STYLE);

  return (
    <>
      <SiteHeader company={company} theme={theme} fill={fill} accent2={accent2} blocks={visible} S={S} />
      <main>
        {visible.map((block) => {
          const props = { block, company, theme, fill, subdomain, accent2, S };
          let el = null;
          switch (block.type) {
            case "hero": el = <Hero {...props} />; break;
            case "beforeafter": el = <BeforeAfterBlock {...props} />; break;
            case "process": el = <Process {...props} />; break;
            case "areas": el = <Areas {...props} />; break;
            case "cta": el = <CtaBand {...props} />; break;
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
          const anchorId = NAV_FOR[block.type]?.id;
          return (
            <div key={block.id} id={anchorId} className={anchorId ? "scroll-mt-20" : undefined}>
              {el}
            </div>
          );
        })}
      </main>
      <SiteFooter company={company} theme={theme} accent2={accent2} />
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
const NAV_FOR = {
  services: { id: "services", label: "Services" },
  beforeafter: { id: "work", label: "Our Work" },
  gallery: { id: "work", label: "Our Work" },
  about: { id: "about", label: "About" },
  quoteform: { id: "quote", label: "Get a Quote" },
  booking: { id: "book", label: "Book" },
  faq: { id: "faq", label: "FAQ" },
  contact: { id: "contact", label: "Contact" },
};

function SiteHeader({ company, theme, fill, blocks = [], S }) {
  const state = openState(company.businessHours, company.timezone);
  const neutral = neutralPair(theme);
  // Deduped by anchor id, not by block type: `beforeafter` and `gallery` both
  // scroll to #work, so a page with both was showing "Our Work" twice in the
  // nav — two links to the same place, which reads as a bug.
  const nav = [];
  for (const b of blocks) {
    const entry = NAV_FOR[b.type];
    if (entry && !nav.some((n) => n.id === entry.id)) nav.push(entry);
  }

  // The bold and editorial styles want the hero photo to run to the top of the
  // viewport, so their header floats over it rather than sitting on a solid bar.
  // Only when the FIRST block is actually an image-led hero — floating white
  // links over a pale wash would be unreadable, and that's the failure this
  // check exists to prevent.
  const first = blocks[0];
  const heroIsImageLed =
    first?.type === "hero" &&
    Boolean(first.content?.backgroundImage) &&
    ["banner", "overlay"].includes(first.content?.variant);
  const overlay = S?.header === "overlay" && heroIsImageLed;

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
        <a href="#" className="flex items-center gap-3 min-w-0 flex-1 lg:flex-initial overflow-hidden">
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
                ? `Open · closes ${formatTime(state.closesAt)}`
                : state.opensAt
                  ? `Closed · opens ${state.opensDay ? `${state.opensDay} ` : ""}${formatTime(state.opensAt)}`
                  : "Closed"}
            </span>
          )}
        </a>

        {/* Anchor nav — makes the page navigate like a multi-page site. Hidden
            on small screens where the scroll + CTA are enough. */}
        {nav.length > 0 && (
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
        )}

        <div className="flex items-center gap-3 shrink-0">
          {company.phone && (
            <a href={`tel:${company.phone}`} className="hidden lg:inline text-sm font-semibold whitespace-nowrap" style={{ color: theme.accentText }}>
              {company.phone}
            </a>
          )}
          <a
            href={`/quote/${company.slug}`}
            className={`inline-flex items-center gap-1.5 text-sm font-bold px-3.5 sm:px-4 py-2.5 whitespace-nowrap transition-transform hover:-translate-y-0.5 ${S?.pill || "rounded-full"}`}
            style={{ backgroundColor: fill.bg, color: fill.fg }}
          >
            {/* Shorter label on a phone. "Get a quote" plus a long company name
                does not fit in 375px, and the button is the point of the page —
                the name is the part that can be abbreviated. */}
            <span className="sm:hidden">Quote</span>
            <span className="hidden sm:inline">Get a quote</span>
          </a>
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────────── Hero ────────────────────────────── */

function HeroActions({ company, theme, fill, ctaLabel, onImage, center }) {
  return (
    <div className={`mt-9 flex flex-wrap gap-3 ${center ? "justify-center" : ""}`}>
      <a
        href={`/quote/${company.slug}`}
        className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold shadow-lg transition-transform hover:-translate-y-0.5"
        style={{ backgroundColor: fill.bg, color: fill.fg }}
      >
        {ctaLabel || "Get a free quote"}
      </a>
      {company.phone && (
        <a
          href={`tel:${company.phone}`}
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold border-2 transition-colors"
          style={{ borderColor: onImage ? "#ffffff" : theme.border, color: onImage ? "#ffffff" : theme.accentText }}
        >
          <Phone size={15} /> Call {company.phone}
        </a>
      )}
    </div>
  );
}

// A trust strip — years/rating/etc aren't in the data model, so instead of
// inventing numbers we surface a single honest reassurance when we have the
// material (a phone to call). Kept minimal precisely to avoid fabrication.
function Hero({ block, company, theme, fill, accent2, S }) {
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
          <Eyebrow accent2={accent2}>{place || "Local & trusted"}</Eyebrow>
          <h1 className={`${S?.h1 || "text-4xl sm:text-6xl font-extrabold"} max-w-[22ch]`} style={{ color: theme.ink, textWrap: "balance", ...serif }}>
            {title}
          </h1>
          {subhead && (
            <p className="mt-6 text-xl sm:text-2xl leading-relaxed max-w-[46ch]" style={{ color: theme.inkMuted }}>
              {subhead}
            </p>
          )}
          <HeroActions company={company} theme={theme} fill={fill} ctaLabel={ctaLabel} />
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
            <Eyebrow accent2="#ffffff">{place || "Local & trusted"}</Eyebrow>
            <h1 className={`${S?.h1 || "text-4xl sm:text-6xl font-extrabold"} max-w-[20ch]`} style={{ color: "#fff", textWrap: "balance", ...serif }}>
              {title}
            </h1>
            {subhead && (
              <p className="mt-5 text-lg sm:text-xl leading-relaxed max-w-[42ch]" style={{ color: "rgba(255,255,255,.92)" }}>
                {subhead}
              </p>
            )}
            <HeroActions company={company} theme={theme} fill={fill} ctaLabel={ctaLabel} onImage />
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
            <Eyebrow accent2={accent2}>{[company.city, company.province].filter(Boolean).join(", ") || "Local & trusted"}</Eyebrow>
            <h1 className={`${S?.h1 || "text-4xl sm:text-6xl font-extrabold tracking-[-0.03em]"} leading-[1.03]`} style={{ color: theme.ink, textWrap: "balance", ...(S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}) }}>
              {title}
            </h1>
            {subhead && <p className="mt-5 text-lg sm:text-xl leading-relaxed max-w-[34ch]" style={{ color: theme.inkMutedOnWash }}>{subhead}</p>}
            <HeroActions company={company} theme={theme} fill={fill} ctaLabel={ctaLabel} />
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
            <HeroActions company={company} theme={theme} fill={fill} ctaLabel={ctaLabel} onImage />
          </div>
        </div>
      </section>
    );
  }

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
          <div className="flex justify-center"><Eyebrow accent2={accent2}>{[company.city, company.province].filter(Boolean).join(", ") || "Local & trusted"}</Eyebrow></div>
        )}
        <h1 className={`${S?.h1 || "text-4xl sm:text-6xl font-extrabold tracking-[-0.03em]"} leading-[1.03]`} style={{ color: backgroundImage ? "#fff" : theme.ink, textWrap: "balance", ...(S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}) }}>
          {title}
        </h1>
        {subhead && (
          <p className="mt-5 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: backgroundImage ? "rgba(255,255,255,.92)" : theme.inkMutedOnWash }}>
            {subhead}
          </p>
        )}
        <HeroActions company={company} theme={theme} fill={fill} ctaLabel={ctaLabel} onImage={Boolean(backgroundImage)} center />
      </div>
    </section>
  );
}

/* ──────────────────────────── Services ──────────────────────────── */

function Services({ block, theme, fill, accent2, S }) {
  const { heading, intro, items, variant } = block.content;
  if (!items?.length) return null;

  if (variant === "list") {
    return (
      <Section theme={theme} S={S}>
        <Heading theme={theme} eyebrow="What we do" accent2={accent2} S={S}>{heading}</Heading>
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
        <Heading theme={theme} center eyebrow="How it works" accent2={accent2} S={S}>{heading}</Heading>
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
        <Heading theme={theme} eyebrow="What we do" accent2={accent2} S={S} center={S?.headingAlign === "center"}>{heading}</Heading>
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

  if (variant === "alternating") {
    // Full-width rows, text side flipping each row. Slow and editorial; the
    // schema comment says three or fewer, and this caps at four so a company
    // that switches to it with twelve services gets a long-but-sane page rather
    // than twelve full-width rows.
    return (
      <Section theme={theme} wide S={S}>
        <Heading theme={theme} eyebrow="What we do" accent2={accent2} S={S}>{heading}</Heading>
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
      <Heading theme={theme} eyebrow="What we do" accent2={accent2} S={S}>{heading}</Heading>
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

function About({ block, theme, accent2, S }) {
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
        <Heading theme={theme} onWash eyebrow="About us" accent2={accent2} S={S} center={S?.headingAlign === "center"}>{heading}</Heading>
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
        <Heading theme={theme} onWash eyebrow="About us" accent2={accent2} S={S} center={S?.headingAlign === "center"}>{heading}</Heading>
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
          <Heading theme={theme} onWash eyebrow="About us" accent2={accent2} S={S}>{heading}</Heading>
          {body && <p className={`${S?.body || "text-lg leading-relaxed"} whitespace-pre-wrap`} style={{ color: theme.inkMutedOnWash }}>{body}</p>}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className={`${S?.imageTreatment === "square" ? "" : "rounded-3xl"} w-full object-cover aspect-[4/3] shadow-2xl`} style={{ border: `1px solid ${theme.border}` }} />
      </div>
    </Section>
  );
}

function Gallery({ block, theme, accent2, S }) {
  const { heading, intro, images, variant } = block.content;
  if (!images?.length) return null;
  const round = S?.imageTreatment === "square" ? "" : S?.radius || "rounded-2xl";

  if (variant === "strip") {
    // One horizontal scrolling row. The right answer with two or three photos —
    // a 4-column grid with three items leaves a visible hole — and the best
    // answer on a phone whatever the count.
    return (
      <Section theme={theme} wide S={S}>
        <Heading theme={theme} eyebrow="Our work" accent2={accent2} S={S} center={S?.headingAlign === "center"}>{heading}</Heading>
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
        <Heading theme={theme} eyebrow="Our work" accent2={accent2} S={S} center={S?.headingAlign === "center"}>{heading}</Heading>
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
      <Heading theme={theme} eyebrow="Our work" accent2={accent2} S={S}>{heading}</Heading>
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

function Testimonials({ block, theme, accent2, S }) {
  const { heading, items, variant } = block.content;
  if (!items?.length) return null;
  const initials = (name) =>
    String(name || "").replace(/[^a-zA-Z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "★";
  if (variant === "single" || items.length === 1) {
    // One quote, very large. A grid of one card looks like three failed to load,
    // and one good testimonial is the common case for a company just starting
    // out — so this is the honest treatment of it, not a consolation prize.
    const t = items[0];
    return (
      <Section theme={theme} alt S={S}>
        <div className={S?.headingAlign === "center" ? "text-center" : ""}>
          <div className={S?.headingAlign === "center" ? "flex justify-center" : ""}>
            <Eyebrow accent2={accent2}>Homeowners</Eyebrow>
          </div>
          <div className="flex gap-1 mb-6" style={{ color: accent2, justifyContent: S?.headingAlign === "center" ? "center" : "flex-start" }} aria-label="5 out of 5 stars">
            {[0, 1, 2, 3, 4].map((x) => <Star key={x} size={20} fill="currentColor" strokeWidth={0} />)}
          </div>
          <blockquote
            className={`${S?.h2 || "text-3xl sm:text-4xl font-extrabold"} m-0 max-w-4xl leading-[1.2] ${S?.headingAlign === "center" ? "mx-auto" : ""}`}
            style={{ color: theme.inkOnWash, textWrap: "balance", ...(S?.serif ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}) }}
          >
            “{t.quote}”
          </blockquote>
          {t.author && (
            <p className="mt-6 text-base font-semibold" style={{ color: theme.inkMutedOnWash }}>
              — {t.author}
            </p>
          )}
        </div>
      </Section>
    );
  }

  if (variant === "strip") {
    return (
      <Section theme={theme} alt wide S={S}>
        <Heading theme={theme} onWash center={S?.headingAlign === "center"} eyebrow="Homeowners" accent2={accent2} S={S}>{heading}</Heading>
        <div className="-mx-5 sm:-mx-8 px-5 sm:px-8 overflow-x-auto snap-x snap-mandatory flex gap-4 pb-2">
          {items.map((t, i) => (
            <figure key={i} className={`shrink-0 snap-start w-[82%] sm:w-[46%] lg:w-[32%] ${S?.radius || "rounded-2xl"} p-6 m-0 shadow-sm`} style={{ backgroundColor: theme.paper || "#fff", border: `1px solid ${theme.border}` }}>
              <div className="flex gap-0.5 mb-3" style={{ color: accent2 }} aria-label="5 out of 5 stars">
                {[0, 1, 2, 3, 4].map((x) => <Star key={x} size={15} fill="currentColor" strokeWidth={0} />)}
              </div>
              <blockquote className="text-base leading-relaxed m-0" style={{ color: theme.ink }}>{t.quote}</blockquote>
              {t.author && <figcaption className="mt-4 text-sm font-semibold" style={{ color: theme.ink }}>{t.author}</figcaption>}
            </figure>
          ))}
        </div>
      </Section>
    );
  }

  return (
    <Section theme={theme} alt wide S={S}>
      <Heading theme={theme} onWash center eyebrow="Homeowners" accent2={accent2} S={S}>{heading}</Heading>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((t, i) => (
          <figure key={i} className={`${S?.radius || "rounded-2xl"} p-6 shadow-sm`} style={{ backgroundColor: theme.paper || "#fff", border: `1px solid ${theme.border}` }}>
            <div className="flex gap-0.5 mb-3" style={{ color: accent2 }} aria-label="5 out of 5 stars">
              {[0, 1, 2, 3, 4].map((s) => <Star key={s} size={15} fill="currentColor" strokeWidth={0} />)}
            </div>
            <blockquote className="text-base leading-relaxed" style={{ color: theme.ink }}>{t.quote}</blockquote>
            {t.author && (
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="grid w-10 h-10 rounded-full place-items-center text-sm font-bold" style={{ backgroundColor: theme.accentWash, color: theme.accentText }}>{initials(t.author)}</span>
                <span className="text-sm font-semibold" style={{ color: theme.ink }}>{t.author}</span>
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
function Faq({ block, theme, accent2, S }) {
  const { heading, items } = block.content;
  if (!items?.length) return null;
  return (
    <Section theme={theme} S={S}>
      <Heading theme={theme} eyebrow="Good to know" accent2={accent2} S={S}>{heading}</Heading>
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

function QuoteForm({ block, company, theme, accent2, S }) {
  const { heading, intro } = block.content;
  return (
    <Section theme={theme} alt wide S={S}>
      <Heading theme={theme} center onWash eyebrow="Free estimate" accent2={accent2} S={S}>{heading}</Heading>
      <Intro theme={theme} center onWash>{intro}</Intro>
      <div className="rounded-3xl border overflow-hidden shadow-xl" style={{ borderColor: theme.border, backgroundColor: theme.paper || "#fff" }}>
        <SelfQuoteFlow companySlug={company.slug} />
      </div>
      <noscript>
        <p className="text-sm mt-4 text-center" style={{ color: theme.inkMutedOnWash }}>
          <a href={`/quote/${company.slug}`} className="underline">Open the quote form</a>
        </p>
      </noscript>
    </Section>
  );
}

function BookingBlock({ block, company, theme, accent2, S }) {
  const { heading, intro } = block.content;
  // Works off the company slug even without a custom bookingSlug — findBooking
  // Company resolves either. The BookingFlow degrades to a friendly message if
  // no one has set availability yet, so this is never a dead calendar.
  const slug = company.bookingSlug || company.slug;
  if (!slug) return null;
  return (
    <Section theme={theme} wide S={S}>
      <Heading theme={theme} center eyebrow="Book a visit" accent2={accent2} S={S}>{heading}</Heading>
      <Intro theme={theme} center>{intro}</Intro>
      <div className="rounded-3xl border overflow-hidden shadow-xl" style={{ borderColor: theme.border, backgroundColor: theme.paper || "#fff" }}>
        <BookingFlow companySlug={slug} />
      </div>
      <noscript>
        <p className="text-sm mt-4 text-center" style={{ color: theme.inkMuted }}>
          <a href={`/book/${slug}`} className="underline">Open the booking calendar</a>
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

function Hours({ block, company, theme, accent2, S }) {
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
            {state.open ? "Open now" : "Closed now"}
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

function Contact({ block, company, theme, fill, accent2, S }) {
  const { heading, intro, showQuoteLink, showBookingLink } = block.content;
  // The address field already holds the full formatted address from signup, so
  // appending city/province again produced "…Scarborough, ON…, Toronto, ON".
  // Use the address as-is; fall back to city/province only when it's absent.
  const place = company.address || [company.city, company.province].filter(Boolean).join(", ");
  const mapUrl = staticMapUrl(place);
  return (
    <Section theme={theme} S={S}>
      <div className="text-center">
        <Heading theme={theme} center eyebrow="Get in touch" accent2={accent2} S={S}>{heading}</Heading>
        {intro && <p className="text-lg leading-relaxed max-w-2xl mx-auto -mt-4 mb-2" style={{ color: theme.inkMuted }}>{intro}</p>}
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          {showQuoteLink !== false && (
            <a href={`/quote/${company.slug}`} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold shadow-lg transition-transform hover:-translate-y-0.5" style={{ backgroundColor: fill.bg, color: fill.fg }}>
              <FileText size={16} /> Request a quote
            </a>
          )}
          {showBookingLink !== false && (
            <a href={`/book/${company.bookingSlug || company.slug}`} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold border-2" style={{ borderColor: theme.border, color: theme.accentText }}>
              <CalendarDays size={16} /> Book a visit
            </a>
          )}
        </div>
        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 justify-center text-sm" style={{ color: theme.inkMuted }}>
          {company.phone && <a href={`tel:${company.phone}`} className="inline-flex items-center gap-2"><Phone size={15} /> {company.phone}</a>}
          {company.email && <a href={`mailto:${company.email}`} className="inline-flex items-center gap-2"><Mail size={15} /> {company.email}</a>}
          {place && <span className="inline-flex items-center gap-2"><MapPin size={15} /> {place}</span>}
        </div>
        {mapUrl && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(place)}`}
            target="_blank"
            rel="noreferrer"
            className="block mt-8 rounded-2xl overflow-hidden border max-w-3xl mx-auto"
            style={{ borderColor: theme.border }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mapUrl} alt={`Map of ${place}`} className="w-full h-auto" loading="lazy" />
          </a>
        )}
      </div>
    </Section>
  );
}


/* ─────────────────── Before & after (the slider) ────────────────── */

function BeforeAfterBlock({ block, theme, accent2, S }) {
  const { heading, intro, pairs } = block.content;
  // A pair with one side missing was already dropped by the sanitiser; this is
  // the "company removed both photos" case. Rendering a heading over nothing is
  // the empty-section failure, so the whole block goes.
  const usable = (pairs || []).filter((x) => x?.before && x?.after);
  if (!usable.length) return null;

  return (
    <Section theme={theme} wide S={S}>
      <Heading theme={theme} eyebrow="Before & after" accent2={accent2} S={S} center={S?.headingAlign === "center"}>
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
        Drag the handle to compare.
      </p>
    </Section>
  );
}

/* ──────────────────────── How it works ─────────────────────── */

function Process({ block, theme, fill, accent2, S }) {
  const { heading, intro, steps } = block.content;
  // Empty when AI didn't run: there is no honest way to invent a company's
  // process, so the section simply isn't there rather than showing four
  // placeholder cards.
  if (!steps?.length) return null;

  return (
    <Section theme={theme} alt wide S={S}>
      <Heading theme={theme} onWash eyebrow="How it works" accent2={accent2} S={S} center={S?.headingAlign === "center"}>
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

function Areas({ block, company, theme, accent2, S }) {
  const { heading, intro } = block.content;
  // From the company's own WorkArea rows, passed down on `company`. Never a
  // typed list: a typed list of towns is the first thing to go stale, and a
  // homeowner in a town you quietly dropped is a wasted call for both of you.
  const areas = Array.isArray(company?.workAreas) ? company.workAreas : [];
  if (!areas.length) return null;

  return (
    <Section theme={theme} S={S}>
      <Heading theme={theme} eyebrow="Where we work" accent2={accent2} S={S} center={S?.headingAlign === "center"}>
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

/* ───────────────────── Call-to-action band ──────────────────── */

function CtaBand({ block, company, theme, fill, S }) {
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
              className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold ${S?.pill || "rounded-full"}`}
              style={{ backgroundColor: band.fg, color: band.bg }}
            >
              <FileText size={16} /> {buttonLabel || "Get a free quote"}
            </a>
          )}
          {bookHref && (
            <a
              href={bookHref}
              className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold border-2 ${S?.pill || "rounded-full"}`}
              style={{ borderColor: band.fg, color: band.fg }}
            >
              <CalendarDays size={16} /> Book a visit
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function SiteFooter({ company, theme }) {
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
          <p className="mt-1">Site by <a href="https://www.fieldquo.com" className="underline">FieldQuo</a></p>
        </div>
      </div>
    </footer>
  );
}
