import { MESSAGE_TYPES } from "../../1.0_shared/constants.js";
import { deliverChatMessage } from "./chatMessenger.js";

let registered = false;

export const notifyChatReady = (): void => {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CHAT_READY });
};

export const registerDeliveryListener = (): void => {
  if (registered) {
    return;
  }
  registered = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== MESSAGE_TYPES.CHAT_DELIVER_MESSAGE) {
      return;
    }

    const messageText = typeof message.payload?.messageText === "string" ? message.payload.messageText : "";

    (async () => {
      try {
        await deliverChatMessage(messageText);
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();

    return true;
  });
};
