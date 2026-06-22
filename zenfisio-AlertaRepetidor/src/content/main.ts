import { installFloatingMenu, registerFloatingMenuShortcut } from "./floatingMenu.js";
import { getPersistedHighlights, loadPersistedHighlightsFromStorage } from "./highlightRegistry.js";
import {
  reapplyPersistedHighlights,
  startHighlightFallbackCheck,
  startHighlightPersistence
} from "./highlightPersistence.js";
import { collectCalendarCards, createInitialStatus, runAppointmentScan } from "./scanner.js";
import type { ScanController, ScanStatus } from "./scanner.js";

type RuntimeMessage =
  | { type: "ZRA_GET_STATUS" }
  | { type: "ZRA_START_SCAN" }
  | { type: "ZRA_STOP_SCAN" };

let status: ScanStatus = createInitialStatus();
let controller: ScanController | null = null;

const saveStatus = async (): Promise<void> => {
  try {
    await chrome.storage.local.set({ "zra.status": status });
  } catch {
    // O monitoramento nao deve depender do storage.
  }
};

const updateStatus = (nextStatus: ScanStatus): void => {
  status = nextStatus;
  void saveStatus();
};

const startScan = async (): Promise<ScanStatus> => {
  if (status.running || controller) return status;

  controller = { stopRequested: false };
  const finalStatus = await runAppointmentScan(updateStatus, controller);
  updateStatus(finalStatus);
  controller = null;
  return status;
};

const stopScan = (): ScanStatus => {
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

chrome.runtime.onMessage.addListener((
  message: RuntimeMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: ScanStatus) => void
): true => {
  const respond = async (): Promise<void> => {
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

const ensureFloatingMenu = (): void => {
  void installFloatingMenu(floatingMenuActions);
};

const collectCardsForHighlight = (): ReturnType<typeof collectCalendarCards> => collectCalendarCards();

const restoreHighlightsFromStorage = async (): Promise<void> => {
  const restoredCount = await loadPersistedHighlightsFromStorage();
  if (restoredCount === 0) return;

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
