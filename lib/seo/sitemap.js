// lib/seo/sitemap.js
//
// The paths fieldquo.com's sitemap lists — FieldQuo's own public marketing
// pages and nothing else. Pure, so app/sitemap.xml/route.js and
// scripts/check-site-seo.mjs read the same list.
//
// Built from the same data each page's generateStaticParams reads, so a new
// feature page, industry, comparison or glossary term appears here the day
// it ships, and a removed one disappears — a sitemap entry that 404s is
// worse than none.
//
// NEVER here, and check:site-seo asserts it: /app, /platform, /sales, any
// token or client page (/q, /portal, /book, …), any contractor site (/site/*
// or a subdomain), and the help centre, which canonicalises to
// help.fieldquo.com and publishes its own sitemap there.

import { FEATURE_PAGES } from "@/app/data/featurePages";
import { INDUSTRIES } from "@/app/data/industries";
import { PRODUCT_FEATURES } from "@/app/data/productFeatures";
import { GLOSSARY_SLUGS } from "@/app/data/tradeGlossary";
import { COMPARE_PAGES } from "@/app/(marketing)/compare/compareCopy";

/** The single marketing pages, in roughly the order a visitor meets them. */
export const MARKETING_PAGES = Object.freeze([
  "/",
  "/pricing",
  "/features",
  "/compare",
  "/about",
  "/contact",
  "/savings",
  "/cost",
  "/resources",
  "/glossary",
  "/security",
  "/privacy",
  "/terms",
  "/careers",
  "/data-deletion",
]);

export function sitemapPaths() {
  return [
    ...MARKETING_PAGES,
    ...FEATURE_PAGES.map((p) => `/features/${p.slug}`),
    ...INDUSTRIES.map((i) => `/industries/${i.slug}`),
    ...Object.keys(PRODUCT_FEATURES).map((slug) => `/product/${slug}`),
    ...COMPARE_PAGES.map((p) => `/compare/${p.slug}`),
    ...GLOSSARY_SLUGS.map((slug) => `/glossary/${slug}`),
  ];
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The XML document, every URL absolute on `origin`. */
export function sitemapXml(origin) {
  const base = String(origin || "").replace(/\/+$/, "");
  const urls = sitemapPaths()
    .map((path) => `  <url>\n    <loc>${esc(`${base}${path === "/" ? "/" : path}`)}</loc>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
