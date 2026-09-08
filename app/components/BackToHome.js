// app/components/BackToHome.js
//
// "Back to home", shown only when a page was opened FROM the home checklist.
//
// The dashboard's setup checklist sends people to a handful of screens with
// `?from=setup` on the link, and each of those screens renders this at the
// top so the way back is one tap rather than a hunt through the sidebar. Off
// the checklist — the same page reached from the nav — it renders nothing:
// a "Back to home" link on a screen you did not come to from home is a claim
// about where you were that this component cannot make.
//
// Deliberately dependency-free beyond next and the translation hook, so any
// page can import it without pulling a provider in: no props, no context of
// its own. useSearchParams needs a Suspense boundary in the App Router, and
// the boundary lives HERE so a page adding this line cannot forget it.
//
// One extra job while it is here. The set-up steps' links carry a fragment
// (`#fixed-costs`, `#quote-wording`… — lib/setupSteps.js) naming a card that
// most of these pages render only AFTER their first fetch resolves, and the
// browser's own scroll-to-fragment runs once, at load, when that element does
// not exist yet. So while `from=setup` is set, this keeps looking for the
// fragment's element for a few seconds and scrolls to it the moment it
// appears — the difference between a link that "takes them to that section"
// and one that lands on the page top.
"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export const BACK_TO_HOME_PARAM = "from";
export const BACK_TO_HOME_VALUE = "setup";

const LOOK_FOR_MS = 4000;
const LOOK_EVERY_MS = 120;

/** Scroll to `#fragment` once the element exists — see the header. */
function useScrollToFragment(enabled) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!id) return undefined;

    let done = false;
    let timer = null;
    const started = Date.now();
    const look = () => {
      if (done) return;
      const el = document.getElementById(id);
      if (el) {
        done = true;
        el.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }
      if (Date.now() - started < LOOK_FOR_MS) {
        timer = window.setTimeout(look, LOOK_EVERY_MS);
      }
    };
    timer = window.setTimeout(look, 0);
    return () => {
      done = true;
      window.clearTimeout(timer);
    };
  }, [enabled]);
}

function BackToHomeLink() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const fromSetup = params?.get(BACK_TO_HOME_PARAM) === BACK_TO_HOME_VALUE;
  useScrollToFragment(fromSetup);
  if (!fromSetup) return null;
  return (
    <Link
      href="/app"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground min-h-9"
      data-back-to-home
    >
      <ArrowLeft size={14} />
      {t("app.backToHome", "Back to home")}
    </Link>
  );
}

export default function BackToHome() {
  return (
    <Suspense fallback={null}>
      <BackToHomeLink />
    </Suspense>
  );
}
