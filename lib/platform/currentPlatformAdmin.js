// lib/platform/currentPlatformAdmin.js
import { jwtVerify } from "jose";

const PLATFORM_SECRET = new TextEncoder().encode(
  process.env.PLATFORM_JWT_SECRET,
);

export async function getCurrentPlatformAdmin(request) {
  const token = request.cookies.get("platform-token")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, PLATFORM_SECRET);
    return { id: payload.adminId, role: payload.role };
  } catch {
    return null;
  }
}
