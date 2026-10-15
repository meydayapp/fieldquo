// lib/marketing/featuredComparisons.js
//
// The two comparisons named outside /compare — in the footer's Compare column
// and under the /pricing grid (site audit D5.3, 2026-10-15): Jobber and
// Housecall Pro, the two a Canadian shop most often weighs FieldQuo against.
//
// Slug and display name are written here rather than derived from
// app/(marketing)/compare/compareCopy.js and lib/marketing/competitors.js,
// because importing those puts ~3,000 lines of sourced price data into every
// marketing page's JavaScript for two links. check:site-seo asserts each slug
// is a real COMPARE_PAGES entry and each name is that competitor's own.
export const FEATURED_COMPARISONS = Object.freeze([
  Object.freeze({ slug: "fieldquo-vs-jobber", name: "Jobber" }),
  Object.freeze({ slug: "fieldquo-vs-housecall-pro", name: "Housecall Pro" }),
]);
