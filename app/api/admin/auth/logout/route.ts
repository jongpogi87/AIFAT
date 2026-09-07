import { revokeAdminSession, verifyAdminSession } from "@/lib/firebase/auth-admin";

export async function POST(request: Request) {
  const fbSession = await verifyAdminSession(request);
  const fbClearCookie = await revokeAdminSession(fbSession?.uid);
  const legacyClearCookie = "aifat_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT";

  const headers = new Headers({
    "Content-Type": "application/json",
  });
  headers.append("Set-Cookie", fbClearCookie);
  headers.append("Set-Cookie", legacyClearCookie);

  return new Response(JSON.stringify({ success: true, message: "Logged out successfully" }), {
    status: 200,
    headers,
  });
}
