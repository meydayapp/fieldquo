// app/(marketing)/terms/page.js
//
// Real Terms of Service, replacing a 25-line placeholder. See the header
// comment on app/(marketing)/privacy/page.js for how the facts behind this
// page were established, and for the checked-in verification
// (scripts/check-legal-pages.mjs, wired into `npm run check:all`).
//
// This is not a substitute for legal review. In particular: FieldQuo's legal
// entity name, place of incorporation, and governing-law/venue clause are
// NOT established anywhere in this codebase — those are business facts, not
// facts a codebase audit can produce — and are left as explicit placeholders
// below rather than invented. See the report that shipped with this page.
import { marketingMetadata } from "@/lib/marketing/metadata";
import { SUPPORT_EMAIL } from "@/lib/supportContact";
import {
  TERMS_OF_SERVICE_EFFECTIVE_DATE,
  formatLegalDate,
} from "@/lib/legal/effectiveDates";
import LegalDocument from "@/app/components/marketing/LegalDocument";

export const metadata = marketingMetadata({
  path: "/terms",
  title: "Terms of Service — FieldQuo",
  description: "The terms that apply to using FieldQuo.",
});

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      updatedLabel={`Effective ${formatLegalDate(TERMS_OF_SERVICE_EFFECTIVE_DATE)}`}
      dek={
        <>
          These terms govern a company's ("you," "the company") use of
          FieldQuo. By creating a FieldQuo account or using the product, you
          agree to them. If you are creating an account on behalf of a
          business, you're confirming you have the authority to bind that
          business to these terms.
        </>
      }
    >
      <h2>1. What FieldQuo is</h2>
      <p>
        FieldQuo is software for field-service contractors — quoting,
        invoicing, scheduling, client management, a website and booking page,
        and optional AI features including an AI phone receptionist. Every
        document your clients see through FieldQuo — quotes, invoices,
        booking pages, your website, the emails you send — is branded with
        your company's name and logo, not FieldQuo's. Free-tier websites
        carry a small "Site by FieldQuo" credit; beyond that, FieldQuo does
        not present itself to your clients as the software behind your
        business.
      </p>

      <h2>2. Accounts and signup</h2>
      <p>
        Creating a company account on FieldQuo is self-serve, through the
        public signup page. <strong>Joining an existing company's account is
        not self-serve</strong> — you must be invited by that company against
        one of its licensed seats. There is no way to add yourself to a
        company you were not invited to.
      </p>
      <p>
        A new company's first month is free (see the pricing page for current
        rates by team size). We also run a referral programme: when a company
        you refer signs up and qualifies, both you and they receive one free
        month. Referral terms may change; the terms in effect at the time you
        refer someone govern that referral.
      </p>

      <h2>3. Subscriptions and billing</h2>
      <ul>
        <li>
          FieldQuo is billed per licensed seat, at the rate shown on the
          pricing page for your team size, through Stripe.
        </li>
        <li>
          If a subscription payment fails or lapses, your company's access to
          FieldQuo may be suspended. A suspended account's data is not
          deleted — see Section 9 — but nobody can sign in and use the
          product until billing is resolved.
        </li>
        <li>
          There is currently no self-service way to close a FieldQuo account.
          To cancel, contact us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Stopping
          payment does not delete your data; it suspends access to it.
        </li>
      </ul>

      <h2>4. Your data, and what you're responsible for</h2>
      <p>
        You own the data you put into FieldQuo about your business, your
        clients, and your jobs. You are responsible for the accuracy of what
        you enter, for the lawfulness of how you collect your clients'
        information before putting it into FieldQuo, and for complying with
        the laws that apply to your own business — including any consent you
        need from your clients to call, text, or email them, and any
        obligations you have to them around their own data.
      </p>
      <p>
        FieldQuo processes your clients' data on your behalf as described in
        our Privacy Policy. Where that policy describes FieldQuo as a
        processor and your company as the controller of your clients' data,
        this section is the term that makes that arrangement explicit between
        us.
      </p>

      <h2>5. AI features</h2>
      <p>
        FieldQuo includes optional AI features — quote review, an AI
        assistant scoped to your own business data, and (where enabled) an AI
        phone receptionist. These tools are aids, not a substitute for your
        own judgement: AI-suggested pricing, drafted copy, and call summaries
        should be reviewed before you rely on them, and you remain
        responsible for what you send to your clients and for prices you
        quote. FieldQuo's AI assistant will not disclose or compare pricing
        or performance data between different companies — it answers from
        your own business's data only.
      </p>

      <h2>6. Pricing you publish, and pricing FieldQuo keeps private</h2>
      <p>
        Your rate card and prices are yours. FieldQuo's public-facing
        self-quote and instant-quote forms are designed to collect a
        homeowner's project details without exposing your rates to the
        public — publishing a rate card openly would hand it to every
        competitor searching for it. When a client-facing page prices an
        add-on or upgrade, the browser sends only what was selected; FieldQuo
        recalculates the price from your own stored rates rather than
        trusting a number sent from a browser.
      </p>

      <h2>7. Industry benchmarking (opt-in)</h2>
      <p>
        In Settings, you can choose to share your company's anonymised
        pricing and conversion figures into a pooled industry benchmark, so
        FieldQuo can show you how your numbers compare to similar
        businesses. This is off by default, applies only to aggregate
        figures (never your client-level data), and you can turn it off at
        any time. Full detail is in our Privacy Policy, Section 7.
      </p>

      <h2>8. Automatic recurring payments you set up with your clients</h2>
      <p>
        If you offer a client automatically-recurring billing (a "service
        plan"), FieldQuo presents them with the payment amount, schedule, and
        cancellation terms and records their agreement before the first
        automatic charge — this is required by our payment processor's rules
        for charging a saved payment method without the cardholder present,
        and it protects you as much as them. You may not use this feature to
        charge a client who hasn't gone through that authorisation step.
      </p>

      <h2>9. What happens to your data if you stop paying, or want to leave</h2>
      <p>
        We want this to be as plain here as it is in our Privacy Policy:{" "}
        <strong>
          FieldQuo does not currently delete a company's data on request, and
          there is no self-service account-deletion path.
        </strong>{" "}
        A lapsed or suspended account becomes inaccessible, not erased. If you
        want your account and its data handled differently — closed,
        exported, or (where we're able) deleted — contact{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we'll work
        it out with you directly, since the product does not yet automate it.
      </p>

      <h2>10. Acceptable use</h2>
      <p>You agree not to use FieldQuo to:</p>
      <ul>
        <li>Send unsolicited commercial email or text messages in violation of applicable law (e.g. CASL, CAN-SPAM, TCPA), or to a number/address that has opted out.</li>
        <li>Impersonate another business, or misrepresent who is contacting a client.</li>
        <li>Attempt to access another company's account or data, or probe, scan, or interfere with FieldQuo's systems.</li>
        <li>Upload content you don't have the right to use, or that is unlawful, fraudulent, or infringing.</li>
      </ul>

      <h2>11. FieldQuo's own access to your account</h2>
      <p>
        FieldQuo staff do not access your account in the ordinary course of
        running the product. Where a superadmin needs to view your account
        for support — for example, to help diagnose a problem — that access
        is read-only: FieldQuo can view your account but cannot edit your
        data, and every such session is logged. Full detail, including what
        "view" covers, is on our Security page.
      </p>

      <h2>12. Service availability</h2>
      <p>
        We aim to keep FieldQuo available and reliable, but we don't
        guarantee uninterrupted access. Scheduled maintenance, third-party
        outages (our payment, email, SMS, AI, and hosting providers are all
        listed in our Privacy Policy), and factors outside our control can
        affect availability.
      </p>

      <h2>13. Disclaimers and limitation of liability</h2>
      <p>
        FieldQuo is provided "as is." AI-generated content (quote language,
        photo review notes, call summaries, drafted website copy) may
        contain errors and should be reviewed before you rely on it — we do
        not warrant its accuracy. To the maximum extent permitted by law,
        FieldQuo is not liable for indirect, incidental, or consequential
        damages arising from your use of the product, including lost profits
        or lost business, and our total liability for any claim is limited to
        the amount you paid us in the twelve months before the claim arose.
        Nothing in this section limits liability that cannot be limited under
        applicable law.
      </p>

      <h2>14. Changes to these terms</h2>
      <p>
        If we materially change these terms, we'll update the effective date
        above and tell subscribing companies directly.
      </p>

      <h2>15. Governing law and legal entity</h2>
      <p>
        <em>
          [[PLACEHOLDER: FieldQuo's legal entity name, place of
          incorporation/registration, and the governing law and venue that
          apply to these terms are not established anywhere in this codebase
          and need to be confirmed by the business owner and/or counsel
          before this page is treated as final.]]
        </em>
      </p>

      <h2>16. Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalDocument>
  );
}
