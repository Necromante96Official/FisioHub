import { ThemeManager } from "../4.1_Core/theme-manager.js";
import { FISIOHUB_STORAGE_KEYS } from "../4.0_Shared/fisiohub-models.js";
import { bindHoverToasts as sharedBindHoverToasts, bindTermsDialog, showSiteNotification as sharedShowSiteNotification, startFloatingHomeHint as sharedStartFloatingHomeHint, syncFooterMetadata } from "../4.0_Shared/ui-feedback.js";
export class PatientsController {
    appId = "app";
    pageTemplate = "1.0_HTML-Templates/1.1_Pages/pacientes.html";
    processedDataStorageKey = FISIOHUB_STORAGE_KEYS.PROCESSED_DATA;
    patientsRecordsStorageKey = FISIOHUB_STORAGE_KEYS.PATIENTS_RECORDS;
    legacyImportedDataStorageKey = FISIOHUB_STORAGE_KEYS.LEGACY_IMPORTED_DATA;
    theme = new ThemeManager();
    patientRecords = [];
    activeSearch = "";
    activeStatusFilter = "all";
    activeOrderFilter = "az";
    selectedRecordIndex = null;
    isEditingDetails = false;
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
        this.patientRecords = this.parsePatientsFromStorage();
        this.bindHandlers();
        sharedBindHoverToasts({ scope: document });
        this.render();
        sharedStartFloatingHomeHint();
        window.addEventListener("storage", (event) => {
            if (event.key && !event.key.startsWith("fisiohub-")) {
                return;
            }
            this.patientRecords = this.parsePatientsFromStorage();
            this.selectedRecordIndex = null;
            this.isEditingDetails = false;
            this.render();
        });
        if (this.patientRecords.length === 0) {
            this.showSiteNotification("Nenhum paciente encontrado. Processe os dados na pagina inicial.");
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
        const tableBody = document.getElementById("patientsTableBody");
        tableBody?.addEventListener("click", (event) => {
            const target = event.target;
            const button = target.closest("button[data-index]");
            if (!button)
                return;
            const index = Number(button.dataset.index);
            const record = this.patientRecords[index];
            if (!record)
                return;
            this.openDetails(record);
        });
        const searchInput = document.getElementById("patientsSearchInput");
        searchInput?.addEventListener("input", () => {
            this.activeSearch = searchInput.value.trim().toLowerCase();
            this.render();
        });
        const statusFilter = document.getElementById("patientsStatusFilter");
        statusFilter?.addEventListener("change", () => {
            const value = statusFilter.value;
            if (value === "all" || value === "pagante" || value === "isento") {
                this.activeStatusFilter = value;
                this.render();
            }
        });
        const orderFilter = document.getElementById("patientsOrderFilter");
        orderFilter?.addEventListener("change", () => {
            const value = orderFilter.value;
            if (value === "az" || value === "za") {
                this.activeOrderFilter = value;
                this.render();
            }
        });
        const dialog = this.getDetailsDialog();
        const closeButton = document.getElementById("closePatientDetailsDialogBtn");
        const editButton = document.getElementById("editPatientDetailsBtn");
        const saveButton = document.getElementById("savePatientDetailsBtn");
        closeButton?.addEventListener("click", () => {
            if (dialog.open) {
                dialog.close();
            }
        });
        editButton?.addEventListener("click", () => {
            this.setDetailsEditMode(true);
        });
        saveButton?.addEventListener("click", () => {
            this.savePatientDetails();
        });
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) {
                dialog.close();
            }
        });
        dialog.addEventListener("close", () => {
            this.setDetailsEditMode(false);
            this.selectedRecordIndex = null;
        });
    }
    render() {
        const visibleRecords = this.getFilteredRecords();
        const total = visibleRecords.length;
        const isentos = visibleRecords.filter((record) => record.statusFinanceiro === "Isento").length;
        const pagantes = total - isentos;
        this.setText("patientsTotalCount", String(total));
        this.setText("patientsPagantesCount", String(pagantes));
        this.setText("patientsIsentosCount", String(isentos));
        const tableBody = document.getElementById("patientsTableBody");
        if (!tableBody)
            return;
        tableBody.innerHTML = "";
        if (visibleRecords.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 3;
            cell.className = "fh-patients-empty";
            cell.textContent = "Nenhum paciente encontrado para o filtro atual.";
            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }
        visibleRecords.forEach((record) => {
            const row = document.createElement("tr");
            const nameCell = document.createElement("td");
            nameCell.textContent = record.nome;
            const statusCell = document.createElement("td");
            const statusPill = document.createElement("span");
            statusPill.className = "fh-patient-status";
            statusPill.dataset.kind = record.statusFinanceiro.toLowerCase();
            statusPill.textContent = record.statusFinanceiro;
            statusCell.appendChild(statusPill);
            const actionCell = document.createElement("td");
            const detailsButton = document.createElement("button");
            detailsButton.type = "button";
            detailsButton.className = "fh-patient-details-btn";
            detailsButton.dataset.index = String(this.patientRecords.indexOf(record));
            detailsButton.textContent = "Detalhes";
            actionCell.appendChild(detailsButton);
            row.appendChild(nameCell);
            row.appendChild(statusCell);
            row.appendChild(actionCell);
            tableBody.appendChild(row);
        });
    }
    parsePatientsFromStorage() {
        const fromRecords = this.parsePatientsRecords(localStorage.getItem(this.patientsRecordsStorageKey));
        if (fromRecords.length > 0) {
            return fromRecords;
        }
        const processedRaw = localStorage.getItem(this.processedDataStorageKey) ?? "";
        if (processedRaw.trim()) {
            return this.parsePatientsFromLines(processedRaw);
        }
        const legacyRaw = localStorage.getItem(this.legacyImportedDataStorageKey) ?? "";
        if (legacyRaw.trim()) {
            return this.parsePatientsFromLines(legacyRaw);
        }
        return [];
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
    parsePatientsFromLines(raw) {
        const nowIso = new Date().toISOString();
        const lines = raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
        const records = [];
        let draft = this.createEmptyDraft();
        const pushDraft = () => {
            if (!draft.nome) {
                draft = this.createEmptyDraft();
                return;
            }
            records.push({ ...draft, createdAtIso: nowIso, updatedAtIso: nowIso });
            draft = this.createEmptyDraft();
        };
        lines.forEach((line) => {
            if (/^---\s*agendamento\s+\d+/i.test(line)) {
                pushDraft();
                return;
            }
            const entryMatch = line.match(/^([^:]+):\s*(.+)$/);
            if (!entryMatch) {
                return;
            }
            const key = this.normalizeKey(entryMatch[1]);
            const value = entryMatch[2].trim();
            if (key === "horario")
                draft.horario = value;
            if (key === "fisioterapeuta")
                draft.fisioterapeuta = value;
            if (key === "paciente")
                draft.nome = value;
            if (key === "celular")
                draft.celular = value;
            if (key === "convenio")
                draft.convenio = value;
            if (key === "procedimentos")
                draft.procedimentos = this.sanitizeProcedimentosValue(value);
        });
        pushDraft();
        return records.map((record) => ({
            ...record,
            statusFinanceiro: this.isIsento(record) ? "Isento" : "Pagante"
        }));
    }
    createEmptyDraft() {
        const nowIso = new Date().toISOString();
        return {
            nome: "",
            statusFinanceiro: "Pagante",
            horario: "-",
            fisioterapeuta: "-",
            celular: "-",
            convenio: "-",
            procedimentos: "-",
            createdAtIso: nowIso,
            updatedAtIso: nowIso
        };
    }
    normalizeKey(value) {
        return value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }
    isIsento(record) {
        return /isento/i.test(record.convenio) || /isento/i.test(record.procedimentos);
    }
    sanitizeProcedimentosValue(value) {
        return value.replace(/\s*observa[cç][oõ]es\s*:[\s\S]*$/i, "").trim();
    }
    getWhatsappLink(phone) {
        const onlyDigits = phone.replace(/\D/g, "");
        if (!onlyDigits) {
            return null;
        }
        const withCountryCode = onlyDigits.startsWith("55") ? onlyDigits : `55${onlyDigits}`;
        return `https://wa.me/${withCountryCode}`;
    }
    openDetails(record) {
        this.selectedRecordIndex = this.patientRecords.indexOf(record);
        this.setText("detailHorario", record.horario || "-");
        this.setText("detailFisioterapeuta", record.fisioterapeuta || "-");
        this.setText("detailPaciente", record.nome || "-");
        this.setText("detailCelular", record.celular || "-");
        this.setText("detailConvenio", record.convenio || "-");
        this.setText("detailProcedimentos", record.procedimentos || "-");
        this.setText("detailCreatedAt", this.formatDateTime(record.createdAtIso));
        this.setText("detailUpdatedAt", this.formatDateTime(record.updatedAtIso));
        this.setDetailsEditMode(false);
        const whatsappLink = document.getElementById("detailWhatsappLink");
        if (whatsappLink) {
            const href = this.getWhatsappLink(record.celular);
            whatsappLink.href = href ?? "#";
            whatsappLink.setAttribute("aria-disabled", href ? "false" : "true");
        }
        const dialog = this.getDetailsDialog();
        if (!dialog.open) {
            dialog.showModal();
        }
    }
    setDetailsEditMode(enabled) {
        this.isEditingDetails = enabled;
        const editableFields = Array.from(document.querySelectorAll(".fh-patient-detail-value"));
        editableFields.forEach((field) => {
            field.contentEditable = enabled ? "true" : "false";
            field.dataset.editing = enabled ? "true" : "false";
        });
        const editButton = document.getElementById("editPatientDetailsBtn");
        const saveButton = document.getElementById("savePatientDetailsBtn");
        if (editButton)
            editButton.disabled = enabled;
        if (saveButton)
            saveButton.disabled = !enabled;
    }
    savePatientDetails() {
        if (!this.isEditingDetails || this.selectedRecordIndex === null) {
            return;
        }
        const record = this.patientRecords[this.selectedRecordIndex];
        if (!record) {
            return;
        }
        const readField = (id) => {
            const element = document.getElementById(id);
            return element?.textContent?.trim() || "-";
        };
        record.horario = readField("detailHorario");
        record.fisioterapeuta = readField("detailFisioterapeuta");
        record.nome = readField("detailPaciente");
        record.celular = readField("detailCelular");
        record.convenio = readField("detailConvenio");
        record.procedimentos = this.sanitizeProcedimentosValue(readField("detailProcedimentos"));
        record.statusFinanceiro = this.isIsento(record) ? "Isento" : "Pagante";
        record.updatedAtIso = new Date().toISOString();
        localStorage.setItem(this.patientsRecordsStorageKey, JSON.stringify(this.patientRecords));
        this.setText("detailUpdatedAt", this.formatDateTime(record.updatedAtIso));
        this.setDetailsEditMode(false);
        this.render();
        this.showSiteNotification("Detalhes do paciente atualizados com sucesso.");
    }
    formatDateTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "-";
        }
        return new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short"
        }).format(date);
    }
    getDetailsDialog() {
        return document.getElementById("patientDetailsDialog");
    }
    getFilteredRecords() {
        const filtered = this.patientRecords.filter((record) => {
            const statusKind = record.statusFinanceiro.toLowerCase();
            const statusMatches = this.activeStatusFilter === "all" || statusKind === this.activeStatusFilter;
            const searchBase = `${record.nome} ${record.fisioterapeuta} ${record.convenio} ${record.celular} ${record.procedimentos}`.toLowerCase();
            const searchMatches = !this.activeSearch || searchBase.includes(this.activeSearch);
            return statusMatches && searchMatches;
        });
        filtered.sort((a, b) => {
            const factor = this.activeOrderFilter === "za" ? -1 : 1;
            return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) * factor;
        });
        return filtered;
    }
    startFloatingHomeHint() {
        sharedStartFloatingHomeHint();
    }
    showSiteNotification(message) {
        sharedShowSiteNotification(message);
    }
    setText(id, text) {
        const element = document.getElementById(id);
        if (!element)
            return;
        element.textContent = text;
    }
}
//# sourceMappingURL=patients-controller.js.map