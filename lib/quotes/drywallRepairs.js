// lib/quotes/drywallRepairs.js
//
// Drywall REPAIRS as fixed-price items — the drywall group's Repairs panel.
//
// ── Why (owner, 2026-10-03) ─────────────────────────────────────────────────
//
// "Drywall repairs are not the room calculator." A drywall quote opened on
// square footage and ceiling height — the questions for hanging a room — and
// a patch call is nothing like that: a doorknob hole is a price, a fist hole
// is a bigger price, a kicked-in sheet is a sheet. So plain `drywall` offers
// its repairs the way the trade sells them: pick the repair, get its price,
// as one ordinary line. `drywall_install` (the per-level hang and finish book,
// lib/quotes/drywallFinishLine.js) is untouched.
//
// ── The mechanism, and the two it was chosen over ───────────────────────────
//
// The repair book staged in app/data/priceBooks/interior.js, made live in
// app/data/tradePriceBooks.js (by reference) — because it already had the
// rows, the tiers and the rate-card fields, so a company edits these prices
// on Settings › Services like every other book and a company that edited one
// keeps it (getPriceBook merges its overrides). Rejected:
//
//   - the products catalogue (seeded Product rows): every existing drywall
//     company would have to press "Add standard items" to see a single repair,
//     and the prices would fork from the book the day either was edited;
//   - a unit-priced service (cabinet-style units × one rate): a patch and a
//     sheet are not the same unit at different counts.
//
// ── What a pick writes ──────────────────────────────────────────────────────
//
// One line — description in the DOCUMENT's language (non-negotiable 6),
// quantity 1, the item's unit, the book's rate at the chosen tier — tagged
// `meta.drywallRepair` so the panel can count what it added. The line is then
// the estimator's: quantity and rate are edited in the table like any line,
// it is stored as written, and nothing re-derives it. A stored quote never
// moves because the book did.
//
// The book's `callOutMinimum` is the one figure that is not an item: when the
// repair lines come to less, the panel says so and offers the difference as a
// "Minimum service charge" line. It is never added silently.
//
// Pure: no React, no database — scripts/check-estimate-kind-routing.mjs
// executes it.

import { normaliseDrywallTier } from "@/app/data/drywallFinishLevels";

export const DRYWALL_REPAIR_TRADE = "drywall";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(num(n) * 100) / 100;
const list = (v) => (Array.isArray(v) ? v : []);

// The three flat extras on the book, as items. Keys are the book's.
const EXTRAS = Object.freeze([
  { id: "return_visit", path: "returnVisitPrice", unit: "flat" },
  { id: "dust_containment", path: "dustContainmentPrice", unit: "flat" },
  { id: "furniture_moving", path: "furnitureMovingPrice", unit: "flat" },
]);

// Client-facing names, per language. English is the book's own label; a
// language with no entry gets English (the same rule as every catalogue).
const TEXT = {
  en: {
    small_patch: 'Drywall repair — small patch (nail pop, screw or doorknob hole, up to 6")',
    medium_patch: 'Drywall repair — medium patch (fist-size hole, 6" to 1 ft)',
    large_patch: "Drywall repair — large patch (up to 2 × 2 ft)",
    sheet_replace: "Drywall sheet replacement — 4 × 8, hung, taped and finished",
    texture_match: "Texture match over a patch",
    skim_coat: "Skim coat — Level 5",
    popcorn_removal: "Popcorn / stipple ceiling removal",
    corner_repair: "Corner bead replacement",
    nail_pops: "Nail / screw pops — refastened and refinished",
    return_visit: "Return visit — second coat",
    dust_containment: "Dust containment",
    furniture_moving: "Furniture moving and protection",
    minimum: "Minimum service charge",
  },
  fr: {
    small_patch: "Réparation de gypse — petite retouche (clou ressorti, trou de vis ou de poignée, jusqu'à 6 po)",
    medium_patch: "Réparation de gypse — retouche moyenne (trou de la taille d'un poing, 6 po à 1 pi)",
    large_patch: "Réparation de gypse — grande retouche (jusqu'à 2 × 2 pi)",
    sheet_replace: "Remplacement d'une feuille de gypse — 4 × 8, posée, tirée et finie",
    texture_match: "Reproduction de la texture sur une retouche",
    skim_coat: "Enduit pelliculaire — niveau 5",
    popcorn_removal: "Enlèvement de plafond texturé (popcorn)",
    corner_repair: "Remplacement de cornière",
    nail_pops: "Clous et vis ressortis — refixés et refinis",
    return_visit: "Visite de retour — deuxième couche",
    dust_containment: "Confinement de la poussière",
    furniture_moving: "Déplacement et protection des meubles",
    minimum: "Frais de service minimum",
  },
  es: {
    small_patch: "Reparación de panel de yeso — parche pequeño (clavo saltado, agujero de tornillo o de perilla, hasta 6 pulg.)",
    medium_patch: "Reparación de panel de yeso — parche mediano (agujero del tamaño de un puño, 6 pulg. a 1 pie)",
    large_patch: "Reparación de panel de yeso — parche grande (hasta 2 × 2 pies)",
    sheet_replace: "Reemplazo de una lámina de panel de yeso — 4 × 8, colocada, encintada y terminada",
    texture_match: "Igualación de textura sobre un parche",
    skim_coat: "Capa fina de enlucido — nivel 5",
    popcorn_removal: "Retiro de techo de palomitas (popcorn)",
    corner_repair: "Reemplazo de esquinero",
    nail_pops: "Clavos y tornillos saltados — refijados y terminados",
    return_visit: "Visita de regreso — segunda capa",
    dust_containment: "Contención de polvo",
    furniture_moving: "Movimiento y protección de muebles",
    minimum: "Cargo mínimo de servicio",
  },
  it: {
    small_patch: "Riparazione cartongesso — toppa piccola (chiodo sporgente, foro di vite o di maniglia, fino a 6\")",
    medium_patch: "Riparazione cartongesso — toppa media (foro grande come un pugno, da 6\" a 1 piede)",
    large_patch: "Riparazione cartongesso — toppa grande (fino a 2 × 2 piedi)",
    sheet_replace: "Sostituzione di una lastra di cartongesso — 4 × 8, posata, stuccata e rifinita",
    texture_match: "Riproduzione della texture sulla toppa",
    skim_coat: "Rasatura completa — livello 5",
    popcorn_removal: "Rimozione del soffitto a buccia d'arancia (popcorn)",
    corner_repair: "Sostituzione del paraspigolo",
    nail_pops: "Chiodi e viti sporgenti — rifissati e rifiniti",
    return_visit: "Seconda visita — seconda mano",
    dust_containment: "Contenimento della polvere",
    furniture_moving: "Spostamento e protezione dei mobili",
    minimum: "Costo minimo di intervento",
  },
  de: {
    small_patch: "Trockenbau-Reparatur — kleine Stelle (herausstehender Nagel, Schrauben- oder Türklinkenloch, bis 6\")",
    medium_patch: "Trockenbau-Reparatur — mittlere Stelle (faustgroßes Loch, 6\" bis 1 Fuß)",
    large_patch: "Trockenbau-Reparatur — große Stelle (bis 2 × 2 Fuß)",
    sheet_replace: "Austausch einer Gipskartonplatte — 4 × 8, montiert, gespachtelt und geschliffen",
    texture_match: "Struktur über der Reparaturstelle angeglichen",
    skim_coat: "Vollflächige Spachtelung — Stufe 5",
    popcorn_removal: "Entfernen von Rauputz an der Decke (Popcorn)",
    corner_repair: "Austausch des Kantenschutzprofils",
    nail_pops: "Herausstehende Nägel und Schrauben — neu befestigt und überarbeitet",
    return_visit: "Zweiter Termin — zweite Schicht",
    dust_containment: "Staubschutz",
    furniture_moving: "Möbel rücken und abdecken",
    minimum: "Mindestauftragswert",
  },
  uk: {
    small_patch: "Ремонт гіпсокартону — мала латка (вилізлий цвях, отвір від шурупа чи дверної ручки, до 6\")",
    medium_patch: "Ремонт гіпсокартону — середня латка (отвір завбільшки з кулак, від 6\" до 1 фута)",
    large_patch: "Ремонт гіпсокартону — велика латка (до 2 × 2 фути)",
    sheet_replace: "Заміна листа гіпсокартону — 4 × 8, змонтований, зашпакльований і оброблений",
    texture_match: "Відтворення фактури на латці",
    skim_coat: "Суцільне шпаклювання — рівень 5",
    popcorn_removal: "Зняття фактурного покриття стелі (popcorn)",
    corner_repair: "Заміна кутового профілю",
    nail_pops: "Вилізлі цвяхи й шурупи — закріплені й оброблені",
    return_visit: "Повторний візит — другий шар",
    dust_containment: "Захист від пилу",
    furniture_moving: "Перенесення й захист меблів",
    minimum: "Мінімальна плата за виклик",
  },
  pa: {
    small_patch: "ਡ੍ਰਾਈਵਾਲ ਮੁਰੰਮਤ — ਛੋਟਾ ਪੈਚ (ਨਿਕਲਿਆ ਕਿੱਲ, ਪੇਚ ਜਾਂ ਦਰਵਾਜ਼ੇ ਦੇ ਹੈਂਡਲ ਦਾ ਮੋਰਾ, 6\" ਤੱਕ)",
    medium_patch: "ਡ੍ਰਾਈਵਾਲ ਮੁਰੰਮਤ — ਦਰਮਿਆਨਾ ਪੈਚ (ਮੁੱਠੀ ਜਿੰਨਾ ਮੋਰਾ, 6\" ਤੋਂ 1 ਫੁੱਟ)",
    large_patch: "ਡ੍ਰਾਈਵਾਲ ਮੁਰੰਮਤ — ਵੱਡਾ ਪੈਚ (2 × 2 ਫੁੱਟ ਤੱਕ)",
    sheet_replace: "ਡ੍ਰਾਈਵਾਲ ਸ਼ੀਟ ਬਦਲੀ — 4 × 8, ਲਗਾਈ, ਟੇਪ ਕੀਤੀ ਅਤੇ ਮੁਕੰਮਲ",
    texture_match: "ਪੈਚ ਉੱਤੇ ਟੈਕਸਚਰ ਮਿਲਾਉਣਾ",
    skim_coat: "ਸਕਿਮ ਕੋਟ — ਲੈਵਲ 5",
    popcorn_removal: "ਪੌਪਕੌਰਨ ਛੱਤ ਹਟਾਉਣਾ",
    corner_repair: "ਕੋਨੇ ਦੀ ਬੀਡ ਬਦਲੀ",
    nail_pops: "ਨਿਕਲੇ ਕਿੱਲ ਅਤੇ ਪੇਚ — ਮੁੜ ਕੱਸੇ ਅਤੇ ਮੁਕੰਮਲ",
    return_visit: "ਦੂਜੀ ਫੇਰੀ — ਦੂਜਾ ਕੋਟ",
    dust_containment: "ਧੂੜ ਰੋਕਥਾਮ",
    furniture_moving: "ਫਰਨੀਚਰ ਹਿਲਾਉਣਾ ਅਤੇ ਢੱਕਣਾ",
    minimum: "ਘੱਟੋ-ਘੱਟ ਸੇਵਾ ਖਰਚਾ",
  },
  tl: {
    small_patch: "Pag-aayos ng drywall — maliit na patch (lumitaw na pako, butas ng turnilyo o seradura, hanggang 6\")",
    medium_patch: "Pag-aayos ng drywall — katamtamang patch (butas na kasinlaki ng kamao, 6\" hanggang 1 talampakan)",
    large_patch: "Pag-aayos ng drywall — malaking patch (hanggang 2 × 2 talampakan)",
    sheet_replace: "Pagpapalit ng isang sheet ng drywall — 4 × 8, ikinabit, tinapalan at tinapos",
    texture_match: "Pagtutugma ng texture sa patch",
    skim_coat: "Skim coat — Level 5",
    popcorn_removal: "Pagtanggal ng popcorn na kisame",
    corner_repair: "Pagpapalit ng corner bead",
    nail_pops: "Mga lumitaw na pako at turnilyo — ikinabit muli at tinapos",
    return_visit: "Pangalawang pagbisita — pangalawang patong",
    dust_containment: "Pagkontrol sa alikabok",
    furniture_moving: "Paglipat at pagtatakip ng muwebles",
    minimum: "Minimum na singil sa serbisyo",
  },
  zh: {
    small_patch: "石膏板修补 — 小补丁（钉子凸起、螺丝孔或门把手孔，6 英寸以内）",
    medium_patch: "石膏板修补 — 中补丁（拳头大小的洞，6 英寸至 1 英尺）",
    large_patch: "石膏板修补 — 大补丁（最大 2 × 2 英尺）",
    sheet_replace: "更换一张石膏板 — 4 × 8，安装、贴缝并收光",
    texture_match: "补丁处纹理匹配",
    skim_coat: "满批腻子 — 5 级",
    popcorn_removal: "清除爆米花吊顶",
    corner_repair: "更换护角条",
    nail_pops: "凸起的钉子和螺丝 — 重新固定并修饰",
    return_visit: "第二次上门 — 第二遍",
    dust_containment: "防尘隔离",
    furniture_moving: "家具搬移与保护",
    minimum: "最低服务费",
  },
};

const textFor = (language) => {
  const l = String(language || "").trim().toLowerCase().slice(0, 2);
  return Object.prototype.hasOwnProperty.call(TEXT, l) ? TEXT[l] : TEXT.en;
};

/** The words a repair item's line carries, in a document language. */
export function repairItemText(id, language) {
  return textFor(language)[id] || TEXT.en[id] || null;
}

/** Is this the drywall repair trade? */
export function isDrywallRepairTrade(categoryKey) {
  return categoryKey === DRYWALL_REPAIR_TRADE;
}

/**
 * Every repair item the company's merged book prices, at a tier, in book
 * order, then the three flat extras. Items priced at nothing (a company that
 * zeroed one) are left out: a button that adds $0 is not a repair.
 *
 * @returns [{ id, label, unit, rate, extra }]
 */
export function drywallRepairItems(book, tier = "standard") {
  if (!book || typeof book !== "object") return [];
  const level = normaliseDrywallTier(tier);
  const grid = book.complexity?.[level] || book.complexity?.standard || {};
  const out = [];
  for (const item of list(book.items)) {
    if (!item || typeof item.id !== "string") continue;
    const rate = item.priceType === "flat" ? num(item.flatPrice) : num(grid[item.priceType]);
    if (rate > 0) out.push({ id: item.id, label: String(item.label || item.id), unit: item.unit || "each", rate: round2(rate), extra: false });
  }
  for (const e of EXTRAS) {
    const rate = num(book.extras?.[e.path]);
    if (rate > 0) out.push({ id: e.id, label: TEXT.en[e.id], unit: e.unit, rate: round2(rate), extra: true });
  }
  return out;
}

/** The call-out minimum at a tier, or 0 when the book has none. */
export function drywallCallOutMinimum(book, tier = "standard") {
  const level = normaliseDrywallTier(tier);
  return round2(num((book?.complexity?.[level] || book?.complexity?.standard || {}).callOutMinimum));
}

/** The line one pick writes — see the header. */
export function drywallRepairLine(item, { language = "en" } = {}) {
  if (!item || typeof item.id !== "string" || !(num(item.rate) > 0)) return null;
  const rate = round2(item.rate);
  return {
    description: repairItemText(item.id, language) || item.label,
    quantity: 1,
    unit: item.unit || "each",
    rate,
    amount: rate,
    meta: { drywallRepair: { id: item.id } },
  };
}

/** Is this a line a repair pick (or the minimum top-up) wrote? */
export function isDrywallRepairLine(line) {
  return Boolean(line && typeof line === "object" && line.meta && line.meta.drywallRepair);
}

/**
 * The repair lines' total against the call-out minimum. `shortfall` is what a
 * "Minimum service charge" line would add — 0 when there are no repair lines
 * (nothing to top up yet), when the book has no minimum, or when the lines
 * already reach it. A top-up line already on the group counts toward the
 * total, so pressing it twice adds nothing the second time.
 */
export function drywallRepairShortfall(lines, minimum) {
  const repair = list(lines).filter(isDrywallRepairLine);
  const total = round2(repair.reduce((s, l) => s + num(l.amount), 0));
  const min = round2(minimum);
  const shortfall = repair.length && min > 0 && total < min ? round2(min - total) : 0;
  return { total, minimum: min, shortfall };
}

/** The top-up line for a shortfall, or null. */
export function drywallMinimumLine(shortfall, { language = "en" } = {}) {
  const amount = round2(shortfall);
  if (!(amount > 0)) return null;
  return {
    description: repairItemText("minimum", language),
    quantity: 1,
    unit: "flat",
    rate: amount,
    amount,
    meta: { drywallRepair: { id: "minimum" } },
  };
}
