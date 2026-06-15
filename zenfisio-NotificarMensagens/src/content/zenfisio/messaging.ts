import { MESSAGE_TYPES } from "../../shared/constants.js";
import type { StatusEventPayload } from "../../shared/types.js";
import type { HistoryEntry } from "../../shared/types.js";

export type DispatchResult = {
  ok: boolean;
  skipped?: string;
  error?: string;
};

type LastErrorInfo = {
  message: string;
  occurredAtIso: string;
};

export type ExtensionStatus = {
  enabled: boolean;
  lastError?: LastErrorInfo | null;
};

const sendBackgroundRequest = <TResponse>(message: unknown): Promise<TResponse> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response as TResponse);
    });
  });
};

export const sendStatusEvent = async (payload: StatusEventPayload): Promise<DispatchResult> => {
  const response = await sendBackgroundRequest<DispatchResult>({
    type: MESSAGE_TYPES.STATUS_EVENT,
    payload
  });

  if (!response || typeof response.ok !== "boolean") {
    throw new Error("Resposta invalida do background.");
  }

  return response;
};

export const clearHistoryFromBackground = async (): Promise<boolean> => {
  const response = await sendBackgroundRequest<{ ok?: boolean }>({ type: MESSAGE_TYPES.HISTORY_CLEAR });
  return response?.ok === true;
};

export const listHistoryFromBackground = async (): Promise<HistoryEntry[]> => {
  const response = await sendBackgroundRequest<{ ok?: boolean; list?: HistoryEntry[] }>({ type: MESSAGE_TYPES.HISTORY_LIST });
  return response?.ok === true && Array.isArray(response.list) ? response.list : [];
};

export const getExtensionStatusFromBackground = async (): Promise<ExtensionStatus> => {
  const response = await sendBackgroundRequest<ExtensionStatus>({ type: MESSAGE_TYPES.STATE_QUERY });
  return {
    enabled: response?.enabled === true,
    lastError: response?.lastError ?? null
  };
};

export const openChatFromBackground = async (): Promise<boolean> => {
  const response = await sendBackgroundRequest<{ ok?: boolean }>({ type: MESSAGE_TYPES.OPEN_CHAT });
  return response?.ok === true;
};

export const openHistoryFromBackground = async (): Promise<boolean> => {
  const response = await sendBackgroundRequest<{ ok?: boolean }>({ type: MESSAGE_TYPES.OPEN_HISTORY });
  return response?.ok === true;
};

export const openZenfisioFromBackground = async (): Promise<boolean> => {
  const response = await sendBackgroundRequest<{ ok?: boolean }>({ type: MESSAGE_TYPES.OPEN_ZENFISIO });
  return response?.ok === true;
};

export const testChatFromBackground = async (): Promise<DispatchResult> => {
  return sendBackgroundRequest<DispatchResult>({ type: MESSAGE_TYPES.CHAT_TEST });
};
