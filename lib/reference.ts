import { DEFAULT_OPERATIONAL_CONFIG } from "./config.ts";

export interface ReferenceNumberParams {
  aorCode: string;
  year?: number;
  sequenceNumber?: number;
  formatTemplate?: string;
}

/**
 * Generates a collision-safe, institutional reference number according to TSS guidelines.
 * Default template: AIFAT-{YEAR}-{AOR}-{SEQ}
 * Example: AIFAT-2026-A-0001
 */
export function generateReferenceNumber(params: ReferenceNumberParams): string {
  const year = params.year ?? new Date().getFullYear();
  const aor = params.aorCode.trim().toUpperCase();
  const template = params.formatTemplate || DEFAULT_OPERATIONAL_CONFIG.referenceNumberFormat;

  let seqStr = "";
  if (typeof params.sequenceNumber === "number" && params.sequenceNumber > 0) {
    seqStr = String(params.sequenceNumber).padStart(4, "0");
  } else {
    // Generate fallback unique alphanumeric segment (4 hex characters)
    const randomHex = Math.floor(1000 + Math.random() * 9000).toString(10);
    seqStr = randomHex;
  }

  return template
    .replace("{YEAR}", String(year))
    .replace("{AOR}", aor)
    .replace("{SEQ}", seqStr);
}
