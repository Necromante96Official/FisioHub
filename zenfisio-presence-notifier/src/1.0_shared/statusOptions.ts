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
] as const;

export const ZENFISIO_TRIGGER_STATUS_LABELS = {
  confirmed: ["Presença confirmada"],
  cancelled: ["Não atendido (Sem cobrança)"]
} as const;

const KNOWN_STATUS_LABELS = new Set(ZENFISIO_STATUS_OPTIONS.map(option => normalizeText(option)));

export const isKnownZenfisioStatusLabel = (value: string): boolean => {
  return KNOWN_STATUS_LABELS.has(normalizeText(value));
};

export const isTriggerStatusLabel = (value: string): boolean => {
  const normalized = normalizeText(value);
  return (
    normalized === normalizeText(ZENFISIO_TRIGGER_STATUS_LABELS.confirmed[0]) ||
    normalized === normalizeText(ZENFISIO_TRIGGER_STATUS_LABELS.cancelled[0])
  );
};

export const containsTriggerStatusLabel = (value: string): boolean => {
  const normalized = normalizeText(value);
  const confirmed = normalizeText(ZENFISIO_TRIGGER_STATUS_LABELS.confirmed[0]);
  const cancelled = normalizeText(ZENFISIO_TRIGGER_STATUS_LABELS.cancelled[0]);

  return (
    normalized === confirmed ||
    normalized === cancelled ||
    normalized.includes(confirmed) ||
    normalized.includes(cancelled) ||
    confirmed.includes(normalized) ||
    cancelled.includes(normalized)
  );
};
