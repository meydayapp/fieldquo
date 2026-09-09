# Meta App Review — what to keep, what to remove, and the answers

Written 8 September 2026. Supersedes the shorter note in
`META-APP-REVIEW-PROMPT.md` for the submission itself; that file stays as the
click-by-click walkthrough.

---

## 1. The rule that decides everything

**Meta approves a permission only if a reviewer can watch it work.** Every
request needs a screencast of the real flow in the real app. A permission
requested "for later" is not deferred — it is rejected, and a rejection puts
the whole submission back in the queue.

That is why the earlier advice was to strip the list down. It was not that
these features are bad ideas. It is that **you cannot ask for a permission
before the feature exists**, and asking for eleven you cannot demonstrate
would sink the one you can.

So this is two submissions, not one — and the first is bigger than it looked.
The publishing code is written and makes real Graph calls; only the Page
connection step was missing, and that is being built today. §2 is the real
inventory.

---

## 2. What the code actually calls — the real inventory

This is the table that decides the submission. Every Graph call in the
codebase, and the permission it needs.

| Graph call | Where | Needs | State |
|---|---|---|---|
| `GET /me/adaccounts` | `lib/meta/client.js:226` | `ads_read` | **Live** |
| `GET /{ad-account}/insights` | `lib/meta/client.js:248` | `ads_read` | **Live** |
| `GET /me/accounts` | the Page connect step | `pages_show_list` | Being built now |
| `POST /{page-id}/photos` | `lib/social/metaGraphClient.js:131` | `pages_manage_posts` | **Code complete** |
| `POST /{page-id}/feed` | `lib/social/metaSpecs.js:35` | `pages_manage_posts` | **Code complete** |
| `POST /{ig-user}/media` | `lib/social/metaGraphClient.js:76` | `instagram_content_publish` | **Code complete** |
| `POST /{ig-user}/media_publish` | `lib/social/metaGraphClient.js:93` | `instagram_content_publish` | **Code complete** |

Publishing is not a plan. The container-then-publish flow, scheduling, rate
limits and error handling are all written and make real Graph calls, and the
publish route injects the real client for any non-demo company. The single
thing missing is the connection step that obtains a Page access token:
`lib/social/metaConnection.js` calls itself "THE SEAM" and its header lists,
in four numbered steps, exactly what has to replace its real-company branch.
That is being built today, which is what makes these permissions
demonstrable.

Also needed in practice, and worth requesting together rather than in a third
round: `instagram_basic` (to resolve the Instagram Business account linked to
the Page) and `pages_read_engagement` (Meta commonly requires it alongside
`pages_manage_posts`).

---

## 2b. Keep, remove, and what goes in which round

**Round one — submit as soon as the Page connection lands and you have
recorded it.**

| Permission | Keep? | Why |
|---|---|---|
| `ads_read` | **KEEP** | Live today. |
| `public_profile` | **KEEP** | Granted automatically. |
| `pages_show_list` | **KEEP** | The connect step reads the contractor's Pages. |
| `pages_manage_posts` | **KEEP** | Two publish calls already written. |
| `instagram_content_publish` | **KEEP** | The container-then-publish flow, already written. |
| `instagram_basic` | **KEEP** | Resolves the IG account linked to the Page. |
| `pages_read_engagement` | **KEEP** | Required alongside `pages_manage_posts`. |

**Remove now — nothing in the codebase calls them.**

| Permission | The honest reason |
|---|---|
| `whatsapp_business_messaging` | No WhatsApp anywhere. |
| `whatsapp_business_management` | Same. |
| `pages_manage_metadata` | Nothing subscribes to Page webhooks yet. The messaging build may change this — revisit in round two. |
| `pages_manage_ads` | FieldQuo reads ad performance; it does not manage Page ads. |
| `publish_video` | Images and text only. |
| `ads_mcp_management` | Not used. See §5. |
| `catalog_management` | No Shops, no catalogue. |
| `threads_basic` | No Threads integration. |
| `Live Video API` | No live streaming. |
| `ads_management` | Write access to campaigns. See §4 — a real future feature, deliberately not now. |

**Round two — `pages_messaging`, `instagram_manage_messages`,
`leads_retrieval`.** Both are being built today; they go in once you can
record them working. See §3 and §7.

---

## 3. Your question about Page messages — yes, you are right

**Can a contractor send and receive their Facebook Page and Instagram
messages inside FieldQuo?** Yes. That is exactly what `pages_messaging` and
`instagram_manage_messages` are for, and the distinction you drew is the
right one:

- These reach **the business Page's inbox** — the messages strangers send to
  "Northline Painting" on Facebook, and DMs to the business Instagram account.
- They never reach anyone's **personal** Facebook or Instagram messages.
  Meta has no permission that would allow that, and the Page admin has to
  grant access to their own Page explicitly.

**And your reason for wanting it is the strongest part of the case.** Not
"an inbox" — every tool has an inbox. Yours is: at the end of the month, see
which conversations became jobs and which did not, and learn from the
difference. A contractor who discovers that every enquiry answered within an
hour became a job, and the ones left overnight did not, has learned something
worth more than the software costs.

That is being built now: a two-pane iMessage-style screen at `/app/messages`,
conversations stored, an outcome on each thread (won / lost / no reply / not
a job), and a monthly review showing the won rate, the median first-response
time, and — first, because it is the actionable one — the conversations
nobody ever replied to.

**Lead Ads** is being built alongside it: a customer submits Meta's built-in
"Get a free painting estimate" form, and that person becomes a lead in
FieldQuo, deduplicated on Meta's own lead id, with the same follow-up the
contractor's other leads get.

### The chicken-and-egg, and the way through it

The permission needs a screencast; the screencast needs the permission. The
way out is Meta's own: **an app in Development mode grants any permission to
its own admins, developers and testers without review.** So:

1. Add your Facebook Page and ad account as a **test asset** on the app.
2. Flip the scope flag (see below) so the OAuth dialog asks for the new
   permissions.
3. Connect your own Page, send a real message to it from another account,
   watch it arrive in FieldQuo, reply from FieldQuo, submit a test lead form.
4. **Record that.** That recording is the submission.

The code is being written so that step 2 is one flag, not a rewrite:
`META_OAUTH_SCOPE` stays `ads_read`, and the messaging and leads scopes sit
beside it behind a switch.

---

## 4. Ad management — worth doing, in round three

You asked whether FieldQuo could manage ads given that it already builds the
creative. Technically yes, and the product logic is sound: the designer
already produces ad images, so "push this to a real campaign" is a coherent
next step rather than a bolt-on.

But be clear about what `ads_management` is: **write access to a contractor's
advertising account** — create campaigns, change budgets, spend their money.
Meta reviews it far more strictly than `ads_read`, and rightly. It also
raises a product question you should decide deliberately rather than by
accident: if FieldQuo can raise a budget, FieldQuo can lose someone money.

My recommendation: leave it out until the reading side has been live with
real contractors for a while, then add it as an explicit, confirm-every-change
feature. It is not urgent, and it is the permission most likely to draw
scrutiny onto the rest of your app.

---

## 5. `ads_mcp_management` — do not request it

I am not confident of this one's exact current scope, and I am not going to
guess at something that goes on a compliance form. It appears to relate to
Meta's newer programmatic advertising-management surface. FieldQuo does not
use it either way, so it comes off the list, and if you ever want it, read
Meta's own current documentation for it first rather than my summary.

---

## 6. The submission answers — round one

Paste these into the App Review form.

### App name and category
FieldQuo. Category: **Business and pages**.

### What does your app do? (public-facing description)

> FieldQuo is business software for field-service contractors — painters,
> cabinet makers, flooring installers, plumbers and landscapers, typically
> businesses of one to twenty people. It runs the whole job: the lead, the
> quote, the schedule, the work, the invoice and the payment. A contractor
> who advertises on Meta can connect their own ad account so that what they
> spend on advertising appears next to the leads and jobs that spending
> produced, and they can see what a booked job actually cost them to win.
> FieldQuo also includes a designer where a contractor builds a post from
> photographs of their own finished work, and publishes it to their own
> Facebook Page and Instagram business account without leaving the software
> or re-uploading the image by hand on a phone.

### Why do you need `ads_read`?

> Contractors who advertise on Facebook and Instagram currently have no way
> to see whether that spending is working, because the money is in Meta's
> dashboard and the resulting jobs are in FieldQuo. Reading ad spend and
> campaign performance lets FieldQuo show cost per lead and cost per booked
> job — the numbers that tell a small contractor whether to keep advertising.
>
> The integration is read-only. FieldQuo requests `ads_read` and no other
> advertising permission. It never creates, edits, pauses, targets or budgets
> a campaign, and it never writes anything to a Meta account. Each contractor
> connects only their own ad account through Meta's OAuth dialog, and can
> disconnect at any time in FieldQuo's settings, which deletes the stored
> token immediately.

### Why do you need `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic` and `instagram_content_publish`?

> A contractor finishes a kitchen, photographs it, and that photograph is
> already in FieldQuo because it is attached to the job. FieldQuo's designer
> turns it into a post — the image, a caption, their brand colour — and these
> permissions let them publish it to their own Facebook Page and Instagram
> business account, or schedule it, from the same screen. Without them the
> contractor has to export the image, move it to a phone, and repost it by
> hand, which is why most of them never post at all.
>
> Each permission maps to one thing FieldQuo does:
>
> - `pages_show_list` — after the contractor approves the connection, list the
>   Pages they administer so they can choose which one FieldQuo posts to.
> - `pages_manage_posts` — publish a photo post or a text post to that Page
>   (`POST /{page-id}/photos`, `POST /{page-id}/feed`), including scheduling.
> - `pages_read_engagement` — read the Page's own basic details so FieldQuo can
>   show which Page it is connected to and confirm the connection is alive.
> - `instagram_basic` — resolve the Instagram business account linked to that
>   Page. A Page with no linked Instagram account simply publishes to Facebook
>   only.
> - `instagram_content_publish` — publish to that Instagram business account
>   using Meta's container-then-publish flow (`POST /{ig-user-id}/media`, then
>   `POST /{ig-user-id}/media_publish`).
>
> FieldQuo publishes only what the contractor composed and pressed publish on,
> only to accounts they connected themselves, and never on a schedule they did
> not set. It does not read anyone's feed, does not message anyone, and does
> not post to any account but the connected one. Disconnecting in FieldQuo's
> settings deletes the stored Page token immediately.

### How will you use the data, and where is it stored?

> The imported figures are ad spend and campaign performance for the
> contractor's own ad account: campaign name, date, amount spent, impressions,
> clicks and results. For publishing, FieldQuo stores the connected Page's id
> and name, the linked Instagram account's id and username, and the id Meta
> returns for each post it published, so the contractor can see what went out
> and when. They are stored in FieldQuo's database against that one
> contractor's company record, and shown only to signed-in members of that
> company. They are never shared with other FieldQuo customers, never sold,
> never used to build any profile of a person, and never combined across
> customers. The access token is encrypted at rest and used only to fetch
> that account's own insights.

### Step-by-step for the reviewer (this is what your screencast must show)

1. Sign in to FieldQuo at `https://www.fieldquo.com/login` with the test
   credentials provided.
2. Go to **Settings → Marketing**.
3. Press **Connect Meta Ads**.
4. Meta's OAuth dialog appears, requesting `ads_read`. Approve it.
5. FieldQuo returns to Settings → Marketing showing the connected ad account.
6. The imported spend now appears on the marketing screen alongside the
   leads and jobs it produced.
7. Press **Disconnect** to show the token being removed.

Then, in the same recording or a second one, for the publishing permissions:

8. In **Settings → Marketing**, press **Connect Facebook Page**.
9. Meta's dialog appears requesting the Page and Instagram permissions.
   Approve it, and choose a Page from the list FieldQuo shows.
10. Go to **Marketing → Designer**, open a design, and press **Publish**.
11. Choose Facebook, Instagram, or both, and publish.
12. Show the published post on the real Facebook Page and Instagram account.
13. Press **Disconnect** to show the Page token being removed.

Record exactly that, unnarrated is fine, no cuts. Meta rejects submissions
where the reviewer cannot see the permission being used end to end, so do not
trim the OAuth dialog or the result.

### Data deletion

> Instructions: `https://www.fieldquo.com/data-deletion`
> Callback: `https://www.fieldquo.com/api/meta/data-deletion`

Both are live. The callback verifies Meta's `signed_request` and answers with
a confirmation code and status URL. **`META_APP_SECRET` must be set in Vercel
or every callback is refused.**

### Privacy policy and terms

> `https://www.fieldquo.com/privacy` · `https://www.fieldquo.com/terms`

### Test credentials

Create a **real FieldQuo account** for the reviewer with a company that has a
connected Meta test ad account, and give them the email and password. Do not
give them your own account.

### Business verification

`ads_read` needs Business Verification. FieldQuo Inc., CBN 791503840. Have
the incorporation document and a matching address ready — this is usually the
slowest part, so start it the same day you submit.

---

## 7. Round two — after the builds land

Submit `pages_messaging`, `instagram_manage_messages`, `pages_show_list`,
`pages_read_engagement`, `pages_manage_metadata`, `instagram_basic` and
`leads_retrieval` together, once you can record them working against your own
Page in Development mode.

`pages_manage_metadata` is the one that is easy to leave off the list and
impossible to work without. It is what allows `POST /<page-id>/subscribed_apps`
— the call that points a Page's messages (and the DMs of the Instagram
professional account linked to it) at FieldQuo's webhook. Without it a Page
connects, a token stores, the Send API works, and Meta delivers nothing
inbound, forever. Meta lists it, with `pages_show_list`, on the
`subscribed_apps` edge itself
(developers.facebook.com/docs/graph-api/reference/page/subscribed_apps).
The use case to give Meta is the messaging one below — it is not a separate
feature, it is the plumbing under it.

Draft use case for the messaging permissions:

> Contractors receive job enquiries as Facebook Page messages and Instagram
> direct messages, mixed in with the phone calls, emails and web forms that
> already arrive in FieldQuo. Bringing those conversations into FieldQuo lets
> a contractor answer them from the same place they answer everything else,
> and — the reason we built it — lets them see at the end of each month which
> conversations turned into paid work and which went unanswered. Small
> contractors lose jobs to slow replies more than to price, and they cannot
> see that pattern while the conversations live in a separate app on a phone.
> FieldQuo reads and sends messages only for Pages and Instagram business
> accounts the contractor themselves connects, never any personal account,
> and the contractor can disconnect at any time.

Draft use case for `leads_retrieval`:

> Contractors run Facebook and Instagram lead ads ("Get a free painting
> estimate"). Today those leads sit in Meta's Forms Library and have to be
> retyped into FieldQuo, so they are answered late or lost. With
> `leads_retrieval`, a submitted lead form becomes a lead in the contractor's
> own FieldQuo account within seconds, with the contractor's normal follow-up
> applied, and the ad spend already imported through `ads_read` can finally be
> measured against the jobs it produced.

---

## 7b. Round two, second half — WhatsApp Business

> **The step-by-step for recording this, the Meta-side setup, and the
> rewritten use-case description live in `META-WHATSAPP-SUBMISSION.md`.**
> What follows is the engineering record of what was built and what a
> reviewer sees; that file is the one to work from on the day.

`whatsapp_business_messaging` and `whatsapp_business_management`, submitted
together, once you can record them working against your own WhatsApp Business
number with `META_APP_MODE=development`.

`business_management` is deliberately NOT requested. Meta lists it for Solution
Partners sharing a credit line; FieldQuo does not — each contractor's WhatsApp
Business Account is billed to that contractor. See `META_WHATSAPP_SCOPE` in
`lib/meta/client.js` for the per-permission justification, and
`docs/VERCEL.md` for the two env vars (`META_WHATSAPP_ENABLED`,
`META_WHATSAPP_CONFIG_ID`).

Draft use case:

> Contractors already give customers a WhatsApp number, and for many trades it
> is now the number people actually use — more than the Page, more than email.
> Those conversations sit in a separate app on somebody's phone, so the office
> cannot see them, cannot answer them when that person is on a roof, and cannot
> tell at the end of the month which of them turned into paid work. FieldQuo
> brings the contractor's own WhatsApp Business number into the same inbox as
> their Page and Instagram messages, answered by the same people, with the same
> notes, the same owner, and the same month-end read of which enquiries became
> jobs. FieldQuo reads and sends only for a number the contractor themselves
> connects through Embedded Signup, never a personal WhatsApp account, and the
> contractor can disconnect at any time.

### The 24-hour customer service window, and how the screencast shows it

This is the part a reviewer will look for, and it is built rather than
described. WhatsApp accepts a free-text message only within 24 hours of the
customer's last message; outside it, only a template Meta approved in advance.
FieldQuo computes that window itself
(`lib/messaging/serviceWindow.js`) and **refuses free text outside it by name**
(`service_window_closed`) before calling Meta, rather than letting the send
fail with error 131047 after a contractor has pressed Send. The composer says
the window has closed, and offers the approved templates instead.

**What to record, in this order:**

1. Settings → Meta Ads → **WhatsApp Business**, with the flag OFF: the panel
   says the feature is waiting on Meta's approval and renders no Connect
   button. This is the honest starting state, and it is worth showing.
2. Set `META_APP_MODE=development`, reload: the same panel now offers
   **Connect WhatsApp**.
3. Click it → Meta's Embedded Signup → pick the number → land back on Settings
   with the number, its verified name, and the 24-hour rule stated on the card.
4. **Refresh templates** — the approved template list arrives from the WABA.
5. From a phone, message the business number.
6. `/app/messages`: the conversation appears with a **WhatsApp badge** beside
   the Facebook and Instagram ones. Open it — same notes, same status chips,
   same outcome control, no special case.
7. Type a reply and send it. It arrives on the phone. Show the delivery and
   read ticks turning as the status webhooks land.
8. Add a **private note**; show that it stays in FieldQuo and never reaches the
   phone.
9. **The window.** Open a conversation whose customer last wrote more than 24
   hours ago (or wind the clock). The composer is disabled with the reason on
   it, and the approved-template picker appears in its place. Send a template;
   it arrives. This is the single most important twenty seconds of the
   recording.
10. Settings → **Disconnect**: messages stop arriving, and the conversations
    are still there.

**The one-line change that enables it in production:** set
`META_WHATSAPP_ENABLED=1` in Vercel. Nothing else — the webhook, the envelope
parser, the send path, the template list and the window are already built and
already run.

---

## 8. What you have to do, in order

1. **Remove the ten permissions** listed in §2b. Keep `ads_read`,
   `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`,
   `instagram_basic` and `instagram_content_publish`.
2. **Set `META_APP_SECRET` in Vercel** (the data-deletion callback needs it).
3. **Start Business Verification** — it is the long pole.
4. **Create the reviewer's test account.**
5. **Record the thirteen steps** in §6 and submit round one. Steps 8-13 need
   the Page connection, which lands today — wait for it rather than
   submitting the ads half alone, since one submission is faster than two.
6. Round two goes in once the messaging and leads work is deployed and you
   have recorded it against your own Page in Development mode.
