// app/data/standardAddOns.fr.js
//
// The standard add-ons of app/data/standardAddOns.js — in French.
//
// ── Why a parallel file, and why it is keyed by the English name ───────────
//
// Product.translations has said since it was declared that "standard add-ons
// ship with hand-written translations (app/data/standardAddOns.js)". They did
// not: seeding wrote the English name and description and nothing under
// `translations`, and nothing read `translations` anyway. A French quote that
// picked "Soft-Close Hinges" from Products & Services got "Soft-Close Hinges",
// in English, on a document headed DEVIS.
//
// This file is that promise kept, in the shape lib/documents/serviceContent.fr.js
// set: a static catalogue, resolved at CREATION of the line by the quote's own
// fixed language (lib/quotes/lineDetail.js → resolveProductText), never at
// send time and never by the viewer's browser — AGENTS.md non-negotiable 6.
//
// Keyed by the English NAME rather than by category, because that is how the
// seeded Product row is found again: a company seeded before this file existed
// has a row called "Soft-Close Hinges" and nothing else to match on
// (scripts/backfill-product-descriptions.mjs). Two categories that share a
// name ("Two-Tone Finish" on cabinets and on stairs) therefore share one
// French sentence, and each is written to fit both.
//
// Same rules as the English: what is done, per what unit. No price, no brand,
// no promise about who supplies what beyond what the English already says.

export const STANDARD_ADDONS_FR = {
  "New Handles — supply & install": {
    name: "Nouvelles poignées — fourniture et pose",
    description: "Perçage et pose des nouvelles poignées, par trou.",
  },
  "Soft-Close Hinges": {
    name: "Charnières à fermeture douce",
    description: "Pose de charnières à fermeture douce, par porte.",
  },
  "Soft-Close Drawer Slides": {
    name: "Coulisses de tiroir à fermeture douce",
    description:
      "Pose de coulisses de tiroir à extension complète et fermeture douce, par tiroir.",
  },
  "Two-Tone Finish": {
    name: "Fini deux tons",
    description:
      "Deuxième couleur — masquage, mise en place et cycles de pulvérisation supplémentaires.",
  },
  "Glass Inserts": {
    name: "Inserts en verre",
    description: "Préparation des portes pour recevoir des inserts en verre, par porte.",
  },
  "New Painted MDF Doors": {
    name: "Nouvelles portes en MDF peintes",
    description: "Nouvelles portes en MDF prêtes à peindre, par porte.",
  },
  "Thermofoil / Vinyl-Wrapped Doors": {
    name: "Portes en thermoplastique / vinyle",
    description: "Nouvelles portes en MDF recouvertes de thermoplastique ou de vinyle, par porte.",
  },
  "Cabinet Box Skinning — veneer/laminate": {
    name: "Habillage des caissons — placage/stratifié",
    description: "Recouvrement des faces visibles des caissons en placage ou stratifié.",
  },
  "Crown Moulding": {
    name: "Moulure couronnée",
    description: "Fourniture et pose de moulure couronnée, par pied linéaire.",
  },
  "Under-Cabinet LED Lighting": {
    name: "Éclairage DEL sous les armoires",
    description: "Éclairage DEL installé sous les armoires, par pied linéaire.",
  },
  "Pull-Out Shelf": {
    name: "Tablette coulissante",
    description: "Fourniture et pose d'une tablette coulissante.",
  },
  "Countertop Supply & Installation": {
    name: "Comptoir — fourniture et installation",
    description:
      "Fourniture et installation du comptoir. L'installation est comprise dans le prix de la dalle par le fabricant; elle n'apparaît donc pas sur une ligne distincte.",
  },
  Backsplash: {
    name: "Dosseret",
    description: "Dosseret assorti — hauteur choisie sur le devis.",
  },
  "Sink / Undermount Cutout": {
    name: "Découpe d'évier / sous-plan",
    description: "Découpe et polissage de l'ouverture pour évier ou sous-plan.",
  },
  "Waterfall Edge": {
    name: "Bord en cascade",
    description: "Fabrication et pose d'un bord en cascade.",
  },
  "Countertop Removal": {
    name: "Retrait des comptoirs",
    description: "Retrait des comptoirs existants.",
  },
  "Disposal Fee": {
    name: "Frais de disposition",
    description: "Transport et disposition des anciens comptoirs.",
  },
  "Travel Fee": {
    name: "Frais de déplacement",
    description: "Déplacement en dehors de la zone de service habituelle.",
  },
  "Stair Treads — refinishing": {
    name: "Marches — refinition",
    description: "Sablage, teinture et finition de chaque marche.",
  },
  "Risers — painting": {
    name: "Contremarches — peinture",
    description: "Préparation et peinture de chaque contremarche.",
  },
  "Balusters / Spindles — painting": {
    name: "Barreaux / fuseaux — peinture",
    description: "Préparation et peinture de chaque barreau ou fuseau.",
  },
  "Newel Posts — painting": {
    name: "Poteaux de départ — peinture",
    description: "Préparation et peinture de chaque poteau de départ.",
  },
  "Handrail — refinishing": {
    name: "Main courante — refinition",
    description: "Sablage, teinture et finition de la main courante, par pied linéaire.",
  },
  "Landing / Hallway — refinishing": {
    name: "Palier / couloir — refinition",
    description: "Refinition du plancher du palier ou du couloir attenant, par pied carré.",
  },
};

/**
 * The `Product.translations` value to store for a standard add-on, or null
 * when this file has nothing for that name. Null rather than `{}` so the
 * seed and the backfill can tell "no French" from "French, empty".
 */
export function standardAddOnTranslations(name) {
  const fr = STANDARD_ADDONS_FR[name];
  return fr ? { fr: { name: fr.name, description: fr.description } } : null;
}
