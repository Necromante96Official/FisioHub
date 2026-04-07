const PATIENT_CHANGE_FIELD_KEYS = [
    "nome",
    "statusFinanceiro",
    "horario",
    "fisioterapeuta",
    "celular",
    "convenio",
    "procedimentos"
];
const PATIENT_CHANGE_FIELD_LABELS = {
    nome: "Paciente",
    statusFinanceiro: "Status financeiro",
    horario: "Horário",
    fisioterapeuta: "Fisioterapeuta",
    celular: "Celular",
    convenio: "Convênio",
    procedimentos: "Procedimentos"
};
const normalizeText = (value) => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const toIsoDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};
const todayIso = () => toIsoDate(new Date());
const isPatientChangeFieldKey = (value) => {
    return typeof value === "string" && PATIENT_CHANGE_FIELD_KEYS.includes(value);
};
const safeChangeValue = (value) => {
    if (typeof value !== "string") {
        return "-";
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "-";
};
export const buildPatientRecordKey = (record) => {
    const normalizedName = normalizeText(record.nome);
    const normalizedPhone = record.celular.replace(/\D/g, "");
    return `${normalizedName}|${normalizedPhone}`;
};
export const parsePatientChangeHistory = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => {
        const candidate = item;
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
        .filter((entry) => entry !== null && entry.fieldLabel.trim().length > 0);
};
export const buildPatientChangeHistoryEntries = (existing, incoming, referenceDateIso) => {
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
export const mergePatientChangeHistory = (...histories) => {
    const merged = [];
    const seen = new Set();
    histories
        .filter((history) => Array.isArray(history))
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
export const formatPatientChangeSummary = (entry) => {
    return `${entry.fieldLabel}: ${entry.previousValue} → ${entry.nextValue}`;
};
//# sourceMappingURL=patient-history.js.map