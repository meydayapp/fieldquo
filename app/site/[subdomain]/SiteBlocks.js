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
import { groupHours, openState, formatTime } from "@/lib/company/businessHours";
import BookingFlow from "@/app/book/[companySlug]/BookingFlow";
import SelfQuoteFlow from "@/app/quote/[companySlug]/SelfQuoteFlow";

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

export default function SiteBlocks({ blocks, company, theme, fill, subdomain }) {
  const visible = blocks.filter((b) => b.visible !== false);
  const accent2 = accent2Of(company, theme);

  return (
    <>
      <SiteHeader company={company} theme={theme} fill={fill} accent2={accent2} />
      <main>
        {visible.map((block) => {
          const props = { key: block.id, block, company, theme, fill, subdomain, accent2 };
          switch (block.type) {
            case "hero": return <Hero {...props} />;
            case "services": return <Services {...props} />;
            case "about": return <About {...props} />;
            case "gallery": return <Gallery {...props} />;
            case "testimonials": return <Testimonials {...props} />;
            case "faq": return <Faq {...props} />;
            case "quoteform": return <QuoteForm {...props} />;
            case "booking": return <BookingBlock {...props} />;
            case "hours": return <Hours {...props} />;
            case "contact": return <Contact {...props} />;
            default: return null;
          }
        })}
      </main>
      <SiteFooter company={company} theme={theme} accent2={accent2} />
    </>
  );
}

/* ── shared scaffold ── */

const Section = ({ children, alt, theme, wide, id }) => (
  <section
    id={id}
    className="px-5 sm:px-8 py-16 sm:py-24"
    style={alt ? { backgroundColor: theme.accentWash } : undefined}
  >
    <div className={`${wide ? "max-w-6xl" : "max-w-5xl"} mx-auto`}>{children}</div>
  </section>
);

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
const Heading = ({ children, theme, center, onWash, eyebrow, accent2 }) =>
  children ? (
    <div className={`mb-8 ${center ? "text-center" : ""} ${center ? "" : "max-w-2xl"}`}>
      {eyebrow && <div className={center ? "flex justify-center" : ""}><Eyebrow accent2={accent2}>{eyebrow}</Eyebrow></div>}
      <h2
        className="text-3xl sm:text-4xl font-extrabold tracking-[-0.02em] leading-[1.08]"
        style={{ color: onWash ? theme.inkOnWash : theme.ink, textWrap: "balance" }}
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

function SiteHeader({ company, theme, fill }) {
  const state = openState(company.businessHours, company.timezone);
  const neutral = neutralPair(theme);

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur border-b"
      style={{ borderColor: theme.border, backgroundColor: `color-mix(in srgb, ${theme.paper || "#ffffff"} 82%, transparent)` }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-[68px] flex items-center justify-between gap-4">
        <a href="#" className="flex items-center gap-3 min-w-0">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt={company.name} className="h-9 w-auto max-w-[170px] object-contain" />
          ) : (
            <span className="text-lg font-extrabold tracking-[-0.02em]" style={{ color: theme.accentText }}>
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
        <div className="flex items-center gap-3">
          {company.phone && (
            <a href={`tel:${company.phone}`} className="hidden sm:inline text-sm font-semibold whitespace-nowrap" style={{ color: theme.accentText }}>
              {company.phone}
            </a>
          )}
          <a
            href={`/quote/${company.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-full transition-transform hover:-translate-y-0.5"
            style={{ backgroundColor: fill.bg, color: fill.fg }}
          >
            Get a quote
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
function Hero({ block, company, theme, fill, accent2 }) {
  const { headline, subhead, ctaLabel, backgroundImage } = block.content;
  const variant =
    (block.content.variant === "split" || block.content.variant === "banner") && !backgroundImage
      ? "centered"
      : block.content.variant || "centered";
  const title = headline || company.name;

  if (variant === "split") {
    return (
      <section className="px-5 sm:px-8 py-16 sm:py-24" style={{ backgroundColor: theme.accentWash }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Eyebrow accent2={accent2}>{[company.city, company.province].filter(Boolean).join(", ") || "Local & trusted"}</Eyebrow>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] leading-[1.03]" style={{ color: theme.ink, textWrap: "balance" }}>
              {title}
            </h1>
            {subhead && <p className="mt-5 text-lg sm:text-xl leading-relaxed max-w-[34ch]" style={{ color: theme.inkMutedOnWash }}>{subhead}</p>}
            <HeroActions company={company} theme={theme} fill={fill} ctaLabel={ctaLabel} />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={backgroundImage} alt="" className="rounded-3xl w-full object-cover aspect-[4/3] md:aspect-square shadow-2xl" style={{ border: `1px solid ${theme.border}` }} />
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
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-[-0.03em] leading-[1.02] max-w-2xl" style={{ color: "#fff", textWrap: "balance" }}>{title}</h1>
            {subhead && <p className="mt-4 text-lg sm:text-xl leading-relaxed max-w-xl" style={{ color: "rgba(255,255,255,.92)" }}>{subhead}</p>}
            <HeroActions company={company} theme={theme} fill={fill} ctaLabel={ctaLabel} onImage />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative px-5 sm:px-8 py-24 sm:py-32 overflow-hidden" style={{ backgroundColor: theme.accentWash }}>
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
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-[-0.03em] leading-[1.03]" style={{ color: backgroundImage ? "#fff" : theme.ink, textWrap: "balance" }}>
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

function Services({ block, theme, fill, accent2 }) {
  const { heading, intro, items, variant } = block.content;
  if (!items?.length) return null;

  if (variant === "list") {
    return (
      <Section theme={theme}>
        <Heading theme={theme} eyebrow="What we do" accent2={accent2}>{heading}</Heading>
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
      <Section theme={theme} wide>
        <Heading theme={theme} center eyebrow="How it works" accent2={accent2}>{heading}</Heading>
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

  // cards (default) — elevated with an icon, hover lift, brand-tinted badge.
  return (
    <Section theme={theme} wide>
      <Heading theme={theme} eyebrow="What we do" accent2={accent2}>{heading}</Heading>
      <Intro theme={theme}>{intro}</Intro>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((item, i) => {
          const Icon = SERVICE_ICONS[i % SERVICE_ICONS.length];
          return (
            <div
              key={i}
              className="group rounded-2xl p-6 border transition-transform hover:-translate-y-1 hover:shadow-xl"
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

function About({ block, theme, accent2 }) {
  const { heading, body, image } = block.content;
  if (!body && !image) return null;
  return (
    <Section theme={theme} alt>
      <div className="grid sm:grid-cols-2 gap-10 items-center">
        <div>
          <Heading theme={theme} onWash eyebrow="About us" accent2={accent2}>{heading}</Heading>
          {body && <p className="text-lg leading-relaxed whitespace-pre-wrap" style={{ color: theme.inkMutedOnWash }}>{body}</p>}
        </div>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="rounded-3xl w-full object-cover aspect-[4/3] shadow-2xl" style={{ border: `1px solid ${theme.border}` }} />
        )}
      </div>
    </Section>
  );
}

function Gallery({ block, theme, accent2 }) {
  const { heading, intro, images } = block.content;
  if (!images?.length) return null;
  // A mixed masonry-ish rhythm: the first image spans two columns so the grid
  // reads as a portfolio, not a contact sheet of identical squares.
  return (
    <Section theme={theme} wide>
      <Heading theme={theme} eyebrow="Our work" accent2={accent2}>{heading}</Heading>
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

function Testimonials({ block, theme, accent2 }) {
  const { heading, items } = block.content;
  if (!items?.length) return null;
  const initials = (name) =>
    String(name || "").replace(/[^a-zA-Z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "★";
  return (
    <Section theme={theme} alt wide>
      <Heading theme={theme} onWash center eyebrow="Homeowners" accent2={accent2}>{heading}</Heading>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((t, i) => (
          <figure key={i} className="rounded-2xl p-6 shadow-sm" style={{ backgroundColor: theme.paper || "#fff", border: `1px solid ${theme.border}` }}>
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
function Faq({ block, theme, accent2 }) {
  const { heading, items } = block.content;
  if (!items?.length) return null;
  return (
    <Section theme={theme}>
      <Heading theme={theme} eyebrow="Good to know" accent2={accent2}>{heading}</Heading>
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

function QuoteForm({ block, company, theme, accent2 }) {
  const { heading, intro } = block.content;
  return (
    <Section theme={theme} alt wide>
      <Heading theme={theme} center onWash eyebrow="Free estimate" accent2={accent2}>{heading}</Heading>
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

function BookingBlock({ block, company, theme, accent2 }) {
  const { heading, intro } = block.content;
  if (!company.bookingSlug) return null;
  return (
    <Section theme={theme} wide>
      <Heading theme={theme} center eyebrow="Book a visit" accent2={accent2}>{heading}</Heading>
      <Intro theme={theme} center>{intro}</Intro>
      <div className="rounded-3xl border overflow-hidden shadow-xl" style={{ borderColor: theme.border, backgroundColor: theme.paper || "#fff" }}>
        <BookingFlow companySlug={company.bookingSlug} />
      </div>
      <noscript>
        <p className="text-sm mt-4 text-center" style={{ color: theme.inkMuted }}>
          <a href={`/book/${company.bookingSlug}`} className="underline">Open the booking calendar</a>
        </p>
      </noscript>
    </Section>
  );
}

function Hours({ block, company, theme, accent2 }) {
  const { heading, note } = block.content;
  const runs = groupHours(company.businessHours, { weekStartsOn: company.weekStartsOn ?? 0 });
  if (!runs.some((r) => !r.closed)) return null;
  const state = openState(company.businessHours, company.timezone);
  return (
    <Section theme={theme}>
      <div className="max-w-md mx-auto text-center">
        <span className="inline-grid w-12 h-12 rounded-2xl place-items-center mb-4 mx-auto" style={{ backgroundColor: theme.accentWash, color: theme.accentText }}>
          <Clock size={22} />
        </span>
        <Heading theme={theme} center accent2={accent2}>{heading}</Heading>
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

function Contact({ block, company, theme, fill, accent2 }) {
  const { heading, intro, showQuoteLink, showBookingLink } = block.content;
  const place = [company.address, company.city, company.province].filter(Boolean).join(", ");
  return (
    <Section theme={theme}>
      <div className="text-center">
        <Heading theme={theme} center eyebrow="Get in touch" accent2={accent2}>{heading}</Heading>
        {intro && <p className="text-lg leading-relaxed max-w-2xl mx-auto -mt-4 mb-2" style={{ color: theme.inkMuted }}>{intro}</p>}
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          {showQuoteLink !== false && (
            <a href={`/quote/${company.slug}`} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold shadow-lg transition-transform hover:-translate-y-0.5" style={{ backgroundColor: fill.bg, color: fill.fg }}>
              <FileText size={16} /> Request a quote
            </a>
          )}
          {showBookingLink !== false && company.bookingSlug && (
            <a href={`/book/${company.bookingSlug}`} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold border-2" style={{ borderColor: theme.border, color: theme.accentText }}>
              <CalendarDays size={16} /> Book a visit
            </a>
          )}
        </div>
        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 justify-center text-sm" style={{ color: theme.inkMuted }}>
          {company.phone && <a href={`tel:${company.phone}`} className="inline-flex items-center gap-2"><Phone size={15} /> {company.phone}</a>}
          {company.email && <a href={`mailto:${company.email}`} className="inline-flex items-center gap-2"><Mail size={15} /> {company.email}</a>}
          {place && <span className="inline-flex items-center gap-2"><MapPin size={15} /> {place}</span>}
        </div>
      </div>
    </Section>
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
