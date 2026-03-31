import { ThemeManager } from "../4.1_Core/theme-manager.js";
import { FISIOHUB_STORAGE_KEYS } from "../4.0_Shared/fisiohub-models.js";
import { bindHoverToasts as sharedBindHoverToasts, bindTermsDialog, showSiteNotification as sharedShowSiteNotification, startFloatingHomeHint as sharedStartFloatingHomeHint, syncFooterMetadata } from "../4.0_Shared/ui-feedback.js";
export class AgendamentosController {
    appId = "app";
    pageTemplate = "1.0_HTML-Templates/1.1_Pages/agendamentos.html";
    processedDataStorageKey = FISIOHUB_STORAGE_KEYS.PROCESSED_DATA;
    processedMetaStorageKey = FISIOHUB_STORAGE_KEYS.PROCESSED_META;
    evolucoesPendingHistoryStorageKey = FISIOHUB_STORAGE_KEYS.EVOLUCOES_PENDING_HISTORY;
    legacyImportedDataStorageKey = FISIOHUB_STORAGE_KEYS.LEGACY_IMPORTED_DATA;
    theme = new ThemeManager();
    allRecords = [];
    visibleGroups = [];
    selectedGroupKey = null;
    activeSearch = "";
    activeSort = "attended-desc";
    activeModalTab = "atendidos";
    async bootstrap() {
        this.theme.init();
        await this.loadPage();
        await this.resolveIncludes();
        await syncFooterMetadata();
        bindTermsDialog({
            dialogId: "termsDialog",
            triggerButtonId: "footerTermsBtn",
            closeButtonId: "closeTermsDialogBtn"
        });
        this.bindHandlers();
        sharedBindHoverToasts({ scope: document });
        this.render();
        sharedStartFloatingHomeHint();
        window.addEventListener("storage", (event) => {
            if (event.key && !event.key.startsWith("fisiohub-")) {
                return;
            }
            this.render();
        });
        if (this.allRecords.length === 0) {
            sharedShowSiteNotification("Nenhum agendamento encontrado. Processe os dados na pagina inicial.");
        }
    }
    async loadPage() {
        const app = document.getElementById(this.appId);
        if (!app)
            return;
        const html = await fetch(this.pageTemplate).then((response) => response.text());
        app.innerHTML = html;
    }
    async resolveIncludes() {
        let nodes = Array.from(document.querySelectorAll("[data-include]"));
        while (nodes.length > 0) {
            for (const node of nodes) {
                const path = node.getAttribute("data-include");
                if (!path)
                    continue;
                const html = await fetch(path).then((response) => response.text());
                node.outerHTML = html;
            }
            nodes = Array.from(document.querySelectorAll("[data-include]"));
        }
    }
    bindHandlers() {
        const modules = Array.from(document.querySelectorAll(".fh-module-card"));
        modules.forEach((link) => {
            link.addEventListener("click", () => {
                const target = link.getAttribute("data-target");
                if (!target)
                    return;
                window.location.href = target;
            });
        });
        const searchInput = document.getElementById("agendamentosSearchInput");
        searchInput?.addEventListener("input", () => {
            this.activeSearch = this.normalizeKey(searchInput.value);
            this.render();
        });
        const sortSelect = document.getElementById("agendamentosSortSelect");
        sortSelect?.addEventListener("change", () => {
            const value = sortSelect.value;
            if (value === "name-asc" || value === "name-desc" || value === "attended-desc" || value === "absences-desc") {
                this.activeSort = value;
                this.render();
            }
        });
        const tableBody = document.getElementById("agendamentosTableBody");
        tableBody?.addEventListener("click", (event) => {
            const target = event.target;
            const button = target.closest("button[data-patient-details]");
            if (!button)
                return;
            const patientKey = button.dataset.patientDetails;
            if (!patientKey)
                return;
            this.openDetails(patientKey);
        });
        const dialog = this.getDetailsDialog();
        const closeButton = document.getElementById("agendamentosModalCloseBtn");
        closeButton?.addEventListener("click", () => {
            if (dialog.open) {
                dialog.close();
            }
        });
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) {
                dialog.close();
            }
        });
        dialog.addEventListener("close", () => {
            this.selectedGroupKey = null;
        });
        const modalTabs = Array.from(document.querySelectorAll("[data-modal-tab]"));
        modalTabs.forEach((button) => {
            button.addEventListener("click", () => {
                const tab = button.dataset.modalTab;
                if (tab === "atendidos" || tab === "faltas") {
                    this.activeModalTab = tab;
                    this.render();
                }
            });
        });
    }
    render() {
        this.allRecords = this.parseAgendamentosFromStorage();
        this.visibleGroups = this.getVisibleGroups(this.allRecords);
        const totalAtendimentos = this.visibleGroups.reduce((total, group) => total + group.totalAtendimentos, 0);
        const totalFaltas = this.visibleGroups.reduce((total, group) => total + group.totalFaltas, 0);
        const totalAgendamentos = totalAtendimentos + totalFaltas;
        this.setText("agendamentosAttendedCount", String(totalAtendimentos));
        this.setText("agendamentosAbsencesCount", String(totalFaltas));
        this.setText("agendamentosTotalCount", String(totalAgendamentos));
        const uniquePatients = new Set(this.visibleGroups.map((group) => group.nomeNormalizado));
        this.setText("agendamentosPatientsCount", String(uniquePatients.size));
        this.renderTable(this.visibleGroups);
        this.renderSelectedModal();
    }
    renderTable(groups) {
        const tableBody = document.getElementById("agendamentosTableBody");
        if (!tableBody)
            return;
        tableBody.innerHTML = "";
        if (groups.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 4;
            cell.className = "fh-agendamentos-empty";
            cell.textContent = "Nenhum agendamento encontrado para o filtro atual.";
            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }
        groups.forEach((group) => {
            const row = document.createElement("tr");
            const nameCell = document.createElement("td");
            nameCell.textContent = group.nome;
            const attendedCell = document.createElement("td");
            attendedCell.innerHTML = `<span class="fh-agendamentos-pill fh-pill-attended">${group.totalAtendimentos}</span>`;
            const absencesCell = document.createElement("td");
            absencesCell.innerHTML = `<span class="fh-agendamentos-pill fh-pill-absences">${group.totalFaltas}</span>`;
            const actionCell = document.createElement("td");
            const detailsButton = document.createElement("button");
            detailsButton.type = "button";
            detailsButton.className = "fh-agendamentos-details-btn";
            detailsButton.dataset.patientDetails = group.nomeNormalizado;
            detailsButton.textContent = "Ver mais...";
            actionCell.appendChild(detailsButton);
            row.appendChild(nameCell);
            row.appendChild(attendedCell);
            row.appendChild(absencesCell);
            row.appendChild(actionCell);
            tableBody.appendChild(row);
        });
    }
    renderSelectedModal() {
        const dialog = this.getDetailsDialog();
        const allGroups = this.groupsFromAllRecords();
        const selectedGroup = this.selectedGroupKey
            ? this.visibleGroups.find((group) => group.nomeNormalizado === this.selectedGroupKey) ?? allGroups.find((group) => group.nomeNormalizado === this.selectedGroupKey) ?? null
            : null;
        if (!selectedGroup) {
            if (dialog.open) {
                dialog.close();
            }
            return;
        }
        this.setText("agendamentosModalTitle", selectedGroup.nome);
        this.setText("agendamentosModalAttendedTotal", String(selectedGroup.totalAtendimentos));
        this.setText("agendamentosModalAbsenceTotal", String(selectedGroup.totalFaltas));
        this.setText("agendamentosModalFrequency", `${selectedGroup.frequencia.toFixed(1)}%`);
        this.updateModalTabs();
        this.renderModalList("agendamentosModalAttendedList", this.sortRecordsByDateDesc(selectedGroup.atendidos), "Nenhum atendimento registrado.");
        this.renderModalList("agendamentosModalAbsenceList", this.sortRecordsByDateDesc(selectedGroup.faltas), "Nenhuma falta registrada.");
        if (!dialog.open) {
            dialog.showModal();
        }
    }
    renderModalList(elementId, records, emptyMessage) {
        const list = document.getElementById(elementId);
        if (!list)
            return;
        if (records.length === 0) {
            list.innerHTML = `<div class="fh-agendamentos-empty-state">${this.escapeHtml(emptyMessage)}</div>`;
            return;
        }
        list.innerHTML = records.map((record) => `
            <article class="fh-agendamentos-history-item fh-history-${record.statusCategoria}">
                <div class="fh-agendamentos-history-main">
                    <strong>${this.escapeHtml(record.dataLabel)}</strong>
                    <span>${this.escapeHtml(record.horario)}</span>
                </div>
                <p>${this.escapeHtml(record.procedimento)}</p>
                <small>${this.escapeHtml(record.statusLabel)}</small>
            </article>
        `).join("");
    }
    updateModalTabs() {
        const buttons = Array.from(document.querySelectorAll("[data-modal-tab]"));
        buttons.forEach((button) => {
            const tab = button.dataset.modalTab;
            const isActive = tab === this.activeModalTab;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        const attendedPanel = document.getElementById("agendamentosModalAttendedPanel");
        const absencesPanel = document.getElementById("agendamentosModalAbsencePanel");
        if (attendedPanel) {
            attendedPanel.classList.toggle("is-active", this.activeModalTab === "atendidos");
        }
        if (absencesPanel) {
            absencesPanel.classList.toggle("is-active", this.activeModalTab === "faltas");
        }
    }
    openDetails(patientKey) {
        this.selectedGroupKey = patientKey;
        this.activeModalTab = "atendidos";
        this.render();
    }
    parseAgendamentosFromStorage() {
        const fromHistory = this.parseRecordsFromHistory(localStorage.getItem(this.evolucoesPendingHistoryStorageKey));
        if (fromHistory.length > 0) {
            return this.deduplicateRecords(fromHistory);
        }
        const processedRaw = localStorage.getItem(this.processedDataStorageKey) ?? "";
        const processedMeta = this.parseProcessedMeta(localStorage.getItem(this.processedMetaStorageKey));
        if (processedRaw.trim()) {
            return this.deduplicateRecords(this.parseRecordsFromLines(this.parseRawLines(processedRaw), processedMeta?.referenceDateIso ?? this.todayIso(), 0));
        }
        const legacyRaw = localStorage.getItem(this.legacyImportedDataStorageKey) ?? "";
        if (legacyRaw.trim()) {
            return this.deduplicateRecords(this.parseRecordsFromLines(this.parseRawLines(legacyRaw), this.todayIso(), 0));
        }
        return [];
    }
    parseRecordsFromHistory(raw) {
        if (!raw)
            return [];
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed))
                return [];
            const records = [];
            parsed.forEach((item, batchIndex) => {
                const candidate = item;
                if (!Array.isArray(candidate.lines))
                    return;
                const referenceDateIso = this.safeIsoDate(candidate.referenceDateIso ?? this.todayIso());
                records.push(...this.parseRecordsFromLines(candidate.lines, referenceDateIso, batchIndex));
            });
            return records;
        }
        catch {
            return [];
        }
    }
    parseProcessedMeta(raw) {
        if (!raw)
            return null;
        try {
            const parsed = JSON.parse(raw);
            if (typeof parsed.referenceDateIso !== "string")
                return null;
            return {
                processedAtIso: typeof parsed.processedAtIso === "string" ? parsed.processedAtIso : new Date().toISOString(),
                referenceDateIso: parsed.referenceDateIso,
                totalImportedLines: typeof parsed.totalImportedLines === "number" ? parsed.totalImportedLines : 0,
                totalPatients: typeof parsed.totalPatients === "number" ? parsed.totalPatients : 0,
                totalForReferenceDate: typeof parsed.totalForReferenceDate === "number" ? parsed.totalForReferenceDate : 0
            };
        }
        catch {
            return null;
        }
    }
    parseRawLines(raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item));
            }
        }
        catch {
            // Mantém o fallback por linhas.
        }
        return raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    }
    parseRecordsFromLines(lines, referenceDateIso, batchIndex) {
        const blocks = this.splitImportedLinesByAppointment(lines);
        const records = [];
        blocks.forEach((block, blockIndex) => {
            const draft = this.createEmptyDraft(referenceDateIso);
            block.forEach((line) => {
                const entries = this.parseFieldEntriesFromLine(line);
                entries.forEach(([label, rawValue]) => {
                    const key = this.normalizeKey(label);
                    const value = rawValue.trim();
                    if (key === "paciente")
                        draft.nome = value;
                    if (key === "horario" || key === "horário")
                        draft.horario = value;
                    if (key === "procedimento" || key === "procedimentos")
                        draft.procedimento = this.sanitizeText(value);
                    if (key === "status" || key === "situacao")
                        draft.statusOriginal = this.sanitizeText(value);
                    if (key === "data" || key === "data de atendimento" || key === "dia") {
                        draft.dataIso = this.extractIsoDate(value) ?? draft.dataIso;
                        draft.dataLabel = this.formatDateLabel(draft.dataIso);
                    }
                });
            });
            const statusInfo = this.classifyStatus(draft.statusOriginal);
            if (!draft.nome || !statusInfo) {
                return;
            }
            const dataIso = this.safeIsoDate(draft.dataIso);
            const dataLabel = this.formatDateLabel(dataIso);
            const horario = draft.horario || "-";
            const procedimento = draft.procedimento || "-";
            const statusLabel = statusInfo === "atendido"
                ? this.isPresenceConfirmed(draft.statusOriginal)
                    ? "Presença confirmada"
                    : "Atendido"
                : this.isNoShow(draft.statusOriginal)
                    ? "Não atendido"
                    : "Faltou";
            const nomeNormalizado = this.normalizeKey(draft.nome);
            const searchIndex = this.normalizeKey([
                draft.nome,
                dataLabel,
                horario,
                procedimento,
                statusLabel,
                draft.statusOriginal
            ].join(" "));
            records.push({
                nome: draft.nome,
                nomeNormalizado,
                dataIso,
                dataLabel,
                horario,
                procedimento,
                statusOriginal: draft.statusOriginal,
                statusLabel,
                statusCategoria: statusInfo,
                searchIndex,
                batchIndex,
                blockIndex
            });
        });
        return records;
    }
    getVisibleGroups(records) {
        const groups = this.groupRecordsByPatient(records);
        const filtered = this.activeSearch.trim().length === 0
            ? groups
            : groups.filter((group) => this.matchesSearch(group, this.activeSearch));
        return this.sortGroups(filtered);
    }
    groupRecordsByPatient(records) {
        const groups = new Map();
        records.forEach((record) => {
            const bucket = groups.get(record.nomeNormalizado) ?? [];
            bucket.push(record);
            groups.set(record.nomeNormalizado, bucket);
        });
        return Array.from(groups.entries()).map(([nomeNormalizado, groupRecords]) => {
            const orderedRecords = this.sortRecordsByDateDesc(groupRecords);
            const firstRecord = orderedRecords[0];
            const atendidos = orderedRecords.filter((record) => record.statusCategoria === "atendido");
            const faltas = orderedRecords.filter((record) => record.statusCategoria === "falta");
            const totalAtendimentos = atendidos.length;
            const totalFaltas = faltas.length;
            const total = totalAtendimentos + totalFaltas;
            const frequencia = total > 0 ? (totalAtendimentos / total) * 100 : 0;
            return {
                nome: firstRecord?.nome ?? nomeNormalizado,
                nomeNormalizado,
                records: orderedRecords,
                atendidos,
                faltas,
                totalAtendimentos,
                totalFaltas,
                total,
                frequencia
            };
        });
    }
    sortGroups(groups) {
        const ordered = [...groups];
        switch (this.activeSort) {
            case "name-desc":
                ordered.sort((a, b) => b.nome.localeCompare(a.nome, "pt-BR"));
                break;
            case "attended-desc":
                ordered.sort((a, b) => b.totalAtendimentos - a.totalAtendimentos || a.nome.localeCompare(b.nome, "pt-BR"));
                break;
            case "absences-desc":
                ordered.sort((a, b) => b.totalFaltas - a.totalFaltas || a.nome.localeCompare(b.nome, "pt-BR"));
                break;
            case "name-asc":
            default:
                ordered.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
                break;
        }
        return ordered;
    }
    sortRecordsByDateDesc(records) {
        return [...records].sort((a, b) => {
            if (a.dataIso !== b.dataIso) {
                return b.dataIso.localeCompare(a.dataIso);
            }
            return b.horario.localeCompare(a.horario);
        });
    }
    matchesSearch(group, query) {
        const normalizedQuery = this.normalizeKey(query);
        if (!normalizedQuery)
            return true;
        if (group.nomeNormalizado.includes(normalizedQuery)) {
            return true;
        }
        return group.records.some((record) => record.searchIndex.includes(normalizedQuery));
    }
    splitImportedLinesByAppointment(lines) {
        const blocks = [];
        let current = [];
        let hasAppointmentMarker = false;
        lines.forEach((line) => {
            if (/^---\s*agendamento\s+\d+/i.test(line)) {
                hasAppointmentMarker = true;
                if (current.length > 0) {
                    blocks.push(current);
                }
                current = [line];
                return;
            }
            if (hasAppointmentMarker) {
                current.push(line);
            }
        });
        if (hasAppointmentMarker && current.length > 0) {
            blocks.push(current);
        }
        if (!hasAppointmentMarker) {
            const fallback = lines.map((line) => line.trim()).filter((line) => line.length > 0);
            if (fallback.length > 0) {
                blocks.push(fallback);
            }
        }
        return blocks;
    }
    parseFieldEntriesFromLine(line) {
        const pattern = /(hor[áa]rio|paciente|celular|conv[eê]nio|status|situa[cç][aã]o|procedimentos?|fisioterapeuta|data(?:\s+de\s+atendimento)?|dia)\s*:\s*/gi;
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
    }
    normalizeKey(value) {
        return value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }
    sanitizeText(value) {
        return value.replace(/\s*observa[cç][oõ]es\s*:[\s\S]*$/i, "").trim();
    }
    classifyStatus(status) {
        if (!status.trim())
            return null;
        if (this.isPresenceConfirmed(status) || this.isAttended(status)) {
            return "atendido";
        }
        if (this.isNoShow(status) || this.isAbsent(status)) {
            return "falta";
        }
        return null;
    }
    isPresenceConfirmed(status) {
        return this.normalizeKey(status).includes("presenca confirmada");
    }
    isAttended(status) {
        const normalized = this.normalizeKey(status);
        return normalized === "atendido" || (normalized.includes("atendido") && !normalized.includes("nao") && !normalized.includes("presenca"));
    }
    isNoShow(status) {
        const normalized = this.normalizeKey(status);
        return normalized.includes("faltou");
    }
    isAbsent(status) {
        return this.normalizeKey(status).includes("nao atendido");
    }
    extractIsoDate(value) {
        const isoMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
        }
        const brMatch = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (brMatch) {
            return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
        }
        return null;
    }
    safeIsoDate(value) {
        const iso = this.extractIsoDate(value);
        if (iso) {
            return iso;
        }
        return this.todayIso();
    }
    formatDateLabel(isoDate) {
        const date = new Date(`${isoDate}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return isoDate;
        }
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }
    deduplicateRecords(records) {
        const unique = new Map();
        records.forEach((record) => {
            const key = [
                record.nomeNormalizado,
                record.dataIso,
                record.horario,
                record.statusCategoria,
                this.normalizeKey(record.procedimento)
            ].join("|");
            if (!unique.has(key)) {
                unique.set(key, record);
            }
        });
        return Array.from(unique.values());
    }
    createEmptyDraft(referenceDateIso) {
        return {
            nome: "",
            dataIso: this.safeIsoDate(referenceDateIso),
            dataLabel: this.formatDateLabel(this.safeIsoDate(referenceDateIso)),
            horario: "-",
            procedimento: "-",
            statusOriginal: ""
        };
    }
    getLatestReferenceLabel() {
        const latest = [...this.allRecords].sort((a, b) => b.dataIso.localeCompare(a.dataIso))[0];
        if (!latest) {
            return "Sem dados processados";
        }
        return `Base mais recente: ${latest.dataLabel}`;
    }
    groupsFromAllRecords() {
        return this.sortGroups(this.groupRecordsByPatient(this.allRecords));
    }
    getDetailsDialog() {
        return document.getElementById("agendamentosDetailsDialog");
    }
    setText(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
    todayIso() {
        return new Date().toISOString().slice(0, 10);
    }
    escapeHtml(value) {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
}
//# sourceMappingURL=agendamentos-controller.js.map