// app/verify-email/page.js
//
// A server wrapper, so the language is decided BEFORE the first render: from
// the account the link's token belongs to, then the link's own ?lang=, then
// whoever is signed in on this browser (lib/authLinkLanguage.js). The page
// itself — the confirming, the states, the copy — is ./VerifyEmail.js.
//
// It used to be the client page alone, under the root LanguageProvider, which
// knows nothing about the account and guesses from the browser: the owner's
// English confirmation email opened a Spanish page (lib/authLinks.js header).
import { headers } from "next/headers";
import LinkLanguage from "@/app/components/auth/LinkLanguage";
import { verifyArrivalLanguage } from "@/lib/authLinkLanguage";
import VerifyEmail from "./VerifyEmail";

// Per request: the language depends on the token and the session.
export const dynamic = "force-dynamic";

const one = (v) => (Array.isArray(v) ? v[0] : v);

export default async function VerifyEmailPage({ searchParams }) {
  // Next 16: a Promise.
  const params = await searchParams;
  const language = await verifyArrivalLanguage({
    token: one(params?.token),
    lang: one(params?.lang),
    headers: await headers(),
  });
  return (
    <LinkLanguage language={language}>
      <VerifyEmail />
    </LinkLanguage>
  );
}
