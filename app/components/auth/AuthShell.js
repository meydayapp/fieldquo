// app/components/auth/AuthShell.js
//
// The frame both /login and /signup sit in.
//
// ══ What was wrong with it ═════════════════════════════════════════════════
//
// A `max-w-sm` card centred in `bg-muted`. On a phone that is exactly right —
// which is why the mobile layout below is barely changed. On a 1440px monitor
// it was a 384px card with 530px of flat pale blue on either side of it, and
// the owner's word for it was "plain". These two pages are the end of every
// marketing funnel we have (/features, /compare, /savings, /glossary,
// /pricing), every one of which is a two-column page with something substantive
// beside the argument. They were the only pages that stopped making one.
//
// So: one column below `lg`, two above it, with the FORM first in the DOM. The
// order is not decorative. A contractor on a phone in a driveway must reach the
// email field by scrolling past a heading, not past a marketing panel — putting
// the panel second and letting the grid place it on the right is what gets both
// without an `order-*` swap that reading order would then disagree with.
//
// ══ Themes ═════════════════════════════════════════════════════════════════
//
// Every colour here is a token that app/globals.css defines under BOTH `:root`
// and `.dark`, and nothing is painted only inside a `dark:` variant. That is
// currently belt-and-braces: ThemeProvider's isThemeablePath allow-list covers
// /app and /platform only, so these two routes render light whatever the OS
// says, deliberately — a stranger comparing three contractors must not get a
// dark page because their laptop is dark. The rule is kept anyway because
// "light because the allow-list says so" and "light because the dark value was
// never written" look identical until the allow-list grows, and
// scripts/check-auth-pages.mjs proves which one this is.

/**
 * @param eyebrow   short line above the title — the funnel step, or "Log in".
 * @param title     the h1.
 * @param subtitle  one sentence under it. A node, not a string, because signup
 *                  passes trialLabel() rather than typing the offer out.
 * @param rail      optional progress rail, between the header and the form.
 * @param aside     the proof column. Omitted on the plan step, which needs the
 *                  full width for its own cards — see app/signup/page.js.
 * @param children  the form column.
 */
export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  rail = null,
  aside = null,
  children,
}) {
  const header = (
    <div>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-accent-text">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-3 text-base text-muted-foreground">{subtitle}</p>
      ) : null}
      {rail ? <div className="mt-6">{rail}</div> : null}
    </div>
  );

  return (
    // The gradient is the homepage hero's, top to bottom, muted into card. A
    // flat --muted was what made the old page read as a holding screen.
    <div className="min-h-[calc(100vh-4rem)] bg-linear-to-b from-muted to-card">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-20">
        {aside ? (
          <div className="grid gap-10 lg:gap-16 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
            <div className="min-w-0">
              {header}
              <div className="mt-8">{children}</div>
            </div>
            {/* Sticky only where there is room to be sticky. On a phone it is
                just the next thing down the page. */}
            <div className="min-w-0 lg:sticky lg:top-24">{aside}</div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-5xl">
            {header}
            <div className="mt-8">{children}</div>
          </div>
        )}
      </div>
    </div>
  );
}
