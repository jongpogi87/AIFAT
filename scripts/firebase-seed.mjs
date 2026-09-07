import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-aifat-portal";

if (!getApps().length) {
  initializeApp({
    projectId,
  });
}

const db = getFirestore();

const AORS = [
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

export async function runFirebaseSeed(options = { seedTestBatches: true }) {
  console.log("[Firebase Seed] Starting AOR master data seed...");

  const batchWriter = db.batch();

  // 1. Seed AOR Master Data
  for (const aor of AORS) {
    const ref = db.collection("aors").doc(aor.aorId);
    batchWriter.set(ref, aor, { merge: true });
  }

  // 2. Seed System Settings (Placeholders preserved per Section F)
  const settingsRef = db.collection("systemSettings").doc("global");
  batchWriter.set(
    settingsRef,
    {
      courseTitle: "Artificial Intelligence Fundamentals and Applications In-House Training (AIFAT)",
      referencePrefix: "AIFAT",
      currentYear: 2026,
      officialContactEmail: "[PENDING OFFICIAL CONFIRMATION]",
      officialContactNumber: "[PENDING OFFICIAL CONFIRMATION]",
      privacyNoticeVersion: "2021-MIS-03-01",
      recordsRetentionPolicy: "[PENDING OFFICIAL CONFIRMATION]",
      registrationEnabled: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  await batchWriter.commit();
  console.log(`[Firebase Seed] Successfully seeded ${AORS.length} AORs and global system settings.`);

  // 3. Seed Development Batches if requested (Clearly marked TEST DATA)
  if (options.seedTestBatches) {
    console.log("[Firebase Seed] Seeding development batch templates (LABELED TEST DATA)...");
    const dates = { startDate: "14 September 2026", endDate: "25 September 2026" };

    const devBatches = AORS.flatMap(({ displayName, internalCode }) => {
      const sessions = [
        { deliveryMode: "Online", session: "AM", startTime: "0800H", endTime: "1200H", venue: "Online" },
        { deliveryMode: "Online", session: "PM", startTime: "1300H", endTime: "1700H", venue: "Online" },
        ...(internalCode === "T"
          ? [
              {
                deliveryMode: "Face-to-Face",
                session: "AM",
                startTime: "0800H",
                endTime: "1200H",
                venue: "The Signal School, Fort Andres Bonifacio, Taguig City",
              },
              {
                deliveryMode: "Face-to-Face",
                session: "PM",
                startTime: "1300H",
                endTime: "1700H",
                venue: "The Signal School, Fort Andres Bonifacio, Taguig City",
              },
            ]
          : []),
      ];

      return sessions.map((item, index) => ({
        batchId: `${internalCode.toLowerCase()}-${item.deliveryMode === "Online" ? "online" : "f2f"}-${item.session.toLowerCase()}`,
        classDesignation: `AIFAT Class ${internalCode}${String(index + 1).padStart(2, "0")}-2026`,
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
        isTestData: true, // Clearly marked per Section Q
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    });

    const bBatch = db.batch();
    for (const b of devBatches) {
      const bRef = db.collection("batches").doc(b.batchId);
      bBatch.set(bRef, b, { merge: true });
    }
    await bBatch.commit();
    console.log(`[Firebase Seed] Successfully seeded ${devBatches.length} development batches.`);
  }
}

if (process.argv[1]?.endsWith("firebase-seed.mjs")) {
  runFirebaseSeed()
    .then(() => {
      console.log("[Firebase Seed] Done.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Firebase Seed] Error:", err);
      process.exit(1);
    });
}
