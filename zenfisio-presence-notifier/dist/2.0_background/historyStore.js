import { HISTORY_CONFIG, STORAGE_KEYS } from "../1.0_shared/constants.js";
import { patientKeyFromName } from "../1.0_shared/patientName.js";
import { toDateKey } from "../1.0_shared/text.js";
import { storageGet, storageSet } from "./chromeAsync.js";
const recentDispatches = new Map();
let initialized = false;
let historyByDate = {};
const buildRecentKey = (patientKey, statusKind) => {
    return `${statusKind}:${patientKey}`;
};
const pruneRecentDispatches = () => {
    const now = Date.now();
    for (const [key, timestamp] of recentDispatches.entries()) {
        if (now - timestamp > HISTORY_CONFIG.RECENT_WINDOW_MS) {
            recentDispatches.delete(key);
        }
    }
};
const pruneOldDays = () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - HISTORY_CONFIG.MAX_DAYS);
    for (const dateKey of Object.keys(historyByDate)) {
        const parsed = new Date(dateKey);
        if (Number.isNaN(parsed.getTime()) || parsed < cutoff) {
            delete historyByDate[dateKey];
        }
    }
};
const persistHistory = async () => {
    await storageSet({ [STORAGE_KEYS.SENT_HISTORY]: historyByDate });
};
export const initHistoryStore = async () => {
    if (initialized) {
        return;
    }
    initialized = true;
    try {
        const stored = await storageGet([STORAGE_KEYS.SENT_HISTORY]);
        const value = stored[STORAGE_KEYS.SENT_HISTORY];
        if (value && typeof value === "object") {
            historyByDate = value;
        }
    }
    catch (error) {
        console.warn("Falha ao carregar historico", error);
        historyByDate = {};
    }
    pruneOldDays();
    await persistHistory();
};
export const evaluateDispatch = (patientName, statusKind) => {
    const patientKey = patientKeyFromName(patientName);
    if (!patientKey) {
        return { canSend: false, reason: "invalid-patient", patientKey: "" };
    }
    pruneRecentDispatches();
    const recentKey = buildRecentKey(patientKey, statusKind);
    const recentTimestamp = recentDispatches.get(recentKey);
    if (recentTimestamp && Date.now() - recentTimestamp < HISTORY_CONFIG.RECENT_WINDOW_MS) {
        return { canSend: false, reason: "recent-duplicate", patientKey };
    }
    const today = toDateKey();
    const dayHistory = historyByDate[today];
    const existing = dayHistory?.[patientKey];
    if (existing && existing.statusKind === statusKind) {
        return { canSend: false, reason: "already-sent-today", patientKey };
    }
    return { canSend: true, patientKey };
};
export const markDispatched = async (patientName, patientKey, statusKind) => {
    const today = toDateKey();
    const nowIso = new Date().toISOString();
    if (!historyByDate[today]) {
        historyByDate[today] = {};
    }
    historyByDate[today][patientKey] = {
        patientName,
        statusKind,
        lastSentIso: nowIso
    };
    recentDispatches.set(buildRecentKey(patientKey, statusKind), Date.now());
    pruneOldDays();
    await persistHistory();
};
export const listHistory = () => {
    const rows = [];
    for (const [dateKey, dayHistory] of Object.entries(historyByDate)) {
        for (const [patientKey, item] of Object.entries(dayHistory)) {
            rows.push({
                patientKey,
                patientName: item.patientName,
                dateKey,
                statusKind: item.statusKind,
                lastSentIso: item.lastSentIso
            });
        }
    }
    rows.sort((a, b) => {
        if (a.patientName !== b.patientName) {
            return a.patientName.localeCompare(b.patientName, "pt-BR");
        }
        if (a.dateKey !== b.dateKey) {
            return a.dateKey.localeCompare(b.dateKey);
        }
        return a.lastSentIso.localeCompare(b.lastSentIso);
    });
    return rows;
};
export const clearHistory = async () => {
    recentDispatches.clear();
    historyByDate = {};
    await persistHistory();
};
export const removeHistoryEntry = async (patientKey, dateKey, removeAll) => {
    if (!patientKey) {
        return false;
    }
    let changed = false;
    if (removeAll) {
        for (const dayKey of Object.keys(historyByDate)) {
            if (historyByDate[dayKey]?.[patientKey]) {
                delete historyByDate[dayKey][patientKey];
                changed = true;
            }
        }
    }
    else if (dateKey) {
        if (historyByDate[dateKey]?.[patientKey]) {
            delete historyByDate[dateKey][patientKey];
            changed = true;
        }
    }
    else {
        const today = toDateKey();
        if (historyByDate[today]?.[patientKey]) {
            delete historyByDate[today][patientKey];
            changed = true;
        }
    }
    if (changed) {
        await persistHistory();
    }
    return changed;
};
