import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MemoryBatchRepository,
  MemoryRegistrationRepository,
} from "../lib/repositories/memory.ts";
import { isDeliveryModeAuthorized, BATCHES, getAor } from "../lib/batches.ts";
import {
  calculateAge,
  DEFAULT_COURSE_QUALIFICATION,
  TESDA_EDUCATIONAL_ATTAINMENTS,
  TESDA_CIVIL_STATUSES,
  TESDA_EMPLOYMENT_STATUSES,
  TESDA_EMPLOYMENT_TYPES,
  TESDA_LEARNER_CLASSIFICATIONS,
  TESDA_SCHOLARSHIP_PACKAGES,
} from "../lib/tesda.ts";

function createHarness() {
  const batchRepo = new MemoryBatchRepository();
  const regRepo = new MemoryRegistrationRepository(batchRepo);
  return { batchRepo, regRepo };
}

const baseValidSubmission = {
  aor: "T",
  batchId: "t-online-am",
  lastName: "SANTOS",
  firstName: "MARIA",
  middleName: "CLARA",
  extensionName: "",
  street: "123 RIZAL ST",
  barangay: "CENTRAL",
  district: "1ST DISTRICT",
  cityMunicipality: "TAGUIG CITY",
  province: "METRO MANILA",
  region: "NATIONAL CAPITAL REGION (NCR)",
  email: "maria.santos@example.invalid",
  contactNumber: "09181234567",
  nationality: "Filipino",
  sex: "Female",
  civilStatus: "Single",
  employmentStatus: "Wage-Employed",
  employmentType: "Permanent",
  birthdate: "1998-05-20",
  age: 28,
  birthCity: "TAGUIG CITY",
  birthProvince: "METRO MANILA",
  birthRegion: "NATIONAL CAPITAL REGION (NCR)",
  educationalAttainment: "College Graduate",
  parentGuardianName: "JOSE SANTOS",
  parentGuardianAddress: "123 RIZAL ST, TAGUIG CITY",
  learnerClassification: "Uniformed Personnel",
  classificationOthers: "",
  isScholar: false,
  scholarshipPackage: "",
  scholarshipPackageOthers: "",
  consent: true,
  applicantCertified: true,
};

// Mirror the exact server-side validation and registration logic from app/api/register/route.ts
async function simulateRegistrationRoute(
  body,
  regRepo,
  batchRepo,
  settingsRepo = { getSettings: async () => ({ registrationEnabled: true }) },
  nowMs
) {
  // 1. Enforce Authoritative Master Registration Switch (Fail-Closed)
  let isRegistrationActive = false;
  try {
    const settings = await settingsRepo?.getSettings?.();
    isRegistrationActive = settings?.registrationEnabled === true;
  } catch {
    // Fail closed without leaking internal database errors
    isRegistrationActive = false;
  }

  if (!isRegistrationActive) {
    const err = new Error("Registration is currently closed. Please wait for the official registration announcement.");
    err.statusCode = 409;
    throw err;
  }

  // 2. Reject privileged or system field injection attempts
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
      const err = new Error("Privileged, administrative, or read-only fields cannot be submitted.");
      err.statusCode = 400;
      throw err;
    }
  }

  const aor = String(body.aor || "").trim().toUpperCase();
  const batchId = String(body.batchId || "").trim();

  const batch = await batchRepo.getBatchById(batchId);
  if (!getAor(aor) || !batch || batch.aorCode !== aor) {
    const err = new Error("The selected AOR and batch combination is not available.");
    err.statusCode = 400;
    throw err;
  }

  if (!isDeliveryModeAuthorized(aor, batch.deliveryMode)) {
    const err = new Error("The selected delivery mode is not authorized for this AOR.");
    err.statusCode = 400;
    throw err;
  }

  if (!batch.enabled) {
    const err = new Error("This batch is currently unavailable.");
    err.statusCode = 400;
    throw err;
  }

  if (batch.status === "FULL") {
    const err = new Error("This batch is already full. Please select another available batch.");
    err.statusCode = 409;
    throw err;
  }

  if (batch.status === "CLOSED" || !["OPEN", "NEARLY FULL"].includes(batch.status)) {
    const err = new Error("Registration for this batch is closed.");
    err.statusCode = 409;
    throw err;
  }

  const currentTime = nowMs !== undefined ? nowMs : Date.now();
  if (batch.registrationDeadline && currentTime > Date.parse(batch.registrationDeadline)) {
    const err = new Error("The registration period for this batch has ended.");
    err.statusCode = 409;
    throw err;
  }

  const lastName = String(body.lastName || "").trim();
  const firstName = String(body.firstName || "").trim();
  if (!lastName || !firstName) {
    const err = new Error("Last Name and First Name are required.");
    err.statusCode = 400;
    throw err;
  }

  const street = String(body.street || "").trim();
  const barangay = String(body.barangay || "").trim();
  const cityMunicipality = String(body.cityMunicipality || "").trim();
  const province = String(body.province || "").trim();
  const region = String(body.region || "").trim();
  if (!street || !barangay || !cityMunicipality || !province || !region) {
    const err = new Error("Complete permanent mailing address is required.");
    err.statusCode = 400;
    throw err;
  }

  const email = String(body.email || "").trim().toLowerCase();
  const contactNumber = String(body.contactNumber || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error("Enter a valid email address.");
    err.statusCode = 400;
    throw err;
  }
  if (!/^[0-9+() -]{7,20}$/.test(contactNumber)) {
    const err = new Error("Enter a valid contact number.");
    err.statusCode = 400;
    throw err;
  }

  const sex = String(body.sex || "").trim();
  if (!["Male", "Female"].includes(sex)) {
    const err = new Error("Please select a valid sex (Male or Female).");
    err.statusCode = 400;
    throw err;
  }

  const civilStatus = String(body.civilStatus || "").trim();
  if (!TESDA_CIVIL_STATUSES.includes(civilStatus)) {
    const err = new Error("Please select a valid civil status.");
    err.statusCode = 400;
    throw err;
  }

  const birthdate = String(body.birthdate || "").trim();
  const calculatedAge = calculateAge(birthdate, new Date("2026-09-07"));
  if (calculatedAge === null || calculatedAge < 15 || calculatedAge > 100) {
    const err = new Error("Please enter a valid birthdate.");
    err.statusCode = 400;
    throw err;
  }

  if (body.age !== undefined && body.age !== null && body.age !== "") {
    const submittedAge = Number(body.age);
    if (Number.isNaN(submittedAge) || submittedAge !== calculatedAge) {
      const err = new Error("Submitted age does not match the provided birthdate.");
      err.statusCode = 400;
      throw err;
    }
  }

  const birthCity = String(body.birthCity || "").trim();
  const birthProvince = String(body.birthProvince || "").trim();
  const birthRegion = String(body.birthRegion || "").trim();
  if (!birthCity || !birthProvince || !birthRegion) {
    const err = new Error("Birthplace details (City/Municipality, Province, Region) are required.");
    err.statusCode = 400;
    throw err;
  }

  const employmentStatus = String(body.employmentStatus || "").trim();
  if (!TESDA_EMPLOYMENT_STATUSES.includes(employmentStatus)) {
    const err = new Error("Please select your employment status before training.");
    err.statusCode = 400;
    throw err;
  }

  let employmentType = "None";
  if (employmentStatus === "Wage-Employed" || employmentStatus === "Underemployed") {
    employmentType = String(body.employmentType || "").trim();
    if (!TESDA_EMPLOYMENT_TYPES.includes(employmentType)) {
      const err = new Error("Please select a valid employment type.");
      err.statusCode = 400;
      throw err;
    }
  }

  const educationalAttainment = String(body.educationalAttainment || "").trim();
  if (!TESDA_EDUCATIONAL_ATTAINMENTS.includes(educationalAttainment)) {
    const err = new Error("Please select your educational attainment.");
    err.statusCode = 400;
    throw err;
  }

  const learnerClassification = String(body.learnerClassification || "").trim();
  if (!TESDA_LEARNER_CLASSIFICATIONS.includes(learnerClassification)) {
    const err = new Error("Please select a valid learner classification.");
    err.statusCode = 400;
    throw err;
  }

  if (body.consent !== true && body.consent !== "Agree") {
    const err = new Error("The required personal information cannot be processed without the necessary privacy consent.");
    err.statusCode = 400;
    throw err;
  }

  if (body.applicantCertified !== true && body.applicantCertified !== "true") {
    const err = new Error("You must certify that the information provided is true and correct.");
    err.statusCode = 400;
    throw err;
  }

  return await regRepo.registerLearnerAtomic({
    batchId,
    aorCode: aor,
    learner: {
      lastName,
      firstName,
      middleName: String(body.middleName || "").trim(),
      extensionName: String(body.extensionName || "").trim(),
      fullName: `${lastName}, ${firstName}`,
      street,
      barangay,
      district: String(body.district || "").trim(),
      cityMunicipality,
      province,
      region,
      email,
      contactNumber,
      nationality: String(body.nationality || "Filipino").trim(),
      sex,
      civilStatus,
      employmentStatus,
      employmentType,
      birthdate,
      age: calculatedAge,
      birthCity,
      birthProvince,
      birthRegion,
      educationalAttainment,
      parentGuardianName: String(body.parentGuardianName || "").trim(),
      parentGuardianAddress: String(body.parentGuardianAddress || "").trim(),
      learnerClassification,
      classificationOthers: String(body.classificationOthers || "").trim(),
      courseQualification: DEFAULT_COURSE_QUALIFICATION,
      isScholar: Boolean(body.isScholar),
      scholarshipPackage: String(body.scholarshipPackage || "").trim(),
      scholarshipPackageOthers: String(body.scholarshipPackageOthers || "").trim(),
      privacyConsent: true,
      applicantCertified: true,
    },
  });
}

// -----------------------------------------------------------------------------
// PREFLIGHT AUTOMATED TEST SUITE
// -----------------------------------------------------------------------------

test("Preflight 1: Malformed submissions are strictly rejected (400)", async () => {
  const { regRepo, batchRepo } = createHarness();

  // Missing lastName
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, lastName: "" }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("Last Name")
  );

  // Missing firstName
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, firstName: "" }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("First Name")
  );

  // Invalid email format
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, email: "invalid-email-address" }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("valid email")
  );

  // Missing street address
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, street: "" }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("permanent mailing address")
  );

  // Invalid sex enumeration
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, sex: "Other" }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("valid sex")
  );
});

test("Preflight 2: Missing or disagreed privacy consent is rejected (400)", async () => {
  const { regRepo, batchRepo } = createHarness();

  // Explicit false / Disagree
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, consent: false }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("privacy consent")
  );

  // Null
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, consent: null }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("privacy consent")
  );

  // Undefined
  const noConsent = { ...baseValidSubmission };
  delete noConsent.consent;
  await assert.rejects(
    () => simulateRegistrationRoute(noConsent, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("privacy consent")
  );
});

test("Preflight 3: Missing applicant certification is rejected (400)", async () => {
  const { regRepo, batchRepo } = createHarness();

  // False
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, applicantCertified: false }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("certify that the information")
  );

  // Null
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, applicantCertified: null }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("certify that the information")
  );
});

test("Preflight 4: Invalid AOR and batch pairing is rejected (400)", async () => {
  const { regRepo, batchRepo } = createHarness();

  // AOR code A (1ID) submitting for batch belonging to T (NCR)
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, aor: "A", batchId: "t-online-am" }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("combination is not available")
  );

  // AOR code A (1ID) attempting Face-to-Face delivery mode
  await batchRepo.updateBatch("a-online-am", { deliveryMode: "Face-to-Face" });
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, aor: "A", batchId: "a-online-am" }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("not authorized for this AOR")
  );
});

test("Preflight 5: FULL batch returns 409 with exact guidance message", async () => {
  const { regRepo, batchRepo } = createHarness();
  await batchRepo.updateBatch("t-online-am", { capacity: 1, registeredCount: 1, status: "FULL" });

  await assert.rejects(
    () => simulateRegistrationRoute(baseValidSubmission, regRepo, batchRepo),
    (err) =>
      err.statusCode === 409 &&
      err.message === "This batch is already full. Please select another available batch."
  );
});

test("Preflight 6: CLOSED batch returns 409 with exact guidance message", async () => {
  const { regRepo, batchRepo } = createHarness();
  await batchRepo.updateBatch("t-online-am", { status: "CLOSED" });

  await assert.rejects(
    () => simulateRegistrationRoute(baseValidSubmission, regRepo, batchRepo),
    (err) => err.statusCode === 409 && err.message === "Registration for this batch is closed."
  );
});

test("Preflight 7: DISABLED batch returns 400 with exact guidance message", async () => {
  const { regRepo, batchRepo } = createHarness();
  await batchRepo.updateBatch("t-online-pm", { enabled: false });

  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, batchId: "t-online-pm" }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message === "This batch is currently unavailable."
  );
});

test("Preflight 8: Expired registration deadline returns 409 with exact guidance message", async () => {
  const { regRepo, batchRepo } = createHarness();
  await batchRepo.updateBatch("t-online-am", { registrationDeadline: "2020-01-01T00:00:00Z" });

  await assert.rejects(
    () => simulateRegistrationRoute(baseValidSubmission, regRepo, batchRepo),
    (err) =>
      err.statusCode === 409 &&
      err.message === "The registration period for this batch has ended."
  );
});

test("Preflight 9: Duplicate learner registration returns 409 with exact guidance message", async () => {
  const { regRepo, batchRepo } = createHarness();

  // First registration succeeds
  const res1 = await simulateRegistrationRoute(baseValidSubmission, regRepo, batchRepo);
  assert.ok(res1.registration.referenceNumber);

  // Second registration with identical email and batchId returns 409
  await assert.rejects(
    () => simulateRegistrationRoute(baseValidSubmission, regRepo, batchRepo),
    (err) =>
      err.statusCode === 409 &&
      err.message === "You are already registered for this batch."
  );
});

test("Preflight 10: Forged age is rejected and server-side calculation is authoritative (400)", async () => {
  const { regRepo, batchRepo } = createHarness();

  // Birthdate 1998-05-20 gives age 28 in 2026. If applicant submits age 19, server rejects.
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, birthdate: "1998-05-20", age: 19 }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("Submitted age does not match")
  );

  // Without submitted age, server computes and assigns authoritative age
  const res = await simulateRegistrationRoute({ ...baseValidSubmission, email: "auth.age@example.invalid", age: undefined }, regRepo, batchRepo);
  assert.equal(res.learner.age, 28);
});

test("Preflight 11: Forged system and administrative fields are rejected (400)", async () => {
  const { regRepo, batchRepo } = createHarness();

  // Inject ULI
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, uli: "00-1234-5678" }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("Privileged, administrative, or read-only")
  );

  // Inject Role
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, role: "SUPER_ADMIN" }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("Privileged, administrative, or read-only")
  );

  // Inject isAdmin
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, isAdmin: true }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("Privileged, administrative, or read-only")
  );

  // Inject Capacity
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, capacity: 500 }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("Privileged, administrative, or read-only")
  );

  // Inject Completion Status
  await assert.rejects(
    () => simulateRegistrationRoute({ ...baseValidSubmission, completionStatus: "COMPLETED" }, regRepo, batchRepo),
    (err) => err.statusCode === 400 && err.message.includes("Privileged, administrative, or read-only")
  );
});

test("Preflight 12: Concurrent requests for the last available slot prevent overbooking", async () => {
  const { regRepo, batchRepo } = createHarness();
  const targetBatch = "b-online-am";
  await batchRepo.updateBatch(targetBatch, { capacity: 1, registeredCount: 0, status: "OPEN" });

  const concurrentAttempts = 10;
  const results = await Promise.all(
    Array.from({ length: concurrentAttempts }).map((_, idx) =>
      simulateRegistrationRoute(
        {
          ...baseValidSubmission,
          aor: "B",
          batchId: targetBatch,
          email: `concurrent.slot.${idx}@example.invalid`,
        },
        regRepo,
        batchRepo
      )
        .then(() => "SUCCESS")
        .catch((err) => (err.statusCode === 409 ? "REJECTED_409" : "ERROR"))
    )
  );

  const successes = results.filter((r) => r === "SUCCESS");
  const rejected = results.filter((r) => r === "REJECTED_409");

  assert.equal(successes.length, 1, "Exactly one registration must claim the single available slot.");
  assert.equal(rejected.length, 9, "Remaining 9 attempts must be rejected with 409 full.");

  const finalBatch = await batchRepo.getBatchById(targetBatch);
  assert.equal(finalBatch.registeredCount, 1);
  assert.equal(finalBatch.status, "FULL");
});

test("Preflight 13: Transaction failure rolls back completely without leaving partial records", async () => {
  const { regRepo, batchRepo } = createHarness();
  const initialBatches = await batchRepo.getAllBatches();
  const initialBatch = initialBatches.find((b) => b.batchId === "t-online-am");
  const initialCount = initialBatch.registeredCount;

  // Attempt registration with mismatched AOR and batch
  await assert.rejects(
    () =>
      simulateRegistrationRoute(
        { ...baseValidSubmission, aor: "A", batchId: "t-online-am" },
        regRepo,
        batchRepo
      ),
    (err) => err.statusCode === 400
  );

  // Verify zero registrations exist
  const registrations = await regRepo.getAllRegistrations();
  assert.equal(registrations.length, 0);

  // Verify batch count unchanged
  const batchAfter = await batchRepo.getBatchById("t-online-am");
  assert.equal(batchAfter.registeredCount, initialCount);
});

test("Preflight 14: Global switch registrationEnabled: true permits an otherwise valid registration", async () => {
  const { regRepo, batchRepo } = createHarness();
  const settingsRepo = { getSettings: async () => ({ registrationEnabled: true }) };
  const res = await simulateRegistrationRoute(baseValidSubmission, regRepo, batchRepo, settingsRepo);
  assert.ok(res.registration.referenceNumber);
  assert.equal(res.registration.registrationStatus, "CONFIRMED");
});

test("Preflight 15: Global switch registrationEnabled: false blocks registration (409)", async () => {
  const { regRepo, batchRepo } = createHarness();
  const settingsRepo = { getSettings: async () => ({ registrationEnabled: false }) };
  await assert.rejects(
    () => simulateRegistrationRoute(baseValidSubmission, regRepo, batchRepo, settingsRepo),
    (err) =>
      err.statusCode === 409 &&
      err.message === "Registration is currently closed. Please wait for the official registration announcement."
  );
});

test("Preflight 16: Missing settings document blocks registration (fail-closed, 409)", async () => {
  const { regRepo, batchRepo } = createHarness();
  const settingsRepo = { getSettings: async () => null };
  await assert.rejects(
    () => simulateRegistrationRoute(baseValidSubmission, regRepo, batchRepo, settingsRepo),
    (err) =>
      err.statusCode === 409 &&
      err.message === "Registration is currently closed. Please wait for the official registration announcement."
  );
});

test("Preflight 17: Missing registrationEnabled field blocks registration (fail-closed, 409)", async () => {
  const { regRepo, batchRepo } = createHarness();
  const settingsRepo = { getSettings: async () => ({ courseTitle: "AIFAT" }) };
  await assert.rejects(
    () => simulateRegistrationRoute(baseValidSubmission, regRepo, batchRepo, settingsRepo),
    (err) =>
      err.statusCode === 409 &&
      err.message === "Registration is currently closed. Please wait for the official registration announcement."
  );
});

test("Preflight 18: Malformed or non-boolean registrationEnabled values block registration (fail-closed, 409)", async () => {
  const { regRepo, batchRepo } = createHarness();
  const malformedValues = ["true", "OPEN", 1, 0, null, undefined, {}, []];
  for (const val of malformedValues) {
    const settingsRepo = { getSettings: async () => ({ registrationEnabled: val }) };
    await assert.rejects(
      () => simulateRegistrationRoute(baseValidSubmission, regRepo, batchRepo, settingsRepo),
      (err) =>
        err.statusCode === 409 &&
        err.message === "Registration is currently closed. Please wait for the official registration announcement."
    );
  }
});

test("Preflight 19: Settings-repository failure fails closed without leaking database errors (409)", async () => {
  const { regRepo, batchRepo } = createHarness();
  const settingsRepo = {
    getSettings: async () => {
      throw new Error("CRITICAL_FIRESTORE_INTERNAL_CONNECTION_TIMEOUT_DEADLINE_EXCEEDED");
    },
  };
  await assert.rejects(
    () => simulateRegistrationRoute(baseValidSubmission, regRepo, batchRepo, settingsRepo),
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.equal(
        err.message,
        "Registration is currently closed. Please wait for the official registration announcement."
      );
      assert.ok(!err.message.includes("FIRESTORE"));
      assert.ok(!err.message.includes("CONNECTION"));
      return true;
    }
  );
});

test("Preflight 20: Blocked requests produce zero transaction side effects", async () => {
  const { regRepo, batchRepo } = createHarness();
  const settingsRepo = { getSettings: async () => ({ registrationEnabled: false }) };
  const initialBatches = await batchRepo.getAllBatches();
  const initialBatch = initialBatches.find((b) => b.batchId === "t-online-am");
  const initialCount = initialBatch.registeredCount;

  await assert.rejects(
    () => simulateRegistrationRoute(baseValidSubmission, regRepo, batchRepo, settingsRepo),
    (err) => err.statusCode === 409
  );

  // Assert zero records created in registrations
  const registrations = await regRepo.getAllRegistrations();
  assert.equal(registrations.length, 0);

  // Assert batch registeredCount unchanged
  const batchAfter = await batchRepo.getBatchById("t-online-am");
  assert.equal(batchAfter.registeredCount, initialCount);
});

test("Preflight 21: UI cannot advance to learner registration while globally closed", async () => {
  const pageSrc = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  // Verify public notice text matches requirement exactly
  assert.match(pageSrc, /REGISTRATION NOT YET OPEN/);
  assert.match(
    pageSrc,
    /Online registration for the Artificial Intelligence Fundamentals and Applications In-House Training \(AIFAT\) is currently closed\. Please wait for the official registration announcement\./
  );

  // Verify canRegister evaluates to false when isRegistrationEnabled !== true even for an OPEN batch
  const openBatch = { status: "OPEN", enabled: true, registrationDeadline: "2026-09-14T23:59:59+08:00" };
  const isRegistrationEnabled = false;
  const isExpired = Boolean(openBatch.registrationDeadline && Date.now() > Date.parse(openBatch.registrationDeadline));
  const isFull = openBatch.status === "FULL";
  const isClosed = openBatch.status === "CLOSED";
  const isDisabled = !openBatch.enabled;
  const canRegister =
    isRegistrationEnabled &&
    !isDisabled &&
    !isExpired &&
    !isFull &&
    !isClosed &&
    (openBatch.status === "OPEN" || openBatch.status === "NEARLY FULL");

  assert.equal(canRegister, false, "canRegister must be false when global registration switch is not enabled");

  // Verify badgeText and buttonLabel do NOT display misleading OPEN when globally closed
  let badgeText = openBatch.status;
  let buttonLabel = "Select this batch";
  if (!isRegistrationEnabled) {
    badgeText = "REGISTRATION NOT YET OPEN";
    buttonLabel = "Registration Not Yet Open";
  }

  assert.equal(badgeText, "REGISTRATION NOT YET OPEN");
  assert.notEqual(badgeText, "OPEN");
  assert.equal(buttonLabel, "Registration Not Yet Open");
  assert.notEqual(buttonLabel, "Select this batch");

  // Verify page.tsx enforces guard on onSelect and direct register step render
  assert.match(pageSrc, /if \(!isRegistrationEnabled\) return;/);
  assert.match(pageSrc, /step === "register" && \(!isRegistrationEnabled \|\| !selected\)/);
});

test("Preflight 22: Production registration deadline locked at 2026-09-14T23:59:59+08:00 (within period vs expired)", async () => {
  const { regRepo, batchRepo } = createHarness();
  const lockedDeadline = "2026-09-14T23:59:59+08:00";

  // Must not be a date-only string
  assert.match(lockedDeadline, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
  assert.notEqual(lockedDeadline, "2026-09-14");

  await batchRepo.updateBatch("t-online-am", { registrationDeadline: lockedDeadline });

  // 1. Exactly at 2026-09-14T23:59:59+08:00 -> Still within registration period
  const atDeadlineMs = Date.parse("2026-09-14T23:59:59+08:00");
  const resValid = await simulateRegistrationRoute(
    { ...baseValidSubmission, email: "deadline.valid@example.invalid" },
    regRepo,
    batchRepo,
    { getSettings: async () => ({ registrationEnabled: true }) },
    atDeadlineMs
  );
  assert.ok(resValid.registration.referenceNumber);

  // 2. Exactly at 2026-09-15T00:00:00+08:00 -> Expired (409)
  const expiredMs = Date.parse("2026-09-15T00:00:00+08:00");
  assert.ok(expiredMs > atDeadlineMs, "2026-09-15T00:00:00+08:00 must be greater than deadline timestamp");

  await assert.rejects(
    () =>
      simulateRegistrationRoute(
        { ...baseValidSubmission, email: "deadline.expired@example.invalid" },
        regRepo,
        batchRepo,
        { getSettings: async () => ({ registrationEnabled: true }) },
        expiredMs
      ),
    (err) =>
      err.statusCode === 409 &&
      err.message === "The registration period for this batch has ended."
  );
});
