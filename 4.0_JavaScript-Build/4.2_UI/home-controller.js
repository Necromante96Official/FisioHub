import { ThemeManager } from "../4.1_Core/theme-manager.js";
import { FISIOHUB_RUNTIME_KEYS, FISIOHUB_STORAGE_KEYS } from "../4.0_Shared/fisiohub-models.js";
import { bindAnalysisDialog, bindFisioHubStorageListener, bindHoverToasts as sharedBindHoverToasts, bindTermsDialog, showSiteNotification as sharedShowSiteNotification, startFloatingHomeHint as sharedStartFloatingHomeHint, syncFooterMetadata } from "../4.0_Shared/ui-feedback.js";
export class HomeController {
    appId = "app";
    homeTemplate = "1.0_HTML-Templates/1.1_Pages/home.html";
    stagingDataStorageKey = FISIOHUB_STORAGE_KEYS.STAGING_DATA;
    processedDataStorageKey = FISIOHUB_STORAGE_KEYS.PROCESSED_DATA;
    evolucoesPendingHistoryStorageKey = FISIOHUB_STORAGE_KEYS.EVOLUCOES_PENDING_HISTORY;
    doneEvolutionsStorageKey = FISIOHUB_STORAGE_KEYS.DONE_EVOLUTIONS;
    patientsRecordsStorageKey = FISIOHUB_STORAGE_KEYS.PATIENTS_RECORDS;
    processedMetaStorageKey = FISIOHUB_STORAGE_KEYS.PROCESSED_META;
    theme = new ThemeManager();
    importedItems = [];
    nextItemId = 1;
    async bootstrap() {
        this.theme.init();
        await this.loadHome();
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
        this.setDate(this.getStoredReferenceDate() ?? this.todayIso());
        this.loadStagingDataFromStorage();
        this.bindHandlers();
        sharedBindHoverToasts({ scope: document });
        this.renderImportedData();
        const stopFloatingHomeHint = sharedStartFloatingHomeHint();
        const disposeStorageListener = bindFisioHubStorageListener(() => {
            this.loadStagingDataFromStorage();
            this.renderImportedData();
        });
        const cleanup = () => {
            stopFloatingHomeHint();
            disposeStorageListener();
        };
        window.addEventListener("beforeunload", cleanup, { once: true });
    }
    async loadHome() {
        const app = document.getElementById(this.appId);
        if (!app)
            return;
        const html = await fetch(this.homeTemplate).then((r) => r.text());
        app.innerHTML = html;
    }
    async resolveIncludes() {
        let nodes = Array.from(document.querySelectorAll("[data-include]"));
        while (nodes.length > 0) {
            for (const node of nodes) {
                const path = node.getAttribute("data-include");
                if (!path)
                    continue;
                const html = await fetch(path).then((r) => r.text());
                node.outerHTML = html;
            }
            nodes = Array.from(document.querySelectorAll("[data-include]"));
        }
    }
    bindHandlers() {
        const modules = Array.from(document.querySelectorAll(".fh-module-card"));
        modules.forEach((btn) => {
            btn.addEventListener("click", () => {
                const target = btn.getAttribute("data-target");
                if (!target)
                    return;
                window.location.href = target;
            });
        });
        const importBtn = document.getElementById("importBtn");
        const fileInput = document.getElementById("importFileInput");
        importBtn?.addEventListener("click", () => fileInput?.click());
        fileInput?.addEventListener("change", async () => {
            const file = fileInput.files?.[0];
            if (!file)
                return;
            const content = await file.text();
            this.saveStagingContent(content);
            fileInput.value = "";
            this.showSiteNotification("Dados importados para rascunho. Clique em Processar para consolidar.");
        });
        const clearOnlyDataBtn = document.getElementById("clearOnlyDataBtn") ?? this.ensureClearOnlyDataButton();
        clearOnlyDataBtn?.addEventListener("click", () => {
            this.clearAllStoredData();
        });
        const clearDataBtn = document.getElementById("clearDataBtn");
        clearDataBtn?.addEventListener("click", () => {
            this.clearImportedDataOnly();
        });
        const clearAllDataBtn = document.getElementById("clearAllDataBtn");
        clearAllDataBtn?.addEventListener("click", () => {
            this.clearOnlyPageDataPreservingPatientsList();
        });
        const importedDataEditor = document.getElementById("importedDataEditor");
        importedDataEditor?.addEventListener("input", () => {
            this.syncImportedDataFromEditor(importedDataEditor.value);
        });
        const processBtn = document.getElementById("processBtn");
        processBtn?.addEventListener("click", () => {
            void this.processAndPersistData();
        });
        const dateInput = this.getDateInput();
        dateInput?.addEventListener("change", () => {
            this.persistReferenceDate(dateInput.value || this.todayIso());
            this.renderImportedData();
        });
        const todayBtn = document.getElementById("todayBtn");
        todayBtn?.addEventListener("click", () => {
            this.setDate(this.todayIso());
            this.renderImportedData();
        });
        const prevDayBtn = document.getElementById("prevDayBtn");
        prevDayBtn?.addEventListener("click", () => this.moveDateByDays(-1));
        const nextDayBtn = document.getElementById("nextDayBtn");
        nextDayBtn?.addEventListener("click", () => this.moveDateByDays(1));
        const prevMonthBtn = document.getElementById("prevMonthBtn");
        prevMonthBtn?.addEventListener("click", () => this.moveMonthStart(-1));
        const nextMonthBtn = document.getElementById("nextMonthBtn");
        nextMonthBtn?.addEventListener("click", () => this.moveMonthStart(1));
        const backupsDialog = document.getElementById("backupsDialog");
        const backupsOpenBtn = document.getElementById("backupsBtn");
        const backupsCloseBtn = document.getElementById("closeBackupsDialogBtn");
        backupsOpenBtn?.addEventListener("click", () => {
            if (!backupsDialog?.open) {
                backupsDialog?.showModal();
            }
        });
        backupsCloseBtn?.addEventListener("click", () => {
            backupsDialog?.close();
        });
        backupsDialog?.addEventListener("click", (event) => {
            if (event.target === backupsDialog) {
                backupsDialog.close();
            }
        });
        backupsDialog?.addEventListener("cancel", (event) => {
            event.preventDefault();
            backupsDialog.close();
        });
        document.getElementById("exportAllBackupBtn")?.addEventListener("click", () => {
            backupsDialog?.close();
            this.exportBackup("all");
        });
        document.getElementById("exportPatientsOnlyBackupBtn")?.addEventListener("click", () => {
            backupsDialog?.close();
            this.exportBackup("patients-only");
        });
        document.getElementById("exportAllWithoutPatientsBackupBtn")?.addEventListener("click", () => {
            backupsDialog?.close();
            this.exportBackup("all-without-patients");
        });
        document.getElementById("importAllBackupBtn")?.addEventListener("click", () => {
            backupsDialog?.close();
            void this.importBackup("all");
        });
        document.getElementById("importPatientsOnlyBackupBtn")?.addEventListener("click", () => {
            backupsDialog?.close();
            void this.importBackup("patients-only");
        });
        document.getElementById("importAllWithoutPatientsBackupBtn")?.addEventListener("click", () => {
            backupsDialog?.close();
            void this.importBackup("all-without-patients");
        });
    }
    getDateInput() {
        return document.getElementById("refDate");
    }
    getCurrentDate() {
        const dateInput = this.getDateInput();
        return dateInput?.value || this.getStoredReferenceDate() || this.todayIso();
    }
    setDate(value) {
        const dateInput = this.getDateInput();
        if (!dateInput)
            return;
        dateInput.value = value;
        this.persistReferenceDate(value);
    }
    getStoredReferenceDate() {
        const stored = localStorage.getItem(FISIOHUB_STORAGE_KEYS.REFERENCE_DATE);
        if (!stored)
            return null;
        const date = new Date(`${stored}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return stored;
    }
    persistReferenceDate(value) {
        const parsed = new Date(`${value}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) {
            return;
        }
        const normalized = this.toIso(parsed);
        localStorage.setItem(FISIOHUB_STORAGE_KEYS.REFERENCE_DATE, normalized);
    }
    moveDateByDays(days) {
        const current = new Date(`${this.getCurrentDate()}T00:00:00`);
        current.setDate(current.getDate() + days);
        this.setDate(this.toIso(current));
        this.renderImportedData();
    }
    moveMonthStart(monthShift) {
        const current = new Date(`${this.getCurrentDate()}T00:00:00`);
        current.setMonth(current.getMonth() + monthShift, 1);
        this.setDate(this.toIso(current));
        this.renderImportedData();
    }
    async processAndPersistData() {
        const stagedLines = this.importedItems.map((item) => item.raw.trim()).filter((line) => line.length > 0);
        if (stagedLines.length === 0) {
            this.showSiteNotification("Nenhum dado em rascunho para processar.");
            return;
        }
        const date = this.getCurrentDate();
        if (this.hasAlreadyProcessedDate(date)) {
            this.showSiteNotification(`Esses dados já foram enviados para a data ${this.formatDateForToast(date)}.`);
            return;
        }
        let linesForProcessing = [...stagedLines];
        const requiredFieldIssues = this.collectRequiredFieldIssues(linesForProcessing);
        if (requiredFieldIssues.length > 0) {
            const corrections = await this.askMissingRequiredFieldCorrections(requiredFieldIssues);
            if (!corrections) {
                this.showSiteNotification("Processamento cancelado. Campos obrigatórios não foram preenchidos.");
                return;
            }
            linesForProcessing = this.applyRequiredFieldCorrections(linesForProcessing, requiredFieldIssues, corrections);
            this.importedItems = linesForProcessing.map((line) => ({
                id: this.nextItemId++,
                raw: line,
                dateIso: this.extractIsoDate(line) ?? this.todayIso()
            }));
            this.saveStagingDataToStorage();
            this.renderImportedData();
        }
        const filtered = linesForProcessing.filter((line) => {
            const extracted = this.extractIsoDate(line);
            return !extracted || extracted === date;
        });
        const patientRecords = this.parsePatientsFromLines(linesForProcessing);
        const mergedPatients = await this.mergePatientsWithConflictResolution(patientRecords);
        if (!mergedPatients) {
            this.showSiteNotification("Processamento cancelado.");
            return;
        }
        const processedMeta = {
            processedAtIso: new Date().toISOString(),
            referenceDateIso: date,
            totalImportedLines: linesForProcessing.length,
            totalPatients: mergedPatients.length,
            totalForReferenceDate: filtered.length
        };
        localStorage.setItem(this.processedDataStorageKey, linesForProcessing.join("\n"));
        localStorage.setItem(this.patientsRecordsStorageKey, JSON.stringify(mergedPatients));
        localStorage.setItem(this.processedMetaStorageKey, JSON.stringify(processedMeta));
        this.appendEvolucoesPendingBatch({
            processedAtIso: processedMeta.processedAtIso,
            referenceDateIso: processedMeta.referenceDateIso,
            lines: linesForProcessing
        });
        this.importedItems = [];
        this.saveStagingDataToStorage();
        this.renderImportedData();
        this.showSiteNotification(`Processamento concluído: ${mergedPatients.length} paciente(s) salvos com precisão local.`);
    }
    saveStagingContent(content) {
        const lines = this.parseContent(content)
            .map((line) => line.trim())
            .filter((line) => !/^[=\-_*]{6,}$/.test(line))
            .filter((line) => line.length > 0);
        this.importedItems = lines.map((line) => ({
            id: this.nextItemId++,
            raw: line,
            dateIso: this.extractIsoDate(line)
        }));
        this.saveStagingDataToStorage();
        this.renderImportedData();
    }
    exportBackup(kind) {
        const payload = {
            schema: "fisiohub-backup-v3",
            kind,
            createdAtIso: new Date().toISOString(),
            storageEntries: this.collectBackupStorageEntries(kind)
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const fileName = `fisiohub-backup-${this.getBackupFileSlug(kind)}-${this.todayIso()}.json`;
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        this.showSiteNotification("Backup exportado com sucesso.");
    }
    async importBackup(kind) {
        const payload = await this.pickBackupFile();
        if (!payload) {
            this.showSiteNotification("Importação cancelada.");
            return;
        }
        const backupEntries = this.collectBackupStorageEntriesFromPayload(payload);
        const entriesToApply = this.filterBackupStorageEntriesByKind(backupEntries, kind);
        if (Object.keys(entriesToApply).length === 0) {
            this.showSiteNotification("Arquivo de backup sem dados compatíveis com esta opção.");
            return;
        }
        if (kind === "all") {
            this.clearAllFisioHubStorage();
            this.setPatientsFallbackSuppressed(false);
            this.setFinanceFallbackSuppressed(false);
            this.applyBackupStorageEntries(entriesToApply);
        }
        if (kind === "patients-only") {
            this.clearAllFisioHubStorage([this.patientsRecordsStorageKey]);
            this.setPatientsFallbackSuppressed(false);
            this.setFinanceFallbackSuppressed(true);
            this.applyBackupStorageEntries(entriesToApply);
        }
        if (kind === "all-without-patients") {
            this.clearAllFisioHubStorage();
            this.setPatientsFallbackSuppressed(true);
            this.setFinanceFallbackSuppressed(false);
            this.applyBackupStorageEntries(entriesToApply);
        }
        const referenceDateIso = kind === "patients-only"
            ? null
            : this.resolveBackupReferenceDate(payload, entriesToApply);
        if (referenceDateIso) {
            this.setDate(referenceDateIso);
        }
        this.loadStagingDataFromStorage();
        this.renderImportedData();
        this.showSiteNotification("Backup importado com sucesso.");
    }
    clearAllStoredData() {
        this.clearAllFisioHubStorage();
        this.setPatientsFallbackSuppressed(false);
        this.setFinanceFallbackSuppressed(false);
        this.importedItems = [];
        this.nextItemId = 1;
        this.setDate(this.todayIso());
        this.renderImportedData();
        this.showSiteNotification("Todos os dados locais foram limpos.");
    }
    ensureClearOnlyDataButton() {
        const existing = document.getElementById("clearOnlyDataBtn");
        if (existing) {
            return existing;
        }
        const panelActions = document.querySelector(".fh-panel-actions");
        if (!panelActions) {
            return null;
        }
        const button = document.createElement("button");
        button.id = "clearOnlyDataBtn";
        button.className = "fh-btn fh-btn-ghost";
        button.type = "button";
        button.textContent = "Limpar Tudo";
        const panelActionsLeft = document.querySelector(".fh-panel-actions-left");
        const clearAllDataButton = document.getElementById("clearAllDataBtn");
        if (clearAllDataButton && panelActionsLeft && clearAllDataButton.parentElement === panelActionsLeft) {
            panelActionsLeft.insertBefore(button, clearAllDataButton.nextSibling);
            return button;
        }
        if (panelActionsLeft) {
            panelActionsLeft.appendChild(button);
            return button;
        }
        const clearDataButton = document.getElementById("clearDataBtn");
        if (clearDataButton?.parentElement === panelActions) {
            panelActions.insertBefore(button, clearDataButton);
            return button;
        }
        const importButton = document.getElementById("importBtn");
        if (importButton?.parentElement === panelActions) {
            panelActions.insertBefore(button, importButton);
        }
        else {
            panelActions.appendChild(button);
        }
        return button;
    }
    clearImportedDataOnly() {
        this.importedItems = [];
        this.nextItemId = 1;
        localStorage.removeItem(this.stagingDataStorageKey);
        this.renderImportedData();
        this.showSiteNotification("O texto da lista de dados importados foi limpo.");
    }
    clearOnlyPageDataPreservingPatientsList() {
        const keysToRemove = [
            this.stagingDataStorageKey,
            this.processedDataStorageKey,
            this.processedMetaStorageKey,
            this.evolucoesPendingHistoryStorageKey,
            this.doneEvolutionsStorageKey,
            FISIOHUB_STORAGE_KEYS.REFERENCE_DATE
        ];
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        this.importedItems = [];
        this.nextItemId = 1;
        this.setDate(this.todayIso());
        this.renderImportedData();
        this.showSiteNotification("Os dados das páginas foram limpos. A Lista de Pacientes foi preservada.");
    }
    appendEvolucoesPendingBatch(batch) {
        const history = this.readEvolucoesPendingHistory();
        history.push({
            processedAtIso: batch.processedAtIso,
            referenceDateIso: batch.referenceDateIso,
            lines: batch.lines.filter((line) => line.trim().length > 0)
        });
        localStorage.setItem(this.evolucoesPendingHistoryStorageKey, JSON.stringify(history));
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
    hasAlreadyProcessedDate(referenceDateIso) {
        const currentMeta = this.parseProcessedMeta(localStorage.getItem(this.processedMetaStorageKey));
        const hasCurrentMeta = currentMeta.referenceDateIso === referenceDateIso
            && (localStorage.getItem(this.processedDataStorageKey) ?? "").trim().length > 0;
        if (hasCurrentMeta) {
            return true;
        }
        return this.readEvolucoesPendingHistory().some((batch) => batch.referenceDateIso === referenceDateIso);
    }
    clearAllFisioHubStorage(excludedKeys = []) {
        const excluded = new Set(excludedKeys);
        const keysToRemove = [];
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key && key.startsWith("fisiohub-") && !excluded.has(key)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
    }
    collectBackupStorageEntries(kind) {
        const entries = {};
        const keys = this.listFisioHubStorageKeys();
        keys.forEach((key) => {
            if (kind === "patients-only" && key !== this.patientsRecordsStorageKey) {
                return;
            }
            if (kind === "all-without-patients" && key === this.patientsRecordsStorageKey) {
                return;
            }
            const value = localStorage.getItem(key);
            if (typeof value === "string") {
                entries[key] = value;
            }
        });
        return entries;
    }
    collectBackupStorageEntriesFromPayload(payload) {
        if (payload.storageEntries && typeof payload.storageEntries === "object" && !Array.isArray(payload.storageEntries)) {
            const entries = {};
            Object.entries(payload.storageEntries).forEach(([key, value]) => {
                if (typeof value === "string") {
                    entries[key] = value;
                }
            });
            return entries;
        }
        const entries = {};
        if (typeof payload.stagingData === "string") {
            entries[this.stagingDataStorageKey] = payload.stagingData;
        }
        if (typeof payload.processedData === "string") {
            entries[this.processedDataStorageKey] = payload.processedData;
        }
        if (payload.patientsRecords !== undefined) {
            entries[this.patientsRecordsStorageKey] = JSON.stringify(this.toSafePatientsRecords(payload.patientsRecords));
        }
        if (payload.processedMeta !== undefined) {
            entries[this.processedMetaStorageKey] = JSON.stringify(this.toSafeProcessedMeta(payload.processedMeta));
        }
        return entries;
    }
    filterBackupStorageEntriesByKind(entries, kind) {
        const filteredEntries = {};
        Object.entries(entries).forEach(([key, value]) => {
            if (key === FISIOHUB_RUNTIME_KEYS.PATIENTS_FALLBACK_SUPPRESSED) {
                return;
            }
            if (kind === "patients-only" && key !== this.patientsRecordsStorageKey) {
                return;
            }
            if (kind === "all-without-patients" && key === this.patientsRecordsStorageKey) {
                return;
            }
            filteredEntries[key] = value;
        });
        return filteredEntries;
    }
    applyBackupStorageEntries(entries) {
        Object.entries(entries).forEach(([key, value]) => {
            localStorage.setItem(key, value);
        });
    }
    resolveBackupReferenceDate(payload, entries) {
        const explicitReferenceDate = entries[FISIOHUB_STORAGE_KEYS.REFERENCE_DATE];
        if (typeof explicitReferenceDate === "string" && explicitReferenceDate.trim().length > 0) {
            return explicitReferenceDate.trim();
        }
        const processedMetaRaw = entries[this.processedMetaStorageKey];
        if (typeof processedMetaRaw === "string" && processedMetaRaw.trim().length > 0) {
            return this.parseProcessedMeta(processedMetaRaw).referenceDateIso;
        }
        if (payload.processedMeta) {
            return this.toSafeProcessedMeta(payload.processedMeta).referenceDateIso;
        }
        return null;
    }
    listFisioHubStorageKeys() {
        const keys = [];
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key && key !== FISIOHUB_RUNTIME_KEYS.PATIENTS_FALLBACK_SUPPRESSED && key.startsWith("fisiohub-")) {
                keys.push(key);
            }
        }
        return keys.sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
    }
    setPatientsFallbackSuppressed(suppressed) {
        if (suppressed) {
            localStorage.setItem(FISIOHUB_RUNTIME_KEYS.PATIENTS_FALLBACK_SUPPRESSED, "true");
            return;
        }
        localStorage.removeItem(FISIOHUB_RUNTIME_KEYS.PATIENTS_FALLBACK_SUPPRESSED);
    }
    setFinanceFallbackSuppressed(suppressed) {
        if (suppressed) {
            localStorage.setItem(FISIOHUB_RUNTIME_KEYS.FINANCE_FALLBACK_SUPPRESSED, "true");
            return;
        }
        localStorage.removeItem(FISIOHUB_RUNTIME_KEYS.FINANCE_FALLBACK_SUPPRESSED);
    }
    getBackupFileSlug(kind) {
        if (kind === "patients-only") {
            return "somente-pacientes";
        }
        if (kind === "all-without-patients") {
            return "sem-pacientes";
        }
        return "completo";
    }
    async pickBackupFile() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        const file = await new Promise((resolve) => {
            input.addEventListener("change", () => {
                resolve(input.files?.[0] ?? null);
            }, { once: true });
            input.click();
        });
        if (!file)
            return null;
        try {
            const raw = await file.text();
            const parsed = JSON.parse(raw);
            return parsed;
        }
        catch {
            this.showSiteNotification("Arquivo de backup inválido.");
            return null;
        }
    }
    parseContent(content) {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item));
            }
        }
        catch {
            // Se nao for JSON valido, segue como texto linha a linha.
        }
        return content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    }
    parsePatientsFromLines(lines) {
        const records = [];
        let draft = this.createEmptyPatientDraft();
        const nowIso = new Date().toISOString();
        const pushDraft = () => {
            if (!draft.nome) {
                draft = this.createEmptyPatientDraft();
                return;
            }
            records.push({ ...draft, createdAtIso: nowIso, updatedAtIso: nowIso });
            draft = this.createEmptyPatientDraft();
        };
        lines.forEach((line) => {
            if (/^---\s*agendamento\s+\d+/i.test(line)) {
                pushDraft();
                return;
            }
            const entries = this.parseFieldEntriesFromLine(line);
            entries.forEach(([label, rawValue]) => {
                const key = this.normalizeKey(label);
                const value = this.sanitizeProcedimentosValue(rawValue.trim());
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
                if (key === "status" || key === "situacao")
                    draft.statusFinanceiro = /isento/i.test(value) ? "Isento" : "Pagante";
                if (key === "procedimentos" || key === "procedimento")
                    draft.procedimentos = this.sanitizeProcedimentosValue(value);
            });
        });
        pushDraft();
        return records.map((record) => ({
            ...record,
            statusFinanceiro: record.statusFinanceiro === "Isento" || this.isIsento(record) ? "Isento" : "Pagante"
        }));
    }
    createEmptyPatientDraft() {
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
    async mergePatientsWithConflictResolution(incomingRecords) {
        const currentRecords = this.parsePatientsRecords(localStorage.getItem(this.patientsRecordsStorageKey));
        const merged = [...currentRecords];
        const conflicts = [];
        incomingRecords.forEach((incoming) => {
            const key = this.normalizePatientKey(incoming);
            const foundIndex = merged.findIndex((record) => this.normalizePatientKey(record) === key);
            if (foundIndex === -1) {
                merged.push(incoming);
                return;
            }
            const existing = merged[foundIndex];
            if (this.areRecordsEquivalent(existing, incoming)) {
                return;
            }
            conflicts.push({
                index: foundIndex,
                dialogIndex: conflicts.length,
                existing,
                incoming
            });
        });
        if (conflicts.length > 0) {
            const decisions = await this.askConflictChoices(conflicts);
            if (!decisions) {
                return null;
            }
            for (const conflict of conflicts) {
                const choice = decisions.get(conflict.dialogIndex) ?? "existing";
                if (choice === "incoming") {
                    merged[conflict.index] = {
                        ...conflict.incoming,
                        createdAtIso: conflict.existing.createdAtIso,
                        updatedAtIso: new Date().toISOString()
                    };
                }
            }
        }
        return merged;
    }
    normalizePatientKey(record) {
        const normalizedName = record.nome
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
        const normalizedPhone = record.celular.replace(/\D/g, "");
        return `${normalizedName}|${normalizedPhone}`;
    }
    areRecordsEquivalent(existing, incoming) {
        return existing.nome === incoming.nome
            && existing.statusFinanceiro === incoming.statusFinanceiro
            && existing.horario === incoming.horario
            && existing.fisioterapeuta === incoming.fisioterapeuta
            && existing.celular === incoming.celular
            && existing.convenio === incoming.convenio
            && existing.procedimentos === incoming.procedimentos;
    }
    askConflictChoices(conflicts) {
        const dialog = document.getElementById("patientConflictDialog");
        const title = document.getElementById("patientConflictTitle");
        const message = document.getElementById("patientConflictMessage");
        const list = document.getElementById("patientConflictList");
        const exitBtn = document.getElementById("exitPatientConflictBtn");
        const confirmBtn = document.getElementById("confirmPatientConflictBtn");
        const autoFillBtn = document.getElementById("autoFillRequiredBtn");
        if (!dialog || !title || !message || !list || !exitBtn || !confirmBtn) {
            return Promise.resolve(null);
        }
        title.textContent = "Conflito de paciente detectado";
        exitBtn.textContent = "Sair";
        confirmBtn.hidden = true;
        confirmBtn.disabled = true;
        if (autoFillBtn) {
            autoFillBtn.hidden = true;
            autoFillBtn.disabled = true;
        }
        message.textContent = `Foram encontrados ${conflicts.length} conflito(s). Escolha qual versão manter em cada paciente.`;
        list.innerHTML = conflicts.map((conflict, position) => {
            const diffFields = this.getConflictDiffFields(conflict.existing, conflict.incoming);
            const currentDetails = this.describeConflictSide(conflict.existing, diffFields);
            const incomingDetails = this.describeConflictSide(conflict.incoming, diffFields);
            const patientName = conflict.incoming.nome || conflict.existing.nome || "Paciente sem nome";
            return `
                <article class="fh-conflict-item" data-conflict-index="${position}">
                  <header class="fh-conflict-item-head">
                    <div class="fh-conflict-item-head-top">
                      <span class="fh-conflict-badge">Paciente</span>
                      <h4 class="fh-conflict-item-name">${this.escapeHtml(patientName)}</h4>
                    </div>
                    <p class="fh-conflict-item-index">Conflito ${position + 1} de ${conflicts.length}</p>
                  </header>

                  <div class="fh-conflict-item-grid">
                    <section class="fh-conflict-side fh-conflict-side-current" aria-label="Registro atual">
                      <div class="fh-conflict-side-head">
                        <span class="fh-conflict-badge">Atual</span>
                        <h4>Registro atual</h4>
                      </div>
                      <pre class="fh-conflict-pre">${this.escapeHtml(currentDetails)}</pre>
                    </section>

                    <section class="fh-conflict-side fh-conflict-side-incoming" aria-label="Novo registro">
                      <div class="fh-conflict-side-head">
                        <span class="fh-conflict-badge">Novo</span>
                        <h4>Novo registro</h4>
                      </div>
                      <pre class="fh-conflict-pre">${this.escapeHtml(incomingDetails)}</pre>
                    </section>
                  </div>

                  <div class="fh-conflict-item-actions">
                    <button class="fh-btn fh-btn-ghost" type="button" data-conflict-choice="existing" data-conflict-index="${position}">Manter Atual</button>
                    <button class="fh-btn" type="button" data-conflict-choice="incoming" data-conflict-index="${position}">Usar Novo</button>
                  </div>
                </article>
            `;
        }).join("");
        return new Promise((resolve) => {
            const decisions = new Map();
            let resolved = false;
            let pendingResult;
            const eventsController = new AbortController();
            const { signal } = eventsController;
            const cleanup = () => {
                eventsController.abort();
            };
            const resolveOnce = (value) => {
                if (resolved)
                    return;
                resolved = true;
                cleanup();
                resolve(value);
            };
            const closeDialogAsync = () => {
                window.setTimeout(() => {
                    if (dialog.open)
                        dialog.close();
                }, 0);
            };
            const updateProgress = () => {
                const doneCount = conflicts.length - Array.from(list.querySelectorAll(".fh-conflict-item:not([data-choice])")).length;
                message.textContent = `Foram encontrados ${conflicts.length} conflito(s). Escolha qual versão manter em cada paciente. ${doneCount}/${conflicts.length} resolvido(s).`;
            };
            const markCard = (card, choice) => {
                card.dataset.choice = choice;
                const buttons = Array.from(card.querySelectorAll("button[data-conflict-choice]"));
                buttons.forEach((button) => {
                    const buttonChoice = button.dataset.conflictChoice;
                    button.disabled = true;
                    button.classList.toggle("is-active", buttonChoice === choice);
                });
            };
            const finalizeIfReady = () => {
                if (decisions.size === conflicts.length) {
                    pendingResult = decisions;
                    closeDialogAsync();
                }
            };
            const onListClick = (event) => {
                const rawTarget = event.target;
                const targetElement = rawTarget instanceof Element
                    ? rawTarget
                    : rawTarget instanceof Node
                        ? rawTarget.parentElement
                        : null;
                if (!targetElement)
                    return;
                const button = targetElement.closest("button[data-conflict-choice]");
                if (!button)
                    return;
                const index = Number(button.dataset.conflictIndex);
                const choice = button.dataset.conflictChoice;
                if (!Number.isFinite(index) || !choice)
                    return;
                const card = list.querySelector(`.fh-conflict-item[data-conflict-index="${index}"]`);
                if (!card || decisions.has(index))
                    return;
                decisions.set(index, choice);
                markCard(card, choice);
                updateProgress();
                finalizeIfReady();
            };
            const onExit = () => {
                pendingResult = null;
                closeDialogAsync();
            };
            const onCancel = (event) => {
                event.preventDefault();
                pendingResult = null;
                closeDialogAsync();
            };
            const onClose = () => {
                resolveOnce(pendingResult ?? null);
            };
            list.addEventListener("click", onListClick, { signal });
            exitBtn.addEventListener("click", onExit, { once: true, signal });
            dialog.addEventListener("cancel", onCancel, { signal });
            dialog.addEventListener("close", onClose, { signal });
            if (!dialog.open) {
                dialog.showModal();
            }
            updateProgress();
        });
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
    normalizeRequiredFieldKey(value) {
        const normalized = this.normalizeKey(value);
        if (normalized === "convenio")
            return "convenio";
        if (normalized === "procedimentos" || normalized === "procedimento")
            return "procedimentos";
        return null;
    }
    getRequiredFieldLabel(field) {
        if (field === "convenio")
            return "Convênio";
        return "Procedimentos";
    }
    isMissingRequiredValue(value) {
        const normalized = value?.trim() ?? "";
        return normalized.length === 0;
    }
    parseFieldEntriesFromLine(line) {
        const pattern = /(hor[áa]rio|paciente|celular|conv[eê]nio|status|procedimentos?|fisioterapeuta)\s*:\s*/gi;
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
    collectRequiredFieldIssues(lines) {
        const requiredFields = ["convenio", "procedimentos"];
        const blocks = this.splitImportedLinesByAppointment(lines);
        return blocks
            .map((block, blockIndex) => {
            const values = {};
            let lookupName = "";
            let lookupPhone = "";
            block.forEach((line) => {
                const entries = this.parseFieldEntriesFromLine(line);
                entries.forEach(([label, rawValue]) => {
                    const normalizedLabel = this.normalizeKey(label);
                    const key = this.normalizeRequiredFieldKey(label);
                    if (normalizedLabel === "paciente" && !this.isMissingRequiredValue(rawValue)) {
                        lookupName = rawValue;
                    }
                    if (normalizedLabel === "celular" && !this.isMissingRequiredValue(rawValue)) {
                        lookupPhone = rawValue;
                    }
                    if (!key || this.isMissingRequiredValue(rawValue))
                        return;
                    values[key] = rawValue;
                });
            });
            const missingFields = requiredFields.filter((field) => this.isMissingRequiredValue(values[field]));
            const patientName = this.isMissingRequiredValue(lookupName)
                ? `Registro ${blockIndex + 1}`
                : lookupName;
            return {
                blockIndex,
                patientName,
                missingFields,
                currentValues: values,
                lookupName,
                lookupPhone
            };
        })
            .filter((issue) => issue.missingFields.length > 0);
    }
    askMissingRequiredFieldCorrections(issues) {
        const dialog = document.getElementById("patientConflictDialog");
        const title = document.getElementById("patientConflictTitle");
        const message = document.getElementById("patientConflictMessage");
        const list = document.getElementById("patientConflictList");
        const exitBtn = document.getElementById("exitPatientConflictBtn");
        const confirmBtn = document.getElementById("confirmPatientConflictBtn");
        const autoFillBtn = document.getElementById("autoFillRequiredBtn");
        const procedureSearchDialog = document.getElementById("procedureSearchDialog");
        const procedureSearchInput = document.getElementById("procedureSearchInput");
        const procedureSearchList = document.getElementById("procedureSearchList");
        const procedureSearchCount = document.getElementById("procedureSearchCount");
        const procedureSearchEmpty = document.getElementById("procedureSearchEmpty");
        const closeProcedureSearchBtn = document.getElementById("closeProcedureSearchBtn");
        if (!dialog || !title || !message || !list || !exitBtn || !confirmBtn || !autoFillBtn || !procedureSearchDialog || !procedureSearchInput || !procedureSearchList || !procedureSearchCount || !procedureSearchEmpty || !closeProcedureSearchBtn) {
            return Promise.resolve(null);
        }
        title.textContent = "Correção obrigatória de dados";
        message.textContent = "Foram encontrados campos obrigatórios faltando. Preencha todos para continuar o processamento.";
        exitBtn.textContent = "Cancelar";
        confirmBtn.hidden = false;
        confirmBtn.textContent = "Processar com correções";
        autoFillBtn.hidden = false;
        autoFillBtn.disabled = false;
        autoFillBtn.textContent = "Auto completar";
        const savedPatientsRecords = this.parsePatientsRecords(localStorage.getItem(this.patientsRecordsStorageKey));
        const procedureSuggestions = this.collectProcedureSuggestions(savedPatientsRecords);
        procedureSearchDialog.dataset.issueIndex = "";
        list.innerHTML = issues.map((issue) => {
            const fields = issue.missingFields.map((field) => {
                const label = this.getRequiredFieldLabel(field);
                const value = issue.currentValues[field] ?? "";
                if (field === "procedimentos") {
                    return `
                                                <label class="fh-required-field">
                                                    <span>${this.escapeHtml(label)}</span>
                                                    <div class="fh-required-field-row">
                                                        <input
                                                            class="fh-required-input"
                                                            type="text"
                                                            data-required-field="${field}"
                                                            data-issue-index="${issue.blockIndex}"
                                                            value="${this.escapeHtmlAttr(value)}"
                                                            autocomplete="off"
                                                            required>
                                                        <button
                                                            type="button"
                                                            class="fh-btn fh-btn-ghost fh-required-search-btn"
                                                            data-procedure-search-toggle="${issue.blockIndex}"
                                                            data-hover-description="Busca procedimentos já cadastrados na lista de pacientes.">${procedureSuggestions.length > 0 ? "Procurar registrados" : "Sem registros"}</button>
                                                    </div>
                                                </label>
                                        `;
                }
                return `
                                        <label class="fh-required-field">
                                            <span>${this.escapeHtml(label)}</span>
                                            <input
                                                class="fh-required-input"
                                                type="text"
                                                data-required-field="${field}"
                                                data-issue-index="${issue.blockIndex}"
                                                value="${this.escapeHtmlAttr(value)}"
                                                autocomplete="off"
                                                required>
                                        </label>
                                `;
            }).join("");
            return `
                <article class="fh-conflict-item fh-required-item" data-issue-index="${issue.blockIndex}">
                  <header class="fh-conflict-item-head">
                    <div class="fh-conflict-item-head-top">
                      <span class="fh-conflict-badge">Obrigatório</span>
                      <h4 class="fh-conflict-item-name">${this.escapeHtml(issue.patientName)}</h4>
                    </div>
                    <p class="fh-conflict-item-index">Campos faltando: ${issue.missingFields.length}</p>
                  </header>

                  <div class="fh-required-fields-grid">
                    ${fields}
                  </div>
                </article>
            `;
        }).join("");
        return new Promise((resolve) => {
            const corrections = new Map();
            let resolved = false;
            let pendingResult;
            const eventsController = new AbortController();
            const { signal } = eventsController;
            const cleanup = () => {
                eventsController.abort();
            };
            const resolveOnce = (value) => {
                if (resolved)
                    return;
                resolved = true;
                cleanup();
                resolve(value);
            };
            const closeDialogAsync = () => {
                window.setTimeout(() => {
                    if (procedureSearchDialog.open) {
                        procedureSearchDialog.close();
                    }
                    if (dialog.open)
                        dialog.close();
                }, 0);
            };
            const allInputs = () => {
                return Array.from(list.querySelectorAll("input[data-required-field]"));
            };
            const hasMissingRequiredInputs = () => {
                return allInputs().some((input) => this.isMissingRequiredValue(input.value));
            };
            const updateConfirmState = () => {
                confirmBtn.disabled = false;
                confirmBtn.dataset.hasMissingRequiredInputs = hasMissingRequiredInputs() ? "true" : "false";
            };
            const findRecordForIssue = (issue, records) => {
                const patientName = issue.lookupName.trim();
                const patientPhone = issue.lookupPhone.replace(/\D/g, "");
                if (patientName.length > 0 && patientPhone.length > 0) {
                    const normalizedName = this.normalizeKey(patientName);
                    const withFullMatch = records.find((record) => {
                        return this.normalizeKey(record.nome) === normalizedName
                            && record.celular.replace(/\D/g, "") === patientPhone;
                    });
                    if (withFullMatch)
                        return withFullMatch;
                }
                if (patientName.length > 0) {
                    const normalizedName = this.normalizeKey(patientName);
                    const withName = records.find((record) => this.normalizeKey(record.nome) === normalizedName);
                    if (withName)
                        return withName;
                }
                if (patientPhone.length > 0) {
                    const withPhone = records.find((record) => record.celular.replace(/\D/g, "") === patientPhone);
                    if (withPhone)
                        return withPhone;
                }
                return null;
            };
            const getRecordValueByField = (record, field) => {
                if (field === "convenio")
                    return record.convenio;
                return record.procedimentos;
            };
            const getFilteredProcedureSuggestions = (query) => {
                const normalizedQuery = this.normalizeKey(query);
                if (!normalizedQuery) {
                    return procedureSuggestions;
                }
                return procedureSuggestions.filter((procedure) => this.normalizeKey(procedure).includes(normalizedQuery));
            };
            const renderProcedureSearchResults = () => {
                const query = procedureSearchInput.value;
                const filteredSuggestions = getFilteredProcedureSuggestions(query);
                procedureSearchCount.textContent = procedureSuggestions.length === 0
                    ? "Nenhum procedimento foi encontrado na Lista de Pacientes."
                    : `${filteredSuggestions.length} de ${procedureSuggestions.length} procedimento(s) encontrados`;
                if (procedureSuggestions.length === 0) {
                    procedureSearchList.innerHTML = "";
                    procedureSearchEmpty.hidden = false;
                    procedureSearchEmpty.textContent = "Nenhum procedimento cadastrado foi encontrado na lista de pacientes.";
                    return;
                }
                if (filteredSuggestions.length === 0) {
                    procedureSearchList.innerHTML = "";
                    procedureSearchEmpty.hidden = false;
                    procedureSearchEmpty.textContent = "Nenhum procedimento corresponde à busca atual.";
                    return;
                }
                procedureSearchEmpty.hidden = true;
                procedureSearchList.innerHTML = filteredSuggestions.map((procedure) => `
                    <button
                        type="button"
                        class="fh-btn fh-btn-ghost fh-procedure-option"
                        data-procedure-choice="${this.escapeHtmlAttr(procedure)}">
                        ${this.escapeHtml(procedure)}
                    </button>
                `).join("");
            };
            const openProcedureSearchDialog = (issueIndex) => {
                if (procedureSearchDialog.open) {
                    procedureSearchDialog.close();
                }
                procedureSearchDialog.dataset.issueIndex = String(issueIndex);
                procedureSearchInput.value = "";
                procedureSearchInput.disabled = procedureSuggestions.length === 0;
                renderProcedureSearchResults();
                if (!procedureSearchDialog.open) {
                    procedureSearchDialog.showModal();
                }
                window.setTimeout(() => {
                    procedureSearchInput.focus();
                    procedureSearchInput.select();
                }, 0);
            };
            const closeProcedureSearchDialog = () => {
                if (procedureSearchDialog.open) {
                    procedureSearchDialog.close();
                }
            };
            const onInput = () => {
                updateConfirmState();
            };
            const onAutoProcess = () => {
                if (savedPatientsRecords.length === 0) {
                    this.showSiteNotification("Não há pacientes salvos para auto completar os campos obrigatórios.");
                    return;
                }
                let autoFilledCount = 0;
                issues.forEach((issue) => {
                    const record = findRecordForIssue(issue, savedPatientsRecords);
                    if (!record)
                        return;
                    const issueInputs = Array.from(list.querySelectorAll(`input[data-issue-index="${issue.blockIndex}"]`));
                    issueInputs.forEach((input) => {
                        const field = input.dataset.requiredField;
                        if (!field || !this.isMissingRequiredValue(input.value))
                            return;
                        const value = getRecordValueByField(record, field).trim();
                        if (this.isMissingRequiredValue(value))
                            return;
                        input.value = value;
                        autoFilledCount += 1;
                    });
                });
                if (autoFilledCount === 0) {
                    this.showSiteNotification("Não foi possível auto completar os campos com base na lista de pacientes.");
                }
                else {
                    this.showSiteNotification(`${autoFilledCount} campo(s) obrigatorio(s) foram preenchidos automaticamente.`);
                }
                updateConfirmState();
            };
            const onListClick = (event) => {
                const rawTarget = event.target;
                const targetElement = rawTarget instanceof Element
                    ? rawTarget
                    : rawTarget instanceof Node
                        ? rawTarget.parentElement
                        : null;
                if (!targetElement)
                    return;
                const searchButton = targetElement.closest("button[data-procedure-search-toggle]");
                if (searchButton) {
                    const issueIndex = Number(searchButton.dataset.procedureSearchToggle ?? "");
                    if (!Number.isFinite(issueIndex))
                        return;
                    openProcedureSearchDialog(issueIndex);
                    return;
                }
            };
            const onProcedureSearchInput = () => {
                renderProcedureSearchResults();
            };
            const onProcedureSearchListClick = (event) => {
                const rawTarget = event.target;
                const targetElement = rawTarget instanceof Element
                    ? rawTarget
                    : rawTarget instanceof Node
                        ? rawTarget.parentElement
                        : null;
                if (!targetElement)
                    return;
                const choiceButton = targetElement.closest("button[data-procedure-choice]");
                if (!choiceButton)
                    return;
                const issueIndex = Number(procedureSearchDialog.dataset.issueIndex ?? "");
                const procedure = choiceButton.dataset.procedureChoice?.trim() ?? "";
                if (!Number.isFinite(issueIndex) || this.isMissingRequiredValue(procedure))
                    return;
                const input = list.querySelector(`input[data-issue-index="${issueIndex}"][data-required-field="procedimentos"]`);
                if (!input)
                    return;
                input.value = procedure;
                this.showSiteNotification("Procedimento registrado aplicado ao campo de correção.");
                updateConfirmState();
                closeProcedureSearchDialog();
            };
            const onProcedureSearchClose = () => {
                procedureSearchDialog.dataset.issueIndex = "";
            };
            const onProcedureSearchCancel = (event) => {
                event.preventDefault();
                closeProcedureSearchDialog();
            };
            const onConfirm = () => {
                if (hasMissingRequiredInputs()) {
                    this.showSiteNotification("Ainda faltam campos obrigatórios para preencher.");
                    updateConfirmState();
                    return;
                }
                corrections.clear();
                issues.forEach((issue) => {
                    const issueInputs = Array.from(list.querySelectorAll(`input[data-issue-index="${issue.blockIndex}"]`));
                    const values = {};
                    issueInputs.forEach((input) => {
                        const field = input.dataset.requiredField;
                        if (!field)
                            return;
                        values[field] = input.value.trim();
                    });
                    corrections.set(issue.blockIndex, values);
                });
                pendingResult = corrections;
                closeDialogAsync();
            };
            const onExit = () => {
                pendingResult = null;
                closeDialogAsync();
            };
            const onCancel = (event) => {
                event.preventDefault();
                pendingResult = null;
                closeDialogAsync();
            };
            const onClose = () => {
                resolveOnce(pendingResult ?? null);
            };
            list.addEventListener("click", onListClick, { signal });
            list.addEventListener("input", onInput, { signal });
            procedureSearchInput.addEventListener("input", onProcedureSearchInput, { signal });
            procedureSearchList.addEventListener("click", onProcedureSearchListClick, { signal });
            closeProcedureSearchBtn.addEventListener("click", closeProcedureSearchDialog, { signal });
            confirmBtn.addEventListener("click", onConfirm, { signal });
            autoFillBtn.addEventListener("click", onAutoProcess, { signal });
            exitBtn.addEventListener("click", onExit, { once: true, signal });
            procedureSearchDialog.addEventListener("cancel", onProcedureSearchCancel, { signal });
            procedureSearchDialog.addEventListener("close", onProcedureSearchClose, { signal });
            dialog.addEventListener("cancel", onCancel, { signal });
            dialog.addEventListener("close", onClose, { signal });
            procedureSearchDialog.addEventListener("click", (event) => {
                if (event.target === procedureSearchDialog) {
                    closeProcedureSearchDialog();
                }
            }, { signal });
            if (!dialog.open) {
                dialog.showModal();
            }
            updateConfirmState();
        });
    }
    applyRequiredFieldCorrections(lines, issues, corrections) {
        const blocks = this.splitImportedLinesByAppointment(lines);
        issues.forEach((issue) => {
            const block = blocks[issue.blockIndex];
            const data = corrections.get(issue.blockIndex);
            if (!block || !data)
                return;
            issue.missingFields.forEach((field) => {
                const correctedValue = data[field]?.trim() ?? "";
                if (this.isMissingRequiredValue(correctedValue))
                    return;
                const label = this.getRequiredFieldLabel(field);
                let updated = false;
                for (let index = 0; index < block.length; index += 1) {
                    const entry = block[index].match(/^([^:]+):\s*(.*)$/);
                    if (!entry)
                        continue;
                    if (this.normalizeRequiredFieldKey(entry[1]) === field) {
                        block[index] = `${label}: ${correctedValue}`;
                        updated = true;
                        break;
                    }
                }
                if (!updated) {
                    block.push(`${label}: ${correctedValue}`);
                }
            });
        });
        return blocks.flat();
    }
    describeConflictDiff(existing, incoming) {
        const fields = [
            ["statusFinanceiro", "Status financeiro"],
            ["horario", "Horário"],
            ["fisioterapeuta", "Fisioterapeuta"],
            ["celular", "Celular"],
            ["convenio", "Convênio"],
            ["procedimentos", "Procedimentos"]
        ];
        const diffLines = fields
            .filter(([key]) => existing[key] !== incoming[key])
            .map(([key, label]) => {
            const existingValue = this.getConflictValue(existing, key);
            const incomingValue = this.getConflictValue(incoming, key);
            return `${label}\nAtual: ${existingValue}\nNovo: ${incomingValue}`;
        });
        return diffLines.length > 0 ? diffLines.join("\n\n") : "Sem diferenças relevantes.";
    }
    getConflictDiffFields(existing, incoming) {
        const fields = [
            ["statusFinanceiro", "Status financeiro"],
            ["horario", "Horário"],
            ["fisioterapeuta", "Fisioterapeuta"],
            ["celular", "Celular"],
            ["convenio", "Convênio"],
            ["procedimentos", "Procedimentos"]
        ];
        return fields.filter(([key]) => existing[key] !== incoming[key]);
    }
    describeConflictSide(record, fields) {
        if (fields.length === 0) {
            return "Sem diferenças relevantes.";
        }
        return fields
            .map(([key, label]) => `${label}: ${this.getConflictValue(record, key)}`)
            .join("\n");
    }
    getConflictValue(record, key) {
        const value = record[key];
        return typeof value === "string" ? value : "-";
    }
    escapeHtml(value) {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    escapeHtmlAttr(value) {
        return this.escapeHtml(value);
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
    collectProcedureSuggestions(records) {
        const uniqueProcedures = new Map();
        records.forEach((record) => {
            const procedure = this.sanitizeProcedimentosValue(record.procedimentos).trim();
            if (!procedure || procedure === "-") {
                return;
            }
            const key = this.normalizeKey(procedure);
            if (!uniqueProcedures.has(key)) {
                uniqueProcedures.set(key, procedure);
            }
        });
        return Array.from(uniqueProcedures.values()).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
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
    toIso(date) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }
    todayIso() {
        return this.toIso(new Date());
    }
    formatDateForToast(value) {
        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return new Intl.DateTimeFormat("pt-BR").format(date);
    }
    renderImportedData() {
        const editor = document.getElementById("importedDataEditor");
        if (!editor)
            return;
        editor.value = this.importedItems.map((item) => item.raw).join("\n");
    }
    syncImportedDataFromEditor(content) {
        const lines = content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
        this.importedItems = lines.map((line) => ({
            id: this.nextItemId++,
            raw: line,
            dateIso: this.extractIsoDate(line) ?? this.getCurrentDate()
        }));
        this.saveStagingDataToStorage();
    }
    saveStagingDataToStorage() {
        const serialized = this.importedItems.map((item) => item.raw).join("\n");
        localStorage.setItem(this.stagingDataStorageKey, serialized);
    }
    loadStagingDataFromStorage() {
        const staged = localStorage.getItem(this.stagingDataStorageKey);
        if (!staged || !staged.trim()) {
            this.importedItems = [];
            return;
        }
        const lines = staged
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
        this.importedItems = lines.map((line) => ({
            id: this.nextItemId++,
            raw: line,
            dateIso: this.extractIsoDate(line) ?? this.getCurrentDate()
        }));
    }
    parsePatientsRecords(raw) {
        if (!raw)
            return [];
        try {
            const parsed = JSON.parse(raw);
            return this.toSafePatientsRecords(parsed);
        }
        catch {
            return [];
        }
    }
    parseProcessedMeta(raw) {
        if (!raw)
            return this.toSafeProcessedMeta(undefined);
        try {
            const parsed = JSON.parse(raw);
            return this.toSafeProcessedMeta(parsed);
        }
        catch {
            return this.toSafeProcessedMeta(undefined);
        }
    }
    toSafeText(value) {
        return typeof value === "string" ? value : "";
    }
    toSafeProcessedMeta(value) {
        return {
            processedAtIso: typeof value?.processedAtIso === "string" ? value.processedAtIso : new Date().toISOString(),
            referenceDateIso: typeof value?.referenceDateIso === "string" ? value.referenceDateIso : this.todayIso(),
            totalImportedLines: Number.isFinite(value?.totalImportedLines) ? Number(value?.totalImportedLines) : 0,
            totalPatients: Number.isFinite(value?.totalPatients) ? Number(value?.totalPatients) : 0,
            totalForReferenceDate: Number.isFinite(value?.totalForReferenceDate) ? Number(value?.totalForReferenceDate) : 0
        };
    }
    toSafePatientsRecords(value) {
        if (!Array.isArray(value))
            return [];
        return value.map((item) => {
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
    startFloatingHomeHint() {
        sharedStartFloatingHomeHint();
    }
    showSiteNotification(message) {
        sharedShowSiteNotification(message);
    }
}
//# sourceMappingURL=home-controller.js.map