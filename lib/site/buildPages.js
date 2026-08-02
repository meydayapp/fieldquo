// lib/site/buildPages.js
//
// Turns the generator's single flat block list into a real multi-page site:
// Home + Services + Our Work + About + Book + Get a quote + Contact, each with
// its own hero and the blocks that belong there. This is what makes the output
// a website with a menu rather than one long scroll.
//
// Deterministic on purpose — no model call. The AI still writes the COPY (into
// the flat blocks); this only arranges those blocks across pages, so it can't
// invent a service or a claim, and it produces the same structure every time
// for the same input. A page with nothing real to show is dropped rather than
// padded (an empty "Our Work" is worse than no "Our Work").

import { makeBlock } from "@/app/data/siteBlocks";
import { HOME_SLUG } from "@/lib/site/pages";

// A plain centred hero for a secondary page. Headline only — no invented
// subcopy, no image (the home hero keeps the photo; inner pages lead with type).
function pageHero(headline, sub) {
  return makeBlock("hero", {
    headline,
    subhead: sub || "",
    variant: "centered",
    ctaLabel: "Get a free quote",
  });
}

// Clone a generated block onto a page with a FRESH id — the same block can
// legitimately appear on Home (a preview) and its own page (in full), and they
// must be independently editable, not two references to one id.
function clone(block) {
  return block ? makeBlock(block.type, block.content) : null;
}

/**
 * @param blocks     the generator's flat block list (its Home-style page)
 * @param available  { services, photos, photoPairs, testimonials, areas,
 *                     hours, credentials } — the same availability flags the
 *                     composition uses. A page is only built if it has content.
 * @returns pages array: [{ id, slug, title, nav, blocks }], Home first.
 */
export function buildPages(blocks, available = {}) {
  const list = Array.isArray(blocks) ? blocks : [];
  const byType = {};
  for (const b of list) (byType[b.type] ||= []).push(b);
  const first = (type) => byType[type]?.[0] || null;

  const homeHero = first("hero") || pageHero("Welcome");
  const featuredVisual = first("beforeafter") || first("gallery");

  const pages = [];

  // ── Home ── a curated preview, not the whole site: what we do, a taste of the
  // work, proof, a nudge, a way to reach us.
  pages.push({
    id: HOME_SLUG,
    slug: HOME_SLUG,
    title: "Home",
    nav: true,
    blocks: [
      clone(homeHero),
      clone(first("services")),
      clone(featuredVisual),
      clone(first("testimonials")),
      clone(first("cta")),
      clone(first("contact")),
    ].filter(Boolean),
  });

  // ── Services ──
  if (available.services || byType.services) {
    pages.push({
      id: "services",
      slug: "services",
      title: "Services",
      nav: true,
      blocks: [
        pageHero("What we do"),
        clone(first("services")),
        clone(first("process")),
        clone(first("cta")),
      ].filter(Boolean),
    });
  }

  // ── FAQ ── its own page when there are questions. The generator always writes
  // some (FAQ is in ALWAYS_INCLUDE), so this is reliably present.
  const faqItems = first("faq")?.content?.items;
  if (Array.isArray(faqItems) && faqItems.length) {
    pages.push({
      id: "faq",
      slug: "faq",
      title: "FAQ",
      nav: true,
      blocks: [
        pageHero("Frequently asked questions"),
        clone(first("faq")),
        clone(first("cta")),
      ].filter(Boolean),
    });
  }

  // ── Our Work ── only when there's real work to show.
  if (available.photos || available.photoPairs || byType.gallery || byType.beforeafter) {
    pages.push({
      id: "work",
      slug: "work",
      title: "Our Work",
      nav: true,
      blocks: [
        pageHero("Our work"),
        clone(first("beforeafter")),
        clone(first("gallery")),
        clone(first("cta")),
      ].filter(Boolean),
    });
  }

  // ── Reviews ── its own page when there are testimonials.
  const testimonialItems = first("testimonials")?.content?.items;
  if (Array.isArray(testimonialItems) && testimonialItems.length) {
    pages.push({
      id: "reviews",
      slug: "reviews",
      title: "Reviews",
      nav: true,
      blocks: [
        pageHero("What clients say"),
        clone(first("testimonials")),
        clone(first("cta")),
      ].filter(Boolean),
    });
  }

  // ── About ── only when there's a story or credentials to stand on.
  if (byType.about || available.credentials || byType.credentials || available.areas) {
    pages.push({
      id: "about",
      slug: "about",
      title: "About",
      nav: true,
      blocks: [
        pageHero("About us"),
        clone(first("about")),
        clone(first("credentials")),
        clone(first("areas")),
        clone(first("cta")),
      ].filter(Boolean),
    });
  }

  // ── Book ── the booking calendar, always. A derived block, so it renders from
  // the company's availability whether or not the generator emitted one.
  pages.push({
    id: "book",
    slug: "book",
    title: "Book",
    nav: true,
    blocks: [
      pageHero("Book a visit"),
      clone(first("booking")) || makeBlock("booking", {}),
      clone(first("hours")),
    ].filter(Boolean),
  });

  // ── Get a quote ── the self-quote form, always.
  pages.push({
    id: "quote",
    slug: "quote",
    title: "Get a quote",
    nav: true,
    blocks: [
      pageHero("Get a free quote"),
      clone(first("quoteform")) || makeBlock("quoteform", {}),
    ].filter(Boolean),
  });

  // ── Contact ── always. The page a site exists to produce.
  pages.push({
    id: "contact",
    slug: "contact",
    title: "Contact",
    nav: true,
    blocks: [
      pageHero("Get in touch"),
      clone(first("contact")) || makeBlock("contact", {}),
      clone(first("hours")),
      clone(first("areas")),
    ].filter(Boolean),
  });

  return pages;
}
