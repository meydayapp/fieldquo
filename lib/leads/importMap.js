// lib/leads/importMap.js
//
// Purchased/exported lead lists arrive in every shape. These best-effort mappers
// coax a free-text budget or timeline cell into the SAME keys the self-quote form
// produces, so an imported lead is triaged by the same scorer as an inbound one.
// When nothing recognisable is present they return null — the lead still scores
// on contactability and any notes, it just isn't credited a budget/timeline it
// never actually stated (absence is not a statement).

import { cleanBudgetBand, cleanTimeline } from "@/lib/leads/qualifiers";

// Map an arbitrary budget cell to a band. First honour an already-canonical key
// (a re-import of our own export), then a stated dollar figure/range, then words.
export function mapBudget(raw) {
  if (raw == null) return null;
  const s = String(raw).toLowerCase().trim();
  if (!s) return null;

  const canonical = cleanBudgetBand(s);
  if (canonical) return canonical;

  // Largest number mentioned, treating a trailing "k" as thousands. For a range
  // ("$3,000–$5,000") the top of the range is what we bucket on.
  const nums = [...s.matchAll(/(\d[\d,]*\.?\d*)\s*(k)?/g)]
    .map((m) => {
      const n = parseFloat(m[1].replace(/,/g, ""));
      return m[2] ? n * 1000 : n;
    })
    .filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length) {
    let amount = Math.max(...nums);
    // "under / up to 1k" means below that figure — nudge it under the boundary.
    if (/\b(under|below|less than|up to|max)\b/.test(s)) amount -= 1;
    // Band edges are inclusive of the upper label ("$1k–$5k" covers up to 5k).
    if (amount < 1000) return "under_1k";
    if (amount <= 5000) return "1k_5k";
    if (amount <= 15000) return "5k_15k";
    return "15k_plus";
  }

  if (/not sure|unsure|unknown|tbd|n\/?a|flexible/.test(s)) return "unsure";
  return null;
}

// Map an arbitrary timeline/urgency cell to a key.
export function mapTimeline(raw) {
  if (raw == null) return null;
  const s = String(raw).toLowerCase().trim();
  if (!s) return null;

  const canonical = cleanTimeline(s);
  if (canonical) return canonical;

  if (/asap|urgent|immediate|emergency|right away|now\b|today|this week/.test(s))
    return "asap";
  if (/\b1?\s*-?\s*2\s*weeks?\b|two weeks|fortnight|next week|couple weeks/.test(s))
    return "2_weeks";
  if (/month|quarter|1\s*-\s*3|few months|spring|summer|fall|winter|season/.test(s))
    return "1_3_months";
  if (/explor|research|browsing|just looking|future|someday|no rush|planning|eventually/.test(s))
    return "exploring";
  return null;
}

// Normalise one raw CSV row (already header-keyed by the client) into the shape
// createScoredLead expects. Header variants are matched leniently.
export function normaliseLeadRow(row) {
  const pick = (...keys) => {
    for (const k of keys) {
      const v = row[k] ?? row[k?.toLowerCase?.()] ?? row[k?.toUpperCase?.()];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };
  const name = pick("name", "Name", "Full Name", "full_name", "contact", "Contact");
  const email = pick("email", "Email", "e-mail", "E-mail");
  const phone = pick("phone", "Phone", "Phone Number", "phone_number", "mobile", "Mobile", "tel");
  const message = pick("message", "Message", "notes", "Notes", "details", "Details", "description", "comments", "Comments");
  const budgetBand = mapBudget(pick("budget", "Budget", "budget_band", "price", "Price"));
  const timeline = mapTimeline(pick("timeline", "Timeline", "urgency", "Urgency", "when", "When", "timeframe"));
  return { name, email, phone, message, budgetBand, timeline };
}
