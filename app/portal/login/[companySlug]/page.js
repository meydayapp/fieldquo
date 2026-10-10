// app/portal/login/[companySlug]/page.js
//
// "Client login" for a company whose website is NOT built on FieldQuo
// (owner, 2026-10-10). The FieldQuo-built site has /client
// (app/site/[subdomain]); a contractor with their own site had no door to
// put in their menu. This is that door — e.g.
// https://www.fieldquo.com/portal/login/<companySlug> — linked from their
// header and footer, and copied from Settings → Lead capture form.
//
// ── Same machine, second door ──────────────────────────────────────────────
//
// The form is the site's own ClientLoginForm and it posts to the same
// /api/portal-login, which resolves the company from this page's slug on the
// server, never from anything the browser chooses. Same per-connection and
// per-address limits (one per-address bucket per company whichever door),
// same neutral sentence whether or not the address matched, same send after
// the response. lib/portal/loginLink.js re-sends each matching client their
// own link and grants the typist nothing.
//
// ── White-label ────────────────────────────────────────────────────────────
//
// The company's logo, name and measured brand colours (lib/documents/
// theme.js) and nothing of ours: the tab title, icon and share card come from
// clientPageMetadata, and an unknown slug gets the neutral not-found beside
// this file rather than FieldQuo's marketing 404.
//
// ── Which company, and on which host ───────────────────────────────────────
//
// findBookingCompany — bookingSlug first, then slug — so the slug already in
// a company's embed code is the slug that works here, and a company not ready
// to face a client (no business name yet) has no login page, exactly as it
// has no booking page. /portal passes through on a tenant's own subdomain
// (middleware.js SUBDOMAIN_PASSTHROUGH); there, only that tenant's own login
// is served, so alpha.fieldquo.com can never show Beta's page.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { ensureContrast } from "@/lib/brand/colour";
import { siteCopy, SITE_COPY } from "@/lib/site/siteCopy";
import { pickVisitorLanguage } from "@/lib/i18n/acceptLanguage";
import { subdomainFromHost } from "@/lib/site/subdomain";
import { clientPageMetadata, neutralClientMetadata } from "@/lib/whiteLabel/pageMetadata";
import ClientLoginForm from "@/app/site/[subdomain]/ClientLoginForm";

const ROBOTS = { index: false, follow: false };

const COMPANY_SELECT = {
  id: true,
  name: true,
  logoUrl: true,
  brandColor: true,
  phone: true,
  email: true,
  defaultLanguage: true,
  slug: true,
  bookingSlug: true,
};

/**
 * The company this page is for, or null. Null for an unknown or not-ready
 * slug, and on a tenant's subdomain for any company but that tenant's own.
 */
async function loadCompany(companySlug) {
  const slug = String(companySlug || "").trim().toLowerCase();
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null;
  const company = await findBookingCompany(slug, COMPANY_SELECT);
  if (!company) return null;
  const sub = subdomainFromHost((await headers()).get("host"));
  if (sub) {
    const site = await db.companySite.findUnique({ where: { subdomain: sub }, select: { companyId: true } });
    if (!site || site.companyId !== company.id) return null;
  }
  return company;
}

/**
 * The visitor's language: an explicit ?lang= the company put in its own link
 * (a French page linking the French login), else the browser's first
 * supported language, else the company's default. Only the eight client
 * languages the copy exists in.
 */
async function pageLanguage(company, query) {
  const asked = String(query?.lang || "").toLowerCase();
  if (asked && SITE_COPY[asked]) return asked;
  const picked = pickVisitorLanguage((await headers()).get("accept-language"), company?.defaultLanguage || "en");
  return SITE_COPY[picked] ? picked : "en";
}

export async function generateMetadata({ params, searchParams }) {
  const { companySlug } = await params;
  const company = await loadCompany(companySlug);
  if (!company) return neutralClientMetadata({ title: " ", robots: ROBOTS });
  const t = siteCopy(await pageLanguage(company, await searchParams));
  // A door, not content: titled as the company's account page, never indexed.
  return clientPageMetadata(company, { title: `${t.clientLoginHeading} · ${company.name}`, robots: ROBOTS });
}

export default async function PortalLoginPage({ params, searchParams }) {
  const { companySlug } = await params;
  const company = await loadCompany(companySlug);
  if (!company) notFound();

  const language = await pageLanguage(company, await searchParams);
  const t = siteCopy(language);
  const theme = documentTheme(company);
  const fill = fillPair(theme);
  const contact = [company.phone, company.email].filter(Boolean);
  // The contact line sits on the PAGE tint, not on paper, and theme.inkMuted
  // is measured against paper: on #f6f4f0 it is 4.40:1, under the bar. So it
  // is measured again, against what it actually sits on.
  const mutedOnPage = ensureContrast(theme.inkMuted, theme.page, 4.5);

  return (
    <main lang={language} className="min-h-screen px-4 py-10 sm:py-16" style={{ backgroundColor: theme.page }}>
      <div className="mx-auto w-full max-w-md">
        <div
          className="overflow-hidden rounded-2xl border shadow-sm"
          style={{ backgroundColor: theme.paper, borderColor: theme.border }}
        >
          {/* The brand rule — decoration only, so its colour carries no text
              and needs no contrast; every word sits on paper below it. */}
          <div aria-hidden="true" className="h-1.5" style={{ backgroundColor: theme.accentFill }} />
          <div className="px-6 py-8 sm:px-8">
            <div className="mb-6 flex items-center gap-3">
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt={company.name} className="h-12 w-auto max-w-[200px] object-contain" />
              ) : (
                <span className="text-lg font-extrabold tracking-[-0.01em]" style={{ color: theme.ink }}>
                  {company.name}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold tracking-[-0.02em]" style={{ color: theme.ink }}>
              {t.clientLoginHeading}
            </h1>
            <p className="mt-2 mb-6 text-base leading-relaxed" style={{ color: theme.inkMuted }}>
              {t.clientLoginIntro}
            </p>
            {/* Plain strings and measured colours only — a Proxy and a theme
                object do not cross to a client component. */}
            <ClientLoginForm
              companySlug={company.bookingSlug || company.slug}
              copy={{
                email: t.clientLoginEmail,
                send: t.clientLoginSend,
                sent: t.clientLoginSent,
                invalid: t.clientLoginInvalid,
                busy: t.clientLoginBusy,
                failed: t.clientLoginFailed,
                noPassword: t.clientLoginNoPassword,
              }}
              colours={{
                ink: theme.ink,
                muted: theme.inkMuted,
                border: theme.border,
                wash: theme.positiveWash,
                positive: theme.positive,
                negative: theme.negative,
                fillBg: fill.bg,
                fillFg: fill.fg,
              }}
            />
          </div>
        </div>
        {contact.length > 0 && (
          <p className="mt-6 text-center text-sm" style={{ color: mutedOnPage }}>
            {company.name} · {contact.join(" · ")}
          </p>
        )}
      </div>
    </main>
  );
}
