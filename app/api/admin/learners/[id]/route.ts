import { getAdminSessionFromRequest } from "@/lib/auth";
import { getDb } from "@/db";
import { registrations, learners, auditLogs } from "@/db/schema";
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
    const { id } = await context.params;
    const numId = Number(id);
    if (isNaN(numId)) {
      return Response.json({ error: "Invalid registration ID." }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const updateRegData: Partial<typeof registrations.$inferInsert> = {};

    if (typeof body.registrationStatus === "string") updateRegData.registrationStatus = body.registrationStatus;
    if (typeof body.attendanceStatus === "string") updateRegData.attendanceStatus = body.attendanceStatus;
    if (typeof body.completionStatus === "string") updateRegData.completionStatus = body.completionStatus;
    if (typeof body.certificationStatus === "string") updateRegData.certificationStatus = body.certificationStatus;

    const db = getDb();
    if (Object.keys(updateRegData).length > 0) {
      await db.update(registrations).set(updateRegData).where(eq(registrations.id, numId));
    }

    // Optional: update administrative TESDA fields in learners table if learnerId is present
    const [regRow] = await db.select().from(registrations).where(eq(registrations.id, numId));
    if (regRow?.learnerId) {
      const updateLearnerData: Partial<typeof learners.$inferInsert> = {};
      if (typeof body.uliNumber === "string") updateLearnerData.uliNumber = body.uliNumber;
      if (typeof body.entryDate === "string") updateLearnerData.entryDate = body.entryDate;
      if (typeof body.disabilityType === "string") updateLearnerData.disabilityType = body.disabilityType;
      if (typeof body.disabilityCauses === "string") updateLearnerData.disabilityCauses = body.disabilityCauses;

      if (Object.keys(updateLearnerData).length > 0) {
        await db.update(learners).set(updateLearnerData).where(eq(learners.id, regRow.learnerId));
      }
    }

    try {
      await db.insert(auditLogs).values({
        actor: session.username,
        action: "TESDA_LEARNER_STATUS_UPDATED",
        entityType: "REGISTRATION",
        entityId: String(numId),
        timestamp: new Date(),
        metadata: JSON.stringify(body),
      });
    } catch {
      // Non-blocking
    }

    return Response.json({ success: true, updated: body });
  } catch (err) {
    console.error("admin_patch_learner_failed", err);
    return Response.json({ error: "Failed to update learner status." }, { status: 500 });
  }
}
