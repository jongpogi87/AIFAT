import { BATCHES } from "../batches.ts";
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

export class MemoryBatchRepository implements BatchRepository {
  private batches: Map<string, BatchRecord> = new Map();

  constructor(initialBatches?: BatchRecord[]) {
    const list = initialBatches || BATCHES.map((b) => ({ ...b, registeredCount: 0 }));
    for (const b of list) {
      this.batches.set(b.batchId, { ...b });
    }
  }

  async getAllBatches(): Promise<BatchRecord[]> {
    return Array.from(this.batches.values());
  }

  async getBatchById(batchId: string): Promise<BatchRecord | null> {
    return this.batches.get(batchId) || null;
  }

  async getBatchesByAor(aorCode: string): Promise<BatchRecord[]> {
    return Array.from(this.batches.values()).filter((b) => b.aorCode === aorCode && b.enabled);
  }

  async updateBatch(batchId: string, updates: Partial<BatchRecord>): Promise<BatchRecord> {
    const existing = this.batches.get(batchId);
    if (!existing) throw new Error("Batch not found.");
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.batches.set(batchId, updated);
    return updated;
  }
}

export class MemoryRegistrationRepository implements RegistrationRepository {
  private batchRepo: MemoryBatchRepository;
  private learners: Map<string, any> = new Map();
  private registrations: Map<string, RegistrationRecord> = new Map();
  private duplicates: Set<string> = new Set();
  private counters: Map<string, number> = new Map();
  private transactionLock: Promise<void> = Promise.resolve();

  constructor(batchRepo: MemoryBatchRepository) {
    this.batchRepo = batchRepo;
  }

  async registerLearnerAtomic(input: AtomicRegistrationInput): Promise<AtomicRegistrationResult> {
    // Acquire transaction lock to serialize concurrent atomic registrations
    let release: () => void;
    const currentLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previousLock = this.transactionLock;
    this.transactionLock = currentLock;
    await previousLock;

    try {
      return await this.executeAtomic(input);
    } finally {
      release!();
    }
  }

  private async executeAtomic(input: AtomicRegistrationInput): Promise<AtomicRegistrationResult> {
    const { batchId, aorCode, learner } = input;
    const email = learner.email.trim().toLowerCase();
    const now = new Date().toISOString();
    const year = 2026;

    // 1. Authoritative batch checks
    const batch = await this.batchRepo.getBatchById(batchId);
    if (!batch) {
      const err = new Error("The selected batch does not exist.");
      (err as any).statusCode = 400;
      throw err;
    }

    if (!batch.enabled) {
      const err = new Error("The selected batch is currently unavailable.");
      (err as any).statusCode = 400;
      throw err;
    }

    if (batch.aorCode !== aorCode) {
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

    if (batch.registrationDeadline && Date.now() > Date.parse(batch.registrationDeadline)) {
      const err = new Error("The registration deadline for this batch has passed.");
      (err as any).statusCode = 409;
      throw err;
    }

    const currentCount = Number(batch.registeredCount) || 0;
    const capacity = Number(batch.capacity) || 25;

    if (currentCount >= capacity) {
      const err = new Error("This batch is already full.");
      (err as any).statusCode = 409;
      throw err;
    }

    // 2. Duplicate registration check
    const dupKey = hashDuplicateKey(batchId, email);
    if (this.duplicates.has(dupKey)) {
      const err = new Error("This email is already registered for the selected batch.");
      (err as any).statusCode = 409;
      throw err;
    }

    // 3. Counter sequence check
    const counterKey = `seq_${year}_${aorCode}`;
    const nextSeq = (this.counters.get(counterKey) || 0) + 1;
    this.counters.set(counterKey, nextSeq);

    const referenceNumber = generateReferenceNumber({ aorCode, year, sequenceNumber: nextSeq });

    // 4. Learner record
    const learnerId = `learner_${createHash("sha256").update(email).digest("hex").slice(0, 16)}`;
    const learnerRecord = {
      ...learner,
      email,
      updatedAt: now,
    };
    this.learners.set(learnerId, learnerRecord);

    // 5. Registration record
    const regId = `reg_${this.registrations.size + 1}`;
    const registrationRecord: RegistrationRecord = {
      id: regId,
      referenceNumber,
      learnerId,
      batchId,
      aorId: batch.aorId || aorCode,
      aorCode,
      courseQualification: learner.courseQualification,
      registrationStatus: "CONFIRMED",
      attendanceStatus: "PENDING",
      completionStatus: "INCOMPLETE",
      certificationStatus: "NOT_ISSUED",
      createdAt: now,
      updatedAt: now,
    };

    this.registrations.set(regId, registrationRecord);
    this.duplicates.add(dupKey);

    // 6. Update batch count & status
    const newCount = currentCount + 1;
    let newStatus: BatchRecord["status"] = "OPEN";
    if (newCount >= capacity) {
      newStatus = "FULL";
    } else if (newCount >= capacity - 3) {
      newStatus = "NEARLY FULL";
    }

    const updatedBatch = await this.batchRepo.updateBatch(batchId, {
      registeredCount: newCount,
      status: newStatus,
    });

    return {
      registration: registrationRecord,
      learner: learnerRecord,
      batch: updatedBatch,
    };
  }

  async getRegistrationByReference(referenceNumber: string): Promise<EnrichedRegistration | null> {
    for (const reg of this.registrations.values()) {
      if (reg.referenceNumber === referenceNumber) {
        return {
          ...reg,
          learner: this.learners.get(reg.learnerId),
          batch: await this.batchRepo.getBatchById(reg.batchId) || undefined,
        };
      }
    }
    return null;
  }

  async getAllRegistrations(filter?: { aorCode?: string; batchId?: string }): Promise<EnrichedRegistration[]> {
    const list: EnrichedRegistration[] = [];
    for (const reg of this.registrations.values()) {
      if (filter?.batchId && reg.batchId !== filter.batchId) continue;
      if (filter?.aorCode && reg.aorCode !== filter.aorCode) continue;
      list.push({
        ...reg,
        learner: this.learners.get(reg.learnerId),
        batch: (await this.batchRepo.getBatchById(reg.batchId)) || undefined,
      });
    }
    return list;
  }

  async updateRegistrationStatus(
    registrationId: string,
    updates: Partial<Pick<RegistrationRecord, "registrationStatus" | "attendanceStatus" | "completionStatus" | "certificationStatus">>
  ): Promise<RegistrationRecord> {
    const existing = this.registrations.get(registrationId);
    if (!existing) throw new Error("Registration not found.");
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.registrations.set(registrationId, updated);
    return updated;
  }
}

export class MemorySettingsRepository implements SettingsRepository {
  private settings: SystemSettingsRecord = {
    courseTitle: "Artificial Intelligence Fundamentals and Applications In-House Training (AIFAT)",
    referencePrefix: "AIFAT",
    currentYear: 2026,
    officialContactEmail: "[PENDING OFFICIAL CONFIRMATION]",
    officialContactNumber: "[PENDING OFFICIAL CONFIRMATION]",
    privacyNoticeVersion: "2021-MIS-03-01",
    recordsRetentionPolicy: "[PENDING OFFICIAL CONFIRMATION]",
    registrationEnabled: true,
  };

  async getSettings(): Promise<SystemSettingsRecord> {
    return { ...this.settings };
  }

  async updateSettings(updates: Partial<SystemSettingsRecord>): Promise<SystemSettingsRecord> {
    this.settings = { ...this.settings, ...updates };
    return { ...this.settings };
  }
}

export class MemoryAuditRepository implements AuditRepository {
  private logs: AuditLogRecord[] = [];

  async log(record: AuditLogRecord): Promise<void> {
    this.logs.unshift({ ...record, id: `log_${this.logs.length + 1}`, timestamp: record.timestamp || new Date().toISOString() });
  }

  async getRecentLogs(limit = 100): Promise<AuditLogRecord[]> {
    return this.logs.slice(0, limit);
  }
}
