// app/components/marketing/MarketingHeader.js
"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X, Phone } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "@/app/components/ThemeToggle";
import { INDUSTRIES } from "@/app/data/industries";
import { useSession } from "@/lib/auth-client";
import { useTranslation } from "@/app/hooks/useTranslation";

// Only hrefs and keys live here — the visible strings come from the catalog,
// so this array doesn't need duplicating per language.
const PRODUCT_ITEMS = [
  { key: "quoting", href: "/product/quoting" },
  { key: "scheduling", href: "/product/scheduling" },
  { key: "team", href: "/product/team" },
  { key: "analytics", href: "/product/analytics" },
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
      className="rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold shrink-0"
    >
      {initials || "?"}
    </div>
  );
}

export default function MarketingHeader() {
  const pathname = usePathname();
  const { t } = useTranslation();
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
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-xl font-bold tracking-tight">FieldQuo</span>
          </Link>

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
                    ? "text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t("nav.product")} <ChevronDown size={14} />
              </button>

              {productOpen && (
                <div className="absolute top-full left-0 pt-2 w-80">
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3">
                    {PRODUCT_ITEMS.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-3 py-2.5 rounded-lg hover:bg-gray-50"
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {t(`product.${item.key}.label`)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
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
                    ? "text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t("nav.industries")} <ChevronDown size={14} />
              </button>

              {industriesOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-lg">
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 grid grid-cols-2 gap-1">
                    {INDUSTRIES.map((ind) => (
                      <Link
                        key={ind.slug}
                        href={`/industries/${ind.slug}`}
                        className="px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
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
                  ? "text-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {t("nav.pricing")}
            </Link>

            <Link
              href="/resources"
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                isActivePrefix("/resources")
                  ? "text-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {t("nav.resources")}
            </Link>
          </nav>

          {/* Desktop right side */}
          <div className="hidden lg:flex items-center gap-3">
            <ThemeToggle compact />
            <LanguageSwitcher compact />

            <a
              href="tel:+18195551234"
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              <Phone size={14} /> (819) 555-1234
            </a>

            {isPending ? (
              <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
            ) : isLoggedIn ? (
              <Link href="/app" aria-label="Go to dashboard">
                <UserAvatar user={session.user} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2"
                >
                  {t("nav.login")}
                </Link>

                <Link
                  href="/signup"
                  className="text-sm font-semibold bg-gray-900 text-white px-4 py-2.5 rounded-full hover:bg-gray-800"
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
        <div className="fixed inset-0 z-50 bg-white lg:hidden overflow-y-auto">
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100">
            {mobilePanel ? (
              <button
                type="button"
                onClick={() => setMobilePanel(null)}
                className="text-sm font-medium text-gray-600"
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

                <a
                  href="tel:+18195551234"
                  className="flex items-center gap-2 px-3 py-3 text-base font-medium text-gray-600"
                >
                  <Phone size={16} /> (819) 555-1234
                </a>

                <div className="pt-4 mt-4 border-t border-gray-100 space-y-3">
                  {isLoggedIn ? (
                    <Link
                      href="/app"
                      onClick={closeMobile}
                      className="flex items-center gap-3 px-3 py-3 text-base font-medium text-gray-900"
                    >
                      <UserAvatar user={session.user} size={28} />
                      {t("nav.dashboard")}
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        onClick={closeMobile}
                        className="block px-3 py-3 text-base font-medium text-gray-600"
                      >
                        {t("nav.login")}
                      </Link>

                      <Link
                        href="/signup"
                        onClick={closeMobile}
                        className="block text-center bg-gray-900 text-white px-4 py-3 rounded-full font-semibold"
                      >
                        {t("nav.signup")}
                      </Link>
                    </>
                  )}

                  <div className="px-3 flex flex-wrap items-center gap-3">
                    <LanguageSwitcher />
                    <ThemeToggle />
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
                    <div className="text-base font-medium">{item.label}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {item.description}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {mobilePanel === "industries" && (
              <div className="grid grid-cols-1 gap-1">
                {INDUSTRIES.map((ind) => (
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
