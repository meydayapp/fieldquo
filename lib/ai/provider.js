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
import { assertStrictSchema, validateAgainstSchema } from "./jsonSchema";

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

// ═══════════════════════════════════════════════════════════════════════════
// Why a completion came back with nothing in it
// ═══════════════════════════════════════════════════════════════════════════
//
// complete() has always returned "" for every unhappy path — no key, a 401, a
// retired model ID, a rate limit, a network blip, a reply that was all
// reasoning and no answer. That behaviour is RIGHT and is kept: every caller
// here is a nice-to-have summary sitting on a page that also shows real data,
// and a copilot that 500s a page on a vendor blip is worse than one that says
// nothing. The file's own header warns about the cost of it, though — "a
// retired model therefore looks exactly like a model with nothing to say" —
// and that warning was written because it had already happened once.
//
// So the soft return stays and the REASON becomes observable, out of band:
//
//   - a `reason` is always logged, so "" is never silent again. Previously an
//     unconfigured deployment returned "" with no log line at all.
//   - `onError` is called with { reason, message } when a caller wants to
//     know. Optional, exactly like onUsage, so no existing caller changes.
//   - the schema mode below returns a discriminated result instead of a
//     string, so a validation failure cannot be confused with an empty answer
//     by construction rather than by convention.
//
// EMPTY is a real, distinct outcome and is reported as one: the vendor
// answered, the tokens were spent and metered, and the model chose to say
// nothing. That is not a failure, and a caller that treats it as one would
// refund credit it should have charged.
export const AI_FAILURE = {
  /** No OPENAI_API_KEY on this deployment. Nothing was sent, nothing spent. */
  UNCONFIGURED: "unconfigured",
  /** The vendor call threw: network, 401, 429, retired model, bad request. */
  VENDOR_ERROR: "vendor_error",
  /** The vendor answered and the model declined. `message` is its own words. */
  REFUSED: "refused",
  /** Answered, metered, but the content was blank. Distinct from every failure. */
  EMPTY: "empty",
  /** Ran out of max_completion_tokens before finishing. Tokens were spent. */
  TRUNCATED: "truncated",
  /** Schema mode only: the reply was not JSON. */
  UNPARSEABLE: "unparseable",
  /** Schema mode only: parsed, but did not match the schema we sent. */
  SCHEMA_MISMATCH: "schema_mismatch",
  /** Schema mode only: our own schema breaks the strict subset. Nothing sent. */
  BAD_SCHEMA: "bad_schema",
};

/**
 * One place that logs the reason and tells a caller that asked to be told.
 * Never throws — an onError that itself throws must not take down the request
 * it was reporting on.
 */
async function reportFailure(onError, reason, message) {
  console.error(`[ai] ${reason}${message ? `: ${message}` : ""}`);
  if (typeof onError !== "function") return;
  try {
    await onError({ reason, message: message || null });
  } catch (err) {
    console.error("[ai] onError handler threw:", err?.message);
  }
}

/**
 * Plain text completion.
 *
 * Returns "" rather than throwing when unconfigured — every caller is a
 * nice-to-have summary, and a missing key should degrade to "no summary",
 * never to a 500 on a page that also shows real data.
 *
 * WITH a `schema`, the return type changes to a discriminated result — see
 * the `schema` parameter's own comment. That is a deliberate signature switch
 * rather than a second exported function: the two calls differ only in what
 * comes back, and a caller that passes a schema and then treats the result as
 * a string gets an immediate, obvious failure instead of a subtle one.
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
  // ── Structured output ────────────────────────────────────────────────────
  //
  // A plain JSON Schema object. Passing one switches this function's return
  // type from a string to:
  //
  //   { ok: true,  data, raw }
  //   { ok: false, reason, message, raw? }   // reason is an AI_FAILURE
  //
  // VENDOR-NEUTRAL AT THE CALL SITE. Callers hand over plain JSON Schema, the
  // same convention lib/ai/copilotTools.js already uses for `input_schema` and
  // toOpenAiTools() already translates — see its comment. Wrapping it into
  // OpenAI's `response_format.json_schema` envelope happens HERE and nowhere
  // else, so a provider that expresses this as `text.format` (OpenAI's own
  // Responses API already does), as a tool-call, or not at all is one edit in
  // this file. Nothing outside this file knows the envelope exists.
  //
  // `schemaName` is required by the vendor and is a plain identifier; it shows
  // up in vendor-side errors, so name it after the caller, not after the shape.
  schema = null,
  schemaName = "response",
  // Called with { reason, message } on every path that produces no usable
  // answer, INCLUDING the plain-text path. Optional, like onUsage — a caller
  // that doesn't pass one keeps today's behaviour exactly.
  onError,
}) {
  if (!isAiConfigured()) {
    await reportFailure(onError, AI_FAILURE.UNCONFIGURED, "OPENAI_API_KEY is not set");
    return schema ? { ok: false, reason: AI_FAILURE.UNCONFIGURED, message: "AI is not configured" } : "";
  }

  // Linted BEFORE the request, because a schema the vendor refuses costs a
  // round trip to discover and comes back as a 400 that names one problem at a
  // time. Catching it here costs nothing and names all of them — and, more to
  // the point, it fails on the developer's machine and in check:ai-structured-
  // output rather than on a live quote.
  if (schema) {
    const lint = assertStrictSchema(schema);
    if (!lint.ok) {
      const message = lint.errors.join("; ");
      await reportFailure(onError, AI_FAILURE.BAD_SCHEMA, `${schemaName}: ${message}`);
      return { ok: false, reason: AI_FAILURE.BAD_SCHEMA, message };
    }
  }

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

  let res;
  try {
    res = await client.chat.completions.create({
      model,
      ...reasoningParams(model, reasoningEffort),
      max_completion_tokens: Math.max(maxTokens || 0, completionBudget(model)),
      // strict: true is the whole point — plain `json_schema` without it is
      // JSON MODE, which guarantees the reply parses and nothing about its
      // shape. Only present when a caller asked for it, so a text call's
      // payload is byte-for-byte what it was before this parameter existed.
      ...(schema
        ? { response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } } }
        : {}),
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content },
      ],
    });
  } catch (err) {
    // The one path where NOTHING was spent, because the vendor never produced
    // a usage block. Nothing to meter.
    await reportFailure(onError, AI_FAILURE.VENDOR_ERROR, err?.message);
    return schema
      ? { ok: false, reason: AI_FAILURE.VENDOR_ERROR, message: err?.message || "vendor call failed" }
      : "";
  }

  // ── Metering, before any decision about the content ─────────────────────
  //
  // The order matters and is deliberate. Everything below this point —
  // truncated, refused, empty, unparseable, mismatched — describes a reply the
  // vendor GENERATED and billed us for. Metering only the happy path would
  // mean a company whose schema keeps getting refused shows zero AI usage
  // while costing FieldQuo real money, which is the exact number
  // lib/ai/usage.js exists to get right. checkAiQuota() still runs before the
  // call, in the caller; recordAiUsage() still runs after, from these counts.
  //
  // THERE IS NO RETRY ON SCHEMA REJECTION, and that is a decision rather than
  // an omission. With `strict: true` the vendor constrains generation, so a
  // shape mismatch is not a flaky model that a second attempt would fix — it
  // is a refusal, a truncation, or a provider that did not honour the
  // guarantee, none of which change on an identical retry. A retry would also
  // spend a second call's tokens against a quota that was checked ONCE, before
  // the first — so it would bill a company for budget nobody authorised, and
  // double the cost of the one call most likely to be failing repeatedly.
  // Every caller here already degrades gracefully; retrying is the caller's
  // decision to make with its own quota check, not this function's to make
  // silently.
  {

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
  }

  const choice = res.choices?.[0];
  const text = choice?.message?.content?.trim() || "";

  // A structured-outputs refusal does NOT follow the schema — the vendor puts
  // the model's own words in `refusal` and leaves `content` null. Parsing that
  // as JSON would fail with "unparseable", which is true and useless; the
  // useful fact is that it was declined, and what it said.
  const refusal = choice?.message?.refusal;
  if (refusal) {
    await reportFailure(onError, AI_FAILURE.REFUSED, refusal);
    return schema ? { ok: false, reason: AI_FAILURE.REFUSED, message: String(refusal) } : "";
  }

  // `length` means the budget ran out mid-answer. On a text call that used to
  // look like a short reply; on a schema call it produces truncated JSON that
  // would be reported as unparseable, hiding the one thing that would actually
  // fix it (raise maxTokens). See completionBudget() — reasoning tokens come
  // out of the same budget as the answer.
  if (choice?.finish_reason === "length") {
    await reportFailure(
      onError,
      AI_FAILURE.TRUNCATED,
      `ran out of max_completion_tokens on ${model}${text ? "" : " before writing anything"}`,
    );
    if (schema) return { ok: false, reason: AI_FAILURE.TRUNCATED, message: "reply was truncated", raw: text };
    // Text callers keep whatever arrived: half a summary has been the
    // behaviour since this function was written, and a partial paragraph is
    // still better than nothing on a page that shows it as a nicety.
    return text;
  }

  if (!text) {
    // The vendor answered and the model said nothing. Reported — because until
    // now this was silent and indistinguishable from a retired model ID — but
    // it is a legitimate outcome, not an error, and the tokens above were real.
    await reportFailure(onError, AI_FAILURE.EMPTY, `${model} returned no content`);
    return schema ? { ok: false, reason: AI_FAILURE.EMPTY, message: "the model returned nothing", raw: "" } : "";
  }

  if (!schema) return text;

  let data;
  try {
    // stripJsonFence even here. strict mode should make it impossible, and it
    // costs one regex to be wrong about that — a proxy or a future provider
    // that fences is a fenced reply we can still read.
    data = JSON.parse(stripJsonFence(text));
  } catch (err) {
    await reportFailure(onError, AI_FAILURE.UNPARSEABLE, err?.message);
    return { ok: false, reason: AI_FAILURE.UNPARSEABLE, message: "reply was not JSON", raw: text };
  }

  // The vendor's promise, checked. This should never fire against OpenAI in
  // strict mode; the day it does is the day the guarantee stopped holding, and
  // finding that out from a log line beats finding it out from a contractor.
  const check = validateAgainstSchema(data, schema);
  if (!check.ok) {
    const message = check.errors.join("; ");
    await reportFailure(onError, AI_FAILURE.SCHEMA_MISMATCH, `${schemaName}: ${message}`);
    return { ok: false, reason: AI_FAILURE.SCHEMA_MISMATCH, message, raw: text };
  }

  return { ok: true, data, raw: text };
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
 * @param images   Attached to the LAST message only — the one turn a person
 *                 can genuinely attach a photo to in a chat UI, same as
 *                 complete()'s single-turn attachment. Added for Jennifer's
 *                 signed-in "attach a screenshot" case (lib/ai/jennifer/); the
 *                 copilot passes none, so this is additive and every existing
 *                 caller's behaviour is unchanged. See userContent()'s header
 *                 for the cost-ceiling reasoning `detail` exists for.
 */
export async function runToolLoop({
  system,
  messages,
  tools,
  execute,
  maxRounds = 5,
  maxTokens,
  onUsage,
  images = [],
  maxImages = 4,
  imageDetail = "low",
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

  // Attach images to the last message in place, rather than appending a new
  // one — a tool-calling conversation's last entry has to be a `user` turn or
  // OpenAI rejects the request, and inserting a second one would violate that.
  let imagesSent = 0;
  if (images.length) {
    const lastIndex = conversation.length - 1;
    const last = conversation[lastIndex];
    if (last?.role === "user") {
      const content = userContent(last.content, images, maxImages, imageDetail);
      imagesSent = Array.isArray(content)
        ? content.filter((c) => c.type === "image_url").length
        : 0;
      conversation[lastIndex] = { ...last, content };
    }
  }

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
        await onUsage({ model: MODEL, promptTokens, completionTokens, imageCount: imagesSent });
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
    await onUsage({ model: MODEL, promptTokens, completionTokens, imageCount: imagesSent });
  }

  return {
    text: "I wasn't able to finish looking that up — try asking a more specific question.",
    messages: conversation,
  };
}
