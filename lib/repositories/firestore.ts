import { getAdminDb } from "../firebase/server.ts";
import { generateReferenceNumber } from "../reference.ts";
import { isDeliveryModeAuthorized } from "../batches.ts";
import type {
  BatchRecord,
  BatchRepository,
  RegistrationRecord,
  RegistrationRepository,
  SettingsRepository,
  AuditRepository,
  AtomicRegistrationInput,
  AtomicRegistrationResult,
  EnrichedRegistration,
  SystemSettingsRecord,
  AuditLogRecord,
} from "./types.ts";
import { createHash } from "crypto";

function hashDuplicateKey(batchId: string, email: string): string {
  return createHash("sha256").update(`${batchId.trim().toLowerCase()}:${email.trim().toLowerCase()}`).digest("hex");
}

function hashLearnerKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 24);
}

export class FirestoreBatchRepository implements BatchRepository {
  async getAllBatches(): Promise<BatchRecord[]> {
    const db = getAdminDb();
    const snapshot = await db.collection("batches").get();
    return snapshot.docs.map((doc) => ({ batchId: doc.id, ...doc.data() } as BatchRecord));
  }

  async getBatchById(batchId: string): Promise<BatchRecord | null> {
    const db = getAdminDb();
    const doc = await db.collection("batches").doc(batchId).get();
    if (!doc.exists) return null;
    return { batchId: doc.id, ...doc.data() } as BatchRecord;
  }

  async getBatchesByAor(aorCode: string): Promise<BatchRecord[]> {
    const db = getAdminDb();
    const snapshot = await db.collection("batches").where("aorCode", "==", aorCode).where("enabled", "==", true).get();
    return snapshot.docs.map((doc) => ({ batchId: doc.id, ...doc.data() } as BatchRecord));
  }

  async updateBatch(batchId: string, updates: Partial<BatchRecord>): Promise<BatchRecord> {
    const db = getAdminDb();
    const batchRef = db.collection("batches").doc(batchId);
    await batchRef.update({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    const updated = await batchRef.get();
    return { batchId: updated.id, ...updated.data() } as BatchRecord;
  }
}

export class FirestoreRegistrationRepository implements RegistrationRepository {
  async registerLearnerAtomic(input: AtomicRegistrationInput): Promise<AtomicRegistrationResult> {
    const db = getAdminDb();
    const now = new Date().toISOString();
    const year = 2026;
    const { batchId, aorCode, learner } = input;
    const email = learner.email.trim().toLowerCase();

    const result = await db.runTransaction(async (transaction) => {
      // 1. Read authoritative batch document
      const batchRef = db.collection("batches").doc(batchId);
      const batchDoc = await transaction.get(batchRef);

      if (!batchDoc.exists) {
        const err = new Error("The selected batch does not exist.");
        (err as any).statusCode = 400;
        throw err;
      }

      const batchData = batchDoc.data() as BatchRecord;

      if (!batchData.enabled) {
        const err = new Error("The selected batch is currently unavailable.");
        (err as any).statusCode = 400;
        throw err;
      }

      if (batchData.aorCode !== aorCode) {
        const err = new Error("The selected AOR and batch combination is not available.");
        (err as any).statusCode = 400;
        throw err;
      }

      if (!isDeliveryModeAuthorized(aorCode, batchData.deliveryMode)) {
        const err = new Error("The selected delivery mode is not authorized for this AOR.");
        (err as any).statusCode = 400;
        throw err;
      }

      if (!["OPEN", "NEARLY FULL"].includes(batchData.status)) {
        const err = new Error("Registration for this batch is not open.");
        (err as any).statusCode = 409;
        throw err;
      }

      if (batchData.registrationDeadline && Date.now() > Date.parse(batchData.registrationDeadline)) {
        const err = new Error("The registration deadline for this batch has passed.");
        (err as any).statusCode = 409;
        throw err;
      }

      const currentCount = Number(batchData.registeredCount) || 0;
      const capacity = Number(batchData.capacity) || 25;

      if (currentCount >= capacity) {
        const err = new Error("This batch is already full.");
        (err as any).statusCode = 409;
        throw err;
      }

      // 2. Transaction-safe Duplicate Registration Check
      const dupKey = hashDuplicateKey(batchId, email);
      const dupRef = db.collection("duplicates").doc(dupKey);
      const dupDoc = await transaction.get(dupRef);

      if (dupDoc.exists) {
        const err = new Error("This email is already registered for the selected batch.");
        (err as any).statusCode = 409;
        throw err;
      }

      // 3. Transaction-safe Reference Sequence Generation
      const counterId = `seq_${year}_${aorCode}`;
      const counterRef = db.collection("counters").doc(counterId);
      const counterDoc = await transaction.get(counterRef);

      const nextSeq = (counterDoc.exists ? Number(counterDoc.data()?.currentValue) || 0 : 0) + 1;
      const referenceNumber = generateReferenceNumber({ aorCode, year, sequenceNumber: nextSeq });

      // 4. Create or update learner document
      const learnerId = hashLearnerKey(email);
      const learnerRef = db.collection("learners").doc(learnerId);

      const learnerRecord = {
        ...learner,
        email,
        updatedAt: now,
      };

      // 5. Create registration document
      const regRef = db.collection("registrations").doc();
      const registrationId = regRef.id;

      const registrationRecord: RegistrationRecord = {
        id: registrationId,
        referenceNumber,
        learnerId,
        batchId,
        aorId: batchData.aorId || aorCode,
        aorCode,
        courseQualification: learner.courseQualification,
        registrationStatus: "CONFIRMED",
        attendanceStatus: "PENDING",
        completionStatus: "INCOMPLETE",
        certificationStatus: "NOT_ISSUED",
        createdAt: now,
        updatedAt: now,
      };

      // 6. Compute new batch status
      const newRegisteredCount = currentCount + 1;
      let newStatus: BatchRecord["status"] = "OPEN";
      if (newRegisteredCount >= capacity) {
        newStatus = "FULL";
      } else if (newRegisteredCount >= capacity - 3) {
        newStatus = "NEARLY FULL";
      }

      // 7. Commit atomic writes
      transaction.set(dupRef, {
        batchId,
        registrationId,
        createdAt: now,
      });

      transaction.set(counterRef, {
        currentValue: nextSeq,
        updatedAt: now,
      });

      transaction.set(learnerRef, learnerRecord, { merge: true });
      transaction.set(regRef, registrationRecord);

      transaction.update(batchRef, {
        registeredCount: newRegisteredCount,
        status: newStatus,
        updatedAt: now,
      });

      return {
        registration: registrationRecord,
        learner: learnerRecord,
        batch: {
          ...batchData,
          registeredCount: newRegisteredCount,
          status: newStatus,
        },
      };
    });

    return result;
  }

  async getRegistrationByReference(referenceNumber: string): Promise<EnrichedRegistration | null> {
    const db = getAdminDb();
    const snapshot = await db.collection("registrations").where("referenceNumber", "==", referenceNumber).limit(1).get();
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const reg = { id: doc.id, ...doc.data() } as RegistrationRecord;

    // Load learner & batch
    const [learnerDoc, batchDoc] = await Promise.all([
      db.collection("learners").doc(reg.learnerId).get(),
      db.collection("batches").doc(reg.batchId).get(),
    ]);

    return {
      ...reg,
      learner: learnerDoc.exists ? (learnerDoc.data() as any) : undefined,
      batch: batchDoc.exists ? ({ batchId: batchDoc.id, ...batchDoc.data() } as BatchRecord) : undefined,
    };
  }

  async getAllRegistrations(filter?: { aorCode?: string; batchId?: string }): Promise<EnrichedRegistration[]> {
    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection("registrations");

    if (filter?.batchId) {
      query = query.where("batchId", "==", filter.batchId);
    }
    if (filter?.aorCode) {
      query = query.where("aorCode", "==", filter.aorCode);
    }

    const snapshot = await query.get();
    const registrations = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as RegistrationRecord));

    // Batch load associated learners and batches for enriched view
    const learnerIds = Array.from(new Set(registrations.map((r) => r.learnerId)));
    const batchIds = Array.from(new Set(registrations.map((r) => r.batchId)));

    const learnerMap = new Map<string, any>();
    const batchMap = new Map<string, BatchRecord>();

    await Promise.all([
      ...learnerIds.map(async (lid) => {
        const ldoc = await db.collection("learners").doc(lid).get();
        if (ldoc.exists) learnerMap.set(lid, ldoc.data());
      }),
      ...batchIds.map(async (bid) => {
        const bdoc = await db.collection("batches").doc(bid).get();
        if (bdoc.exists) batchMap.set(bid, { batchId: bdoc.id, ...bdoc.data() } as BatchRecord);
      }),
    ]);

    return registrations.map((r) => ({
      ...r,
      learner: learnerMap.get(r.learnerId),
      batch: batchMap.get(r.batchId),
    }));
  }

  async updateRegistrationStatus(
    registrationId: string,
    updates: Partial<Pick<RegistrationRecord, "registrationStatus" | "attendanceStatus" | "completionStatus" | "certificationStatus">>
  ): Promise<RegistrationRecord> {
    const db = getAdminDb();
    const ref = db.collection("registrations").doc(registrationId);
    await ref.update({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as RegistrationRecord;
  }
}

export class FirestoreSettingsRepository implements SettingsRepository {
  async getSettings(): Promise<SystemSettingsRecord> {
    const db = getAdminDb();
    const doc = await db.collection("systemSettings").doc("global").get();
    if (doc.exists) {
      return doc.data() as SystemSettingsRecord;
    }
    return {
      courseTitle: "Artificial Intelligence Fundamentals and Applications In-House Training (AIFAT)",
      referencePrefix: "AIFAT",
      currentYear: 2026,
      officialContactEmail: "[PENDING OFFICIAL CONFIRMATION]",
      officialContactNumber: "[PENDING OFFICIAL CONFIRMATION]",
      privacyNoticeVersion: "2021-MIS-03-01",
      recordsRetentionPolicy: "[PENDING OFFICIAL CONFIRMATION]",
      registrationEnabled: true,
    };
  }

  async updateSettings(updates: Partial<SystemSettingsRecord>): Promise<SystemSettingsRecord> {
    const db = getAdminDb();
    const ref = db.collection("systemSettings").doc("global");
    await ref.set(updates, { merge: true });
    return this.getSettings();
  }
}

export class FirestoreAuditRepository implements AuditRepository {
  async log(record: AuditLogRecord): Promise<void> {
    const db = getAdminDb();
    await db.collection("auditLogs").add({
      ...record,
      timestamp: record.timestamp || new Date().toISOString(),
    });
  }

  async getRecentLogs(limit = 100): Promise<AuditLogRecord[]> {
    const db = getAdminDb();
    const snapshot = await db.collection("auditLogs").orderBy("timestamp", "desc").limit(limit).get();
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLogRecord));
  }
}
