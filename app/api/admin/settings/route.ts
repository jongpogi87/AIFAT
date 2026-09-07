import { verifyAdminSession } from "@/lib/firebase/auth-admin";
import { getAdminSessionFromRequest } from "@/lib/auth";
import { getSettingsRepository, getAuditRepository } from "@/lib/repositories";

export async function GET(request: Request) {
  const fbSession = await verifyAdminSession(request);
  const legacySession = fbSession ? null : await getAdminSessionFromRequest(request);

  if (!fbSession && !legacySession) {
    return Response.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const settingsRepo = getSettingsRepository();
    const settings = await settingsRepo.getSettings();
    return Response.json({ settings });
  } catch (err) {
    console.error("admin_get_settings_failed", err);
    return Response.json({ error: "Failed to load operational settings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const fbSession = await verifyAdminSession(request);
  const legacySession = fbSession ? null : await getAdminSessionFromRequest(request);

  if (!fbSession && !legacySession) {
    return Response.json({ error: "Unauthorized access." }, { status: 401 });
  }

  const role = fbSession?.role || legacySession?.role;
  if (role === "OPERATOR" as any) {
    return Response.json({ error: "Insufficient permissions to update system settings." }, { status: 403 });
  }

  const actorUid = fbSession?.uid || legacySession?.username || "admin";

  try {
    const body = (await request.json()) as Record<string, any>;
    const settingsRepo = getSettingsRepository();
    const auditRepo = getAuditRepository();

    const updated = await settingsRepo.updateSettings(body);

    await auditRepo.log({
      actorUid,
      action: "SETTINGS_UPDATED",
      entityType: "SYSTEM_SETTINGS",
      entityId: "global",
      timestamp: new Date().toISOString(),
      metadata: body,
    });

    return Response.json({ success: true, settings: updated });
  } catch (err) {
    console.error("admin_post_settings_failed", err);
    return Response.json({ error: "Failed to update system settings." }, { status: 500 });
  }
}
