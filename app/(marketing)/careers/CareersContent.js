// app/(marketing)/careers/CareersContent.js
//
// Client half of /careers. Split from page.js so the route can still export
// metadata — the same split /contact and /resources use.
//
// ── Why there are no listings ───────────────────────────────────────────────
//
// There are no open roles, so the page says exactly that. The alternative —
// a plausible-looking "Field Engineer / Remote / Apply now" that nobody can
// actually be hired into — is the dead-button failure from AGENTS.md wearing
// a different hat, and it costs a stranger the effort of applying.
//
// Nothing here claims a team size, a location, or a hiring plan, because
// nothing in the product or the repo establishes one and a careers page is
// exactly where an invented detail gets quoted back at you.
"use client";

import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";

// The general inbox, not a careers@ alias: hello@ is the address already
// published on the homepage and used as the From on /api/marketing/contact, so
// it is known to be monitored. A careers-specific address that nobody has
// created would bounce.
const CONTACT_EMAIL = "hello@fieldquo.com";

export default function CareersContent() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-4">
        {t("careers.title")}
      </h1>
      <p className="text-muted-foreground leading-relaxed">
        {t("careers.intro")}
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-12 mb-2">
        {t("careers.openRoles.title")}
      </h2>
      <p className="text-muted-foreground leading-relaxed">
        {t("careers.openRoles.body")}
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-12 mb-2">
        {t("careers.speculative.title")}
      </h2>
      <p className="text-muted-foreground leading-relaxed">
        {t("careers.speculative.body")}
      </p>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <Link
          href="/contact"
          className="inline-flex items-center justify-center bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold"
        >
          {t("careers.contactCta")}
        </Link>
        <p className="text-sm text-muted-foreground">
          {t("careers.emailIntro")}{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-foreground underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
