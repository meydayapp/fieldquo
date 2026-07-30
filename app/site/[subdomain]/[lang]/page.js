// app/site/[subdomain]/[lang]/page.js
//
// The same site, in another language, at its own URL:
//
//   https://acme.fieldquo.com/        -> the primary language
//   https://acme.fieldquo.com/fr      -> French
//
// ── Why a path and not ?lang=fr or a cookie ────────────────────────────────
//
// A real URL is the only version a search engine can index as French, share as
// French, or return to a French speaker. A query parameter usually collapses to
// the canonical URL, and a cookie means one URL that serves different content to
// different people — which search engines treat as a single page and index in
// whichever language they happened to see.
//
// ── Why it delegates rather than duplicating ───────────────────────────────
//
// This file deliberately holds no rendering. Everything — loading, section
// composition, live company data, placeholders, the JSON-LD — lives in the parent
// page and is called with a language. Copying any of it here would guarantee the
// French page drifts from the English one the first time either is touched, and
// that drift would be invisible to anyone who only ever looks at one of them.
import { notFound } from "next/navigation";
import { isSupported } from "@/app/i18n/languages";
import CompanySitePage, { generateMetadata as parentMetadata } from "../page";

function read(lang) {
  const code = String(lang || "").toLowerCase();
  // Unsupported codes 404 rather than falling back. A /de that quietly serves
  // English is a duplicate page in a search index and a lie to the visitor.
  return isSupported(code) ? code : null;
}

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const code = read(lang);
  if (!code) return { title: "Not found", robots: { index: false } };
  return parentMetadata({ params, language: code });
}

export default async function LocalisedSitePage({ params, searchParams }) {
  const { lang } = await params;
  const code = read(lang);
  if (!code) notFound();
  // The parent enforces that this language is actually ENABLED for this company
  // — being a supported code isn't the same as one this site publishes.
  return CompanySitePage({ params, searchParams, language: code });
}
