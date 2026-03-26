import { DEFAULT_EXTENSION_ENABLED, MESSAGE_TYPES } from "../../1.0_shared/constants.js";

let initialized = false;
let enabled = DEFAULT_EXTENSION_ENABLED;
const subscribers = new Set<(value: boolean) => void>();

const notifySubscribers = (): void => {
  for (const callback of subscribers) {
    try {
      callback(enabled);
    } catch (error) {
      console.warn("Erro ao notificar subscribers de estado", error);
    }
  }
};

const applyState = (value: unknown): void => {
  if (typeof value !== "boolean") {
    return;
  }
  if (value === enabled) {
    return;
  }
  enabled = value;
  notifySubscribers();
};

export const initExtensionState = async (): Promise<boolean> => {
  if (initialized) {
    return enabled;
  }

  initialized = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== MESSAGE_TYPES.STATE_UPDATE) {
      return;
    }

    applyState(message.payload?.enabled);
    sendResponse?.({ ok: true });
  });

  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.STATE_QUERY }, response => {
      if (chrome.runtime.lastError || !response) {
        resolve(enabled);
        return;
      }

      applyState(response.enabled);
      resolve(enabled);
    });
  });
};

export const isExtensionEnabled = (): boolean => enabled;

export const toggleExtensionState = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.STATE_TOGGLE }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response || typeof response.enabled !== "boolean") {
        reject(new Error("Resposta invalida ao alternar estado."));
        return;
      }

      applyState(response.enabled);
      resolve(response.enabled);
    });
  });
};

export const onStateChange = (callback: (value: boolean) => void): (() => void) => {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
};
