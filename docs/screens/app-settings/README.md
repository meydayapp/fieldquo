# Not captured — no signed-in session was reachable

Attempted 2026-09-12. The Claude-in-Chrome extension reported exactly one
connected browser ("Browser 1", macOS, local — the profile holding the
Upwork tabs). In a fresh tab in that profile:

- `https://www.fieldquo.com/app` → redirected to `/login` (see `../public/07-login.png`)
- `https://www.fieldquo.com/sales` → redirected to `/sales/login` (see `../public/08-sales-login.png`)
- `https://fieldquo.com/app` and `https://fieldquo.com/sales` (apex, in case the cookie was host-scoped) → the same two login pages

The profile has used the app before (localStorage carries the `tour_seen_*`
flags and `fq-settings-groups`), and its Better Auth broadcast key records
`{"event":"session","data":{"trigger":"signout"}}` — so the sign-in the owner
refers to happened in a different Chrome profile, an incognito window, or a
different browser, none of which had the extension connected. No second
browser or profile was offered by `list_connected_browsers`, so there was
nothing else to try. Signing in is not something this capture may do.

To redo this folder: sign in to the URL above in the Chrome profile that has
the Claude extension connected, then rerun the capture. The frame list this
folder is meant to hold:


`/app/settings`, one frame per settings section in sidebar order:
account-and-billing, refer-and-earn, data-migration, product-updates,
company-settings, branding, language, activity-log, manage-team,
availability, time-off-policies, booking-page, work-areas,
products-and-services, services-and-pricing, overhead, custom-fields,
quote-email, email-templates, pdf-templates, translations, checklists,
job-photo-tags, client-messages, follow-ups, notifications, email-domain,
payments, meta-ads, expense-tracking, ai-credit, payroll, your-website,
instant-quotes, share-your-links, bio-link, phone-receptionist, ai-employee,
reviews.

## Captured through the harness — the WhatsApp card (2026-09-12)

The signed-in session above was never reachable, so these frames come from
`harness/` — the REAL `app/components/settings/WhatsAppPanel.js` bundled
with esbuild against fixture stubs, `window.fetch` answered from fixtures,
screenshotted through the DevTools protocol (same pattern as
`../app-messages/harness`). Rebuild with `OUT=<dir> sh harness/build.sh`,
then `node --experimental-websocket harness/cdp-shot.mjs <out.png> 900 1320 2
"file://<dir>/whatsapp.html?scenario=ready&scene=manual&do=1"`.

- `whatsapp-manual.png` — nothing connected: the Embedded Signup button, and
  the "Connect with Cloud API credentials (advanced)" section opened, with
  the three fields filled (the token as a password field).
- `whatsapp-manual-refused.png` — the same form after Meta refused the token
  as belonging to another app (`wrong_app`): the sentence under the fields,
  the token cleared.
- `whatsapp-manual-connected.png` — a number connected through that door:
  "Connected via API credentials · +1 716 555 0199", the 24-hour rule, the
  same Refresh templates / Disconnect controls as the sign-up door.
- `whatsapp-manual-fr.png` — the open form in French (`?lang=fr`).
