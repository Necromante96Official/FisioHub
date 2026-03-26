import { COMMANDS, DEFAULT_EXTENSION_ENABLED, MESSAGE_TYPES, STORAGE_KEYS } from "../1.0_shared/constants.js";
import { queryTabs, sendMessageToTab, setBadge, storageGet, storageSet } from "./chromeAsync.js";
let extensionEnabled = DEFAULT_EXTENSION_ENABLED;
let initialized = false;
let resolveReady = null;
const readyPromise = new Promise(resolve => {
    resolveReady = resolve;
});
export const waitForStateReady = () => readyPromise;
export const initExtensionState = async () => {
    if (initialized) {
        return;
    }
    initialized = true;
    try {
        const stored = await storageGet([STORAGE_KEYS.EXTENSION_ENABLED]);
        const persisted = stored[STORAGE_KEYS.EXTENSION_ENABLED];
        if (typeof persisted === "boolean") {
            extensionEnabled = persisted;
        }
    }
    catch (error) {
        console.warn("Falha ao carregar estado da extensao", error);
    }
    await setBadge(extensionEnabled);
    await broadcastState(false);
    resolveReady?.();
};
export const isExtensionEnabled = () => extensionEnabled;
export const setExtensionEnabled = async (value, notify = true) => {
    if (value === extensionEnabled) {
        return extensionEnabled;
    }
    extensionEnabled = value;
    try {
        await storageSet({ [STORAGE_KEYS.EXTENSION_ENABLED]: extensionEnabled });
    }
    catch (error) {
        console.warn("Falha ao persistir estado da extensao", error);
    }
    await setBadge(extensionEnabled);
    await broadcastState(notify);
    return extensionEnabled;
};
export const toggleExtensionEnabled = async (notify = true) => {
    return setExtensionEnabled(!extensionEnabled, notify);
};
export const handleCommand = async (command) => {
    if (command !== COMMANDS.TOGGLE_EXTENSION) {
        return;
    }
    await waitForStateReady();
    await toggleExtensionEnabled(true);
};
const broadcastState = async (notify) => {
    const payload = {
        type: MESSAGE_TYPES.STATE_UPDATE,
        payload: {
            enabled: extensionEnabled,
            notify
        }
    };
    try {
        const tabs = await queryTabs({ url: ["https://app.zenfisio.com/*"] });
        await Promise.all(tabs
            .filter(tab => typeof tab.id === "number")
            .map(tab => sendMessageToTab(tab.id, payload).catch(() => undefined)));
    }
    catch (error) {
        console.warn("Falha ao transmitir estado para as tabs", error);
    }
};
