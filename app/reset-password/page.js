// app/reset-password/page.js
//
// A server wrapper, so the language is decided BEFORE the first render: from
// the account the reset token belongs to, then the link's own ?lang= (which
// lib/auth.js puts on the callback), then whoever is signed in on this browser
// (lib/authLinkLanguage.js). The page itself is ./ResetPassword.js.
//
// Same fault as /verify-email had: the reset email was written in the
// account's language and the page it opened guessed from the browser.
import { headers } from "next/headers";
import LinkLanguage from "@/app/components/auth/LinkLanguage";
import { resetArrivalLanguage } from "@/lib/authLinkLanguage";
import ResetPassword from "./ResetPassword";

export const dynamic = "force-dynamic";

const one = (v) => (Array.isArray(v) ? v[0] : v);

export default async function ResetPasswordPage({ searchParams }) {
  const params = await searchParams;
  const language = await resetArrivalLanguage({
    token: one(params?.token),
    lang: one(params?.lang),
    headers: await headers(),
  });
  return (
    <LinkLanguage language={language}>
      <ResetPassword />
    </LinkLanguage>
  );
}
