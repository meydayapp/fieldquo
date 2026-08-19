// lib/site/gaps.js
//
// What the site is MISSING — and nothing else.
//
// ── The point ──────────────────────────────────────────────────────────────
//
// FieldQuo already knows the company's name, trades, phone, email, address,
// logo, brand colour, opening hours, booking availability and every service they
// sell. A builder that presents a form asking for those is asking the company to
// type things the product is already holding, and it is the reason the old screen
// felt like admin rather than like a tool.
//
// So the interface asks for exactly one category of thing: what genuinely isn't
// there yet. Each gap carries a plain-English question, where to go to fix it,
// and whether it BLOCKS a section from existing at all — because "no gallery"
// isn't a style preference, it's a section that cannot render.
//
// ── Ordered by what changes the page most ──────────────────────────────────
//
// Before/after pairs first. They are the single most persuasive thing a trade can
// put on a page, they unlock the section a homeowner scrolls for, and they are
// the one thing that needs a HUMAN decision FieldQuo cannot infer: which photo is
// the before.

/**
 * @param photos       urls available to the site (library + job photos)
 * @param photoPairs   confirmed before/after pairs
 * @returns [{ key, question, detail, action, blocks, severity }]
 */
export function siteGaps({
  company = {},
  services = [],
  testimonials = [],
  photos = [],
  photoPairs = [],
  hasHours = false,
} = {}) {
  const gaps = [];

  // ── The one that needs a person ──
  //
  // Unpaired photos are the case the whole pairing flow exists for: six photos
  // in a folder say nothing about which two belong together, and guessing on a
  // public page can caption a finished kitchen as the "before".
  if (photos.length >= 2 && photoPairs.length === 0) {
    gaps.push({
      key: "pairs",
      question: `You have ${photos.length} photos. Which are before-and-after pairs?`,
      detail:
        "Pick a before and an after and I'll add a slider a visitor can drag. I can't tell which is which from the files.",
      action: { label: "Pair them up", kind: "pair" },
      blocks: ["beforeafter"],
      severity: "high",
    });
  } else if (photos.length === 1) {
    gaps.push({
      key: "pairs-need-more",
      question: "One more photo and I can show a before-and-after.",
      detail: "A slider needs two shots of the same job — one before, one after.",
      action: { label: "Add photos", kind: "photos" },
      blocks: ["beforeafter"],
      severity: "medium",
    });
  }

  if (photos.length === 0) {
    gaps.push({
      key: "photos",
      question: "No photos of your work yet.",
      detail:
        "This is the biggest thing missing. Photos of finished jobs persuade more than any words I can write. Crew photos from job visits appear here automatically once they're taken.",
      action: { label: "Add photos", kind: "photos" },
      blocks: ["gallery", "beforeafter"],
      severity: "high",
    });
  }

  if (!company.logoUrl) {
    gaps.push({
      key: "logo",
      question: "No logo — I'm using your company name as the wordmark.",
      detail: "A logo makes the header look like a business rather than a draft.",
      action: { label: "Add a logo", kind: "link", href: "/app/settings/branding" },
      blocks: [],
      severity: "medium",
    });
  }

  if (!testimonials.length) {
    gaps.push({
      key: "testimonials",
      question: "No client reviews yet.",
      detail:
        "One good quote is enough — I'll give it a whole section rather than hiding it in a grid.",
      // Points at the reviews screen, not the website builder. The builder's
      // testimonial fields edit the site's block JSON, which is rebuilt from
      // the Testimonial table on the next regeneration — so following this
      // link there and typing a review lost it. Reviews are stored on
      // /app/settings/reviews, which is where this now goes.
      action: { label: "Add a review", kind: "link", href: "/app/settings/reviews" },
      blocks: ["testimonials"],
      severity: "medium",
    });
  }

  if (!hasHours) {
    gaps.push({
      key: "hours",
      question: "Opening hours aren't set.",
      detail:
        "These also put “Open · closes 5 PM” in your Google result, which is seen by people who never load your site.",
      action: { label: "Set hours", kind: "link", href: "/app/settings/company" },
      blocks: ["hours"],
      severity: "medium",
    });
  }

  if (!services.length) {
    gaps.push({
      key: "services",
      question: "No services enabled.",
      detail:
        "Without these there's nothing to list and nothing for the quote form to ask about.",
      action: { label: "Choose services", kind: "link", href: "/app/settings/services" },
      blocks: ["services", "quoteform"],
      severity: "high",
    });
  }

  // Deliberately NOT asked for: name, phone, email, address, brand colour,
  // trades, booking availability. All of those are already on the company record
  // and the site reads them live — asking again would be the form this screen was
  // rebuilt to get rid of.
  return gaps;
}

/** Just the sections currently impossible, for a one-line summary. */
export function blockedSections(gaps) {
  return [...new Set(gaps.flatMap((g) => g.blocks))];
}
