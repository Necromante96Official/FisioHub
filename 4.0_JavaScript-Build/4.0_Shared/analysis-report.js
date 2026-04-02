import { FISIOHUB_STORAGE_KEYS } from "./fisiohub-models.js";
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const todayIso = () => new Date().toISOString().slice(0, 10);
const normalizeText = (value) => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const escapeHtml = (value) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
const formatDateLabel = (isoDate) => {
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
        return isoDate;
    }
    return dateFormatter.format(date);
};
const formatCurrency = (value) => currencyFormatter.format(value);
const safeIsoDate = (value) => {
    const extracted = extractIsoDate(value);
    return extracted ?? todayIso();
};
const extractIsoDate = (value) => {
    const isoMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    const brMatch = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) {
        return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }
    return null;
};
const parseLines = (raw) => {
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item));
        }
    }
    catch {
        // Fallback para texto por linhas.
    }
    return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
};
const readProcessedMeta = () => {
    const raw = localStorage.getItem(FISIOHUB_STORAGE_KEYS.PROCESSED_META);
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.referenceDateIso !== "string") {
            return null;
        }
        return {
            processedAtIso: typeof parsed.processedAtIso === "string" ? parsed.processedAtIso : new Date().toISOString(),
            referenceDateIso: safeIsoDate(parsed.referenceDateIso),
            totalImportedLines: typeof parsed.totalImportedLines === "number" ? parsed.totalImportedLines : 0,
            totalPatients: typeof parsed.totalPatients === "number" ? parsed.totalPatients : 0,
            totalForReferenceDate: typeof parsed.totalForReferenceDate === "number" ? parsed.totalForReferenceDate : 0
        };
    }
    catch {
        return null;
    }
};
const readDoneSignatures = () => {
    const raw = localStorage.getItem(FISIOHUB_STORAGE_KEYS.DONE_EVOLUTIONS);
    if (!raw) {
        return new Set();
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return new Set();
        }
        return new Set(parsed
            .filter((item) => typeof item === "string")
            .map((item) => item.trim())
            .filter((item) => item.length > 0));
    }
    catch {
        return new Set();
    }
};
const readEvolucoesPendingHistory = () => {
    const raw = localStorage.getItem(FISIOHUB_STORAGE_KEYS.EVOLUCOES_PENDING_HISTORY);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .map((entry) => {
            const candidate = entry;
            const lines = Array.isArray(candidate.lines)
                ? candidate.lines.filter((line) => typeof line === "string" && line.trim().length > 0)
                : [];
            return {
                processedAtIso: typeof candidate.processedAtIso === "string" ? candidate.processedAtIso : new Date().toISOString(),
                referenceDateIso: typeof candidate.referenceDateIso === "string" ? safeIsoDate(candidate.referenceDateIso) : todayIso(),
                lines
            };
        })
            .filter((entry) => entry.lines.length > 0);
    }
    catch {
        return [];
    }
};
const splitAppointmentBlocks = (lines) => {
    const blocks = [];
    let current = [];
    lines.forEach((line) => {
        if (/^---\s*agendamento\s+\d+/i.test(line)) {
            if (current.length > 0) {
                blocks.push(current);
            }
            current = [];
            return;
        }
        current.push(line);
    });
    if (current.length > 0) {
        blocks.push(current);
    }
    return blocks;
};
const parseFieldEntriesFromLine = (line) => {
    const pattern = /(hor[áa]rio|paciente|celular|conv[eê]nio|status|situa[cç][aã]o|procedimentos?|procedimento|data(?:\s+de\s+atendimento)?|dia)\s*:\s*/gi;
    const matches = Array.from(line.matchAll(pattern));
    if (matches.length === 0) {
        const fallback = line.match(/^([^:]+):\s*(.*)$/);
        return fallback ? [[fallback[1], fallback[2].trim()]] : [];
    }
    const entries = [];
    for (let index = 0; index < matches.length; index += 1) {
        const current = matches[index];
        const next = matches[index + 1];
        const valueStart = (current.index ?? 0) + current[0].length;
        const valueEnd = next?.index ?? line.length;
        const rawValue = line.slice(valueStart, valueEnd).trim().replace(/[\s,;|]+$/, "");
        entries.push([current[1], rawValue]);
    }
    return entries;
};
const parsePatientsRecords = () => {
    const raw = localStorage.getItem(FISIOHUB_STORAGE_KEYS.PATIENTS_RECORDS);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .map((item) => {
            const candidate = item;
            const status = candidate.statusFinanceiro === "Isento" ? "Isento" : "Pagante";
            return {
                nome: typeof candidate.nome === "string" ? candidate.nome : "",
                statusFinanceiro: status,
                horario: typeof candidate.horario === "string" ? candidate.horario : "-",
                fisioterapeuta: typeof candidate.fisioterapeuta === "string" ? candidate.fisioterapeuta : "-",
                celular: typeof candidate.celular === "string" ? candidate.celular : "-",
                convenio: typeof candidate.convenio === "string" ? candidate.convenio : "-",
                procedimentos: typeof candidate.procedimentos === "string" ? candidate.procedimentos : "-",
                createdAtIso: typeof candidate.createdAtIso === "string" ? candidate.createdAtIso : new Date().toISOString(),
                updatedAtIso: typeof candidate.updatedAtIso === "string" ? candidate.updatedAtIso : new Date().toISOString()
            };
        })
            .filter((record) => record.nome.trim().length > 0);
    }
    catch {
        return [];
    }
};
const sanitizeProcedimentosValue = (value) => value.replace(/\s*observa[cç][oõ]es\s*:[\s\S]*$/i, "").trim();
const normalizeFinanceStatus = (value, convenio, fallbackStatus, proceduresRaw) => {
    const merged = `${value} ${convenio} ${fallbackStatus} ${proceduresRaw}`;
    return /isento/i.test(merged) ? "Isento" : "Pagante";
};
const splitProcedures = (value) => value
    .split(/\n|\s*;\s*|\s*\|\s*|\s*,\s*/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => !isNoiseProcedureToken(part));
const isNoiseProcedureToken = (value) => {
    const normalized = normalizeText(value);
    return /^(?:isento|pagante|nao|não|sem procedimento)$/.test(normalized)
        || /^\d+$/.test(normalized)
        || /^(?:1|2|3)x(?:\s*\/\s*semana|\s*por\s*semana)?$/.test(normalized)
        || /^(?:1|2|3)\s*vez(?:es)?\s*por\s*semana$/.test(normalized)
        || /^(?:1|2|3)x$/.test(normalized);
};
const extractFrequency = (value) => {
    const normalized = normalizeText(value);
    if (/3\s*x/.test(normalized) || /3x/.test(normalized))
        return 3;
    if (/2\s*x/.test(normalized) || /2x/.test(normalized))
        return 2;
    return 1;
};
const removeFrequencySuffix = (value) => value
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
const normalizeSpecialtyLabel = (value) => removeFrequencySuffix(value)
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[-–]\s*$/g, "")
    .trim();
const getProcedurePrice = (frequency) => {
    if (frequency === 2)
        return 20;
    if (frequency === 3)
        return 15;
    return 25;
};
const parseProcedureEntries = (value) => {
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
const makeAttendanceKey = (input) => {
    return [
        input.referenceDateIso,
        normalizeText(input.patientName),
        normalizeText(input.horario),
        input.dateIso,
        normalizeText(input.proceduresRaw),
        String(input.blockIndex)
    ].join("|");
};
const readFinanceAttendanceRecords = () => {
    const records = new Map();
    const patientRecords = parsePatientsRecords();
    const patientLookup = new Map(patientRecords.map((record) => [normalizeText(record.nome), record]));
    const processedRaw = (localStorage.getItem(FISIOHUB_STORAGE_KEYS.PROCESSED_DATA) ?? "").trim();
    const batches = [];
    if (processedRaw.length > 0) {
        batches.push({
            referenceDateIso: readProcessedMeta()?.referenceDateIso ?? todayIso(),
            lines: parseLines(processedRaw)
        });
    }
    readEvolucoesPendingHistory().forEach((batch) => {
        batches.push({
            referenceDateIso: safeIsoDate(batch.referenceDateIso),
            lines: batch.lines
        });
    });
    batches.forEach((batch) => {
        splitAppointmentBlocks(batch.lines).forEach((block, blockIndex) => {
            const entryMap = new Map();
            block.forEach((line) => {
                parseFieldEntriesFromLine(line).forEach(([label, rawValue]) => {
                    entryMap.set(normalizeText(label), rawValue.trim());
                });
            });
            const patientName = entryMap.get("paciente") ?? "";
            if (!patientName.trim()) {
                return;
            }
            const convenio = entryMap.get("convenio") ?? "";
            const horario = entryMap.get("horario") ?? "-";
            const proceduresRaw = sanitizeProcedimentosValue(entryMap.get("procedimentos") ?? entryMap.get("procedimento") ?? "");
            const dateIso = batch.referenceDateIso;
            const procedureEntries = parseProcedureEntries(proceduresRaw);
            const status = normalizeFinanceStatus(entryMap.get("status") ?? entryMap.get("situacao") ?? "", convenio, "Pagante", proceduresRaw);
            const normalizedStatus = normalizeFinanceStatus(status, convenio, status, proceduresRaw);
            const value = normalizedStatus === "Isento" ? 0 : procedureEntries.reduce((sum, entry) => sum + entry.value, 0);
            const normalizedPatientName = normalizeText(patientName);
            const id = makeAttendanceKey({
                referenceDateIso: batch.referenceDateIso,
                patientName,
                horario,
                dateIso,
                proceduresRaw,
                blockIndex
            });
            records.set(id, {
                patientName: patientName.trim(),
                normalizedPatientName,
                status: normalizedStatus,
                horario: horario.trim() || "-",
                dateIso,
                proceduresRaw,
                value
            });
        });
    });
    records.forEach((record, key) => {
        const patient = patientLookup.get(record.normalizedPatientName);
        if (!patient) {
            return;
        }
        const updatedStatus = normalizeFinanceStatus(record.status, patient.convenio, patient.statusFinanceiro, record.proceduresRaw);
        records.set(key, {
            ...record,
            status: updatedStatus
        });
    });
    if (records.size === 0 && patientRecords.length > 0) {
        patientRecords.forEach((record) => {
            const fallback = buildAttendanceFromPatientRecord(record);
            if (!records.has(fallback.id)) {
                records.set(fallback.id, fallback.attendance);
            }
        });
    }
    return Array.from(records.values());
};
const buildAttendanceFromPatientRecord = (record) => {
    const dateIso = (record.updatedAtIso || record.createdAtIso || new Date().toISOString()).slice(0, 10);
    const proceduresRaw = sanitizeProcedimentosValue(record.procedimentos);
    const procedureEntries = parseProcedureEntries(proceduresRaw);
    const status = normalizeFinanceStatus(record.statusFinanceiro, record.convenio, record.statusFinanceiro, proceduresRaw);
    const value = status === "Isento" ? 0 : procedureEntries.reduce((sum, entry) => sum + entry.value, 0);
    return {
        id: makeAttendanceKey({
            referenceDateIso: dateIso,
            patientName: record.nome,
            horario: record.horario,
            dateIso,
            proceduresRaw,
            blockIndex: 0
        }),
        attendance: {
            patientName: record.nome.trim(),
            normalizedPatientName: normalizeText(record.nome),
            status,
            horario: record.horario.trim() || "-",
            dateIso,
            proceduresRaw,
            value
        }
    };
};
const groupFinancePatients = (records) => {
    const groups = new Map();
    records.forEach((record) => {
        const existing = groups.get(record.normalizedPatientName);
        if (!existing) {
            groups.set(record.normalizedPatientName, {
                patientName: record.patientName,
                normalizedPatientName: record.normalizedPatientName,
                status: record.status,
                totalValue: record.value
            });
            return;
        }
        existing.totalValue += record.value;
        existing.status = existing.status === "Pagante" || record.status === "Pagante" ? "Pagante" : "Isento";
    });
    return Array.from(groups.values());
};
const readAgendamentosRecords = () => {
    const batches = readEvolucoesPendingHistory();
    const records = [];
    if (batches.length === 0) {
        const processedRaw = localStorage.getItem(FISIOHUB_STORAGE_KEYS.PROCESSED_DATA) ?? "";
        if (!processedRaw.trim()) {
            const legacyRaw = localStorage.getItem(FISIOHUB_STORAGE_KEYS.LEGACY_IMPORTED_DATA) ?? "";
            if (!legacyRaw.trim()) {
                return [];
            }
            const fallbackMeta = readProcessedMeta();
            batches.push({
                processedAtIso: fallbackMeta?.processedAtIso ?? new Date().toISOString(),
                referenceDateIso: fallbackMeta?.referenceDateIso ?? todayIso(),
                lines: parseLines(legacyRaw)
            });
        }
        else {
            const processedMeta = readProcessedMeta();
            batches.push({
                processedAtIso: processedMeta?.processedAtIso ?? new Date().toISOString(),
                referenceDateIso: processedMeta?.referenceDateIso ?? todayIso(),
                lines: parseLines(processedRaw)
            });
        }
    }
    batches.forEach((batch) => {
        splitAppointmentBlocks(batch.lines).forEach((block) => {
            const entryMap = new Map();
            block.forEach((line) => {
                parseFieldEntriesFromLine(line).forEach(([label, rawValue]) => {
                    entryMap.set(normalizeText(label), rawValue.trim());
                });
            });
            const patientName = entryMap.get("paciente") ?? "";
            const statusRaw = entryMap.get("status") ?? entryMap.get("situacao") ?? "";
            const statusCategoria = classifyStatus(statusRaw);
            if (!patientName.trim() || !statusCategoria) {
                return;
            }
            const dataIso = safeIsoDate(entryMap.get("data") ?? entryMap.get("dia") ?? batch.referenceDateIso);
            const horario = entryMap.get("horario") ?? "-";
            const procedimento = sanitizeText(entryMap.get("procedimentos") ?? entryMap.get("procedimento") ?? "-");
            records.push({
                nome: patientName.trim(),
                nomeNormalizado: normalizeText(patientName),
                dataIso,
                horario: horario.trim() || "-",
                procedimento,
                statusCategoria
            });
        });
    });
    return deduplicateAgendamentos(records);
};
const sanitizeText = (value) => value.replace(/\s*observa[cç][oõ]es\s*:[\s\S]*$/i, "").trim();
const deduplicateAgendamentos = (records) => {
    const unique = new Map();
    records.forEach((record) => {
        const key = [record.nomeNormalizado, record.dataIso, record.horario, record.statusCategoria, normalizeText(record.procedimento)].join("|");
        if (!unique.has(key)) {
            unique.set(key, record);
        }
    });
    return Array.from(unique.values());
};
const groupAgendamentosByPatient = (records) => {
    const groups = new Map();
    records.forEach((record) => {
        const existing = groups.get(record.nomeNormalizado);
        if (!existing) {
            groups.set(record.nomeNormalizado, {
                nome: record.nome,
                nomeNormalizado: record.nomeNormalizado,
                records: [record],
                totalAtendimentos: record.statusCategoria === "atendido" ? 1 : 0,
                totalFaltas: record.statusCategoria === "falta" ? 1 : 0
            });
            return;
        }
        existing.records.push(record);
        existing.totalAtendimentos += record.statusCategoria === "atendido" ? 1 : 0;
        existing.totalFaltas += record.statusCategoria === "falta" ? 1 : 0;
    });
    return Array.from(groups.values());
};
const parsePendingBatch = (lines, referenceDateIso) => {
    const normalizedLines = lines.map((line) => line.trim()).filter((line) => line.length > 0);
    const results = [];
    let draft = createEmptyPendingDraft(referenceDateIso);
    const pushDraft = () => {
        const normalized = normalizePendingDraft(draft);
        draft = createEmptyPendingDraft(referenceDateIso);
        if (!normalized) {
            return;
        }
        results.push(normalized);
    };
    normalizedLines.forEach((line) => {
        if (/^---\s*agendamento\s+\d+/i.test(line)) {
            pushDraft();
            return;
        }
        const entryMatch = line.match(/^([^:]+):\s*(.+)$/);
        if (!entryMatch) {
            return;
        }
        const key = normalizeText(entryMatch[1]).replace(/\s+/g, "");
        const value = entryMatch[2].trim();
        if (key === "paciente" || key === "nome")
            draft.nome = value;
        if (key === "horario")
            draft.horario = value || "-";
        if (key === "procedimentos" || key === "procedimento")
            draft.procedimento = value;
        if (key === "status" || key === "situacao")
            draft.status = value;
        if (key === "data") {
            const extracted = extractIsoDate(value);
            if (extracted) {
                draft.dataIso = extracted;
            }
        }
    });
    pushDraft();
    return results;
};
const createEmptyPendingDraft = (referenceDateIso) => ({
    nome: "",
    dataIso: safeIsoDate(referenceDateIso),
    horario: "-",
    procedimento: "-",
    status: "",
    assinatura: "",
    nomeNormalizado: ""
});
const normalizePendingDraft = (draft) => {
    const nome = draft.nome.replace(/\s+/g, " ").trim();
    if (!nome) {
        return null;
    }
    const statusNormalizado = normalizeStatus(draft.status);
    if (statusNormalizado !== "presenca confirmada") {
        return null;
    }
    const dataIso = safeIsoDate(draft.dataIso);
    const horario = draft.horario.replace(/\s+/g, " ").trim() || "-";
    const procedimento = normalizeProcedure(draft.procedimento);
    const assinatura = `${normalizeText(nome)}|${dataIso}|${normalizeText(horario)}|${normalizeText(procedimento)}`;
    return {
        nome,
        nomeNormalizado: normalizeText(nome),
        assinatura
    };
};
const normalizeStatus = (value) => {
    const normalized = normalizeText(value);
    if (normalized.includes("presenca confirmada"))
        return "presenca confirmada";
    if (normalized.includes("nao atendido"))
        return "nao atendido";
    if (normalized.includes("faltou"))
        return "faltou";
    if (normalized === "atendido" || (normalized.includes("atendido") && !normalized.includes("nao") && !normalized.includes("presenca"))) {
        return "atendido";
    }
    return normalized;
};
const normalizeProcedure = (value) => {
    const clean = value.replace(/\s*observa[cç][oõ]es\s*:[\s\S]*$/i, "").replace(/\s+/g, " ").trim();
    return clean || "-";
};
const classifyStatus = (status) => {
    const normalized = normalizeText(status);
    if (!normalized) {
        return null;
    }
    if (normalized.includes("atendido") || normalized.includes("presenca confirmada")) {
        return "atendido";
    }
    if (normalized.includes("faltou") || normalized.includes("nao atendido")) {
        return "falta";
    }
    return null;
};
const buildHighlights = (pendingRecords, financeGroups, scheduleGroups) => {
    const highlights = [];
    if (pendingRecords.length > 0) {
        const topPatient = groupPendingByName(pendingRecords).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }))[0];
        if (topPatient) {
            highlights.push(`${topPatient.name} concentra ${topPatient.count} evolução(ões) pendente(s).`);
        }
    }
    else {
        highlights.push("Não há evoluções pendentes registradas no momento.");
    }
    if (financeGroups.length > 0) {
        const revenueLeader = financeGroups.slice().sort((left, right) => right.totalValue - left.totalValue || left.patientName.localeCompare(right.patientName, "pt-BR", { sensitivity: "base" }))[0];
        if (revenueLeader) {
            highlights.push(`${revenueLeader.patientName} representa o maior valor consolidado no Financeiro.`);
        }
    }
    if (scheduleGroups.length > 0) {
        const punctualLeader = scheduleGroups.slice().sort((left, right) => right.totalAtendimentos - left.totalAtendimentos || left.nome.localeCompare(right.nome, "pt-BR", { sensitivity: "base" }))[0];
        if (punctualLeader) {
            highlights.push(`${punctualLeader.nome} lidera os atendimentos registrados em Agendamentos.`);
        }
    }
    return highlights.slice(0, 3);
};
const groupPendingByName = (records) => {
    const counts = new Map();
    records.forEach((record) => {
        const current = counts.get(record.nomeNormalizado);
        if (!current) {
            counts.set(record.nomeNormalizado, { name: record.nome, count: 1 });
            return;
        }
        current.count += 1;
    });
    return Array.from(counts.values());
};
export const buildAnalysisReportData = () => {
    const pendingRecords = readPendingRecords();
    const financeAttendanceRecords = readFinanceAttendanceRecords();
    const financeGroups = groupFinancePatients(financeAttendanceRecords);
    const scheduleRecords = readAgendamentosRecords();
    const scheduleGroups = groupAgendamentosByPatient(scheduleRecords);
    const processedMeta = readProcessedMeta();
    const referenceDateIso = processedMeta?.referenceDateIso ?? scheduleRecords[0]?.dataIso ?? financeAttendanceRecords[0]?.dateIso ?? todayIso();
    const financePagantes = financeGroups.filter((group) => group.status === "Pagante").length;
    const financeIsentos = financeGroups.filter((group) => group.status === "Isento").length;
    const financeRevenue = financeGroups.reduce((sum, group) => sum + group.totalValue, 0);
    const scheduleAttended = scheduleGroups.reduce((sum, group) => sum + group.totalAtendimentos, 0);
    const scheduleAbsences = scheduleGroups.reduce((sum, group) => sum + group.totalFaltas, 0);
    const scheduleTotal = scheduleAttended + scheduleAbsences;
    return {
        generatedAtIso: new Date().toISOString(),
        referenceDateIso,
        referenceDateLabel: formatDateLabel(referenceDateIso),
        pendingPatients: new Set(pendingRecords.map((record) => record.nomeNormalizado)).size,
        pendingEvolutions: pendingRecords.length,
        financePatients: financeGroups.length,
        financePagantes,
        financeIsentos,
        financeRevenue,
        schedulePatients: new Set(scheduleGroups.map((group) => group.nomeNormalizado)).size,
        scheduleAttended,
        scheduleAbsences,
        scheduleTotal,
        highlights: buildHighlights(pendingRecords, financeGroups, scheduleGroups)
    };
};
const readPendingRecords = () => {
    const doneSignatures = readDoneSignatures();
    const batches = readEvolucoesPendingHistory();
    if (batches.length === 0) {
        const processedRaw = localStorage.getItem(FISIOHUB_STORAGE_KEYS.PROCESSED_DATA) ?? "";
        if (!processedRaw.trim()) {
            return [];
        }
        const processedMeta = readProcessedMeta();
        batches.push({
            processedAtIso: processedMeta?.processedAtIso ?? new Date().toISOString(),
            referenceDateIso: processedMeta?.referenceDateIso ?? todayIso(),
            lines: parseLines(processedRaw)
        });
    }
    const records = [];
    batches.forEach((batch, batchIndex) => {
        const parsed = parsePendingBatch(batch.lines, batch.referenceDateIso);
        parsed.forEach((record, recordIndex) => {
            const signature = `${batch.processedAtIso}|${batchIndex}|${recordIndex}|${record.assinatura}`;
            if (doneSignatures.has(signature)) {
                return;
            }
            records.push({
                nome: record.nome,
                nomeNormalizado: record.nomeNormalizado,
                assinatura: signature
            });
        });
    });
    return records;
};
export const buildAnalysisReportText = (data) => {
    const generatedDate = new Date(data.generatedAtIso);
    const generatedTime = generatedDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const lines = [
        "ANÁLISE FISIOHUB",
        `Gerado em: ${formatDateLabel(generatedDate.toISOString().slice(0, 10))} ${generatedTime}`,
        `Base de referência: ${data.referenceDateLabel}`,
        "",
        "EVOLUÇÕES PENDENTES",
        `Pacientes pendentes: ${data.pendingPatients}`,
        `Evoluções pendentes: ${data.pendingEvolutions}`,
        "",
        "FINANCEIRO",
        `Pacientes pagantes: ${data.financePagantes}`,
        `Pacientes isentos: ${data.financeIsentos}`,
        `Total de pacientes financeiros: ${data.financePatients}`,
        `Receita total: ${formatCurrency(data.financeRevenue)}`,
        "",
        "AGENDAMENTOS",
        `Pacientes com registros: ${data.schedulePatients}`,
        `Atendidos: ${data.scheduleAttended}`,
        `Faltas: ${data.scheduleAbsences}`,
        `Total: ${data.scheduleTotal}`,
        "",
        "INSIGHTS",
        ...data.highlights.map((item) => `- ${item}`),
        "",
        "Relatório consolidado gerado localmente pelo FisioHub."
    ];
    return lines.join("\n");
};
export const renderAnalysisReportMarkup = (data) => {
    const insightsMarkup = data.highlights.length > 0
        ? data.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
        : `<li>Sem observações adicionais no momento.</li>`;
    return `
        <section class="fh-analysis-report-shell">
            <header class="fh-analysis-hero">
                <div class="fh-analysis-hero-copy">
                    <p class="fh-analysis-kicker">Relatório consolidado</p>
                    <h3>Visão executiva da operação</h3>
                    <p>Consolidação local de Evoluções Pendentes, Financeiro e Agendamentos, com foco em leitura rápida e impressão profissional.</p>
                </div>
                <div class="fh-analysis-hero-meta">
                    <div>
                        <span>Gerado em</span>
                        <strong>${escapeHtml(formatDateLabel(data.generatedAtIso.slice(0, 10)))} ${escapeHtml(new Date(data.generatedAtIso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))}</strong>
                    </div>
                    <div>
                        <span>Base de referência</span>
                        <strong>${escapeHtml(data.referenceDateLabel)}</strong>
                    </div>
                </div>
            </header>

            <div class="fh-analysis-hero-grid">
                <article class="fh-analysis-metric-card fh-analysis-metric-card--primary">
                    <span class="fh-analysis-metric-label">Evoluções pendentes</span>
                    <strong>${data.pendingEvolutions}</strong>
                    <small>${data.pendingPatients} paciente${data.pendingPatients === 1 ? "" : "s"} aguardando evolução.</small>
                </article>

                <article class="fh-analysis-metric-card">
                    <span class="fh-analysis-metric-label">Financeiro</span>
                    <strong>${data.financePatients}</strong>
                    <small>${data.financePagantes} pagante${data.financePagantes === 1 ? "" : "s"} e ${data.financeIsentos} isento${data.financeIsentos === 1 ? "" : "s"}.</small>
                </article>

                <article class="fh-analysis-metric-card fh-analysis-metric-card--accent">
                    <span class="fh-analysis-metric-label">Receita total</span>
                    <strong>${escapeHtml(formatCurrency(data.financeRevenue))}</strong>
                    <small>Valor consolidado pela operação financeira.</small>
                </article>

                <article class="fh-analysis-metric-card">
                    <span class="fh-analysis-metric-label">Agendamentos</span>
                    <strong>${data.scheduleTotal}</strong>
                    <small>${data.scheduleAttended} atendidos e ${data.scheduleAbsences} faltas.</small>
                </article>
            </div>

            <div class="fh-analysis-module-grid">
                <section class="fh-analysis-module-card">
                    <div class="fh-analysis-module-head">
                        <h4>Evoluções Pendentes</h4>
                        <span>${data.pendingPatients} paciente${data.pendingPatients === 1 ? "" : "s"}</span>
                    </div>
                    <ul class="fh-analysis-module-list">
                        <li><strong>Total de pendências:</strong> ${data.pendingEvolutions}</li>
                        <li><strong>Pacientes distintos:</strong> ${data.pendingPatients}</li>
                        <li><strong>Leitura:</strong> itens ainda não concluídos na fila operacional.</li>
                    </ul>
                </section>

                <section class="fh-analysis-module-card">
                    <div class="fh-analysis-module-head">
                        <h4>Financeiro</h4>
                        <span>${escapeHtml(formatCurrency(data.financeRevenue))}</span>
                    </div>
                    <ul class="fh-analysis-module-list">
                        <li><strong>Pagantes:</strong> ${data.financePagantes}</li>
                        <li><strong>Isentos:</strong> ${data.financeIsentos}</li>
                        <li><strong>Pacientes acompanhados:</strong> ${data.financePatients}</li>
                        <li><strong>Receita total:</strong> ${escapeHtml(formatCurrency(data.financeRevenue))}</li>
                    </ul>
                </section>

                <section class="fh-analysis-module-card">
                    <div class="fh-analysis-module-head">
                        <h4>Agendamentos</h4>
                        <span>${data.scheduleAttended} atendidos</span>
                    </div>
                    <ul class="fh-analysis-module-list">
                        <li><strong>Atendidos:</strong> ${data.scheduleAttended}</li>
                        <li><strong>Faltas:</strong> ${data.scheduleAbsences}</li>
                        <li><strong>Total:</strong> ${data.scheduleTotal}</li>
                        <li><strong>Pacientes distintos:</strong> ${data.schedulePatients}</li>
                    </ul>
                </section>
            </div>

            <section class="fh-analysis-insight-card">
                <div class="fh-analysis-module-head">
                    <h4>Leitura executiva</h4>
                    <span>Resumo automático</span>
                </div>
                <ul class="fh-analysis-insight-list">
                    ${insightsMarkup}
                </ul>
            </section>
        </section>
    `;
};
//# sourceMappingURL=analysis-report.js.map