export const normalizeText = (value) => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export const splitAppointmentBlocks = (lines) => {
    const blocks = [];
    let current = [];
    let hasAppointmentMarker = false;
    lines.forEach((line) => {
        if (/^---\s*agendamento\s+\d+/i.test(line)) {
            hasAppointmentMarker = true;
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
    if (!hasAppointmentMarker && blocks.length === 0) {
        const fallback = lines.map((line) => line.trim()).filter((line) => line.length > 0);
        if (fallback.length > 0) {
            blocks.push(fallback);
        }
    }
    return blocks;
};
export const parseFieldEntriesFromLine = (line) => {
    const pattern = /(hor[áa]rio|paciente|celular|conv[eê]nio|status|situa[cç][aã]o|procedimentos?|procedimento|fisioterapeuta|data(?:\s+de\s+atendimento)?|dia)\s*:\s*/gi;
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
export const extractIsoDate = (value) => {
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
export const sanitizeProcedimentosValue = (value) => value
    .replace(/\s*observa[cç][oõ]es\s*:[\s\S]*$/i, "")
    .trim();
export const classifyAttendanceStatus = (status) => {
    const normalized = normalizeText(status);
    if (!normalized) {
        return null;
    }
    if (normalized.includes("presenca confirmada")) {
        return "atendido";
    }
    if (normalized === "atendido" || (normalized.includes("atendido") && !normalized.includes("nao") && !normalized.includes("presenca"))) {
        return "atendido";
    }
    if (normalized.includes("faltou") || normalized.includes("nao atendido")) {
        return "falta";
    }
    return null;
};
//# sourceMappingURL=appointment-parser.js.map