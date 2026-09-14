# site-kind fixtures

`ethicalservices-*.html` — the real pages of www.ethicalservices.com, a
carpet-cleaner directory, fetched with curl on 2026-09-14 (HTTP only; the
host refuses 443). Overture listed it as the website of Ring A Ling
Upholstery & Carpet Cleaners, Randolph NY, and the crawler read it as theirs.

`roths-*.html` — a reduced Roth's Solution (rothssolution.com, 2026-09-09),
the contractor site from the navigation-ranking fix in
scripts/check-sales-crawl.mjs §12, as the contrast case: a site that IS the
business's own.

Read by scripts/check-sales-site-kind.mjs. Not to be edited by hand — a
fixture that no longer matches the site it came from proves less, not more.
