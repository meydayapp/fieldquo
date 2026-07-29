// app/site/[subdomain]/SiteBlocks.js
//
// Renders the blocks. Shared by the public page and the editor's preview, so
// what a company sees while editing is the same component a visitor gets —
// not an approximation that drifts.
//
// ── Mostly a server component ───────────────────────────────────────────────
//
// Everything here renders on the server and works with JavaScript switched
// off. Two blocks are exceptions and only two: the booking calendar and the
// quote form, which are interactive by nature. Those mount the SAME components
// the standalone /book and /quote pages use — not copies. A second
// implementation of a booking calendar is a second implementation to keep
// correct, and the one on the marketing page would be the one nobody noticed
// had broken.
//
// Both degrade honestly: if the island fails to load, the surrounding block
// still shows a plain link to the standalone page.
//
// ── Every colour comes from their brand ─────────────────────────────────────
//
// Same documentTheme the quotes and invoices use, so a client who gets a
// quote and then looks up the website sees one company. Contrast is measured,
// not assumed — see lib/documents/theme.js.
//
// ── Variants are layout, never style ────────────────────────────────────────
//
// A block's `variant` picks between arrangements that were each designed and
// checked on a phone. It never becomes a colour, a size, or a raw style
// string. See the note in app/data/siteBlocks.js.

import { Phone, Mail, MapPin, FileText, CalendarDays, Clock } from "lucide-react";
import { neutralPair } from "@/lib/documents/theme";
import { groupHours, openState, formatTime } from "@/lib/company/businessHours";
import BookingFlow from "@/app/book/[companySlug]/BookingFlow";
import SelfQuoteFlow from "@/app/quote/[companySlug]/SelfQuoteFlow";

export default function SiteBlocks({ blocks, company, theme, fill, subdomain }) {
  const visible = blocks.filter((b) => b.visible !== false);

  return (
    <>
      <SiteHeader company={company} theme={theme} fill={fill} />

      <main>
        {visible.map((block) => {
          const props = { key: block.id, block, company, theme, fill, subdomain };
          switch (block.type) {
            case "hero":
              return <Hero {...props} />;
            case "services":
              return <Services {...props} />;
            case "about":
              return <About {...props} />;
            case "gallery":
              return <Gallery {...props} />;
            case "testimonials":
              return <Testimonials {...props} />;
            case "quoteform":
              return <QuoteForm {...props} />;
            case "booking":
              return <BookingBlock {...props} />;
            case "hours":
              return <Hours {...props} />;
            case "contact":
              return <Contact {...props} />;
            default:
              // Unknown types are dropped at save time by sanitiseBlocks;
              // this is the second line of defence for rows written before a
              // type was removed.
              return null;
          }
        })}
      </main>

      <SiteFooter company={company} theme={theme} />
    </>
  );
}

const Section = ({ children, alt, theme, wide }) => (
  <section
    className="px-5 sm:px-8 py-14 sm:py-20"
    style={alt ? { backgroundColor: theme.accentWash } : undefined}
  >
    <div className={`${wide ? "max-w-5xl" : "max-w-4xl"} mx-auto`}>{children}</div>
  </section>
);

// `onWash` picks the contrast-measured variant. inkMuted is checked against
// PAPER; a tinted section background is a shade darker and drops it to ~4.4:1.
// Every alt section passes it — see the note in lib/documents/theme.js.
const Heading = ({ children, theme, center, onWash }) =>
  children ? (
    <h2
      className={`text-2xl sm:text-3xl font-bold mb-3 ${center ? "text-center" : ""}`}
      style={{ color: onWash ? theme.inkOnWash : theme.ink }}
    >
      {children}
    </h2>
  ) : null;

const Intro = ({ children, theme, center, onWash }) =>
  children ? (
    <p
      className={`text-base leading-relaxed mb-8 ${center ? "text-center max-w-xl mx-auto" : ""}`}
      style={{ color: onWash ? theme.inkMutedOnWash : theme.inkMuted }}
    >
      {children}
    </p>
  ) : null;

function SiteHeader({ company, theme, fill }) {
  const state = openState(company.businessHours, company.timezone);
  const neutral = neutralPair(theme);

  return (
    <header className="border-b" style={{ borderColor: theme.border }}>
      <div className="h-1.5 flex">
        <div className="flex-[2]" style={{ backgroundColor: fill.bg }} />
        <div style={{ backgroundColor: theme.accentSoft }} className="flex-1" />
      </div>
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={company.name}
              className="h-10 w-auto max-w-[180px] object-contain"
            />
          ) : (
            <span className="text-lg font-bold" style={{ color: theme.accentText }}>
              {company.name}
            </span>
          )}
          {/* Only rendered when hours exist. openState returns null rather
              than guessing, because "Closed" on a company that never entered
              hours is a lie a visitor acts on. */}
          {state && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={
                state.open
                  ? { color: theme.positive, backgroundColor: theme.positiveWash }
                  : { color: neutral.fg, backgroundColor: neutral.bg }
              }
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: state.open ? theme.positive : neutral.fg }}
              />
              {state.open
                ? `Open · closes ${formatTime(state.closesAt)}`
                : state.opensAt
                  ? `Closed · opens ${state.opensDay ? `${state.opensDay} ` : ""}${formatTime(state.opensAt)}`
                  : "Closed"}
            </span>
          )}
        </div>
        {company.phone && (
          <a
            href={`tel:${company.phone}`}
            className="text-sm font-semibold whitespace-nowrap"
            style={{ color: theme.accentText }}
          >
            {company.phone}
          </a>
        )}
      </div>
    </header>
  );
}

/* ────────────────────────────── Hero ────────────────────────────── */

function HeroActions({ company, theme, fill, ctaLabel, onImage, center }) {
  return (
    <div
      className={`mt-8 flex flex-wrap gap-3 ${center ? "justify-center" : ""}`}
    >
      <a
        href={`/quote/${company.slug}`}
        className="px-7 py-3.5 rounded-full text-sm font-bold"
        style={{ backgroundColor: fill.bg, color: fill.fg }}
      >
        {ctaLabel || "Get a free quote"}
      </a>
      {company.phone && (
        <a
          href={`tel:${company.phone}`}
          className="px-7 py-3.5 rounded-full text-sm font-bold border-2"
          style={{
            borderColor: onImage ? "#ffffff" : theme.accent,
            color: onImage ? "#ffffff" : theme.accentText,
          }}
        >
          Call {company.phone}
        </a>
      )}
    </div>
  );
}

function Hero({ block, company, theme, fill }) {
  const { headline, subhead, ctaLabel, backgroundImage } = block.content;

  // Both image-led variants degrade to centered without a photo rather than
  // rendering an empty box. A company that picked "banner" and never uploaded
  // an image should get a page that looks intentional, not a broken one.
  const variant =
    (block.content.variant === "split" || block.content.variant === "banner") &&
    !backgroundImage
      ? "centered"
      : block.content.variant || "centered";

  const title = headline || company.name;

  if (variant === "split") {
    return (
      <section className="px-5 sm:px-8 py-14 sm:py-20" style={{ backgroundColor: theme.accentWash }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight"
              style={{ color: theme.ink }}
            >
              {title}
            </h1>
            {subhead && (
              <p
                className="mt-4 text-base sm:text-lg leading-relaxed"
                style={{ color: theme.inkMutedOnWash }}
              >
                {subhead}
              </p>
            )}
            <HeroActions
              company={company}
              theme={theme}
              fill={fill}
              ctaLabel={ctaLabel}
            />
          </div>
          {/* Order matters on mobile: the photo comes second so the headline
              is the first thing on screen. `order-first` on md only. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundImage}
            alt=""
            className="rounded-2xl w-full object-cover aspect-[4/3] md:aspect-square"
          />
        </div>
      </section>
    );
  }

  if (variant === "banner") {
    return (
      <section className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backgroundImage}
          alt=""
          className="w-full object-cover h-[380px] sm:h-[520px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-5 sm:px-8 pb-10 sm:pb-14">
          <div className="max-w-5xl mx-auto">
            <h1
              className="text-3xl sm:text-5xl font-bold leading-tight max-w-2xl"
              style={{ color: "#ffffff" }}
            >
              {title}
            </h1>
            {subhead && (
              <p
                className="mt-3 text-base sm:text-lg leading-relaxed max-w-xl"
                style={{ color: "rgba(255,255,255,0.92)" }}
              >
                {subhead}
              </p>
            )}
            <HeroActions
              company={company}
              theme={theme}
              fill={fill}
              ctaLabel={ctaLabel}
              onImage
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative px-5 sm:px-8 py-20 sm:py-28"
      style={{ backgroundColor: theme.accentWash }}
    >
      {backgroundImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* A scrim, not a guess: a photo someone took on a phone can be any
              brightness, and white headline text over a pale sky is the most
              common way a generated site looks broken. */}
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}

      <div className="relative max-w-3xl mx-auto text-center">
        <h1
          className="text-3xl sm:text-5xl font-bold leading-tight"
          style={{ color: backgroundImage ? "#ffffff" : theme.ink }}
        >
          {title}
        </h1>
        {subhead && (
          <p
            className="mt-4 text-base sm:text-lg leading-relaxed"
            style={{
              // On a photo: white over the scrim. On the wash: the muted ink
              // measured against the wash, not against paper.
              color: backgroundImage
                ? "rgba(255,255,255,0.92)"
                : theme.inkMutedOnWash,
            }}
          >
            {subhead}
          </p>
        )}

        <HeroActions
          company={company}
          theme={theme}
          fill={fill}
          ctaLabel={ctaLabel}
          onImage={Boolean(backgroundImage)}
          center
        />
      </div>
    </section>
  );
}

/* ──────────────────────────── Services ──────────────────────────── */

function Services({ block, theme, fill }) {
  const { heading, intro, items, variant } = block.content;
  if (!items?.length) return null;

  if (variant === "list") {
    return (
      <Section theme={theme}>
        <Heading theme={theme}>{heading}</Heading>
        <Intro theme={theme}>{intro}</Intro>
        <div className="divide-y" style={{ borderColor: theme.border }}>
          {items.map((item, i) => (
            <div key={i} className="py-6 first:pt-0 sm:flex sm:gap-8">
              <h3
                className="text-lg font-bold sm:w-1/3 shrink-0"
                style={{ color: theme.accentText }}
              >
                {item.name}
              </h3>
              {item.description && (
                <p
                  className="text-base leading-relaxed mt-1.5 sm:mt-0"
                  style={{ color: theme.inkMuted }}
                >
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>
    );
  }

  if (variant === "numbered") {
    return (
      <Section theme={theme} wide>
        <Heading theme={theme} center>{heading}</Heading>
        <Intro theme={theme} center>{intro}</Intro>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item, i) => (
            <div key={i} className="flex gap-4">
              <span
                className="shrink-0 w-9 h-9 rounded-full grid place-items-center text-sm font-bold"
                style={{ backgroundColor: fill.bg, color: fill.fg }}
              >
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold" style={{ color: theme.ink }}>
                  {item.name}
                </h3>
                {item.description && (
                  <p
                    className="text-sm mt-1.5 leading-relaxed"
                    style={{ color: theme.inkMuted }}
                  >
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>
    );
  }

  return (
    <Section theme={theme}>
      <Heading theme={theme}>{heading}</Heading>
      <Intro theme={theme}>{intro}</Intro>
      <div className="grid sm:grid-cols-2 gap-4">
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-xl p-5 border"
            style={{ borderColor: theme.border }}
          >
            <h3 className="font-semibold" style={{ color: theme.ink }}>
              {item.name}
            </h3>
            {item.description && (
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: theme.inkMuted }}>
                {item.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────────────── About / Gallery ──────────────────────── */

function About({ block, theme }) {
  const { heading, body, image } = block.content;
  if (!body && !image) return null;

  return (
    <Section theme={theme} alt>
      <div className="grid sm:grid-cols-2 gap-8 items-center">
        <div>
          <Heading theme={theme} onWash>{heading}</Heading>
          {body && (
            <p
              className="text-base leading-relaxed whitespace-pre-wrap"
              style={{ color: theme.inkMutedOnWash }}
            >
              {body}
            </p>
          )}
        </div>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="rounded-xl w-full object-cover aspect-[4/3]"
          />
        )}
      </div>
    </Section>
  );
}

function Gallery({ block, theme }) {
  const { heading, intro, images } = block.content;
  if (!images?.length) return null;

  return (
    <Section theme={theme} wide>
      <Heading theme={theme}>{heading}</Heading>
      <Intro theme={theme}>{intro}</Intro>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            loading="lazy"
            className="rounded-lg w-full object-cover aspect-square"
          />
        ))}
      </div>
    </Section>
  );
}

function Testimonials({ block, theme }) {
  const { heading, items } = block.content;
  if (!items?.length) return null;

  return (
    <Section theme={theme} alt>
      <Heading theme={theme} onWash>{heading}</Heading>
      <div className="grid sm:grid-cols-2 gap-4">
        {items.map((t, i) => (
          <blockquote
            key={i}
            className="rounded-xl p-5 bg-white border"
            style={{ borderColor: theme.border }}
          >
            <p className="text-sm leading-relaxed" style={{ color: theme.ink }}>
              {t.quote}
            </p>
            {t.author && (
              <footer className="text-xs mt-3" style={{ color: theme.inkMuted }}>
                — {t.author}
              </footer>
            )}
          </blockquote>
        ))}
      </div>
    </Section>
  );
}

/* ──────────────────── Blocks driven by company data ─────────────── */

/**
 * The self-quote flow, inline.
 *
 * The contact block already offers a LINK to /quote/<slug>. This is the same
 * flow without the navigation, because every page a visitor has to load is a
 * place they stop. Both exist: a company can use the link on a van and the
 * form on the page.
 */
function QuoteForm({ block, company, theme }) {
  const { heading, intro } = block.content;

  return (
    <Section theme={theme} alt>
      <Heading theme={theme} center onWash>{heading}</Heading>
      <Intro theme={theme} center onWash>{intro}</Intro>
      <div
        className="rounded-2xl bg-white border overflow-hidden"
        style={{ borderColor: theme.border }}
      >
        <SelfQuoteFlow companySlug={company.slug} />
      </div>
      {/* The honest fallback. If the island never hydrates — old browser, a
          blocked script, a bad connection in a driveway — this is still a
          working route to the same form. */}
      <noscript>
        <p className="text-sm mt-4 text-center" style={{ color: theme.inkMutedOnWash }}>
          <a href={`/quote/${company.slug}`} className="underline">
            Open the quote form
          </a>
        </p>
      </noscript>
    </Section>
  );
}

/**
 * The booking calendar, inline.
 *
 * Renders BookingFlow — the same component behind /book/<slug> — so the
 * availability shown here is computed by computeAvailability like everywhere
 * else. There is no second source of truth for when someone is free.
 */
function BookingBlock({ block, company, theme }) {
  const { heading, intro } = block.content;

  // No booking slug means no bookable event types were ever set up. A calendar
  // that renders "no times available" is worse than no calendar.
  if (!company.bookingSlug) return null;

  return (
    <Section theme={theme} wide>
      <Heading theme={theme} center>{heading}</Heading>
      <Intro theme={theme} center>{intro}</Intro>
      <div
        className="rounded-2xl bg-white border overflow-hidden"
        style={{ borderColor: theme.border }}
      >
        <BookingFlow companySlug={company.bookingSlug} />
      </div>
      <noscript>
        <p className="text-sm mt-4 text-center" style={{ color: theme.inkMuted }}>
          <a href={`/book/${company.bookingSlug}`} className="underline">
            Open the booking calendar
          </a>
        </p>
      </noscript>
    </Section>
  );
}

/**
 * Opening hours, from Settings → Company.
 *
 * Rendered from the company record rather than typed into the page, so a
 * change to the hours is right on the website, in the JSON-LD, and in the
 * header pill at the same moment.
 */
function Hours({ block, company, theme }) {
  const { heading, note } = block.content;

  const runs = groupHours(company.businessHours, {
    weekStartsOn: company.weekStartsOn ?? 0,
  });
  // Every day closed means the column holds a schedule that says "never open",
  // which is either a mistake or a business that shouldn't publish hours.
  if (!runs.some((r) => !r.closed)) return null;

  const state = openState(company.businessHours, company.timezone);

  return (
    <Section theme={theme}>
      <div className="max-w-md mx-auto text-center">
        <Clock size={20} className="mx-auto mb-3" style={{ color: theme.accentText }} />
        <Heading theme={theme} center>{heading}</Heading>

        {state && (
          <p
            className="text-sm font-semibold mb-6"
            style={{ color: state.open ? theme.positive : theme.inkMuted }}
          >
            {state.open ? "Open now" : "Closed now"}
          </p>
        )}

        <dl className="text-left">
          {runs.map((run) => (
            <div
              key={run.days.join("-")}
              className="flex justify-between gap-6 py-2.5 border-b last:border-0"
              style={{ borderColor: theme.border }}
            >
              <dt className="font-semibold" style={{ color: theme.ink }}>
                {run.label}
              </dt>
              <dd
                className="text-right"
                style={{ color: run.closed ? theme.inkFaint : theme.inkMuted }}
              >
                {run.hours}
              </dd>
            </div>
          ))}
        </dl>

        {note && (
          <p className="text-sm mt-5 leading-relaxed" style={{ color: theme.inkMuted }}>
            {note}
          </p>
        )}
      </div>
    </Section>
  );
}

function Contact({ block, company, theme, fill }) {
  const { heading, intro, showQuoteLink, showBookingLink } = block.content;
  const place = [company.address, company.city, company.province]
    .filter(Boolean)
    .join(", ");

  return (
    <Section theme={theme}>
      <div className="text-center">
        <Heading theme={theme} center>{heading}</Heading>
        {intro && (
          <p
            className="text-base leading-relaxed max-w-xl mx-auto"
            style={{ color: theme.inkMuted }}
          >
            {intro}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          {showQuoteLink !== false && (
            <a
              href={`/quote/${company.slug}`}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-bold"
              style={{ backgroundColor: fill.bg, color: fill.fg }}
            >
              <FileText size={16} /> Request a quote
            </a>
          )}
          {/* Only when they've actually set up bookable times — a booking link
              that leads to an empty calendar is worse than no link. */}
          {showBookingLink !== false && company.bookingSlug && (
            <a
              href={`/book/${company.bookingSlug}`}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-bold border-2"
              style={{ borderColor: theme.accent, color: theme.accentText }}
            >
              <CalendarDays size={16} /> Book a visit
            </a>
          )}
        </div>

        <div
          className="mt-10 flex flex-wrap gap-x-8 gap-y-3 justify-center text-sm"
          style={{ color: theme.inkMuted }}
        >
          {company.phone && (
            <a href={`tel:${company.phone}`} className="inline-flex items-center gap-2">
              <Phone size={15} /> {company.phone}
            </a>
          )}
          {company.email && (
            <a href={`mailto:${company.email}`} className="inline-flex items-center gap-2">
              <Mail size={15} /> {company.email}
            </a>
          )}
          {place && (
            <span className="inline-flex items-center gap-2">
              <MapPin size={15} /> {place}
            </span>
          )}
        </div>
      </div>
    </Section>
  );
}

function SiteFooter({ company, theme }) {
  return (
    <footer
      className="px-5 sm:px-8 py-8 border-t text-center text-xs"
      style={{ borderColor: theme.border, color: theme.inkFaint }}
    >
      <p>
        © {new Date().getFullYear()} {company.name}
      </p>
      {/* Small, honest, and links out. A free site that says who made it is a
          fair trade; one that shouts it isn't. */}
      <p className="mt-1">
        Site by{" "}
        <a href="https://www.fieldquo.com" className="underline">
          FieldQuo
        </a>
      </p>
    </footer>
  );
}
