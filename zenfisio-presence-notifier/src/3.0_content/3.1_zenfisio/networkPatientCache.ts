import { extractPatientNameFromText, isLikelyValidPatientName, sanitizePatientName } from "../../1.0_shared/patientName.js";

let lastPatientName: string | null = null;
let lastUpdatedAt = 0;
let lastRawSample: string | null = null;

export const cacheNetworkPatientName = (value: string | null | undefined): void => {
  const sanitized = sanitizePatientName(value || "");
  if (!isLikelyValidPatientName(sanitized)) {
    return;
  }

  lastPatientName = sanitized;
  lastUpdatedAt = Date.now();
};

export const cacheNetworkPatientText = (text: string | null | undefined): void => {
  if (!text) {
    return;
  }

  lastRawSample = text;
};

export const cachePatientNameFromText = (text: string | null | undefined): void => {
  if (!text) {
    return;
  }

  const extracted = extractPatientNameFromText(text);
  if (isLikelyValidPatientName(extracted)) {
    cacheNetworkPatientName(extracted);
    return;
  }

  const sanitized = sanitizePatientName(text);
  if (isLikelyValidPatientName(sanitized)) {
    cacheNetworkPatientName(sanitized);
  }
};

export const getCachedNetworkPatientName = (): string | null => {
  if (!lastPatientName) {
    if (lastRawSample) {
      cachePatientNameFromText(lastRawSample);
      if (lastPatientName) {
        return lastPatientName;
      }
    }

    return null;
  }

  if (Date.now() - lastUpdatedAt > 10 * 60 * 1000) {
    lastPatientName = null;
    lastUpdatedAt = 0;
    return null;
  }

  return lastPatientName;
};