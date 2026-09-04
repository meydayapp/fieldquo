// lib/ai/marketingCopy.js
//
// Captions and hashtags for a Marketing Designer post, grounded in the real
// job behind the photos on the canvas — the bridge the coordinator asked
// for: "so that if the person asks for an asset to be generated using two
// pictures, one before and one with an after tag, it could... create
// captions, hashtags and image ad based on the scope of work from that job."
//
// ── The one rule this file exists to enforce ────────────────────────────
//
// A caption claiming "we replaced the countertops" on a job whose scope says
// otherwise is a false statement published under the contractor's own
// brand — the coordinator's own words, and the thing that matters more than
// the feature working at all. Three things do the enforcing, none of them
// the model's good behaviour alone:
//
//   1. lib/marketing/jobPhotoContext.js decides what facts even REACH this
//      file — an issue-tagged photo, or a photo from a job that lost the
//      "which job wins" tie-break, never arrives here to be described.
//   2. The system prompt below is explicit and repeated: describe ONLY the
//      scope.groups items, and when scope.hasScope is false, don't describe
//      specific work AT ALL — write generic, work-agnostic copy instead of
//      guessing from the photos. Two photos both tagged "finish" and none
//      tagged "start" must not be written up as a before/after — the
//      pre-computed `beforeAfterAvailable` fact answers that question
//      instead of leaving the model to infer it from tag strings.
//   3. Nothing downstream trusts the output as fact. parseModelJson() below
//      extracts exactly three fields — headline, caption, hashtags — all free
//      text.
//      There is no field this module lets the model fill in that a UI
//      would later render as a database-backed claim (a price, a service
//      name, a date). If it invents a claim, it invents PROSE, the same
//      failure class lib/site/generateSite.js is built to make recoverable
//      in one edit rather than published as fact.
//
// ── lib/ai/provider.js is the ONLY file that talks to a model vendor ─────
//
// Every call here goes through complete(). No OpenAI client, no fetch to a
// vendor endpoint, anywhere in this file.
//
// ── What never reaches the vendor ─────────────────────────────────────────
//
// No client name, address or phone number — see jobPhotoContext.js's own
// comment on why Job.title is excluded (it embeds the client's name) while
// scope group labels are sent (the same free text lib/ai/quoteReview.js
// already sends today). No dollar amount, ever — scopeOfWorkFacts() strips
// them at the source. An "issue" photo is filtered out before its URL is
// ever placed in the `images` array handed to complete().
import { complete } from "./provider";
import { loadJobPhotoContext } from "@/lib/marketing/jobPhotoContext";
import { INSTAGRAM_CAPTION_SPEC } from "@/lib/social/metaSpecs";
// The headline's character cap belongs to the LAYOUT that has to fit it, not
// to this file — "at most six words" is what the model is asked for and
// bounds nothing when one of them is "weatherproofing". Imported rather than
// redeclared so the sanitiser here and composeJobPost()'s own trim cannot
// drift to two different numbers. jobPost.js is pure (no vendor, no db), so
// the dependency runs one way only.
import { MAX_HEADLINE_CHARS } from "@/lib/marketing/jobPost";

const SYSTEM_PROMPT = `You write short social captions for a home-service contractor's own Facebook/Instagram post — painters, cabinet refinishers, flooring installers and similar trades.

You are given a JSON object with:
- "scope": the REAL scope of work on this job. "hasScope" is false when there is nothing on file. "groups" (when present) is a list of { category, items: [{ description, detail? }] } — this is the ONLY source of truth for what work was done.
- "photos": each photo's tag (e.g. "start", "finish", "progress", or a company's own custom tag, or null for an untagged photo) and any caption a crew member wrote.
- "beforeAfterAvailable": true only when the set genuinely contains both a "start"-tagged and a "finish"-tagged photo.

Hard rules:
1. Describe ONLY work listed in scope.groups. Never state, imply or hint at any task, material or result that isn't there — including anything a competent tradesperson would ASSUME goes with the visible work (e.g. do not add "and resealed the counters" just because the photos show a kitchen).
2. If scope.hasScope is false, do not describe any specific work at all. Write a plain, work-agnostic caption about the photos ("Another job in the books" — that tone), never a guess at what happened based on the pictures.
3. Only describe a before/after transformation when beforeAfterAvailable is true. If it's false — including when there are multiple "finish" photos and no "start" photo — describe the photos as showing the completed work, never as a before/after story.
4. Never include a client's name, house number, street name, phone number or any other detail that could identify a specific homeowner or address, even if such text appears in a caption or comment you were given — omit it rather than repeating it.
5. Do not invent a price, discount, timeframe ("done in just 2 days") or guarantee that isn't explicitly in scope.
6. Plain, honest, small-business voice. No corporate marketing language, no more than one exclamation mark, no emoji unless they clarify rather than decorate.

You reply with a JSON object: "headline", "caption" (1-3 short sentences) and "hashtags".

Headline: the words printed ON the image itself, above the photos. At most six words. It must obey every rule above — especially rule 1: name only work that is in scope.groups, and when scope.hasScope is false write something true of any finished job rather than guessing at this one. Never write the words "before" or "after" as the headline: the photos are labelled already. No punctuation at the end.

Hashtags: lowercase, no spaces, relevant to the actual work (or generic small-business/local-trade tags when scope.hasScope is false), at most 12.`;

/**
 * The caption's shape, enforced at the vendor with `strict: true`.
 *
 * No numbers, and that is not an oversight — rule 5 of the prompt above bans
 * the model from inventing a price, a discount, a timeframe or a guarantee,
 * and a schema is the easiest place in this codebase to hand one back. A
 * `"daysTaken": {"type": "integer"}` here would produce a well-formed integer
 * on every call, looking exactly as trustworthy as a measured one, printed
 * under a contractor's own name on a public post. Every count this function
 * returns (photosUsed, photosExcludedIssue) is an array length computed below.
 */
const CAPTION_SCHEMA = {
  type: "object",
  properties: {
    // Printed ON the composed post (lib/marketing/jobPost.js), not just read
    // in a caption box — which is why the hard length cap is enforced by
    // parseModelJson() below and again by composeJobPost()'s own trim, rather
    // than trusted from the prompt's "at most six words". The schema cannot
    // express maxLength in the strict subset (see parseModelJson's header), so
    // a model that writes a paragraph here must be cut somewhere that isn't
    // the vendor.
    headline: { type: "string", description: "At most six words. Printed on the image." },
    caption: { type: "string", description: "1-3 short sentences." },
    hashtags: {
      type: "array",
      description: "Lowercase, no spaces, relevant to the actual work.",
      items: { type: "string" },
    },
  },
  required: ["headline", "caption", "hashtags"],
  additionalProperties: false,
};

/**
 * Parses and sanitises the model's reply. Never throws — a malformed or
 * missing response degrades to "nothing generated", the same "AI being down
 * produces plainer copy, never a broken page" contract
 * lib/site/generateSite.js documents for itself.
 *
 * Takes the OBJECT complete() validated against CAPTION_SCHEMA — or anything
 * at all. Exported and pure so it can be executed against hostile model output
 * directly (scripts/check-designer.mjs), and every "is it a string" guard is
 * KEPT rather than deleted on the strength of the vendor's promise: none of
 * the normalisation below (the length cap, the punctuation strip, the dedupe,
 * the hashtag cap) is expressible in the strict subset, which supports neither
 * maxLength nor pattern nor maxItems. What the schema removed is the fence,
 * the JSON.parse and the "did four keys arrive" question. What it did not
 * remove is anything that decides what a contractor's public post says.
 *
 * @returns {{ caption: string, hashtags: string[] }}
 */
export function parseModelJson(parsed) {
  const empty = { headline: "", caption: "", hashtags: [] };
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return empty;

  // Whitespace-collapsed as well as capped: this string is set as a single
  // fabric textbox, and an embedded newline the model chose would break the
  // line somewhere the fitting maths never accounted for.
  const headline =
    typeof parsed.headline === "string"
      ? parsed.headline.replace(/\s+/g, " ").trim().slice(0, MAX_HEADLINE_CHARS)
      : "";

  const caption =
    typeof parsed.caption === "string"
      ? parsed.caption.trim().slice(0, INSTAGRAM_CAPTION_SPEC.maxLength)
      : "";

  const rawTags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
  const seen = new Set();
  const hashtags = [];
  for (const raw of rawTags) {
    if (typeof raw !== "string") continue;
    // Strip anything that isn't a word character, then re-prefix — a model
    // that writes "kitchen remodel" (a space, no #) or "#Kitchen-Remodel!"
    // (punctuation Meta doesn't treat as part of the tag) is normalised into
    // one clean token rather than either rejected outright or passed through
    // broken. Empty after stripping (a bare "#" or "!!!") is dropped.
    const word = raw.replace(/^#+/, "").replace(/[^\w]/g, "");
    if (!word) continue;
    const tag = `#${word}`;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hashtags.push(tag);
    if (hashtags.length >= INSTAGRAM_CAPTION_SPEC.maxHashtags) break;
  }

  return { headline, caption, hashtags };
}

/**
 * Generate a caption + hashtags for whatever photos are currently on the
 * canvas.
 *
 * @param {Object} args
 * @param {string} args.companyId
 * @param {string[]} args.photoUrls  every image URL currently placed on the
 *                    canvas (or otherwise selected) — stock photos and fresh
 *                    uploads included. Filtering/matching against this
 *                    company's own JobPhoto rows happens inside
 *                    loadJobPhotoContext(); nothing here trusts a caller's
 *                    claim about which photo is which.
 * @param onUsage      passed straight through to complete() so the caller
 *                    can meter it via lib/ai/usage.js's recordAiUsage — this
 *                    module never touches the database itself, matching
 *                    lib/ai/quoteReview.js's own separation.
 * @returns {Promise<{
 *   headline: string,
 *   caption: string,
 *   hashtags: string[],
 *   grounded: boolean,
 *   photosUsed: number,
 *   photosExcludedIssue: number,
 *   photosExcludedOtherJob: number,
 * }>}
 */
export async function generateMarketingCopy({ companyId, photoUrls, onUsage }) {
  const context = await loadJobPhotoContext({ companyId, photoUrls });

  const result = {
    headline: "",
    caption: "",
    hashtags: [],
    grounded: context.scope.hasScope,
    photosUsed: context.images.length,
    photosExcludedIssue: context.excludedIssue.length,
    photosExcludedOtherJob: context.excludedOtherJob.length,
  };

  // Nothing usable to caption — every URL was either unresolvable or an
  // issue photo. Same "degrade, don't 500" contract as everywhere else AI
  // is optional: the caller sees photosUsed: 0 and can say so, rather than
  // this throwing on an empty images array.
  if (!context.images.length) return result;

  const payload = {
    scope: context.scope,
    beforeAfterAvailable: context.beforeAfterAvailable,
    photos: context.photos.map((p) => ({
      tag: p.tagLabel,
      caption: p.caption,
      relatedTask: p.relatedTask,
    })),
  };

  const generated = await complete({
    system: SYSTEM_PROMPT,
    prompt: JSON.stringify(payload),
    images: context.images,
    maxImages: 4,
    // A caption is client-facing marketing text a contractor posts under
    // their own name — the same "taste matters" case provider.js's own
    // WRITING_MODEL doc makes for site copy, not the "pick a tool, summarise
    // numbers" case the mini model is sized for.
    quality: "writing",
    onUsage,
    schema: CAPTION_SCHEMA,
    schemaName: "marketing_caption",
  });

  // NOTE the model here is WRITING_MODEL, not MODEL. Structured outputs are
  // supported across the current gpt-5 and gpt-4.1/4o families, but
  // OPENAI_WRITING_MODEL is a deploy-time environment variable and can be
  // pointed at anything — including a model that rejects response_format.
  // That now surfaces as a logged `vendor_error` and an empty caption box the
  // user can type into, rather than as a 500. It is the one failure mode this
  // migration ADDED, and it is the reason it is written down here.
  if (!generated.ok) return result;

  const parsed = parseModelJson(generated.data);
  result.headline = parsed.headline;
  result.caption = parsed.caption;
  result.hashtags = parsed.hashtags;
  return result;
}
