export interface AorRecord {
  aorId: string;
  displayName: string;
  internalCode: string;
  enabled: boolean;
}

export type BatchStatus = "OPEN" | "NEARLY FULL" | "FULL" | "REGISTRATION CLOSED" | "UPCOMING";

export interface BatchRecord {
  batchId: string;
  classDesignation: string;
  aorId: string;
  aorCode: string;
  aorName?: string;
  deliveryMode: "Online" | "Face-to-Face";
  session: "AM" | "PM";
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  registrationDeadline: string | null;
  capacity: number;
  registeredCount: number;
  status: BatchStatus;
  enabled: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface LearnerProfileData {
  lastName: string;
  firstName: string;
  middleName: string;
  extensionName: string;
  fullName?: string;
  street: string;
  barangay: string;
  district: string;
  cityMunicipality: string;
  province: string;
  region: string;
  email: string;
  contactNumber: string;
  nationality: string;
  sex: "Male" | "Female";
  civilStatus: string;
  employmentStatus: string;
  employmentType: string;
  birthdate: string;
  age: number;
  birthCity: string;
  birthProvince: string;
  birthRegion: string;
  educationalAttainment: string;
  parentGuardianName: string;
  parentGuardianAddress: string;
  learnerClassification: string;
  classificationOthers: string;
  courseQualification: string;
  isScholar: boolean;
  scholarshipPackage: string;
  scholarshipPackageOthers: string;
  privacyConsent: boolean;
  applicantCertified: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface RegistrationRecord {
  id: string;
  referenceNumber: string;
  learnerId: string;
  batchId: string;
  aorId: string;
  aorCode: string;
  courseQualification: string;
  registrationStatus: "CONFIRMED" | "WAITLISTED" | "CANCELLED";
  attendanceStatus: "PENDING" | "PRESENT" | "ABSENT" | "EXCUSED";
  completionStatus: "INCOMPLETE" | "COMPLETED" | "DROPPED";
  certificationStatus: "NOT_ISSUED" | "ISSUED" | "WITHHELD";
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface EnrichedRegistration extends RegistrationRecord {
  learner?: LearnerProfileData;
  batch?: BatchRecord;
}

export interface SystemSettingsRecord {
  courseTitle: string;
  referencePrefix: string;
  currentYear: number;
  officialContactEmail: string;
  officialContactNumber: string;
  privacyNoticeVersion: string;
  recordsRetentionPolicy: string;
  registrationEnabled: boolean;
  [key: string]: any;
}

export interface AuditLogRecord {
  id?: string;
  actorUid: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string | Date;
  metadata?: Record<string, unknown>;
}

export interface AtomicRegistrationInput {
  batchId: string;
  aorCode: string;
  learner: LearnerProfileData;
}

export interface AtomicRegistrationResult {
  registration: RegistrationRecord;
  learner: LearnerProfileData;
  batch: BatchRecord;
}

export interface BatchRepository {
  getAllBatches(): Promise<BatchRecord[]>;
  getBatchById(batchId: string): Promise<BatchRecord | null>;
  getBatchesByAor(aorCode: string): Promise<BatchRecord[]>;
  updateBatch(batchId: string, updates: Partial<BatchRecord>): Promise<BatchRecord>;
}

export interface RegistrationRepository {
  registerLearnerAtomic(input: AtomicRegistrationInput): Promise<AtomicRegistrationResult>;
  getRegistrationByReference(referenceNumber: string): Promise<EnrichedRegistration | null>;
  getAllRegistrations(filter?: { aorCode?: string; batchId?: string }): Promise<EnrichedRegistration[]>;
  updateRegistrationStatus(
    registrationId: string,
    updates: Partial<Pick<RegistrationRecord, "registrationStatus" | "attendanceStatus" | "completionStatus" | "certificationStatus">>
  ): Promise<RegistrationRecord>;
}

export interface SettingsRepository {
  getSettings(): Promise<SystemSettingsRecord>;
  updateSettings(updates: Partial<SystemSettingsRecord>): Promise<SystemSettingsRecord>;
}

export interface AuditRepository {
  log(record: AuditLogRecord): Promise<void>;
  getRecentLogs(limit?: number): Promise<AuditLogRecord[]>;
}
