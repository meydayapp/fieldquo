// app/embed/not-found.js
//
// Same purpose as app/site/[subdomain]/not-found.js: keep the FieldQuo-branded
// root 404 out of a surface that renders inside a contractor's own website.
//
// /embed/<company>/<widget> is loaded in an iframe on the company's site, and
// notFound() fires there for an unknown company or an unknown widget name. The
// root 404 would drop a full FieldQuo header, industry list and footer into a
// panel sized for a booking form — both a white-label leak and a layout the
// host page never allowed for.
//
// Deliberately terse. The person who needs to see this is the contractor who
// pasted the snippet, not the homeowner reading their page — see the header of
// [companySlug]/[widget]/page.js, which checks the company up front for the
// same reason.
export default function EmbedNotFound() {
  return (
    <div className="p-6 text-sm text-neutral-600">
      This booking form isn&apos;t available. Please check the embed code.
    </div>
  );
}
