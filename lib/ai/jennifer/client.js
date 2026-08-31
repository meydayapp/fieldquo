// lib/ai/jennifer/client.js
//
// Jennifer's entry point, in the same shape as lib/ai/copilotClient.js's
// askCopilot: one function, mode-aware, that assembles the prompt and tool
// list and runs them through the one shared model loop in provider.js.
//
// The one thing this file does that copilotClient.js doesn't: it checks for
// an escalation topic BEFORE the model is ever called (constraint 5,
// "ESCALATE, never answer"). That's not an optimisation, it's the point — a
// forced handoff has to be a code path that runs whether or not the model
// would have cooperated, not a hope that it follows the prompt. See
// escalate.js's header for the full reasoning.
import { runToolLoop } from "@/lib/ai/provider";
import { jenniferToolsFor } from "./tools";
import { buildAnonymousPrompt, buildCompanyPrompt } from "./prompt";
import { anonymousKnowledge, companyKnowledge } from "./knowledge";
import { escalationReason, escalationLabel } from "./escalate";
import { resolveNavRoute } from "./allowlist";

/** The last thing the person themselves typed — never a tool result or an
 * earlier assistant turn, which is exactly what escalationReason() must never
 * be checked against (see that file's header on "the caller's own words"). */
function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return String(messages[i].content || "");
  }
  return "";
}

function handoverCard({ mode, reason }) {
  // Company mode has somewhere better to send a reply than an outbound
  // email now: the conversation itself, which app/api/jennifer/route.js has
  // just flipped (or is about to flip) to "escalated" and an operator can
  // open in /platform/jennifer. No navigation offer for that case — there is
  // nowhere to click through TO, the reply arrives in this same panel.
  const contact = mode === "company" ? null : resolveNavRoute("anonymous", "contact");

  return {
    text:
      `That's ${escalationLabel(reason)}, and it needs a person rather than me — ` +
      `I don't want to guess at something this important. ${
        mode === "company"
          ? "I've flagged this for a person on the FieldQuo team — they'll reply right here."
          : "Use the button below and someone will get back to you directly."
      }`,
    escalated: true,
    escalationCategory: reason,
    escalationNote: null,
    navigation: contact,
  };
}

/**
 * @param mode       "anonymous" | "company"
 * @param companyId  required when mode === "company". From the SESSION only —
 *                    see app/api/jennifer/route.js, which is the only caller
 *                    and never reads this from the request body.
 * @param member     { role } — required when mode === "company"
 * @param messages   [{ role: "user"|"assistant", content }]
 * @param images     Screenshots attached to the CURRENT turn. Signed-in only —
 *                    an anonymous visitor has no account behind an upload, and
 *                    a stranger's arbitrary image URL reaching a vision call
 *                    billed to FieldQuo is a cost/abuse surface with nothing
 *                    to attribute it to. Ignored outright for mode ===
 *                    "anonymous" rather than trusted from the caller — see the
 *                    guard just below, which is the actual enforcement; the
 *                    route additionally never reads `images` off the request
 *                    body for an anonymous caller in the first place, so this
 *                    is a second, redundant refusal rather than the only one.
 * @param onUsage    forwarded to runToolLoop; the route decides whether/how
 *                    to record it (company mode meters through
 *                    lib/ai/usage.js; anonymous mode does not — see the
 *                    route's own header for why).
 */
export async function askJennifer({ mode, companyId, member, messages, images, onUsage }) {
  const forcedReason = escalationReason(lastUserText(messages));
  if (forcedReason) {
    return handoverCard({ mode, reason: forcedReason });
  }

  const knowledge = mode === "company" ? companyKnowledge() : await anonymousKnowledge();
  const system =
    mode === "company"
      ? await buildCompanyPrompt({ knowledge, role: member?.role || "employee" })
      : await buildAnonymousPrompt({ knowledge });

  const { definitions, implementations } = jenniferToolsFor({ mode, companyId, member });

  // Captured across the tool loop rather than parsed back out of `messages`
  // afterwards: runToolLoop hands back the raw OpenAI conversation, not a
  // "here's what ran" summary, and re-deriving structure by re-reading that
  // would be a second, looser parser of the same calls this closure already
  // sees first-hand as they happen.
  let navigationOffer = null;
  let softEscalation = null;

  const { text } = await runToolLoop({
    system,
    messages,
    tools: definitions,
    onUsage,
    // See the `images` param doc above — anonymous never reaches the vendor
    // with an image attached, no matter what this function was called with.
    images: mode === "company" && Array.isArray(images) ? images : [],
    execute: async (name, args) => {
      const impl = implementations[name];
      if (!impl) throw new Error(`Unknown tool: ${name}`);
      const result = await impl(args);

      if (name === "offerNavigation" && result?.offered) navigationOffer = result;
      // The model's OWN choice to hand off, as opposed to the forced regex
      // path above. escalateToHuman's implementation never answers the
      // question either way — it only ever returns a handoff payload — so
      // capturing it here is a read of what already happened, not a second
      // enforcement point.
      if (name === "escalateToHuman") softEscalation = result;

      return result;
    },
  });

  return {
    text,
    escalated: Boolean(softEscalation),
    // No fixed category for the model's own choice — escalate.js's regex
    // classifies the FORCED path into one of three named topics; the model
    // just gives a sentence. The route records `escalationNote` as-is on the
    // Feedback row for a person to read, rather than forcing it into a
    // category nobody chose.
    escalationCategory: null,
    escalationNote: softEscalation?.reason || null,
    navigation: softEscalation?.contact || navigationOffer || null,
  };
}
