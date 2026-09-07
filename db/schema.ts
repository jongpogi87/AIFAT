import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const aors = sqliteTable("aors", {
  id: text("id").primaryKey(), // "A", "B", ..., "K", "T"
  displayName: text("display_name").notNull(), // "1ID AOR", etc.
  internalCode: text("internal_code").notNull().unique(), // "A", ..., "T"
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
});

export const batches = sqliteTable("batches", {
  id: text("id").primaryKey(), // e.g. "a-online-am", "t-f2f-pm"
  classDesignation: text("class_designation").notNull(), // "AIFAT Class A01-2026"
  aorId: text("aor_id").notNull().references(() => aors.internalCode),
  deliveryMode: text("delivery_mode").notNull(), // "Online" | "Face-to-Face"
  session: text("session").notNull(), // "AM" | "PM"
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  venue: text("venue").notNull(),
  registrationDeadline: text("registration_deadline"), // ISO string or null
  capacity: integer("capacity").default(25),
  status: text("status").notNull().default("OPEN"), // "OPEN"|"NEARLY FULL"|"FULL"|"REGISTRATION CLOSED"|"UPCOMING"
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
});

export const learners = sqliteTable("learners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // TESDA MIS 03-01 Learner Profile Fields
  lastName: text("last_name"),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  extensionName: text("extension_name"),
  fullName: text("full_name").notNull(),

  // Permanent Address
  street: text("street"),
  barangay: text("barangay"),
  district: text("district"),
  cityMunicipality: text("city_municipality"),
  province: text("province"),
  region: text("region"),

  // Contact Details
  email: text("email").notNull(),
  contactNumber: text("contact_number").notNull(),
  nationality: text("nationality").default("Filipino"),

  // Personal Information
  sex: text("sex"), // Male | Female
  civilStatus: text("civil_status"),
  employmentStatus: text("employment_status"),
  employmentType: text("employment_type"),
  birthdate: text("birthdate"),
  age: integer("age"),
  birthCity: text("birth_city"),
  birthProvince: text("birth_province"),
  birthRegion: text("birth_region"),

  // Educational Attainment
  educationalAttainment: text("educational_attainment"),

  // Parent / Guardian (Optional)
  parentGuardianName: text("parent_guardian_name"),
  parentGuardianAddress: text("parent_guardian_address"),

  // Learner Classification
  learnerClassification: text("learner_classification"),
  classificationOthers: text("classification_others"),

  // Scholarship Information
  isScholar: integer("is_scholar", { mode: "boolean" }).default(false),
  scholarshipPackage: text("scholarship_package"),
  scholarshipPackageOthers: text("scholarship_package_others"),

  // TESDA Administrative / System Fields (Nullable)
  uliNumber: text("uli_number"),
  entryDate: text("entry_date"),
  disabilityType: text("disability_type"),
  disabilityCauses: text("disability_causes"),

  // Legacy fields (nullable for backward compatibility)
  rank: text("rank"),
  unit: text("unit"),
  serviceCategory: text("service_category"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("learners_email_idx").on(table.email),
  index("learners_fullname_idx").on(table.fullName),
  index("learners_uli_idx").on(table.uliNumber),
]);

export const registrations = sqliteTable("registrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  referenceNumber: text("reference_number").notNull(),
  learnerId: integer("learner_id").references(() => learners.id),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  contactNumber: text("contact_number").notNull(),
  aor: text("aor").notNull(),
  batchId: text("batch_id").notNull(),
  courseQualification: text("course_qualification").default(
    "Artificial Intelligence Fundamentals and Applications In-House Training (AIFAT)"
  ),

  // Legacy fields (nullable for backward compatibility)
  rank: text("rank"),
  unit: text("unit"),
  serviceCategory: text("service_category"),

  // Statuses
  registrationStatus: text("registration_status").notNull().default("CONFIRMED"),
  registrationTimestamp: integer("registration_timestamp", { mode: "timestamp" }),

  // Privacy & Certification
  privacyAcknowledged: integer("privacy_acknowledged", { mode: "boolean" }).notNull().default(true),
  privacyAcknowledgedAt: integer("privacy_acknowledged_at", { mode: "timestamp" }),
  applicantCertified: integer("applicant_certified", { mode: "boolean" }).notNull().default(true),
  applicantCertifiedAt: integer("applicant_certified_at", { mode: "timestamp" }),

  attendanceStatus: text("attendance_status").notNull().default("PENDING"),
  completionStatus: text("completion_status").notNull().default("INCOMPLETE"),
  certificationStatus: text("certification_status").notNull().default("NOT_ISSUED"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  uniqueIndex("registrations_reference_number_unique").on(table.referenceNumber),
  uniqueIndex("registrations_email_batch_unique").on(table.email, table.batchId),
  index("registrations_batch_idx").on(table.batchId),
  index("registrations_aor_idx").on(table.aor),
]);

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  metadata: text("metadata"),
});

export const adminUsers = sqliteTable("admin_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  role: text("role").notNull().default("ADMIN"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
});

export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
