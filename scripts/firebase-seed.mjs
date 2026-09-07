import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "aifat-registration";

if (!getApps().length) {
  initializeApp({
    projectId,
  });
}

const db = getFirestore();

export const AORS = [
  { aorId: "1id", displayName: "1ID AOR", internalCode: "A", enabled: true },
  { aorId: "2id", displayName: "2ID AOR", internalCode: "B", enabled: true },
  { aorId: "3id", displayName: "3ID AOR", internalCode: "C", enabled: true },
  { aorId: "4id", displayName: "4ID AOR", internalCode: "D", enabled: true },
  { aorId: "5id", displayName: "5ID AOR", internalCode: "E", enabled: true },
  { aorId: "6id", displayName: "6ID AOR", internalCode: "F", enabled: true },
  { aorId: "7id", displayName: "7ID AOR", internalCode: "G", enabled: true },
  { aorId: "8id", displayName: "8ID AOR", internalCode: "H", enabled: true },
  { aorId: "9id", displayName: "9ID AOR", internalCode: "I", enabled: true },
  { aorId: "10id", displayName: "10ID AOR", internalCode: "J", enabled: true },
  { aorId: "11id", displayName: "11ID AOR", internalCode: "K", enabled: true },
  { aorId: "ncr", displayName: "NCR AOR", internalCode: "T", enabled: true },
];

export async function runFirebaseSeed(options = {}) {
  const isDryRun = options.dryRun ?? !process.argv.includes("--execute");

  console.log("\n=======================================================");
  console.log(`AIFAT FIREBASE REFERENCE DATA SEEDING UTILITY`);
  console.log(`Target Project: ${projectId}`);
  console.log(`Mode:           ${isDryRun ? "DRY-RUN / PREVIEW (No writes will occur)" : "EXECUTE (Live Firestore Writes)"}`);
  console.log("=======================================================\n");

  const year = options.currentYear || process.env.AIFAT_YEAR || 2026;
  const startDate = options.startDate || process.env.AIFAT_START_DATE || "[Pending Official TSS Announcement]";
  const endDate = options.endDate || process.env.AIFAT_END_DATE || "[Pending Official TSS Announcement]";
  const dates = { startDate, endDate };

  const f2fVenue = options.f2fVenue || process.env.OFFICIAL_F2F_VENUE || "[Pending Official TSS Announcement]";

  // 1. Build AOR documents
  const aorDocs = AORS.map((aor) => ({
    path: `aors/${aor.aorId}`,
    data: aor,
  }));

  // 2. Build System Settings document (Placeholders strictly preserved)
  const settingsDoc = {
    path: "systemSettings/global",
    data: {
      courseTitle: "Artificial Intelligence Fundamentals and Applications In-House Training (AIFAT)",
      referencePrefix: "AIFAT",
      currentYear: Number(year),
      officialContactEmail: options.officialContactEmail || process.env.OFFICIAL_CONTACT_EMAIL || "[Pending Official TSS Announcement]",
      officialContactNumber: options.officialContactNumber || process.env.OFFICIAL_CONTACT_NUMBER || "[Pending Official TSS Announcement]",
      privacyNoticeVersion: "2021-MIS-03-01",
      recordsRetentionPolicy: options.recordsRetentionPolicy || process.env.RECORDS_RETENTION_POLICY || "[Pending Official TSS Announcement]",
      registrationEnabled: options.registrationEnabled ?? true,
      updatedAt: new Date().toISOString(),
    },
  };

  // 3. Build Batch documents with explicitly defined class numbers in the template
  const batchDocs = AORS.flatMap(({ displayName, internalCode }) => {
    const sessionTemplates = [
      {
        classNumber: 1,
        deliveryMode: "Online",
        session: "AM",
        startTime: "0800H",
        endTime: "1200H",
        venue: "Online",
      },
      {
        classNumber: 2,
        deliveryMode: "Online",
        session: "PM",
        startTime: "1300H",
        endTime: "1700H",
        venue: "Online",
      },
      ...(internalCode === "T"
        ? [
            {
              classNumber: 3,
              deliveryMode: "Face-to-Face",
              session: "AM",
              startTime: "0800H",
              endTime: "1200H",
              venue: f2fVenue,
            },
            {
              classNumber: 4,
              deliveryMode: "Face-to-Face",
              session: "PM",
              startTime: "1300H",
              endTime: "1700H",
              venue: f2fVenue,
            },
          ]
        : []),
    ];

    return sessionTemplates.map((template) => {
      const { classNumber, ...item } = template;
      const classNumPadded = String(classNumber).padStart(2, "0");
      const batchId = `${internalCode.toLowerCase()}-${item.deliveryMode === "Online" ? "online" : "f2f"}-${item.session.toLowerCase()}`;
      return {
        path: `batches/${batchId}`,
        data: {
          batchId,
          classDesignation: `AIFAT Class ${internalCode}${classNumPadded}-${year}`,
          aorId: displayName.toLowerCase().replace(/\s+/g, "-"),
          aorCode: internalCode,
          aorName: displayName,
          ...item,
          ...dates,
          registrationDeadline: null,
          capacity: 25,
          registeredCount: 0,
          status: "OPEN",
          enabled: true,
          isTestData: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  });

  if (isDryRun) {
    console.log(`[Idempotency & Scope Blueprint]:`);
    console.log(`- AORs:             ${aorDocs.length} reference documents (1ID–11ID + NCR)`);
    console.log(`- systemSettings:   1 document (systemSettings/global) [will NOT overwrite if existing]`);
    console.log(`- Batches:          ${batchDocs.length} reference batches (22 Online regional + 4 NCR Online/F2F)`);
    console.log(`- adminProfiles:    0 documents touched (SUPER_ADMIN strictly preserved)`);
    console.log(`- learners:         0 documents touched (zero learner records affected)`);
    console.log(`- registrations:    0 documents touched (zero registration records affected)`);
    console.log(`- auditLogs:        0 documents touched\n`);

    console.log(`[DRY-RUN Document Inventory]:`);
    console.log(`1. AORs (${aorDocs.length}):`);
    aorDocs.forEach((d) => console.log(`   - ${d.path} (${d.data.displayName} [${d.data.internalCode}])`));

    console.log(`\n2. System Settings (1):`);
    console.log(`   - ${settingsDoc.path}`);

    console.log(`\n3. Batches (${batchDocs.length}):`);
    batchDocs.forEach((d) => console.log(`   - ${d.path} -> ${d.data.classDesignation} (${d.data.deliveryMode} ${d.data.session}, cap: ${d.data.capacity})`));

    console.log(`\n[DRY-RUN COMPLETE] No writes were committed to Firestore. Pass --execute to write.`);
    return {
      dryRun: true,
      totalReferenceDocs: aorDocs.length + 1 + batchDocs.length,
    };
  }

  // Live write execution (Performs idempotency check against live Firestore)
  console.log(`[Executing Idempotency Check] Querying existing Firestore documents...`);
  let existingSettings = null;
  const existingAorIds = new Set();
  const existingBatchMap = new Map();

  try {
    const [settingsSnap, aorsSnap, batchesSnap] = await Promise.all([
      db.doc(settingsDoc.path).get(),
      db.collection("aors").get(),
      db.collection("batches").get(),
    ]);

    if (settingsSnap.exists) {
      existingSettings = settingsSnap.data();
    }
    aorsSnap.forEach((doc) => existingAorIds.add(doc.id));
    batchesSnap.forEach((doc) => existingBatchMap.set(doc.id, doc.data()));
  } catch (err) {
    console.warn(`[Idempotency Check] Warning: Unable to query existing Firestore documents (${err?.message}).`);
  }

  // Determine operations while strictly preserving existing administrator modifications
  const aorsToCreate = aorDocs.filter((d) => !existingAorIds.has(d.data.aorId));
  const aorsExisting = aorDocs.filter((d) => existingAorIds.has(d.data.aorId));

  const batchesToCreate = [];
  const batchesPreserved = [];

  for (const b of batchDocs) {
    const existing = existingBatchMap.get(b.data.batchId);
    if (!existing) {
      batchesToCreate.push(b);
    } else {
      batchesPreserved.push({
        path: b.path,
        batchId: b.data.batchId,
        registeredCount: existing.registeredCount ?? 0,
        status: existing.status ?? "OPEN",
        capacity: existing.capacity ?? 25,
      });
    }
  }

  const settingsWillPreserve = Boolean(existingSettings);

  console.log(`[Idempotency & Scope Analysis]:`);
  console.log(`- AORs:             ${aorsToCreate.length} new to create, ${aorsExisting.length} existing preserved`);
  console.log(`- systemSettings:   ${settingsWillPreserve ? "EXISTING PRESERVED (admin edits untouched)" : "1 new default template to create"}`);
  console.log(`- Batches:          ${batchesToCreate.length} new to create, ${batchesPreserved.length} existing preserved (counts/statuses intact)`);
  console.log(`- adminProfiles:    0 documents touched (SUPER_ADMIN preserved)`);
  console.log(`- learners:         0 documents touched`);
  console.log(`- registrations:    0 documents touched`);
  console.log(`- auditLogs:        0 documents touched\n`);

  console.log(`[Executing Live Writes] Committing only missing reference documents...`);
  const batch = db.batch();
  let writeCount = 0;

  for (const doc of aorsToCreate) {
    batch.set(db.doc(doc.path), doc.data);
    writeCount++;
  }

  if (!existingSettings) {
    batch.set(db.doc(settingsDoc.path), settingsDoc.data);
    writeCount++;
  } else {
    console.log(`[Idempotency] 'systemSettings/global' already exists. Skipped write to preserve administrator settings.`);
  }

  for (const doc of batchesToCreate) {
    batch.set(db.doc(doc.path), doc.data);
    writeCount++;
  }

  if (writeCount > 0) {
    await batch.commit();
    console.log(`[SUCCESS] Successfully created ${writeCount} new reference documents in '${projectId}'.`);
  } else {
    console.log(`[SUCCESS] All reference documents already exist in '${projectId}'. Zero documents overwritten.`);
  }

  return {
    dryRun: false,
    writesCommitted: writeCount,
    batchesPreserved: batchesPreserved.length,
    settingsPreserved: settingsWillPreserve,
  };
}

if (process.argv[1]?.endsWith("firebase-seed.mjs")) {
  runFirebaseSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Firebase Seed] Error:", err);
      process.exit(1);
    });
}
