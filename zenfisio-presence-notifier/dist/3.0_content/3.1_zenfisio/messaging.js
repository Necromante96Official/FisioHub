import { MESSAGE_TYPES } from "../../1.0_shared/constants.js";
export const sendStatusEvent = async (payload) => {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.STATUS_EVENT,
            payload
        }, response => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            if (!response || typeof response.ok !== "boolean") {
                reject(new Error("Resposta invalida do background."));
                return;
            }
            resolve(response);
        });
    });
};
export const clearHistoryFromBackground = async () => {
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
