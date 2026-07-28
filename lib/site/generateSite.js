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

/** The interview. Deliberately four questions — a fifth loses people. */
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
- Write as the company ("we"), never about them ("they").`;

function factsFor({ company, services, interview }) {
  return {
    companyName: company.name,
    location: [company.city, company.province].filter(Boolean).join(", ") || null,
    services: services.map((s) => s.label),
    interview: {
      yearsAndStory: interview?.yearsAndStory || "",
      difference: interview?.difference || "",
      idealJob: interview?.idealJob || "",
      serviceArea: interview?.serviceArea || "",
    },
  };
}

/**
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
  onUsage,
}) {
  const base = siteFromCompany({ company, services, testimonials });

  if (!isAiConfigured()) {
    return { blocks: base, seoTitle: null, seoDescription: null, generated: false };
  }

  const text = await complete({
    system: SYSTEM,
    prompt: JSON.stringify(factsFor({ company, services, interview })),
    maxTokens: 2000,
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
    blocks: sanitiseBlocks(merge(base, copy, services)),
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
function merge(blocks, copy, services) {
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
        });

      case "services":
        return withContent(block, {
          intro: str(copy.servicesIntro, 300),
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

      case "contact":
        return withContent(block, {
          intro: str(copy.contactIntro, 300) || block.content.intro,
        });

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
