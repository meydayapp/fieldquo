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


`00-create-menu` (Create menu open), `01-home`, `02-leads` + `02b-lead-detail`,
`03-quotes` + `03b-quote-detail`, `04-quote-reviews`, `05-jobs` +
`05b-job-detail`, `06-invoices` + `06b-invoice-detail`, `07-service-plans`,
`08-calendar`, `09-todo`, `10-clients` + `10b-client-detail`,
`11-client-equipment`, `12-your-team`, `13-subcontractors`, `14-assign-shifts`,
`15-team-calendar`, `16-time-clock`, `17-timesheets`, `18-time-off`,
`19-safety`, `20-payroll`, `21-expenses`, `22-purchasing`, `23-vehicles`,
`24-insights`, `25-kpis`, `26-marketing`, `27-designer`, `28-funnels`,
`29-receptionist`, `30-crew-inbox`, `31-messages`, `32-refer-and-earn`,
`33-fieldquo-ai`, `34-help`, `35-plan` — one per `/app` sidebar item, 1280×900,
light theme, plus the first-row detail page for Leads, Quotes, Jobs, Invoices
and Clients.
