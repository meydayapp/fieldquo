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
import { marketingMetadata } from "@/lib/marketing/metadata";
import { SUPPORT_EMAIL } from "@/lib/supportContact";
import {
  PRIVACY_POLICY_EFFECTIVE_DATE,
  formatLegalDate,
} from "@/lib/legal/effectiveDates";
import { PROCESSORS } from "@/lib/legal/processors";
import { PRIVACY_OFFICER } from "@/lib/legal/privacyOfficer";
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
        <li>Billing information, handled by Stripe (see Section 4) — FieldQuo does not store card numbers.</li>
        <li>Everything the company enters to run its business: clients, quotes, invoices, jobs, pricing, photos, and staff activity within the product.</li>
      </ul>
      <h3>From a client, homeowner, or caller</h3>
      <ul>
        <li>Name, address, phone number and email, when a company adds them as a client, or when they submit a self-quote form, a booking request, or call a company's AI receptionist.</li>
        <li>Photos of their property, when they or a company's staff attach them to a quote or job.</li>
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
      <table>
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
      <p>
        We do not sell personal information, and we do not share a company's
        client data with any other company on FieldQuo. The one exception is
        described in Section 7: an <strong>opt-in</strong> feature that lets a
        company share its own anonymised, aggregate figures (never its
        client-level data) into a pooled industry benchmark.
      </p>
      <p>
        <strong>Data residency:</strong> we have not established, and do not
        claim, that data is stored or processed in any particular country.
        None of the services above are currently configured to guarantee
        that, and this policy will not claim it until that changes and can be
        verified.
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
        company on your behalf.
      </p>

      <h2>7. Aggregate industry benchmarking (opt-in)</h2>
      <p>
        A company can choose, in its own settings, to share its anonymised
        pricing and conversion figures into a pooled benchmark that shows
        companies like them how their numbers compare — for example, a
        median win rate across similar trades. This is <strong>off by
        default</strong>, requires the company to turn it on, is never shown
        broken out by individual company, and can be turned off at any time.
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

      <h2>9. Quebec — Law 25</h2>
      <p>
        {PRIVACY_OFFICER.name}, {PRIVACY_OFFICER.title}, is responsible for
        the protection of personal information at FieldQuo and can be reached
        at {PRIVACY_OFFICER.contact}.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        If we change this policy in a way that matters, we'll update the
        effective date at the top and, where the change is material, tell
        subscribing companies directly.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about this policy: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalDocument>
  );
}
