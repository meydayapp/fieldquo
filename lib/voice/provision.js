// lib/voice/provision.js
//
// Turning a company's settings into a live agent at the provider.
//
// ── Why this is its own file ───────────────────────────────────────────────
//
// Three things call it — creating a number, editing the greeting, and enabling
// the receptionist — and all three must produce exactly the same agent. Three
// copies of "build the prompt, attach the tools, push it" is three chances for
// the live agent to drift from what the settings screen says it is, and the
// symptom is a contractor swearing they changed the greeting a week ago.
//
// ── Push on every save, not just on create ─────────────────────────────────
//
// The agent at Retell is a CACHE of what's in our database, and the database is
// the truth. Editing the greeting and not pushing leaves a screen that says one
// thing and a phone that says another — which is worse than the edit failing,
// because nobody knows.
import { db } from "@/lib/db";
import { createAgent, updateAgent, attachAgent, voiceConfigured } from "./retell";
import { buildAgentPrompt, buildGreeting } from "./prompt";
import { toolDefinitions } from "./tools";
import { categoryLabel } from "@/lib/i18n/translateContent";
import { groupHours, hasBusinessHours } from "@/lib/company/businessHours";

/**
 * Everything the prompt needs, from the database.
 *
 * Absent facts stay absent — see the note in prompt.js. A model handed an empty
 * opening-hours string will invent hours, and a business whose opening times get
 * made up on the phone finds out from a customer standing outside a locked unit.
 */
async function factsFor(companyId) {
  const [company, enabled, areas] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        name: true, phone: true, city: true, province: true,
        businessHours: true, defaultLanguage: true, timezone: true,
      },
    }),
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      select: { category: { select: { label: true, labelTranslations: true } } },
    }),
    db.workArea.findMany({ where: { companyId }, select: { name: true }, take: 30 }),
  ]);

  const language = company?.defaultLanguage || "en";

  return {
    company: company || { name: "the business" },
    language,
    // In the company's own language, so a French shop's agent says "Peinture
    // intérieure" rather than reading an English trade name aloud in French.
    services: enabled
      .map((e) => categoryLabel(e.category, language))
      .filter(Boolean),
    areas: areas.map((a) => a.name).filter(Boolean),
    hours: hoursSentence(company?.businessHours),
  };
}

/**
 * Opening hours as one sentence, or null.
 *
 * Null when they haven't set any — NOT "not specified", and NOT an invented
 * Mon–Fri. `hasBusinessHours` is the gate: absence of a statement is not a
 * statement, and a partial array padded with defaults is how a made-up opening
 * time reaches a caller. Same rule the website generator follows.
 *
 * An earlier version called a `describeHours` that doesn't exist, guarded with
 * optional chaining — so it returned null every time and the agent silently
 * never knew the hours. Silent, and exactly the kind of thing nobody notices.
 */
function hoursSentence(businessHours) {
  if (!hasBusinessHours(businessHours)) return null;
  try {
    const groups = groupHours(businessHours);
    const open = groups.filter((g) => !g.closed);
    if (!open.length) return null;
    return open.map((g) => `${g.label} ${g.hours}`).join(", ");
  } catch {
    return null;
  }
}

/**
 * Create or update this company's agent at the provider.
 *
 * @returns { ok, agentId } or { ok: false, reason }
 */
export async function provisionAgent(companyId, origin) {
  if (!voiceConfigured()) return { ok: false, reason: "not_configured" };

  const [agent, number, facts] = await Promise.all([
    db.voiceAgent.findUnique({ where: { companyId } }),
    db.voicePhoneNumber.findFirst({
      where: { companyId, status: "active" },
      select: { e164: true },
    }),
    factsFor(companyId),
  ]);

  // Can it actually book? Only if somebody has bookable availability set up.
  // Told the truth rather than assumed: an agent that believes it can book and
  // then finds no slots offers "let me check" and never comes back.
  const eventTypes = await db.eventType.count({ where: { companyId, active: true } });
  const canBook = eventTypes > 0;

  const payload = {
    agent_name: `${facts.company.name} — receptionist`,
    language: facts.language === "fr" ? "fr-CA" : "en-US",
    // The instruction set is rebuilt from scratch every push, so a company that
    // DELETES their custom note gets an agent without it. Merging would leave
    // removed instructions live forever.
    general_prompt: buildAgentPrompt({
      company: facts.company,
      services: facts.services,
      areas: facts.areas,
      hours: facts.hours,
      notes: agent?.instructions,
      canBook,
    }),
    begin_message: buildGreeting({ company: facts.company, greeting: agent?.greeting }),
    general_tools: toolDefinitions(origin, { canBook }),
    ...(agent?.voice ? { voice_id: agent.voice } : {}),
  };

  try {
    let providerAgentId = agent?.providerAgentId;

    if (providerAgentId) {
      await updateAgent(providerAgentId, payload);
    } else {
      const created = await createAgent(payload);
      providerAgentId = created?.agent_id;
      if (!providerAgentId) return { ok: false, reason: "no_agent_id" };
    }

    await db.voiceAgent.upsert({
      where: { companyId },
      create: { companyId, providerAgentId },
      update: { providerAgentId },
    });

    // Point the number at it. Harmless when it's already attached, and it's the
    // step that's easy to forget on a company whose number was created before
    // their agent existed — which is every company that bought a number first.
    if (number?.e164) {
      await attachAgent(number.e164, providerAgentId).catch((err) => {
        console.error("[voice/provision] couldn't attach the number:", err.message);
      });
    }

    return { ok: true, agentId: providerAgentId, canBook };
  } catch (err) {
    console.error("[voice/provision] failed", err);
    return { ok: false, reason: err.message };
  }
}
