import { getRegistrationRepository, getBatchRepository, getAuditRepository } from "@/lib/repositories";
import { getAor, isDeliveryModeAuthorized } from "@/lib/batches";
import { notificationService } from "@/lib/notifications";
import {
  TESDA_EDUCATIONAL_ATTAINMENTS,
  TESDA_CIVIL_STATUSES,
  TESDA_EMPLOYMENT_STATUSES,
  TESDA_EMPLOYMENT_TYPES,
  TESDA_LEARNER_CLASSIFICATIONS,
  TESDA_SCHOLARSHIP_PACKAGES,
  DEFAULT_COURSE_QUALIFICATION,
  calculateAge,
} from "@/lib/tesda";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    // 1. Reject privileged or system field injection attempts
    const FORBIDDEN_CLIENT_FIELDS = [
      "uli",
      "role",
      "isAdmin",
      "adminStatus",
      "capacity",
      "registeredCount",
      "classDesignation",
      "registrationStatus",
      "attendanceStatus",
      "completionStatus",
      "certificationStatus",
      "referenceNumber",
      "isTestData",
    ];

    for (const field of FORBIDDEN_CLIENT_FIELDS) {
      if (body[field] !== undefined && body[field] !== null) {
        return Response.json(
          { error: "Privileged, administrative, or read-only fields cannot be submitted." },
          { status: 400 }
        );
      }
    }

    // 2. Validate System Registration Routing Data against Authoritative Repository
    const aor = String(body.aor || "").trim().toUpperCase();
    const batchId = String(body.batchId || "").trim();

    const batchRepo = getBatchRepository();
    const batch = await batchRepo.getBatchById(batchId);
    if (!getAor(aor) || !batch || batch.aorCode !== aor) {
      return Response.json({ error: "The selected AOR and batch combination is not available." }, { status: 400 });
    }

    if (!isDeliveryModeAuthorized(aor, batch.deliveryMode)) {
      return Response.json({ error: "The selected delivery mode is not authorized for this AOR." }, { status: 400 });
    }

    if (!batch.enabled) {
      return Response.json({ error: "This batch is currently unavailable." }, { status: 400 });
    }

    if (batch.status === "FULL") {
      return Response.json(
        { error: "This batch is already full. Please select another available batch." },
        { status: 409 }
      );
    }

    if (batch.status === "CLOSED" || !["OPEN", "NEARLY FULL"].includes(batch.status)) {
      // Registration for this batch is not open
      return Response.json({ error: "Registration for this batch is closed." }, { status: 409 });
    }

    if (batch.registrationDeadline && Date.now() > Date.parse(batch.registrationDeadline)) {
      // Check if registration deadline has passed
      return Response.json({ error: "The registration period for this batch has ended." }, { status: 409 });
    }

    // 2. Validate Learner Name
    const lastName = String(body.lastName || "").trim();
    const firstName = String(body.firstName || "").trim();
    const middleName = String(body.middleName || "").trim();
    const extensionName = String(body.extensionName || "").trim();

    if (!lastName || !firstName) {
      return Response.json({ error: "Last Name and First Name are required." }, { status: 400 });
    }

    const fullNameParts = [lastName + ",", firstName];
    if (middleName) fullNameParts.push(middleName);
    if (extensionName) fullNameParts.push(extensionName);
    const fullName = fullNameParts.join(" ");

    // 3. Validate Permanent Mailing Address
    const street = String(body.street || "").trim();
    const barangay = String(body.barangay || "").trim();
    const district = String(body.district || "").trim();
    const cityMunicipality = String(body.cityMunicipality || "").trim();
    const province = String(body.province || "").trim();
    const region = String(body.region || "").trim();

    if (!street || !barangay || !cityMunicipality || !province || !region) {
      return Response.json({ error: "Complete permanent mailing address is required." }, { status: 400 });
    }

    // 4. Validate Contact & Nationality
    const email = String(body.email || "").trim().toLowerCase();
    const contactNumber = String(body.contactNumber || "").trim();
    const nationality = String(body.nationality || "Filipino").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (!/^[0-9+() -]{7,20}$/.test(contactNumber)) {
      return Response.json({ error: "Enter a valid contact number." }, { status: 400 });
    }

    // 5. Validate Personal Information (Sex, Civil Status, Birthdate, Birthplace)
    const sex = String(body.sex || "").trim();
    if (!["Male", "Female"].includes(sex)) {
      return Response.json({ error: "Please select a valid sex (Male or Female)." }, { status: 400 });
    }

    const civilStatus = String(body.civilStatus || "").trim();
    if (!TESDA_CIVIL_STATUSES.includes(civilStatus as (typeof TESDA_CIVIL_STATUSES)[number])) {
      return Response.json({ error: "Please select a valid civil status." }, { status: 400 });
    }

    const birthdate = String(body.birthdate || "").trim();
    const calculatedAge = calculateAge(birthdate);
    if (calculatedAge === null || calculatedAge < 15 || calculatedAge > 100) {
      return Response.json({ error: "Please enter a valid birthdate." }, { status: 400 });
    }

    if (body.age !== undefined && body.age !== null && body.age !== "") {
      const submittedAge = Number(body.age);
      if (Number.isNaN(submittedAge) || submittedAge !== calculatedAge) {
        return Response.json({ error: "Submitted age does not match the provided birthdate." }, { status: 400 });
      }
    }

    const birthCity = String(body.birthCity || "").trim();
    const birthProvince = String(body.birthProvince || "").trim();
    const birthRegion = String(body.birthRegion || "").trim();
    if (!birthCity || !birthProvince || !birthRegion) {
      return Response.json({ error: "Birthplace details (City/Municipality, Province, Region) are required." }, { status: 400 });
    }

    // 6. Validate Employment Before Training
    const employmentStatus = String(body.employmentStatus || "").trim();
    if (!TESDA_EMPLOYMENT_STATUSES.includes(employmentStatus as (typeof TESDA_EMPLOYMENT_STATUSES)[number])) {
      return Response.json({ error: "Please select your employment status before training." }, { status: 400 });
    }

    let employmentType = "None";
    if (employmentStatus === "Wage-Employed" || employmentStatus === "Underemployed") {
      employmentType = String(body.employmentType || "").trim();
      if (!TESDA_EMPLOYMENT_TYPES.includes(employmentType as (typeof TESDA_EMPLOYMENT_TYPES)[number])) {
        return Response.json({ error: "Please select a valid employment type." }, { status: 400 });
      }
    }

    // 7. Validate Educational Attainment
    const educationalAttainment = String(body.educationalAttainment || "").trim();
    if (!TESDA_EDUCATIONAL_ATTAINMENTS.includes(educationalAttainment as (typeof TESDA_EDUCATIONAL_ATTAINMENTS)[number])) {
      return Response.json({ error: "Please select your educational attainment." }, { status: 400 });
    }

    // 8. Parent / Guardian (Optional)
    const parentGuardianName = String(body.parentGuardianName || "").trim();
    const parentGuardianAddress = String(body.parentGuardianAddress || "").trim();

    // 9. Validate Learner Classification
    const learnerClassification = String(body.learnerClassification || "").trim();
    if (!TESDA_LEARNER_CLASSIFICATIONS.includes(learnerClassification as (typeof TESDA_LEARNER_CLASSIFICATIONS)[number])) {
      return Response.json({ error: "Please select a valid learner classification." }, { status: 400 });
    }

    let classificationOthers = "";
    if (learnerClassification === "Others (Please Specify)") {
      classificationOthers = String(body.classificationOthers || "").trim();
      if (!classificationOthers) {
        return Response.json({ error: "Please specify your learner classification." }, { status: 400 });
      }
    }

    // 10. Validate Scholarship Information
    const isScholar = body.isScholar === true || body.isScholar === "true";
    let scholarshipPackage = "";
    let scholarshipPackageOthers = "";

    if (isScholar) {
      scholarshipPackage = String(body.scholarshipPackage || "").trim();
      if (!TESDA_SCHOLARSHIP_PACKAGES.includes(scholarshipPackage as (typeof TESDA_SCHOLARSHIP_PACKAGES)[number])) {
        return Response.json({ error: "Please select your scholarship package." }, { status: 400 });
      }
      if (scholarshipPackage === "Others") {
        scholarshipPackageOthers = String(body.scholarshipPackageOthers || "").trim();
        if (!scholarshipPackageOthers) {
          return Response.json({ error: "Please specify your scholarship package name." }, { status: 400 });
        }
      }
    }

    // 11. Validate Privacy Consent and Applicant Declaration
    if (body.consent !== true && body.consent !== "Agree") {
      return Response.json({ error: "The required personal information cannot be processed without the necessary privacy consent." }, { status: 400 });
    }

    if (body.applicantCertified !== true) {
      return Response.json({ error: "You must certify that the information provided is true and correct." }, { status: 400 });
    }

    // 12. Delegate atomic registration to repository layer
    const registrationRepo = getRegistrationRepository();
    const auditRepo = getAuditRepository();

    const result = await registrationRepo.registerLearnerAtomic({
      batchId,
      aorCode: aor,
      learner: {
        lastName,
        firstName,
        middleName,
        extensionName,
        fullName,
        street,
        barangay,
        district,
        cityMunicipality,
        province,
        region,
        email,
        contactNumber,
        nationality,
        sex: sex as "Male" | "Female",
        civilStatus,
        employmentStatus,
        employmentType,
        birthdate,
        age: calculatedAge,
        birthCity,
        birthProvince,
        birthRegion,
        educationalAttainment,
        parentGuardianName,
        parentGuardianAddress,
        learnerClassification,
        classificationOthers,
        courseQualification: DEFAULT_COURSE_QUALIFICATION,
        isScholar,
        scholarshipPackage,
        scholarshipPackageOthers,
        privacyConsent: true,
        applicantCertified: true,
      },
    });

    const { registration, batch: authoritativeBatch } = result;

    // Audit log
    try {
      await auditRepo.log({
        actorUid: "LEARNER_SELF_SERVICE",
        action: "TESDA_REGISTRATION_CREATED",
        entityType: "REGISTRATION",
        entityId: registration.referenceNumber,
        timestamp: new Date().toISOString(),
        metadata: { batchId, aor, course: DEFAULT_COURSE_QUALIFICATION },
      });
    } catch {}

    // Confirmation notification
    notificationService
      .sendRegistrationConfirmation({
        referenceNumber: registration.referenceNumber,
        fullName,
        rank: "",
        unit: "",
        email,
        contactNumber,
        classDesignation: authoritativeBatch.classDesignation,
        deliveryMode: authoritativeBatch.deliveryMode,
        session: authoritativeBatch.session,
        startDate: authoritativeBatch.startDate,
        endDate: authoritativeBatch.endDate,
        startTime: authoritativeBatch.startTime,
        endTime: authoritativeBatch.endTime,
        venue: authoritativeBatch.venue,
      })
      .catch((err) => console.error("notification_failed:", err?.message || "Internal error"));

    return Response.json(
      {
        registration: {
          referenceNumber: registration.referenceNumber,
          fullName,
          email,
          contactNumber,
          aor,
          batchId,
          classDesignation: authoritativeBatch.classDesignation,
          deliveryMode: authoritativeBatch.deliveryMode,
          session: authoritativeBatch.session,
          startDate: authoritativeBatch.startDate,
          endDate: authoritativeBatch.endDate,
          startTime: authoritativeBatch.startTime,
          endTime: authoritativeBatch.endTime,
          venue: authoritativeBatch.venue,
          courseQualification: DEFAULT_COURSE_QUALIFICATION,
          registrationStatus: registration.registrationStatus,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.statusCode === 409 || error?.status === 409) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error?.statusCode === 400 || error?.status === 400) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : String(error);
    const fullErrStr = String(error) + (error instanceof Error && error.cause ? String(error.cause) : "");
    if (
      message.includes("already registered") ||
      message.includes("UNIQUE constraint failed") ||
      message.includes("UNIQUE constraint") ||
      fullErrStr.includes("UNIQUE constraint")
    ) {
      return Response.json({ error: "You are already registered for this batch." }, { status: 409 });
    }
    if (message.includes("already full") || message.includes("full")) {
      return Response.json(
        { error: "This batch is already full. Please select another available batch." },
        { status: 409 }
      );
    }
    if (message.includes("deadline") || message.includes("ended")) {
      return Response.json({ error: "The registration period for this batch has ended." }, { status: 409 });
    }
    if (message.includes("closed") || message.includes("not open")) {
      return Response.json({ error: "Registration for this batch is closed." }, { status: 409 });
    }
    if (message.includes("unavailable") || message.includes("disabled")) {
      return Response.json({ error: "This batch is currently unavailable." }, { status: 400 });
    }
    console.error("registration_failed:", error?.message || "Internal error");
    return Response.json({ error: "Registration is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
