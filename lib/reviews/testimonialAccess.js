// lib/reviews/testimonialAccess.js
//
// The three things all four testimonial handlers need, in one place.
//
// Not because they are long, but because they must agree. The ordering here is
// the ordering /api/settings/website uses to pick which six reviews reach the
// public site; if the management screen sorted differently, the contractor
// would reorder the list and publish a different six than the one they saw.
// Copied into each route, that is exactly the divergence AGENTS.md calls the
// copy-paste failure class — the copy rots because nobody looks at it.
//
// It also cannot live in a route.js: Next 16 route files may only export HTTP
// method handlers and the recognised segment config.

import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";

export const TESTIMONIAL_SELECT = {
  id: true,
  authorName: true,
  authorTitle: true,
  companyLabel: true,
  quote: true,
  approved: true,
  sortOrder: true,
  source: true,
  createdAt: true,
};

export const TESTIMONIAL_ORDER = [
  { featured: "desc" },
  { sortOrder: "asc" },
  { createdAt: "asc" },
];

// How many of a company's reviews the public site will actually show. The
// cap and the approved-only filter both mirror /api/settings/website, so the
// screen can print a number that matches reality instead of a total that
// implies more is published than is.
export const PUBLISHED_LIMIT = 6;

export function publishedCount(testimonials) {
  return Math.min(testimonials.filter((t) => t.approved).length, PUBLISHED_LIMIT);
}

// Returns a refusal response, or null to proceed. Same gate as every other
// settings route — there is no `settings:edit` permission in this codebase,
// `user:manage` is the admin role.
export function refuseUnlessAdmin(member) {
  try {
    requirePermission(member.role, "user:manage");
    return null;
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage reviews" },
      { status: 403 },
    );
  }
}
