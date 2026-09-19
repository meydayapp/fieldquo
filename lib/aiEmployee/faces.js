// lib/aiEmployee/faces.js
//
// The preset portraits, under public/ai-employees (commit abca8335: 512 px,
// ~55 KB each). A role with a portrait gets it as the default face when
// hired; a role without one (troubleshooter, custom) shows initials until
// the company picks one of the four or uploads its own through /api/upload.
// Any role may wear any of the four — a face is a face.

export const FACES = Object.freeze([
  { key: "closer-m", url: "/ai-employees/closer-m.jpg", forRole: "closer" },
  { key: "receptionist-f", url: "/ai-employees/receptionist-f.jpg", forRole: "receptionist" },
  { key: "dispatcher-m", url: "/ai-employees/dispatcher-m.jpg", forRole: null },
  { key: "marketer-f", url: "/ai-employees/marketer-f.jpg", forRole: null },
]);

export function defaultFaceFor(role) {
  return FACES.find((f) => f.forRole === role)?.url || null;
}

/** Two letters for a face-less employee. */
export function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "AI";
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}
