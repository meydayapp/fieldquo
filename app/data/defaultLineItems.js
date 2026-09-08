// app/data/defaultLineItems.js
//
// The line items a trade almost always bills, offered as one tap.
//
// ── What this fixes ─────────────────────────────────────────────────────────
//
// Adding a countertop to a quote produced exactly one line: "Countertop", at
// the category's default rate. Every real countertop job also bills a
// backsplash, a sink cutout, removal of the old top, disposal, and often a
// waterfall edge or a travel fee. Those got typed by hand every single time,
// which means on a busy day they get forgotten — and a forgotten disposal fee
// is money the company already spent and won't recover.
//
// So each trade ships the extras it habitually bills, as chips inside the
// scope group. Nothing is added automatically: an unwanted line on a quote is
// worse than a missing one, because the client sees it. They're offers.
//
// ── Prices are deliberately absent ──────────────────────────────────────────
//
// `rate: null` on almost everything. A default disposal fee of $150 would be
// wrong in most of the country, and a wrong number on a document a client
// signs is worse than a blank one the contractor fills in. What's shipped is
// the LIST — knowing what to bill for is the hard part; knowing your own
// price isn't.
//
// Companies that want their own prices remembered use Products & Services
// (the Product model), which already feeds the same table from the dropdown
// beside these chips.
//
// ── `description` is the NAME; `detail` is the scope line ──────────────────
//
// The field names match the line item the builder writes, which is why the
// name sits under `description`. `detail` is the sentence printed under the
// name on the client's document and handed to the AI review beside it — what
// is done, per what unit, with no price and no promise the trade can't keep.
// Until it existed, a chip landed on the quote as a bare name and the review
// rightly reported the line as empty (lib/quotes/lineDetail.js has the story).
// It is copied onto the line at creation only; a line already on a quote is
// never rewritten. Every entry must carry one — scripts/check-addon-descriptions.mjs
// fails on a chip without a detail, including the electrical and plumbing
// catalogues merged in below.

import { ELECTRICAL_LINE_ITEMS } from "@/app/data/electricalCatalog";
import { PLUMBING_LINE_ITEMS } from "@/app/data/plumbingCatalog";

// unit values match what the builder writes onto a line item.
const FLAT = "flat";
const EACH = "each";
const SQFT = "sqft";
const LF = "linear_ft";

export const DEFAULT_LINE_ITEMS = {
  countertop: [
    {
      description: "Countertop supply & installation",
      unit: SQFT,
      detail: "Template, fabricate and install the countertop, per square foot.",
    },
    {
      description: "Backsplash",
      unit: LF,
      detail: "Matching backsplash cut and installed along the counter, per linear foot.",
    },
    {
      description: "Sink cutout (undermount)",
      unit: EACH,
      detail: "Cut and polish the undermount sink opening, per cutout.",
    },
    {
      description: "Cooktop cutout",
      unit: EACH,
      detail: "Cut the cooktop opening to the appliance template, per cutout.",
    },
    {
      description: "Waterfall edge",
      unit: EACH,
      detail: "Fabricate and install a mitred waterfall end panel, per edge.",
    },
    {
      description: "Edge profile upgrade",
      unit: LF,
      detail: "Upgraded edge profile machined along the exposed edge, per linear foot.",
    },
    {
      description: "Removal of existing countertop",
      unit: FLAT,
      detail: "Disconnect and remove the existing countertops before installation.",
    },
    {
      description: "Disposal fee",
      unit: FLAT,
      detail: "Haul away and dispose of the old countertops.",
    },
    {
      description: "Travel fee",
      unit: FLAT,
      detail: "Travel outside the standard service area, per visit.",
    },
  ],

  cabinet_refinishing: [
    {
      description: "New handle holes drilled in the doors",
      unit: EACH,
      detail: "Measure, mark and drill new handle holes in the doors and drawer fronts, per hole.",
    },
    {
      description: "Soft-close hinges — supply & install",
      unit: EACH,
      detail: "Supply and fit soft-close hinges in place of the existing hinges, per door.",
    },
    {
      description: "Two-tone finish (second colour)",
      unit: FLAT,
      detail: "Second colour on part of the kitchen — separate masking, staging and spray cycles.",
    },
    {
      description: "Cabinet interior painting",
      unit: FLAT,
      detail: "Prep and paint the inside of the cabinet boxes and shelves.",
    },
    {
      description: "Crown moulding — supply & install",
      unit: LF,
      detail: "Supply, cut and install crown moulding along the top of the cabinets, per linear foot.",
    },
    {
      description: "Toe kick replacement",
      unit: LF,
      detail: "Remove the existing toe kick and fit new finished toe kick, per linear foot.",
    },
  ],

  cabinet_refacing: [
    {
      description: "New door & drawer fronts",
      unit: EACH,
      detail: "Supply and hang new doors and drawer fronts, hinges adjusted, per piece.",
    },
    {
      description: "Soft-close hinges — supply & install",
      unit: EACH,
      detail: "Supply and fit soft-close hinges on the new doors, per door.",
    },
    {
      description: "Finished end panel",
      unit: EACH,
      detail: "Finished panel fitted to an exposed cabinet end, per panel.",
    },
    {
      description: "Filler strip",
      unit: EACH,
      detail: "Finished filler strip fitted between a cabinet and the wall or ceiling, per strip.",
    },
    {
      description: "Crown moulding — supply & install",
      unit: LF,
      detail: "Supply, cut and install crown moulding along the top of the cabinets, per linear foot.",
    },
  ],

  interior_painting: [
    {
      description: "Ceiling",
      unit: FLAT,
      detail: "Cut in and roll the ceilings in the rooms listed, two coats.",
    },
    {
      description: "Trim & baseboards",
      unit: FLAT,
      detail: "Prep, caulk and paint the trim and baseboards in the rooms listed.",
    },
    {
      description: "Doors",
      unit: EACH,
      detail: "Prep and paint both faces of each door and its frame, per door.",
    },
    {
      description: "Closet interior",
      unit: EACH,
      detail: "Prep and paint the walls, ceiling and shelving inside the closet, per closet.",
    },
    {
      description: "Popcorn / stipple ceiling removal",
      unit: SQFT,
      detail: "Scrape the textured ceiling, skim and sand smooth ready for paint, per square foot.",
    },
    {
      description: "Drywall repair & prep",
      unit: FLAT,
      detail: "Patch, tape and sand damaged drywall before painting.",
    },
    {
      description: "Furniture moving & protection",
      unit: FLAT,
      detail: "Move furniture away from the walls and cover it and the floors before work starts.",
    },
  ],

  exterior_painting: [
    {
      description: "Pressure washing",
      unit: FLAT,
      detail: "Pressure-wash the exterior surfaces to remove dirt, chalking and loose paint before painting.",
    },
    {
      description: "Trim & soffit",
      unit: SQFT,
      detail: "Prep and paint the exterior trim and soffits, per square foot.",
    },
    {
      description: "Fascia boards",
      unit: LF,
      detail: "Prep and paint the fascia boards, per linear foot.",
    },
    {
      description: "Front door",
      unit: EACH,
      detail: "Prep and paint the front door and its frame.",
    },
    {
      description: "Garage door",
      unit: EACH,
      detail: "Prep and paint the garage door and its frame, per door.",
    },
    {
      description: "Shutters",
      unit: EACH,
      detail: "Remove, prep, paint and re-hang the shutters, per shutter.",
    },
    {
      description: "Prime coat",
      unit: SQFT,
      detail: "Primer applied to bare or repaired areas before the finish coats, per square foot.",
    },
  ],

  flooring: [
    {
      description: "Stain colour change",
      unit: SQFT,
      detail: "Sand to bare wood and apply the new stain colour before finishing, per square foot.",
    },
    {
      description: "Water damage repair",
      unit: FLAT,
      detail: "Cut out and replace the water-damaged boards, then blend into the surrounding floor.",
    },
    {
      description: "Gap filling",
      unit: SQFT,
      detail: "Fill the gaps between boards before sanding and finishing, per square foot.",
    },
    {
      description: "Furniture moving",
      unit: FLAT,
      detail: "Move furniture out of the rooms being floored and back when the work is done.",
    },
    {
      description: "Stair blending",
      unit: FLAT,
      detail: "Sand and finish the adjoining stair treads to match the new floor.",
    },
    {
      description: "Quarter round / shoe moulding",
      unit: LF,
      detail: "Supply, cut and install quarter round or shoe moulding along the walls, per linear foot.",
    },
  ],

  stairs: [
    {
      description: "Risers",
      unit: EACH,
      detail: "Prep and paint each riser.",
    },
    {
      description: "Balusters / spindles",
      unit: EACH,
      detail: "Prep and paint each baluster or spindle.",
    },
    {
      description: "Newel posts",
      unit: EACH,
      detail: "Prep and paint each newel post.",
    },
    {
      description: "Handrail",
      unit: LF,
      detail: "Sand, stain and finish the handrail, per linear foot.",
    },
    {
      description: "Landing",
      unit: SQFT,
      detail: "Refinish the landing floor to match the treads, per square foot.",
    },
    {
      description: "Two-tone finish",
      unit: FLAT,
      detail: "Second colour on the staircase — separate masking, staging and spray cycles.",
    },
  ],

  roofing_service: [
    {
      description: "Tear-off & disposal",
      unit: SQFT,
      detail: "Strip the existing roofing to the deck and dispose of it, per square foot.",
    },
    {
      description: "Decking replacement",
      unit: SQFT,
      detail: "Replace rotten or delaminated roof decking found on tear-off, per square foot.",
    },
    {
      description: "Ice & water shield",
      unit: LF,
      detail: "Self-adhering ice and water membrane along the eaves and valleys, per linear foot.",
    },
    {
      description: "Drip edge",
      unit: LF,
      detail: "Metal drip edge installed along the eaves and rakes, per linear foot.",
    },
    {
      description: "Ridge vent",
      unit: LF,
      detail: "Cut the ridge and install continuous ridge venting, per linear foot.",
    },
    {
      description: "Chimney flashing",
      unit: EACH,
      detail: "Remove and replace the step and counter flashing around the chimney.",
    },
    {
      description: "Skylight flashing",
      unit: EACH,
      detail: "Remove and replace the flashing kit around the skylight, per skylight.",
    },
  ],

  fence_services: [
    {
      description: "Removal of existing fence",
      unit: LF,
      detail: "Take down the existing fence and pull the posts, per linear foot.",
    },
    {
      description: "Gate — supply & install",
      unit: EACH,
      detail: "Supply and hang a gate with hinges and latch, per gate.",
    },
    {
      description: "Post replacement",
      unit: EACH,
      detail: "Dig out and replace a post, set in concrete, per post.",
    },
    {
      description: "Staining / sealing",
      unit: LF,
      detail: "Apply stain or sealer to both faces of the fence, per linear foot.",
    },
    {
      description: "Disposal fee",
      unit: FLAT,
      detail: "Haul away and dispose of the old fencing and posts.",
    },
  ],

  landscaping_design: [
    {
      description: "Site preparation & grading",
      unit: FLAT,
      detail: "Clear the area and grade it to drain away from the house before planting or laying sod.",
    },
    {
      description: "Topsoil",
      unit: SQFT,
      detail: "Supply and spread screened topsoil, per square foot.",
    },
    {
      description: "Sod",
      unit: SQFT,
      detail: "Supply, lay and roll sod over prepared ground, per square foot.",
    },
    {
      description: "Mulch",
      unit: SQFT,
      detail: "Supply and spread mulch over the beds, per square foot.",
    },
    {
      description: "Edging",
      unit: LF,
      detail: "Install bed edging along the border, per linear foot.",
    },
    {
      description: "Disposal fee",
      unit: FLAT,
      detail: "Haul away and dispose of the cleared material and spoil.",
    },
  ],

  // Electrical and plumbing live in their own files rather than inline. They
  // are an order of magnitude longer than the lists above (54 and 60-odd lines
  // against six or eight) because both trades were torn down from real
  // estimates rather than written from memory, and each line carries a stable
  // `key` so the internal benchmark tables can point at it without keying on a
  // description string that will get reworded.
  electrical: ELECTRICAL_LINE_ITEMS,
  plumbing: PLUMBING_LINE_ITEMS,

  // Applies to nearly every trade, so it's offered when a category has no
  // list of its own rather than being repeated into all sixty.
  _generic: [
    {
      description: "Travel / call-out fee",
      unit: FLAT,
      detail: "Travel to the site outside the standard service area.",
    },
    {
      description: "Disposal fee",
      unit: FLAT,
      detail: "Haul away and dispose of the removed material.",
    },
    {
      description: "Materials",
      unit: FLAT,
      detail: "Materials supplied for the work described above.",
    },
    {
      description: "Additional labour",
      unit: FLAT,
      detail: "Extra labour beyond the scope described above.",
    },
  ],
};

/** Suggestions for a category, falling back to the ones common to all trades. */
export function getDefaultLineItems(categoryKey) {
  return DEFAULT_LINE_ITEMS[categoryKey] || DEFAULT_LINE_ITEMS._generic;
}
