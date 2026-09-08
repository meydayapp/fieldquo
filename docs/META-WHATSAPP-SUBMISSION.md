# WhatsApp Business messaging — App Review submission

Written 8 September 2026, alongside the build that makes it recordable.
Companion to `META-APP-REVIEW-SUBMISSION.md`, which covers `ads_read` and the
Page/Instagram publishing permissions.

---

## 1. Why a mock-up would have failed

Meta asks for a screen recording *because* they verify the app does what the
description claims. A reviewer opens the OAuth dialog themselves and watches a
message move. A rendered screenshot fails on its own terms, and a rejection
puts every other pending permission back in the queue behind it.

The way through is not a better mock-up. It is Development mode.

## 2. An unapproved permission still runs — for you

This is the part that is easy to miss. An unapproved permission does not mean
the code cannot execute. It means the app may only be used by people on the
app's own team: admins, developers and testers. For everyone else the OAuth
dialog refuses.

Inside your own account, every call is real. So the recording is real.

**WhatsApp is the easiest of the lot**, because Meta hands you the sandbox:
adding WhatsApp to the app provisions a free test business number. You do not
need to own a number, port anything, or finish business verification before you
can record. You add your own mobile as a verified test recipient and messages
flow both ways.

## 3. Setup, before you record

1. Meta App Dashboard → **Add product → WhatsApp**.
2. Under **API Setup**, note the **test business number** Meta provisions and
   its **phone number id**, and copy the temporary access token.
3. **Add your own mobile** under "To" as a verified recipient. Meta sends it a
   code; enter it. (The test number can message a small fixed number of
   verified recipients — yours is the only one needed.)
4. Confirm your Facebook account is an **admin or developer** on the app, and
   that the app is in **Development** mode.
5. In Vercel, set `META_WHATSAPP_ENABLED=1` (or `META_APP_MODE=development`).
   See `docs/VERCEL.md` for the full list the build added. Until this is set, FieldQuo deliberately does not draw
   a Connect button, because a button that opens a consent screen Meta refuses
   is exactly the dead control this codebase forbids.
6. Redeploy, or record against a preview deployment with the variable set.

## 4. What to record, in order

The build's own account of what exists behind each of these steps is §7b of
`META-APP-REVIEW-SUBMISSION.md`. This is the running order; that is the proof.

Screen-record continuously. No cuts — a cut is where a reviewer assumes
something was skipped.

1. Sign in to FieldQuo. Go to **Settings → Messaging**.
2. Press **Connect WhatsApp**.
3. Meta's dialog appears, requesting `whatsapp_business_messaging`. **Let it be
   readable on screen** — this is the OAuth flow they explicitly asked to see.
   Approve it.
4. FieldQuo returns showing the connected number and its display name.
5. **On your own phone**, send a WhatsApp message to the test number:
   *"Hi, how much would you charge to paint a 12x14 bedroom?"*
6. Show it arriving in the FieldQuo inbox, with the WhatsApp badge.
7. Reply from FieldQuo. Show it arriving **on the phone**.
8. Show the conversation attached to a customer, and the quote or job it is
   linked to.
9. Add a **private note** and point out it is never sent — reviewers like
   seeing a boundary enforced.
10. **Open a conversation whose customer last wrote more than 24 hours ago.**
    The reply box is disabled with the reason on it, and a template picker
    stands in its place. Send an approved template; show it arriving. These
    are the twenty seconds a WhatsApp reviewer is actually looking for —
    everything above proves the integration works, and this proves you
    understood the rule that governs it.
11. Press **Disconnect**, showing the stored token being removed. Point out
    that the conversations remain and only the sending stops.

If you also want the AI employee in the recording, show it in **draft** mode: a
reply is written, it waits, and a human presses send. Do not record auto-send.
It is a legitimate feature and it is not the impression to lead with.

## 5. The description, rewritten

Three changes from the first draft, each for a reason:

- **The 24-hour customer service window is now named.** Its absence was the
  biggest risk in the original: it is the first thing a WhatsApp reviewer looks
  for, and not mentioning it reads as not having built it.
- **The AI section says a human is in the loop.** Meta scrutinises automated
  messaging on WhatsApp far harder than on Messenger. As originally written it
  read as a bot answering strangers unattended.
- **The advertising-analytics clause is gone.** It was quoted from Meta's own
  permission blurb, describes a use FieldQuo does not make, and invites
  questions with no upside.

> FieldQuo is job-management and customer-communication software for
> field-service businesses — painters, plumbers, electricians, HVAC companies,
> roofers, landscapers and similar contractors, typically businesses of one to
> twenty people.
>
> We use `whatsapp_business_messaging` so that a business can connect its own
> WhatsApp Business number to FieldQuo and talk to its customers from the same
> place it manages leads, quotes, appointments, jobs, invoices and payments.
>
> When a customer messages the business on WhatsApp, the conversation appears
> in FieldQuo and is matched to that customer's existing record by phone
> number, so it sits alongside their quotes and jobs. Authorised staff of that
> business reply from FieldQuo, send and receive supported media, and keep the
> history with the rest of the customer's file. This matters because
> contractors receive enquiries, appointment requests and job questions through
> messaging apps while everything else about that customer lives in their
> business software, and today they retype it by hand or lose it.
>
> FieldQuo respects the 24-hour customer service window. Free-form replies are
> only sent inside it. When the window has closed, the reply box tells the
> business so and refuses to send free text, and any message outside the window
> must be an approved template. This is enforced on the server, not only in the
> interface.
>
> FieldQuo also offers optional AI assistance, and a person stays in control of
> it. By default the assistant writes a draft and a member of staff presses
> send; nothing reaches a customer unread. A business may switch on automatic
> replies, and even then the assistant stops as soon as a member of staff
> replies, stops when the customer asks for a person, stops when the
> conversation has been handed to someone, and never sends outside the 24-hour
> window. It can answer common questions from material the business itself
> uploads, collect the details needed for a quote, and book a callback. It
> cannot invent a price: any figure comes from the business's own rate card,
> calculated by FieldQuo's server, never written by the model.
>
> Keeping the conversation with the customer's record lets the business see
> which enquiries became booked work, and where it is losing them — enquiries
> nobody answered, slow first replies, follow-ups that were missed. Any such
> analysis is limited to the connected business's own conversations. FieldQuo
> never uses one business's WhatsApp conversations to inform another's, and
> conversation content is never shared between businesses.
>
> The permission is therefore required for the core function: sending and
> receiving messages on the business's own number, handling supported media,
> attaching the conversation to the customer's record, and keeping the history
> through the life of the job.

## 6. Answers to the questions they usually ask next

**Who can see the conversations?** Staff of that business, at the permission
level the business sets. FieldQuo's own support staff cannot read customer
message content — that is enforced and written down in
`scripts/check-settings-access.mjs`, with the reason: a homeowner messaging a
contractor has a relationship with the contractor, not with FieldQuo.

**Where are tokens stored?** Encrypted at rest, decrypted server-side at the
point of use, never returned to a browser, never in a redirect URL or a log
line. `scripts/check-meta-pages-connect.mjs` proves the equivalent for Page
tokens and fails the build on a leak.

**How does a customer stop it?** Disconnecting in FieldQuo settings deletes the
stored token immediately. Data deletion instructions are at
`https://www.fieldquo.com/data-deletion`, and Meta's signed deletion callback
is implemented at `https://www.fieldquo.com/api/meta/data-deletion`.
