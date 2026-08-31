// app/(marketing)/security/page.js
//
// New page — there was no Security page before this. Every claim below was
// checked against the code that makes it true; see the report that shipped
// with this page for the two claims from the original brief that did NOT
// survive that check (both about what a platform superadmin can view during
// a read-only support session) and what is stated instead.
//
// The one rule that matters most for this specific page: never claim a
// certification FieldQuo doesn't hold. scripts/check-legal-pages.mjs (wired
// into `npm run check:all`) asserts this page contains no SOC 2, ISO 27001,
// or "certified" claim.
import { marketingMetadata } from "@/lib/marketing/metadata";
import { SUPPORT_EMAIL } from "@/lib/supportContact";
import {
  SECURITY_PAGE_UPDATED_DATE,
  formatLegalDate,
} from "@/lib/legal/effectiveDates";
import LegalDocument from "@/app/components/marketing/LegalDocument";

export const metadata = marketingMetadata({
  path: "/security",
  title: "Security — FieldQuo",
  description:
    "How FieldQuo protects the data contractors and their clients put into it.",
});

export default function SecurityPage() {
  return (
    <LegalDocument
      title="Security"
      updatedLabel={`Last updated ${formatLegalDate(SECURITY_PAGE_UPDATED_DATE)}`}
      dek={
        <>
          This page describes security practices that are true of FieldQuo
          today, in plain terms. We are not going to claim a certification we
          don't hold to make this page sound more impressive — see the note
          at the bottom.
        </>
      }
    >
      <h2>Encryption</h2>
      <ul>
        <li>
          <strong>In transit:</strong> FieldQuo is served entirely over
          HTTPS — the app, the API, and every client-facing quote, invoice,
          booking, and portal link. Connections to our database run over TLS,
          as required by our database host.
        </li>
        <li>
          <strong>At rest:</strong> data at rest is encrypted by our
          infrastructure providers by default — Neon for the database,
          Cloudinary for stored photos and documents. We rely on those
          providers' own encryption-at-rest guarantees rather than
          maintaining a separate encryption layer of our own.
        </li>
      </ul>

      <h2>Role-based access, inside a company</h2>
      <p>
        FieldQuo's permission system is granular by design: a company can
        limit what each staff member sees, down to individual categories of
        data. A crew member scheduled to a job can see the job's address and
        details without being handed the company's full client list; an
        estimator can see pricing that a scheduler-only role cannot. These
        limits are enforced on the server for every request that reads or
        writes company data — not just hidden in the interface — so a request
        crafted to skip a hidden button is refused the same way a click on
        that button would be.
      </p>

      <h2>What FieldQuo's own staff can see</h2>
      <p>
        FieldQuo staff do not have standing access to a company's account.
        When a superadmin needs to view one — typically for support — they
        use a dedicated "view as company" session that is:
      </p>
      <ul>
        <li><strong>Read-only.</strong> Every request that would change data is rejected before it reaches the part of the code that would act on it — enforced independently in two separate places, so a gap in one does not become a gap in the account.</li>
        <li><strong>Superadmin-only.</strong> Other FieldQuo staff roles do not have it.</li>
        <li><strong>Time-limited.</strong> The session expires automatically after 30 minutes.</li>
        <li><strong>Logged.</strong> Every time one of these sessions starts and ends is written to an audit trail with the admin's name attached.</li>
      </ul>
      <p>
        We want to be precise about what "read-only" means, rather than let
        the phrase do more work than it should: a read-only support session
        can view the same information a company's own authorized staff can —
        including, for a company using the AI phone receptionist, call
        recordings and transcripts. What it categorically cannot do, under
        any circumstance, is change a customer's data. If your business needs
        FieldQuo staff to be unable to view certain categories of your data
        even during support access — call recordings are the clearest
        example — talk to us; that is a real product boundary we don't
        currently draw, not one we're glossing over.
      </p>

      <h2>Sensitive links aren't shared as raw links</h2>
      <p>
        Two examples of how this is handled in practice. A call recording's
        actual storage location is never put in front of a browser — not on
        a quote, not in an email, not in the app's own markup. A signed-in
        staff member with permission to listen to a call reaches the audio
        through a FieldQuo route that streams it from our servers, so the
        underlying URL never appears in page source, browser history, or a
        forwarded link. Client portal and quote-sharing links use long,
        randomly generated tokens (not sequential or guessable IDs), so
        access to one client's documents doesn't imply access to another's.
      </p>

      <h2>The AI assistant sees a name, not a client file</h2>
      <p>
        FieldQuo's built-in AI assistant answers a company's own staff about
        their own business. Where it needs to reference a specific client to
        answer a question, only that client's <strong>name</strong> is
        included in what reaches the AI model — never their address, phone
        number, email, or financial history. This is enforced by a fixed
        list of what's allowed through, in code, not left to the AI's
        judgement about what's appropriate to share.
      </p>

      <h2>AI phone calls are disclosed as recorded</h2>
      <p>
        For companies using the AI phone receptionist, every call is recorded
        and transcribed, and the AI agent tells the caller so, in its own
        words, early in the call.
      </p>

      <h2>Unsubscribe and opt-out (CASL)</h2>
      <p>
        Every commercial email FieldQuo sends on a company's behalf — a
        marketing campaign, a review request — carries a working, one-click
        unsubscribe link that takes effect immediately; transactional
        messages (a quote, an invoice, a receipt) do not carry one, because
        CASL doesn't require it on those and adding one would invite someone
        to switch off mail they actually need. For text messages, replying{" "}
        <strong>STOP</strong> to a company's own dedicated number opts that
        number out immediately, and <strong>START</strong> opts back in.
      </p>
      <p>
        One current gap, stated plainly rather than left implicit: a company
        that hasn't been assigned its own dedicated texting number, and is
        sending on FieldQuo's shared fallback number, does not yet have a
        working STOP reply on that shared number. We're not going to describe
        this mechanism as complete everywhere until it is.
      </p>

      <h2>What we don't claim</h2>
      <p>
        FieldQuo does not currently hold SOC 2, ISO 27001, or any other
        third-party security certification, and this page will not imply
        otherwise. We think working toward one is worthwhile as the product
        and customer base grow, and may pursue it in the future — but that is
        a forward-looking intention, not a claim about today.
      </p>

      <h2>Reporting a security issue</h2>
      <p>
        If you've found a security issue in FieldQuo, please email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with what you
        found. We'll respond and work with you on it directly.
      </p>
    </LegalDocument>
  );
}
