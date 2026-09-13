// lib/demo/people.js
//
// The fictional people in a demo, and the arithmetic that keeps them fictional.
//
// ══ Three rules, each enforced by scripts/check-demo-content.mjs ══════════
//
//   1. Every phone number is in the 555-01xx block. NANP reserves 555-0100
//      through 555-0199 for fiction; nothing else is ever dialled by a demo
//      that "texts the client" — lib/sms/demoSms.js substitutes the send, but
//      the number itself must also be one nobody owns.
//   2. Every email is on example.com (RFC 2606). A rep who presses "Send
//      quote" in a demo sends to an address that cannot deliver.
//   3. Names come from the pools below, never from a customer table. The
//      check asserts no seeded name appears in any real-tenant fixture it can
//      read.
//
// ══ Deterministic, not random ═════════════════════════════════════════════
//
// A demo seeded on Monday and re-seeded on Tuesday must produce the same
// Sophie Dubois at the same address — the help-centre screenshots and the
// owner's product videos are photographed around these names. So "random" is
// a seeded PRNG keyed by the trade, and every pick is a function of the trade
// and the position in the sequence, never of the clock or the row order in
// the database.

/** mulberry32 — tiny, seedable, good enough for picking names. */
export function rng(seed) {
  let a = hashSeed(seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed) {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const pick = (random, list) => list[Math.floor(random() * list.length)];
export const between = (random, min, max) => min + Math.floor(random() * (max - min + 1));

// ── Name pools ─────────────────────────────────────────────────────────────

const FIRST = {
  fr: ["Sophie", "Marc", "Julie", "Étienne", "Camille", "Mathieu", "Isabelle", "Nicolas", "Geneviève", "Olivier", "Catherine", "Simon", "Véronique", "Philippe", "Nathalie", "Guillaume", "Mélanie", "Sébastien", "Josée", "Alexandre", "Chantal", "Maxime", "Amélie", "François"],
  en: ["Sarah", "David", "Emily", "James", "Hannah", "Michael", "Rachel", "Andrew", "Laura", "Ryan", "Megan", "Kevin", "Jessica", "Brian", "Ashley", "Daniel", "Nicole", "Matthew", "Karen", "Chris", "Priya", "Omar", "Grace", "Liam"],
  es: ["María", "Carlos", "Lucía", "José", "Ana", "Miguel", "Sofía", "Luis", "Elena", "Diego", "Valentina", "Javier"],
};

const LAST = {
  fr: ["Tremblay", "Gagnon", "Roy", "Côté", "Bouchard", "Gauthier", "Morin", "Lavoie", "Fortin", "Gagné", "Ouellet", "Pelletier", "Bélanger", "Lévesque", "Bergeron", "Leblanc", "Paquette", "Girard", "Simard", "Boucher", "Caron", "Beaulieu", "Cloutier", "Dubois"],
  en: ["Mitchell", "Chen", "Patel", "Wilson", "Nguyen", "Campbell", "Thompson", "Kim", "Morrison", "Walsh", "Ahmed", "Fraser", "Okafor", "Reid", "Stewart", "Murphy", "Singh", "Baker", "Kowalski", "Hughes", "Brooks", "Nair", "Grant", "Doyle"],
  es: ["García", "Rodríguez", "Martínez", "Hernández", "López", "González", "Pérez", "Sánchez", "Ramírez", "Torres", "Flores", "Rivera"],
};

/** A fictional person in the given language, with the initials the seed keys emails on. */
export function person(random, lang = "en") {
  const l = FIRST[lang] ? lang : "en";
  return { firstName: pick(random, FIRST[l]), lastName: pick(random, LAST[l]), language: l };
}

/** A fictional business client, with a contact. */
const BUSINESS = {
  fr: ["Gestion immobilière Lachance", "Clinique dentaire du Parc", "Boulangerie Le Fournil", "Condos Les Terrasses (syndicat)", "Garderie Les Petits Pas", "Restaurant Chez Mado"],
  en: ["Riverside Property Management", "Maple Leaf Dental", "Northgate Realty Group", "The Corner Bakery", "Harbourview Condominium Corp.", "Lakeside Veterinary Clinic"],
  es: ["Taquería El Sol", "Inmobiliaria Torres"],
};
export function business(random, lang = "en") {
  const l = BUSINESS[lang] ? lang : "en";
  return pick(random, BUSINESS[l]);
}

// ── Contact details that cannot reach anyone ────────────────────────────────

/**
 * A 555-01xx number in the demo's own area code, one per position, so no two
 * clients share one. Formatted the way the app formats a stored number
 * ("+1 450 555 0147"); lib/sms/demoSms.js never dials it anyway.
 */
export function fictionalPhone(area, n) {
  const line = 100 + (Math.abs(Math.trunc(n)) % 100);
  return `+1 ${area} 555 ${String(line).padStart(4, "0")}`;
}

/** The regex the check applies to every phone the seed writes. */
export const FICTIONAL_PHONE = /^\+1 \d{3} 555 01\d{2}$/;

/** first.last@example.com, ASCII-folded so the address is typeable. */
export function fictionalEmail(firstName, lastName, domain = "example.com") {
  const fold = (s) =>
    String(s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  return `${fold(firstName)}.${fold(lastName)}@${domain}`;
}

export const EXAMPLE_EMAIL = /@([a-z0-9-]+\.)*example\.com$/i;

/** A postal code inside a Canadian FSA, or the US ZIP as-is. */
export function postalFor(random, fsa) {
  if (/^\d{5}$/.test(fsa)) return fsa;
  const letters = "ABCEGHJKLMNPRSTVWXYZ";
  return `${fsa} ${between(random, 0, 9)}${letters[between(random, 0, letters.length - 1)]}${between(random, 0, 9)}`;
}

/** A real street with a plausible number. */
export function addressFor(random, streets) {
  const s = pick(random, streets);
  const number = between(random, s.min, s.max);
  // French street names read "88 rue des Érables"; English ones "88 Bank Street".
  return { line1: `${number} ${s.name}`, postalCode: postalFor(random, s.fsa) };
}

// ── The staff, per trade ───────────────────────────────────────────────────
//
// Owner, estimator, dispatcher, then crew. The cabinets roster is the one
// the help-centre harness photographs (docs/screens/app-guide/harness/
// fixtures/company.js) — same six names, same order, same phone suffixes —
// so a screenshot in the guide and the live demo the owner records show the
// same people. Quebec rosters mix francophone and anglophone names; the two
// US demos mix in Spanish ones, as their trades do.
//
// `role` is the stored Member tier; `preset` is the permissions grid
// (lib/permissions PERMISSION_PRESETS) that names them on Manage Team.
export const STAFF = {
  painting: [
    { firstName: "Andrew", lastName: "Morrison", role: "owner", preset: null, rate: 0 },
    { firstName: "Priya", lastName: "Nair", role: "employee", preset: "estimator", rate: 34 },
    { firstName: "Kevin", lastName: "Walsh", role: "supervisor", preset: "dispatcher", rate: 30 },
    { firstName: "Étienne", lastName: "Gauthier", role: "employee", preset: "worker", rate: 28 },
    { firstName: "Megan", lastName: "Fraser", role: "employee", preset: "worker", rate: 26 },
    { firstName: "Omar", lastName: "Ahmed", role: "employee", preset: "worker", rate: 25 },
    { firstName: "Liam", lastName: "Reid", role: "employee", preset: "worker", rate: 22 },
  ],
  cabinets: [
    { firstName: "Marc", lastName: "Tremblay", role: "owner", preset: null, rate: 0 },
    { firstName: "Julie", lastName: "Gagnon", role: "supervisor", preset: "manager", rate: 36 },
    { firstName: "Samuel", lastName: "Roy", role: "employee", preset: "estimator", rate: 32 },
    { firstName: "Daniel", lastName: "Côté", role: "supervisor", preset: "dispatcher", rate: 30 },
    { firstName: "Léo", lastName: "Bouchard", role: "employee", preset: "worker", rate: 27 },
    { firstName: "Ana", lastName: "Pereira", role: "employee", preset: "worker", rate: 26 },
    { firstName: "Mathieu", lastName: "Lavoie", role: "employee", preset: "worker", rate: 24 },
  ],
  flooring: [
    { firstName: "Geneviève", lastName: "Fortin", role: "owner", preset: null, rate: 0 },
    { firstName: "Nicolas", lastName: "Pelletier", role: "employee", preset: "estimator", rate: 33 },
    { firstName: "Camille", lastName: "Bergeron", role: "supervisor", preset: "dispatcher", rate: 29 },
    { firstName: "Olivier", lastName: "Simard", role: "employee", preset: "worker", rate: 28 },
    { firstName: "James", lastName: "Campbell", role: "employee", preset: "worker", rate: 27 },
    { firstName: "Sébastien", lastName: "Caron", role: "employee", preset: "worker", rate: 25 },
  ],
  landscaping: [
    { firstName: "Ryan", lastName: "Thompson", role: "owner", preset: null, rate: 0 },
    { firstName: "Hannah", lastName: "Stewart", role: "employee", preset: "estimator", rate: 30 },
    { firstName: "Chris", lastName: "Doyle", role: "supervisor", preset: "dispatcher", rate: 28 },
    { firstName: "Daniel", lastName: "Okafor", role: "employee", preset: "worker", rate: 24 },
    { firstName: "Ashley", lastName: "Brooks", role: "employee", preset: "worker", rate: 22 },
    { firstName: "Matthew", lastName: "Hughes", role: "employee", preset: "worker", rate: 21 },
    { firstName: "Grace", lastName: "Murphy", role: "employee", preset: "worker", rate: 20 },
  ],
  cleaning: [
    { firstName: "Isabelle", lastName: "Morin", role: "owner", preset: null, rate: 0 },
    { firstName: "Rachel", lastName: "Kim", role: "employee", preset: "estimator", rate: 27 },
    { firstName: "Philippe", lastName: "Ouellet", role: "supervisor", preset: "dispatcher", rate: 26 },
    { firstName: "Nathalie", lastName: "Leblanc", role: "employee", preset: "worker", rate: 21 },
    { firstName: "Jessica", lastName: "Wilson", role: "employee", preset: "worker", rate: 20 },
    { firstName: "Mélanie", lastName: "Girard", role: "employee", preset: "worker", rate: 20 },
    { firstName: "Karen", lastName: "Baker", role: "employee", preset: "worker", rate: 19 },
  ],
  plumbing: [
    { firstName: "Michael", lastName: "Grant", role: "owner", preset: null, rate: 0 },
    { firstName: "Laura", lastName: "Mitchell", role: "employee", preset: "estimator", rate: 38 },
    { firstName: "Brian", lastName: "Kowalski", role: "supervisor", preset: "dispatcher", rate: 32 },
    { firstName: "Andrew", lastName: "Singh", role: "employee", preset: "worker", rate: 41 },
    { firstName: "Nicole", lastName: "Chen", role: "employee", preset: "worker", rate: 36 },
    { firstName: "Kevin", lastName: "Patel", role: "employee", preset: "worker", rate: 29 },
  ],
  hvac: [
    { firstName: "Carlos", lastName: "Ramírez", role: "owner", preset: null, rate: 0 },
    { firstName: "Emily", lastName: "Baker", role: "employee", preset: "estimator", rate: 34 },
    { firstName: "Luis", lastName: "Torres", role: "supervisor", preset: "dispatcher", rate: 30 },
    { firstName: "David", lastName: "Nguyen", role: "employee", preset: "worker", rate: 38 },
    { firstName: "Miguel", lastName: "Flores", role: "employee", preset: "worker", rate: 33 },
    { firstName: "Ryan", lastName: "Hughes", role: "employee", preset: "worker", rate: 27 },
  ],
  roofing: [
    { firstName: "James", lastName: "Stewart", role: "owner", preset: null, rate: 0 },
    { firstName: "Sofía", lastName: "Hernández", role: "employee", preset: "estimator", rate: 32 },
    { firstName: "Megan", lastName: "Reid", role: "supervisor", preset: "dispatcher", rate: 29 },
    { firstName: "Diego", lastName: "Martínez", role: "employee", preset: "worker", rate: 31 },
    { firstName: "Brian", lastName: "Doyle", role: "employee", preset: "worker", rate: 28 },
    { firstName: "Javier", lastName: "López", role: "employee", preset: "worker", rate: 26 },
    { firstName: "Chris", lastName: "Brooks", role: "employee", preset: "worker", rate: 24 },
  ],
  electrical: [
    { firstName: "François", lastName: "Beaulieu", role: "owner", preset: null, rate: 0 },
    { firstName: "Véronique", lastName: "Cloutier", role: "employee", preset: "estimator", rate: 40 },
    { firstName: "Simon", lastName: "Boucher", role: "supervisor", preset: "dispatcher", rate: 31 },
    { firstName: "Alexandre", lastName: "Paquette", role: "employee", preset: "worker", rate: 42 },
    { firstName: "Josée", lastName: "Lévesque", role: "employee", preset: "worker", rate: 39 },
    { firstName: "Grace", lastName: "Kim", role: "employee", preset: "worker", rate: 30 },
  ],
  handyman: [
    { firstName: "Matthew", lastName: "Wilson", role: "owner", preset: null, rate: 0 },
    { firstName: "Sarah", lastName: "Campbell", role: "employee", preset: "estimator", rate: 30 },
    { firstName: "Omar", lastName: "Patel", role: "supervisor", preset: "dispatcher", rate: 27 },
    { firstName: "Liam", lastName: "Murphy", role: "employee", preset: "worker", rate: 29 },
    { firstName: "Priya", lastName: "Singh", role: "employee", preset: "worker", rate: 26 },
    { firstName: "Daniel", lastName: "Fraser", role: "employee", preset: "worker", rate: 24 },
  ],
};

export function staffFor(trade) {
  return STAFF[trade] || STAFF.painting;
}

/** Every first/last name the seed can ever write — the check reads it. */
export function allSeedNames() {
  const out = new Set();
  for (const roster of Object.values(STAFF)) for (const p of roster) out.add(`${p.firstName} ${p.lastName}`);
  return out;
}
