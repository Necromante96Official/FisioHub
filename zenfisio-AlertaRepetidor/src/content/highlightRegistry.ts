export type PersistedHighlight = {
  time: string;
  patientName: string;
  label: string;
};

const STORAGE_KEY = "zra.highlights";
const DATE_KEY = "zra.highlightsDate";

const entries: PersistedHighlight[] = [];
let saveTimer: number | undefined;

const normalize = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

const getTodayKey = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const isValidEntry = (value: unknown): value is PersistedHighlight => {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<PersistedHighlight>;
  return typeof entry.time === "string" &&
    typeof entry.patientName === "string" &&
    typeof entry.label === "string";
};

const scheduleSave = (): void => {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void chrome.storage.local.set({
      [STORAGE_KEY]: [...entries],
      [DATE_KEY]: getTodayKey()
    });
  }, 180);
};

export const clearPersistedHighlights = (): void => {
  entries.length = 0;
  scheduleSave();
};

export const addPersistedHighlight = (entry: PersistedHighlight): void => {
  const key = `${entry.time}|${normalize(entry.patientName)}`;
  const existingIndex = entries.findIndex(item => `${item.time}|${normalize(item.patientName)}` === key);
  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }
  scheduleSave();
};

export const getPersistedHighlights = (): readonly PersistedHighlight[] => entries;

export const loadPersistedHighlightsFromStorage = async (): Promise<number> => {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY, DATE_KEY]);
    if (result[DATE_KEY] !== getTodayKey()) {
      entries.length = 0;
      return 0;
    }

    const saved = result[STORAGE_KEY];
    if (!Array.isArray(saved)) return 0;

    entries.length = 0;
    for (const item of saved) {
      if (isValidEntry(item)) entries.push(item);
    }

    return entries.length;
  } catch {
    return 0;
  }
};

export const cardMatchesHighlight = (cardText: string, cardTime: string, entry: PersistedHighlight): boolean => {
  if (cardTime !== entry.time) return false;

  const normalizedCard = normalize(cardText);
  const tokens = normalize(entry.patientName).split(/\s+/).filter(token => token.length >= 3);
  if (tokens.length === 0) return false;

  return tokens.slice(0, 3).every(token => normalizedCard.includes(token));
};
