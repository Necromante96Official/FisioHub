import { normalizeText, stripUnsafeTrailing } from "./text.js";

const INVALID_FULL_PHRASES = new Set([
  "paciente",
  "pacientes",
  "paciente cadastrado",
  "paciente cadastado",
  "cadastro de paciente",
  "status",
  "agendamento",
  "agendamentos",
  "presenca confirmada",
  "nao atendido",
  "nao atendido sem cobranca"
]);

const INVALID_SINGLE_WORDS = new Set([
  "paciente",
  "pacientes",
  "status",
  "confirmado",
  "confirmada",
  "presenca",
  "desmarcacao",
  "agenda",
  "zenfisio"
]);

const LABEL_STOP_WORDS = [
  "celular",
  "convenio",
  "status",
  "procedimento",
  "fisioterapeuta",
  "horario"
];

export const patientKeyFromName = (name: string): string => normalizeText(name);

export const sanitizePatientName = (rawName: string): string | null => {
  if (!rawName) {
    return null;
  }

  let text = rawName
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  text = text
    .replace(/^paciente\s*[:\-]?\s*/i, "")
    .replace(/^nome\s*[:\-]?\s*/i, "")
    .trim();

  const lower = normalizeText(text);
  for (const stopWord of LABEL_STOP_WORDS) {
    const index = lower.indexOf(stopWord);
    if (index > 0) {
      text = text.slice(0, index).trim();
      break;
    }
  }

  text = stripUnsafeTrailing(text);
  text = text.replace(/\s+/g, " ").trim();

  if (!text) {
    return null;
  }

  return text;
};

export const isLikelyValidPatientName = (name: string | null): name is string => {
  if (!name) {
    return false;
  }

  const normalized = normalizeText(name);
  if (!normalized) {
    return false;
  }

  if (normalized.length < 5 || normalized.length > 100) {
    return false;
  }

  if (INVALID_FULL_PHRASES.has(normalized)) {
    return false;
  }

  if (/\d/.test(name)) {
    return false;
  }

  if (!/^[A-Za-z\s.'-]+$/.test(name)) {
    return false;
  }

  const words = normalized.split(" ").filter(Boolean);
  if (words.length < 2) {
    return false;
  }

  if (words.length > 6) {
    return false;
  }

  for (const word of words) {
    if (word.length < 2) {
      return false;
    }
    if (INVALID_SINGLE_WORDS.has(word)) {
      return false;
    }
  }

  return true;
};

export const extractPatientNameFromText = (text: string): string | null => {
  if (!text) {
    return null;
  }

  const byLabel = text.match(/paciente\s*[:\-]\s*([^\n\r]+)/i);
  if (byLabel?.[1]) {
    const candidate = sanitizePatientName(byLabel[1]);
    if (isLikelyValidPatientName(candidate)) {
      return candidate;
    }
  }

  return null;
};
