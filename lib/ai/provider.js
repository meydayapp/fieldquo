// lib/ai/provider.js
//
// The one place FieldQuo talks to a model vendor.
//
// Previously five files each constructed their own Anthropic client and
// hardcoded a model name, so switching vendors meant editing five files and
// hoping none were missed. Everything now goes through here: swapping OpenAI
// for xAI, Google or back to Anthropic is one file and one dependency.
//
// Two entry points, because the app only ever does two things with a model:
//
//   complete()      — text in, text out. Summaries, digests, translations.
//   runToolLoop()   — the copilot. The model picks which lookup to run; the
//                     lookups themselves are ordinary Prisma queries in
//                     copilotTools.js.
//
// Worth being clear about what the model does and doesn't see, because it's
// what makes a cheap model the right call: it NEVER receives the database. It
// receives a list of tool names, decides which to call, and gets back a small
// JSON object of already-computed numbers. The arithmetic is done in code.
// The model's job is choosing a tool and writing a sentence — neither of which
// needs a frontier model.

import OpenAI, { toFile } from "openai";
import { lazyClient } from "@/lib/lazyClient";

// Lazy — see lib/lazyClient.js. Constructing at module scope breaks
// `next build` when the key isn't present at build time.
const client = lazyClient(
  () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
);

// Overridable without a deploy, so a pricing change or a better small model
// doesn't need a code edit.
//
// Run `node scripts/check-ai-model.mjs` after changing this. OpenAI retires
// model IDs, complete() swallows the resulting error, and a retired model
// therefore looks exactly like a model with nothing to say.
const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

/**
 * A second, better model for the few calls where writing QUALITY is the
 * product rather than a nicety.
 *
 * Almost everything here is a mini-model job: pick a tool from six, summarise
 * numbers that were already computed in code. Website copy is the exception —
 * the headline on a contractor's homepage is the most-read sentence FieldQuo
 * will ever generate, and the difference between a good and a mediocre one is
 * taste, which is exactly what the bigger models have more of.
 *
 * Affordable because it is rare: one call per site, a few cents each, against
 * a mini model doing thousands of copilot turns. Falls back to MODEL when
 * unset, so this is opt-in and nothing breaks without it.
 */
const WRITING_MODEL = process.env.OPENAI_WRITING_MODEL || MODEL;

export const AI_MODEL = MODEL;
export const AI_WRITING_MODEL = WRITING_MODEL;

// GPT-5 and o-series are REASONING models: the tokens they spend thinking come
// out of the same max_completion_tokens budget as the visible answer. A limit
// sized for the answer alone gets consumed by reasoning, and the API returns
//
//   400 Could not finish the message because max_tokens or model output limit
//       was reached
//
// which reads like the answer was too long when in fact it never started. The
// budgets below are sized for thinking PLUS output.
//
// Computed per model rather than once at module scope, because the writing
// model and the default model can be different families — sending
// reasoning_effort to one that doesn't understand it is itself a 400.
const isReasoningModel = (model) => /^(gpt-5|o[1-9])/.test(model);

// Minimal reasoning is right for this workload — picking a tool from six and
// writing two sentences about numbers it was handed. Higher effort spends more
// tokens to no benefit.
function reasoningParams(model, effort = "low") {
  return isReasoningModel(model) ? { reasoning_effort: effort } : {};
}

// Headroom for reasoning. A reasoning model routinely spends more on thinking
// than on the reply, so these are deliberately generous — an unused budget
// costs nothing, an exhausted one costs the whole request.
const completionBudget = (model) => (isReasoningModel(model) ? 3000 : 800);
const toolLoopBudget = (model) => (isReasoningModel(model) ? 6000 : 1500);

/** True when the deployment can actually call a model. */
export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Strips a markdown code fence off a model's response, if it added one.
 *
 * Every caller here asks for STRICT JSON and no fence, and models occasionally
 * do it anyway. Was three duplicated lines in quoteReview.js's writingPass and
 * about to become a fourth copy in visionPass.js — pulled out once, here,
 * because model-output cleanup belongs next to the thing that talks to the
 * model, not inside each feature that happens to ask for JSON.
 */
export function stripJsonFence(text) {
  return String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/**
 * Plain text completion.
 *
 * Returns "" rather than throwing when unconfigured — every caller is a
 * nice-to-have summary, and a missing key should degrade to "no summary",
 * never to a 500 on a page that also shows real data.
 */

/**
 * The user turn: a plain string, or text-plus-images when there are images.
 *
 * Deliberately still a STRING when there are none. The multimodal array form is
 * accepted everywhere, but sending it unconditionally would change the shape of
 * every existing call on the product for no reason, and "nothing changed except
 * the payload" is how a working integration quietly stops working.
 *
 * `detail` is a COST CEILING, not a quality setting — see
 * lib/ai/imageEconomics.js for the numbers. It defaults to "low" here because
 * every caller of complete() until now has been a free, always-on pass: a site
 * photo read for what is IN it — water damage, a peeling door, an occupied
 * kitchen — not for fine text, at a flat, predictable cost per image instead of
 * one that scales with resolution. An estimator's phone camera would otherwise
 * make the price of a review depend on which phone they own.
 *
 * A caller may opt a specific call into "high" (lib/ai/visionPass.js's PAID
 * deep read does) by passing `detail` through to complete()'s own `imageDetail`
 * parameter. Never "original" — that tier carries no patch budget at all on
 * this model family, so its price would depend on the same phone-camera
 * lottery this default exists to avoid, only worse.
 */
function userContent(prompt, images, maxImages, detail = "low") {
  const urls = (Array.isArray(images) ? images : [])
    .map((i) => (typeof i === "string" ? i : i?.url))
    // http(s) only. A data: URI would be inlined into the request body, and a
    // blob: or file: URL is meaningless to a server on the other side of the
    // internet — it would fail at the vendor with an error about our prompt
    // rather than about the URL.
    .filter((u) => typeof u === "string" && /^https?:\/\//.test(u))
    .slice(0, Math.max(0, Number(maxImages) || 0));

  if (!urls.length) return prompt;

  return [
    { type: "text", text: prompt },
    ...urls.map((url) => ({ type: "image_url", image_url: { url, detail } })),
  ];
}

export async function complete({
  system,
  prompt,
  maxTokens,
  onUsage,
  // "writing" opts into WRITING_MODEL. A string is taken as a literal model
  // ID. Anything else uses the default. Callers name the JOB, not the vendor's
  // model name, so swapping vendors stays a one-file change.
  quality,
  reasoningEffort = "low",
  // ── Photographs, for the calls that have them ─────────────────────────────
  //
  // A quote carries the pictures the estimator took on site. Until this
  // existed, every model call on this product was text-only, so the assistant
  // reviewing a kitchen refinishing quote could not see the kitchen.
  //
  // Public URLs only — the vendor fetches them itself, which is why Cloudinary
  // is the right place for them and a data URI is not. Capped, because images
  // are the most expensive thing that can go into a prompt and an estimator who
  // uploads forty site photos should not silently spend forty images' worth of
  // a company's AI quota on one review.
  images = [],
  maxImages = 4,
  // See userContent's header — a cost ceiling, not a quality dial. Left at the
  // free-pass default for every caller that doesn't say otherwise.
  imageDetail = "low",
}) {
  if (!isAiConfigured()) return "";

  const model =
    quality === "writing"
      ? WRITING_MODEL
      : typeof quality === "string" && quality
        ? quality
        : MODEL;

  const content = userContent(prompt, images, maxImages, imageDetail);
  const imagesSent = Array.isArray(content)
    ? content.filter((c) => c.type === "image_url").length
    : 0;

  try {
    const res = await client.chat.completions.create({
      model,
      ...reasoningParams(model, reasoningEffort),
      max_completion_tokens: Math.max(maxTokens || 0, completionBudget(model)),
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content },
      ],
    });

    // Report what it actually cost. The caller decides whether to record it —
    // this module deliberately doesn't touch the database.
    //
    // Reports the model ACTUALLY used, not the default: metering the website
    // generation as if it ran on the mini model would understate it by an
    // order of magnitude, which is the one number this whole system exists to
    // get right.
    if (onUsage && res.usage) {
      await onUsage({
        model,
        promptTokens: res.usage.prompt_tokens || 0,
        completionTokens: res.usage.completion_tokens || 0,
        // How many pictures were actually in this prompt — after the cap and
        // the URL filter, not how many the caller offered. Images are the one
        // input whose token cost cannot be read off the text, so the only
        // honest way to know what vision costs on this account is to record
        // which calls carried them and compare. FieldQuo charges a flat
        // CAD$45/month and does not bill AI through, so that difference comes
        // out of the margin and is worth being able to look up rather than
        // estimate.
        imageCount: imagesSent,
      });
    }

    return res.choices?.[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error("[ai] completion failed:", err?.message);
    return "";
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Images — a different vendor family, a different shape
// ═══════════════════════════════════════════════════════════════════════════
//
// gpt-image-1 is not a chat model. It has its own two endpoints — generate()
// for a fresh picture, edit() for one built FROM a reference — and it hands
// back base64 image bytes, not a message. That is a different enough contract
// that folding it into complete()'s "text in, text out" signature would mean
// bending one of the two to fit the other. A second entry point, same file:
// this is still the ONLY place that constructs an OpenAI client.
//
// Overridable the same way MODEL is, for the same reason: a pricing change or
// a better image model shouldn't need a code edit.
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
export const AI_IMAGE_MODEL = IMAGE_MODEL;

/**
 * One generated image — prompt-only, or prompt-plus-reference.
 *
 * ── Bytes in, never a URL ───────────────────────────────────────────────
 *
 * complete()'s vision calls hand the vendor a URL and let IT fetch the photo —
 * that is how chat completions' `image_url` works. images.edit is a multipart
 * UPLOAD instead: OpenAI does not fetch a reference on our behalf, so the
 * CALLER (lib/ai/images.js) downloads the reference photo — already resized,
 * see lib/cloudinary.js's resizedUrl — and hands this function the raw bytes.
 * Keeping the fetch in the caller rather than here keeps this function's job
 * identical to complete()'s: talk to the vendor, touch nothing else.
 *
 * @param referenceImageBuffer  raw bytes of a photo to edit FROM, or null for
 *                              an unconditioned generation.
 * @param referenceImageType    the reference's MIME type. A URL-based call
 *                              carries this in the URL; a multipart upload has
 *                              to be told.
 * @returns { b64Json, model }, or null when AI is unconfigured or the vendor
 *          refused. Never throws — every caller of this function has already
 *          RESERVED a company's credit before it runs (see
 *          lib/voice/spendGate.js), and a thrown error here would turn into an
 *          unhandled 500 instead of the refund that reservation demands.
 */
export async function generateImage({
  prompt,
  referenceImageBuffer = null,
  referenceImageType = "image/jpeg",
  size = "1024x1024",
  quality = "medium",
  onUsage,
}) {
  if (!isAiConfigured()) return null;
  if (typeof prompt !== "string" || !prompt.trim()) return null;

  try {
    const res = referenceImageBuffer
      ? await client.images.edit({
          model: IMAGE_MODEL,
          image: await toFile(referenceImageBuffer, "reference.jpg", {
            type: referenceImageType || "image/jpeg",
          }),
          prompt: prompt.trim(),
          size,
          quality,
        })
      : await client.images.generate({
          model: IMAGE_MODEL,
          prompt: prompt.trim(),
          size,
          quality,
          n: 1,
        });

    const b64Json = res?.data?.[0]?.b64_json;
    if (!b64Json) return null;

    if (onUsage) {
      await onUsage({ model: IMAGE_MODEL, hadReference: Boolean(referenceImageBuffer) });
    }

    return { b64Json, model: IMAGE_MODEL };
  } catch (err) {
    console.error("[ai] image generation failed:", err?.message);
    return null;
  }
}

/**
 * Converts the tool definitions to OpenAI's function-calling shape.
 *
 * copilotTools.js keeps Anthropic's `input_schema` naming. Translating here
 * rather than rewriting that file means the tool definitions stay vendor-
 * neutral — the JSON Schema inside is identical either way, only the wrapper
 * differs.
 */
function toOpenAiTools(definitions) {
  return definitions.map((d) => ({
    type: "function",
    function: {
      name: d.name,
      description: d.description,
      parameters: d.input_schema || { type: "object", properties: {} },
    },
  }));
}

/**
 * Runs the model with tools until it produces a final answer.
 *
 * @param execute  async (name, args) => result. The CALLER runs the tool, so
 *                 this module never touches the database and companyId can be
 *                 injected outside the model's reach.
 */
export async function runToolLoop({
  system,
  messages,
  tools,
  execute,
  maxRounds = 5,
  maxTokens,
  onUsage,
}) {
  if (!isAiConfigured()) {
    return {
      text: "The assistant isn't configured on this deployment yet.",
      messages,
    };
  }

  const conversation = [
    ...(system ? [{ role: "system", content: system }] : []),
    ...messages,
  ];

  // Accumulated across ROUNDS, not per round. One question can make several
  // round trips — each tool call sends the whole conversation back — so
  // metering only the last response would understate a multi-tool question by
  // a factor of three or four.
  let promptTokens = 0;
  let completionTokens = 0;

  for (let round = 0; round < maxRounds; round++) {
    const res = await client.chat.completions.create({
      model: MODEL,
      ...reasoningParams(MODEL),
      max_completion_tokens: Math.max(maxTokens || 0, toolLoopBudget(MODEL)),
      tools: toOpenAiTools(tools),
      messages: conversation,
    });

    if (res.usage) {
      promptTokens += res.usage.prompt_tokens || 0;
      completionTokens += res.usage.completion_tokens || 0;
    }

    const message = res.choices?.[0]?.message;
    if (!message) break;

    const calls = message.tool_calls || [];

    // No tool calls means it's answering.
    if (calls.length === 0) {
      if (onUsage) {
        await onUsage({ model: MODEL, promptTokens, completionTokens });
      }
      return { text: message.content?.trim() || "", messages: conversation };
    }

    // The assistant turn must be replayed verbatim before the results, or the
    // API rejects the follow-up for referencing tool_call_ids it can't see.
    conversation.push(message);

    const results = await Promise.all(
      calls.map(async (call) => {
        let content;
        try {
          const args = call.function.arguments
            ? JSON.parse(call.function.arguments)
            : {};
          content = JSON.stringify(await execute(call.function.name, args));
        } catch (err) {
          // Hand the failure back as a tool result rather than throwing. The
          // model can then say "I couldn't look that up" instead of the whole
          // request 500ing.
          content = JSON.stringify({ error: err?.message || "Tool failed" });
        }
        return { role: "tool", tool_call_id: call.id, content };
      }),
    );

    conversation.push(...results);
  }

  // Ran out of rounds. The tokens were still spent, so still meter them —
  // an expensive failure is exactly the case worth seeing in the numbers.
  if (onUsage) {
    await onUsage({ model: MODEL, promptTokens, completionTokens });
  }

  return {
    text: "I wasn't able to finish looking that up — try asking a more specific question.",
    messages: conversation,
  };
}
