/**
 * LEGACY / PENDING REMOVAL
 *
 * Preserved Cloudflare D1 / SQLite repository implementation.
 * Kept as an immediate, reversible fallback baseline until Firebase
 * acceptance testing and production deployment are finalized.
 */

import { getDb } from "@/db";
import { registrations, learners, auditLogs, systemSettings } from "@/db/schema";
import { getBatch, BATCHES } from "../batches";
import { generateReferenceNumber } from "../reference";
import { isDeliveryModeAuthorized } from "../batches";
import { eq, sql } from "drizzle-orm";
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
} from "./types";

export class LegacyD1BatchRepository implements BatchRepository {
  async getAllBatches(): Promise<BatchRecord[]> {
    return BATCHES.map((b) => ({ ...b, registeredCount: 0 }));
  }

  async getBatchById(batchId: string): Promise<BatchRecord | null> {
    const b = getBatch(batchId);
    return b ? { ...b, registeredCount: 0 } : null;
  }

  async getBatchesByAor(aorCode: string): Promise<BatchRecord[]> {
    return BATCHES.filter((b) => b.aorCode === aorCode && b.enabled).map((b) => ({ ...b, registeredCount: 0 }));
  }

  async updateBatch(batchId: string, updates: Partial<BatchRecord>): Promise<BatchRecord> {
    const b = getBatch(batchId);
    if (!b) throw new Error("Batch not found.");
    return { ...b, ...updates, registeredCount: 0 };
  }
}

export class LegacyD1RegistrationRepository implements RegistrationRepository {
  async registerLearnerAtomic(input: AtomicRegistrationInput): Promise<AtomicRegistrationResult> {
    const { batchId, aorCode, learner } = input;
    const email = learner.email.trim().toLowerCase();
    const batch = getBatch(batchId);

    if (!batch || batch.aorCode !== aorCode) {
      const err = new Error("The selected AOR and batch combination is not available.");
      (err as any).statusCode = 400;
      throw err;
    }

    if (!isDeliveryModeAuthorized(aorCode, batch.deliveryMode)) {
      const err = new Error("The selected delivery mode is not authorized for this AOR.");
      (err as any).statusCode = 400;
      throw err;
    }

    if (!["OPEN", "NEARLY FULL"].includes(batch.status)) {
      const err = new Error("Registration for this batch is not open.");
      (err as any).statusCode = 409;
      throw err;
    }

    const db = getDb();
    const now = new Date();

    // Duplicate check
    const [existingReg] = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(sql`${registrations.email} = ${email} AND ${registrations.batchId} = ${batchId}`);

    if (existingReg) {
      const err = new Error("This email is already registered for the selected batch.");
      (err as any).statusCode = 409;
      throw err;
    }

    // Sequence calculation
    const [aorCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(registrations)
      .where(eq(registrations.aor, aorCode));
    const nextSeq = (Number(aorCountRow?.count) || 0) + 1;
    const referenceNumber = generateReferenceNumber({ aorCode, year: 2026, sequenceNumber: nextSeq });

    // Upsert learner
    let learnerId: number | null = null;
    try {
      const [existingLearner] = await db.select({ id: learners.id }).from(learners).where(eq(learners.email, email));
      if (existingLearner) {
        learnerId = existingLearner.id;
        await db
          .update(learners)
          .set({
            lastName: learner.lastName,
            firstName: learner.firstName,
            middleName: learner.middleName,
            extensionName: learner.extensionName,
            fullName: `${learner.lastName}, ${learner.firstName} ${learner.middleName}`.trim(),
            street: learner.street,
            barangay: learner.barangay,
            district: learner.district,
            cityMunicipality: learner.cityMunicipality,
            province: learner.province,
            region: learner.region,
            contactNumber: learner.contactNumber,
            nationality: learner.nationality,
            sex: learner.sex,
            civilStatus: learner.civilStatus,
            employmentStatus: learner.employmentStatus,
            employmentType: learner.employmentType,
            birthdate: learner.birthdate,
            age: learner.age,
            birthCity: learner.birthCity,
            birthProvince: learner.birthProvince,
            birthRegion: learner.birthRegion,
            educationalAttainment: learner.educationalAttainment,
            parentGuardianName: learner.parentGuardianName,
            parentGuardianAddress: learner.parentGuardianAddress,
            learnerClassification: learner.learnerClassification,
            classificationOthers: learner.classificationOthers,
            isScholar: learner.isScholar,
            scholarshipPackage: learner.scholarshipPackage,
            scholarshipPackageOthers: learner.scholarshipPackageOthers,
          })
          .where(eq(learners.id, learnerId));
      } else {
        await db.insert(learners).values({
          lastName: learner.lastName,
          firstName: learner.firstName,
          middleName: learner.middleName,
          extensionName: learner.extensionName,
          fullName: `${learner.lastName}, ${learner.firstName} ${learner.middleName}`.trim(),
          street: learner.street,
          barangay: learner.barangay,
          district: learner.district,
          cityMunicipality: learner.cityMunicipality,
          province: learner.province,
          region: learner.region,
          email,
          contactNumber: learner.contactNumber,
          nationality: learner.nationality,
          sex: learner.sex,
          civilStatus: learner.civilStatus,
          employmentStatus: learner.employmentStatus,
          employmentType: learner.employmentType,
          birthdate: learner.birthdate,
          age: learner.age,
          birthCity: learner.birthCity,
          birthProvince: learner.birthProvince,
          birthRegion: learner.birthRegion,
          educationalAttainment: learner.educationalAttainment,
          parentGuardianName: learner.parentGuardianName,
          parentGuardianAddress: learner.parentGuardianAddress,
          learnerClassification: learner.learnerClassification,
          classificationOthers: learner.classificationOthers,
          isScholar: learner.isScholar,
          scholarshipPackage: learner.scholarshipPackage,
          scholarshipPackageOthers: learner.scholarshipPackageOthers,
          createdAt: now,
        });
        const [inserted] = await db.select({ id: learners.id }).from(learners).where(eq(learners.email, email));
        learnerId = inserted?.id ?? null;
      }
    } catch {}

    const regRecord = {
      referenceNumber,
      learnerId,
      fullName: `${learner.lastName}, ${learner.firstName} ${learner.middleName}`.trim(),
      email,
      contactNumber: learner.contactNumber,
      aor: aorCode,
      batchId,
      courseQualification: learner.courseQualification,
      registrationStatus: "CONFIRMED" as const,
      registrationTimestamp: now,
      privacyAcknowledged: true,
      privacyAcknowledgedAt: now,
      applicantCertified: true,
      applicantCertifiedAt: now,
      attendanceStatus: "PENDING" as const,
      completionStatus: "INCOMPLETE" as const,
      certificationStatus: "NOT_ISSUED" as const,
      createdAt: now,
    };

    await db.insert(registrations).values(regRecord);

    const registration: RegistrationRecord = {
      id: String(referenceNumber),
      referenceNumber,
      learnerId: String(learnerId || ""),
      batchId,
      aorId: aorCode,
      aorCode,
      courseQualification: learner.courseQualification,
      registrationStatus: "CONFIRMED",
      attendanceStatus: "PENDING",
      completionStatus: "INCOMPLETE",
      certificationStatus: "NOT_ISSUED",
      createdAt: now.toISOString(),
    };

    return {
      registration,
      learner,
      batch: { ...batch, registeredCount: 1 },
    };
  }

  async getRegistrationByReference(referenceNumber: string): Promise<EnrichedRegistration | null> {
    const db = getDb();
    const [reg] = await db.select().from(registrations).where(eq(registrations.referenceNumber, referenceNumber));
    if (!reg) return null;
    const batch = getBatch(reg.batchId);
    return {
      id: String(reg.id),
      referenceNumber: reg.referenceNumber,
      learnerId: String(reg.learnerId || ""),
      batchId: reg.batchId,
      aorId: reg.aor,
      aorCode: reg.aor,
      courseQualification: reg.courseQualification || "",
      registrationStatus: reg.registrationStatus as any,
      attendanceStatus: reg.attendanceStatus as any,
      completionStatus: reg.completionStatus as any,
      certificationStatus: reg.certificationStatus as any,
      createdAt: reg.createdAt.toISOString(),
      batch: batch ? { ...batch, registeredCount: 0 } : undefined,
    };
  }

  async getAllRegistrations(): Promise<EnrichedRegistration[]> {
    const db = getDb();
    const rows = await db
      .select({
        id: registrations.id,
        referenceNumber: registrations.referenceNumber,
        learnerId: registrations.learnerId,
        batchId: registrations.batchId,
        aorCode: registrations.aor,
        courseQualification: registrations.courseQualification,
        registrationStatus: registrations.registrationStatus,
        attendanceStatus: registrations.attendanceStatus,
        completionStatus: registrations.completionStatus,
        certificationStatus: registrations.certificationStatus,
        createdAt: registrations.createdAt,
        learner: {
          lastName: learners.lastName,
          firstName: learners.firstName,
          middleName: learners.middleName,
          extensionName: learners.extensionName,
          email: learners.email,
          contactNumber: learners.contactNumber,
          street: learners.street,
          barangay: learners.barangay,
          district: learners.district,
          cityMunicipality: learners.cityMunicipality,
          province: learners.province,
          region: learners.region,
          nationality: learners.nationality,
          sex: learners.sex,
          civilStatus: learners.civilStatus,
          employmentStatus: learners.employmentStatus,
          employmentType: learners.employmentType,
          birthdate: learners.birthdate,
          age: learners.age,
          birthCity: learners.birthCity,
          birthProvince: learners.birthProvince,
          birthRegion: learners.birthRegion,
          educationalAttainment: learners.educationalAttainment,
          parentGuardianName: learners.parentGuardianName,
          parentGuardianAddress: learners.parentGuardianAddress,
          learnerClassification: learners.learnerClassification,
          classificationOthers: learners.classificationOthers,
          isScholar: learners.isScholar,
          scholarshipPackage: learners.scholarshipPackage,
          scholarshipPackageOthers: learners.scholarshipPackageOthers,
        },
      })
      .from(registrations)
      .leftJoin(learners, eq(registrations.learnerId, learners.id));

    return rows.map((r) => ({
      id: String(r.id),
      referenceNumber: r.referenceNumber,
      learnerId: String(r.learnerId || ""),
      batchId: r.batchId,
      aorId: r.aorCode,
      aorCode: r.aorCode,
      courseQualification: r.courseQualification || "",
      registrationStatus: r.registrationStatus as any,
      attendanceStatus: r.attendanceStatus as any,
      completionStatus: r.completionStatus as any,
      certificationStatus: r.certificationStatus as any,
      createdAt: r.createdAt.toISOString(),
      learner: r.learner as any,
      batch: getBatch(r.batchId) ? { ...getBatch(r.batchId)!, registeredCount: 0 } : undefined,
    }));
  }

  async updateRegistrationStatus(
    registrationId: string,
    updates: Partial<Pick<RegistrationRecord, "registrationStatus" | "attendanceStatus" | "completionStatus" | "certificationStatus">>
  ): Promise<RegistrationRecord> {
    const db = getDb();
    const id = Number(registrationId);
    await db.update(registrations).set(updates).where(eq(registrations.id, id));
    const [updated] = await db.select().from(registrations).where(eq(registrations.id, id));
    return {
      id: String(updated.id),
      referenceNumber: updated.referenceNumber,
      learnerId: String(updated.learnerId || ""),
      batchId: updated.batchId,
      aorId: updated.aor,
      aorCode: updated.aor,
      courseQualification: updated.courseQualification || "",
      registrationStatus: updated.registrationStatus as any,
      attendanceStatus: updated.attendanceStatus as any,
      completionStatus: updated.completionStatus as any,
      certificationStatus: updated.certificationStatus as any,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}

export class LegacyD1SettingsRepository implements SettingsRepository {
  async getSettings(): Promise<SystemSettingsRecord> {
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
    return this.getSettings();
  }
}

export class LegacyD1AuditRepository implements AuditRepository {
  async log(record: AuditLogRecord): Promise<void> {
    const db = getDb();
    try {
      await db.insert(auditLogs).values({
        actor: record.actorUid,
        action: record.action,
        entityType: record.entityType,
        entityId: record.entityId,
        timestamp: new Date(record.timestamp),
        metadata: JSON.stringify(record.metadata || {}),
      });
    } catch {}
  }

  async getRecentLogs(): Promise<AuditLogRecord[]> {
    return [];
  }
}
