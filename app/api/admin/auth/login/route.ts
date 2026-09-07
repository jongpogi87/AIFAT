import { getDb } from "@/db";
import { adminUsers } from "@/db/schema";
import { hashPassword, verifyPassword, generateSalt, createSessionToken } from "@/lib/auth";
import { createAdminSessionCookie } from "@/lib/firebase/auth-admin";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string; idToken?: string };

    // 1. If Firebase ID Token is provided directly
    if (body.idToken) {
      const { session, cookieOptions } = await createAdminSessionCookie(body.idToken);
      return new Response(JSON.stringify({ success: true, user: session }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Set-Cookie": cookieOptions },
      });
    }

    const { username, password } = body;
    if (!username || !password) {
      return Response.json({ error: "Username and password are required." }, { status: 400 });
    }

    const cleanUsername = username.trim();

    // 2. Firebase Email/Password authentication via Identity Toolkit
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (apiKey && cleanUsername.includes("@")) {
      try {
        const verifyRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: cleanUsername, password, returnSecureToken: true }),
          }
        );
        const authData = await verifyRes.json();
        if (verifyRes.ok && authData.idToken) {
          const { session, cookieOptions } = await createAdminSessionCookie(authData.idToken);
          return new Response(JSON.stringify({ success: true, user: session }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Set-Cookie": cookieOptions },
          });
        } else if (authData.error?.message) {
          const errMsg =
            authData.error.message === "EMAIL_NOT_FOUND" ||
            authData.error.message === "INVALID_PASSWORD" ||
            authData.error.message === "INVALID_LOGIN_CREDENTIALS"
              ? "Invalid administrator credentials."
              : authData.error.message;
          return Response.json({ error: errMsg }, { status: 401 });
        }
      } catch (err: any) {
        return Response.json({ error: err?.message || "Firebase authentication failed." }, { status: 401 });
      }
    }

    // 3. Check explicit non-production local development admin credentials
    const isLocalDevAdminEnabled =
      process.env.NODE_ENV !== "production" &&
      (process.env.LOCAL_DEV_ADMIN === "true" || process.env.ADMIN_DEV_MODE === "true");

    const envAdminPassword = process.env.ADMIN_INITIAL_PASSWORD;
    const isLocalDevMatch =
      isLocalDevAdminEnabled &&
      cleanUsername === "admin" &&
      (password === (envAdminPassword || "admin") || password === "dev-admin-local");

    const isEnvPasswordMatch =
      Boolean(envAdminPassword) && cleanUsername === "admin" && password === envAdminPassword;

    if (isLocalDevMatch || isEnvPasswordMatch) {
      const legacyToken = await createSessionToken({
        userId: 1,
        username: "admin",
        email: "dev-admin@example.invalid",
        role: "SUPER_ADMIN",
      });
      const isProd = process.env.NODE_ENV === "production";
      const cookie = `aifat_admin_session=${legacyToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 5}${isProd ? "; Secure" : ""}`;
      return new Response(
        JSON.stringify({
          success: true,
          user: { id: 1, username: "admin", email: "dev-admin@example.invalid", role: "SUPER_ADMIN" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
        }
      );
    }

    // 3. Fallback to legacy database check
    try {
      const db = getDb();
      const [user] = await db.select().from(adminUsers).where(eq(adminUsers.username, cleanUsername));

      if (user) {
        const valid = await verifyPassword(password, user.passwordHash, user.salt);
        if (valid) {
          try {
            await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id));
          } catch {}

          const token = await createSessionToken({
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role as "SUPER_ADMIN" | "ADMIN",
          });

          const isProd = process.env.NODE_ENV === "production";
          const cookie = `aifat_admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 5}${isProd ? "; Secure" : ""}`;

          return new Response(
            JSON.stringify({
              success: true,
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Set-Cookie": cookie,
              },
            }
          );
        }
      }
    } catch {
      // Non-blocking
    }

    return Response.json({ error: "Invalid administrative credentials." }, { status: 401 });
  } catch (err: any) {
    console.error("admin_login_failed:", err?.message || "Internal error");
    return Response.json({ error: err?.message || "Authentication failed." }, { status: 500 });
  }
}
