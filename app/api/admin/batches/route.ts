import { verifyAdminSession } from "@/lib/firebase/auth-admin";
import { getAdminSessionFromRequest } from "@/lib/auth";
import { getBatchRepository, getRegistrationRepository, getAuditRepository } from "@/lib/repositories";
import { AORS, isDeliveryModeAuthorized } from "@/lib/batches";

export async function GET(request: Request) {
  const fbSession = await verifyAdminSession(request);
  const legacySession = fbSession ? null : await getAdminSessionFromRequest(request);

  if (!fbSession && !legacySession) {
    return Response.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const batchRepo = getBatchRepository();
    const regRepo = getRegistrationRepository();

    const [batches, registrations] = await Promise.all([
      batchRepo.getAllBatches(),
      regRepo.getAllRegistrations(),
    ]);

    const countMap = new Map<string, number>();
    for (const r of registrations) {
      countMap.set(r.batchId, (countMap.get(r.batchId) || 0) + 1);
    }

    const enriched = batches.map((b) => {
      const enrolled = countMap.get(b.batchId) || b.registeredCount || 0;
      const cap = b.capacity ?? 25;
      const remaining = Math.max(0, cap - enrolled);
      return {
        ...b,
        aorName: b.aorName || AORS.find((a) => a.code === b.aorCode)?.name || b.aorCode,
        enrolled,
        remaining,
        isFull: enrolled >= cap,
      };
    });

    return Response.json({ batches: enriched });
  } catch (err) {
    console.error("admin_get_batches_failed", err);
    return Response.json({ error: "Failed to load batches." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const fbSession = await verifyAdminSession(request);
  const legacySession = fbSession ? null : await getAdminSessionFromRequest(request);

  if (!fbSession && !legacySession) {
    return Response.json({ error: "Unauthorized access." }, { status: 401 });
  }

  const actorUid = fbSession?.uid || legacySession?.username || "admin";

  try {
    const body = (await request.json()) as {
      batchId: string;
      capacity?: number;
      status?: "OPEN" | "NEARLY FULL" | "FULL" | "REGISTRATION CLOSED" | "UPCOMING";
      registrationDeadline?: string | null;
      venue?: string;
      enabled?: boolean;
    };

    if (!body.batchId) {
      return Response.json({ error: "Batch ID is required." }, { status: 400 });
    }

    const batchRepo = getBatchRepository();
    const auditRepo = getAuditRepository();

    const existing = await batchRepo.getBatchById(body.batchId);
    if (!existing) {
      return Response.json({ error: "Batch not found." }, { status: 404 });
    }

    const updates: Partial<typeof existing> = {};
    if (typeof body.capacity === "number" && body.capacity > 0) updates.capacity = body.capacity;
    if (body.status) updates.status = body.status;
    if (body.registrationDeadline !== undefined) updates.registrationDeadline = body.registrationDeadline;
    if (body.venue !== undefined) updates.venue = body.venue;
    if (typeof body.enabled === "boolean") updates.enabled = body.enabled;

    const updated = await batchRepo.updateBatch(body.batchId, updates);

    await auditRepo.log({
      actorUid,
      action: "BATCH_UPDATED",
      entityType: "BATCH",
      entityId: body.batchId,
      timestamp: new Date().toISOString(),
      metadata: updates,
    });

    return Response.json({ success: true, batch: updated });
  } catch (err) {
    console.error("admin_patch_batch_failed", err);
    return Response.json({ error: "Failed to update batch." }, { status: 500 });
  }
}
