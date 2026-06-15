type ProcedureFrequency = 1 | 2 | 3;

export type ProcedureEntry = {
    raw: string;
    baseName: string;
    frequency: ProcedureFrequency;
    value: number;
};

const normalizeText = (value: string): string => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const isNoiseProcedureToken = (value: string): boolean => {
    const normalized = normalizeText(value);
    return /^(?:isento|pagante|nao|não|sem procedimento)$/.test(normalized)
        || /^\d+$/.test(normalized)
        || /^(?:1|2|3)x(?:\s*\/\s*semana|\s*por\s*semana)?$/.test(normalized)
        || /^(?:1|2|3)\s*vez(?:es)?\s*por\s*semana$/.test(normalized)
        || /^(?:1|2|3)x$/.test(normalized);
};

export const splitProcedures = (value: string): string[] => value
    .split(/\n|\s*;\s*|\s*\|\s*|\s*,\s*/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => !isNoiseProcedureToken(part));

export const extractFrequency = (value: string): ProcedureFrequency => {
    const normalized = normalizeText(value);
    if (/3\s*x/.test(normalized) || /3x/.test(normalized)) return 3;
    if (/2\s*x/.test(normalized) || /2x/.test(normalized)) return 2;
    return 1;
};

export const removeFrequencySuffix = (value: string): string => value
    .replace(/\b(?:1|2|3)\s*x(?:\s*\/\s*semana|\s*por\s*semana)?\b/gi, " ")
    .replace(/\b(?:1|2|3)x(?:\s*\/\s*semana|\s*por\s*semana)?\b/gi, " ")
    .replace(/\b(?:1|2|3)\s*vez(?:es)?\s*por\s*semana\b/gi, " ")
    .replace(/\b(?:1|2|3)\s*\/\s*semana\b/gi, " ")
    .replace(/\b(?:1|2|3)\s*semana\b/gi, " ")
    .replace(/\bsemana\b/gi, " ")
    .replace(/\b(?:isento|pagante|nao|não)\b/gi, " ")
    .replace(/[-–]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

export const normalizeSpecialtyLabel = (value: string): string => removeFrequencySuffix(value)
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[-–]\s*$/g, "")
    .trim();

export const getProcedurePrice = (frequency: ProcedureFrequency): number => {
    if (frequency === 2) return 20;
    if (frequency === 3) return 15;
    return 25;
};

export const parseProcedureEntries = (value: string): ProcedureEntry[] => {
    const parts = splitProcedures(value);
    const entries = parts.map((raw) => {
        const frequency = extractFrequency(raw);
        const baseName = normalizeSpecialtyLabel(raw);
        return {
            raw,
            baseName,
            frequency,
            value: getProcedurePrice(frequency)
        };
    }).filter((entry) => entry.baseName.trim().length > 0);

    if (entries.length > 0) {
        return entries;
    }

    if (value.trim().length === 0) {
        return [{ raw: "Sem procedimento", baseName: "Sem procedimento", frequency: 1, value: 0 }];
    }

    const frequency = extractFrequency(value);
    return [{ raw: value, baseName: value, frequency, value: getProcedurePrice(frequency) }];
};