// app/site/[subdomain]/not-found.js
//
// The 404 for a contractor's own website, on their own hostname.
//
// This file exists to KEEP SOMETHING OUT rather than to put something in.
// app/not-found.js is a FieldQuo-branded page — header, logo, footer, links to
// FieldQuo's pricing. Without a closer boundary it would answer every bad path
// on sunset.fieldquo.com, which is precisely the leak the white-label rule
// forbids: a homeowner reading a contractor's website would learn which
// software the contractor uses, from a page the contractor never wrote.
//
// So: plain, unbranded, and short. "/" is the tenant's own homepage — same
// host, and middleware rewrites it back to /site/<subdomain>.
//
// The tenant's own logo and brand colour are deliberately not used. not-found.js
// receives no params (a Next constraint, not an oversight), so the subdomain
// isn't available here; inventing a brand for a page that can't know whose it
// is would be worse than plain type.
import Link from "next/link";

export default function SiteNotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900">
        Page not found
      </h1>
      <p className="mt-3 text-neutral-600 max-w-md">
        This page may have moved, or the link may be incomplete.
      </p>
      <Link
        href="/"
        className="mt-6 underline text-neutral-900 underline-offset-4"
      >
        Go to the homepage
      </Link>
    </div>
  );
}
