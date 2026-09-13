// What every console screen asks for regardless of page: who is signed in,
// the rail's two badges, the notification poll, and the push-subscription
// block on /platform/settings.
export const ME = { id: "adm1", email: "emilio@fieldquo.com", role: "superadmin", active: true, permissions: ["*"] };

export default function answer({ method, path }) {
  if (path === "/api/platform/me") return ME;
  if (path === "/api/platform/sales/review/count") return { count: 46485 };
  if (path === "/api/platform/signup-origins/count") return { count: 3 };
  if (path === "/api/platform/notifications/count") return { tickets: 2, escalations: 1 };
  if (path === "/api/platform/push-subscription") return { configured: true, publicKey: "BHarnessKey", live: 0 };
  if (path === "/api/platform/auth/logout" && method === "POST") return { ok: true };
  return undefined;
}
