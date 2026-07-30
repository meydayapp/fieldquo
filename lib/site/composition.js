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
// MAX_SECTIONS: a focused page beats a long one — a homeowner scans, they don't
// read. But seven was too tight once the four required sections are counted:
// hero + services + one visual + quote form + booking + FAQ + contact is already
// seven, which meant `about` and `testimonials` could never both appear, and a
// photo-led site never got an about section at all.
//
// Ten leaves genuine room: the eight below plus two of about / testimonials /
// process / areas / cta. Still a ceiling, never a target — a company with little
// content gets a short page, because five full sections beat ten thin ones.
export const MAX_SECTIONS = 10;

// Always on the page, whatever the model or a preset asks for. These four are why
// a contractor's site exists: a way to get a price, a way to get on the calendar,
// answers to the obvious questions, and a way to phone. None of them needs any
// data to render, so none of them can be refused.
export const ALWAYS_INCLUDE = ["quoteform", "booking", "faq", "contact"];

// The portfolio. Included whenever the photos exist and never trimmed once
// present — for a trade, pictures of finished work are the most persuasive thing
// on the page, and a site that has them and doesn't show them is failing at the
// one job it has.
//
// Separate from ALWAYS_INCLUDE because these DO need data: `beforeafter` needs
// confirmed pairs, `gallery` needs photos. A company with neither gets neither,
// which is correct — an empty gallery is the same failure as a dead button.
export const PREFER_INCLUDE = ["beforeafter", "gallery"];

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
    // Its own, tighter target. A preset named "short" that comes out the same
    // length as every other one is not a choice the company can make.
    //
    // A target, not a guarantee: hero + the four required sections + the
    // portfolio is seven unremovable sections, so a company with photos gets
    // eight here rather than six. That's the honest outcome — refusing to show
    // their work to hit a number would be optimising the wrong thing.
    max: 6,
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
export function validateComposition(requested, available = {}, { max = MAX_SECTIONS } = {}) {
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

  // A CTA band must never be the LEAD. It carries one line of copy and two
  // buttons — no information at all — so opening with it tells a visitor nothing
  // about the business. Reachable when a photo-led shape is asked for by a
  // company that has no photos: everything above it drops out and the band floats
  // to the top. Pushed down rather than removed, because it's still useful lower.
  while (out[1] === "cta") {
    out.splice(1, 1);
    const contactAt = out.indexOf("contact");
    out.splice(contactAt === -1 ? out.length : contactAt, 0, "cta");
    // Guard against a page that is nothing but hero + cta + contact, which would
    // otherwise loop forever moving the same band around.
    if (out.filter((k) => k !== "cta").length <= 2) break;
  }

  // ── The four that are always there, plus the portfolio when it can be ──
  //
  // Inserted before `contact`, which stays last. A model that forgot the booking
  // calendar doesn't get to ship a site without one, and a company with real
  // before/after photos doesn't get a site that hides them.
  //
  // The portfolio goes in HIGH, but never at index 1 — that slot belongs to
  // whatever the preset or the model chose to lead with.
  //
  // Splicing at 1 unconditionally is a bug I wrote and then caught in the test
  // output: it made every preset open with the before/after slider, so "lead with
  // reputation" opened with photos and "lead with booking" opened with photos too.
  // The lead is the page's whole argument; a section added for completeness must
  // not take it.
  const insertAt = out.length > 1 ? 2 : 1;
  for (const key of PREFER_INCLUDE) {
    if (out.includes(key)) continue;
    const def = SECTION_VOCABULARY[key];
    if (def?.needs && !available[def.needs]) continue;
    out.splice(Math.min(insertAt, out.length), 0, key);
  }

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
  if (out.length > max) {
    // Never trim the LEAD — the first section after the hero. That section is the
    // page's whole argument, and it is what a preset is named for: cutting it
    // turned "lead with reputation" into a page with no testimonials on it, which
    // is not a shorter version of that page, it's a different one.
    const lead = out[1] || null;

    for (const key of trimOrderFor(out)) {
      if (out.length <= max) break;
      if (ALWAYS_INCLUDE.includes(key)) continue;
      // The portfolio survives the trim. It is the whole reason the pairing flow
      // exists and the thing a homeowner actually scrolls for.
      if (PREFER_INCLUDE.includes(key)) continue;
      if (key === lead) continue;
      const at = out.lastIndexOf(key);
      if (at === -1) continue;
      out.splice(at, 1);
      dropped.push({ key, reason: `over the ${max}-section limit` });
    }
    // Still long. Cut from the end, but never contact (last), never the lead
    // (index 1), and never one of the four required sections.
    while (out.length > max) {
      let cut = -1;
      for (let i = out.length - 2; i >= 2; i--) {
        if (ALWAYS_INCLUDE.includes(out[i])) continue;
        if (PREFER_INCLUDE.includes(out[i])) continue;
        cut = i;
        break;
      }
      if (cut === -1) break;
      dropped.push({ key: out[cut], reason: `over the ${max}-section limit` });
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
  return validateComposition(preset.sections, available, {
    max: preset.max || MAX_SECTIONS,
  });
}
