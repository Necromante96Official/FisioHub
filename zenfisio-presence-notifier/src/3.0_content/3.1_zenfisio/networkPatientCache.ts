import { extractPatientNameFromText, isLikelyValidPatientName, sanitizePatientName } from "../../1.0_shared/patientName.js";

let lastPatientName: string | null = null;
let lastUpdatedAt = 0;
let lastRawSample: string | null = null;
let lastRawUpdatedAt = 0;
const subscribers = new Set<() => void>();

const notifySubscribers = (): void => {
  for (const callback of subscribers) {
    try {
      callback();
    } catch (error) {
      console.warn("Falha ao notificar cache de paciente", error);
    }
  }
};

export const cacheNetworkPatientName = (value: string | null | undefined): void => {
  const sanitized = sanitizePatientName(value || "");
  if (!isLikelyValidPatientName(sanitized)) {
    return;
  }

  lastPatientName = sanitized;
  lastUpdatedAt = Date.now();
  notifySubscribers();
};

export const cacheNetworkPatientText = (text: string | null | undefined): void => {
  if (!text) {
    return;
  }

  lastRawSample = text;
  lastRawUpdatedAt = Date.now();
  notifySubscribers();
};

export const cachePatientNameFromText = (text: string | null | undefined): void => {
  if (!text) {
    return;
  }

  const extracted = extractPatientNameFromText(text);
  if (isLikelyValidPatientName(extracted)) {
    cacheNetworkPatientName(extracted);
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

  if (Date.now() - lastUpdatedAt > 90 * 1000) {
    lastPatientName = null;
    lastUpdatedAt = 0;
    return null;
  }

  return lastPatientName;
};

export const getCachedNetworkPatientText = (): string | null => {
  if (!lastRawSample) {
    return null;
  }

  if (Date.now() - lastRawUpdatedAt > 90 * 1000) {
    lastRawSample = null;
    lastRawUpdatedAt = 0;
    return null;
  }

  return lastRawSample;
};

export const subscribeNetworkPatientUpdates = (callback: () => void): (() => void) => {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
};