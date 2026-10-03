// app/(marketing)/privacy/page.js
//
// A real Privacy Policy, replacing a 25-line placeholder whose own text said
// it needed to be drafted before this went live with real customers.
//
// ── Where this comes from ────────────────────────────────────────────────
//
// Every factual claim below was checked against the code that makes it true
// (or, in a few places, checked against the code and found NOT true — see
// the report that shipped alongside this page for exactly which claims from
// the original brief didn't survive that check, and what was written
// instead). Nothing here is copied from another company's policy — a
// competitor's privacy policy describes THEIR practices and is their
// copyright besides.
//
// This is not a substitute for legal review. It is an accurate description
// of what the product does today, written so a lawyer has something true to
// start from instead of a blank page or someone else's boilerplate.
//
// scripts/check-legal-pages.mjs (wired into `npm run check:all`) asserts:
//   - this page names no certification FieldQuo doesn't hold;
//   - PRIVACY_POLICY_EFFECTIVE_DATE is a real constant, not `new Date()`;
//   - every processor named below is one PROCESSORS' `verify` pattern can
//     still find in the actual integration code; and
//   - the Quebec privacy-officer placeholder is present and internally
//     consistent (see lib/legal/privacyOfficer.js for what that means).
import Link from "next/link";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { SUPPORT_EMAIL } from "@/lib/supportContact";
import {
  PRIVACY_POLICY_EFFECTIVE_DATE,
  formatLegalDate,
} from "@/lib/legal/effectiveDates";
import { PROCESSORS } from "@/lib/legal/processors";
import { PRIVACY_OFFICER } from "@/lib/legal/privacyOfficer";
import { DELETION_BUSINESS_DAYS } from "@/lib/dataDeletion/constants";
import LegalDocument from "@/app/components/marketing/LegalDocument";

export const metadata = marketingMetadata({
  path: "/privacy",
  title: "Privacy Policy — FieldQuo",
  description:
    "How FieldQuo handles the data contractors and their clients put into it.",
});

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      updatedLabel={`Effective ${formatLegalDate(PRIVACY_POLICY_EFFECTIVE_DATE)}`}
      dek={
        <>
          FieldQuo is software a contracting company runs its business on:
          quotes, invoices, scheduling, and — for companies that turn it on —
          an AI phone receptionist and AI drafting tools. This page explains
          what personal information passes through it, who else sees it, and
          what say you have over it. It applies to FieldQuo staff, to the
          contractors ("companies") who subscribe to FieldQuo, and to the
          clients and callers of those companies (their "homeowners" or
          "clients") whose information reaches us because a company they
          hired uses FieldQuo.
        </>
      }
    >
      <h2>1. Who this policy covers, and a word about who controls what</h2>
      <p>
        FieldQuo is multi-tenant software: each subscribing company (a
        painter, a cabinet maker, a plumber, and so on) has its own account,
        its own clients, and its own data. For most of the personal
        information described here — a homeowner's name, address, phone
        number, quote and invoice history, photos of their property, and any
        recorded phone calls — <strong>the company is the data controller and
        FieldQuo is its processor.</strong> We hold this information because a
        company we serve put it into the product to run its business; we do
        not decide to collect it, and we do not use it for our own purposes
        beyond running and improving the product itself. If you are a
        homeowner or client with a question about your own information, the
        fastest route is usually the company you hired — see Section 6.
      </p>
      <p>
        Separately, FieldQuo is the data controller for information about the
        companies and staff who subscribe to FieldQuo itself — account
        details, billing contacts, and how staff use the product.
      </p>

      <h2>2. What we collect</h2>
      <h3>From a subscribing company and its staff</h3>
      <ul>
        <li>Account and contact details: name, email, phone, company name and address.</li>
        <li>
          If you start the signup form and do not finish it, what you had
          typed so far (your name, email, phone, company name, trades and
          language) is kept so that we can follow up with you about the
          signup &mdash; by email, or by a call from our sales team if you
          gave a phone number. You can ask us to delete it at any time (see
          Section 6).
        </li>
        <li>Billing information, handled by Stripe (see Section 4) — FieldQuo does not store card numbers.</li>
        <li>Everything the company enters to run its business: clients, quotes, invoices, jobs, pricing, photos, and staff activity within the product.</li>
      </ul>
      <h3>From a client, homeowner, or caller</h3>
      <ul>
        <li>Name, address, phone number and email, when a company adds them as a client, or when they submit a self-quote form, a booking request, or call a company's AI receptionist.</li>
        <li>Photos of their property, when they or a company's staff attach them to a quote or job.</li>
        <li>
          On a company&rsquo;s instant-estimate page or lead funnel: how far the
          visit got and which link or ad it arrived from (counted without a
          cookie), and &mdash; under a notice beside the fields saying so &mdash;
          the name, email and phone typed into the contact step even if the
          request is never sent, kept for that company to follow up and hidden
          after 30 days. If the company has added its own advertising pixel
          (Meta, Google or TikTok), that platform receives page views and a
          &ldquo;lead&rdquo; event from the visitor&rsquo;s browser, with no
          name, email, phone or address; a company can require the visitor&rsquo;s
          consent before any pixel loads.
        </li>
        <li>Payment details, when they pay an invoice or a booking fee online — handled by Stripe; FieldQuo does not store card numbers.</li>
        <li>The content of quotes, invoices, and messages sent to them.</li>
        <li>
          If a company uses the AI phone receptionist: the audio, recording,
          and transcript of calls to that company's number.
        </li>
        <li>
          If a company offers automatically-recurring payments (a "service
          plan"): their saved payment method, and the IP address and browser
          user agent present when they authorised it — recorded because
          Stripe's rules for charging a saved payment method later require us
          to be able to show that authorisation happened.
        </li>
        <li>
          When they approve a quote by signing it online: the drawn
          signature itself, the name they typed, the time, and the IP address
          and browser user agent the signature came from. That last part is
          what makes the signature worth anything &mdash; a signature nobody can
          place at a time and a connection is a picture, not evidence, and if
          the approval is later disputed it is the contractor who needs to be
          able to show it happened.
        </li>
      </ul>
      <h3>Page views</h3>
      <p>
        FieldQuo measures which of its own pages are viewed &mdash; the
        marketing site, the help centre, the back office and the pages a
        company&apos;s clients open &mdash; itself, without any third-party
        analytics service, tracking cookie or advertising pixel. What is
        recorded is the page&apos;s route (never the specific quote, booking
        or client it showed), the interface language, a screen-size bucket,
        the referring site&apos;s domain and any campaign tags in the link,
        plus a random identifier kept in the browser&apos;s own storage so
        that one reader is counted once. No IP address is stored. Raw entries
        are kept for 30 days and then reduced to daily totals.
      </p>
      <p>
        Separately, back-office page loads (never a page a company&apos;s
        clients see) report performance timings to Vercel Speed Insights so
        we can find slow pages: the page path without its query string, the
        device and browser type, and how long the page took to load. It is
        listed in Section 4.
      </p>
      <p>
        We do not knowingly collect information from anyone we know to be a
        minor, and FieldQuo is built for business-to-business and
        business-to-homeowner transactions, not for use by children.
      </p>

      <h2>3. How we use AI</h2>
      <p>
        FieldQuo uses AI in specific, narrow places — never to build a general
        profile of a person, and never to compare one company's data against
        another's. What follows is what each AI feature is <em>for</em>; it
        does not describe how any figure is calculated, because that is not a
        privacy question.
      </p>
      <ul>
        <li>
          <strong>Reviewing a quote before it's sent.</strong> The photos
          attached to a quote are read by an AI model to surface things worth
          double-checking on site, and to help write plain-language
          descriptions of the work. A company can also pay for a deeper photo
          review of the same photos.
        </li>
        <li>
          <strong>Recovering and drafting from phone calls.</strong> For
          companies using the AI phone receptionist, call transcripts are
          used to reconstruct a lead from a call that wasn't captured any
          other way, to draft a quote from what a caller described, and to
          build a monthly digest summarising a company's call activity.
        </li>
        <li>
          <strong>The FieldQuo AI assistant.</strong> Built into the product
          for a company's own staff to ask questions about their own
          business — cash flow, quotes, invoices, jobs. It answers only from
          that company's own data, refuses requests unrelated to running the
          business, and never sees another company's information. Where it
          needs to reference a client to answer a question, it is given that
          client's <strong>name only</strong> — never their address, phone
          number, email, or financial history — enforced in code, not left to
          the model's judgement.
        </li>
        <li>
          <strong>Generating marketing images.</strong> A company can
          generate or edit marketing images (for ads and its website) using
          AI, from a reference photo it supplies.
        </li>
        <li>
          <strong>Drafting and translation.</strong> AI drafts website copy
          and translates text a company writes, working from that company's
          own data — it does not invent services, prices, or layouts.
        </li>
        <li>
          <strong>Reading client conversations.</strong> When a company uses
          the paid conversation read, the conversation coach or the monthly
          conversation review, the text of its own client conversations
          (texts, chats, and emails filed from a connected mailbox) is read by
          an AI model to tell that company how an enquiry is going and what
          its won and lost enquiries had in common. Surnames, phone numbers,
          email addresses, street addresses and postcodes are removed before
          the model sees a word.
        </li>
      </ul>
      <p>
        AI processing for these features is performed by OpenAI, and — for
        phone calls — by Retell; see the table in Section 4.
      </p>

      <h2>4. Who else sees this information</h2>
      <p>
        We use the following third-party services to run FieldQuo. Each
        receives only the categories of information its role requires.
      </p>
      {/* Three prose columns cannot fit a 375px phone, and LegalDocument's
          [&_table]:w-full does not save them — a table narrower than its cells'
          min-content pushes the BODY sideways instead, which takes the whole
          policy with it. The wrapper scrolls, the min-w keeps the columns from
          collapsing into one word per line, and the negative margin lets the
          scroll region reach the screen edge so the cut-off column reads as
          scrollable rather than clipped. */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="min-w-[560px]">
          <thead>
            <tr>
              <th>Service</th>
              <th>What it does</th>
              <th>What reaches it</th>
            </tr>
          </thead>
          <tbody>
            {PROCESSORS.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.role}</td>
                <td>{p.dataShared}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        We do not sell personal information, and we do not share a company's
        client data with any other company on FieldQuo. The one exception is
        described in Section 7: the pooled industry benchmark, on by default
        and switchable off in Settings, which takes only a company's own
        anonymised, aggregate figures (never its client-level data).
      </p>
      <p>
        <strong>Where data is hosted:</strong> FieldQuo&apos;s database and
        application servers are in the United States, in the northern
        Virginia / Washington, D.C. area (Neon on AWS us-east-1 and
        Vercel&apos;s iad1 region). The other services listed above run on
        their own infrastructure and may process the information they receive
        in other countries, under their own terms.
      </p>

      {/* A subsection, not a new numbered section: other text points at
          "Section 7" by number, and renumbering would silently repoint it.
          These four commitments are the owner's (2026-09-28), made so the
          answer given in Meta's data-handling questions is true — they are
          promises about how a request is handled, so keep them to what a
          small company can actually do. */}
      <h3>Requests from public authorities</h3>
      <p>
        If a government agency, regulator, or law-enforcement authority asks
        FieldQuo for personal information, we:
      </p>
      <ul>
        <li>
          review every request to confirm it is lawful and properly made
          before we respond;
        </li>
        <li>
          challenge a request we consider unlawful, overly broad, or not
          properly made, and do not disclose anything while that challenge is
          open unless the law requires us to;
        </li>
        <li>
          disclose only the minimum information the request legally requires;
          and
        </li>
        <li>
          keep a record of each request, our response, the legal basis for it,
          and who handled it.
        </li>
      </ul>
      <p>
        Where the law allows, we tell the affected company before disclosing
        its information, so it can respond itself.
      </p>

      <h2>5. How long we keep information</h2>
      <p>
        We want to state this plainly rather than promise a retention
        schedule the product doesn't implement: <strong>FieldQuo does not
        currently delete data on a schedule, and there is no way for a
        company to delete its FieldQuo account today.</strong> If a company's
        subscription lapses, its account becomes inaccessible — nobody can
        sign in and use it — but the underlying records are not erased.
      </p>
      <ul>
        <li>
          A client record can only be deleted by a company's own staff, and
          only if that client has no quotes and no invoices on file. A client
          with any billing history cannot be deleted through the product.
        </li>
        <li>
          Call recordings and transcripts have no automatic expiry — they are
          kept until a company's staff removes what they can, subject to the
          limits above.
        </li>
        <li>
          Email unsubscribe and SMS opt-out records are kept permanently, by
          design — an opt-out is a standing instruction, and honouring it
          later depends on still having the record that it was given.
        </li>
      </ul>
      <p>
        We are telling you this directly because we think a retention policy
        that describes a deletion schedule the product doesn't have would be
        worse than one that says plainly what happens today. We intend to
        build account and data deletion; this policy will be updated, with a
        new effective date, when that ships.
      </p>
      <p>
        In the meantime, deletion is a request handled by a person.{" "}
        <Link href="/data-deletion">Data Deletion</Link>{" "}
        sets out exactly what to send, where, and what we can and cannot erase.
      </p>

      <h2>6. Your rights, and how to reach us</h2>
      <p>
        Depending on where you are, you may have rights to access, correct,
        export, or request deletion of your personal information. We want to
        be direct about where the product stands today:{" "}
        <strong>
          there is currently no self-service way for a homeowner or client to
          see, correct, export, or delete their own information through
          FieldQuo.
        </strong>{" "}
        The client account area a company's client can reach shows their own
        quotes and invoices with that company and lets them pay a balance —
        it is not a data-access tool.
      </p>
      <p>
        If you want to exercise a privacy right, the most direct route is the
        company you dealt with — they hold your primary relationship and can
        act on your request. If you'd rather contact FieldQuo directly, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and tell us
        which company's records your request concerns; we will act on it
        directly where we are able to, and otherwise route it to that
        company on your behalf. For a deletion request specifically,{" "}
        <Link href="/data-deletion">Data Deletion</Link>{" "}
        lists what to include so we can act without a round trip.
      </p>

      <h2>7. Aggregate industry benchmarking (on by default, switch off in Settings)</h2>
      <p>
        A company's anonymised pricing and conversion figures are pooled into
        a benchmark that shows companies like them how their numbers compare
        — for example, a median win rate across similar trades. This is
        <strong>on by default</strong> under the Terms of Service (Section 7)
        a company accepts when its account is created, is never shown broken
        out by individual company, is only published where enough companies
        contribute that no single company's figures can be worked out, and
        can be switched off at any time in Settings &rsaquo; Company.
        No client-level data — no client name, address, or contact
        information — is included in this pool, only aggregate figures about
        the company's own business.
      </p>
      <p>
        Information about a business, as opposed to an identifiable
        individual, is generally not "personal information" under Canadian
        privacy law (PIPEDA) — which is part of why this is offered as a
        product setting rather than treated as a personal-data consent flow.
        The one case that doesn't fit that reasoning is a{" "}
        <strong>sole proprietor</strong>, whose business figures can be
        inseparable from them as an individual. If that describes your
        business, treat this setting as covering your own personal
        information too, and decide accordingly.
      </p>

      <h2>8. Marketing email and text messages</h2>
      <p>
        Commercial emails from a company using FieldQuo — marketing
        campaigns, review requests, and similar outreach — carry a working,
        one-click unsubscribe link, and unsubscribing takes effect
        immediately. Transactional messages (a quote, an invoice, a payment
        receipt, a password reset) do not carry an unsubscribe link, because
        they are not marketing and CASL does not require one on them.
      </p>
      <p>
        For text messages, replying <strong>STOP</strong> to a message from a
        company's own dedicated number opts that number out of future texts
        from that company; replying <strong>START</strong> opts back in. One
        current gap, stated plainly: a company that hasn't been assigned its
        own dedicated texting number and is using FieldQuo's shared fallback
        number does not yet have a working STOP reply on that shared number —
        see the Security page for more detail.
      </p>

      {/* ── Google user data ─────────────────────────────────────────────
          Written for Google's OAuth verification (2026-10-03), which rejects
          a policy that does not say, per scope, what is read, written, kept,
          shared and how it is undone, plus the Limited Use statement. Every
          sentence was checked against the code that makes it true:

            calendar.events / calendar.readonly
                       lib/calendar/googleClient.js (scopes, freebusy, the
                       event calls), googleEvent.js (what an event carries),
                       googleSync.js (only FieldQuo-marked events are touched;
                       disconnect removes the mirrors it still tracks — a
                       visit more than 30 days past is dropped from tracking
                       and stays on the calendar), googleBusy.js (5-minute
                       memory cache, never written to the database),
                       app/api/calendar/google/busy (team-schedule viewers).
            business.manage
                       lib/reviews/googleBusiness/client.js (accounts,
                       locations, reviews, place-action links — no reply
                       call exists), sync.js (30-day cache), bookButton.js
                       (only our own APPOINTMENT link), connection.js
                       (disconnect deletes every cached review). The Book
                       link is NOT removed by disconnect — said below.
            gmail.readonly / gmail.send
                       lib/mailbox/providers/google.js, parse.js (headers
                       for everything, body only for a client/lead match),
                       attachments.js (10 × 10 MB to Cloudinary), send.js
                       (client mail only, never campaigns), connections.js
                       (disconnect wipes the credential; filed mail stays).

          The human-access paragraph is enforced for the one way FieldQuo
          staff reach a company's data, the superadmin's read-only "view as
          company" (lib/platform/impersonate.js): lib/mailbox/supportView.js
          withholds a Gmail message's subject, body and attachments, a Google
          review's text and reply, and the verbatim quotes the conversation
          score and coach carry on a Gmail thread, in the GET handlers the
          screens read. scripts/check-support-view-google.mjs executes them.
          There is no consent flow yet — "with your permission" today means
          the company shows us. A route that newly returns message bodies or
          review text must apply the same gate.

          If a scope is added or a behaviour changes, this section and the
          matching row in lib/legal/processors.js change in the same commit,
          with a new PRIVACY_POLICY_EFFECTIVE_DATE. */}
      <h2>9. Google user data</h2>
      <p>
        FieldQuo can connect to three Google services: Google Calendar,
        Google Business Profile and Gmail. Each connects only when someone at
        a company chooses to, on Google&apos;s own consent screen, and each
        can be disconnected at any time. This section sets out exactly what
        FieldQuo reads from and writes to each one, what it keeps and for how
        long, and how to undo it. &ldquo;Google user data&rdquo; here means
        the information FieldQuo receives from Google through those
        connections.
      </p>

      <h3>Google Calendar &mdash; a staff member&apos;s own calendar</h3>
      <p>
        Connected by a staff member, for themselves, from Settings &rsaquo; My
        calendar. FieldQuo asks Google for <code>calendar.events</code> and{" "}
        <code>calendar.readonly</code>, and for the connected account&apos;s
        email address.
      </p>
      <ul>
        <li>
          <strong>What it writes.</strong> FieldQuo creates, updates and
          deletes events on your primary calendar for the site visits,
          appointments and bookings assigned to you in FieldQuo. Each event
          carries the kind of visit, the client&apos;s name, the site address
          (none for a phone or video call), the time, and a link back to
          FieldQuo. For a video-call booking, Google creates a Google Meet
          link with the event, and FieldQuo saves that link on the booking so
          the client can be sent it.
        </li>
        <li>
          <strong>What it reads.</strong> When your calendar is busy: start
          and end times only, through Google&apos;s free/busy query, which
          returns no titles, attendees, locations or descriptions. It is used
          so that a time you are busy is not offered on the company&apos;s
          booking page, by its AI receptionist, or to the office when it moves
          a visit. FieldQuo also reads back the events it created itself &mdash;
          each one carries a private FieldQuo mark &mdash; to keep them up to
          date, and checks that mark before changing or deleting anything, so
          it never edits or deletes an event of your own.
        </li>
        <li>
          <strong>Who sees it.</strong> Your busy times appear on
          FieldQuo&apos;s calendar as grey &ldquo;busy&rdquo; blocks with no
          detail, to you and to colleagues whose role lets them see the
          team&apos;s schedule.
        </li>
        <li>
          <strong>What is stored, and for how long.</strong> An encrypted
          refresh token, your Google email address (to show &ldquo;Connected
          as&rdquo;), and the Google ID of each event FieldQuo created &mdash;
          until you disconnect. Busy times are held in server memory for at
          most five minutes and are never saved to the database. A Meet link
          stays on the booking it belongs to, because the client was sent it.
        </li>
        <li>
          Reading busy times and writing visits can each be switched off
          separately, on the same screen, without disconnecting.
        </li>
      </ul>

      <h3>Google Business Profile &mdash; the company&apos;s listing</h3>
      <p>
        Connected for the company, from Settings &rsaquo; Reviews, by someone
        allowed to manage the company&apos;s team in FieldQuo (an owner or
        admin, or a manager or dispatcher). FieldQuo asks Google for <code>business.manage</code>, and
        for the connected account&apos;s email address.
      </p>
      <ul>
        <li>
          <strong>What it reads.</strong> The Business Profile accounts and
          listings the Google account manages (each listing&apos;s name, title
          and address), so you can pick which listing to connect; only the one
          you pick is kept. Then that listing&apos;s reviews: the
          reviewer&apos;s display name (or &ldquo;A Google user&rdquo; when the
          review is anonymous), the star rating, the review text, the reply
          already posted, if any, and the dates. They are shown to the company
          in Settings &rsaquo; Reviews. A review appears publicly only if the
          company switches it on: it is then shown unedited and credited to
          Google on the company&apos;s FieldQuo website, and can be used in
          marketing graphics the company makes in FieldQuo. FieldQuo does not
          reply to, edit or remove reviews.
        </li>
        <li>
          <strong>What it writes.</strong> Only when the company asks, from
          Settings &rsaquo; Booking Page: it adds a &ldquo;Book&rdquo; button
          to the listing that links to the company&apos;s FieldQuo booking
          page, or removes that one button. It never changes any other link
          or any other part of the listing.
        </li>
        <li>
          <strong>What is stored, and for how long.</strong> An encrypted
          refresh token, the Google email address, the chosen account and
          listing names, and a copy of the listing&apos;s reviews. The copy
          is refreshed nightly; a review Google no longer returns is deleted
          at that refresh, and no review is kept longer than 30 days without
          being fetched again.
        </li>
      </ul>

      <h3>Gmail &mdash; a connected work mailbox</h3>
      <p>
        Connected from Settings &rsaquo; Work email: by any staff member for
        their own work mailbox, or by an owner or admin for the company
        mailbox. FieldQuo asks Google for <code>gmail.readonly</code> and for
        the account&apos;s email address. It asks for{" "}
        <code>gmail.send</code> only when an owner or admin sets up the
        company mailbox to send client email.
      </p>
      <ul>
        <li>
          <strong>What it reads.</strong> About every ten minutes &mdash; and,
          when the mailbox is first connected, for the previous 90 days &mdash;
          FieldQuo reads the headers of new mail (sender, recipients, subject,
          date and message IDs), skipping spam, trash, drafts and chats, and
          compares the addresses with the company&apos;s clients and leads.
        </li>
        <li>
          <strong>What it keeps.</strong> Only a message to or from one of
          the company&apos;s clients or leads is downloaded in full and filed
          into that client&apos;s conversation in FieldQuo: its headers, its
          text, and its attachments (up to ten files of up to 10&nbsp;MB each,
          stored with Cloudinary). For every other message the body is never
          downloaded and nothing is stored but a count of skipped messages. A
          filed email is part of the client&apos;s conversation like a text
          or a chat: the company&apos;s staff see it in the inbox, it counts
          towards that conversation&apos;s score, and it is included when the
          company uses the paid AI conversation features described in Section
          3 &mdash; with surnames, phone numbers, email addresses, street
          addresses and postcodes removed before an AI model sees it.
        </li>
        <li>
          <strong>What it sends.</strong> When sending is switched on, the
          company&apos;s client emails &mdash; quotes, invoices, payment
          requests, booking confirmations and replies written in
          FieldQuo&apos;s inbox &mdash; are sent through the mailbox, so they
          come from its real address and sit in its Sent folder. FieldQuo
          sends nothing else through it, and never marketing campaigns.
        </li>
        <li>
          <strong>What is stored, and for how long.</strong> The encrypted
          credential and the mailbox address, until you disconnect. Filed
          emails stay with the client&apos;s record until they are deleted on
          request (below).
        </li>
      </ul>

      <h3>How Google user data is used, and what it is never used for</h3>
      <ul>
        <li>
          It is used only to provide the features described above to the
          company and the person who connected it.
        </li>
        <li>It is never sold.</li>
        <li>
          It is never used for advertising &mdash; not to serve, target or
          personalise ads, and not to build a profile of anyone.
        </li>
        <li>
          It is never used to develop, improve or train generalised AI or
          machine-learning models.
        </li>
        <li>
          It is not transferred to anyone except the service providers listed
          in Section 4 that FieldQuo needs to run these features (its database
          and hosting, Cloudinary for email attachments, and OpenAI for the AI
          features described in Section 3), or where the law requires it
          (Section 4, &ldquo;Requests from public authorities&rdquo;).
        </li>
        <li>
          No one at FieldQuo reads it unless you have given us permission to
          for specific data (for example, by asking support to look into a
          problem), it is necessary for security purposes such as
          investigating abuse or a security incident, it is necessary to
          comply with the law, or it has been aggregated and anonymised for
          FieldQuo&apos;s internal operations. Staff at your own company see
          what FieldQuo shows them in the product, under the permissions your
          company sets.
        </li>
      </ul>
      <p>
        <strong>
          FieldQuo&apos;s use and transfer to any other app of information
          received from Google APIs will adhere to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </strong>
      </p>

      <h3>Disconnecting, revoking access, and deletion</h3>
      <ul>
        <li>
          <strong>Google Calendar:</strong> Settings &rsaquo; My calendar
          &rsaquo; Disconnect. FieldQuo deletes the events it is still keeping
          in step on your calendar &mdash; upcoming visits and those from the
          past 30 days &mdash; revokes its access at Google, and deletes the
          stored token, email address and event IDs. Visits further in the
          past stay on your calendar as your own history; delete them in
          Google Calendar if you want them gone.
        </li>
        <li>
          <strong>Google Business Profile:</strong> Settings &rsaquo; Reviews
          &rsaquo; Disconnect (the same people who can connect it). FieldQuo
          revokes its access at
          Google and deletes the stored token, the listing details and every
          copied review at once &mdash; which also takes them off the
          company&apos;s website. A &ldquo;Book&rdquo; button FieldQuo added
          stays on the listing, because it is part of your public profile:
          remove it first from Settings &rsaquo; Booking Page, or afterwards
          from your Business Profile on Google.
        </li>
        <li>
          <strong>Gmail:</strong> Settings &rsaquo; Work email &rsaquo;
          Disconnect (the person who connected the mailbox, or an owner or
          admin). FieldQuo revokes its access at Google, deletes the stored
          credential, stops reading the mailbox and stops sending through it.
          Emails already filed into client conversations stay, as the
          company&apos;s record of what was said to its clients; the screen
          says so before you confirm.
        </li>
        <li>
          <strong>At Google, at any time:</strong> remove FieldQuo&apos;s
          access at{" "}
          <a href="https://myaccount.google.com/permissions">
            myaccount.google.com/permissions
          </a>
          . FieldQuo can then no longer read or write anything through that
          connection. What it already stored stays until you also disconnect
          in FieldQuo, or ask us to delete it.
        </li>
        <li>
          <strong>Deletion on request:</strong> to have Google user data
          FieldQuo holds deleted &mdash; filed emails included &mdash; email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or use{" "}
          <Link href="/data-deletion">Data Deletion</Link>. It is carried out
          by a person within {DELETION_BUSINESS_DAYS} business days, and you
          are told when it is done.
        </li>
      </ul>

      <h2>10. Quebec — Law 25</h2>
      <p>
        {PRIVACY_OFFICER.name}, {PRIVACY_OFFICER.title}, is responsible for
        the protection of personal information at FieldQuo and can be reached
        at {PRIVACY_OFFICER.contact}.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        If we change this policy in a way that matters, we'll update the
        effective date at the top and, where the change is material, tell
        subscribing companies directly.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about this policy: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalDocument>
  );
}
