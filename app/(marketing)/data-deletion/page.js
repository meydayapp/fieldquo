// app/(marketing)/data-deletion/page.js
//
// How to get data out of FieldQuo, and what "deleted" honestly means here
// today. Built because Meta's App Review requires a publicly reachable URL
// describing how a person requests deletion of the data an app holds; this
// is the "Data deletion instructions URL" in the FieldQuo app's settings, and
// ?code= is where Meta's deletion callback sends a person to check status
// (app/api/meta/data-deletion/route.js).
//
// ══ The one rule that shaped every sentence below ═════════════════════════
//
// A policy page describing a capability the product does not have is the same
// failure as a button that does nothing — AGENTS.md's rule applies to prose
// the moment the prose is what a reader relies on. There is no self-service
// account deletion in this product, and the owner's decision (2026-09-08) is
// that there will not be an automated one: a request is REGISTERED here, and
// the deletion is done by hand, by FieldQuo's owner, within a stated number
// of business days. So the page describes exactly that — a form that records
// a request and sends a receipt, then a person — and never uses the word
// "immediately" about anything a human has to do.
//
// Every claim was read out of the code, not assumed:
//
//   - There is no account-deletion route. The heaviest thing that exists,
//     app/api/platform/companies/[id]/route.js's DELETE, is a SUSPENSION: it
//     writes onboardingStatus "churned", logs company_deletion_requested, and
//     returns a note that says in as many words "Company marked as churned,
//     not deleted. Contact engineering for permanent deletion." Describing
//     that as deletion would be the lie this page exists to avoid.
//   - The form below writes a DataDeletionRequest row and sends two emails
//     (app/api/data-deletion/route.js). Nothing reads that table to delete
//     anything; the platform console's only write to it is "completed".
//   - A client record deletes only with no quotes and no invoices —
//     app/api/clients/[id]/route.js counts both and refuses otherwise.
//   - Disconnecting Meta really does delete: lib/meta/connection.js's
//     disconnectConnection() runs deleteMany on MetaAdConnection, so the
//     encrypted token is gone rather than flagged. That is why this page is
//     allowed to describe it as removal without qualifying it.
//   - No retention job exists anywhere. Nothing expires on a schedule.
//
// The Privacy Policy already states most of this in Sections 5 and 6, and the
// two must not drift apart. This page is the operational version — what to
// send, where, and what happens next — and it is deliberately consistent with
// that one rather than a second, cheerier account of the same product.
//
// ══ Two numbers, two promises ═════════════════════════════════════════════
//
// DELETION_RESPONSE_DAYS (lib/legal/deletionRequests.js) is how long a
// PERSON takes to answer an email — the statutory response ceiling.
// DELETION_BUSINESS_DAYS (lib/dataDeletion/constants.js) is how long the
// owner has to carry the deletion OUT once a request is registered — the
// number the owner gave. The form's receipt is automatic and instant, so the
// first number only applies to a request that arrives by plain email.
//
// ══ English, like its neighbours ══════════════════════════════════════════
//
// /privacy, /terms, /security, /about, /contact and /careers are all
// English-only on a nine-language site, and none of them routes a string
// through t(). That is a real debt this page inherits rather than fixes:
// translating the seventh of seven, in a different way from the other six,
// would leave the site with two conventions instead of one. See
// app/(marketing)/careers/page.js, which records the same decision, and
// lib/i18n/compareCopy.js, which names locale-prefixed routes as the fix.
//
// scripts/check-legal-pages.mjs covers this page on the same terms as the
// other three: no certification claim, and a "Last updated" pinned to a real
// constant rather than computed from the reader's clock.
// scripts/check-data-deletion.mjs covers the form, the routes and the words
// this page must keep saying.
import Link from "next/link";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { SUPPORT_EMAIL } from "@/lib/supportContact";
import {
  DATA_DELETION_PAGE_UPDATED_DATE,
  formatLegalDate,
} from "@/lib/legal/effectiveDates";
import { DELETION_RESPONSE_DAYS } from "@/lib/legal/deletionRequests";
import {
  DELETION_BUSINESS_DAYS,
  normaliseConfirmationCode,
} from "@/lib/dataDeletion/constants";
import LegalDocument from "@/app/components/marketing/LegalDocument";
import DeletionRequestForm from "./DeletionRequestForm";
import DeletionStatus from "./DeletionStatus";

export const metadata = marketingMetadata({
  path: "/data-deletion",
  title: "Data Deletion — FieldQuo",
  description:
    "How to ask FieldQuo to delete data it holds, what happens after you ask, and what can and cannot be deleted today.",
});

export default async function DataDeletionPage({ searchParams }) {
  // Promises in Next 16. A malformed code is dropped here rather than passed
  // through: the status box only appears for something that could be a
  // reference, and the box's own field handles corrections.
  const params = (await searchParams) || {};
  const code = normaliseConfirmationCode(
    Array.isArray(params.code) ? params.code[0] : params.code,
  );

  return (
    <LegalDocument
      title="Data Deletion"
      updatedLabel={`Last updated ${formatLegalDate(DATA_DELETION_PAGE_UPDATED_DATE)}`}
      dek={
        <>
          This page explains how to ask FieldQuo to delete information it
          holds, what happens after you ask, and — just as importantly — what
          the product can and cannot delete today. We would rather tell you
          the second part here than have you discover it after sending a
          request.
        </>
      }
    >
      {code ? (
        <>
          <h2>Your request</h2>
          <DeletionStatus initialCode={code} />
        </>
      ) : null}

      <h2>1. The short version</h2>
      <p>
        <strong>
          There is no button in FieldQuo that deletes an account, and deletion
          is not automatic.
        </strong>{" "}
        You send us a written request — by email, or with the form in Section
        3 — and we confirm by email that we have received it. The deletion
        itself is then carried out manually by FieldQuo&apos;s owner within{" "}
        {DELETION_BUSINESS_DAYS} business days, and you receive a second email
        when it is done. Every request gets a reference you can quote back to
        us and use to check its status on this page.
      </p>

      <h2>2. Whose data, and who you should ask</h2>
      <p>
        FieldQuo is software that contracting companies — painters, cabinet
        makers, plumbers, landscapers — run their businesses on. That means
        there are two quite different relationships, and which one you are in
        changes who can actually act on your request.
      </p>
      <h3>If you are a homeowner or client of a contractor</h3>
      <p>
        Your name, address, phone number, quotes, invoices, job photos and any
        recorded calls are in FieldQuo because the company you hired put them
        there. For that information{" "}
        <strong>
          the company is the data controller and FieldQuo is its processor
        </strong>{" "}
        — they decide what is collected and what is kept, and we hold it on
        their behalf.
      </p>
      <p>
        So the fastest and most complete route is to ask that company
        directly. They can delete things inside the product that we will not
        delete out from under them, and they hold your primary relationship. If
        you would rather come to us, or the company is unreachable, send us the
        request under Section 3 and tell us which company&apos;s records it
        concerns. We will act on it where we are able to, and otherwise pass it
        to that company on your behalf and tell you we have done so.
      </p>
      <h3>If you are a contractor with a FieldQuo account</h3>
      <p>
        FieldQuo is the controller for your own account information — your
        name, email, company details, billing contacts, and how your staff use
        the product. Requests about that come straight to us.
      </p>

      <h2>3. How to make a request</h2>
      <p>
        A request must be in writing. Either of these works:
      </p>
      <ul>
        <li>
          <strong>Email</strong>{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with the
          subject <strong>Data deletion request</strong>, from the email
          address you signed up with or the one the records are filed under,
          and name the company the records concern. A person reads it and
          replies to confirm we have it within {DELETION_RESPONSE_DAYS} days.
        </li>
        <li>
          <strong>Use the form below.</strong> It records the same request,
          gives you a reference straight away, and sends the confirmation
          email automatically.
        </li>
      </ul>
      <p>Whichever you use, include:</p>
      <ul>
        <li>
          The name of the FieldQuo company whose records the request concerns —
          the contracting business, not FieldQuo.
        </li>
        <li>
          Which of the two relationships in Section 2 you are in: their client,
          or the account holder.
        </li>
        <li>
          The email address or phone number the records are filed under, so we
          can find them. If a quote or invoice number is to hand, that is the
          quickest identifier of all.
        </li>
        <li>What you want deleted — everything, or something specific.</li>
      </ul>
      <p>
        <strong>We will ask you to confirm who you are before deleting
        anything.</strong>{" "}
        That is not a delay tactic. Deletion is
        irreversible and a request arriving from an address we cannot place is
        exactly how one person erases another person&apos;s records.
      </p>

      <h3>Send a deletion request</h3>
      <p>
        Submitting this records your request and emails you a reference. It
        does not delete anything by itself — see Section 4 for what happens
        next.
      </p>
      <DeletionRequestForm />

      <h2>4. What happens next</h2>
      <ul>
        <li>
          <strong>We confirm we have it.</strong> The form sends a confirmation
          email the moment it is submitted, with the date we received the
          request and a reference like <code>FQ-DEL-7K3M9Q</code>. If you
          emailed us instead, a person replies with the same confirmation.
        </li>
        <li>
          <strong>FieldQuo&apos;s owner deletes the data manually.</strong>{" "}
          There is no automated pipeline behind this, and we are not going to
          describe one. A person carries the request out by hand, against the
          database, within {DELETION_BUSINESS_DAYS} business days of receiving
          it. If we need to confirm who you are first, we write to you at the
          address the request came from.
        </li>
        <li>
          <strong>We confirm when it is done.</strong> You receive an email
          saying your data was deleted, with the date and your reference. Where
          something had to be kept under Section 6, the email says so rather
          than quietly skipping it.
        </li>
        <li>
          <strong>You can check on it any time.</strong> Open this page with
          your reference —{" "}
          <code>fieldquo.com/data-deletion?code=YOUR-REFERENCE</code> — and it
          shows whether the request is received or completed, and the dates.
          The status line shows dates and a status only, never who asked.
        </li>
      </ul>

      <h2>5. What can be deleted in the product today</h2>
      <p>
        Some things a company&apos;s own staff can delete themselves, without
        writing to us at all:
      </p>
      <ul>
        <li>
          <strong>A client record</strong> — but only if that client has no
          quotes and no invoices on file. A client with any billing history is
          refused by the product, because deleting them would orphan financial
          records the company may be required to keep.
        </li>
        <li>
          Individual quotes, invoices, jobs, tasks, appointments, expenses,
          photos, marketing campaigns and subscriber records, each from its own
          screen.
        </li>
        <li>
          <strong>A connected Meta (Facebook) ad account</strong> — see Section
          7, which is the one deletion in this list that is genuinely immediate
          and complete.
        </li>
      </ul>
      <p>
        Anything beyond that — including deleting an entire account — is a
        written request handled by a person, as Section 3 describes.
      </p>

      <h2>6. What we do not delete, and why</h2>
      <p>
        We would rather list these than let you find out afterwards.
      </p>
      <ul>
        <li>
          <strong>Nothing expires on a schedule.</strong>{" "}
          FieldQuo has no
          retention job. Records are not aged out after a year, or ever, unless
          somebody deletes them. If a company&apos;s subscription lapses its
          account becomes inaccessible — nobody can sign in — but the
          underlying records are not erased by that.
        </li>
        <li>
          <strong>Unsubscribe and STOP records are kept permanently, by
          design.</strong>{" "}
          An opt-out is a standing instruction, and the only
          way to keep honouring it is to still have the record that it was
          given. Deleting it would put you back on a list. If you want to be
          removed from a company&apos;s marketing, the opt-out link or replying
          STOP is the thing that works — not a deletion request.
        </li>
        <li>
          <strong>Financial and tax records.</strong> Invoices, payments and
          the accounting trail behind them are records a business is generally
          required to retain. Where a deletion request would remove one, we
          will say so in our reply rather than quietly skip it.
        </li>
        <li>
          <strong>Records belonging to a contractor&apos;s business rather than
          to you.</strong>{" "}
          Where FieldQuo is only the processor, we do not
          delete a company&apos;s data on a third party&apos;s instruction. We
          pass the request on.
        </li>
        <li>
          <strong>The record of your deletion request itself.</strong> We keep
          the reference, the address the confirmation went to, and the dates —
          it is the proof that you asked and that we did it.
        </li>
      </ul>

      <h2>7. Meta (Facebook / Instagram) — what we hold and how to remove it</h2>
      <p>
        A FieldQuo company can connect its Meta ad account so its advertising
        spend appears beside the jobs that spend produced. Two things about
        that connection are worth stating plainly, because they are narrower
        than people expect:
      </p>
      <ul>
        <li>
          <strong>FieldQuo does not offer Facebook Login.</strong> You cannot
          sign in to FieldQuo with a Facebook account, and we hold no Facebook
          profile, friend list, page content or post of yours. Accounts here
          are email and password.
        </li>
        <li>
          <strong>The connection is read-only and requests one
          permission,</strong> <code>ads_read</code>. FieldQuo reads advertising
          spend figures for the ad account you choose. It cannot create, edit
          or delete a campaign, and it does not read anything about individual
          Facebook or Instagram users.
        </li>
      </ul>
      <p>What we store from that connection, and nothing else:</p>
      <ul>
        <li>
          The ad account&apos;s Meta ID, its name and its currency, so the
          figures can be labelled and converted.
        </li>
        <li>
          An access token, encrypted at rest, and the date it expires. The
          token is never shown in the product and never sent to a browser.
        </li>
        <li>
          The imported spend totals themselves — amounts per campaign per day.
        </li>
      </ul>
      <p>
        <strong>To remove it:</strong>{" "}
        in FieldQuo, go to Settings, then Meta
        Ads, and choose Disconnect. That deletes the stored connection row
        outright, encrypted token included — it is not a status flag, and there
        is nothing left to reconnect to. You can also revoke FieldQuo&apos;s
        access from Meta&apos;s own side, under Settings &amp; Privacy →
        Settings → Business Integrations on Facebook, which stops the token
        working whether or not you have disconnected here.
      </p>
      <p>
        <strong>If you remove the FieldQuo app from your Facebook settings,</strong>{" "}
        Meta notifies us and we register a deletion request for you the same
        way as the form above: you get a reference and a link to this page from
        Meta, the request is carried out manually by FieldQuo&apos;s owner
        within {DELETION_BUSINESS_DAYS} business days, and the status line at
        that link shows when it is done. Meta gives us your app-scoped user
        ID and no email address, so if you want the confirmation in writing,
        send the form above as well and quote the reference.
      </p>
      <p>
        Imported spend totals stay after a disconnect, because they are the
        company&apos;s own marketing history and removing them would silently
        change its past reports. To have those deleted as well, say so in your
        request under Section 3 and we will remove them.
      </p>

      <h2>8. Deleting your whole FieldQuo account</h2>
      <p>
        Send the request under Section 3 from the account&apos;s owner address.
        We will confirm it is you, tell you what will be removed and what must
        be retained under Section 6, and carry it out by hand.
      </p>
      <p>
        Before you ask: <strong>export anything you still want first.</strong>{" "}
        Deletion is not reversible, and FieldQuo does not keep a copy for you
        afterwards.
      </p>

      <h2>9. If we get it wrong</h2>
      <p>
        If you are not satisfied with how a request was handled, say so in
        reply and it goes to FieldQuo&apos;s person in charge of the protection
        of personal information, whose name and contact details are published
        on the <Link href="/privacy">Privacy Policy</Link>. Depending on where
        you live you may also have the right to complain to a data protection
        authority — in Canada, the Office of the Privacy Commissioner, or the
        Commission d&apos;accès à l&apos;information in Quebec.
      </p>
    </LegalDocument>
  );
}
