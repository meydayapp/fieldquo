// app/help/sitemap.xml/route.js
//
// The help centre's sitemap, at /help/sitemap.xml on www and at
// /sitemap.xml on help.fieldquo.com (middleware rewrites it there). Every URL
// is the canonical help.fieldquo.com spelling with hreflang alternates for
// the languages that carry a frame; only articles with a written body are
// listed, because a sitemap entry for a page that 404s is worse than none.
import { HELP_CHROME_LANGS } from "@/lib/help/chrome";
import { CATEGORY_KEYS } from "@/lib/help/tree";
import { loadCategory, writtenArticles } from "@/lib/help/content";
import { helpCanonical } from "@/lib/help/urls";

export const dynamic = "force-static";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function entry(build, lastmod) {
  const alts = HELP_CHROME_LANGS.map(
    (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(build(l))}"/>`,
  ).join("\n");
  return HELP_CHROME_LANGS.map(
    (l) => `  <url>\n    <loc>${esc(build(l))}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}${alts}\n  </url>`,
  ).join("\n");
}

export async function GET() {
  const parts = [entry((l) => helpCanonical(l), null)];
  for (const category of CATEGORY_KEYS) parts.push(entry((l) => helpCanonical(l, category), null));
  const written = await writtenArticles();
  const cache = new Map();
  for (const { category, slug } of written) {
    if (!cache.has(category)) cache.set(category, await loadCategory("en", category));
    const updated = cache.get(category)[slug]?.updated || null;
    parts.push(entry((l) => helpCanonical(l, category, slug), updated));
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${parts.join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
