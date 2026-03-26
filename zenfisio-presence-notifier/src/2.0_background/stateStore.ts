import { COMMANDS, DEFAULT_EXTENSION_ENABLED, MESSAGE_TYPES, STORAGE_KEYS } from "../1.0_shared/constants.js";
import { queryTabs, sendMessageToTab, setBadge, storageGet, storageSet } from "./chromeAsync.js";

let extensionEnabled = DEFAULT_EXTENSION_ENABLED;
let initialized = false;
let resolveReady: (() => void) | null = null;

const readyPromise = new Promise<void>(resolve => {
  resolveReady = resolve;
});

export const waitForStateReady = (): Promise<void> => readyPromise;

export const initExtensionState = async (): Promise<void> => {
  if (initialized) {
    return;
  }

  initialized = true;

  try {
    const stored = await storageGet<Record<string, unknown>>([STORAGE_KEYS.EXTENSION_ENABLED]);
    const persisted = stored[STORAGE_KEYS.EXTENSION_ENABLED];
    if (typeof persisted === "boolean") {
      extensionEnabled = persisted;
    }
  } catch (error) {
    console.warn("Falha ao carregar estado da extensao", error);
  }

  await setBadge(extensionEnabled);
  await broadcastState(false);
  resolveReady?.();
};

export const isExtensionEnabled = (): boolean => extensionEnabled;

export const setExtensionEnabled = async (value: boolean, notify = true): Promise<boolean> => {
  if (value === extensionEnabled) {
    return extensionEnabled;
  }

  extensionEnabled = value;

  try {
    await storageSet({ [STORAGE_KEYS.EXTENSION_ENABLED]: extensionEnabled });
  } catch (error) {
    console.warn("Falha ao persistir estado da extensao", error);
  }

  await setBadge(extensionEnabled);
  await broadcastState(notify);
  return extensionEnabled;
};

export const toggleExtensionEnabled = async (notify = true): Promise<boolean> => {
  return setExtensionEnabled(!extensionEnabled, notify);
};

export const handleCommand = async (command: string): Promise<void> => {
  if (command !== COMMANDS.TOGGLE_EXTENSION) {
    return;
  }

  await waitForStateReady();
  await toggleExtensionEnabled(true);
};

const broadcastState = async (notify: boolean): Promise<void> => {
  const payload = {
    type: MESSAGE_TYPES.STATE_UPDATE,
    payload: {
      enabled: extensionEnabled,
      notify
    }
  };

  try {
    const tabs = await queryTabs({ url: ["https://app.zenfisio.com/*"] });
    await Promise.all(
      tabs
        .filter(tab => typeof tab.id === "number")
        .map(tab => sendMessageToTab(tab.id as number, payload).catch(() => undefined))
    );
  } catch (error) {
    console.warn("Falha ao transmitir estado para as tabs", error);
  }
};
