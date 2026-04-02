import { ThemeManager } from "../4.1_Core/theme-manager.js";
import { FISIOHUB_STORAGE_KEYS } from "../4.0_Shared/fisiohub-models.js";
import { bindAnalysisDialog, bindHoverToasts as sharedBindHoverToasts, bindTermsDialog, showSiteNotification as sharedShowSiteNotification, startFloatingHomeHint as sharedStartFloatingHomeHint, syncFooterMetadata } from "../4.0_Shared/ui-feedback.js";
export class FinanceiroController {
    appId = "app";
    pageTemplate = "1.0_HTML-Templates/1.1_Pages/financeiro.html";
    processedDataStorageKey = FISIOHUB_STORAGE_KEYS.PROCESSED_DATA;
    processedMetaStorageKey = FISIOHUB_STORAGE_KEYS.PROCESSED_META;
    patientsRecordsStorageKey = FISIOHUB_STORAGE_KEYS.PATIENTS_RECORDS;
    evolucoesPendingHistoryStorageKey = FISIOHUB_STORAGE_KEYS.EVOLUCOES_PENDING_HISTORY;
    theme = new ThemeManager();
    activeSearch = "";
    activeTab = "pacientes";
    activeSpecialtyModalFrequency = 1;
    activeSpecialtyStatusFilter = "all";
    attendanceRecords = [];
    visibleAttendanceRecords = [];
    patientGroups = [];
    specialtyGroups = [];
    selectedPatientKey = null;
    selectedSpecialtyKey = null;
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
        bindAnalysisDialog({
            dialogId: "analysisDialog",
            triggerButtonId: "footerAnalysisBtn",
            closeButtonId: "closeAnalysisDialogBtn",
            printButtonId: "analysisPrintBtn",
            textButtonId: "analysisTextBtn"
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
        if (this.attendanceRecords.length === 0) {
            sharedShowSiteNotification("Nenhum dado financeiro encontrado. Processe os dados na pagina inicial.");
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
        const searchInput = document.getElementById("financeiroSearchInput");
        searchInput?.addEventListener("input", () => {
            this.activeSearch = this.normalizeText(searchInput.value);
            this.render();
        });
        const tabButtons = Array.from(document.querySelectorAll("[data-finance-tab]"));
        tabButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const tab = button.dataset.financeTab;
                if (tab === "pacientes" || tab === "especialidades") {
                    this.activeTab = tab;
                    this.render();
                }
            });
        });
        const patientListIds = ["financeiroIsentosList", "financeiroPagantesList"];
        patientListIds.forEach((listId) => {
            const list = document.getElementById(listId);
            list?.addEventListener("click", (event) => {
                const target = event.target;
                const button = target.closest("button[data-patient-key]");
                if (!button)
                    return;
                const key = button.dataset.patientKey;
                if (!key)
                    return;
                this.openPatientDialog(key);
            });
        });
        const specialtiesBody = document.getElementById("financeiroSpecialtiesTableBody");
        specialtiesBody?.addEventListener("click", (event) => {
            const target = event.target;
            const button = target.closest("button[data-specialty-key]");
            if (!button)
                return;
            const key = button.dataset.specialtyKey;
            if (!key)
                return;
            this.openSpecialtyDialog(key);
        });
        const patientDialog = this.getPatientDialog();
        const patientClose = document.getElementById("financeiroPatientDialogCloseBtn");
        patientClose?.addEventListener("click", () => {
            if (patientDialog.open) {
                patientDialog.close();
            }
        });
        patientDialog.addEventListener("click", (event) => {
            if (event.target === patientDialog) {
                patientDialog.close();
            }
        });
        patientDialog.addEventListener("close", () => {
            this.selectedPatientKey = null;
        });
        const specialtyDialog = this.getSpecialtyDialog();
        const specialtyClose = document.getElementById("financeiroSpecialtyDialogCloseBtn");
        specialtyClose?.addEventListener("click", () => {
            if (specialtyDialog.open) {
                specialtyDialog.close();
            }
        });
        specialtyDialog.addEventListener("click", (event) => {
            if (event.target === specialtyDialog) {
                specialtyDialog.close();
            }
        });
        specialtyDialog.addEventListener("close", () => {
            this.selectedSpecialtyKey = null;
        });
        const specialtyTabs = Array.from(document.querySelectorAll("[data-specialty-modal-frequency]"));
        specialtyTabs.forEach((button) => {
            button.addEventListener("click", () => {
                const raw = Number(button.dataset.specialtyModalFrequency);
                if (raw === 1 || raw === 2 || raw === 3) {
                    this.activeSpecialtyModalFrequency = raw;
                    this.renderSpecialtyDialog();
                }
            });
        });
        const specialtyStatusFilter = document.getElementById("financeiroSpecialtyStatusFilter");
        specialtyStatusFilter?.addEventListener("change", () => {
            const value = specialtyStatusFilter.value;
            if (value === "all" || value === "pagante" || value === "isento") {
                this.activeSpecialtyStatusFilter = value;
                this.renderSpecialtyDialog();
            }
        });
    }
    render() {
        this.attendanceRecords = this.loadAttendanceRecordsFromStorage();
        this.visibleAttendanceRecords = this.filterAttendances(this.attendanceRecords);
        this.patientGroups = this.groupPatients(this.visibleAttendanceRecords);
        this.specialtyGroups = this.groupSpecialties(this.visibleAttendanceRecords);
        const totalPagantes = this.patientGroups.filter((group) => group.status === "Pagante").length;
        const totalIsentos = this.patientGroups.filter((group) => group.status === "Isento").length;
        const totalRevenue = this.patientGroups.reduce((sum, group) => sum + group.totalValue, 0);
        this.setText("financeiroPagantesCount", String(totalPagantes));
        this.setText("financeiroIsentosCount", String(totalIsentos));
        this.setText("financeiroReceitaTotal", this.formatCurrency(totalRevenue));
        this.setText("financeiroPagantesColumnCount", String(totalPagantes));
        this.setText("financeiroIsentosColumnCount", String(totalIsentos));
        this.renderTabState();
        this.renderPatientColumns();
        this.renderSpecialtyTable();
        if (this.selectedPatientKey) {
            this.renderPatientDialog();
        }
        if (this.selectedSpecialtyKey) {
            this.renderSpecialtyDialog();
        }
    }
    renderTabState() {
        const tabButtons = Array.from(document.querySelectorAll("[data-finance-tab]"));
        tabButtons.forEach((button) => {
            const isActive = button.dataset.financeTab === this.activeTab;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        const panels = Array.from(document.querySelectorAll("[data-finance-panel]"));
        panels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.dataset.financePanel === this.activeTab);
        });
    }
    renderPatientColumns() {
        const isentos = this.patientGroups.filter((group) => group.status === "Isento");
        const pagantes = this.patientGroups.filter((group) => group.status === "Pagante");
        this.renderPatientList("financeiroIsentosList", isentos, "isento");
        this.renderPatientList("financeiroPagantesList", pagantes, "pagante");
    }
    renderPatientList(containerId, groups, kind) {
        const container = document.getElementById(containerId);
        if (!container)
            return;
        if (groups.length === 0) {
            container.innerHTML = kind === "isento"
                ? '<div class="fh-financeiro-empty-state">Nenhum paciente isento encontrado.</div>'
                : '<div class="fh-financeiro-empty-state">Nenhum paciente pagante encontrado.</div>';
            return;
        }
        container.innerHTML = groups.map((group) => {
            const rightValue = kind === "pagante"
                ? `<span class="fh-financeiro-patient-value">${this.formatCurrency(group.totalValue)}</span>`
                : `<span class="fh-financeiro-patient-value">${group.totalAttendances} atendimento${group.totalAttendances === 1 ? "" : "s"}</span>`;
            const conveniosLabel = group.convenios.length > 0 ? group.convenios.join(", ") : "Sem convênio";
            return `
                <button type="button" class="fh-financeiro-patient-item" data-patient-key="${this.escapeHtml(group.key)}">
                    <div>
                        <p class="fh-financeiro-patient-name">${this.escapeHtml(group.patientName)}</p>
                        <div class="fh-financeiro-patient-meta">
                            <span class="fh-financeiro-pill ${group.status === "Pagante" ? "fh-pill-pagante" : "fh-pill-isento"}">${group.status}</span>
                            <span class="fh-financeiro-pill fh-pill-frequency">${group.totalAttendances} atendimento${group.totalAttendances === 1 ? "" : "s"}</span>
                            <span class="fh-financeiro-entry-date">${this.escapeHtml(conveniosLabel)}</span>
                        </div>
                    </div>
                    ${rightValue}
                </button>
            `;
        }).join("");
    }
    renderSpecialtyTable() {
        const container = document.getElementById("financeiroSpecialtiesTableBody");
        if (!container)
            return;
        if (this.specialtyGroups.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" class="fh-financeiro-empty-table">Nenhuma especialidade encontrada.</td>
                </tr>
            `;
            return;
        }
        container.innerHTML = this.specialtyGroups.map((group) => `
            <tr class="fh-financeiro-specialty-row">
                <td>${this.escapeHtml(group.baseName)}</td>
                <td>${group.totalOccurrences}</td>
                <td>${group.totalPagantes}</td>
                <td>${group.totalIsentos}</td>
                <td>${group.totalPatients}</td>
                <td><button type="button" class="fh-financeiro-specialty-btn" data-specialty-key="${this.escapeHtml(group.key)}">Ver mais...</button></td>
            </tr>
        `).join("");
    }
    openPatientDialog(patientKey) {
        this.selectedPatientKey = patientKey;
        this.renderPatientDialog();
        const dialog = this.getPatientDialog();
        if (!dialog.open) {
            dialog.showModal();
        }
    }
    renderPatientDialog() {
        const group = this.patientGroups.find((item) => item.key === this.selectedPatientKey);
        if (!group)
            return;
        this.setText("financeiroPatientDialogTitle", group.patientName);
        this.setText("financeiroPatientDialogAttendances", String(group.totalAttendances));
        this.setText("financeiroPatientDialogValue", this.formatCurrency(group.totalValue));
        this.setText("financeiroPatientDialogConvenios", String(group.convenios.length));
        const container = document.getElementById("financeiroPatientHistoryList");
        if (!container)
            return;
        if (group.attendances.length === 0) {
            container.innerHTML = '<div class="fh-financeiro-empty-state">Nenhum atendimento encontrado.</div>';
            return;
        }
        const orderedAttendances = [...group.attendances].sort((left, right) => {
            const dateComparison = right.dateIso.localeCompare(left.dateIso);
            if (dateComparison !== 0)
                return dateComparison;
            return right.horario.localeCompare(left.horario, "pt-BR", { sensitivity: "base" });
        });
        container.innerHTML = orderedAttendances.map((attendance) => `
            <article class="fh-financeiro-modal-entry">
                <div class="fh-financeiro-entry-line">
                    <div>
                        <div class="fh-financeiro-entry-title">${this.escapeHtml(attendance.dateLabel)}</div>
                        <div class="fh-financeiro-entry-subtitle">${this.escapeHtml(attendance.horario === "-" ? "Horário não informado" : attendance.horario)}</div>
                    </div>
                    <div class="fh-financeiro-entry-value">${attendance.status === "Pagante" ? this.formatCurrency(attendance.value) : "Isento"}</div>
                </div>
                <div class="fh-financeiro-entry-meta">
                    <span class="fh-financeiro-pill ${attendance.status === "Pagante" ? "fh-pill-pagante" : "fh-pill-isento"}">${attendance.status}</span>
                    <span class="fh-financeiro-pill fh-pill-frequency">${this.escapeHtml(attendance.convenio || "Sem convênio")}</span>
                </div>
                <div class="fh-financeiro-entry-date">${this.escapeHtml(this.describeAttendanceProcedures(attendance))}</div>
            </article>
        `).join("");
    }
    openSpecialtyDialog(specialtyKey) {
        this.selectedSpecialtyKey = specialtyKey;
        this.activeSpecialtyModalFrequency = 1;
        this.activeSpecialtyStatusFilter = "all";
        const statusFilter = document.getElementById("financeiroSpecialtyStatusFilter");
        if (statusFilter) {
            statusFilter.value = "all";
        }
        this.renderSpecialtyDialog();
        const dialog = this.getSpecialtyDialog();
        if (!dialog.open) {
            dialog.showModal();
        }
    }
    renderSpecialtyDialog() {
        const group = this.specialtyGroups.find((item) => item.key === this.selectedSpecialtyKey);
        if (!group)
            return;
        this.setText("financeiroSpecialtyDialogTitle", group.baseName);
        this.setText("financeiroSpecialtyDialogAttendances", String(group.totalOccurrences));
        this.setText("financeiroSpecialtyDialogPatients", String(group.totalPatients));
        this.setText("financeiroSpecialtyDialogValue", this.formatCurrency(group.totalValue));
        this.setText("financeiroSpecialtyDialogConvenios", String(group.convenios.length));
        const modalTabs = Array.from(document.querySelectorAll("[data-specialty-modal-frequency]"));
        modalTabs.forEach((button) => {
            const frequency = Number(button.dataset.specialtyModalFrequency);
            const isActive = frequency === this.activeSpecialtyModalFrequency;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        const modalPanels = Array.from(document.querySelectorAll("[data-specialty-modal-panel]"));
        modalPanels.forEach((panel) => {
            const frequency = Number(panel.dataset.specialtyModalPanel);
            panel.classList.toggle("is-active", frequency === this.activeSpecialtyModalFrequency);
        });
        [1, 2, 3].forEach((frequency) => this.renderSpecialtyFrequencyPanel(group, frequency));
    }
    renderSpecialtyFrequencyPanel(group, frequency) {
        const container = document.getElementById(`financeiroSpecialtyPanel${frequency}`);
        if (!container)
            return;
        const frequencyGroup = group.byFrequency[frequency];
        const summaries = frequencyGroup.patientSummaries.filter((summary) => {
            if (this.activeSpecialtyStatusFilter === "all")
                return true;
            return summary.status.toLowerCase() === this.activeSpecialtyStatusFilter;
        });
        if (summaries.length === 0) {
            container.innerHTML = '<div class="fh-financeiro-empty-state">Nenhum paciente encontrado nesta frequência.</div>';
            return;
        }
        container.innerHTML = summaries.map((summary) => `
            <article class="fh-financeiro-modal-entry">
                <div class="fh-financeiro-entry-line">
                    <div>
                        <div class="fh-financeiro-entry-title">${this.escapeHtml(summary.patientName)}</div>
                        <div class="fh-financeiro-entry-subtitle">${summary.totalOccurrences} ocorrência${summary.totalOccurrences === 1 ? "" : "s"} nesta frequência</div>
                    </div>
                    <div class="fh-financeiro-entry-value">${summary.status === "Pagante" ? this.formatCurrency(summary.totalValue) : "Isento"}</div>
                </div>
                <div class="fh-financeiro-entry-meta">
                    <span class="fh-financeiro-pill ${summary.status === "Pagante" ? "fh-pill-pagante" : "fh-pill-isento"}">${summary.status}</span>
                    <span class="fh-financeiro-pill fh-pill-frequency">${frequency}x por semana</span>
                </div>
            </article>
        `).join("");
    }
    loadAttendanceRecordsFromStorage() {
        const batches = this.readStoredBatches();
        const patientRecords = this.parsePatientsRecords(localStorage.getItem(this.patientsRecordsStorageKey));
        const patientLookup = new Map(patientRecords.map((record) => [this.normalizeText(record.nome), record]));
        const records = new Map();
        batches.forEach((batch) => {
            this.parseAttendanceBatch(batch).forEach((record) => {
                if (!records.has(record.id)) {
                    records.set(record.id, record);
                }
            });
        });
        if (records.size === 0 && patientRecords.length > 0) {
            patientRecords.forEach((record) => {
                const fallback = this.buildAttendanceFromPatientRecord(record);
                if (!records.has(fallback.id)) {
                    records.set(fallback.id, fallback);
                }
            });
        }
        records.forEach((record, key) => {
            const patient = patientLookup.get(record.normalizedPatientName);
            if (!patient)
                return;
            const updatedStatus = this.normalizeFinanceStatus(record.status, patient.convenio, patient.statusFinanceiro, record.proceduresRaw);
            const updatedConvenio = this.isMissingValue(record.convenio) ? patient.convenio : record.convenio;
            records.set(key, {
                ...record,
                convenio: updatedConvenio,
                status: updatedStatus,
                searchIndex: this.buildSearchIndex({
                    patientName: record.patientName,
                    convenio: updatedConvenio,
                    proceduresRaw: record.proceduresRaw,
                    status: updatedStatus,
                    dateLabel: record.dateLabel,
                    horario: record.horario
                })
            });
        });
        return Array.from(records.values()).sort((left, right) => {
            const dateComparison = right.dateIso.localeCompare(left.dateIso);
            if (dateComparison !== 0)
                return dateComparison;
            const timeComparison = right.horario.localeCompare(left.horario, "pt-BR", { sensitivity: "base" });
            if (timeComparison !== 0)
                return timeComparison;
            return left.patientName.localeCompare(right.patientName, "pt-BR", { sensitivity: "base" });
        });
    }
    readStoredBatches() {
        const batches = [];
        const processedData = (localStorage.getItem(this.processedDataStorageKey) ?? "").trim();
        const processedMeta = this.parseProcessedMeta(localStorage.getItem(this.processedMetaStorageKey));
        if (processedData.length > 0) {
            batches.push({
                referenceDateIso: processedMeta.referenceDateIso,
                lines: this.parseLines(processedData),
                sourceLabel: "processamento atual"
            });
        }
        this.readEvolucoesPendingHistory().forEach((batch, index) => {
            batches.push({
                referenceDateIso: batch.referenceDateIso,
                lines: batch.lines,
                sourceLabel: `histórico ${index + 1}`
            });
        });
        return batches;
    }
    parseAttendanceBatch(batch) {
        const blocks = this.splitAppointmentBlocks(batch.lines);
        const records = [];
        blocks.forEach((block, blockIndex) => {
            const entryMap = new Map();
            const rawCombined = block.join(" ");
            block.forEach((line) => {
                this.parseFieldEntriesFromLine(line).forEach(([label, rawValue]) => {
                    entryMap.set(this.normalizeText(label), rawValue.trim());
                });
            });
            const patientName = entryMap.get("paciente") ?? "";
            if (!patientName.trim())
                return;
            const convenio = entryMap.get("convenio") ?? "";
            const horario = entryMap.get("horario") ?? "-";
            const proceduresRaw = this.sanitizeProcedimentosValue(entryMap.get("procedimentos") ?? entryMap.get("procedimento") ?? "");
            const dateIso = batch.referenceDateIso;
            const procedureEntries = this.parseProcedureEntries(proceduresRaw);
            const status = this.normalizeFinanceStatus(entryMap.get("status") ?? entryMap.get("situacao") ?? "", convenio, "Pagante", proceduresRaw);
            const normalizedStatus = this.normalizeFinanceStatus(status, convenio, status, proceduresRaw);
            const value = normalizedStatus === "Isento" ? 0 : procedureEntries.reduce((sum, entry) => sum + entry.value, 0);
            const normalizedPatientName = this.normalizeText(patientName);
            records.push({
                id: this.makeAttendanceKey({
                    referenceDateIso: batch.referenceDateIso,
                    patientName,
                    horario,
                    dateIso,
                    proceduresRaw,
                    blockIndex
                }),
                sourceLabel: batch.sourceLabel,
                patientName: patientName.trim(),
                normalizedPatientName,
                convenio: convenio.trim() || "-",
                status: normalizedStatus,
                horario: horario.trim() || "-",
                dateIso,
                dateLabel: this.formatDateLabel(dateIso),
                proceduresRaw,
                procedureEntries,
                value,
                searchIndex: this.buildSearchIndex({
                    patientName,
                    convenio,
                    proceduresRaw,
                    status: normalizedStatus,
                    dateLabel: this.formatDateLabel(dateIso),
                    horario
                }),
                batchReferenceDateIso: batch.referenceDateIso
            });
        });
        return records;
    }
    buildAttendanceFromPatientRecord(record) {
        const dateIso = (record.updatedAtIso || record.createdAtIso || new Date().toISOString()).slice(0, 10);
        const proceduresRaw = this.sanitizeProcedimentosValue(record.procedimentos);
        const procedureEntries = this.parseProcedureEntries(proceduresRaw);
        const status = this.normalizeFinanceStatus(record.statusFinanceiro, record.convenio, record.statusFinanceiro, proceduresRaw);
        const value = status === "Isento" ? 0 : procedureEntries.reduce((sum, entry) => sum + entry.value, 0);
        return {
            id: this.makeAttendanceKey({
                referenceDateIso: dateIso,
                patientName: record.nome,
                horario: record.horario,
                dateIso,
                proceduresRaw,
                blockIndex: 0
            }),
            sourceLabel: "cadastro",
            patientName: record.nome.trim(),
            normalizedPatientName: this.normalizeText(record.nome),
            convenio: record.convenio.trim() || "-",
            status,
            horario: record.horario.trim() || "-",
            dateIso,
            dateLabel: this.formatDateLabel(dateIso),
            proceduresRaw,
            procedureEntries,
            value,
            searchIndex: this.buildSearchIndex({
                patientName: record.nome,
                convenio: record.convenio,
                proceduresRaw,
                status,
                dateLabel: this.formatDateLabel(dateIso),
                horario: record.horario
            }),
            batchReferenceDateIso: dateIso
        };
    }
    filterAttendances(records) {
        const query = this.activeSearch.trim();
        if (!query)
            return records;
        return records.filter((record) => record.searchIndex.includes(query));
    }
    groupPatients(records) {
        const groups = new Map();
        records.forEach((record) => {
            const existing = groups.get(record.normalizedPatientName);
            if (!existing) {
                groups.set(record.normalizedPatientName, {
                    key: record.normalizedPatientName,
                    patientName: record.patientName,
                    normalizedPatientName: record.normalizedPatientName,
                    status: record.status,
                    attendances: [record],
                    totalAttendances: 1,
                    totalValue: record.value,
                    convenios: this.uniqueValues([record.convenio]),
                    procedures: this.uniqueValues(this.extractProcedureBaseNames(record)),
                    lastDateIso: record.dateIso,
                    searchIndex: this.buildSearchIndex({
                        patientName: record.patientName,
                        convenio: record.convenio,
                        proceduresRaw: record.proceduresRaw,
                        status: record.status,
                        dateLabel: record.dateLabel,
                        horario: record.horario
                    })
                });
                return;
            }
            existing.attendances.push(record);
            existing.totalAttendances += 1;
            existing.totalValue += record.value;
            existing.convenios = this.uniqueValues([...existing.convenios, record.convenio]);
            existing.procedures = this.uniqueValues([...existing.procedures, ...this.extractProcedureBaseNames(record)]);
            existing.lastDateIso = record.dateIso > existing.lastDateIso ? record.dateIso : existing.lastDateIso;
            existing.status = this.resolveGroupStatus(existing.status, record.status);
            existing.searchIndex = this.buildSearchIndex({
                patientName: existing.patientName,
                convenio: existing.convenios.join(" "),
                proceduresRaw: existing.procedures.join(" "),
                status: existing.status,
                dateLabel: this.formatDateLabel(existing.lastDateIso),
                horario: existing.attendances.map((attendance) => attendance.horario).join(" ")
            });
        });
        return Array.from(groups.values()).sort((left, right) => left.patientName.localeCompare(right.patientName, "pt-BR", { sensitivity: "base" }));
    }
    groupSpecialties(records) {
        const groups = new Map();
        records.forEach((attendance) => {
            attendance.procedureEntries.forEach((entry) => {
                const key = this.normalizeText(entry.baseName);
                const occurrence = {
                    attendanceId: attendance.id,
                    patientName: attendance.patientName,
                    normalizedPatientName: attendance.normalizedPatientName,
                    convenio: attendance.convenio,
                    status: attendance.status,
                    dateIso: attendance.dateIso,
                    dateLabel: attendance.dateLabel,
                    horario: attendance.horario,
                    baseName: entry.baseName,
                    raw: entry.raw,
                    frequency: entry.frequency,
                    value: attendance.status === "Isento" ? 0 : entry.value
                };
                const existing = groups.get(key);
                if (!existing) {
                    const created = {
                        key,
                        baseName: entry.baseName,
                        normalizedBaseName: key,
                        occurrences: [],
                        totalOccurrences: 0,
                        totalPatients: 0,
                        totalPagantes: 0,
                        totalIsentos: 0,
                        totalValue: 0,
                        convenios: [],
                        procedures: [],
                        searchIndex: "",
                        byFrequency: {
                            1: this.createEmptyFrequencyGroup(1),
                            2: this.createEmptyFrequencyGroup(2),
                            3: this.createEmptyFrequencyGroup(3)
                        }
                    };
                    groups.set(key, created);
                }
                const group = groups.get(key);
                this.pushSpecialtyOccurrence(group, occurrence);
            });
        });
        return Array.from(groups.values()).sort((left, right) => left.baseName.localeCompare(right.baseName, "pt-BR", { sensitivity: "base" }));
    }
    pushSpecialtyOccurrence(group, occurrence) {
        group.occurrences.push(occurrence);
        group.totalOccurrences += 1;
        group.totalValue += occurrence.value;
        group.totalPagantes += occurrence.status === "Pagante" ? 1 : 0;
        group.totalIsentos += occurrence.status === "Isento" ? 1 : 0;
        group.convenios = this.uniqueValues([...group.convenios, occurrence.convenio]);
        group.procedures = this.uniqueValues([...group.procedures, occurrence.baseName]);
        group.totalPatients = this.countUniquePatients(group.occurrences);
        group.searchIndex = this.buildSearchIndex({
            patientName: occurrence.patientName,
            convenio: group.convenios.join(" "),
            proceduresRaw: group.procedures.join(" "),
            status: occurrence.status,
            dateLabel: occurrence.dateLabel,
            horario: occurrence.horario
        });
        const frequencyGroup = group.byFrequency[occurrence.frequency];
        frequencyGroup.occurrences.push(occurrence);
        frequencyGroup.totalOccurrences += 1;
        frequencyGroup.totalValue += occurrence.value;
        const summaryMap = new Map();
        frequencyGroup.patientSummaries.forEach((summary) => summaryMap.set(summary.normalizedPatientName, summary));
        const existingSummary = summaryMap.get(occurrence.normalizedPatientName);
        if (!existingSummary) {
            summaryMap.set(occurrence.normalizedPatientName, {
                patientName: occurrence.patientName,
                normalizedPatientName: occurrence.normalizedPatientName,
                status: occurrence.status,
                totalOccurrences: 1,
                totalValue: occurrence.value,
                lastDateIso: occurrence.dateIso
            });
        }
        else {
            existingSummary.totalOccurrences += 1;
            existingSummary.totalValue += occurrence.value;
            existingSummary.lastDateIso = occurrence.dateIso > existingSummary.lastDateIso ? occurrence.dateIso : existingSummary.lastDateIso;
            existingSummary.status = this.resolveGroupStatus(existingSummary.status, occurrence.status);
        }
        frequencyGroup.patientSummaries = Array.from(summaryMap.values()).sort((left, right) => left.patientName.localeCompare(right.patientName, "pt-BR", { sensitivity: "base" }));
        frequencyGroup.totalPatients = frequencyGroup.patientSummaries.length;
        group.byFrequency[occurrence.frequency] = frequencyGroup;
    }
    parseProcedureEntries(value) {
        const parts = this.splitProcedures(value);
        const entries = parts.map((raw) => {
            const frequency = this.extractFrequency(raw);
            const baseName = this.normalizeSpecialtyLabel(raw);
            return {
                raw,
                baseName,
                frequency,
                value: this.getProcedurePrice(frequency)
            };
        }).filter((entry) => entry.baseName.trim().length > 0);
        if (entries.length > 0) {
            return entries;
        }
        if (value.trim().length === 0) {
            return [{ raw: "Sem procedimento", baseName: "Sem procedimento", frequency: 1, value: 0 }];
        }
        return [{ raw: value, baseName: value, frequency: this.extractFrequency(value), value: this.getProcedurePrice(this.extractFrequency(value)) }];
    }
    extractProcedureBaseNames(record) {
        return this.uniqueValues(record.procedureEntries.map((entry) => entry.baseName));
    }
    createEmptyFrequencyGroup(frequency) {
        return {
            frequency,
            occurrences: [],
            patientSummaries: [],
            totalOccurrences: 0,
            totalPatients: 0,
            totalValue: 0
        };
    }
    normalizeFinanceStatus(value, convenio, fallbackStatus, proceduresRaw) {
        const merged = `${value} ${convenio} ${fallbackStatus} ${proceduresRaw}`;
        return /isento/i.test(merged) ? "Isento" : "Pagante";
    }
    resolveGroupStatus(current, incoming) {
        return current === "Pagante" || incoming === "Pagante" ? "Pagante" : "Isento";
    }
    countUniquePatients(occurrences) {
        return new Set(occurrences.map((occurrence) => occurrence.normalizedPatientName)).size;
    }
    getProcedurePrice(frequency) {
        if (frequency === 2)
            return 20;
        if (frequency === 3)
            return 15;
        return 25;
    }
    extractFrequency(value) {
        const normalized = this.normalizeText(value);
        if (/3\s*x/.test(normalized) || /3x/.test(normalized))
            return 3;
        if (/2\s*x/.test(normalized) || /2x/.test(normalized))
            return 2;
        return 1;
    }
    removeFrequencySuffix(value) {
        return value
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
    }
    normalizeSpecialtyLabel(value) {
        const cleaned = this.removeFrequencySuffix(value)
            .replace(/\s{2,}/g, " ")
            .replace(/\s*[-–]\s*$/g, "")
            .trim();
        return cleaned;
    }
    splitProcedures(value) {
        return value
            .split(/\n|\s*;\s*|\s*\|\s*|\s*,\s*/g)
            .map((part) => part.trim())
            .filter((part) => part.length > 0)
            .filter((part) => !this.isNoiseProcedureToken(part));
    }
    isNoiseProcedureToken(value) {
        const normalized = this.normalizeText(value);
        return /^(?:isento|pagante|nao|não|sem procedimento)$/.test(normalized)
            || /^\d+$/.test(normalized)
            || /^(?:1|2|3)x(?:\s*\/\s*semana|\s*por\s*semana)?$/.test(normalized)
            || /^(?:1|2|3)\s*vez(?:es)?\s*por\s*semana$/.test(normalized)
            || /^(?:1|2|3)x$/.test(normalized);
    }
    splitAppointmentBlocks(lines) {
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
    }
    parseFieldEntriesFromLine(line) {
        const pattern = /(hor[áa]rio|paciente|celular|conv[eê]nio|status|situa[cç][aã]o|procedimentos?|procedimento|data|dia)\s*:\s*/gi;
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
    extractDateFromEntries(entries, rawText) {
        const candidate = entries.get("data") ?? entries.get("dia") ?? rawText;
        return this.extractIsoDate(candidate);
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
    readEvolucoesPendingHistory() {
        const raw = localStorage.getItem(this.evolucoesPendingHistoryStorageKey);
        if (!raw)
            return [];
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed))
                return [];
            return parsed
                .map((entry) => {
                const candidate = entry;
                const lines = Array.isArray(candidate.lines)
                    ? candidate.lines.filter((line) => typeof line === "string")
                    : [];
                return {
                    processedAtIso: typeof candidate.processedAtIso === "string" ? candidate.processedAtIso : new Date().toISOString(),
                    referenceDateIso: typeof candidate.referenceDateIso === "string" ? candidate.referenceDateIso : this.todayIso(),
                    lines
                };
            })
                .filter((entry) => entry.lines.length > 0);
        }
        catch {
            return [];
        }
    }
    parseProcessedMeta(raw) {
        if (!raw) {
            return {
                processedAtIso: new Date().toISOString(),
                referenceDateIso: this.todayIso(),
                totalImportedLines: 0,
                totalPatients: 0,
                totalForReferenceDate: 0
            };
        }
        try {
            const parsed = JSON.parse(raw);
            return {
                processedAtIso: typeof parsed.processedAtIso === "string" ? parsed.processedAtIso : new Date().toISOString(),
                referenceDateIso: typeof parsed.referenceDateIso === "string" ? parsed.referenceDateIso : this.todayIso(),
                totalImportedLines: typeof parsed.totalImportedLines === "number" ? parsed.totalImportedLines : 0,
                totalPatients: typeof parsed.totalPatients === "number" ? parsed.totalPatients : 0,
                totalForReferenceDate: typeof parsed.totalForReferenceDate === "number" ? parsed.totalForReferenceDate : 0
            };
        }
        catch {
            return {
                processedAtIso: new Date().toISOString(),
                referenceDateIso: this.todayIso(),
                totalImportedLines: 0,
                totalPatients: 0,
                totalForReferenceDate: 0
            };
        }
    }
    parsePatientsRecords(raw) {
        if (!raw)
            return [];
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed))
                return [];
            return parsed.map((item) => {
                const candidate = item;
                const status = candidate.statusFinanceiro === "Isento" ? "Isento" : "Pagante";
                return {
                    nome: typeof candidate.nome === "string" ? candidate.nome : "",
                    statusFinanceiro: status,
                    horario: typeof candidate.horario === "string" ? candidate.horario : "-",
                    fisioterapeuta: typeof candidate.fisioterapeuta === "string" ? candidate.fisioterapeuta : "-",
                    celular: typeof candidate.celular === "string" ? candidate.celular : "-",
                    convenio: typeof candidate.convenio === "string" ? candidate.convenio : "-",
                    procedimentos: typeof candidate.procedimentos === "string" ? this.sanitizeProcedimentosValue(candidate.procedimentos) : "-",
                    createdAtIso: typeof candidate.createdAtIso === "string" ? candidate.createdAtIso : new Date().toISOString(),
                    updatedAtIso: typeof candidate.updatedAtIso === "string" ? candidate.updatedAtIso : new Date().toISOString()
                };
            }).filter((record) => record.nome.trim().length > 0);
        }
        catch {
            return [];
        }
    }
    sanitizeProcedimentosValue(value) {
        return value.replace(/\s*observa[cç][oõ]es\s*:[\s\S]*$/i, "").trim();
    }
    buildSearchIndex(fields) {
        return this.normalizeText([
            fields.patientName,
            fields.convenio,
            fields.proceduresRaw,
            fields.status,
            fields.dateLabel,
            fields.horario
        ].join(" "));
    }
    formatDateLabel(value) {
        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return value || "-";
        }
        return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
    }
    formatCurrency(value) {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL"
        }).format(value);
    }
    normalizeText(value) {
        return value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }
    uniqueValues(values) {
        const normalized = new Map();
        values.forEach((value) => {
            const trimmed = value.trim();
            if (!trimmed)
                return;
            const key = this.normalizeText(trimmed);
            if (!normalized.has(key)) {
                normalized.set(key, trimmed);
            }
        });
        return Array.from(normalized.values());
    }
    isMissingValue(value) {
        return !value || value.trim().length === 0 || value.trim() === "-";
    }
    describeAttendanceProcedures(attendance) {
        if (attendance.procedureEntries.length === 0) {
            return attendance.proceduresRaw || "Sem procedimento";
        }
        return attendance.procedureEntries.map((entry) => `${entry.baseName} (${entry.frequency}x)`).join(" · ");
    }
    makeAttendanceKey(input) {
        return [
            input.referenceDateIso,
            this.normalizeText(input.patientName),
            this.normalizeText(input.horario),
            input.dateIso,
            this.normalizeText(input.proceduresRaw),
            String(input.blockIndex)
        ].join("|");
    }
    parseLines(raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item));
            }
        }
        catch {
            // segue como texto linha a linha
        }
        return raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    }
    getPatientDialog() {
        return document.getElementById("financeiroPatientDialog");
    }
    getSpecialtyDialog() {
        return document.getElementById("financeiroSpecialtyDialog");
    }
    setText(id, text) {
        const element = document.getElementById(id);
        if (!element)
            return;
        element.textContent = text;
    }
    escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value;
        return div.innerHTML;
    }
    todayIso() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
    showSiteNotification(message) {
        sharedShowSiteNotification(message);
    }
}
//# sourceMappingURL=financeiro-controller.js.map