// app/site/[subdomain]/SiteBlocks.js
//
// Renders the blocks. Shared by the public page and the editor's preview, so
// what a company sees while editing is the same component a visitor gets —
// not an approximation that drifts.
//
// ── No "use client" ─────────────────────────────────────────────────────────
//
// Deliberately a server component. There is nothing interactive on a
// contractor's marketing page: the calls to action are anchors to the quote
// form, the booking page and a tel: link. Shipping React to a stranger so they
// can read three paragraphs and tap a phone number is a cost with no return,
// and it's the difference between working and not working on a bad connection
// in a driveway.
//
// ── Every colour comes from their brand ─────────────────────────────────────
//
// Same documentTheme the quotes and invoices use, so a client who gets a
// quote and then looks up the website sees one company. Contrast is measured,
// not assumed — see lib/documents/theme.js.

import { Phone, Mail, MapPin, FileText, CalendarDays } from "lucide-react";

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

const Section = ({ children, alt, theme }) => (
  <section
    className="px-5 sm:px-8 py-14 sm:py-20"
    style={alt ? { backgroundColor: theme.accentWash } : undefined}
  >
    <div className="max-w-4xl mx-auto">{children}</div>
  </section>
);

const Heading = ({ children, theme }) =>
  children ? (
    <h2
      className="text-2xl sm:text-3xl font-bold mb-3"
      style={{ color: theme.ink }}
    >
      {children}
    </h2>
  ) : null;

function SiteHeader({ company, theme, fill }) {
  return (
    <header className="border-b" style={{ borderColor: theme.border }}>
      <div className="h-1.5 flex">
        <div className="flex-[2]" style={{ backgroundColor: fill.bg }} />
        <div style={{ backgroundColor: theme.accentSoft }} className="flex-1" />
      </div>
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
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

function Hero({ block, company, theme, fill, subdomain }) {
  const { headline, subhead, ctaLabel, backgroundImage } = block.content;

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
          {headline || company.name}
        </h1>
        {subhead && (
          <p
            className="mt-4 text-base sm:text-lg leading-relaxed"
            style={{
              color: backgroundImage ? "rgba(255,255,255,0.9)" : theme.inkMuted,
            }}
          >
            {subhead}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3 justify-center">
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
                borderColor: backgroundImage ? "#ffffff" : theme.accent,
                color: backgroundImage ? "#ffffff" : theme.accentText,
              }}
            >
              Call {company.phone}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function Services({ block, theme }) {
  const { heading, intro, items } = block.content;
  if (!items?.length) return null;

  return (
    <Section theme={theme}>
      <Heading theme={theme}>{heading}</Heading>
      {intro && (
        <p className="text-base leading-relaxed mb-8" style={{ color: theme.inkMuted }}>
          {intro}
        </p>
      )}
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

function About({ block, theme }) {
  const { heading, body, image } = block.content;
  if (!body && !image) return null;

  return (
    <Section theme={theme} alt>
      <div className="grid sm:grid-cols-2 gap-8 items-center">
        <div>
          <Heading theme={theme}>{heading}</Heading>
          {body && (
            <p
              className="text-base leading-relaxed whitespace-pre-wrap"
              style={{ color: theme.inkMuted }}
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
    <Section theme={theme}>
      <Heading theme={theme}>{heading}</Heading>
      {intro && (
        <p className="text-base leading-relaxed mb-8" style={{ color: theme.inkMuted }}>
          {intro}
        </p>
      )}
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
      <Heading theme={theme}>{heading}</Heading>
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

function Contact({ block, company, theme, fill }) {
  const { heading, intro, showQuoteLink, showBookingLink } = block.content;
  const place = [company.address, company.city, company.province]
    .filter(Boolean)
    .join(", ");

  return (
    <Section theme={theme}>
      <div className="text-center">
        <Heading theme={theme}>{heading}</Heading>
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
