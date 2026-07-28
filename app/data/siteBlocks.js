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

/**
 * type      — stored on the block, used by the renderer and the editor
 * label     — what the editor calls it
 * editable  — which fields get a text input; everything else is derived
 * repeats   — the block holds a list the company can add to and reorder
 */
export const BLOCK_TYPES = {
  hero: {
    label: "Header",
    // Always first, never removable: a page with no headline is a page a
    // visitor bounces from.
    required: true,
    editable: ["headline", "subhead", "ctaLabel"],
    image: "backgroundImage",
    defaults: {
      headline: "",
      subhead: "",
      ctaLabel: "Get a free quote",
      backgroundImage: null,
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
    defaults: { heading: "What we do", intro: "", items: [] },
  },

  about: {
    label: "About us",
    required: false,
    editable: ["heading", "body"],
    image: "image",
    defaults: { heading: "About us", body: "", image: null },
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
    defaults: { heading: "Our work", intro: "", images: [] },
  },

  testimonials: {
    label: "What clients say",
    required: false,
    repeats: "items",
    editable: ["heading"],
    itemEditable: ["quote", "author"],
    defaults: { heading: "What clients say", items: [] },
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
};

export const BLOCK_ORDER = [
  "hero",
  "services",
  "about",
  "gallery",
  "testimonials",
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
export function siteFromCompany({ company = {}, services = [], testimonials = [] }) {
  const place = [company.city, company.province].filter(Boolean).join(", ");

  return [
    makeBlock("hero", {
      headline: company.name || "",
      subhead: place ? `Serving ${place} and the surrounding area.` : "",
    }),

    makeBlock("services", {
      items: services.slice(0, 8).map((s) => ({
        name: s.label,
        description: "",
      })),
    }),

    makeBlock("about", {
      body: "",
    }),

    makeBlock("gallery"),

    makeBlock("testimonials", {
      items: testimonials.slice(0, 6).map((t) => ({
        quote: t.quote,
        author: [t.authorName, t.companyLabel].filter(Boolean).join(", "),
      })),
    }),

    makeBlock("contact", {
      intro: place
        ? `Based in ${place}. Get in touch and we'll come and take a look.`
        : "Get in touch and we'll come and take a look.",
    }),
  ];
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
            return clean;
          });
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
