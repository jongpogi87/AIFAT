export interface OperationalConfig {
  officeName: string;
  officeAddress: string;
  contactNumber: string;
  emailAddress: string;
  officeHours: string;
  trainingVenue: string;
  registrationDeadline: string;
  supportInstructions: string;
  dataRetentionPolicy: string;
  referenceNumberPrefix: string;
  referenceNumberFormat: string;
  // Course Configuration
  courseTitle: string;
  trainingYear: number | string;
  courseDescription: string;
  tesdaOpportunityWording: string;
  defaultClassCapacity: number;
  registrationEnabled: boolean;
}

export const DEFAULT_OPERATIONAL_CONFIG: OperationalConfig = {
  officeName: "The Signal School, Signal Regiment, Philippine Army",
  officeAddress: "Fort Andres Bonifacio, Taguig City, Metro Manila",
  contactNumber: "Pending Official TSS Announcement",
  emailAddress: "Pending Official TSS Announcement",
  officeHours: "Monday to Friday, 0800H – 1700H",
  trainingVenue: "Pending Official TSS Announcement",
  registrationDeadline: "Pending Official TSS Announcement",
  supportInstructions: "For registration queries or unit coordination, contact your designated AOR Signal Officer or the TSS Training Directorate.",
  dataRetentionPolicy: "Learner personal information is stored strictly for the duration of the AIFAT training program, course evaluation, and issuance of certificates, subject to the records disposition policy of the Signal Regiment, Philippine Army.",
  referenceNumberPrefix: "AIFAT",
  referenceNumberFormat: "AIFAT-{YEAR}-{AOR}-{SEQ}",
  // Course Configuration defaults
  courseTitle: "Artificial Intelligence Fundamentals and Applications In-House Training (AIFAT)",
  trainingYear: 2026,
  courseDescription: "Comprehensive foundational and applied artificial intelligence training program conducted by The Signal School in collaboration with a TESDA-accredited training provider.",
  tesdaOpportunityWording: "In collaboration with a TESDA-accredited training provider. Qualified completers may be endorsed for national competency assessment where applicable.",
  defaultClassCapacity: 25,
  registrationEnabled: true,
};
