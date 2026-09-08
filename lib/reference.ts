import { DEFAULT_OPERATIONAL_CONFIG } from "./config.ts";

export interface ReferenceNumberParams {
  aorCode: string;
  year?: number;
  sequenceNumber?: number;
  suffix?: string;
  formatTemplate?: string;
}

// Crockford Base32 alphabet (excludes 0, 1, I, L, O to eliminate visual ambiguity)
const CROCKFORD_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateRandomSuffix(length = 4): string {
  let result = "";
  const randomBytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < length; i++) {
      result += CROCKFORD_ALPHABET[randomBytes[i] % CROCKFORD_ALPHABET.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += CROCKFORD_ALPHABET[Math.floor(Math.random() * CROCKFORD_ALPHABET.length)];
    }
  }
  return result;
}

/**
 * Generates a collision-resistant, institutional reference number according to TSS guidelines.
 * Default template: AIFAT-{YEAR}-{AOR}-{SUFFIX}
 * Example: AIFAT-2026-T-7K2M
 *
 * Registration reference numbers remain clearly separate from official class designations (e.g. AIFAT Class T01-2026).
 */
export function generateReferenceNumber(params: ReferenceNumberParams): string {
  const year = params.year ?? 2026;
  const aor = params.aorCode.trim().toUpperCase();
  const template = params.formatTemplate || "AIFAT-{YEAR}-{AOR}-{SUFFIX}";

  let suffix = params.suffix;
  if (!suffix) {
    if (typeof params.sequenceNumber === "number" && params.sequenceNumber > 0) {
      suffix = String(params.sequenceNumber).padStart(4, "0");
    } else {
      suffix = generateRandomSuffix(4);
    }
  }

  return template
    .replace("{YEAR}", String(year))
    .replace("{AOR}", aor)
    .replace("{SUFFIX}", suffix)
    .replace("{SEQ}", suffix);
}
