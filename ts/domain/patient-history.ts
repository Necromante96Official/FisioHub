import type { PatientChangeFieldKey, PatientChangeHistoryEntry, PatientRecord } from "./fisiohub-models.js";

const PATIENT_CHANGE_FIELD_KEYS: PatientChangeFieldKey[] = [
    "nome",
    "statusFinanceiro",
    "horario",
    "fisioterapeuta",
    "celular",
    "convenio",
    "procedimentos"
];

const PATIENT_CHANGE_FIELD_LABELS: Record<PatientChangeFieldKey, string> = {
    nome: "Paciente",
    statusFinanceiro: "Status financeiro",
    horario: "Horário",
    fisioterapeuta: "Fisioterapeuta",
    celular: "Celular",
    convenio: "Convênio",
    procedimentos: "Procedimentos"
};

const normalizeText = (value: string): string => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const toIsoDate = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const todayIso = (): string => toIsoDate(new Date());

const isPatientChangeFieldKey = (value: unknown): value is PatientChangeFieldKey => {
    return typeof value === "string" && PATIENT_CHANGE_FIELD_KEYS.includes(value as PatientChangeFieldKey);
};

const safeChangeValue = (value: unknown): string => {
    if (typeof value !== "string") {
        return "-";
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "-";
};

export const buildPatientRecordKey = (record: Pick<PatientRecord, "nome" | "celular">): string => {
    const normalizedName = normalizeText(record.nome);
    const normalizedPhone = record.celular.replace(/\D/g, "");
    return `${normalizedName}|${normalizedPhone}`;
};

export const parsePatientChangeHistory = (value: unknown): PatientChangeHistoryEntry[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => {
            const candidate = item as Partial<PatientChangeHistoryEntry>;
            const fieldKey = isPatientChangeFieldKey(candidate.fieldKey) ? candidate.fieldKey : null;
            if (!fieldKey) {
                return null;
            }

            const fieldLabel = typeof candidate.fieldLabel === "string" && candidate.fieldLabel.trim().length > 0
                ? candidate.fieldLabel.trim()
                : PATIENT_CHANGE_FIELD_LABELS[fieldKey];

            return {
                referenceDateIso: typeof candidate.referenceDateIso === "string" && candidate.referenceDateIso.trim().length > 0
                    ? candidate.referenceDateIso.trim()
                    : todayIso(),
                fieldKey,
                fieldLabel,
                previousValue: safeChangeValue(candidate.previousValue),
                nextValue: safeChangeValue(candidate.nextValue)
            };
        })
        .filter((entry): entry is PatientChangeHistoryEntry => entry !== null && entry.fieldLabel.trim().length > 0);
};

export const buildPatientChangeHistoryEntries = (
    existing: PatientRecord,
    incoming: PatientRecord,
    referenceDateIso: string
): PatientChangeHistoryEntry[] => {
    return PATIENT_CHANGE_FIELD_KEYS
        .filter((fieldKey) => existing[fieldKey] !== incoming[fieldKey])
        .map((fieldKey) => ({
            referenceDateIso: referenceDateIso.trim().length > 0 ? referenceDateIso : todayIso(),
            fieldKey,
            fieldLabel: PATIENT_CHANGE_FIELD_LABELS[fieldKey],
            previousValue: existing[fieldKey],
            nextValue: incoming[fieldKey]
        }));
};

export const mergePatientChangeHistory = (...histories: Array<PatientChangeHistoryEntry[] | undefined>): PatientChangeHistoryEntry[] => {
    const merged: PatientChangeHistoryEntry[] = [];
    const seen = new Set<string>();

    histories
        .filter((history): history is PatientChangeHistoryEntry[] => Array.isArray(history))
        .flat()
        .forEach((entry) => {
        const key = [entry.referenceDateIso, entry.fieldKey, entry.previousValue, entry.nextValue].join("|");
        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        merged.push(entry);
        });

    return merged;
};

export const formatPatientChangeSummary = (entry: PatientChangeHistoryEntry): string => {
    return `${entry.fieldLabel}: ${entry.previousValue} → ${entry.nextValue}`;
};