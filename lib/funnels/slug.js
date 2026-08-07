// lib/funnels/slug.js
//
// Funnel slugs are the public URL segment (/f/<company>/<slug>) and are unique
// per company. Kept ASCII, lowercase, hyphenated — a slug is typed onto a QR
// code and read aloud, so it has to be plain.

export function slugifyFunnel(name) {
  const base = String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return base || "funnel";
}

// Append -2, -3… until the slug is free within the company. No Math.random —
// the sequence is deterministic and readable.
export async function uniqueFunnelSlug(db, companyId, desired, excludeId = null) {
  let slug = desired;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await db.funnel.findFirst({
      where: { companyId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return slug;
    n += 1;
    slug = `${desired}-${n}`;
  }
}
