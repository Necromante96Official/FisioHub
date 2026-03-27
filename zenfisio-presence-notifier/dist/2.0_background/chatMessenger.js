import { CHAT_TARGET_URL, CHAT_URL_PATTERNS, MESSAGE_TYPES, STORAGE_KEYS } from "../1.0_shared/constants.js";
import { createTab, getTab, queryTabs, sendMessageToTab, storageGet, storageSet, waitForTabComplete } from "./chromeAsync.js";
const pendingByTab = new Map();
let chatTabId = null;
let restoreDone = false;
let creatingTabPromise = null;
const isKnownChatUrl = (url) => {
    if (!url) {
        return false;
    }
    return url.includes("mail.google.com") || url.includes("chat.google.com");
};
const persistChatTabId = async (value) => {
    chatTabId = value;
    await storageSet({ [STORAGE_KEYS.CHAT_TAB_ID]: value });
};
const restoreChatTabId = async () => {
    if (restoreDone) {
        return;
    }
    restoreDone = true;
    try {
        const stored = await storageGet([STORAGE_KEYS.CHAT_TAB_ID]);
        const value = stored[STORAGE_KEYS.CHAT_TAB_ID];
        if (typeof value === "number") {
            chatTabId = value;
        }
    }
    catch (error) {
        console.warn("Falha ao restaurar chatTabId", error);
    }
};
const ensureChatTab = async () => {
    await restoreChatTabId();
    if (typeof chatTabId === "number") {
        try {
            const existing = await getTab(chatTabId);
            if (isKnownChatUrl(existing.url)) {
                if (existing.status !== "complete" && typeof existing.id === "number") {
                    await waitForTabComplete(existing.id);
                }
                return existing;
            }
        }
        catch {
            // no-op
        }
        await persistChatTabId(null);
    }
    const openedTabs = await queryTabs({ url: Array.from(CHAT_URL_PATTERNS) });
    const reusable = openedTabs.find(tab => typeof tab.id === "number");
    if (reusable?.id) {
        if (reusable.status !== "complete") {
            await waitForTabComplete(reusable.id);
        }
        await persistChatTabId(reusable.id);
        return reusable;
    }
    if (creatingTabPromise) {
        return creatingTabPromise;
    }
    creatingTabPromise = (async () => {
        try {
            const created = await createTab({ url: CHAT_TARGET_URL, active: false });
            if (typeof created.id !== "number") {
                throw new Error("Aba de chat criada sem id.");
            }
            await waitForTabComplete(created.id);
            await persistChatTabId(created.id);
            return created;
        }
        finally {
            creatingTabPromise = null;
        }
    })();
    return creatingTabPromise;
};
const isNoReceiverError = (error) => {
    if (!(error instanceof Error)) {
        return false;
    }
    const msg = error.message.toLowerCase();
    return msg.includes("receiving end does not exist") || msg.includes("establish connection");
};
const sendToChatTab = async (tabId, messageText) => {
    await sendMessageToTab(tabId, {
        type: MESSAGE_TYPES.CHAT_DELIVER_MESSAGE,
        payload: { messageText }
    });
};
const ensureQueueEntry = (tabId) => {
    const current = pendingByTab.get(tabId);
    if (current) {
        return current;
    }
    const created = { queue: [], processing: false };
    pendingByTab.set(tabId, created);
    return created;
};
const enqueueDelivery = (tabId, item) => {
    const entry = ensureQueueEntry(tabId);
    entry.queue.push(item);
};
const processQueue = async (tabId) => {
    const entry = pendingByTab.get(tabId);
    if (!entry || entry.processing || entry.queue.length === 0) {
        return;
    }
    entry.processing = true;
    try {
        while (entry.queue.length > 0) {
            const next = entry.queue[0];
            try {
                await sendToChatTab(tabId, next.messageText);
                next.resolve();
                entry.queue.shift();
            }
            catch (error) {
                if (isNoReceiverError(error)) {
                    break;
                }
                next.reject(error instanceof Error ? error : new Error(String(error)));
                entry.queue.shift();
            }
        }
    }
    finally {
        entry.processing = false;
        if (entry.queue.length === 0) {
            pendingByTab.delete(tabId);
        }
    }
};
export const onChatReady = async (tabId) => {
    await processQueue(tabId);
};
export const onTabRemoved = async (tabId) => {
    if (chatTabId === tabId) {
        await persistChatTabId(null);
    }
};
export const deliverMessageToChat = async (messageText) => {
    const tab = await ensureChatTab();
    if (typeof tab.id !== "number") {
        throw new Error("Aba de chat invalida.");
    }
    try {
        await sendToChatTab(tab.id, messageText);
        return;
    }
    catch (error) {
        if (!isNoReceiverError(error)) {
            throw error;
        }
    }
    await new Promise(async (resolve, reject) => {
        const queued = {
            messageText,
            resolve,
            reject
        };
        enqueueDelivery(tab.id, queued);
        try {
            await waitForTabComplete(tab.id);
            await processQueue(tab.id);
        }
        catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
};
