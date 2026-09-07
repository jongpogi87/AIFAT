import { getAdminAuth, getAdminDb } from "./server";

if (typeof window !== "undefined") {
  throw new Error("Firebase Admin Auth can only be imported in server-side modules.");
}

export interface AdminSession {
  uid: string;
  email: string;
  displayName: string;
  role: "SUPER_ADMIN" | "ADMIN";
}

const SESSION_COOKIE_NAME = "__session";
// 5 days in milliseconds (Firebase session cookies support 5 minutes to 2 weeks)
const EXPIRES_IN_MS = 60 * 60 * 24 * 5 * 1000;

/**
 * Creates an authorized Firebase session cookie from an ID token after verifying
 * that the user exists, is enabled, and holds an authorized admin profile.
 */
export async function createAdminSessionCookie(idToken: string): Promise<{ cookie: string; session: AdminSession; cookieOptions: string }> {
  const auth = getAdminAuth();
  const db = getAdminDb();

  // 1. Verify the ID token
  const decodedToken = await auth.verifyIdToken(idToken);
  const uid = decodedToken.uid;

  // 2. Query adminProfiles/{uid}
  const profileDoc = await db.collection("adminProfiles").doc(uid).get();
  if (!profileDoc.exists) {
    throw new Error("User is not authorized for administrative access.");
  }

  const profile = profileDoc.data()!;
  if (!profile.enabled) {
    throw new Error("Administrative account has been disabled.");
  }

  const role = profile.role as "SUPER_ADMIN" | "ADMIN";
  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
    throw new Error("Insufficient administrative privileges.");
  }

  // 3. Create Firebase session cookie
  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: EXPIRES_IN_MS });

  const session: AdminSession = {
    uid,
    email: profile.email || decodedToken.email || "",
    displayName: profile.displayName || decodedToken.name || "Administrator",
    role,
  };

  const isProd = process.env.NODE_ENV === "production";
  const cookieOptions = `${SESSION_COOKIE_NAME}=${sessionCookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${EXPIRES_IN_MS / 1000}${isProd ? "; Secure" : ""}`;

  return { cookie: sessionCookie, session, cookieOptions };
}

/**
 * Verifies the incoming session cookie on server route handlers.
 * Ensures the session is valid, not revoked, and that adminProfiles document is still active and enabled.
 */
export async function verifyAdminSession(request: Request): Promise<AdminSession | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  const sessionCookie = match ? match[1] : null;

  if (!sessionCookie) return null;

  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // Verify session cookie (checkRevoked = true to allow instant revoking)
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;

    // Verify user in adminProfiles collection
    const profileDoc = await db.collection("adminProfiles").doc(uid).get();
    if (!profileDoc.exists) return null;

    const profile = profileDoc.data()!;
    if (!profile.enabled) return null;

    const role = profile.role as "SUPER_ADMIN" | "ADMIN";
    if (!["SUPER_ADMIN", "ADMIN"].includes(role)) return null;

    return {
      uid,
      email: profile.email || decodedClaims.email || "",
      displayName: profile.displayName || decodedClaims.name || "Administrator",
      role,
    };
  } catch {
    return null;
  }
}

/**
 * Revokes all sessions for the given UID and generates a clear cookie header.
 */
export async function revokeAdminSession(uid?: string): Promise<string> {
  if (uid) {
    try {
      const auth = getAdminAuth();
      await auth.revokeRefreshTokens(uid);
    } catch {}
  }
  const isProd = process.env.NODE_ENV === "production";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? "; Secure" : ""}`;
}
