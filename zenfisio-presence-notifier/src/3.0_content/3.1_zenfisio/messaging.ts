import { MESSAGE_TYPES } from "../../1.0_shared/constants.js";
import type { StatusEventPayload } from "../../1.0_shared/types.js";
import type { HistoryEntry } from "../../1.0_shared/types.js";

export type DispatchResult = {
  ok: boolean;
  skipped?: string;
  error?: string;
};

export const sendStatusEvent = async (payload: StatusEventPayload): Promise<DispatchResult> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: MESSAGE_TYPES.STATUS_EVENT,
        payload
      },
      response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response || typeof response.ok !== "boolean") {
          reject(new Error("Resposta invalida do background."));
          return;
        }

        resolve(response as DispatchResult);
      }
    );
  });
};

export const clearHistoryFromBackground = async (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.HISTORY_CLEAR }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response || response.ok !== true) {
        resolve(false);
        return;
      }

      resolve(true);
    });
  });
};

export const listHistoryFromBackground = async (): Promise<HistoryEntry[]> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.HISTORY_LIST }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response || response.ok !== true || !Array.isArray(response.list)) {
        resolve([]);
        return;
      }

      resolve(response.list as HistoryEntry[]);
    });
  });
};
