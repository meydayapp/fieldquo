# Google Ads for agencies: the gclid in, the result back out

For a marketing agency connected through the FieldQuo Marketing Zapier app
(API key from the company's Settings → Marketing agency). Two Zaps close the
loop between a Google ad click and what the contractor did with the lead.

## Where the gclid comes from

Every lead row the agency sees (API, webhooks, Zapier samples —
`lib/agency/leadRow.js`) has a `gclid` field. It is filled when:

- the visitor arrived from a Google ad on a FieldQuo page **or on the
  contractor's own website through a FieldQuo embed** — the embed snippet
  forwards the host page's `gclid` (and the `_gcl_aw` cookie that keeps it
  after the visitor clicks to another page; `lib/embed/snippet.js`,
  `lib/tracking/attribution.js`). Such a lead's `channel` is `google_ads`;
- the agency posted it with the lead (Zap 2 below). A lead the agency posts
  with a `gclid` is `google_ads`, not `agency_funnel`
  (`lib/agency/channels.js`).

It is `null` otherwise — including for an iPhone click that carried Google's
`gbraid`/`wbraid` instead of a gclid. Those leads are still `google_ads`, but
there is no gclid to send back, and Zapier's GCLID field cannot take the
other two.

## Zap 1 — send the result to Google ("offline conversion")

Before the first Zap, in Google Ads: **Goals → Conversions → New conversion
action → Import → CRM, files or other data sources → Track conversions from
clicks**. Make one action per stage you want to bid on, e.g. "Qualified lead"
and "Won job". Auto-tagging must be on (Admin → Account settings).

1. **Trigger:** FieldQuo Marketing → **Lead Qualified** (or **New Client
   (Quote Accepted)** for won jobs).
2. **Filter by Zapier:** continue only if the lead's `gclid` *exists*.
3. **Action:** Google Ads → **Send Offline Conversion**.
   - Customer: the contractor's Google Ads account.
   - Conversion action: "Qualified lead" (or "Won job").
   - GCLID: the lead's `gclid`.
   - Conversion time: `Occurred at` (the moment FieldQuo recorded the stage —
     never earlier than the click, which Google requires).
   - Value / currency (won jobs only): the lead's `Won amount` and `Currency`.
     They are empty unless the company switched on "Share job values"; leave
     the value blank rather than typing one in.

Google accepts a click up to 90 days old. A lead qualified later than that is
refused by Google, not by FieldQuo.

## Zap 2 — a Google lead form straight into FieldQuo

For Google's own lead-form assets, where the homeowner never visits a page:

1. **Trigger:** Google Ads → **New Lead Form Entry**.
2. **Action:** FieldQuo Marketing → **Create Lead**.
   - Name, email, phone, postal code from the form's answers.
   - **gclid:** the lead form's `GCLID` (`gcl_id`) field.
   - UTM campaign: the campaign id or name, if you want it per campaign.

The lead arrives as `channel: google_ads` with its gclid, so the same lead
later fires Zap 1 when the contractor qualifies or wins it. FieldQuo
de-duplicates on email and phone over the last 180 days, so a homeowner who
also filled in the contractor's website form is one lead, not two — and that
lead keeps the attribution it arrived with: a gclid posted on a duplicate is
not added to it.
