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
// ── No FieldQuo anywhere on it ──────────────────────────────────────────────
//
// The single sanctioned mention of our name on a client-facing surface is the
// "Site by FieldQuo" credit in the website footer, and lib/billing/access.js
// scopes it precisely: the price of a FREE WEBSITE, removed the moment they
// pay. That is a rule about one product, not a licence to sign every page. A
// bio link is a different surface and extending the credit onto it is a
// product decision nobody has made, so this page carries the contractor's name
// and nothing else.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import {
  Zap,
  FileText,
  CalendarDays,
  Megaphone,
  Globe,
  Phone,
  MessageCircle,
  Mail,
  Star,
  Link2,
  ChevronRight,
} from "lucide-react";
import { loadLinkPageData } from "@/lib/links/load";
import { visibleLinks } from "@/lib/links/config";
import { linkPageTheme } from "@/lib/links/theme";

const ICONS = {
  instant: Zap,
  quote: FileText,
  book: CalendarDays,
  site: Globe,
  phone: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  review: Star,
};

function iconFor(key) {
  if (key.startsWith("funnel:")) return Megaphone;
  if (key.startsWith("custom:")) return Link2;
  return ICONS[key] || Link2;
}

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
  const links = visibleLinks(candidates, config);
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

        <nav className="mt-8 space-y-3">
          {links.map((link, index) => {
            const Icon = iconFor(link.key);
            // The first row is the offer; the rest are the menu. One filled
            // button reads as "do this", and a column of nine identical filled
            // buttons reads as a wall — which is the thing that makes most
            // link-in-bio pages hard to use one-handed.
            const primary = index === 0;
            const external = link.kind === "external" || link.kind === "custom";
            return (
              <a
                key={link.key}
                href={link.url}
                {...(external
                  ? {
                      target: "_blank",
                      // noopener, but NOT noreferrer: these are the
                      // contractor's own destinations and their analytics
                      // should see where the visit came from.
                      rel: "noopener",
                    }
                  : {})}
                // min-h-14: a 56px target is the floor for a thumb, and this
                // page is only ever used with one.
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-base font-semibold"
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
        </nav>

        <footer className="mt-10 text-center text-xs" style={{ color: theme.pageMuted }}>
          © {new Date().getFullYear()} {company.name}
        </footer>
      </div>
    </main>
  );
}

function initial(name) {
  const first = String(name || "").trim().charAt(0);
  return first ? first.toUpperCase() : "•";
}
