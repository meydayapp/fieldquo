// lib/site/placeholderImages.js
//
// Trade-matched stock photography for the DECORATIVE slots of a new site, so a
// company with no photos of its own doesn't get a wall of text.
//
// ══ The one rule ═══════════════════════════════════════════════════════════
//
// NEVER in the gallery or the before/after slider.
//
// Those two sections say "this is a job we did". A stock photo there isn't
// filler, it is a false statement made to a homeowner on the company's own
// website — and it is the kind of false statement that ends in a complaint. The
// decorative slots (hero background, about photo, CTA band, feature rows) make no
// claim: nobody reads the photograph behind a headline as a portfolio entry.
//
// So the gallery and the slider stay EMPTY until real work is uploaded, and the
// builder asks for it as a gap (lib/site/gaps.js). That absence is also what
// makes the nag honest.
//
// ══ Every placeholder is recognisable ══════════════════════════════════════
//
// `isPlaceholder()` works by looking the URL up in this file rather than by
// storing a flag alongside it. That means a placeholder stays identifiable
// through a regeneration, a hand edit, a copy-paste between blocks, and any
// future code that moves images around — none of which a separate flag would
// survive. The editor badges them and publishing warns while any remain.
//
// ══ Licensing ══════════════════════════════════════════════════════════════
//
// Unsplash, whose licence permits commercial use and hotlinking without
// attribution. Pinned to specific photo ids rather than a random/source endpoint:
// a random image is a different photo on every render, which breaks the preview,
// the cache and any expectation that the site looks the same twice.

const U = (id, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

/**
 * Photo sets by trade family. Keys map to ServiceCategory.key prefixes, so
 * `roofing_service`, `siding` and `exterior_painting` can share an exterior set
 * without listing every category separately.
 */
// ── Every photo below has been opened and looked at ────────────────────────
//
// The first pass at this file was ids written from memory, and two of them were
// wrong in ways a 200 response cannot catch: a paving company would have got an
// ELECTRICIAN on its hero, and the trade-agnostic fallback was a SOFTWARE
// DEVELOPER at a monitor. A third 404'd.
//
// So the rule for this list is: nothing goes in it that hasn't been downloaded
// and viewed. That means fewer unique photos, reused across families, which is
// the right trade — eight correct images beat thirty where two are absurd. Adding
// one means checking it the same way.
const SETS = {
  // A roofer standing on a shingle roof beside a ladder.
  roofing: [U("1632759145351-1d592919f522"), U("1570129477492-45c003edd2be"), U("1558904541-efa843a96f01")],

  // Modern detached house at dusk. Suits siding, parging, pressure washing.
  exterior: [U("1570129477492-45c003edd2be"), U("1558904541-efa843a96f01"), U("1632759145351-1d592919f522")],

  // Paint roller laying blue on a white wall.
  painting: [U("1562259949-e8e7689d7828"), U("1615873968403-89e068629265"), U("1570129477492-45c003edd2be")],

  // White fitted kitchen with open shelving.
  kitchen: [U("1556909212-d5b604d0c90d"), U("1615873968403-89e068629265"), U("1562259949-e8e7689d7828")],

  // Furnished living room with a visible wood floor and rug.
  flooring: [U("1615873968403-89e068629265"), U("1556909212-d5b604d0c90d"), U("1562259949-e8e7689d7828")],

  // Close, low shot across a cut lawn.
  landscaping: [U("1558904541-efa843a96f01"), U("1570129477492-45c003edd2be"), U("1632759145351-1d592919f522")],

  // A gutted interior mid-renovation, props and bare masonry. Right for
  // demolition, excavation and renovation; the honest choice for concrete and
  // paving too, since a verified driveway photo isn't in this list yet.
  concrete: [U("1517581177682-a085bb7ffb15"), U("1570129477492-45c003edd2be"), U("1558904541-efa843a96f01")],

  // Industrial pipework and valves on brick.
  plumbing: [U("1607472586893-edb57bdc0e39"), U("1517581177682-a085bb7ffb15"), U("1570129477492-45c003edd2be")],

  // An electrician in a hard hat working at a wall panel.
  electrical: [U("1621905251918-48416bd8575a"), U("1517581177682-a085bb7ffb15"), U("1570129477492-45c003edd2be")],

  // Someone cleaning window shutters in a bright room.
  cleaning: [U("1581578731548-c64695cc6952"), U("1615873968403-89e068629265"), U("1556909212-d5b604d0c90d")],

  // The fallback. Homes and real work — deliberately not abstract stock, and
  // emphatically not the developer-at-a-monitor that was here before.
  general: [U("1570129477492-45c003edd2be"), U("1558904541-efa843a96f01"), U("1632759145351-1d592919f522")],
};

// Which set a category key belongs to. Matched by substring so new categories in
// the same family are covered without a code change.
const FAMILY = [
  [["roof"], "roofing"],
  [["siding", "exterior_painting", "parging", "masonry", "pressure_washing"], "exterior"],
  [["paint", "drywall"], "painting"],
  [["cabinet", "countertop", "remodel", "kitchen"], "kitchen"],
  [["floor", "tiling", "stairs", "carpet"], "flooring"],
  [["landscap", "lawn", "tree", "irrigation", "snow", "fence"], "landscaping"],
  [["concrete", "epoxy", "paving", "excavation", "demolition"], "concrete"],
  [["plumb", "well_water", "pool"], "plumbing"],
  [["electric", "hvac", "garage_door", "elevator"], "electrical"],
  [["clean", "janitorial", "junk", "pest", "window_clean"], "cleaning"],
];

function familyFor(keys = []) {
  for (const key of keys) {
    const k = String(key || "").toLowerCase();
    for (const [needles, family] of FAMILY) {
      if (needles.some((n) => k.includes(n))) return family;
    }
  }
  return "general";
}

/** Every placeholder URL, for recognising one later. */
const ALL = new Set(Object.values(SETS).flat());

/** Is this URL one of ours? */
export function isPlaceholder(url) {
  return typeof url === "string" && ALL.has(url);
}

/** How many placeholder images are still on a page. */
export function countPlaceholders(blocks = []) {
  let n = 0;
  for (const b of blocks) {
    const c = b?.content || {};
    if (isPlaceholder(c.backgroundImage)) n += 1;
    if (isPlaceholder(c.image)) n += 1;
    for (const url of Array.isArray(c.featureImages) ? c.featureImages : []) {
      if (isPlaceholder(url)) n += 1;
    }
  }
  return n;
}

/**
 * Photos suited to this company's trades.
 *
 * @param categoryKeys ServiceCategory keys the company has enabled
 * @returns string[] — stable order, so the same company gets the same page twice
 */
export function placeholdersFor(categoryKeys = []) {
  return SETS[familyFor(categoryKeys)] || SETS.general;
}

/**
 * Fill the DECORATIVE image slots of a page that has none.
 *
 * Only ever touches a slot that is empty, so a company's own photo is never
 * replaced. Only ever touches hero / about / cta / feature rows — see the rule at
 * the top of this file.
 *
 * @returns { blocks, added }
 */
export function applyPlaceholders(blocks = [], categoryKeys = []) {
  const pool = placeholdersFor(categoryKeys);
  if (!pool.length) return { blocks, added: 0 };

  let i = 0;
  let added = 0;
  const next = blocks.map((b) => {
    if (!b || b.visible === false) return b;
    const c = b.content || {};

    if (b.type === "hero" && !c.backgroundImage) {
      added += 1;
      return { ...b, content: { ...c, backgroundImage: pool[i++ % pool.length] } };
    }
    if (b.type === "about" && !c.image) {
      added += 1;
      return { ...b, content: { ...c, image: pool[i++ % pool.length] } };
    }
    if (b.type === "cta" && c.variant === "image" && !c.backgroundImage) {
      added += 1;
      return { ...b, content: { ...c, backgroundImage: pool[i++ % pool.length] } };
    }
    if (b.type === "services" && c.variant === "feature" && !(c.featureImages?.length)) {
      added += 1;
      return {
        ...b,
        content: {
          ...c,
          featureImages: (c.items || []).slice(0, 4).map(() => pool[i++ % pool.length]),
        },
      };
    }
    // gallery and beforeafter are deliberately absent. See the top of the file.
    return b;
  });

  return { blocks: next, added };
}
