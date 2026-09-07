import { getAdminSessionFromRequest } from "@/lib/auth";
import { getDb } from "@/db";
import { batches, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const { id: rawId } = await context.params;
    const batchId = decodeURIComponent(rawId);
    const body = await request.json() as Record<string, unknown>;

    const updateData: Partial<typeof batches.$inferInsert> = {};
    if (typeof body.capacity === "number") updateData.capacity = body.capacity;
    if (typeof body.status === "string") updateData.status = body.status;
    if (typeof body.registrationDeadline !== "undefined") {
      updateData.registrationDeadline = body.registrationDeadline ? String(body.registrationDeadline) : null;
    }
    if (typeof body.startDate === "string") updateData.startDate = body.startDate;
    if (typeof body.endDate === "string") updateData.endDate = body.endDate;
    if (typeof body.startTime === "string") updateData.startTime = body.startTime;
    if (typeof body.endTime === "string") updateData.endTime = body.endTime;
    if (typeof body.venue === "string") updateData.venue = body.venue;
    if (typeof body.enabled === "boolean") updateData.enabled = body.enabled;

    const db = getDb();
    await db.update(batches).set(updateData).where(eq(batches.id, batchId));

    try {
      await db.insert(auditLogs).values({
        actor: session.username,
        action: "BATCH_UPDATED",
        entityType: "BATCH",
        entityId: batchId,
        timestamp: new Date(),
        metadata: JSON.stringify(updateData),
      });
    } catch {
      // Non-blocking
    }

    return Response.json({ success: true, batchId, updated: updateData });
  } catch (err) {
    console.error("admin_patch_batch_failed", err);
    return Response.json({ error: "Failed to update batch configuration." }, { status: 500 });
  }
}
