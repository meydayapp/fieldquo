// lib/pricing/popularTier.js
//
// Which rung /pricing marks "Most popular" — "Most shops start here." — and
// the evidence for it.
//
// ══ The owner's instruction (2026-10-15) ═══════════════════════════════════
//
// "the most popular is true.. but use your understanding on national data in
// order to understand what is the average sized company size (number of
// employees) for all blue collar trades.. and use that as the most popular."
//
// So this is NOT a claim about FieldQuo's own subscriber mix (two paying
// companies on 2026-10-15 is not a distribution). It is the rung that fits
// the typical trades business, from the national business counts, and the
// badge's sentence — "Most shops start here" — says exactly that.
//
// ══ The data, read 2026-10-15 ═════════════════════════════════════════════
//
// United States — Census Bureau, Statistics of U.S. Businesses 2022 (the
// latest year published), NAICS 238 Specialty Trade Contractors, employer
// firms by enterprise employment size:
//   https://www2.census.gov/programs-surveys/susb/tables/2022/us_state_naics_detailedsizes_2022.txt
//   500,271 firms: <5 employees 322,260 (64.4%) · 5–9 84,294 (16.8%) ·
//   10–14 32,700 · 15–19 16,869 (10–19 together 9.9%) · 20+ 44,148 (8.8%).
//   The median firm (the 250,136th) is inside the <5 class; 91.2% have
//   fewer than 20 employees. The MEAN is 9.5 (4,773,221 employees / 500,271
//   firms) — pulled up by the few large firms, which is why the median, not
//   the mean, describes a typical shop. A further ~1.9 million NAICS 238
//   businesses have no employees at all (Nonemployer Statistics 2022/2023,
//   https://www2.census.gov/programs-surveys/nonemployer-statistics/datasets/2023/historical-datasets/nonemp23us.zip),
//   which pushes the typical business smaller still.
//   Landscaping (NAICS 561730) and building construction (236) skew smaller:
//   72% and 75% of employer firms have fewer than 5 employees.
//
// Canada — Statistics Canada, Canadian Business Counts, with employees,
// June 2026, table 33-10-1174-01 (released 2026-08-14), NAICS 238, locations:
//   https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3310117401
//   101,223 locations: 1–4 employees 61,874 (61.1%) · 5–9 19,953 (19.7%) ·
//   10–19 10,433 (10.3%) · 20+ 8,963 (8.9%). The median (the 50,612th) is in
//   1–4; 91.1% have fewer than 20. Another 137,833 NAICS 238 locations have
//   no employees (table 33-10-1175-01).
//
// ══ Mapping it onto the ladder (lib/pricing/ladder.js SEAT_LADDER) ═════════
//
// The typical employer shop is the owner plus one to four employees. Solo is
// one office seat and five crew — the owner in the office seat and up to five
// people in the field, six in all — so the median shop fits Solo with room to
// spare, in both countries. Crew (3 seats, 8 crew) is the next step, for the
// 17–20% of shops with 5–9 employees or more than one person in the office.
//
// Change this only against newer counts, and update the figures above with
// it — check:site-seo pins the key to a real rung.
export const POPULAR_TIER_KEY = "solo";
