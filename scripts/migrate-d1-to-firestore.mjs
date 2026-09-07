import { DatabaseSync } from "node:sqlite";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

/**
 * One-Time Data Migration Utility: D1 / SQLite -> Cloud Firestore
 *
 * Usage:
 *   node scripts/migrate-d1-to-firestore.mjs --dry-run
 *   node scripts/migrate-d1-to-firestore.mjs --execute
 */

const isDryRun = !process.argv.includes("--execute");
const dbPath = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite";

console.log(`\n======================================================`);
console.log(`AIFAT D1 -> FIRESTORE DATA MIGRATION UTILITY`);
console.log(`Mode: ${isDryRun ? "DRY-RUN (No changes will be written)" : "EXECUTE (Live Firestore Writes)"}`);
console.log(`======================================================\n`);

if (!fs.existsSync(dbPath)) {
  console.log(`[Migration] SQLite database file not found at: ${dbPath}`);
  console.log(`[Migration] Nothing to migrate.`);
  process.exit(0);
}

const sqlite = new DatabaseSync(dbPath);

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-aifat-portal";
if (!getApps().length) {
  initializeApp({ projectId });
}
const firestore = getFirestore();

async function runMigration() {
  const rows = sqlite
    .prepare(`
      SELECT
        r.id as reg_id,
        r.reference_number,
        r.learner_id,
        r.full_name,
        r.email,
        r.contact_number,
        r.aor,
        r.batch_id,
        r.course_qualification,
        r.registration_status,
        r.attendance_status,
        r.completion_status,
        r.certification_status,
        r.created_at,
        l.last_name,
        l.first_name,
        l.middle_name,
        l.extension_name,
        l.street,
        l.barangay,
        l.district,
        l.city_municipality,
        l.province,
        l.region,
        l.nationality,
        l.sex,
        l.civil_status,
        l.employment_status,
        l.employment_type,
        l.birthdate,
        l.age,
        l.birth_city,
        l.birth_province,
        l.birth_region,
        l.educational_attainment,
        l.parent_guardian_name,
        l.parent_guardian_address,
        l.learner_classification,
        l.classification_others,
        l.is_scholar,
        l.scholarship_package,
        l.scholarship_package_others
      FROM registrations r
      LEFT JOIN learners l ON r.learner_id = l.id
    `)
    .all();

  console.log(`[Migration] Found ${rows.length} registration record(s) in SQLite.`);

  let migratedCount = 0;
  let skippedTestCount = 0;
  let rejectedCount = 0;

  for (const row of rows) {
    const email = String(row.email || "").toLowerCase().trim();
    const referenceNumber = String(row.reference_number || "").trim();

    // Guard: Identify and skip ephemeral test records per Section U
    if (email.includes("test") || email.includes("example.com") || referenceNumber.includes("TEST")) {
      console.log(`[Migration] Skipping test record: Ref=${referenceNumber}, Email=${email}`);
      skippedTestCount++;
      continue;
    }

    if (!referenceNumber || !email) {
      console.warn(`[Migration] Rejected invalid record: Missing reference or email (ID=${row.reg_id})`);
      rejectedCount++;
      continue;
    }

    const timestamp = row.created_at
      ? typeof row.created_at === "number"
        ? new Date(row.created_at * 1000).toISOString()
        : new Date(row.created_at).toISOString()
      : new Date().toISOString();

    const learnerId = `learner_${Buffer.from(email).toString("hex").slice(0, 20)}`;

    const learnerDoc = {
      lastName: row.last_name || "",
      firstName: row.first_name || "",
      middleName: row.middle_name || "",
      extensionName: row.extension_name || "",
      street: row.street || "",
      barangay: row.barangay || "",
      district: row.district || "",
      cityMunicipality: row.city_municipality || "",
      province: row.province || "",
      region: row.region || "",
      email,
      contactNumber: row.contact_number || "",
      nationality: row.nationality || "Filipino",
      sex: row.sex || "Male",
      civilStatus: row.civil_status || "Single",
      employmentStatus: row.employment_status || "Wage-Employed",
      employmentType: row.employment_type || "Permanent",
      birthdate: row.birthdate || "",
      age: Number(row.age) || 0,
      birthCity: row.birth_city || "",
      birthProvince: row.birth_province || "",
      birthRegion: row.birth_region || "",
      educationalAttainment: row.educational_attainment || "College Graduate",
      parentGuardianName: row.parent_guardian_name || "",
      parentGuardianAddress: row.parent_guardian_address || "",
      learnerClassification: row.learner_classification || "Uniformed Personnel",
      classificationOthers: row.classification_others || "",
      courseQualification: row.course_qualification || "Artificial Intelligence Fundamentals and Applications In-House Training (AIFAT)",
      isScholar: Boolean(row.is_scholar),
      scholarshipPackage: row.scholarship_package || "",
      scholarshipPackageOthers: row.scholarship_package_others || "",
      privacyConsent: true,
      applicantCertified: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const regDoc = {
      referenceNumber,
      learnerId,
      batchId: row.batch_id,
      aorId: row.aor,
      aorCode: row.aor,
      courseQualification: learnerDoc.courseQualification,
      registrationStatus: row.registration_status || "CONFIRMED",
      attendanceStatus: row.attendance_status || "PENDING",
      completionStatus: row.completion_status || "INCOMPLETE",
      certificationStatus: row.certification_status || "NOT_ISSUED",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    if (isDryRun) {
      console.log(`[Dry-Run Plan] Would migrate: Ref=${referenceNumber}, Learner=${learnerDoc.firstName} ${learnerDoc.lastName}, Batch=${row.batch_id}`);
    } else {
      // Check for existing duplicate to prevent overwrite
      const existing = await firestore.collection("registrations").where("referenceNumber", "==", referenceNumber).limit(1).get();
      if (!existing.empty) {
        console.log(`[Migration] Already exists in Firestore, skipping: Ref=${referenceNumber}`);
        continue;
      }

      const batchWriter = firestore.batch();
      batchWriter.set(firestore.collection("learners").doc(learnerId), learnerDoc, { merge: true });
      batchWriter.set(firestore.collection("registrations").doc(), regDoc);
      await batchWriter.commit();
      console.log(`[Migration] Migrated: Ref=${referenceNumber}`);
    }

    migratedCount++;
  }

  console.log(`\n======================================================`);
  console.log(`MIGRATION SUMMARY:`);
  console.log(`- Eligible records migrated/planned: ${migratedCount}`);
  console.log(`- Test records skipped:              ${skippedTestCount}`);
  console.log(`- Invalid records rejected:          ${rejectedCount}`);
  console.log(`======================================================\n`);
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[Migration] Error:", err);
    process.exit(1);
  });
