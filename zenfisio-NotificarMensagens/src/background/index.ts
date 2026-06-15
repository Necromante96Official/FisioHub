import { CHAT_TARGET_URL, COMMANDS, MESSAGE_TYPES, ZENFISIO_TARGET_URL } from "../shared/constants.js";
import { formatOutgoingMessage } from "../shared/messageFormat.js";
import { isLikelyValidPatientName, sanitizePatientName } from "../shared/patientName.js";
import type { StatusKind } from "../shared/types.js";
import { deliverMessageToChat, onChatReady, onTabRemoved, testChatConnection } from "./chatMessenger.js";
import { createTab } from "./chromeAsync.js";
import { clearLastError, getLastError, recordLastError } from "./diagnostics.js";
import { clearHistory, evaluateDispatch, initHistoryStore, listHistory, markDispatched, removeHistoryEntry } from "./historyStore.js";
import { isChatSender, isPopupSender, isTrustedStateSender, isZenfisioSender, rejectUntrustedSender } from "./messageSecurity.js";
import { handleCommand, initExtensionState, isExtensionEnabled, toggleExtensionEnabled, waitForStateReady } from "./stateStore.js";

const inFlightDispatches = new Set<string>();

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

  const type = (message as { type?: string }).type;
  switch (type) {
    case MESSAGE_TYPES.STATUS_EVENT:
      if (rejectUntrustedSender(sender, sendResponse, isZenfisioSender)) return true;
      return handleStatusEvent(message as { payload?: unknown }, sendResponse);
    case MESSAGE_TYPES.STATE_QUERY:
      if (rejectUntrustedSender(sender, sendResponse, isTrustedStateSender)) return true;
      return handleStateQuery(sendResponse);
    case MESSAGE_TYPES.STATE_TOGGLE:
      if (rejectUntrustedSender(sender, sendResponse, isTrustedStateSender)) return true;
      return handleStateToggle(sendResponse);
    case MESSAGE_TYPES.HISTORY_LIST:
      if (rejectUntrustedSender(sender, sendResponse, isTrustedStateSender)) return true;
      return handleHistoryList(sendResponse);
    case MESSAGE_TYPES.HISTORY_CLEAR:
      if (rejectUntrustedSender(sender, sendResponse, isTrustedStateSender)) return true;
      return handleHistoryClear(sendResponse);
    case MESSAGE_TYPES.HISTORY_REMOVE:
      if (rejectUntrustedSender(sender, sendResponse, isTrustedStateSender)) return true;
      return handleHistoryRemove(message as { payload?: unknown }, sendResponse);
    case MESSAGE_TYPES.OPEN_HISTORY:
      if (rejectUntrustedSender(sender, sendResponse, isTrustedStateSender)) return true;
      return handleOpenUrl(chrome.runtime.getURL("src/ui/popup.html"), sendResponse);
    case MESSAGE_TYPES.CHAT_READY:
      if (rejectUntrustedSender(sender, sendResponse, isChatSender)) return true;
      return handleChatReady(sender, sendResponse);
    case MESSAGE_TYPES.CHAT_TEST:
      if (rejectUntrustedSender(sender, sendResponse, isTrustedStateSender)) return true;
      return handleChatTest(sendResponse);
    case MESSAGE_TYPES.OPEN_ZENFISIO:
      if (rejectUntrustedSender(sender, sendResponse, isTrustedStateSender)) return true;
      return handleOpenUrl(ZENFISIO_TARGET_URL, sendResponse);
    case MESSAGE_TYPES.OPEN_CHAT:
      if (rejectUntrustedSender(sender, sendResponse, isTrustedStateSender)) return true;
      return handleOpenUrl(CHAT_TARGET_URL, sendResponse);
    default:
      return;
  }
});

const dispatchKey = (patientKey: string, statusKind: StatusKind): string => `${statusKind}:${patientKey}`;

const handleStatusEvent = (
  message: { payload?: unknown },
  sendResponse: (response?: unknown) => void
): true => {
  (async () => {
    await waitForStateReady();

    if (!isExtensionEnabled()) {
      sendResponse({ ok: false, skipped: "extension-disabled" });
      return;
    }

    const payload = (message.payload || {}) as Record<string, unknown>;
    const incomingName = typeof payload.patientName === "string" ? payload.patientName : "";
    const statusKind = payload.statusKind;

    if (statusKind !== "confirmed" && statusKind !== "cancelled" && statusKind !== "missed") {
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
      const outgoingMessage = formatOutgoingMessage(statusKind, sanitizedName);
      await deliverMessageToChat(outgoingMessage);
      await clearLastError();
      await markDispatched(sanitizedName, gate.patientKey, statusKind);
      sendResponse({ ok: true });
    } catch (error) {
      console.error("Falha ao entregar mensagem no chat", error);
      await recordLastError(error);
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      inFlightDispatches.delete(lockKey);
    }
  })();

  return true;
};

const handleStateQuery = (sendResponse: (response?: unknown) => void): true => {
  (async () => {
    await waitForStateReady();
    sendResponse({ enabled: isExtensionEnabled(), lastError: await getLastError() });
  })();
  return true;
};

const handleStateToggle = (sendResponse: (response?: unknown) => void): true => {
  (async () => {
    await waitForStateReady();
    const enabled = await toggleExtensionEnabled(true);
    sendResponse({ enabled });
  })();
  return true;
};

const handleHistoryList = (sendResponse: (response?: unknown) => void): true => {
  (async () => {
    await initHistoryStore();
    sendResponse({ ok: true, list: listHistory() });
  })();
  return true;
};

const handleHistoryClear = (sendResponse: (response?: unknown) => void): true => {
  (async () => {
    try {
      await clearHistory();
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();
  return true;
};

const handleChatTest = (sendResponse: (response?: unknown) => void): true => {
  (async () => {
    try {
      await testChatConnection();
      await deliverMessageToChat("*✅ Teste:* *Mensagem de teste da extensão zenfisio-NotificarMensagens.*");
      await clearLastError();
      sendResponse({ ok: true });
    } catch (error) {
      await recordLastError(error);
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();

  return true;
};

const handleOpenUrl = (url: string, sendResponse: (response?: unknown) => void): true => {
  (async () => {
    try {
      await createTab({ url, active: true });
      sendResponse({ ok: true });
    } catch (error) {
      await recordLastError(error);
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();

  return true;
};

const handleHistoryRemove = (
  message: { payload?: unknown },
  sendResponse: (response?: unknown) => void
): true => {
  (async () => {
    const payload = (message.payload || {}) as Record<string, unknown>;
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

const handleChatReady = (
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): true => {
  (async () => {
    const tabId = sender.tab?.id;
    if (typeof tabId === "number") {
      await onChatReady(tabId);
    }
    sendResponse({ ok: true });
  })();

  return true;
};
