// app/components/marketing/MarketingHeader.js
"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X, Phone } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import { INDUSTRIES } from "@/app/data/industries";

const PRODUCT_ITEMS = [
  {
    label: "Quotes & Invoicing",
    href: "/product/quoting",
    description: "Build and send professional quotes in minutes",
  },
  {
    label: "Scheduling & Dispatch",
    href: "/product/scheduling",
    description: "Calendly-style booking, appointments, and job assignment",
  },
  {
    label: "Team & Payroll",
    href: "/product/team",
    description: "Timesheets, contractor payouts, role-based access",
  },
  {
    label: "Analytics & AI",
    href: "/product/analytics",
    description: "Know your numbers — and what to do about them",
  },
];

export default function MarketingHeader() {
  const pathname = usePathname();

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
                Product <ChevronDown size={14} />
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
                          {item.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {item.description}
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
                Industries <ChevronDown size={14} />
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
              Pricing
            </Link>

            <Link
              href="/resources"
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                isActivePrefix("/resources")
                  ? "text-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Resources
            </Link>
          </nav>

          {/* Desktop right side */}
          <div className="hidden lg:flex items-center gap-3">
            <LanguageSwitcher compact />

            <a
              href="tel:+18195551234"
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              <Phone size={14} /> (819) 555-1234
            </a>

            <Link
              href="/app/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2"
            >
              Log In
            </Link>

            <Link
              href="/signup"
              className="text-sm font-semibold bg-gray-900 text-white px-4 py-2.5 rounded-full hover:bg-gray-800"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            className="lg:hidden p-2"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
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
                  Product <ChevronDown size={16} className="-rotate-90" />
                </button>

                <button
                  type="button"
                  onClick={() => setMobilePanel("industries")}
                  className="w-full flex items-center justify-between px-3 py-3 text-left text-base font-medium"
                >
                  Industries <ChevronDown size={16} className="-rotate-90" />
                </button>

                <Link
                  href="/pricing"
                  onClick={closeMobile}
                  className="block px-3 py-3 text-base font-medium"
                >
                  Pricing
                </Link>

                <Link
                  href="/resources"
                  onClick={closeMobile}
                  className="block px-3 py-3 text-base font-medium"
                >
                  Resources
                </Link>

                <a
                  href="tel:+18195551234"
                  className="flex items-center gap-2 px-3 py-3 text-base font-medium text-gray-600"
                >
                  <Phone size={16} /> (819) 555-1234
                </a>

                <div className="pt-4 mt-4 border-t border-gray-100 space-y-3">
                  <Link
                    href="/app/login"
                    onClick={closeMobile}
                    className="block px-3 py-3 text-base font-medium text-gray-600"
                  >
                    Log In
                  </Link>

                  <Link
                    href="/signup"
                    onClick={closeMobile}
                    className="block text-center bg-gray-900 text-white px-4 py-3 rounded-full font-semibold"
                  >
                    Start Free Trial
                  </Link>

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
