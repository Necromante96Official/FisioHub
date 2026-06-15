import { normalizeText } from "./text.js";
export const ZENFISIO_STATUS_OPTIONS = [
    "Agendado",
    "Atenção",
    "Atendido",
    "Cancelado",
    "Faltou",
    "Faltou (com aviso prévio)",
    "Faltou (sem aviso prévio)",
    "Não atendido",
    "Não atendido (Sem cobrança)",
    "Pré-cadastro",
    "Presença confirmada",
    "Remarcar"
];
export const ZENFISIO_TRIGGER_STATUS_LABELS = {
    confirmed: ["Presença confirmada"],
    cancelled: ["Não atendido (Sem cobrança)"],
    missed: ["Faltou (com aviso prévio)", "Faltou (sem aviso prévio)"]
};
const KNOWN_STATUS_LABELS = new Set(ZENFISIO_STATUS_OPTIONS.map(option => normalizeText(option)));
export const isKnownZenfisioStatusLabel = (value) => {
    return KNOWN_STATUS_LABELS.has(normalizeText(value));
};
export const isTriggerStatusLabel = (value) => {
    const normalized = normalizeText(value);
    return Object.values(ZENFISIO_TRIGGER_STATUS_LABELS)
        .flat()
        .some(label => normalized === normalizeText(label));
};
export const containsTriggerStatusLabel = (value) => {
    const normalized = normalizeText(value);
    return Object.values(ZENFISIO_TRIGGER_STATUS_LABELS)
        .flat()
        .map(label => normalizeText(label))
        .some(label => normalized === label || normalized.includes(label) || label.includes(normalized));
};
