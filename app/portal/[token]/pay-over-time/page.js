// app/portal/[token]/pay-over-time/page.js
//
// "How to pay over time" — the client's guide to paying an invoice with
// Klarna (or Affirm), in the company's colours and the client's language.
//
// Linked from two places, each ONLY when the server offers pay-over-time on
// that payment (lib/payments/payOverTimeGuide.js payOverTimeOffer — the rule
// the portal's "Pay over time" button is drawn by):
//   * the portal invoice page, under that button;
//   * the invoice / payment-request email (lib/email/invoiceEmail.js).
//
// The query string (`p`, `invoice`, `stage`, `request`) is a hint for which
// provider to name and where "Back" goes. It grants nothing: the page names
// only providers this company has switched on AND Stripe has activated now
// (guideProviders), and carries no amount. A company where none is on gets an
// honest "not offered right now" instead of four steps towards a button that
// is not there.
//
// Server-rendered and white-label: the company's name and icon in the tab
// (lib/whiteLabel/pageMetadata.js), never FieldQuo's, and noindex — a portal
// token in a search index would defeat the token.

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { resolveClientLanguage } from "@/lib/i18n/resolveLanguage";
import { payOverTimeGuideCopy } from "@/lib/i18n/payOverTimeGuideCopy";
import { companyDisplayName } from "@/lib/i18n/companyName";
import {
  PAY_OVER_TIME_COMPANY_SELECT,
  guideBackPath,
  guidePalette,
  guideProviders,
  providerNames,
} from "@/lib/payments/payOverTimeGuide";
import { clientPageMetadata, documentTitle, neutralClientMetadata } from "@/lib/whiteLabel/pageMetadata";
import { portalCompany } from "@/lib/whiteLabel/metadataLoaders";
import PayOverTimeGuide from "./PayOverTimeGuide";

const ROBOTS = { index: false, follow: false };

const isToken = (t) => typeof t === "string" && t.length > 0 && t.length <= 256;

export async function generateMetadata({ params }) {
  const { token } = await params;
  const found = await portalCompany(token);
  if (!found) return neutralClientMetadata({ title: "How to pay over time", robots: ROBOTS });
  const language = resolveClientLanguage(found.client, found.company);
  const { title } = payOverTimeGuideCopy(language);
  return clientPageMetadata(found.company, {
    title: documentTitle(title, null, found.company.name),
    shareTitle: found.company.name,
    robots: ROBOTS,
  });
}

async function loadClient(token) {
  const select = {
    language: true,
    company: {
      select: {
        name: true,
        logoUrl: true,
        brandColor: true,
        defaultLanguage: true,
        ...PAY_OVER_TIME_COMPANY_SELECT,
      },
    },
  };
  // Neon scales to zero; the first query after idle can fail once (P1001).
  try {
    return await db.client.findUnique({ where: { portalToken: token }, select });
  } catch {
    return await db.client.findUnique({ where: { portalToken: token }, select });
  }
}

export default async function PayOverTimePage({ params, searchParams }) {
  // Next 16: both are Promises.
  const { token } = await params;
  const { p, invoice, stage, request } = (await searchParams) || {};
  if (!isToken(token)) notFound();

  const client = await loadClient(token);
  if (!client?.company) notFound();
  const company = client.company;

  const language = resolveClientLanguage(client, company);
  const names = providerNames(guideProviders(company, p));
  const copy = payOverTimeGuideCopy(language, { names, company: company.name || "" });
  const ids = {
    invoiceId: typeof invoice === "string" ? invoice : null,
    stageId: typeof stage === "string" ? stage : null,
    requestId: typeof request === "string" ? request : null,
  };
  const backHref = guideBackPath(token, ids);

  return (
    <PayOverTimeGuide
      copy={copy}
      pal={guidePalette(company)}
      company={{ name: companyDisplayName(company.name), logoUrl: company.logoUrl || null }}
      names={names}
      backHref={backHref}
      backLabel={backHref.includes("/invoices/") ? copy.backToInvoice : copy.backToAccount}
    />
  );
}
