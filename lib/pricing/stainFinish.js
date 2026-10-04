// lib/pricing/stainFinish.js
//
// Which STAIN a cabinet or stair job is quoted with — gel or liquid — and the
// words a line says about it.
//
// ── Why (owner, 2026-10-03) ─────────────────────────────────────────────────
//
// "If it is relevant for stain it should have gel or liquid." The two are
// different jobs, not two colours of one job:
//
//   liquid  a penetrating stain. It soaks INTO bare wood, so whatever finish
//           is on the wood now — paint, varnish, lacquer — has to come off
//           first. On maple, birch, cherry and pine it soaks in unevenly
//           (blotching) unless the wood is conditioned.
//   gel     a thickened stain that SITS ON the surface. It goes over the old
//           finish after a clean and a light scuff-sand — no stripping — and
//           does not blotch. It is slower per piece: wiped or brushed by hand,
//           often two or three coats for depth, with long recoat times over an
//           existing finish (General Finishes asks 72 h).
//
// Sources, read 2026-10-03: Bob Vila, "Gel Stain" (2019-11-18); General
// Finishes FAQ on gel stain over existing finishes; Angi gel-stain cabinet
// pricing (search summary — the page refused our fetch); Fixr cabinet painting
// (2026-01-27). Prices are in app/data/tradePriceBooks.js beside each figure.
//
// ── Absent means liquid, on purpose ─────────────────────────────────────────
//
// Every stain line written before this existed was the liquid one — the
// cabinet stain add-on said "strip the existing finish to bare wood", and a
// stair refinish sands the treads to bare wood — so a group with no
// `stainType` reads as liquid and prices and prints exactly as it did.
//
// Pure: no React, no database. scripts/check-stain-finish.mjs executes it.

export const STAIN_TYPES = Object.freeze(["liquid", "gel"]);

/** "liquid" | "gel" for a stored or posted value; absent or junk is liquid. */
export function normaliseStainType(value) {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return v === "gel" ? "gel" : "liquid";
}

/** Was a stain type actually CHOSEN (as opposed to the liquid an absence reads as)? */
export function stainTypeChosen(value) {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return STAIN_TYPES.includes(v);
}

// What a stair line says about the stain, by document language (non-
// negotiable 6). English and French, the same two the cabinet add-on table
// carries (lib/pricing/tradeScope.js CABINET_ADDON_TEXT); any other language
// gets English, the same fallback that table uses.
const STAIR_STAIN_TEXT = {
  en: {
    liquid: "Penetrating (liquid) stain on bare wood, sealed with clear coats.",
    gel: "Gel stain over the existing finish after a clean and light scuff-sand, sealed with clear coats.",
  },
  fr: {
    liquid: "Teinture pénétrante (liquide) sur bois nu, scellée au vernis.",
    gel: "Teinture en gel sur le fini existant après nettoyage et léger égrenage, scellée au vernis.",
  },
};

/** The sentence a staircase's treads line carries for a chosen stain type. */
export function stairStainText(stainType, language) {
  const l = String(language || "").trim().toLowerCase();
  const table = l === "fr" || l.startsWith("fr-") ? STAIR_STAIN_TEXT.fr : STAIR_STAIN_TEXT.en;
  return table[normaliseStainType(stainType)];
}
