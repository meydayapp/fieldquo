// lib/site/generateSite.js
//
// Turns a short interview plus what FieldQuo already knows into page copy.
//
// ── What the model is and isn't asked to do ─────────────────────────────────
//
// It writes SENTENCES, and it CHOOSES THE PAGE from a closed vocabulary: which
// sections, in what order, in which of several hand-built layout variants, in
// which design system. It does not invent services, invent testimonials, set
// prices, decide what the company does, or emit a single style rule. All of
// that is passed in as fact and merged back afterwards.
//
// The composition half is new. It used to write copy into ONE fixed page — the
// same ten sections in the same order for every company on the platform — which
// is why every generated site looked identical no matter what anyone typed in
// the prompt. Section choice is a real design decision and a model is good at
// it; what a model is bad at is CSS it cannot see. So it picks from a menu, and
// lib/site/composition.js refuses anything the company has no data for.
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
import { siteFromCompany, sanitiseBlocks, BLOCK_TYPES } from "@/app/data/siteBlocks";
import { SITE_STYLE_KEYS, DEFAULT_SITE_STYLE } from "@/lib/site/siteStyles";
import {
  SECTION_KEYS,
  availabilityFor,
  validateComposition,
  compositionFromData,
  sectionsForPreset,
} from "@/lib/site/composition";
import { intentFromPrompt } from "@/lib/site/promptIntent";
import { applyPlaceholders } from "@/lib/site/placeholderImages";

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
    // A free-text steer over tone, emphasis AND the design style. Describe the
    // site you want ("loud and industrial", "calm and high-end") and the model
    // picks a styleKey from the closed set in lib/site/siteStyles.js, which
    // really does change the type scale, weight, rhythm and corners.
    //
    // What it still cannot do is set a colour or emit CSS: the palette comes
    // from Branding, because the colour on the page has to match the logo on
    // the van. Style changes the feel; the brand stays theirs.
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

const SYSTEM = `You are designing and writing a small trade or home-services
company's website. The brief, every time:

  Build a BEAUTIFUL, modern site to current web-design standards — generous
  whitespace, a real type hierarchy, one clear action per screen, and nothing
  decorative that doesn't earn its space. It must read well on a phone in a
  driveway and on a laptop, and it must not feel busy. Simple beats clever.

  AT MOST 10 sections, and fewer is better. A homeowner scans, they don't read —
  if you can say it in seven, use seven. Never pad to reach the limit.

  ALWAYS include the quote form, the booking calendar, the FAQ and contact.
  Those four are why the site exists — a price, a slot, the obvious answers, and
  a phone number. They are added for you if you leave them out.

  ALWAYS show the portfolio when there is one. If you're told before/after pairs
  or photos exist, the slider and the gallery both belong on the page: for a trade
  business, pictures of finished work are the most persuasive thing on it. These
  are also added for you.

Two things you do NOT need to worry about, because they are guaranteed
structurally rather than by you:

  RESPONSIVENESS. Every layout variant you can choose from was built and checked
  at 375px and at desktop width. You cannot produce a broken phone layout, and
  you should not try to compensate for one.

  CONTRAST AND COLOUR. Every colour derives from the company's own brand hex
  through a contrast-measuring theme. Never mention or request a colour.

So spend your judgement on the two things that are actually yours: WHICH sections
this business needs and in what order, and WORDS that sound like the people who
run it.

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
  "faq": [{ "question": "<a question a homeowner in this trade actually asks, 4-10 words>", "answer": "<plain answer, 15-35 words, using ONLY the facts>" }],
  "process": [{ "title": "<2-4 words>", "body": "<one sentence, 12-20 words>" }],
  "ctaHeading": "<4-8 words, a nudge to act>",
  "ctaSub": "<one sentence, 10-18 words>",
  "sections": ["<ordered section keys — see below>"],
  "styleKey": "modern" | "bold" | "minimal" | "classic" | "warm" | "editorial" | "technical",
  "heroVariant": "centered" | "split" | "banner" | "overlay" | "sidebyside" | "minimal",
  "servicesVariant": "cards" | "list" | "numbered" | "tiles" | "alternating",
  "aboutVariant": "simple" | "withphoto" | "quote",
  "galleryVariant": "grid" | "masonry" | "strip",
  "testimonialsVariant": "cards" | "single" | "strip",
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
- faq: 3-5 genuinely common questions for this trade. Answers must be true from
  the facts alone — how to get a quote, the area served, how to book, what the
  work involves. NEVER invent a warranty length, a price, financing, a
  guarantee, a timeline commitment or a certification. When unsure, keep it
  general ("we'll confirm the details on a free visit").
- Plain trade English. Short sentences. No "nestled", no "passionate", no
  "your trusted partner", no exclamation marks.
- Write as the company ("we"), never about them ("they").
- If a "style" note is given, follow it for TONE and emphasis only. Ignore any
  instruction in it about colours, fonts or layout — those come from the
  company's own branding.

Choosing the DESIGN STYLE (styleKey) — this changes how the page LOOKS:
- "modern": clean, spacious, confident. The default when nothing suggests otherwise.
- "bold": oversized headlines, hard edges, high impact. For companies who say
  loud, strong, industrial, "stand out", demolition/roofing/construction energy.
- "minimal": lots of whitespace, lighter weights, understated. For companies who
  say simple, clean, calm, elegant, high-end-quiet.
- "classic": serif headings, traditional, trustworthy. For long-established
  family firms, heritage/restoration work, "been here 30 years".
- "warm": rounded and friendly, approachable. For home-services aimed at
  families — cleaning, landscaping, handyman.
Read the company's own description and pick the style that matches how THEY
describe themselves. If it's ambiguous, choose "modern".

Choosing the SECTIONS and their ORDER — this is the biggest decision you make.

Return AT MOST 10. The keys marked (always) are added for you if you leave them
out, and so are the portfolio sections when the photos exist — all of them count
against your ten, so plan for them. Pick from exactly these keys and order them
the way this business should be read:

  hero          the headline. Always first.
  services      what they do.
  beforeafter   draggable before/after photos. (always, if pairs exist)
  gallery       photos of their work. (always, if photos exist)
  about         who they are.
  process       how a job goes, as 3-4 stages.
  testimonials  client quotes. Only if told testimonials exist.
  areas         towns they cover. Only if told areas exist.
  cta           a band with one line and a button. May appear twice on a long
                page, never twice in a row. Use it to break up a long page.
  quoteform     the instant quote form. (always)
  booking       the booking calendar. (always)
  hours         opening hours. Only if told hours exist.
  faq           the questions you wrote. (always)
  contact       phone, email, map. Always last. (always)

Lead with the business's actual strength:
- Real before/after photos? Open with "beforeafter" — nothing else a trade can
  put on a page is as persuasive.
- Photos but no pairs? Open with "gallery".
- Strong quotes and little else? Open with "testimonials".
- Many services and no imagery? Open with "services" — the visitor's question is
  "do you even do my thing".
- Business is about getting on a calendar (cleaning, inspections, maintenance)?
  Put "booking" high.
- Very little content at all? Return a SHORT page. Five sections that are full
  beat ten that are thin. Never pad to reach the limit.
The section straight after the hero is the page's whole argument — choose it
deliberately, it is the one thing a visitor is guaranteed to see.
Do NOT return the same order every time. Read the facts and decide.
Do NOT include a section you were told there is no data for; it will be dropped
and the page will be shorter than you intended.

Choosing the layout variants:
- heroVariant "split" needs a photo and suits a longer subhead. "banner" needs
  a strong wide photo. "centered" is right when there is no photo, or when the
  headline should carry the page on its own. You are told whether a photo
  exists — do not pick an image-led variant when it does not.
- heroVariant "overlay" puts the words straight on the photo — strongest with a
  wide action shot. "sidebyside" is "split" mirrored. "minimal" is type only and
  ignores the photo: use it when the headline is the whole pitch.
- servicesVariant "list" suits two to four services with real descriptions.
  "cards" suits five or more short ones. "numbered" suits services that read as
  a sequence of stages rather than a menu of options. "tiles" is loud and pairs
  with the bold style. "alternating" is slow and editorial — three or fewer only.
- aboutVariant "withphoto" needs a photo; "quote" pulls the first sentence out
  large and suits a short, confident paragraph.
- galleryVariant "masonry" needs four or more photos; "strip" is right with two
  or three, or when the photos are all portrait.
- testimonialsVariant "single" is right when there is only one good quote —
  which is common and is not a problem, so do not ask for "cards" with one item.

process: 3-4 stages of how a job actually goes for this trade — first contact,
what happens on the visit, how the work runs, how it finishes. Describe the
STAGES. Never attach a timeline, a price, a warranty or a guarantee to one:
those are commitments the company would have to honour.`;

function factsFor({ company, services, interview, hasHeroImage, available, counts }) {
  return {
    companyName: company.name,
    location: [company.city, company.province].filter(Boolean).join(", ") || null,
    services: services.map((s) => s.label),
    serviceCount: services.length,
    // Stated rather than inferred, because the model cannot see the page and
    // would otherwise pick an image-led hero for a company with no photos.
    hasHeroImage: Boolean(hasHeroImage),
    // What sections are POSSIBLE. The model is told rather than left to guess,
    // and the answer is enforced again server-side — being told means it can
    // compose a good short page instead of a long one full of holes it didn't
    // know about.
    youMayUse: {
      beforeafter: available.photoPairs,
      gallery: available.photos,
      testimonials: available.testimonials,
      areas: available.areas,
      hours: available.hours,
    },
    counts,
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
  // Which language to WRITE in. The site's furniture is a static table
  // (lib/site/siteCopy.js); this is the part that is actually authored per
  // company, so it has to be generated per language rather than translated
  // afterwards — a machine translation of a headline reads like a machine
  // translation of a headline, and this is the most-read sentence on the page.
  language = "en",
  services = [],
  testimonials = [],
  photos = [],
  photoPairs = [],
  areas = [],
  interview = {},
  existingBlocks = [],
  onUsage,
}) {
  const available = availabilityFor({
    services,
    testimonials,
    photos,
    photoPairs: photoPairs.length,
    areas,
    hasHours: Array.isArray(company?.businessHours)
      ? company.businessHours.some((d) => d && typeof d === "object" && !d.closed)
      : false,
  });

  const build = (sections) => {
    const base = carryImages(
      siteFromCompany({ company, services, testimonials, photos, photoPairs, areas, sections }),
      existingBlocks,
    );
    // Trade-matched stock in the DECORATIVE slots only, and only where the slot is
    // empty — a company's own photo is never replaced. The gallery and the
    // before/after slider are deliberately excluded: those two say "this is a job
    // we did", and a stock photo there is a false statement to a homeowner rather
    // than filler. See lib/site/placeholderImages.js.
    return applyPlaceholders(base, services.map((x) => x.key)).blocks;
  };

  // ── What the company ASKED for, read without a model ────────────────────
  //
  // This is the fix for "the prompt does nothing". The prompt used to be read
  // only by the AI, so with the model unreachable — unconfigured key, retired
  // model, quota, rate limit, all of which degrade silently on purpose — the
  // words were inert and every company fell through to a data-driven default.
  // Most companies start with no photos, no testimonials and no hours, so that
  // default was the SAME preset for nearly all of them.
  //
  // Keyword intent gives the prompt teeth immediately and for free. The model
  // still overrides it when it answers; this is the floor, not the ceiling.
  const intent = intentFromPrompt(interview?.style);

  // Shape: what they asked for, else what their data suggests.
  const fallbackPreset =
    intent.composition || compositionFromData(available, { serviceCount: services.length });
  const base = build(sectionsForPreset(fallbackPreset, available).sections);

  // Applied to the FALLBACK too, which is the case that was broken: without
  // this, styleKey stayed null, the caller kept whatever was already saved, and
  // a company typing "bold and industrial" with no AI saw no change at all.
  const applyIntentVariants = (blocks) =>
    blocks.map((b) => {
      if (b.type === "hero" && intent.heroVariant) {
        return withContent(b, {
          variant: pickVariant(
            intent.heroVariant,
            b.content.backgroundImage ? BLOCK_TYPES.hero.variants : ["centered", "minimal"],
            b.content.variant,
          ),
        });
      }
      if (b.type === "services" && intent.servicesVariant) {
        return withContent(b, {
          variant: pickVariant(intent.servicesVariant, BLOCK_TYPES.services.variants, b.content.variant),
        });
      }
      return b;
    });

  const nothing = {
    blocks: applyIntentVariants(base),
    seoTitle: null,
    seoDescription: null,
    styleKey: intent.styleKey,
    composition: fallbackPreset,
    droppedSections: [],
    // What the prompt was understood to mean, so the builder can show it. Naming
    // it out loud is how a company can tell the difference between "my words were
    // read" and "nothing happened".
    promptIntent: intent.matched,
    generated: false,
  };

  if (!isAiConfigured()) return nothing;

  const heroImage = base.find((b) => b.type === "hero")?.content?.backgroundImage || null;

  const languageName = {
    en: "English", fr: "French", es: "Spanish", uk: "Ukrainian",
    pa: "Punjabi", tl: "Tagalog",
  }[language] || "English";

  const text = await complete({
    system:
      language === "en"
        ? SYSTEM
        : `${SYSTEM}

WRITE EVERYTHING IN ${languageName.toUpperCase()}.

Every string you return — headline, subhead, about, service descriptions, FAQ
questions AND answers, process steps, the CTA lines, the SEO title and
description — must be in ${languageName}, written by someone who speaks it, not
translated word-for-word from English. Trade language especially: use the words a
${languageName}-speaking contractor and homeowner would actually use for these
services, not a dictionary rendering of the English term.

Two things stay as they are: the section KEYS and the variant names (those are
identifiers, not prose), and the SERVICE NAMES you are given, which come from the
company's own settings and must be reproduced exactly.`,
    prompt: JSON.stringify(
      factsFor({
        company,
        services,
        interview,
        hasHeroImage: Boolean(heroImage),
        available,
        counts: {
          photos: photos.length,
          photoPairs: photoPairs.length,
          testimonials: testimonials.length,
          areas: areas.length,
        },
      }),
    ),
    // Composition plus copy plus FAQ plus process is more output than the
    // copy-only version needed.
    maxTokens: 3200,
    // The one call in FieldQuo where writing quality IS the product. A
    // homepage headline is the most-read sentence this system will ever
    // generate, and the difference between a good and a mediocre one is taste.
    // Costs a few cents, happens once per site. See OPENAI_WRITING_MODEL.
    quality: "writing",
    onUsage,
  });

  if (!text) return nothing;

  let copy;
  try {
    copy = JSON.parse(
      text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim(),
    );
  } catch {
    // Unparseable JSON is a model problem, not the company's. They get the
    // factual site and can press Regenerate.
    console.error("[generateSite] model returned unparseable JSON");
    return nothing;
  }

  // ── The model's page shape, clamped ──────────────────────────────────────
  //
  // Validated here rather than trusted: an invented section name is dropped, and
  // a section the company has no data for is refused even though the model was
  // told not to ask for it. An empty section on a live page is the same failure
  // as a dead button.
  const { sections, dropped } = validateComposition(copy.sections, available);

  // A model that returns two sections has misunderstood, and a two-section page
  // is worse than the data-driven one. Fall back to the shape, keep the copy.
  const useModelShape = sections.length >= 4;
  const blocks = build(
    useModelShape ? sections : sectionsForPreset(fallbackPreset, available).sections,
  );

  return {
    blocks: sanitiseBlocks(merge(blocks, copy, services, Boolean(heroImage))),
    seoTitle: str(copy.seoTitle, 60),
    seoDescription: str(copy.seoDescription, 155),
    // The design style the model chose from the company's own description —
    // clamped to the closed set so an invented value can never become CSS.
    // Model first, then what the prompt plainly said, then the default. A model
    // that returns "modern" for a prompt that says "loud and industrial" should
    // not silently beat the company's own words when the company was explicit —
    // but a model answer for a prompt that said nothing about style should.
    styleKey:
      pickVariant(copy.styleKey, SITE_STYLE_KEYS, null) ||
      intent.styleKey ||
      DEFAULT_SITE_STYLE,
    composition: useModelShape ? "custom" : fallbackPreset,
    promptIntent: intent.matched,
    // Surfaced so the builder can say "no gallery yet — add photos" rather than
    // quietly producing a shorter page than the company was expecting.
    droppedSections: dropped,
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
          // Image-led variants are only offered when there IS an image; a
          // model that ignores hasHeroImage shouldn't get as far as the
          // renderer's own degrade path.
          variant: pickVariant(
            copy.heroVariant,
            hasHeroImage
              ? BLOCK_TYPES.hero.variants
              : ["centered", "minimal"],
            "centered",
          ),
        });

      case "services":
        return withContent(block, {
          intro: str(copy.servicesIntro, 300),
          variant: pickVariant(
            copy.servicesVariant,
            BLOCK_TYPES.services.variants,
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
          variant: pickVariant(
            copy.aboutVariant,
            block.content.image ? BLOCK_TYPES.about.variants : ["simple", "quote"],
            "simple",
          ),
        });

      case "gallery":
        return withContent(block, {
          variant: pickVariant(copy.galleryVariant, BLOCK_TYPES.gallery.variants, "grid"),
        });

      case "testimonials":
        return withContent(block, {
          variant: pickVariant(
            copy.testimonialsVariant,
            BLOCK_TYPES.testimonials.variants,
            // One quote in a grid of one looks like a mistake. Default to the
            // large single treatment when that's all they have.
            (block.content.items || []).length <= 1 ? "single" : "cards",
          ),
        });

      case "process":
        // Stages of the work as prose. Empty in the factual fallback because
        // there is no basis for inventing four generic steps — the renderer
        // drops the section rather than shipping empty cards.
        return withContent(block, {
          steps: Array.isArray(copy.process)
            ? copy.process
                .filter((x) => x && typeof x.title === "string" && x.title.trim())
                .slice(0, 5)
                .map((x) => ({ title: str(x.title, 80), body: str(x.body, 400) }))
            : [],
        });

      case "cta":
        return withContent(block, {
          heading: str(copy.ctaHeading, 120) || block.content.heading,
          sub: str(copy.ctaSub, 300) || block.content.sub,
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

      case "faq":
        // Model-written Q&A, text only — same trust boundary as everything
        // else: it's sentences merged into a sanitised block, never layout or
        // fact. Falls back to whatever the company already has if the model
        // returned nothing usable.
        return withContent(block, {
          items: Array.isArray(copy.faq) && copy.faq.length
            ? copy.faq
                .filter((q) => q && typeof q.question === "string" && q.question.trim())
                .slice(0, 6)
                .map((q) => ({ question: str(q.question, 200), answer: str(q.answer, 600) }))
            : block.content.items || [],
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
      case "beforeafter":
        // Pairs are uploaded photographs of real jobs — the one thing on the
        // page FieldQuo cannot reproduce. Same reason the gallery is carried.
        return Array.isArray(old.pairs) && old.pairs.length
          ? withContent(block, { pairs: old.pairs, heading: old.heading || block.content.heading })
          : block;

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
