import { installFloatingMenu, registerFloatingMenuShortcut } from "./floatingMenu.js";
import { getPersistedHighlights, loadPersistedHighlightsFromStorage } from "./highlightRegistry.js";
import { reapplyPersistedHighlights, startHighlightFallbackCheck, startHighlightPersistence } from "./highlightPersistence.js";
import { collectCalendarCards, createInitialStatus, runAppointmentScan } from "./scanner.js";
let status = createInitialStatus();
let controller = null;
const saveStatus = async () => {
    try {
        await chrome.storage.local.set({ "zra.status": status });
    }
    catch {
        // O monitoramento nao deve depender do storage.
    }
};
const updateStatus = (nextStatus) => {
    status = nextStatus;
    void saveStatus();
};
const startScan = async () => {
    if (status.running || controller)
        return status;
    controller = { stopRequested: false };
    const finalStatus = await runAppointmentScan(updateStatus, controller);
    updateStatus(finalStatus);
    controller = null;
    return status;
};
const stopScan = () => {
    if (controller) {
        controller.stopRequested = true;
        status = {
            ...status,
            running: false,
            message: "Parando analise com seguranca...",
            lastScanIso: new Date().toISOString()
        };
        void saveStatus();
    }
    return status;
};
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const respond = async () => {
        if (message.type === "ZRA_START_SCAN") {
            sendResponse(await startScan());
            return;
        }
        if (message.type === "ZRA_STOP_SCAN") {
            sendResponse(stopScan());
            return;
        }
        sendResponse(status);
    };
    void respond();
    return true;
});
const floatingMenuActions = {
    getStatus: () => status,
    startScan: () => {
        void startScan();
    },
    stopScan
};
const ensureFloatingMenu = () => {
    void installFloatingMenu(floatingMenuActions);
};
const collectCardsForHighlight = () => collectCalendarCards();
const restoreHighlightsFromStorage = async () => {
    const restoredCount = await loadPersistedHighlightsFromStorage();
    if (restoredCount === 0)
        return;
    reapplyPersistedHighlights(collectCardsForHighlight);
    status = {
        ...status,
        highlightedCards: getPersistedHighlights().length,
        message: `${restoredCount} destaque(s) restaurado(s) da analise de hoje.`,
        lastScanIso: new Date().toISOString()
    };
    void saveStatus();
};
void saveStatus();
void restoreHighlightsFromStorage();
ensureFloatingMenu();
registerFloatingMenuShortcut();
startHighlightPersistence(collectCardsForHighlight);
startHighlightFallbackCheck(collectCardsForHighlight);
window.setInterval(ensureFloatingMenu, 2500);
