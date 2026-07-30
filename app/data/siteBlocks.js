// app/data/siteBlocks.js
//
// The blocks a company website is made of.
//
// ── Why a fixed set rather than freeform ────────────────────────────────────
//
// The alternative — an AI that writes HTML, Lovable-style — produces a better
// first impression and a worse product. A contractor cannot debug a broken
// layout, so every generation has to be right, and "right" includes mobile,
// dark backgrounds, long company names and a logo nobody cropped. A fixed set
// of blocks that were designed once and tested once is right every time, and
// the AI's job shrinks to something it's actually reliable at: writing three
// sentences about a business.
//
// ── Every block has a factual fallback ──────────────────────────────────────
//
// `fromCompany` builds a block from data FieldQuo already holds — services,
// address, phone, testimonials. That means a site exists and is publishable
// the moment someone asks for one, before any AI runs and whether or not it
// succeeds. Generation improves the prose; it is never load-bearing.
//
// ── Images are URLs, not uploads-in-progress ────────────────────────────────
//
// Every image field holds a Cloudinary URL produced by /api/upload, the same
// path the logo uses. No block stores a File, a base64 blob or a local path —
// a page that renders differently depending on whose browser saved it is a
// class of bug worth designing out.

import {
  availabilityFor,
  validateComposition,
  compositionFromData,
  sectionsForPreset,
} from "@/lib/site/composition";

/**
 * type      — stored on the block, used by the renderer and the editor
 * label     — what the editor calls it
 * editable  — which fields get a text input; everything else is derived
 * repeats   — the block holds a list the company can add to and reorder
 * variants  — alternative layouts for the SAME content (see below)
 * derived   — the block renders from the company record, not from typed text
 */

/**
 * ── Why variants rather than a freer generator ──────────────────────────────
 *
 * "Make it modern and beautiful" is a layout problem, not a writing problem.
 * A better model produces a better headline; it does not produce a better
 * page. What produces a better page is more than one arrangement to choose
 * from — and every arrangement having been designed and checked on a phone
 * once, by a person, instead of assembled fresh each time by a model that
 * cannot see its own output.
 *
 * So the model picks a variant from a closed set. The worst case is a layout
 * that suits the content less well than another would have. The failure mode
 * we're avoiding — a page that is broken on mobile, or unreadable against
 * their brand colour — is unreachable, because no generated value ever becomes
 * a style rule.
 */
export const BLOCK_TYPES = {
  hero: {
    label: "Header",
    // Always first, never removable: a page with no headline is a page a
    // visitor bounces from.
    required: true,
    editable: ["headline", "subhead", "ctaLabel"],
    image: "backgroundImage",
    // centered  — text over a wash or a full-bleed photo. Safe everywhere, and
    //             the only one that looks deliberate with no image at all.
    // split     — text beside the photo on desktop, stacked on mobile. Best
    //             when they have one good photo and a lot to say.
    // banner    — full-bleed photo, words in a card over it. Needs an image.
    // overlay   — full-bleed photo, words directly on it with a scrim. Needs an
    //             image. Reads as a magazine cover rather than a brochure.
    // sidebyside— photo LEFT, text right: the mirror of split. Trivial to add
    //             and one of the cheapest ways to make two sites differ, since
    //             the eye reads the flip immediately.
    // minimal   — type only, enormous, no photo even if one exists. For a
    //             company whose headline is the whole pitch.
    variants: ["centered", "split", "banner", "overlay", "sidebyside", "minimal"],
    defaults: {
      headline: "",
      subhead: "",
      ctaLabel: "Get a free quote",
      backgroundImage: null,
      variant: "centered",
    },
  },

  services: {
    label: "What we do",
    required: false,
    // The LIST is generated from enabled service categories; the company
    // edits each item's blurb. Regenerating never invents a service they
    // don't offer, because the names come from their own settings.
    repeats: "items",
    editable: ["heading", "intro"],
    itemEditable: ["name", "description"],
    // cards      — two/three-column grid. Four to eight short entries.
    // list       — one column, rules between, bigger names. Two or three with
    //              real descriptions.
    // numbered   — the grid with accent numerals, for services that read as a
    //              sequence rather than a menu.
    // tiles      — filled accent tiles. Loud; pairs with the bold style.
    // alternating— full-width rows alternating text side. Slow and editorial;
    //              only sensible for three or fewer.
    variants: ["cards", "list", "numbered", "tiles", "alternating"],
    defaults: { heading: "What we do", intro: "", items: [], variant: "cards" },
  },

  about: {
    label: "About us",
    required: false,
    editable: ["heading", "body"],
    image: "image",
    // simple — prose in a readable column.
    // withphoto — prose beside the photo (falls back to simple with no image).
    // quote — the first sentence pulled out large, like a pull-quote.
    variants: ["simple", "withphoto", "quote"],
    defaults: { heading: "About us", body: "", image: null, variant: "simple" },
  },

  gallery: {
    label: "Our work",
    required: false,
    repeats: "images",
    editable: ["heading", "intro"],
    // The most persuasive block for a trade and the one FieldQuo can't fill
    // automatically — job photos live on jobs, not in a marketing library.
    // Left empty rather than padded with stock photography, which reads as a
    // company that has no photos of its own work.
    // grid    — even squares. Safe with any number of photos.
    // masonry — staggered heights; looks curated, needs 4+.
    // strip   — one horizontal scrolling row. Best on a phone, and the only
    //           variant that stays good with exactly two or three photos.
    variants: ["grid", "masonry", "strip"],
    defaults: { heading: "Our work", intro: "", images: [], variant: "grid" },
  },

  testimonials: {
    label: "What clients say",
    required: false,
    repeats: "items",
    editable: ["heading"],
    itemEditable: ["quote", "author"],
    // cards  — a grid of quotes.
    // single — one quote, very large. Strongest when there is only one good one,
    //          which is the common case for a company just starting out.
    // strip  — a horizontal scrolling row of narrow cards.
    variants: ["cards", "single", "strip"],
    defaults: { heading: "What clients say", items: [], variant: "cards" },
  },
  // Renders nothing until the company adds a question — an empty FAQ block on a
  // page is worse than none. The editor picks it up automatically from this
  // schema (generic over repeats/itemEditable), so no bespoke editor code.
  faq: {
    label: "FAQ",
    required: false,
    repeats: "items",
    editable: ["heading"],
    itemEditable: ["question", "answer"],
    defaults: { heading: "Frequently asked questions", items: [] },
  },

  // ── Blocks that render from the company record ────────────────────────────
  //
  // The three below have almost nothing to edit, and that is the point. Their
  // content is the opening hours, the booking calendar and the quote form that
  // already exist in FieldQuo. Nobody retypes a phone number into a website
  // and then has to remember to change it in two places when it changes.
  //
  // It also means these blocks are never stale and never wrong: the same
  // availability the booking page computes, the same services the internal
  // quote builder uses.

  quoteform: {
    label: "Request a quote (form)",
    required: false,
    editable: ["heading", "intro"],
    derived: true,
    defaults: {
      heading: "Tell us about your project",
      intro: "",
    },
  },

  booking: {
    label: "Book a visit (calendar)",
    required: false,
    editable: ["heading", "intro"],
    derived: true,
    defaults: {
      heading: "Book a visit",
      intro: "",
    },
  },

  hours: {
    label: "Opening hours",
    required: false,
    editable: ["heading", "note"],
    derived: true,
    defaults: {
      heading: "Opening hours",
      // For the thing hours can't express — "24/7 for emergencies", "closed
      // the first week of July". A free-text line beside the table beats
      // pretending the schedule model covers every case.
      note: "",
    },
  },

  contact: {
    label: "Get in touch",
    // Also always present. A contractor's website exists to produce a phone
    // call; a page you can't act on is a brochure.
    required: true,
    editable: ["heading", "intro"],
    defaults: {
      heading: "Get in touch",
      intro: "",
      // Rendered from the company record and the share links, never typed —
      // so a changed phone number is right everywhere at once.
      showQuoteLink: true,
      showBookingLink: true,
    },
  },

  // ══ Sections added so a generated page can actually look different ═════════
  //
  // The page used to be ten fixed sections in a fixed order. Composition is now
  // chosen (lib/site/composition.js), and these give it something to choose
  // between — a photo-led page and a services-led page need different parts,
  // not the same parts shuffled.

  beforeafter: {
    label: "Before & after",
    required: false,
    repeats: "pairs",
    editable: ["heading", "intro"],
    itemEditable: ["before", "after", "caption"],
    // The most persuasive thing a trade can show, and the reason JobVisit.photos
    // exists. A draggable divider rather than two images side by side: side-by-side
    // makes a viewer compare two rectangles, a slider makes them do the reveal
    // themselves, on the same pixels, which is why every restoration company on
    // earth uses one.
    //
    // `pairs` holds image URLs, so it needs its own sanitiser branch — the
    // generic itemEditable path would let a javascript: URL through as a string.
    imagePair: ["before", "after"],
    defaults: { heading: "Before & after", intro: "", pairs: [] },
  },

  process: {
    label: "How it works",
    required: false,
    repeats: "steps",
    editable: ["heading", "intro"],
    itemEditable: ["title", "body"],
    // Copy, not claims. The model may describe stages of the work; it is
    // instructed never to attach a timeline, a price or a guarantee to one,
    // because those are commitments the company would have to honour.
    defaults: { heading: "How it works", intro: "", steps: [] },
  },

  areas: {
    label: "Areas we serve",
    required: false,
    editable: ["heading", "intro"],
    // Derived from the company's own WorkArea rows. Never a typed list, because
    // a typed list of towns is the first thing to go stale, and a homeowner in a
    // town you quietly dropped is a wasted call for both of you.
    derived: true,
    defaults: { heading: "Areas we serve", intro: "" },
  },

  cta: {
    label: "Call to action band",
    required: false,
    editable: ["heading", "sub", "buttonLabel"],
    // The only repeatable section. One line of copy and two buttons — no facts
    // to get wrong — which makes it safe to use as the thing that breaks a long
    // page into chapters.
    defaults: {
      heading: "",
      sub: "",
      buttonLabel: "Get a free quote",
    },
  },
};

// The order the editor's "add a section" menu offers, roughly the order a
// visitor reads. NOT the order of a generated page any more — composition
// decides that (lib/site/composition.js). Kept because the editor needs a
// stable menu order and "whatever the last generation chose" is not one.
export const BLOCK_ORDER = [
  "hero",
  "services",
  "beforeafter",
  "gallery",
  "about",
  "process",
  "testimonials",
  "cta",
  "areas",
  // The two conversion blocks sit after the persuasion and before the footer.
  // Asking for details above the fold is how you get an empty form; asking
  // after they've seen the work is how you get a filled one.
  "quoteform",
  "booking",
  "hours",
  "faq",
  "contact",
];

let counter = 0;
function blockId(type) {
  // Stable within a session, unique within a page. Not a cuid: these are
  // array keys inside one Json column, never rows, and never referenced from
  // anywhere else.
  counter += 1;
  return `${type}_${Date.now().toString(36)}_${counter}`;
}

export function makeBlock(type, content = {}) {
  const def = BLOCK_TYPES[type];
  if (!def) throw new Error(`Unknown block type: ${type}`);
  return {
    id: blockId(type),
    type,
    visible: true,
    content: { ...def.defaults, ...content },
  };
}

/**
 * A complete, publishable page built only from what FieldQuo already knows.
 *
 * This is the floor, not the goal: prose is thin and the hero has no
 * headline until either the company writes one or generation fills it in.
 * But every fact on the page is true, which is the property that matters
 * when the alternative is a model guessing at a business it's never seen.
 */
/**
 * A complete, publishable page built only from what FieldQuo already knows.
 *
 * This is the floor, not the goal: prose is thin and the hero has no headline
 * until either the company writes one or generation fills it in. But every fact
 * on the page is true, which is the property that matters when the alternative
 * is a model guessing at a business it's never seen.
 *
 * ── It no longer returns one fixed page ────────────────────────────────────
 *
 * It used to build the same ten blocks in the same order for every company on
 * the platform, and generateSite's merge() mapped over that list — so no
 * generated site could ever have a different SHAPE from any other. That is the
 * whole of "there's only one template".
 *
 * Now it takes a `sections` list (from lib/site/composition.js) and builds
 * exactly those, in that order. With no list it derives one from what the
 * company actually has, so even the no-AI path differs between a company with a
 * portfolio and a company with twelve services and no photos.
 *
 * @param sections  ordered section keys. Already validated by the caller; keys
 *                  with no block type are skipped rather than throwing, because
 *                  a bad section name must not cost the company their page.
 */
export function siteFromCompany({
  company = {},
  services = [],
  testimonials = [],
  photos = [],
  photoPairs = [],
  areas = [],
  sections = null,
}) {
  const place = [company.city, company.province].filter(Boolean).join(", ");

  const available = availabilityFor({
    services,
    testimonials,
    photos,
    photoPairs: photoPairs.length,
    areas,
    hasHours: hasHours(company.businessHours),
  });

  const chosen = sections
    ? validateComposition(sections, available).sections
    : sectionsForPreset(
        compositionFromData(available, { serviceCount: services.length }),
        available,
      ).sections;

  // Content for a section, built from data. Deliberately a lookup rather than a
  // switch inside a loop: adding a section type means adding one entry here and
  // one renderer case, and nothing else.
  const CONTENT = {
    hero: () => ({
      headline: company.name || "",
      subhead: place ? `Serving ${place} and the surrounding area.` : "",
      backgroundImage: photos[0] || null,
    }),
    services: () => ({
      items: services.slice(0, 8).map((s) => ({ name: s.label, description: "" })),
    }),
    about: () => ({ body: "" }),
    gallery: () => ({ images: photos.slice(0, 12) }),
    beforeafter: () => ({
      pairs: photoPairs.slice(0, 6).map((pair) => ({
        before: pair.before,
        after: pair.after,
        caption: pair.caption || "",
      })),
    }),
    testimonials: () => ({
      items: testimonials.slice(0, 6).map((t) => ({
        quote: t.quote,
        author: [t.authorName, t.companyLabel].filter(Boolean).join(", "),
      })),
    }),
    // Steps are left EMPTY here. The factual fallback has no basis for
    // describing a company's process, and inventing four generic stages would
    // be exactly the padding-absent-data-with-defaults failure. Generation
    // fills them; without it the section drops out at render.
    process: () => ({ steps: [] }),
    areas: () => ({}),
    faq: () => ({ items: [] }),
    quoteform: () => ({ intro: "It takes about a minute, and there's no obligation." }),
    booking: () => ({ intro: "Pick a time that suits you and we'll confirm by email." }),
    hours: () => ({}),
    cta: () => ({
      heading: place ? `Working in ${place}?` : "Ready to get started?",
      sub: "Tell us about the job and we'll come and take a look.",
    }),
    contact: () => ({
      intro: place
        ? `Based in ${place}. Get in touch and we'll come and take a look.`
        : "Get in touch and we'll come and take a look.",
    }),
  };

  return chosen
    .filter((key) => BLOCK_TYPES[key])
    .map((key) => makeBlock(key, CONTENT[key] ? CONTENT[key]() : {}));
}

/**
 * Whether the hours column holds at least one open day.
 *
 * Duplicated in miniature from lib/company/businessHours.js on purpose: this
 * module is imported by the editor, which runs in the browser, and pulling the
 * full hours module in behind it would ship the Intl formatting and JSON-LD
 * builders to every visitor for one boolean.
 */
function hasHours(value) {
  return (
    Array.isArray(value) &&
    value.some((d) => d && typeof d === "object" && !d.closed)
  );
}

/**
 * Guards what reaches the database.
 *
 * The editor posts the whole page back, so this is the boundary between "what
 * a browser sent" and "what gets served to the public". Unknown block types
 * are dropped rather than stored — an unrecognised type would render as
 * nothing and be invisible to debug.
 */
export function sanitiseBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];

  return blocks
    .filter((b) => b && typeof b === "object" && BLOCK_TYPES[b.type])
    .slice(0, 20)
    .map((b) => ({
      id: String(b.id || blockId(b.type)).slice(0, 64),
      type: b.type,
      visible: b.visible !== false,
      content: sanitiseContent(b.type, b.content),
    }));
}

function sanitiseContent(type, content = {}) {
  const def = BLOCK_TYPES[type];
  const out = { ...def.defaults };

  for (const key of def.editable || []) {
    if (typeof content[key] === "string") out[key] = content[key].slice(0, 2000);
  }

  // An unrecognised variant falls back to the default rather than being
  // stored. This is the guard that keeps a generated value from becoming a
  // style rule: the renderer switches on this string, and a variant it has no
  // case for would render nothing at all — an invisible block, which is the
  // hardest kind of bug to be told about.
  if (def.variants) {
    out.variant = def.variants.includes(content.variant)
      ? content.variant
      : def.defaults.variant;
  }

  if (def.image && typeof content[def.image] === "string") {
    out[def.image] = safeImageUrl(content[def.image]);
  }

  if (def.repeats) {
    const list = Array.isArray(content[def.repeats]) ? content[def.repeats] : [];
    out[def.repeats] =
      def.repeats === "images"
        ? list.slice(0, 24).map(safeImageUrl).filter(Boolean)
        : list.slice(0, 24).map((item) => {
            const clean = {};
            for (const k of def.itemEditable || []) {
              if (typeof item?.[k] === "string") clean[k] = item[k].slice(0, 1000);
            }
            // Some repeated items carry IMAGE URLs, not prose — a before/after
            // pair is two of them. The loop above would have copied them
            // through as plain strings, which is how a `javascript:` value ends
            // up in a src on a public page. Re-run those keys through the URL
            // guard and drop anything that isn't http(s).
            for (const k of def.imagePair || []) {
              clean[k] = safeImageUrl(item?.[k]);
            }
            return clean;
          });

    // A before/after pair with only one side is not a slider. Dropping the
    // half-pair beats rendering a divider over a blank rectangle, which reads
    // as a broken image rather than as missing content.
    if (def.imagePair) {
      out[def.repeats] = out[def.repeats].filter((item) =>
        def.imagePair.every((k) => item[k]),
      );
    }
  }

  if (type === "contact") {
    out.showQuoteLink = content.showQuoteLink !== false;
    out.showBookingLink = content.showBookingLink !== false;
  }

  return out;
}

/**
 * Only http(s) URLs survive.
 *
 * These strings land in `src` attributes on a public page. `javascript:` in an
 * image src is inert in every current browser, but `data:` URLs are not
 * uniformly so, and the cost of being strict here is nothing — every legitimate
 * value comes from Cloudinary and starts with https.
 */
function safeImageUrl(value) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url.slice(0, 1000) : null;
}
