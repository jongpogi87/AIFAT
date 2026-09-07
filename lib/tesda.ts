export const TESDA_EDUCATIONAL_ATTAINMENTS = [
  "No Grade Completed",
  "Elementary Undergraduate",
  "Elementary Graduate",
  "High School Undergraduate",
  "High School Graduate",
  "Junior High (K-12)",
  "Senior High (K-12)",
  "Post-Secondary Non-Tertiary / Technical Vocational Course Undergraduate",
  "Post-Secondary Non-Tertiary / Technical Vocational Course Graduate",
  "College Undergraduate",
  "College Graduate",
  "Masteral",
  "Doctorate",
] as const;

export const TESDA_CIVIL_STATUSES = [
  "Single",
  "Married",
  "Separated / Divorced / Annulled",
  "Widow/er",
  "Common Law / Live-in",
] as const;

export const TESDA_EMPLOYMENT_STATUSES = [
  "Wage-Employed",
  "Underemployed",
  "Self-Employed",
  "Unemployed",
] as const;

export const TESDA_EMPLOYMENT_TYPES = [
  "None",
  "Casual",
  "Probationary",
  "Contractual",
  "Regular",
  "Job Order",
  "Permanent",
  "Temporary",
] as const;

export const TESDA_LEARNER_CLASSIFICATIONS = [
  "4Ps Beneficiary",
  "Agrarian Reform Beneficiary",
  "Balik Probinsya",
  "Displaced Workers",
  "Drug Dependents Surrenderees/Surrenderers",
  "Family Members of AFP and PNP Killed-in-Action",
  "Family Members of AFP and PNP Wounded-in-Action",
  "Farmers and Fishermen",
  "Indigenous People & Cultural Communities",
  "Industry Workers",
  "Inmates and Detainees",
  "MILF Beneficiary",
  "Out-of-School-Youth",
  "Overseas Filipino Workers (OFW) Dependent",
  "RCEF-RESP",
  "Rebel Returnees/Decommissioned Combatants",
  "Returning/Repatriated Overseas Filipino Workers (OFW)",
  "Student",
  "TESDA Alumni",
  "TVET Trainers",
  "Uniformed Personnel",
  "Victim of Natural Disasters and Calamities",
  "Wounded-in-Action AFP & PNP Personnel",
  "Others (Please Specify)",
] as const;

export const TESDA_SCHOLARSHIP_PACKAGES = [
  "TWSP",
  "PESFA",
  "STEP",
  "Others",
] as const;

export const DEFAULT_COURSE_QUALIFICATION =
  "Artificial Intelligence Fundamentals and Applications In-House Training (AIFAT)";

/**
 * Calculates age in full years from a date string (YYYY-MM-DD).
 */
export function calculateAge(birthdateStr: string, referenceDate = new Date()): number | null {
  if (!birthdateStr) return null;
  const birthDate = new Date(birthdateStr);
  if (isNaN(birthDate.getTime())) return null;

  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const m = referenceDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}
