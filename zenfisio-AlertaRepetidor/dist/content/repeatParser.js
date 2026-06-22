const REPEAT_PATTERN = /\brepetid[oa]?\s*:?\s*(\d{1,3})\s*(?:de|\/)\s*(\d{1,3})\b/i;
const MAX_VALID_TOTAL = 20;
export const cleanText = (text) => {
    return text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(div|p|span|li|td|tr|strong|b)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};
export const parseRepeatProgress = (text) => {
    const readable = cleanText(text);
    const match = readable.match(REPEAT_PATTERN);
    if (!match)
        return null;
    const current = Number.parseInt(match[1], 10);
    const total = Number.parseInt(match[2], 10);
    if (!Number.isFinite(current) || !Number.isFinite(total))
        return null;
    return {
        current,
        total,
        raw: match[0]
    };
};
export const isRenewalDue = (progress) => {
    return progress.current === progress.total &&
        progress.total >= 1 &&
        progress.total <= MAX_VALID_TOTAL;
};
export const extractTimeRangeStart = (text) => {
    const match = cleanText(text).match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (!match)
        return null;
    return `${match[1].padStart(2, "0")}:${match[2]}`;
};
export const extractPatientName = (text) => {
    const readable = cleanText(text);
    const match = readable.match(/\bPaciente\s*:\s*(.+?)(?=\s+(?:Celular|Conv[eê]nio|Status|Procedimentos?|Repetido|Observa[cç][oõ]es?|Hor[aá]rio)\s*:|$)/i);
    return match?.[1]?.replace(/\s+/g, " ").trim() || null;
};
