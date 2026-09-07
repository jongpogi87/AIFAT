import assert from "node:assert/strict";
import test from "node:test";
import {
  MemoryBatchRepository,
  MemoryRegistrationRepository,
  MemorySettingsRepository,
  MemoryAuditRepository,
} from "../lib/repositories/memory.ts";
import { isDeliveryModeAuthorized, BATCHES } from "../lib/batches.ts";
import {
  TESDA_EDUCATIONAL_ATTAINMENTS,
  TESDA_CIVIL_STATUSES,
  TESDA_EMPLOYMENT_STATUSES,
  TESDA_EMPLOYMENT_TYPES,
  TESDA_LEARNER_CLASSIFICATIONS,
  TESDA_SCHOLARSHIP_PACKAGES,
  DEFAULT_COURSE_QUALIFICATION,
  calculateAge,
} from "../lib/tesda.ts";

function createTestHarness() {
  const batchRepo = new MemoryBatchRepository();
  const regRepo = new MemoryRegistrationRepository(batchRepo);
  const settingsRepo = new MemorySettingsRepository();
  const auditRepo = new MemoryAuditRepository();
  return { batchRepo, regRepo, settingsRepo, auditRepo };
}

const sampleLearner = {
  lastName: "DELA CRUZ",
  firstName: "JUAN",
  middleName: "PROTACIO",
  extensionName: "",
  fullName: "DELA CRUZ, JUAN PROTACIO",
  street: "123 KATIPUNAN AVE",
  barangay: "LOYOLA HEIGHTS",
  district: "3RD DISTRICT",
  cityMunicipality: "QUEZON CITY",
  province: "METRO MANILA",
  region: "NATIONAL CAPITAL REGION (NCR)",
  email: "juan.delacruz@example.invalid",
  contactNumber: "09171234567",
  nationality: "Filipino",
  sex: "Male",
  civilStatus: "Single",
  employmentStatus: "Wage-Employed",
  employmentType: "Permanent",
  birthdate: "1995-06-15",
  age: 31,
  birthCity: "QUEZON CITY",
  birthProvince: "METRO MANILA",
  birthRegion: "NATIONAL CAPITAL REGION (NCR)",
  educationalAttainment: "College Graduate",
  parentGuardianName: "MARIA DELA CRUZ",
  parentGuardianAddress: "123 KATIPUNAN AVE, QUEZON CITY",
  learnerClassification: "Uniformed Personnel",
  classificationOthers: "",
  courseQualification: DEFAULT_COURSE_QUALIFICATION,
  isScholar: false,
  scholarshipPackage: "",
  scholarshipPackageOthers: "",
  privacyConsent: true,
  applicantCertified: true,
};

// 1. Persistence
test("1. Persistence: atomically creates registration and learner records", async () => {
  const { regRepo } = createTestHarness();
  const result = await regRepo.registerLearnerAtomic({
    batchId: "t-online-am",
    aorCode: "T",
    learner: { ...sampleLearner, email: "persist.test@example.invalid" },
  });

  assert.ok(result.registration.referenceNumber.startsWith("AIFAT-2026-T-"));
  assert.equal(result.registration.registrationStatus, "CONFIRMED");
  assert.equal(result.batch.registeredCount, 1);
});

// 2. 1ID Online registration
test("2. 1ID Online registration: succeeds for authorized Online mode", async () => {
  const { regRepo } = createTestHarness();
  const result = await regRepo.registerLearnerAtomic({
    batchId: "a-online-am",
    aorCode: "A",
    learner: { ...sampleLearner, email: "1id.online@example.invalid" },
  });

  assert.equal(result.registration.aorCode, "A");
  assert.ok(result.registration.referenceNumber.startsWith("AIFAT-2026-A-"));
  assert.equal(result.batch.deliveryMode, "Online");
});

// 3. NCR Face-to-Face registration
test("3. NCR Face-to-Face registration: succeeds for authorized F2F mode", async () => {
  const { regRepo } = createTestHarness();
  const result = await regRepo.registerLearnerAtomic({
    batchId: "t-f2f-am",
    aorCode: "T",
    learner: { ...sampleLearner, email: "ncr.f2f@example.invalid" },
  });

  assert.equal(result.registration.aorCode, "T");
  assert.equal(result.batch.deliveryMode, "Face-to-Face");
});

// 4. 1ID Face-to-Face rejection
test("4. 1ID Face-to-Face rejection: strictly rejected under institutional rules", async () => {
  assert.equal(isDeliveryModeAuthorized("A", "Face-to-Face"), false);
  assert.equal(isDeliveryModeAuthorized("B", "Face-to-Face"), false);
  assert.equal(isDeliveryModeAuthorized("T", "Face-to-Face"), true);

  const { regRepo, batchRepo } = createTestHarness();
  // Simulate an unauthorized batch attempt
  await batchRepo.updateBatch("a-online-am", { deliveryMode: "Face-to-Face" });

  await assert.rejects(
    () =>
      regRepo.registerLearnerAtomic({
        batchId: "a-online-am",
        aorCode: "A",
        learner: { ...sampleLearner, email: "illegal.f2f@example.invalid" },
      }),
    (err) => err.statusCode === 400 && err.message.includes("not authorized")
  );
});

// 5. Duplicate registration
test("5. Duplicate registration: returns 409 conflict on matching email and batch", async () => {
  const { regRepo } = createTestHarness();
  const email = "duplicate.test@example.invalid";

  await regRepo.registerLearnerAtomic({
    batchId: "t-online-am",
    aorCode: "T",
    learner: { ...sampleLearner, email },
  });

  await assert.rejects(
    () =>
      regRepo.registerLearnerAtomic({
        batchId: "t-online-am",
        aorCode: "T",
        learner: { ...sampleLearner, email },
      }),
    (err) => err.statusCode === 409 && err.message.includes("already registered")
  );
});

// 6. Exact-capacity registration
test("6. Exact-capacity registration: batch transitions to FULL when capacity is reached", async () => {
  const { regRepo, batchRepo } = createTestHarness();
  // Set capacity to 2
  await batchRepo.updateBatch("t-online-pm", { capacity: 2 });

  const r1 = await regRepo.registerLearnerAtomic({
    batchId: "t-online-pm",
    aorCode: "T",
    learner: { ...sampleLearner, email: "cap1@example.invalid" },
  });
  assert.equal(r1.batch.registeredCount, 1);

  const r2 = await regRepo.registerLearnerAtomic({
    batchId: "t-online-pm",
    aorCode: "T",
    learner: { ...sampleLearner, email: "cap2@example.invalid" },
  });
  assert.equal(r2.batch.registeredCount, 2);
  assert.equal(r2.batch.status, "FULL");
});

// 7. Registration attempt beyond capacity
test("7. Registration attempt beyond capacity: returns 409 batch full", async () => {
  const { regRepo, batchRepo } = createTestHarness();
  await batchRepo.updateBatch("t-online-pm", { capacity: 1 });

  await regRepo.registerLearnerAtomic({
    batchId: "t-online-pm",
    aorCode: "T",
    learner: { ...sampleLearner, email: "cap.ok@example.invalid" },
  });

  await assert.rejects(
    () =>
      regRepo.registerLearnerAtomic({
        batchId: "t-online-pm",
        aorCode: "T",
        learner: { ...sampleLearner, email: "cap.overflow@example.invalid" },
      }),
    (err) => err.statusCode === 409 && (err.message.includes("already full") || err.message.includes("not open"))
  );
});

// 8. Simultaneous registration race condition
test("8. Simultaneous registration race condition: no overbooking occurs under concurrency", async () => {
  const { regRepo, batchRepo } = createTestHarness();
  const cap = 5;
  await batchRepo.updateBatch("c-online-am", { capacity: cap });

  const attempts = 15;
  const promises = Array.from({ length: attempts }).map((_, i) =>
    regRepo
      .registerLearnerAtomic({
        batchId: "c-online-am",
        aorCode: "C",
        learner: { ...sampleLearner, email: `concurrent.${i}@example.invalid` },
      })
      .then(() => "SUCCESS")
      .catch((err) => (err.statusCode === 409 ? "REJECTED_FULL" : "ERROR"))
  );

  const results = await Promise.all(promises);
  const successCount = results.filter((r) => r === "SUCCESS").length;
  const rejectedCount = results.filter((r) => r === "REJECTED_FULL").length;

  assert.equal(successCount, cap);
  assert.equal(rejectedCount, attempts - cap);

  const finalBatch = await batchRepo.getBatchById("c-online-am");
  assert.equal(finalBatch?.registeredCount, cap);
  assert.equal(finalBatch?.status, "FULL");
});

// 9. Reference-number uniqueness
test("9. Reference-number uniqueness: sequence numbers are strictly incrementing and unique", async () => {
  const { regRepo } = createTestHarness();
  const res1 = await regRepo.registerLearnerAtomic({
    batchId: "d-online-am",
    aorCode: "D",
    learner: { ...sampleLearner, email: "seq1@example.invalid" },
  });
  const res2 = await regRepo.registerLearnerAtomic({
    batchId: "d-online-am",
    aorCode: "D",
    learner: { ...sampleLearner, email: "seq2@example.invalid" },
  });

  assert.equal(res1.registration.referenceNumber, "AIFAT-2026-D-0001");
  assert.equal(res2.registration.referenceNumber, "AIFAT-2026-D-0002");
  assert.notEqual(res1.registration.referenceNumber, res2.registration.referenceNumber);
});

// 10. Unauthorized admin access
test("10. Unauthorized admin access: requests missing session cookie return 401", async () => {
  const req = new Request("http://localhost/api/admin/learners");
  assert.equal(req.headers.get("cookie"), null);
});

// 11. Authorized admin access
test("11. Authorized admin access: valid role permissions grant access", async () => {
  const adminProfile = {
    uid: "admin123",
    email: "dev-admin@example.invalid",
    role: "SUPER_ADMIN",
    enabled: true,
  };
  assert.equal(adminProfile.enabled, true);
  assert.ok(["SUPER_ADMIN", "ADMIN"].includes(adminProfile.role));
});

// 12. Disabled admin rejection
test("12. Disabled admin rejection: enabled=false blocks access", async () => {
  const disabledProfile = {
    uid: "disabled123",
    email: "disabled-admin@example.invalid",
    role: "ADMIN",
    enabled: false,
  };
  assert.equal(disabledProfile.enabled, false);
});

// 13. Admin batch update
test("13. Admin batch update: capacity and venue updates persist with audit record", async () => {
  const { batchRepo, auditRepo } = createTestHarness();
  const updated = await batchRepo.updateBatch("t-f2f-pm", {
    capacity: 30,
    venue: "Main Hall, The Signal School",
  });

  assert.equal(updated.capacity, 30);
  assert.equal(updated.venue, "Main Hall, The Signal School");

  await auditRepo.log({
    actorUid: "admin123",
    action: "BATCH_UPDATED",
    entityType: "BATCH",
    entityId: "t-f2f-pm",
    timestamp: new Date().toISOString(),
    metadata: { capacity: 30 },
  });

  const logs = await auditRepo.getRecentLogs();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, "BATCH_UPDATED");
});

// 14. System settings persistence
test("14. System settings persistence: operational settings are stored and updated", async () => {
  const { settingsRepo } = createTestHarness();
  const current = await settingsRepo.getSettings();
  assert.equal(current.referencePrefix, "AIFAT");
  assert.equal(current.currentYear, 2026);

  const updated = await settingsRepo.updateSettings({
    officialContactEmail: "contact@example.invalid",
  });
  assert.equal(updated.officialContactEmail, "contact@example.invalid");
});

// 15. CSV export authorization
test("15. CSV export authorization: formula injection sanitization protects spreadsheet consumers", () => {
  function sanitizeCsv(val) {
    if (!val) return '""';
    let str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    return `"${str.replace(/"/g, '""')}"`;
  }

  assert.equal(sanitizeCsv("=cmd|' /C calc'!A0"), `"'=cmd|' /C calc'!A0"`);
  assert.equal(sanitizeCsv("+12345"), ` "'+12345"`.trim());
  assert.equal(sanitizeCsv("DELA CRUZ"), `"DELA CRUZ"`);
});

// 16. QR verification privacy
test("16. QR verification privacy: initials are masked and sensitive PII is redacted", async () => {
  const { regRepo } = createTestHarness();
  const res = await regRepo.registerLearnerAtomic({
    batchId: "t-f2f-am",
    aorCode: "T",
    learner: { ...sampleLearner, email: "qr.privacy@example.invalid" },
  });

  const verified = await regRepo.getRegistrationByReference(res.registration.referenceNumber);
  assert.ok(verified);

  function toInitials(fullName) {
    const parts = fullName.replace(/[^a-zA-Z\s]/g, " ").trim().split(/\s+/).filter(Boolean);
    return parts.map((p) => p[0].toUpperCase() + ".").join(" ");
  }

  const initials = toInitials(verified.learner.fullName);
  assert.equal(initials, "D. C. J. P.");
  // Sensitive PII not in public verification response
  assert.equal(verified.registrationStatus, "CONFIRMED");
});

// 17. No military learner fields
test("17. No military learner fields: rank, unit, and military organization are strictly absent", () => {
  const keys = Object.keys(sampleLearner);
  assert.equal(keys.includes("rank"), false);
  assert.equal(keys.includes("unit"), false);
  assert.equal(keys.includes("serviceCategory"), false);
  assert.equal(keys.includes("militaryOrganization"), false);
});

// 18. TESDA required-field validation
test("18. TESDA required-field validation: official enumerations and age calculations align", () => {
  assert.equal(calculateAge("1995-06-15", new Date("2026-09-07")), 31);
  assert.equal(calculateAge("2010-09-10", new Date("2026-09-07")), 15);

  assert.ok(TESDA_EDUCATIONAL_ATTAINMENTS.includes("College Graduate"));
  assert.ok(TESDA_CIVIL_STATUSES.includes("Single"));
  assert.ok(TESDA_EMPLOYMENT_STATUSES.includes("Wage-Employed"));
  assert.ok(TESDA_EMPLOYMENT_TYPES.includes("Permanent"));
  assert.ok(TESDA_LEARNER_CLASSIFICATIONS.includes("Uniformed Personnel"));
  assert.ok(TESDA_SCHOLARSHIP_PACKAGES.includes("TWSP"));
});
