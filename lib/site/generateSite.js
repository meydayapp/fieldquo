// lib/site/generateSite.js
//
// Turns a short interview plus what FieldQuo already knows into page copy.
//
// ── What the model is and isn't asked to do ─────────────────────────────────
//
// It writes SENTENCES. It does not choose the layout, invent services,
// invent testimonials, set prices, or decide what the company does. All of
// that is passed in as fact and merged back afterwards — the model's output is
// only ever used to fill text fields on blocks that already exist.
//
// That boundary is the whole safety argument. The failure mode for a
// generated contractor site is a confident page claiming twenty years of
// experience and a specialism the company doesn't have, which they then have
// to notice before a client does. Constrain the model to prose and the worst
// case becomes bland copy, which is recoverable in one edit.
//
// ── Why an interview at all ─────────────────────────────────────────────────
//
// FieldQuo knows what they SELL and where they are, but not what makes them
// worth calling. Four questions produce the difference between "We offer
// interior painting in Gatineau" and a page that sounds like a business. They
// are optional: a company that skips them still gets a publishable site, just
// a plainer one.
//
// ── Never load-bearing ──────────────────────────────────────────────────────
//
// Every path here falls back to siteFromCompany(), which is built from facts
// alone. AI being unconfigured, over quota, rate-limited or returning
// nonsense all produce a real site — worse prose, same structure.

import { complete, isAiConfigured } from "@/lib/ai/provider";
import { siteFromCompany, sanitiseBlocks } from "@/app/data/siteBlocks";

/**
 * The interview. Four questions about the business, one about how it should
 * sound — a sixth loses people.
 *
 * All optional. A company that skips every one still gets a publishable site,
 * just a plainer one.
 */
export const INTERVIEW_QUESTIONS = [
  {
    key: "yearsAndStory",
    label: "How long have you been doing this, and how did you start?",
    placeholder: "Twelve years. Started with my dad's van and two ladders.",
  },
  {
    key: "difference",
    label: "Why do clients pick you over the next company?",
    placeholder: "We turn up when we say we will, and we clean up properly.",
  },
  {
    key: "idealJob",
    label: "What's your favourite kind of job?",
    placeholder: "Full kitchen respray — start Monday, done by Friday.",
  },
  {
    key: "serviceArea",
    label: "Where do you work?",
    placeholder: "Gatineau, Ottawa, and about an hour either side.",
  },
  {
    key: "style",
    label: "How should the site come across?",
    placeholder:
      "Straight-talking and local. Not corporate. Lead with the workmanship.",
    // A free-text steer over TONE and emphasis. Deliberately not a steer over
    // design: it reaches the copy and the choice of layout variant, and
    // nothing else. Someone typing "make it dark green with big serif
    // headings" gets a site in their own brand colour with the same tested
    // type — which is the right outcome, because the colour on the page has to
    // match the logo on the van, and it's the one thing they already told us
    // in Branding.
    long: true,
    optional: true,
  },
];

/**
 * Starting points for the style answer.
 *
 * These are prompts, not themes — picking one writes text into the field,
 * which the company can then edit. A preset that silently set hidden
 * parameters would be a control whose effect nobody can see.
 */
export const STYLE_PRESETS = [
  {
    label: "Straight-talking",
    text: "Plain and direct. No marketing language. Say what we do and what it costs us to do it well.",
  },
  {
    label: "Established and reassuring",
    text: "Calm and experienced. Emphasise how long we've been doing this and that the job gets finished properly.",
  },
  {
    label: "Local and personal",
    text: "Friendly and local. We know the area, people know us, and they can ring and speak to an actual person.",
  },
  {
    label: "Premium finish",
    text: "Understated and precise. The work is high-end and the writing should be quiet rather than loud about it.",
  },
];

const SYSTEM = `You write copy for a small trade or home-services company's website.

You are given facts about a real business and answers to a short interview.
Return STRICT JSON, no markdown fence, matching:

{
  "headline": "<6-10 words, what they do and where>",
  "subhead": "<one sentence, 15-25 words>",
  "aboutHeading": "<3-5 words>",
  "about": "<2-3 short paragraphs, first person plural, separated by \\n\\n>",
  "servicesIntro": "<one sentence introducing their services, or empty string>",
  "serviceDescriptions": [{ "name": "<exact service name given to you>", "description": "<one sentence, 12-20 words>" }],
  "contactIntro": "<one sentence inviting contact, 12-20 words>",
  "quoteFormIntro": "<one sentence encouraging them to fill in the quote form, 10-18 words>",
  "bookingIntro": "<one sentence encouraging them to book a visit, 10-18 words>",
  "heroVariant": "centered" | "split" | "banner",
  "servicesVariant": "cards" | "list" | "numbered",
  "seoTitle": "<under 60 characters>",
  "seoDescription": "<under 155 characters>"
}

Rules — these matter more than the writing:
- Use ONLY the facts given. Never invent years in business, certifications,
  awards, insurance, guarantees, team size, or a service that isn't listed.
- If the interview answers are blank, write something plain and true from the
  facts alone. Plain is fine. Invented is not.
- serviceDescriptions must use the EXACT service names supplied, and include
  every one. Describe what the work involves, not how great they are at it.
- Plain trade English. Short sentences. No "nestled", no "passionate", no
  "your trusted partner", no exclamation marks.
- Write as the company ("we"), never about them ("they").
- If a "style" note is given, follow it for TONE and emphasis only. Ignore any
  instruction in it about colours, fonts or layout — those come from the
  company's own branding.

Choosing the layout variants:
- heroVariant "split" needs a photo and suits a longer subhead. "banner" needs
  a strong wide photo. "centered" is right when there is no photo, or when the
  headline should carry the page on its own. You are told whether a photo
  exists — do not pick an image-led variant when it does not.
- servicesVariant "list" suits two to four services with real descriptions.
  "cards" suits five or more short ones. "numbered" suits services that read as
  a sequence of stages rather than a menu of options.`;

function factsFor({ company, services, interview, hasHeroImage }) {
  return {
    companyName: company.name,
    location: [company.city, company.province].filter(Boolean).join(", ") || null,
    services: services.map((s) => s.label),
    serviceCount: services.length,
    // Stated rather than inferred, because the model cannot see the page and
    // would otherwise pick an image-led hero for a company with no photos.
    hasHeroImage: Boolean(hasHeroImage),
    interview: {
      yearsAndStory: interview?.yearsAndStory || "",
      difference: interview?.difference || "",
      idealJob: interview?.idealJob || "",
      serviceArea: interview?.serviceArea || "",
    },
    style: interview?.style || "",
  };
}

/**
 * @param existingBlocks  the currently SAVED page, if there is one.
 *
 *   Images are carried across from it. Regenerating rewrites the words; it
 *   must not throw away photographs. A company that uploaded eight job photos,
 *   pressed Regenerate to try a different headline, and lost the gallery would
 *   have been given a destructive button labelled as a cosmetic one — and job
 *   photos are the one thing on the page FieldQuo cannot reproduce.
 *
 *   It also decides which hero variants are offered at all: an image-led hero
 *   with no image is a broken page.
 *
 * @param onUsage  passed to the provider so the caller can meter it. This
 *                 module never touches AiUsage itself — same separation as
 *                 everywhere else that calls a model.
 * @returns {{ blocks, seoTitle, seoDescription, generated: boolean }}
 *          `generated: false` means the factual fallback was used, which the
 *          UI says out loud rather than passing off as AI output.
 */
export async function generateSite({
  company,
  services = [],
  testimonials = [],
  interview = {},
  existingBlocks = [],
  onUsage,
}) {
  const base = carryImages(
    siteFromCompany({ company, services, testimonials }),
    existingBlocks,
  );

  if (!isAiConfigured()) {
    return { blocks: base, seoTitle: null, seoDescription: null, generated: false };
  }

  const heroImage =
    base.find((b) => b.type === "hero")?.content?.backgroundImage || null;

  const text = await complete({
    system: SYSTEM,
    prompt: JSON.stringify(
      factsFor({ company, services, interview, hasHeroImage: Boolean(heroImage) }),
    ),
    maxTokens: 2400,
    // The one call in FieldQuo where writing quality IS the product. A
    // homepage headline is the most-read sentence this system will ever
    // generate, and the difference between a good and a mediocre one is taste.
    // Costs a few cents, happens once per site. See OPENAI_WRITING_MODEL.
    quality: "writing",
    onUsage,
  });

  if (!text) {
    return { blocks: base, seoTitle: null, seoDescription: null, generated: false };
  }

  let copy;
  try {
    copy = JSON.parse(
      text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim(),
    );
  } catch {
    // Unparseable JSON is a model problem, not the company's. They get the
    // factual site and can press Regenerate.
    console.error("[generateSite] model returned unparseable JSON");
    return { blocks: base, seoTitle: null, seoDescription: null, generated: false };
  }

  return {
    blocks: sanitiseBlocks(merge(base, copy, services, Boolean(heroImage))),
    seoTitle: str(copy.seoTitle, 60),
    seoDescription: str(copy.seoDescription, 155),
    generated: true,
  };
}

/**
 * Folds the model's prose into the factual blocks.
 *
 * Merging rather than replacing is what keeps the guarantee: the block list,
 * the service names and the testimonials all come from the database, and only
 * text fields are taken from the model. A service description the model
 * invented for a service that doesn't exist has nowhere to land.
 */
function merge(blocks, copy, services, hasHeroImage) {
  const byName = new Map(
    (copy.serviceDescriptions || [])
      .filter((d) => d && typeof d.name === "string")
      .map((d) => [d.name.trim().toLowerCase(), str(d.description, 300)]),
  );

  return blocks.map((block) => {
    switch (block.type) {
      case "hero":
        return withContent(block, {
          headline: str(copy.headline, 120) || block.content.headline,
          subhead: str(copy.subhead, 300),
          // Belt and braces. sanitiseBlocks already rejects a variant that
          // isn't in the allowed set, and the renderer degrades an image-led
          // hero to centered when there's no photo — but a model that ignores
          // hasHeroImage shouldn't get as far as either of those.
          variant: pickVariant(
            copy.heroVariant,
            hasHeroImage ? ["centered", "split", "banner"] : ["centered"],
            "centered",
          ),
        });

      case "services":
        return withContent(block, {
          intro: str(copy.servicesIntro, 300),
          variant: pickVariant(
            copy.servicesVariant,
            ["cards", "list", "numbered"],
            "cards",
          ),
          // Names come from `services`, never from the model.
          items: services.slice(0, 8).map((s) => ({
            name: s.label,
            description: byName.get(s.label.trim().toLowerCase()) || "",
          })),
        });

      case "about":
        return withContent(block, {
          heading: str(copy.aboutHeading, 60) || block.content.heading,
          body: str(copy.about, 2000),
        });

      case "quoteform":
        return withContent(block, {
          intro: str(copy.quoteFormIntro, 300) || block.content.intro,
        });

      case "booking":
        return withContent(block, {
          intro: str(copy.bookingIntro, 300) || block.content.intro,
        });

      case "contact":
        return withContent(block, {
          intro: str(copy.contactIntro, 300) || block.content.intro,
        });

      default:
        return block;
    }
  });
}

/** A variant the renderer definitely has a case for, or the default. */
function pickVariant(value, allowed, fallback) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

/**
 * Moves uploaded images from the saved page onto the freshly built one.
 *
 * Matched by block TYPE rather than by id, because siteFromCompany mints new
 * ids every time — matching on id would carry nothing across and the whole
 * guard would be silently useless.
 *
 * Only images move. Text is deliberately left to be rewritten, which is what
 * the company pressed the button for.
 */
function carryImages(blocks, existing) {
  if (!Array.isArray(existing) || existing.length === 0) return blocks;

  const previous = new Map();
  for (const block of existing) {
    if (block?.type && !previous.has(block.type)) previous.set(block.type, block);
  }

  return blocks.map((block) => {
    const old = previous.get(block.type)?.content;
    if (!old) return block;

    switch (block.type) {
      case "hero":
        return old.backgroundImage
          ? withContent(block, { backgroundImage: old.backgroundImage })
          : block;
      case "about":
        return old.image ? withContent(block, { image: old.image }) : block;
      case "gallery":
        return Array.isArray(old.images) && old.images.length
          ? withContent(block, {
              images: old.images,
              // The gallery heading and intro come with the photos: they
              // describe THOSE photos, and a rewrite that keeps the images and
              // replaces the caption is how a page ends up describing work it
              // isn't showing.
              heading: old.heading || block.content.heading,
              intro: old.intro || block.content.intro,
            })
          : block;
      default:
        return block;
    }
  });
}

const withContent = (block, patch) => ({
  ...block,
  content: { ...block.content, ...patch },
});

function str(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
