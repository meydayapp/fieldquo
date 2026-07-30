// lib/site/promptIntent.js
//
// Read the company's own words and turn them into a design system and a page
// shape — WITHOUT a model.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The prompt box was only ever read by the AI. So when the model is
// unconfigured, over quota, rate-limited, or returning a retired-model error
// (all of which degrade silently by design in lib/ai/provider.js), the prompt
// did LITERALLY NOTHING and every company fell back to a page chosen from their
// data alone. And since most companies start with no photos, no testimonials and
// no opening hours, the data-driven choice was the same one for nearly all of
// them — `catalogue`, every time.
//
// That is the whole of "I type a description and always get the same template".
// The composition engine was working; the prompt just never reached it.
//
// So: keyword intent. It is not AI and it does not pretend to be. It is a lookup
// table over words contractors actually use, and it means the prompt visibly
// changes the page instantly, for free, whether or not a model answers. When the
// model DOES answer it wins — this becomes the prior, not the ceiling.
//
// ── Deliberately conservative ──────────────────────────────────────────────
//
// Every extractor returns null when it finds nothing. A prompt that says nothing
// about layout must not be forced into a guess — the data-driven default is a
// better answer than a coin flip, and inventing an intent the company didn't
// express is how "the AI ignored what I asked for" starts.

import { SITE_STYLE_KEYS } from "@/lib/site/siteStyles";
import { COMPOSITION_KEYS } from "@/lib/site/composition";

/** Words that point at a design system. First match by score wins. */
const STYLE_SIGNALS = {
  bold: [
    "bold", "loud", "big", "huge", "massive", "strong", "industrial", "rugged",
    "tough", "aggressive", "impact", "stand out", "biggest", "powerful",
    "construction", "demolition", "heavy",
  ],
  minimal: [
    "minimal", "minimalist", "simple", "clean", "quiet", "understated",
    "whitespace", "white space", "airy", "calm", "sparse", "uncluttered",
    "elegant", "refined", "subtle",
  ],
  classic: [
    "classic", "traditional", "established", "heritage", "family", "trusted",
    "old school", "old-school", "timeless", "serif", "since", "generations",
    "reputable", "conservative",
  ],
  warm: [
    "warm", "friendly", "welcoming", "approachable", "homely", "homey",
    "inviting", "personal", "caring", "local", "neighbourly", "neighborly",
    "rounded", "soft",
  ],
  editorial: [
    "editorial", "magazine", "photography", "photographic", "storytelling",
    "story", "lifestyle", "designer", "high-end", "luxury", "premium",
    "boutique", "architectural",
  ],
  technical: [
    "technical", "precise", "precision", "meticulous", "engineered",
    "engineering", "spec", "detailed", "methodical", "systematic", "exact",
    "measured", "professional grade",
  ],
  modern: [
    "modern", "contemporary", "sleek", "fresh", "current", "up to date",
    "up-to-date", "polished", "slick",
  ],
};

/** Words that point at a page SHAPE. */
const COMPOSITION_SIGNALS = {
  showcase: [
    "before and after", "before & after", "before/after", "beforeafter",
    "show off", "showcase", "our work", "portfolio", "photos", "pictures",
    "gallery", "transformations", "results", "see the work", "photo-led",
  ],
  trust: [
    // "review" not "reviews", so the singular matches too. Deliberately NOT the
    // bare word "quote": in this product a quote is a PRICE, and "start with a
    // quote form" would otherwise be read as "lead with testimonials". Only the
    // phrases that unambiguously mean a client saying something.
    "review", "testimonial", "what clients say", "what customers say",
    "client quote", "customer quote", "quote from a client",
    "quote from a customer", "reputation", "referral", "word of mouth",
    "word-of-mouth", "trusted", "rating", "recommendation", "reputable",
    "credibility", "happy clients", "happy customers",
  ],
  booking: [
    "book", "booking", "schedule", "calendar", "appointment", "appointments",
    "recurring", "weekly", "seasonal", "maintenance", "cleaning",
    "book online", "get on the calendar",
  ],
  catalogue: [
    "services", "what we do", "everything we do", "all our services",
    "list our services", "wide range", "range of services", "trades",
  ],
  onepager: [
    "one page", "one-page", "single page", "short", "simple page", "brief",
    "just the basics", "keep it short", "minimal page",
  ],
};

/** Hero treatments a company might ask for by name. */
const HERO_SIGNALS = {
  overlay: ["words on the photo", "text over the photo", "over the image", "full screen photo", "full-screen photo", "hero image", "big photo"],
  minimal: ["no photo", "text only", "type only", "just words", "headline only"],
  sidebyside: ["photo on the left", "image on the left", "picture left"],
  split: ["photo on the right", "image on the right", "photo beside", "side by side"],
  banner: ["banner", "wide photo", "photo with a card"],
};

const SERVICES_SIGNALS = {
  tiles: ["tiles", "coloured blocks", "colored blocks", "filled blocks"],
  alternating: ["alternating", "zigzag", "zig zag", "one at a time"],
  list: ["list", "simple list", "as a list"],
  numbered: ["numbered", "steps", "stages", "1 2 3", "step by step", "step-by-step"],
  cards: ["cards", "grid", "boxes"],
};

function norm(text) {
  return String(text || "")
    .toLowerCase()
    // Curly apostrophes and punctuation would otherwise break a phrase match.
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score each candidate by how many of its signals appear, and return the best —
 * or null if nothing matched at all.
 *
 * Longer phrases score higher than single words: "before and after" is a much
 * stronger statement of intent than the word "photos", and a prompt containing
 * both means the former.
 */
function bestMatch(text, table, allowed) {
  const scores = {};
  for (const [key, words] of Object.entries(table)) {
    if (allowed && !allowed.includes(key)) continue;
    let score = 0;
    for (const word of words) {
      if (!text.includes(word)) continue;
      // Weight by word count, so a three-word phrase beats a one-word hint.
      score += word.split(" ").length;
    }
    if (score > 0) scores[key] = score;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  // A tie is not a decision. Returning the first alphabetically would be
  // arbitrary and would make the same prompt behave differently as the table
  // grows, so a genuine tie yields null and the caller falls back to data.
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null;
  return ranked[0][0];
}

/**
 * Everything the prompt asks for, as far as we can tell from words alone.
 *
 * @returns {{ styleKey, composition, heroVariant, servicesVariant, matched }}
 *          Every field is null when the prompt didn't say. `matched` lists what
 *          was recognised, so the UI can show the company that their words were
 *          read rather than leaving them to guess.
 */
export function intentFromPrompt(prompt) {
  const text = norm(prompt);
  if (!text || text.length < 3) {
    return {
      styleKey: null,
      composition: null,
      heroVariant: null,
      servicesVariant: null,
      matched: [],
    };
  }

  const styleKey = bestMatch(text, STYLE_SIGNALS, SITE_STYLE_KEYS);
  const composition = bestMatch(text, COMPOSITION_SIGNALS, COMPOSITION_KEYS);
  const heroVariant = bestMatch(text, HERO_SIGNALS);
  const servicesVariant = bestMatch(text, SERVICES_SIGNALS);

  const matched = [];
  if (styleKey) matched.push(`style: ${styleKey}`);
  if (composition) matched.push(`layout: ${composition}`);
  if (heroVariant) matched.push(`header: ${heroVariant}`);
  if (servicesVariant) matched.push(`services: ${servicesVariant}`);

  return { styleKey, composition, heroVariant, servicesVariant, matched };
}
