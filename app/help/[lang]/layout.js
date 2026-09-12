// app/help/[lang]/layout.js
//
// One frame per language. The language is the URL, never a cookie or the
// LanguageProvider's localStorage — a link to a French article opens French
// for whoever clicks it. Unknown languages 404 rather than fall back: the
// list of languages that get a frame is lib/help/chrome.js, and a typo in a
// URL is not a reason to serve English under a made-up code.
//
// Statically generated for every language (dynamicParams = false), so a
// request never renders on demand and the pages can be served from the CDN
// on both hosts — see lib/help/urls.js for the two-host story.
import { notFound } from "next/navigation";
import HelpShell from "@/app/components/help-centre/HelpShell";
import { helpT, isHelpChromeLang, HELP_CHROME_LANGS } from "@/lib/help/chrome";

export const dynamicParams = false;

export function generateStaticParams() {
  return HELP_CHROME_LANGS.map((lang) => ({ lang }));
}

export default async function HelpLangLayout({ children, params }) {
  const { lang } = await params;
  if (!isHelpChromeLang(lang)) notFound();
  const t = helpT(lang);
  return (
    <HelpShell lang={lang} t={t}>
      {children}
    </HelpShell>
  );
}
