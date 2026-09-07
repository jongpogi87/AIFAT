import { getRegistrationRepository } from "@/lib/repositories";
import { getBatch } from "@/lib/batches";

/**
 * Generates privacy-preserving initials from a full name.
 * e.g., "DELA CRUZ, JUAN P." -> "D. C. J. P."
 */
function toInitials(fullName: string): string {
  const parts = fullName.replace(/[^a-zA-Z\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "L. N.";
  return parts.map((p) => p[0].toUpperCase() + ".").join(" ");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ ref: string }> }
) {
  try {
    const { ref } = await context.params;
    if (!ref || typeof ref !== "string") {
      return Response.json({ valid: false, error: "Invalid reference number" }, { status: 400 });
    }

    const cleanRef = ref.trim().toUpperCase();
    const regRepo = getRegistrationRepository();
    const record = await regRepo.getRegistrationByReference(cleanRef);

    if (!record) {
      return Response.json(
        { valid: false, error: "Official registration record not found for this reference number." },
        { status: 404 }
      );
    }

    const batch = record.batch || getBatch(record.batchId);
    const learnerName = record.learner
      ? `${record.learner.lastName}, ${record.learner.firstName} ${record.learner.middleName || ""}`.trim()
      : (record as any).fullName || "";

    // Strict privacy-conscious verification payload:
    // Withhold full email, phone, and specific personal data.
    return Response.json({
      valid: true,
      referenceNumber: record.referenceNumber,
      classDesignation: batch?.classDesignation || "AIFAT-2026",
      deliveryMode: batch?.deliveryMode || "Authorized Mode",
      session: batch?.session || "Prescribed Session",
      aor: record.aorCode,
      learnerInitials: toInitials(learnerName),
      registrationStatus: record.registrationStatus || "CONFIRMED",
      verifiedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("verification_lookup_failed", err);
    return Response.json({ valid: false, error: "Verification is temporarily unavailable." }, { status: 500 });
  }
}
