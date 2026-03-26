import type { StatusKind } from "./types.js";

export const MESSAGE_TYPES = {
  STATUS_EVENT: "zenfisio/status-event",
  CHAT_DELIVER_MESSAGE: "chat/deliver-message",
  CHAT_READY: "chat/ready",
  STATE_QUERY: "extension/state-query",
  STATE_UPDATE: "extension/state-update",
  STATE_TOGGLE: "extension/state-toggle",
  HISTORY_LIST: "extension/history-list",
  HISTORY_CLEAR: "extension/history-clear",
  HISTORY_REMOVE: "extension/history-remove"
} as const;

export const COMMANDS = {
  TOGGLE_EXTENSION: "toggle-extension"
} as const;

export const STORAGE_KEYS = {
  EXTENSION_ENABLED: "zenfisio/extension-enabled",
  CHAT_TAB_ID: "zenfisio/chat-tab-id",
  SENT_HISTORY: "zenfisio/sent-history",
  CARD_POSITION: "zenfisio/card-position"
} as const;

export const STATUS_LABELS = {
  CONFIRMED: "Presenca confirmada",
  CANCELLED: "Nao atendido (Sem cobranca)"
} as const;

export const HISTORY_CONFIG = {
  MAX_DAYS: 14,
  RECENT_WINDOW_MS: 5000
} as const;

export const DEFAULT_EXTENSION_ENABLED = false;

export const CHAT_TARGET_URL = "https://mail.google.com/chat/u/0/#chat/dm/6gXtCoAAAAE";

export const CHAT_URL_PATTERNS = [
  "https://mail.google.com/chat/u/0/#chat/dm/6gXtCoAAAAE",
  "https://mail.google.com/chat/u/*",
  "https://chat.google.com/*"
] as const;

export const STATUS_MESSAGE_PREFIX: Record<StatusKind, string> = {
  confirmed: "Chegou",
  cancelled: "Desmarcacao"
};
