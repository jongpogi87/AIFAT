import { verifyAdminSession } from "@/lib/firebase/auth-admin";
import { getAdminSessionFromRequest } from "@/lib/auth";
import { getRegistrationRepository } from "@/lib/repositories";
import { getBatch } from "@/lib/batches";

export async function GET(request: Request) {
  const fbSession = await verifyAdminSession(request);
  const legacySession = fbSession ? null : await getAdminSessionFromRequest(request);

  if (!fbSession && !legacySession) {
    return Response.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase();
    const aor = url.searchParams.get("aor")?.trim();
    const batchId = url.searchParams.get("batchId")?.trim();
    const status = url.searchParams.get("status")?.trim();

    const regRepo = getRegistrationRepository();
    let rows = await regRepo.getAllRegistrations({
      aorCode: aor || undefined,
      batchId: batchId || undefined,
    });

    if (status) {
      rows = rows.filter((r) => r.registrationStatus === status);
    }

    if (q) {
      rows = rows.filter((r) => {
        const fullName = r.learner
          ? `${r.learner.lastName}, ${r.learner.firstName} ${r.learner.middleName}`.toLowerCase()
          : (r as any).fullName?.toLowerCase() || "";
        const email = (r.learner?.email || (r as any).email || "").toLowerCase();
        const ref = (r.referenceNumber || "").toLowerCase();
        const contact = (r.learner?.contactNumber || (r as any).contactNumber || "").toLowerCase();
        return fullName.includes(q) || email.includes(q) || ref.includes(q) || contact.includes(q);
      });
    }

    const enriched = rows.map((r) => {
      const b = r.batch || getBatch(r.batchId);
      const l = r.learner;
      return {
        id: r.id,
        referenceNumber: r.referenceNumber,
        learnerId: r.learnerId,
        fullName: l ? `${l.lastName}, ${l.firstName} ${l.middleName || ""}`.trim() : (r as any).fullName || "",
        email: l?.email || (r as any).email || "",
        contactNumber: l?.contactNumber || (r as any).contactNumber || "",
        aor: r.aorCode,
        batchId: r.batchId,
        courseQualification: r.courseQualification || "Artificial Intelligence Fundamentals and Applications In-House Training (AIFAT)",
        rank: null,
        unit: null,
        serviceCategory: null,
        registrationStatus: r.registrationStatus,
        registrationTimestamp: r.createdAt,
        attendanceStatus: r.attendanceStatus,
        completionStatus: r.completionStatus,
        certificationStatus: r.certificationStatus,
        createdAt: r.createdAt,
        // Detailed TESDA profile
        lastName: l?.lastName || "",
        firstName: l?.firstName || "",
        middleName: l?.middleName || "",
        extensionName: l?.extensionName || "",
        street: l?.street || "",
        barangay: l?.barangay || "",
        cityMunicipality: l?.cityMunicipality || "",
        province: l?.province || "",
        region: l?.region || "",
        sex: l?.sex || "",
        civilStatus: l?.civilStatus || "",
        birthdate: l?.birthdate || "",
        age: l?.age || null,
        employmentStatus: l?.employmentStatus || "",
        employmentType: l?.employmentType || "",
        educationalAttainment: l?.educationalAttainment || "",
        learnerClassification: l?.learnerClassification || "",
        classificationOthers: l?.classificationOthers || "",
        isScholar: l?.isScholar || false,
        scholarshipPackage: l?.scholarshipPackage || "",
        scholarshipPackageOthers: l?.scholarshipPackageOthers || "",
        uliNumber: (l as any)?.uliNumber || "",
        entryDate: (l as any)?.entryDate || "",
        disabilityType: (l as any)?.disabilityType || "",
        disabilityCauses: (l as any)?.disabilityCauses || "",
        classDesignation: b?.classDesignation || "",
        deliveryMode: b?.deliveryMode || "",
        session: b?.session || "",
        venue: b?.venue || "",
      };
    });

    return Response.json({
      learners: enriched,
      count: enriched.length,
    });
  } catch (error) {
    console.error("fetch_learners_failed", error);
    return Response.json({ error: "Failed to fetch learner records." }, { status: 500 });
  }
}
