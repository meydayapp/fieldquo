// app/q/[token]/add/AddToQuoteFlow.js
//
// The explainer and the three ways through it — see ./page.js for what this
// page may show and why.
//
//   signed in, another company, allowed to edit quotes → the import card
//       (ContractorImportPanel, handed the context this page already has)
//   signed out → "Create your free account" / "Log in", both returning here
//   the sender's own company → nothing to add; say so
//   signed in without quote editing → say who can
//
// Language: a signed-out reader has told FieldQuo nothing about themselves;
// the one signal is the document they were sent, so the page speaks the
// QUOTE's language (setPageLanguage — this render only, stored nowhere). A
// signed-in reader gets their own app language, like the panel under /q.
"use client";

import { useEffect, useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  addToQuotePath,
  addToQuoteCookie,
  clearAddToQuoteCookie,
} from "@/lib/quotes/addToQuoteLink";
import ContractorImportPanel from "../ContractorImportPanel";

export default function AddToQuoteFlow({ token, language, senderName, amount, currency }) {
  const { t, setPageLanguage } = useTranslation();
  const [ctx, setCtx] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/quotes/received/${token}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data) {
          setFailed(true);
          return;
        }
        if (!data.authenticated) setPageLanguage(language);
        else {
          // Back here signed in: the hand-off the signup/login buttons left
          // has done its job.
          try {
            document.cookie = clearAddToQuoteCookie();
          } catch {
            /* blocked cookies: nothing was left to clear */
          }
        }
        setCtx(data);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, language, setPageLanguage]);

  const company = senderName || t("app.addToQuote.theSender");
  const price = formatMoney(amount, currency);
  const here = addToQuotePath(token);

  // Leave the way back for a signup that outlives this tab — see
  // lib/quotes/addToQuoteLink.js. Best-effort: ?next= carries it anyway.
  const rememberHere = () => {
    try {
      const c = addToQuoteCookie(token);
      if (c) document.cookie = c;
    } catch {
      /* blocked cookies: ?next= still brings them back in this tab */
    }
  };

  return (
    <main className="min-h-dvh bg-[#f6f7f9] px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <p className="text-[10px] font-bold tracking-[0.15em] text-[#06356b]/70">FIELDQUO</p>
        <h1 className="mt-2 text-2xl font-bold text-[#2d2520]">{t("app.addToQuote.title")}</h1>
        <p className="mt-2 text-sm text-[#2d2520]/75 leading-relaxed">
          {t("app.addToQuote.intro", { company, price })}
        </p>

        <ol className="mt-6 space-y-4">
          {[
            ["step1Title", "step1Body"],
            ["step2Title", "step2Body"],
            ["step3Title", "step3Body"],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-[#06356b] text-white text-sm font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-[#2d2520]">{t(`app.addToQuote.${title}`)}</p>
                <p className="text-sm text-[#2d2520]/75 leading-relaxed mt-0.5">{t(`app.addToQuote.${body}`, { company })}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-2">
          {!ctx && !failed && (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[#06356b]" aria-label={t("app.addToQuote.loading")} />
            </div>
          )}

          {failed && (
            <p className="mt-6 text-sm text-red-700">{t("app.addToQuote.loadFailed")}</p>
          )}

          {ctx && ctx.canImport && <ContractorImportPanel token={token} initialCtx={ctx} />}

          {ctx && !ctx.authenticated && (
            <div className="mt-6 rounded-2xl border border-[#06356b]/15 bg-[#eef2f7] p-5 sm:p-6">
              <p className="text-sm font-semibold text-[#2d2520]">{t("app.addToQuote.signedOutTitle")}</p>
              <p className="text-sm text-[#2d2520]/75 mt-1">{t("app.addToQuote.signedOutBody")}</p>
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <a
                  href={`/signup?next=${encodeURIComponent(here)}`}
                  onClick={rememberHere}
                  className="inline-flex items-center justify-center bg-[#06356b] text-white px-5 py-3 rounded-full text-sm font-semibold min-h-11"
                >
                  {t("app.addToQuote.createAccount")}
                </a>
                <a
                  href={`/login?next=${encodeURIComponent(here)}`}
                  onClick={rememberHere}
                  className="inline-flex items-center justify-center bg-white text-[#06356b] border border-[#06356b]/30 px-5 py-3 rounded-full text-sm font-semibold min-h-11"
                >
                  {t("app.addToQuote.logIn")}
                </a>
              </div>
            </div>
          )}

          {ctx && ctx.authenticated && ctx.isOwnQuote && (
            <p className="mt-6 text-sm text-[#2d2520]/75">{t("app.addToQuote.ownQuote")}</p>
          )}

          {ctx && ctx.authenticated && !ctx.isOwnQuote && !ctx.canImport && (
            <p className="mt-6 text-sm text-[#2d2520]/75">{t("app.addToQuote.noAccess")}</p>
          )}
        </div>

        <a
          href={`/q/${encodeURIComponent(token)}`}
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-[#06356b] min-h-11"
        >
          {t("app.addToQuote.backToQuote")} <ExternalLink size={13} />
        </a>
      </div>
    </main>
  );
}
