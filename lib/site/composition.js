// lib/site/composition.js
//
// WHICH sections a generated page has, and in WHAT ORDER.
//
// ── The bug this file exists to fix ─────────────────────────────────────────
//
// siteFromCompany() returned one hardcoded list in one hardcoded order, and
// generateSite's merge() mapped over that list — so the section set and the
// section order could never change. The model chose the words, a design style,
// and two layout variants. Everything else was identical on every site FieldQuo
// has ever produced, for every company, forever. Reported as "there is only one
// template", and that was exactly right.
//
// ── What the model gets to decide now ───────────────────────────────────────
//
// An ORDERED LIST OF SECTION KEYS, drawn from a closed vocabulary, plus a
// variant per section. That is a real design decision — a photo-led page for a
// company with a portfolio reads nothing like a services-first page for a
// company with twelve trades and no pictures — while still making it impossible
// for the model to invent a service, a price, or a style rule.
//
// ── What the model does NOT get to decide ───────────────────────────────────
//
// Whether a section is POSSIBLE. It can ask for a gallery; if there are no
// photos it doesn't get one. It can ask for testimonials; if there are none it
// doesn't get those either. `validateComposition` is the boundary, and it is
// applied server-side after generation, not trusted from the model's output.
// An empty section is the same failure as a dead button: it looks like a
// feature and does nothing.
//
// ── The fallback varies too ─────────────────────────────────────────────────
//
// If the AI is unconfigured or fails, `compositionFromData` picks a shape from
// what the company actually HAS. That's deliberate: if only the AI path varied,
// every company without AI would still get the one template, and so would
// everyone during an outage. The choice is data-driven rather than random, so
// it's reproducible and explainable — the same company gets the same page.

/**
 * Every section a generated page may contain.
 *
 *   needs — what must exist for the section to be worth rendering. Checked
 *           against the `available` flags, never against the model's word.
 *   once  — sections that must not appear twice (a page with two heroes).
 */
export const SECTION_VOCABULARY = {
  hero: { needs: null, once: true, required: true },
  services: { needs: "services", once: true },
  about: { needs: null, once: true },
  gallery: { needs: "photos", once: true },
  beforeafter: { needs: "photoPairs", once: true },
  testimonials: { needs: "testimonials", once: true },
  process: { needs: null, once: true },
  areas: { needs: "areas", once: true },
  faq: { needs: null, once: true },
  quoteform: { needs: null, once: true },
  booking: { needs: null, once: true },
  hours: { needs: "hours", once: true },
  // A call-to-action band. Pure layout with one line of copy, no facts, so it
  // is the one section that may appear more than once — it's how a long page
  // gets broken up without inventing content to fill the gap.
  cta: { needs: null, once: false },
  contact: { needs: null, once: true, required: true },
};

export const SECTION_KEYS = Object.keys(SECTION_VOCABULARY);

// ── House rules ────────────────────────────────────────────────────────────
//
// Set by the product owner, enforced here rather than asked of the model — a
// prompt can be ignored, a clamp cannot.
//
// MAX_SECTIONS: a focused page beats a long one. Seven destinations is about the
// most a homeowner will scan before deciding to phone, and it is the difference
// between "considered" and "everything we could think of".
//
// The consequence, stated plainly: hero + services + one visual + quote form +
// booking + FAQ + contact IS seven. So `about`, `testimonials`, `process`,
// `areas` and `cta` only appear when something discretionary drops out. Raise
// this to 9 if you'd rather always have room for reviews and an about section.
export const MAX_SECTIONS = 7;

// Always on the page, whatever the model or a preset asks for. These are the
// four things a contractor's site exists to produce: a way to get a price, a way
// to get on the calendar, answers to the obvious questions, and a way to phone.
// Dropping any of them to make room for a nicer-looking section would be
// optimising the wrong thing.
export const ALWAYS_INCLUDE = ["quoteform", "booking", "faq", "contact"];

// What gets cut first when the page is over length. Ordered least-valuable-first,
// so the trim is a stated priority rather than "whatever happened to be last".
const TRIM_ORDER = [
  "cta",      // pure layout, no information
  "areas",    // nice, rarely decisive
  "process",  // generic by nature
  "hours",
  "about",    // the least-read section on any trade site
  // gallery BEFORE testimonials, but only when a before/after slider survives —
  // see trimOrderFor. A page with a slider already has its visuals; a page
  // without one needs the gallery more than it needs quotes.
  "gallery",
  "testimonials",
];

/**
 * The trim order for THIS page.
 *
 * With no before/after slider the gallery is the only thing showing the work, so
 * it outranks testimonials. With a slider the visuals are covered and a client
 * quote earns the space instead.
 */
function trimOrderFor(sections) {
  if (sections.includes("beforeafter")) return TRIM_ORDER;
  return TRIM_ORDER.map((k) =>
    k === "gallery" ? "testimonials" : k === "testimonials" ? "gallery" : k,
  );
}

/**
 * Hand-designed page shapes. Named for what they lead with, because that's the
 * decision — the first two sections after the hero are what a visitor sees.
 *
 * These are the model's menu AND the data-driven fallback's menu. Written by
 * hand so every one of them is a page a designer would defend.
 */
export const COMPOSITION_PRESETS = {
  // Portfolio-first. For anyone with real photographs: the work sells the work.
  showcase: {
    label: "Show the work first",
    sections: [
      "hero",
      "beforeafter",
      "services",
      "gallery",
      "cta",
      "testimonials",
      "about",
      "quoteform",
      "faq",
      "booking",
      "contact",
    ],
  },

  // Services-first. For a company with many trades and little imagery — the
  // question a visitor has is "do you even do my thing".
  catalogue: {
    label: "Lead with services",
    sections: [
      "hero",
      "services",
      "process",
      "cta",
      "about",
      "gallery",
      "testimonials",
      "areas",
      "quoteform",
      "faq",
      "hours",
      "contact",
    ],
  },

  // Trust-first. For an established firm whose advantage is reputation.
  trust: {
    label: "Lead with reputation",
    sections: [
      "hero",
      "testimonials",
      "about",
      "services",
      "gallery",
      "process",
      "cta",
      "faq",
      "quoteform",
      "booking",
      "hours",
      "contact",
    ],
  },

  // Booking-first. For anyone whose job is to get onto a calendar — cleaning,
  // inspections, recurring maintenance.
  booking: {
    label: "Lead with booking",
    sections: [
      "hero",
      "booking",
      "services",
      "hours",
      "areas",
      "cta",
      "testimonials",
      "gallery",
      "about",
      "faq",
      "contact",
    ],
  },

  // Deliberately short. A one-screen page for a company with almost no content
  // yet — better than a long page of empty sections, which is what padding a
  // template produces.
  onepager: {
    label: "Short one-pager",
    sections: ["hero", "services", "cta", "about", "quoteform", "contact"],
  },
};

export const COMPOSITION_KEYS = Object.keys(COMPOSITION_PRESETS);
export const DEFAULT_COMPOSITION = "catalogue";

/**
 * Which sections are actually possible for this company.
 *
 * @param photoPairs  how many before/after PAIRS exist. Distinct from `photos`
 *                    on purpose: a slider needs two images that belong
 *                    together, and one photo makes a gallery but not a slider.
 */
export function availabilityFor({
  services = [],
  testimonials = [],
  photos = [],
  photoPairs = 0,
  areas = [],
  hasHours = false,
} = {}) {
  return {
    services: services.length > 0,
    testimonials: testimonials.length > 0,
    photos: photos.length > 0,
    photoPairs: photoPairs >= 1,
    areas: areas.length > 0,
    hours: Boolean(hasHours),
  };
}

/**
 * Clamp a requested section list to something renderable.
 *
 * Applied to the MODEL's answer and to a preset alike, so there is one place
 * that decides whether a section survives. Order is preserved; impossible and
 * unknown sections are dropped; required sections are put back.
 *
 * @returns { sections, dropped } — dropped is reported so the builder UI can
 *          say "no gallery because you have no photos yet" instead of silently
 *          producing a shorter page than the company expected.
 */
export function validateComposition(requested, available = {}) {
  const wanted = Array.isArray(requested) ? requested : [];
  const seen = new Set();
  const sections = [];
  const dropped = [];

  for (const raw of wanted) {
    const key = typeof raw === "string" ? raw.trim() : "";
    const def = SECTION_VOCABULARY[key];
    if (!def) {
      // An invented section name. Not an error worth failing over — the page is
      // still fine without it — but worth recording.
      if (key) dropped.push({ key, reason: "unknown" });
      continue;
    }
    if (def.once && seen.has(key)) continue;
    if (def.needs && !available[def.needs]) {
      dropped.push({ key, reason: `no ${def.needs}` });
      continue;
    }
    seen.add(key);
    sections.push(key);
  }

  // Hero first, contact last, always. A page with no headline is a bounce and a
  // page you can't act on is a brochure — neither is a choice worth offering.
  if (!seen.has("hero")) sections.unshift("hero");
  else if (sections[0] !== "hero") {
    sections.splice(sections.indexOf("hero"), 1);
    sections.unshift("hero");
  }

  if (!seen.has("contact")) sections.push("contact");
  else if (sections[sections.length - 1] !== "contact") {
    sections.splice(sections.indexOf("contact"), 1);
    sections.push("contact");
  }

  // Two CTA bands in a row is a rendering accident, not a design.
  let out = sections.filter(
    (key, i) => !(key === "cta" && sections[i - 1] === "cta"),
  );

  // ── The four that are always there ──
  //
  // Inserted before `contact`, which stays last. A model that forgot the booking
  // calendar doesn't get to ship a site without one.
  for (const key of ALWAYS_INCLUDE) {
    if (out.includes(key)) continue;
    const def = SECTION_VOCABULARY[key];
    if (def?.needs && !available[def.needs]) continue;
    const contactAt = out.indexOf("contact");
    if (contactAt === -1) out.push(key);
    else out.splice(contactAt, 0, key);
  }

  // ── Seven, maximum ──
  //
  // Trimmed by stated priority rather than by truncating the tail, because the
  // tail is where contact and the FAQ live. Anything cut is reported, so the
  // builder can say "left out your about section to keep the page to seven"
  // instead of it silently vanishing.
  if (out.length > MAX_SECTIONS) {
    // Never trim the LEAD — the first section after the hero. That section is the
    // page's whole argument, and it is what a preset is named for: cutting it
    // turned "lead with reputation" into a page with no testimonials on it, which
    // is not a shorter version of that page, it's a different one.
    const lead = out[1] || null;

    for (const key of trimOrderFor(out)) {
      if (out.length <= MAX_SECTIONS) break;
      if (ALWAYS_INCLUDE.includes(key)) continue;
      if (key === lead) continue;
      const at = out.lastIndexOf(key);
      if (at === -1) continue;
      out.splice(at, 1);
      dropped.push({ key, reason: `over the ${MAX_SECTIONS}-section limit` });
    }
    // Still long. Cut from the end, but never contact (last), never the lead
    // (index 1), and never one of the four required sections.
    while (out.length > MAX_SECTIONS) {
      let cut = -1;
      for (let i = out.length - 2; i >= 2; i--) {
        if (ALWAYS_INCLUDE.includes(out[i])) continue;
        cut = i;
        break;
      }
      if (cut === -1) break;
      dropped.push({ key: out[cut], reason: `over the ${MAX_SECTIONS}-section limit` });
      out.splice(cut, 1);
    }
  }

  return { sections: out, dropped };
}

/**
 * Pick a page shape from what the company has, for when there's no AI answer.
 *
 * Ordered most-specific first. The reasoning is written out because the next
 * person will want to know why a company got the page they got.
 */
export function compositionFromData(available = {}, { serviceCount = 0 } = {}) {
  // Real before/after imagery is the single most persuasive thing a trade can
  // put on a page. If they have it, lead with it.
  if (available.photoPairs) return "showcase";

  // Photos but no pairs — still a portfolio business.
  if (available.photos) return "showcase";

  // Reputation with nothing to show yet.
  if (available.testimonials) return "trust";

  // Hours set and few services reads as a scheduled-visit business (cleaning,
  // inspection, maintenance) rather than a project business.
  if (available.hours && serviceCount <= 3) return "booking";

  // A wide catalogue: the visitor's question is "do you do my thing".
  if (serviceCount >= 4) return "catalogue";

  // Almost no content. A short honest page beats a long empty one.
  if (serviceCount <= 1) return "onepager";

  return DEFAULT_COMPOSITION;
}

/** Sections for a named preset, already clamped to what's possible. */
export function sectionsForPreset(key, available = {}) {
  const preset = COMPOSITION_PRESETS[key] || COMPOSITION_PRESETS[DEFAULT_COMPOSITION];
  return validateComposition(preset.sections, available);
}
