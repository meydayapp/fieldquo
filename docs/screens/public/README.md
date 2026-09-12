# Public pages — www.fieldquo.com, no session

Captured 2026-09-12 in headless Chrome over the DevTools protocol (the same
route `docs/screens/platform-review/harness/cdp-shot.mjs` takes), 1280×900,
light theme, English. The marketing site reads its language from the
`fieldquo-language` localStorage key that `LanguageSwitcher` writes, so the
capture profile sets it to `en` before every load; a fresh visitor with a
Spanish browser would see the same pages in Spanish. Every page is served
from production, not a fixture. Nothing was typed, submitted or clicked.

There is no `/help` or `/support` route; the nearest things are the Help
Center under Resources (`/resources/help`) and `/contact`, both captured.

| File | URL | What it shows |
|---|---|---|
| `00-home.png` | https://www.fieldquo.com/ | Hero: "Build a quote on site, send it before you leave the driveway, and get paid without chasing anyone.", Start free trial / See how it works, the demo-or-call-back link, and the Quotes · Scheduling · Invoicing · Analytics tab strip above the product frame. |
| `00b-home-scrolled.png` | https://www.fieldquo.com/ (scrolled 900px) | The section below the fold: the product frame and the first explainer blocks. |
| `01-pricing.png` | https://www.fieldquo.com/pricing | The four plans — Solo $99, Crew $169, Shop $269, Scale $369 a month — seats and free crew members per plan, AI copilot on every card, and the "All of it is in every plan" heading. |
| `01b-pricing-scrolled.png` | https://www.fieldquo.com/pricing (scrolled 900px) | The four feature columns (Winning the work · Doing the job · Getting paid · Running the business) that every plan includes. |
| `02-features.png` | https://www.fieldquo.com/features | The features index, "Everything FieldQuo does": the intro, Start your free month / See pricing, and the top of "The 29 on the pricing page, one page each" card grid (Quotes, AI quote review, AI receptionist, Quote drafted from the call, …). |
| `02b-features-scrolled.png` | https://www.fieldquo.com/features (scrolled 900px) | The rest of the feature grid. |
| `03-help.png` | https://www.fieldquo.com/resources/help | The Help Center. It says the setup guides and how-tos are still being written and points at "send a message"; the only content is the contractor-glossary card. Effectively a placeholder page. |
| `04-contact.png` | https://www.fieldquo.com/contact | Contact Us form (not filled, not submitted). |
| `05-signup-sales.png` | https://www.fieldquo.com/signup?sales=danielboves | The sales rep's sign-up link: step 1 of 4 (Account) with first/last name, email, company, phone. The rep code is carried silently — nothing on the page names the rep, on purpose (`app/signup/page.js` refuses to confirm whether a code is real so the roster cannot be enumerated). Not filled, not submitted. |
| `05b-signup-sales-scrolled.png` | same, scrolled 900px | Address with autocomplete, city/province auto-filled, country and language selects, password, the Continue button, and "Built for 12 trades, from painting to roofing." |
| `06-resources.png` | https://www.fieldquo.com/resources | Resources & FAQ index. |
| `07-login.png` | https://www.fieldquo.com/login | Where `/app` lands without a session: "Welcome back", email + password, forgot-password and free-trial links, the "Everything that holds up your day" column. |
| `08-sales-login.png` | https://www.fieldquo.com/sales/login | Where `/sales` lands without a session: the Sales Portal sign-in — "Only for FieldQuo's sales team. A company account does not give you access here." |

The two login frames are here because they are what the signed-in
captures in `../app`, `../app-settings` and `../sales-portal` fell back to —
see those folders' READMEs.
