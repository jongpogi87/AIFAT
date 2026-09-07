import { createAdminSessionCookie } from "@/lib/firebase/auth-admin";

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };
    if (!idToken) {
      return Response.json({ error: "Missing ID token." }, { status: 400 });
    }

    const { session, cookieOptions } = await createAdminSessionCookie(idToken);

    return new Response(
      JSON.stringify({
        success: true,
        user: session,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookieOptions,
        },
      }
    );
  } catch (error: any) {
    console.error("Admin session creation failed:", error);
    return Response.json(
      { error: error?.message || "Administrative authentication failed." },
      { status: 401 }
    );
  }
}
