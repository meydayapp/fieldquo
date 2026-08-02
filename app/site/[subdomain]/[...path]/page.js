// app/site/[subdomain]/[...path]/page.js
//
// One catch-all for everything below the site root, because pages and languages
// share the same URL space:
//
//   /            -> Home, primary language          (the parent page.js)
//   /fr          -> Home, French
//   /services    -> Services page, primary language
//   /fr/services -> Services page, French
//
// The first segment is a language code if it IS one (a site only publishes a
// known set), otherwise it's a page slug. This replaces the old [lang] route —
// a second dynamic segment ([lang] and [...path]) can't coexist at this level,
// and pages need more than one segment anyway.
//
// It holds no rendering: everything — loading, page selection, composition,
// translation, JSON-LD — lives in the parent page and is called with a language
// and a page slug, so a sub-page can never drift from the home page.
import { notFound } from "next/navigation";
import { isSupported } from "@/app/i18n/languages";
import CompanySitePage, { generateMetadata as parentMetadata } from "../page";

// Turn the path segments into { language, pageSlug }. Returns null for anything
// that isn't a valid shape — a 404, not a silent fall-through to Home.
function parseRoute(pathArr) {
  const segs = (Array.isArray(pathArr) ? pathArr : []).map((s) => String(s || "").toLowerCase());
  if (segs.length === 0 || segs.length > 2) return null;

  if (isSupported(segs[0])) {
    // /<lang> or /<lang>/<page>
    return { language: segs[0], pageSlug: segs[1] || null };
  }
  // /<page> in the primary language — a single segment only. /<not-a-lang>/x is
  // not a shape we serve.
  if (segs.length === 1) return { language: null, pageSlug: segs[0] };
  return null;
}

export async function generateMetadata({ params }) {
  const { path } = await params;
  const parsed = parseRoute(path);
  if (!parsed) return { title: "Not found", robots: { index: false } };
  return parentMetadata({
    params,
    language: parsed.language || undefined,
    pageSlug: parsed.pageSlug || undefined,
  });
}

export default async function SiteSubPage({ params, searchParams }) {
  const { path } = await params;
  const parsed = parseRoute(path);
  if (!parsed) notFound();
  // The parent enforces that the language is actually ENABLED and that the page
  // slug actually exists — both 404 rather than serving Home in English.
  return CompanySitePage({
    params,
    searchParams,
    language: parsed.language || undefined,
    pageSlug: parsed.pageSlug || undefined,
  });
}
