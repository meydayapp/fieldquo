// lib/messaging/templates.js
//
// WhatsApp message templates: the only thing that may be sent once the
// 24-hour customer service window has closed.
//
// ══ Two halves, and the boundary between them ══════════════════════════════
//
// PURE (top of this file): which template may be used, and whether the
// parameters given fit it. Every one of these is a way to send a message that
// Meta refuses — 132001 for a template that is not approved in that language,
// 132000 for the wrong number of parameters — and both are refusals that
// arrive AFTER the contractor pressed Send unless something checks first.
// Executed by scripts/check-whatsapp.mjs.
//
// IMPURE (bottom): the sync that mirrors Meta's verdicts into WhatsAppTemplate.
// It reads GET /<waba-id>/message_templates and writes what came back. It
// never invents a status and never guesses a category — a template Meta did
// not mention is left alone rather than deleted, because "Meta's list did not
// include it" and "Meta rejected it" are different facts and only one of them
// is worth telling a contractor.

import { GRAPH_API_VERSION, classifyMetaError } from "@/lib/meta/client";

const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Meta's own status vocabulary, unmapped. Only APPROVED may be sent.
 *
 * The others are kept and SHOWN rather than filtered away: "your template was
 * rejected" is the fact a contractor needs, and a list that silently omitted
 * it would look like the template had never been submitted at all.
 */
export const TEMPLATE_STATUSES = Object.freeze([
  "APPROVED",
  "PENDING",
  "REJECTED",
  "PAUSED",
  "DISABLED",
]);

/** Meta's three categories. Category decides what a send costs the company. */
export const TEMPLATE_CATEGORIES = Object.freeze(["MARKETING", "UTILITY", "AUTHENTICATION"]);

export function isSendableTemplate(template) {
  return template?.status === "APPROVED";
}

/**
 * How many `{{n}}` placeholders a body carries.
 *
 * Counted as DISTINCT indices, not occurrences: Meta's own templates repeat
 * `{{1}}` ("Hi {{1}}, your quote for {{2}} is ready, {{1}}") and counting
 * occurrences there would demand three parameters for a two-parameter
 * template — a refusal invented by us, on a template Meta approved.
 */
export function countTemplateVariables(body) {
  const found = new Set();
  for (const m of String(body || "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    found.add(Number(m[1]));
  }
  return found.size;
}

/**
 * Fill a template body for DISPLAY — what the contractor is about to send.
 *
 * Display only, and stated as such: the real substitution happens at Meta's
 * end from the `components` array in the send body. This exists so the
 * composer can show the sentence rather than a name and a row of blanks, and
 * a missing parameter renders as the placeholder rather than as an empty gap
 * that hides the fact something was not filled in.
 */
export function renderTemplateBody(body, params = []) {
  return String(body || "").replace(/\{\{\s*(\d+)\s*\}\}/g, (whole, n) => {
    const value = params[Number(n) - 1];
    return value === undefined || value === null || value === "" ? whole : String(value);
  });
}

/**
 * May this template be sent with these parameters?
 *
 * @returns null when it may, or `{ reason, message }` — the same refusal shape
 *          every other guard in lib/messaging/ returns.
 */
export function templateRefusal({ template, params = [] } = {}) {
  if (!template) {
    return {
      reason: "template_unknown",
      message: "That template is not one of the ones Meta has approved for this number.",
    };
  }
  if (!isSendableTemplate(template)) {
    return {
      reason: "template_not_approved",
      // The status is named. "Not approved" alone sends a contractor to
      // resubmit a template that is merely still PENDING.
      message: `WhatsApp has not approved that template — its status is ${String(template.status || "unknown").toLowerCase()}.`,
    };
  }
  const needed = Number.isFinite(Number(template.variableCount))
    ? Number(template.variableCount)
    : countTemplateVariables(template.body);
  const given = params.filter((p) => String(p ?? "").trim() !== "").length;
  if (given !== needed) {
    return {
      reason: "template_params",
      message:
        needed === 0
          ? "That template takes no fill-in values."
          : `That template needs ${needed} fill-in value${needed === 1 ? "" : "s"} and got ${given}.`,
    };
  }
  return null;
}

/**
 * The `template` object of a WhatsApp send body.
 *
 * Built here rather than in whatsappSend.js so the shape has one definition
 * and the check can assert it without a network call. Meta's shape, from
 * developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages:
 *
 *   { name, language: { code }, components: [ { type: "body",
 *       parameters: [ { type: "text", text } ] } ] }
 *
 * `components` is omitted entirely for a template with no variables — an
 * empty parameters array is a different thing to Meta from no components at
 * all, and sending one for a zero-variable template is 132000.
 */
export function templatePayload({ template, params = [] }) {
  const values = params.map((p) => String(p ?? ""));
  const payload = {
    name: template.name,
    language: { code: template.language },
  };
  if (values.length) {
    payload.components = [
      { type: "body", parameters: values.map((text) => ({ type: "text", text })) },
    ];
  }
  return payload;
}

/** What may be sent to a browser. No ids Meta owns, no token, ever. */
export function publicTemplateShape(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    language: row.language,
    category: row.category,
    status: row.status,
    body: row.body,
    variableCount: row.variableCount,
    syncedAt: row.syncedAt || null,
  };
}

/**
 * One row of Meta's `GET /<waba-id>/message_templates` response, normalised.
 *
 * Returns null for anything that cannot be identified or sent — a template
 * with no name, no language, or no BODY component is not a template we could
 * ever send, and storing it would put a row in the picker that refuses on
 * click. Meta's response carries HEADER, BODY, FOOTER and BUTTONS components;
 * only BODY carries the text, and only BODY's variables are supported here.
 */
export function normaliseTemplate(raw) {
  const name = typeof raw?.name === "string" ? raw.name.trim() : "";
  const language = typeof raw?.language === "string" ? raw.language.trim() : "";
  if (!name || !language) return null;

  const components = Array.isArray(raw?.components) ? raw.components : [];
  const bodyComponent = components.find((c) => String(c?.type).toUpperCase() === "BODY");
  const body = typeof bodyComponent?.text === "string" ? bodyComponent.text : "";
  if (!body) return null;

  const status = TEMPLATE_STATUSES.includes(String(raw?.status).toUpperCase())
    ? String(raw.status).toUpperCase()
    // An unrecognised status is NOT coerced to APPROVED or to REJECTED. It is
    // kept verbatim so the screen shows what Meta said, and isSendableTemplate
    // refuses it because it is not the string "APPROVED" — fail closed, the
    // same rule lib/features/registry.js's CLOSED_STATE follows.
    : String(raw?.status || "UNKNOWN").toUpperCase();

  const category = TEMPLATE_CATEGORIES.includes(String(raw?.category).toUpperCase())
    ? String(raw.category).toUpperCase()
    : String(raw?.category || "UNKNOWN").toUpperCase();

  return { name, language, status, category, body, variableCount: countTemplateVariables(body) };
}

/**
 * Mirror Meta's template list into WhatsAppTemplate for one company.
 *
 * @param db         a Prisma client, passed in rather than imported so the
 *                   check can stub it — the same convention matchContact()
 *                   and the attribution loaders use.
 * @param channel    the MessagingChannel row (needs wabaId and a token)
 * @param accessToken the DECRYPTED token, obtained by the caller through
 *                   lib/messaging/channels.js. Not decrypted here: this file
 *                   is one of the many that must not learn how.
 *
 * @returns { ok, synced, reason?, message? } — never throws.
 */
export async function syncTemplates({ db, companyId, channel, accessToken }) {
  if (!channel?.wabaId) {
    return {
      ok: false,
      synced: 0,
      reason: "no_waba",
      message: "This number is not linked to a WhatsApp Business Account, so there is no template list to read.",
    };
  }

  let res;
  try {
    res = await fetch(
      `${GRAPH_BASE}/${channel.wabaId}/message_templates?limit=100&fields=name,language,status,category,components`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  } catch (err) {
    return { ok: false, synced: 0, reason: "network", message: `Could not reach Meta (${err?.message || "network error"}).` };
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const classified = classifyMetaError({ status: res.status, body, headers: res.headers });
    return { ok: false, synced: 0, reason: `meta_${classified.kind}`, message: classified.message };
  }

  const list = Array.isArray(body?.data) ? body.data : [];
  let synced = 0;
  for (const raw of list) {
    const shaped = normaliseTemplate(raw);
    if (!shaped) continue;
    await db.whatsAppTemplate
      .upsert({
        where: {
          companyId_name_language: {
            companyId,
            name: shaped.name,
            language: shaped.language,
          },
        },
        create: { companyId, ...shaped, syncedAt: new Date() },
        update: { ...shaped, syncedAt: new Date() },
      })
      // One bad row must not lose the other ninety-nine. The count reflects
      // what was actually written, so a partial sync reports as partial.
      .then(() => {
        synced++;
      })
      .catch((err) => {
        console.error(`[whatsapp-templates] failed to store ${shaped.name}: ${err?.message}`);
      });
  }

  return { ok: true, synced, total: list.length };
}
