import { MESSAGE_TYPES, STATUS_MESSAGE_PREFIX } from "../1.0_shared/constants.js";
import { isLikelyValidPatientName, sanitizePatientName } from "../1.0_shared/patientName.js";
import { deliverMessageToChat, onChatReady, onTabRemoved } from "./chatMessenger.js";
import { clearHistory, evaluateDispatch, initHistoryStore, listHistory, markDispatched, removeHistoryEntry } from "./historyStore.js";
import { handleCommand, initExtensionState, isExtensionEnabled, toggleExtensionEnabled, waitForStateReady } from "./stateStore.js";
const inFlightDispatches = new Set();
void initExtensionState();
void initHistoryStore();
chrome.commands.onCommand.addListener(command => {
    void handleCommand(command);
});
chrome.tabs.onRemoved.addListener(tabId => {
    void onTabRemoved(tabId);
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== "object") {
        return;
    }
    const type = message.type;
    switch (type) {
        case MESSAGE_TYPES.STATUS_EVENT:
            return handleStatusEvent(message, sendResponse);
        case MESSAGE_TYPES.STATE_QUERY:
            return handleStateQuery(sendResponse);
        case MESSAGE_TYPES.STATE_TOGGLE:
            return handleStateToggle(sendResponse);
        case MESSAGE_TYPES.HISTORY_LIST:
            return handleHistoryList(sendResponse);
        case MESSAGE_TYPES.HISTORY_CLEAR:
            return handleHistoryClear(sendResponse);
        case MESSAGE_TYPES.HISTORY_REMOVE:
            return handleHistoryRemove(message, sendResponse);
        case MESSAGE_TYPES.CHAT_READY:
            return handleChatReady(sender, sendResponse);
        default:
            return;
    }
});
const buildOutgoingMessage = (statusKind, patientName) => {
    const prefix = STATUS_MESSAGE_PREFIX[statusKind];
    return `${prefix}: ${patientName}`;
};
const dispatchKey = (patientKey, statusKind) => `${statusKind}:${patientKey}`;
const handleStatusEvent = (message, sendResponse) => {
    (async () => {
        await waitForStateReady();
        if (!isExtensionEnabled()) {
            sendResponse({ ok: false, skipped: "extension-disabled" });
            return;
        }
        const payload = (message.payload || {});
        const incomingName = typeof payload.patientName === "string" ? payload.patientName : "";
        const statusKind = payload.statusKind;
        if (statusKind !== "confirmed" && statusKind !== "cancelled") {
            sendResponse({ ok: false, error: "invalid-status-kind" });
            return;
        }
        const sanitizedName = sanitizePatientName(incomingName);
        if (!isLikelyValidPatientName(sanitizedName)) {
            sendResponse({ ok: false, skipped: "invalid-patient-name" });
            return;
        }
        const gate = evaluateDispatch(sanitizedName, statusKind);
        if (!gate.canSend || !gate.patientKey) {
            sendResponse({ ok: false, skipped: gate.reason || "blocked" });
            return;
        }
        const lockKey = dispatchKey(gate.patientKey, statusKind);
        if (inFlightDispatches.has(lockKey)) {
            sendResponse({ ok: false, skipped: "in-flight" });
            return;
        }
        inFlightDispatches.add(lockKey);
        try {
            const outgoingMessage = buildOutgoingMessage(statusKind, sanitizedName);
            await deliverMessageToChat(outgoingMessage);
            await markDispatched(sanitizedName, gate.patientKey, statusKind);
            sendResponse({ ok: true });
        }
        catch (error) {
            console.error("Falha ao entregar mensagem no chat", error);
            sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
        }
        finally {
            inFlightDispatches.delete(lockKey);
        }
    })();
    return true;
};
const handleStateQuery = (sendResponse) => {
    (async () => {
        await waitForStateReady();
        sendResponse({ enabled: isExtensionEnabled() });
    })();
    return true;
};
const handleStateToggle = (sendResponse) => {
    (async () => {
        await waitForStateReady();
        const enabled = await toggleExtensionEnabled(true);
        sendResponse({ enabled });
    })();
    return true;
};
const handleHistoryList = (sendResponse) => {
    (async () => {
        await initHistoryStore();
        sendResponse({ ok: true, list: listHistory() });
    })();
    return true;
};
const handleHistoryClear = (sendResponse) => {
    (async () => {
        try {
            await clearHistory();
            sendResponse({ ok: true });
        }
        catch (error) {
            sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
        }
    })();
    return true;
};
const handleHistoryRemove = (message, sendResponse) => {
    (async () => {
        const payload = (message.payload || {});
        const patientKey = typeof payload.patientKey === "string" ? payload.patientKey : "";
        const dateKey = typeof payload.dateKey === "string" ? payload.dateKey : undefined;
        const removeAll = payload.removeAll === true;
        if (!patientKey) {
            sendResponse({ ok: false, error: "patientKey-required" });
            return;
        }
        const changed = await removeHistoryEntry(patientKey, dateKey, removeAll);
        sendResponse({ ok: true, changed });
    })();
    return true;
};
const handleChatReady = (sender, sendResponse) => {
    (async () => {
        const tabId = sender.tab?.id;
        if (typeof tabId === "number") {
            await onChatReady(tabId);
        }
        sendResponse({ ok: true });
    })();
    return true;
};
