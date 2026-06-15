import { STORAGE_KEYS } from "../shared/constants.js";
import { storageGet, storageRemove, storageSet } from "./chromeAsync.js";

export type LastErrorInfo = {
  message: string;
  occurredAtIso: string;
};

let lastError: LastErrorInfo | null = null;

export const recordLastError = async (error: unknown): Promise<void> => {
  lastError = {
    message: error instanceof Error ? error.message : String(error),
    occurredAtIso: new Date().toISOString()
  };

  await storageSet({ [STORAGE_KEYS.LAST_ERROR]: lastError });
};

export const clearLastError = async (): Promise<void> => {
  lastError = null;
  await storageRemove([STORAGE_KEYS.LAST_ERROR]);
};

export const getLastError = async (): Promise<LastErrorInfo | null> => {
  if (lastError) {
    return lastError;
  }

  const stored = await storageGet<Record<string, unknown>>([STORAGE_KEYS.LAST_ERROR]);
  const value = stored[STORAGE_KEYS.LAST_ERROR];
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<LastErrorInfo>;
  if (typeof candidate.message !== "string" || typeof candidate.occurredAtIso !== "string") {
    return null;
  }

  lastError = {
    message: candidate.message,
    occurredAtIso: candidate.occurredAtIso
  };
  return lastError;
};

