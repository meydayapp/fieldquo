// app/components/marketing/MarketingFooter.js
import Link from "next/link";
import { INDUSTRIES } from "@/app/data/industries";

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Quotes & Invoicing", href: "/product/quoting" },
      { label: "Scheduling & Dispatch", href: "/product/scheduling" },
      { label: "Team & Payroll", href: "/product/team" },
      { label: "Analytics & AI", href: "/product/analytics" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Industries",
    links: INDUSTRIES.slice(0, 6).map((ind) => ({
      label: ind.label,
      href: `/industries/${ind.slug}`,
    })),
  },
  {
    title: "Resources",
    links: [
      { label: "Help Center", href: "/resources/help" },
      { label: "FAQ", href: "/resources/faq" },
      { label: "Blog", href: "/resources/blog" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

export default function MarketingFooter() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <span className="text-xl font-bold text-white tracking-tight">
              FieldQuo
            </span>
            <p className="text-sm text-gray-400 mt-3 leading-relaxed">
              The all-in-one platform for contractors and home service pros —
              quotes, scheduling, invoicing, and payments in one place.
            </p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white mb-3">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} FieldQuo. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="tel:+18195551234"
              className="text-sm text-gray-400 hover:text-white"
            >
              (819) 555-1234
            </a>
            <Link
              href="/privacy"
              className="text-sm text-gray-400 hover:text-white"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-gray-400 hover:text-white"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
