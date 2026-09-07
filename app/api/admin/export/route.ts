import { verifyAdminSession } from "@/lib/firebase/auth-admin";
import { getAdminSessionFromRequest } from "@/lib/auth";
import { getRegistrationRepository, getAuditRepository } from "@/lib/repositories";
import { getBatch } from "@/lib/batches";

function sanitizeCsv(val: string | null | undefined): string {
  if (!val) return '""';
  let str = String(val);
  // CSV Injection prevention (Excel formula trigger characters)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const fbSession = await verifyAdminSession(request);
  const legacySession = fbSession ? null : await getAdminSessionFromRequest(request);

  if (!fbSession && !legacySession) {
    return new Response("Unauthorized", { status: 401 });
  }

  const actorUid = fbSession?.uid || legacySession?.username || "admin";

  try {
    const regRepo = getRegistrationRepository();
    const auditRepo = getAuditRepository();

    const rows = await regRepo.getAllRegistrations();

    const headers = [
      "Reference Number",
      "ULI Number",
      "Full Name",
      "Last Name",
      "First Name",
      "Middle Name",
      "Extension Name",
      "Street",
      "Barangay",
      "City/Municipality",
      "Province",
      "Region",
      "Email Address",
      "Contact Number",
      "Nationality",
      "Sex",
      "Civil Status",
      "Birthdate",
      "Age",
      "Employment Status",
      "Educational Attainment",
      "Learner Classification",
      "Scholarship Package",
      "AOR",
      "Class Designation",
      "Delivery Mode",
      "Session",
      "Course / Qualification",
      "Registration Status",
      "Attendance Status",
      "Completion Status",
      "Certification Status",
      "Registration Date",
    ];

    const lines = [headers.join(",")];

    for (const r of rows) {
      const l = r.learner;
      const b = r.batch || getBatch(r.batchId);
      const fullName = l
        ? `${l.lastName}, ${l.firstName} ${l.middleName || ""}`.trim()
        : (r as any).fullName || "";

      const row = [
        sanitizeCsv(r.referenceNumber),
        sanitizeCsv((l as any)?.uliNumber || ""),
        sanitizeCsv(fullName),
        sanitizeCsv(l?.lastName || ""),
        sanitizeCsv(l?.firstName || ""),
        sanitizeCsv(l?.middleName || ""),
        sanitizeCsv(l?.extensionName || ""),
        sanitizeCsv(l?.street || ""),
        sanitizeCsv(l?.barangay || ""),
        sanitizeCsv(l?.cityMunicipality || ""),
        sanitizeCsv(l?.province || ""),
        sanitizeCsv(l?.region || ""),
        sanitizeCsv(l?.email || (r as any).email || ""),
        sanitizeCsv(l?.contactNumber || (r as any).contactNumber || ""),
        sanitizeCsv(l?.nationality || "Filipino"),
        sanitizeCsv(l?.sex || ""),
        sanitizeCsv(l?.civilStatus || ""),
        sanitizeCsv(l?.birthdate || ""),
        sanitizeCsv(l?.age !== undefined && l?.age !== null ? String(l.age) : ""),
        sanitizeCsv(l?.employmentStatus || ""),
        sanitizeCsv(l?.educationalAttainment || ""),
        sanitizeCsv(l?.learnerClassification || ""),
        sanitizeCsv(l?.isScholar ? l.scholarshipPackage || "Scholar" : "None"),
        sanitizeCsv(r.aorCode),
        sanitizeCsv(b?.classDesignation || "AIFAT-2026"),
        sanitizeCsv(b?.deliveryMode || ""),
        sanitizeCsv(b?.session || ""),
        sanitizeCsv(r.courseQualification || "Artificial Intelligence Fundamentals and Applications In-House Training (AIFAT)"),
        sanitizeCsv(r.registrationStatus),
        sanitizeCsv(r.attendanceStatus),
        sanitizeCsv(r.completionStatus),
        sanitizeCsv(r.certificationStatus),
        sanitizeCsv(typeof r.createdAt === "string" ? r.createdAt : (r.createdAt as Date).toISOString()),
      ];
      lines.push(row.join(","));
    }

    const csvContent = "\uFEFF" + lines.join("\r\n");

    // Audit log
    await auditRepo.log({
      actorUid,
      action: "ROSTER_EXPORTED_CSV",
      entityType: "REGISTRATION_EXPORT",
      entityId: `EXPORT_${Date.now()}`,
      timestamp: new Date().toISOString(),
      metadata: { recordCount: rows.length },
    });

    const filename = `AIFAT-Learner-Roster-TESDA-MIS-03-01-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    console.error("admin_export_failed", err);
    return new Response("Failed to generate export", { status: 500 });
  }
}
