// app/email-preferences/[token]/page.js
//
// "Manage email preferences" and "Unsubscribe" from the footer of every
// commercial FieldQuo→contractor email (lib/email/platformLayout.js) — no
// login, often on a phone. ?c=tips (the letter's own category) puts a
// one-button "Unsubscribe from product tips" at the top; the three switches
// sit below it. The page itself changes nothing on load (a mail scanner
// pre-fetching the link must not unsubscribe anybody): every write is a
// button press, which PUTs to app/api/email-preferences/[token].
//
// FieldQuo's name is on this page on purpose: the sender is FieldQuo and the
// reader is FieldQuo's own customer, the carve-out lib/email/billingEmail.js
// describes. No contractor's client ever reaches it.
export const dynamic = "force-dynamic";

import EmailPreferencesPanel from "@/app/components/email/EmailPreferencesPanel";
import { oneClickCategory } from "@/lib/email/preferences";
import { lifecycleLanguage } from "@/lib/i18n/lifecycleEmailCopy";

export const metadata = {
  title: "Email preferences · FieldQuo",
  // A token in a search index would let a stranger change somebody else's
  // email preferences — the unsubscribe page's reasoning.
  robots: { index: false, follow: false },
};

export default async function EmailPreferencesPage({ params, searchParams }) {
  // Next 16: both are Promises.
  const { token } = await params;
  const sp = await searchParams;
  const highlight = oneClickCategory(sp?.c);
  // ?lang= when the letter named one; otherwise the panel uses the language
  // the person's row says, and English when it says nothing.
  const language = sp?.lang ? lifecycleLanguage(sp.lang) : null;
  return (
    <div className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <EmailPreferencesPanel
          endpoint={`/api/email-preferences/${encodeURIComponent(token)}`}
          language={language}
          highlight={highlight}
        />
      </div>
    </div>
  );
}
