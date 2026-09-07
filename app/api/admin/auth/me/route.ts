import { verifyAdminSession } from "@/lib/firebase/auth-admin";
import { getAdminSessionFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  // 1. Check Firebase session cookie
  const fbSession = await verifyAdminSession(request);
  if (fbSession) {
    return Response.json({
      authenticated: true,
      user: {
        userId: fbSession.uid,
        username: fbSession.displayName || fbSession.email,
        email: fbSession.email,
        role: fbSession.role,
      },
    });
  }

  // 2. Legacy fallback
  const legacySession = await getAdminSessionFromRequest(request);
  if (legacySession) {
    return Response.json({
      authenticated: true,
      user: {
        userId: legacySession.userId,
        username: legacySession.username,
        email: legacySession.email,
        role: legacySession.role,
      },
    });
  }

  return Response.json({ authenticated: false }, { status: 401 });
}
