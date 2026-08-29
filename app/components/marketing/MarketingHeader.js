// app/components/marketing/MarketingHeader.js
"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import { useSession } from "@/lib/auth-client";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useIndustryLabels } from "@/app/hooks/useIndustryLabels";
import Logo from "@/app/components/Logo";

// Only hrefs and keys live here — the visible strings come from the catalog,
// so this array doesn't need duplicating per language.
const PRODUCT_ITEMS = [
  { key: "quoting", href: "/product/quoting" },
  { key: "scheduling", href: "/product/scheduling" },
  { key: "team", href: "/product/team" },
  { key: "analytics", href: "/product/analytics" },
  // ── The four page sets that existed and could not be reached ────────────
  //
  // /features (24 pages), /compare (four named competitors), /savings and
  // /glossary (100 terms) all shipped with no link anywhere on the site. Built
  // and unreachable is not built, and reporting them as done was wrong.
  //
  // They go here rather than in a fifth top-level nav item because this menu is
  // already "what the product does", and a header with six items is how a
  // header stops being read at all.
  { key: "allFeatures", href: "/features" },
  { key: "compare", href: "/compare" },
];

function UserAvatar({ user, size = 36 }) {
  const initials = (user?.name || user?.email || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  if (user?.image) {
    return (
      <Image
        src={user.image}
        alt={user?.name || "Profile"}
        width={size}
        height={size}
        className="rounded-full object-cover"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0"
    >
      {initials || "?"}
    </div>
  );
}

export default function MarketingHeader() {
  const pathname = usePathname();
  const { t } = useTranslation();
  // Trade names in the visitor's language. app/data/industries.js only
  // carries English ones; see the hook.
  const industries = useIndustryLabels();
  const { data: session, isPending } = useSession();
  const isLoggedIn = !isPending && !!session?.user;

  const [productOpen, setProductOpen] = useState(false);
  const [industriesOpen, setIndustriesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(null);

  const productTimer = useRef(null);
  const industriesTimer = useRef(null);

  const openDropdown = (setter, ref) => {
    if (ref.current) clearTimeout(ref.current);
    setter(true);
  };

  const closeDropdown = (setter, ref) => {
    ref.current = setTimeout(() => setter(false), 150);
  };

  const isActivePrefix = (prefix) => pathname?.startsWith(prefix);

  const closeMobile = () => {
    setMobileOpen(false);
    setMobilePanel(null);
  };

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          {/* The real mark. The horizontal lockup already contains the
              wordmark, so no text beside it. */}
          <Logo variant="horizontal" href="/" height={30} priority />

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {/* Product dropdown */}
            <div
              className="relative"
              onMouseEnter={() => openDropdown(setProductOpen, productTimer)}
              onMouseLeave={() => closeDropdown(setProductOpen, productTimer)}
            >
              <button
                type="button"
                className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md ${
                  isActivePrefix("/product")
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("nav.product")} <ChevronDown size={14} />
              </button>

              {productOpen && (
                <div className="absolute top-full left-0 pt-2 w-80">
                  <div className="bg-card rounded-xl shadow-lg border border-border p-3">
                    {PRODUCT_ITEMS.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-3 py-2.5 rounded-lg hover:bg-muted"
                      >
                        <div className="text-sm font-medium text-foreground">
                          {t(`product.${item.key}.label`)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t(`product.${item.key}.description`)}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Industries dropdown */}
            <div
              className="relative"
              onMouseEnter={() =>
                openDropdown(setIndustriesOpen, industriesTimer)
              }
              onMouseLeave={() =>
                closeDropdown(setIndustriesOpen, industriesTimer)
              }
            >
              <button
                type="button"
                className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md ${
                  isActivePrefix("/industries")
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("nav.industries")} <ChevronDown size={14} />
              </button>

              {/* w-[32rem], not w-lg — Tailwind has no `w-lg` utility, so the
                  panel had no width at all and collapsed to its content. */}
              {industriesOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-[32rem] max-w-[calc(100vw-2rem)]">
                  <div className="bg-card rounded-xl shadow-lg border border-border p-4 grid grid-cols-2 gap-1">
                    {industries.map((ind) => (
                      <Link
                        key={ind.slug}
                        href={`/industries/${ind.slug}`}
                        className="px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted hover:text-foreground"
                      >
                        {ind.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/pricing"
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                pathname === "/pricing"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("nav.pricing")}
            </Link>
            {/* Beside the price, because "what would it save me" is the same
                question as "what does it cost" and gets asked in the same
                breath. */}
            <Link
              href="/savings"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {t("nav.savings", "Savings")}
            </Link>

            <Link
              href="/resources"
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                isActivePrefix("/resources")
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("nav.resources")}
            </Link>
          </nav>

          {/* Desktop right side */}
          <div className="hidden lg:flex items-center gap-3">
            {/* ThemeToggle is hidden until components use semantic colour
                tokens — see DARK_MODE_ENABLED in ThemeProvider. */}
            <LanguageSwitcher compact />

            {/* No phone control here. The one that used to sit in this slot was
                a 555 placeholder — a tappable "call us" on mobile that dialled
                a number nobody owns. /contact is the real channel until there
                is a real line to publish. */}

            {isPending ? (
              <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
            ) : isLoggedIn ? (
              <Link href="/app" aria-label="Go to dashboard">
                <UserAvatar user={session.user} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2"
                >
                  {t("nav.login")}
                </Link>

                <Link
                  href="/signup"
                  className="text-sm font-semibold bg-brand-accent text-brand-accent-foreground px-4 py-2.5 rounded-full hover:brightness-95 transition"
                >
                  {t("nav.signup")}
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <div className="lg:hidden flex items-center gap-3">
            {isLoggedIn && !isPending && (
              <Link href="/app" aria-label="Go to dashboard">
                <UserAvatar user={session.user} size={32} />
              </Link>
            )}
            <button
              type="button"
              className="p-2"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-card lg:hidden overflow-y-auto">
          <div className="flex items-center justify-between h-16 px-4 border-b border-border">
            {mobilePanel ? (
              <button
                type="button"
                onClick={() => setMobilePanel(null)}
                className="text-sm font-medium text-muted-foreground"
              >
                ← Back
              </button>
            ) : (
              <Link href="/" onClick={closeMobile} className="font-bold">
                FieldQuo
              </Link>
            )}

            <button type="button" onClick={closeMobile} aria-label="Close menu">
              <X size={22} />
            </button>
          </div>

          <div className="p-4">
            {!mobilePanel && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setMobilePanel("product")}
                  className="w-full flex items-center justify-between px-3 py-3 text-left text-base font-medium"
                >
                  {t("nav.product")}{" "}
                  <ChevronDown size={16} className="-rotate-90" />
                </button>

                <button
                  type="button"
                  onClick={() => setMobilePanel("industries")}
                  className="w-full flex items-center justify-between px-3 py-3 text-left text-base font-medium"
                >
                  {t("nav.industries")}{" "}
                  <ChevronDown size={16} className="-rotate-90" />
                </button>

                <Link
                  href="/pricing"
                  onClick={closeMobile}
                  className="block px-3 py-3 text-base font-medium"
                >
                  {t("nav.pricing")}
                </Link>

                <Link
                  href="/resources"
                  onClick={closeMobile}
                  className="block px-3 py-3 text-base font-medium"
                >
                  {t("nav.resources")}
                </Link>

                <div className="pt-4 mt-4 border-t border-border space-y-3">
                  {isLoggedIn ? (
                    <Link
                      href="/app"
                      onClick={closeMobile}
                      className="flex items-center gap-3 px-3 py-3 text-base font-medium text-foreground"
                    >
                      <UserAvatar user={session.user} size={28} />
                      {t("nav.dashboard")}
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        onClick={closeMobile}
                        className="block px-3 py-3 text-base font-medium text-muted-foreground"
                      >
                        {t("nav.login")}
                      </Link>

                      <Link
                        href="/signup"
                        onClick={closeMobile}
                        className="block text-center bg-brand-accent text-brand-accent-foreground px-4 py-3 rounded-full font-semibold"
                      >
                        {t("nav.signup")}
                      </Link>
                    </>
                  )}

                  <div className="px-3">
                    <LanguageSwitcher />
                  </div>
                </div>
              </div>
            )}

            {mobilePanel === "product" && (
              <div className="space-y-1">
                {PRODUCT_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    className="block px-3 py-3"
                  >
                    {/* Same t() calls as the desktop dropdown. PRODUCT_ITEMS
                        carries keys and hrefs only, so item.label/description
                        were undefined here — four blank tap targets. */}
                    <div className="text-base font-medium">
                      {t(`product.${item.key}.label`)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {t(`product.${item.key}.description`)}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {mobilePanel === "industries" && (
              <div className="grid grid-cols-1 gap-1">
                {industries.map((ind) => (
                  <Link
                    key={ind.slug}
                    href={`/industries/${ind.slug}`}
                    onClick={closeMobile}
                    className="px-3 py-3 text-base"
                  >
                    {ind.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
