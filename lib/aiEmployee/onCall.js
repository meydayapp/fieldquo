// lib/aiEmployee/onCall.js
//
// Who is on call right now, in what order they are texted, what the text
// says and what it costs — the PURE half of the urgent escalation (owner,
// 2026-10-04). lib/aiEmployee/urgentAlerts.js does the reads, the sends and
// the writes; every decision it acts on is made here, so
// scripts/check-ai-employee.mjs can execute it against a timezone, a
// midnight wrap, a member with no phone, an empty list and an empty wallet.
//
// ══ Nobody is never everybody ══════════════════════════════════════════════
//
// An empty on-call list is "nobody is on call". It is never read as "text
// the owner" or "text everyone" — that would invent a rota nobody wrote
// (AGENTS.md failure class 5). The alert still exists: the customer is given
// the company's number and an urgent callback is booked, the bell tells the
// owner and admins (ai_employee.urgent_unrouted), and the settings screen
// says, in a sentence, why no text went out.
//
// ══ Hours ══════════════════════════════════════════════════════════════════
//
//   always       on call at every hour.
//   after_hours  outside the company's PUBLIC business hours
//                (lib/company/businessHours.js). A company that has saved no
//                hours has told us no hours to be outside of; rather than
//                read that silence as "never after hours" (no texts at all
//                for an urgent leak) it is read as on call, and the screen
//                warns that business hours are missing.
//   custom       the chosen days, from a start to an end time in the
//                company's timezone; an end earlier than the start wraps
//                past midnight (18:00 → 08:00 is the night shift, and the
//                morning half belongs to the day it STARTED on).

import { TEXT_FLOOR_CENTS, floorCents } from "@/lib/phoneUsage/pricing";

const DAYS = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });

/** The weekday (0 = Sunday) and minute of the day in a timezone, or null. */
export function localClock(now = new Date(), timezone = "America/Toronto") {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "America/Toronto",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now instanceof Date ? now : new Date(now));
    const get = (t) => parts.find((p) => p.type === t)?.value || "";
    const day = DAYS[get("weekday").slice(0, 3)];
    const hour = Number(get("hour")) % 24;
    const minute = Number(get("minute"));
    if (day === undefined || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return { day, minute: hour * 60 + minute };
  } catch {
    return null;
  }
}

/**
 * Is the on-call rota live at this moment? Pure.
 *
 * @param businessHoursOpen  decide.js withinBusinessHours(company): true,
 *                           false, or null (no hours saved)
 * @returns {{ on: boolean, reason: string|null, warning?: string }}
 */
export function onCallNow({ settings = {}, businessHoursOpen = null, timezone = "America/Toronto", now = new Date() } = {}) {
  const mode = settings.onCallHours || "always";
  if (mode === "always") return { on: true, reason: null };
  if (mode === "after_hours") {
    if (businessHoursOpen === null || businessHoursOpen === undefined) {
      return { on: true, reason: null, warning: "no_business_hours" };
    }
    return businessHoursOpen ? { on: false, reason: "off_hours" } : { on: true, reason: null };
  }
  // custom
  const days = Array.isArray(settings.onCallDays) ? settings.onCallDays : [];
  const start = settings.onCallStartMinute;
  const end = settings.onCallEndMinute;
  if (!days.length || !Number.isInteger(start) || !Number.isInteger(end) || start === end) {
    // planSafetySave refuses this shape; a row that holds it anyway is
    // corrupt, and the screen names it rather than this guessing.
    return { on: false, reason: "custom_incomplete" };
  }
  const clock = localClock(now, timezone);
  if (!clock) return { on: false, reason: "bad_timezone" };
  if (start < end) {
    return days.includes(clock.day) && clock.minute >= start && clock.minute < end ? { on: true, reason: null } : { on: false, reason: "off_hours" };
  }
  // Wraps midnight: the evening half on a chosen day, or the morning half
  // of the day AFTER a chosen day.
  if (clock.minute >= start && days.includes(clock.day)) return { on: true, reason: null };
  if (clock.minute < end && days.includes((clock.day + 6) % 7)) return { on: true, reason: null };
  return { on: false, reason: "off_hours" };
}

/** A phone a text can actually go to — the same normalisation shape as
 *  lib/sms/twilioClient.js toE164, kept pure here (no client import). */
export function e164(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/**
 * The ladder: the on-call ids in the owner's order, each resolved to an
 * ACTIVE member of this company with a textable phone. Ids that no longer
 * resolve, or have no phone, are reported — never silently skipped, because
 * "Sam is first on call but has no number" is the sentence the screen needs.
 *
 * @param members  this company's members: [{ id, userId, name, phone, active }]
 */
export function buildLadder(settings = {}, members = []) {
  const byId = new Map((Array.isArray(members) ? members : []).map((m) => [m.id, m]));
  const ladder = [];
  const skipped = [];
  for (const id of Array.isArray(settings.onCallMemberIds) ? settings.onCallMemberIds : []) {
    const m = byId.get(id);
    if (!m || m.active === false) {
      skipped.push({ memberId: id, reason: "not_on_team" });
      continue;
    }
    const phone = e164(m.phone);
    if (!phone) {
      skipped.push({ memberId: id, reason: "no_phone", name: m.name || null });
      continue;
    }
    ladder.push({ memberId: m.id, userId: m.userId || null, name: m.name || null, phone });
  }
  return { ladder, skipped };
}

/** How many SMS segments a text is — segmentsFor's rule (lib/crew/
 *  messaging.js), restated without its import graph: ASCII 160 / 153,
 *  anything else 70 / 67. */
export function alertTextSegments(body) {
  const text = String(body || "");
  const unicode = /[^\u0000-\u007F]/.test(text);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  return !text.length ? 1 : text.length <= single ? 1 : Math.ceil(text.length / multi);
}

/** What one alert text is charged (the floor; settle tops it up to cost × 2). */
export function alertTextCents(body) {
  return floorCents({ resource: "message", units: alertTextSegments(body) });
}

/** The per-text price the screen states (one segment). */
export const ALERT_TEXT_FLOOR_CENTS = TEXT_FLOOR_CENTS;

/**
 * Why urgent texts would not go out right now, for the screen — every
 * reason that applies, in the order somebody would fix them. Pure.
 */
export function deliveryProblems({ settings = {}, ladder = [], skipped = [], balanceCents = 0, smsNumber = true, onCall = { on: true } } = {}) {
  const out = [];
  if (settings.urgentAlertsEnabled === false) out.push({ reason: "alerts_off" });
  if (!(settings.onCallMemberIds || []).length) out.push({ reason: "no_on_call" });
  else if (!ladder.length) out.push({ reason: "no_phone" });
  for (const s of skipped) out.push({ reason: `member_${s.reason}`, memberId: s.memberId, name: s.name || null });
  if (Number(balanceCents) < TEXT_FLOOR_CENTS) out.push({ reason: "no_credit" });
  if (!smsNumber) out.push({ reason: "no_sms_number" });
  if (onCall && onCall.on === false) out.push({ reason: onCall.reason || "off_hours" });
  if (onCall?.warning) out.push({ reason: onCall.warning, warning: true });
  return out;
}

/**
 * What the escalation tick should do with one open alert. Pure.
 *
 * @returns {{ action: "wait"|"text_next"|"exhausted"|"done", nextIndex?: number }}
 */
export function escalationStep(alert, { now = new Date() } = {}) {
  if (!alert || alert.status !== "open") return { action: "done" };
  if (alert.acknowledgedAt) return { action: "done" };
  const due = alert.nextAt ? new Date(alert.nextAt).getTime() <= new Date(now).getTime() : false;
  if (!due) return { action: "wait" };
  const next = Number(alert.step) + 1;
  const ladder = Array.isArray(alert.ladder) ? alert.ladder : [];
  return next < ladder.length ? { action: "text_next", nextIndex: next } : { action: "exhausted" };
}

// ── The text itself ──────────────────────────────────────────────────────────
//
// To the company's OWN staff, from FieldQuo's system number — so it opens
// with the company's name (the person may be on call for two businesses)
// and carries no FieldQuo branding beyond the link's host. The customer's
// words are clipped; the link opens /app/urgent/[id], where "I've got it"
// is a button (a link preview must never acknowledge for them).

const LABEL = Object.freeze({
  en: { urgent: "URGENT", emergency: "EMERGENCY", open: "Open to take it" },
  fr: { urgent: "URGENT", emergency: "URGENCE", open: "Ouvrir pour la prendre" },
  es: { urgent: "URGENTE", emergency: "EMERGENCIA", open: "Abra para atenderla" },
  uk: { urgent: "ТЕРМІНОВО", emergency: "НАДЗВИЧАЙНО", open: "Відкрийте, щоб взяти" },
  pa: { urgent: "ਜ਼ਰੂਰੀ", emergency: "ਐਮਰਜੈਂਸੀ", open: "ਲੈਣ ਲਈ ਖੋਲ੍ਹੋ" },
  tl: { urgent: "URGENT", emergency: "EMERGENCY", open: "Buksan para kunin" },
  de: { urgent: "DRINGEND", emergency: "NOTFALL", open: "Öffnen, um es zu übernehmen" },
  zh: { urgent: "紧急", emergency: "危急", open: "打开以接手" },
  it: { urgent: "URGENTE", emergency: "EMERGENZA", open: "Apri per prenderla" },
});

const CATEGORY = Object.freeze({
  en: { water: "water leak", heat: "no heat", roof: "roof leak", sewage: "sewage backup", electrical: "electrical", gas_co: "gas / CO", fire: "fire", injury: "someone hurt", water_electrics: "water on electrics", other: "problem" },
  fr: { water: "fuite d'eau", heat: "pas de chauffage", roof: "fuite de toit", sewage: "refoulement d'égout", electrical: "électrique", gas_co: "gaz / CO", fire: "feu", injury: "personne blessée", water_electrics: "eau sur l'électricité", other: "problème" },
  es: { water: "fuga de agua", heat: "sin calefacción", roof: "gotera en el techo", sewage: "aguas negras", electrical: "eléctrico", gas_co: "gas / CO", fire: "fuego", injury: "persona herida", water_electrics: "agua en la electricidad", other: "problema" },
});

/** The SMS to one on-call person. Pure. */
export function alertSmsBody({ companyName, tier = "urgent", category = "other", customerName = null, summary = null, link = "", language = "en" } = {}) {
  const l = LABEL[language] || LABEL.en;
  const c = (CATEGORY[language] || CATEGORY.en)[category] || (CATEGORY[language] || CATEGORY.en).other || CATEGORY.en.other;
  const who = String(customerName || "").replace(/\s+/g, " ").trim().slice(0, 40);
  // Clipped to keep an English alert inside ONE segment (160 ASCII
  // characters with the link): a second segment doubles what the company
  // pays for the text. Plain ASCII separators for the same reason — one
  // em dash would turn the whole text into 70-character UCS-2 segments.
  const said = String(summary || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const head = `${String(companyName || "").trim().slice(0, 40) || "FieldQuo"}: ${tier === "emergency" ? l.emergency : l.urgent} (${c})`;
  return [head + (who ? ` - ${who}` : ""), said ? `"${said}"` : null, link ? `${l.open}: ${link}` : null].filter(Boolean).join("\n");
}

/** The per-text charge as a whole-cent figure, for the screen. */
export function alertCostLine(body = "") {
  return { cents: alertTextCents(body), floorCents: TEXT_FLOOR_CENTS };
}
