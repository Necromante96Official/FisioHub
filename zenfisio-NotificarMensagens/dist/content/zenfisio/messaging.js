import { MESSAGE_TYPES } from "../../shared/constants.js";
const sendBackgroundRequest = (message) => {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, response => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(response);
        });
    });
};
export const sendStatusEvent = async (payload) => {
    const response = await sendBackgroundRequest({
        type: MESSAGE_TYPES.STATUS_EVENT,
        payload
    });
    if (!response || typeof response.ok !== "boolean") {
        throw new Error("Resposta invalida do background.");
    }
    return response;
};
export const clearHistoryFromBackground = async () => {
    const response = await sendBackgroundRequest({ type: MESSAGE_TYPES.HISTORY_CLEAR });
    return response?.ok === true;
};
export const listHistoryFromBackground = async () => {
    const response = await sendBackgroundRequest({ type: MESSAGE_TYPES.HISTORY_LIST });
    return response?.ok === true && Array.isArray(response.list) ? response.list : [];
};
export const getExtensionStatusFromBackground = async () => {
    const response = await sendBackgroundRequest({ type: MESSAGE_TYPES.STATE_QUERY });
    return {
        enabled: response?.enabled === true,
        lastError: response?.lastError ?? null
    };
};
export const openChatFromBackground = async () => {
    const response = await sendBackgroundRequest({ type: MESSAGE_TYPES.OPEN_CHAT });
    return response?.ok === true;
};
export const openHistoryFromBackground = async () => {
    const response = await sendBackgroundRequest({ type: MESSAGE_TYPES.OPEN_HISTORY });
    return response?.ok === true;
};
export const openZenfisioFromBackground = async () => {
    const response = await sendBackgroundRequest({ type: MESSAGE_TYPES.OPEN_ZENFISIO });
    return response?.ok === true;
};
export const testChatFromBackground = async () => {
    return sendBackgroundRequest({ type: MESSAGE_TYPES.CHAT_TEST });
};
