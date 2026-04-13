import { ThemeManager } from "../4.1_Core/theme-manager.js";
import { FISIOHUB_RUNTIME_KEYS, FISIOHUB_STORAGE_KEYS, type BackupPayload, type EvolucoesPendingBatch, type PatientRecord, type ProcessedMeta } from "../4.0_Shared/fisiohub-models.js";
import { buildPatientChangeHistoryEntries, buildPatientRecordKey, mergePatientChangeHistory, parsePatientChangeHistory } from "../4.0_Shared/patient-history.js";
import { bindAnalysisDialog, bindFisioHubStorageListener, bindHoverToasts as sharedBindHoverToasts, bindTermsDialog, showSiteNotification as sharedShowSiteNotification, startFloatingHomeHint as sharedStartFloatingHomeHint, syncFooterMetadata } from "../4.0_Shared/ui-feedback.js";

type ImportedItem = {
    id: number;
    raw: string;
    dateIso: string | null;
};

type PatientConflict = {
    index: number;
    dialogIndex: number;
    existing: PatientRecord;
    incoming: PatientRecord;
};

type ConflictChoice = "existing" | "incoming";

type BackupFileSelection = {
    payloads: Array<Partial<BackupPayload>>;
    invalidCount: number;
};

type RequiredFieldKey = "convenio" | "procedimentos";

type RequiredFieldIssue = {
    blockIndex: number;
    patientName: string;
    missingFields: RequiredFieldKey[];
    currentValues: Partial<Record<RequiredFieldKey, string>>;
    lookupName: string;
    lookupPhone: string;
};

export class HomeController {
    private readonly appId = "app";
    private readonly homeTemplate = "1.0_HTML-Templates/1.1_Pages/home.html";
    private readonly stagingDataStorageKey = FISIOHUB_STORAGE_KEYS.STAGING_DATA;
    private readonly processedDataStorageKey = FISIOHUB_STORAGE_KEYS.PROCESSED_DATA;
    private readonly evolucoesPendingHistoryStorageKey = FISIOHUB_STORAGE_KEYS.EVOLUCOES_PENDING_HISTORY;
    private readonly doneEvolutionsStorageKey = FISIOHUB_STORAGE_KEYS.DONE_EVOLUTIONS;
    private readonly patientsRecordsStorageKey = FISIOHUB_STORAGE_KEYS.PATIENTS_RECORDS;
    private readonly processedMetaStorageKey = FISIOHUB_STORAGE_KEYS.PROCESSED_META;
    private readonly theme = new ThemeManager();
    private importedItems: ImportedItem[] = [];
    private nextItemId = 1;

    async bootstrap(): Promise<void> {
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
        const cleanup = (): void => {
            stopFloatingHomeHint();
            disposeStorageListener();
        };

        window.addEventListener("beforeunload", cleanup, { once: true });
    }

    private async loadHome(): Promise<void> {
        const app = document.getElementById(this.appId);
        if (!app) return;
        const html = await fetch(this.homeTemplate).then((r) => r.text());
        app.innerHTML = html;
    }

    private async resolveIncludes(): Promise<void> {
        let nodes = Array.from(document.querySelectorAll("[data-include]"));

        while (nodes.length > 0) {
            for (const node of nodes) {
                const path = node.getAttribute("data-include");
                if (!path) continue;

                const html = await fetch(path).then((r) => r.text());
                node.outerHTML = html;
            }

            nodes = Array.from(document.querySelectorAll("[data-include]"));
        }
    }

    private bindHandlers(): void {
        const modules = Array.from(document.querySelectorAll(".fh-module-card")) as HTMLButtonElement[];
        modules.forEach((btn: HTMLButtonElement) => {
            btn.addEventListener("click", () => {
                const target = btn.getAttribute("data-target");
                if (!target) return;
                window.location.href = target;
            });
        });

        const importBtn = document.getElementById("importBtn");
        const fileInput = document.getElementById("importFileInput") as HTMLInputElement | null;
        importBtn?.addEventListener("click", () => fileInput?.click());
        fileInput?.addEventListener("change", async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
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

        const importedDataEditor = document.getElementById("importedDataEditor") as HTMLTextAreaElement | null;
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

        const backupsDialog = document.getElementById("backupsDialog") as HTMLDialogElement | null;
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

    private getDateInput(): HTMLInputElement | null {
        return document.getElementById("refDate") as HTMLInputElement | null;
    }

    private getCurrentDate(): string {
        const dateInput = this.getDateInput();
        return dateInput?.value || this.getStoredReferenceDate() || this.todayIso();
    }

    private setDate(value: string): void {
        const dateInput = this.getDateInput();
        if (!dateInput) return;
        dateInput.value = value;
        this.persistReferenceDate(value);
    }

    private getStoredReferenceDate(): string | null {
        const stored = localStorage.getItem(FISIOHUB_STORAGE_KEYS.REFERENCE_DATE);
        if (!stored) return null;

        const date = new Date(`${stored}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return stored;
    }

    private persistReferenceDate(value: string): void {
        const parsed = new Date(`${value}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) {
            return;
        }

        const normalized = this.toIso(parsed);
        localStorage.setItem(FISIOHUB_STORAGE_KEYS.REFERENCE_DATE, normalized);
    }

    private moveDateByDays(days: number): void {
        const current = new Date(`${this.getCurrentDate()}T00:00:00`);
        current.setDate(current.getDate() + days);
        this.setDate(this.toIso(current));
        this.renderImportedData();
    }

    private moveMonthStart(monthShift: number): void {
        const current = new Date(`${this.getCurrentDate()}T00:00:00`);
        current.setMonth(current.getMonth() + monthShift, 1);
        this.setDate(this.toIso(current));
        this.renderImportedData();
    }

    private async processAndPersistData(): Promise<void> {
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

        const processedMeta: ProcessedMeta = {
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

    private saveStagingContent(content: string): void {
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

    private exportBackup(kind: BackupPayload["kind"]): void {
        const payload: BackupPayload = {
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

    private async importBackup(kind: BackupPayload["kind"]): Promise<void> {
        const selection = await this.pickBackupFiles();
        if (!selection) {
            this.showSiteNotification("Importação cancelada.");
            return;
        }

        const entriesToApply = this.collectMergedBackupStorageEntriesFromPayloads(selection.payloads, kind);

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
            : this.resolveBackupReferenceDateFromMergedPayloads(selection.payloads, entriesToApply);

        if (referenceDateIso) {
            this.setDate(referenceDateIso);
        }

        this.loadStagingDataFromStorage();
        this.renderImportedData();
        this.showSiteNotification(selection.invalidCount > 0
            ? `${selection.payloads.length} arquivo(s) de backup importado(s). ${selection.invalidCount} arquivo(s) inválido(s) foram ignorados.`
            : `${selection.payloads.length} arquivo(s) de backup importado(s) com sucesso.`);
    }

    private clearAllStoredData(): void {
        this.clearAllFisioHubStorage();
        this.setPatientsFallbackSuppressed(false);
        this.setFinanceFallbackSuppressed(false);

        this.importedItems = [];
        this.nextItemId = 1;
        this.setDate(this.todayIso());
        this.renderImportedData();
        this.showSiteNotification("Todos os dados locais foram limpos.");
    }

    private ensureClearOnlyDataButton(): HTMLButtonElement | null {
        const existing = document.getElementById("clearOnlyDataBtn") as HTMLButtonElement | null;
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
        } else {
            panelActions.appendChild(button);
        }

        return button;
    }

    private clearImportedDataOnly(): void {
        this.importedItems = [];
        this.nextItemId = 1;
        localStorage.removeItem(this.stagingDataStorageKey);
        this.renderImportedData();
        this.showSiteNotification("O texto da lista de dados importados foi limpo.");
    }

    private clearOnlyPageDataPreservingPatientsList(): void {
        this.clearAllFisioHubStorage([this.patientsRecordsStorageKey]);
        this.setPatientsFallbackSuppressed(false);
        this.setFinanceFallbackSuppressed(true);

        this.importedItems = [];
        this.nextItemId = 1;
        this.setDate(this.todayIso());
        this.renderImportedData();
        this.showSiteNotification("Os dados das páginas foram limpos. A Lista de Pacientes foi preservada.");
    }

    private appendEvolucoesPendingBatch(batch: EvolucoesPendingBatch): void {
        const history = this.readEvolucoesPendingHistory();
        history.push({
            processedAtIso: batch.processedAtIso,
            referenceDateIso: batch.referenceDateIso,
            lines: batch.lines.filter((line) => line.trim().length > 0)
        });

        localStorage.setItem(this.evolucoesPendingHistoryStorageKey, JSON.stringify(history));
    }

    private readEvolucoesPendingHistory(): EvolucoesPendingBatch[] {
        const raw = localStorage.getItem(this.evolucoesPendingHistoryStorageKey);
        if (!raw) return [];

        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];

            return parsed
                .map((entry) => {
                    const candidate = entry as Partial<EvolucoesPendingBatch>;
                    const lines = Array.isArray(candidate.lines)
                        ? candidate.lines.filter((line): line is string => typeof line === "string")
                        : [];

                    return {
                        processedAtIso: typeof candidate.processedAtIso === "string" ? candidate.processedAtIso : new Date().toISOString(),
                        referenceDateIso: typeof candidate.referenceDateIso === "string" ? candidate.referenceDateIso : this.todayIso(),
                        lines
                    };
                })
                .filter((entry) => entry.lines.length > 0);
        } catch {
            return [];
        }
    }

    private hasAlreadyProcessedDate(referenceDateIso: string): boolean {
        const currentMeta = this.parseProcessedMeta(localStorage.getItem(this.processedMetaStorageKey));
        const hasCurrentMeta = currentMeta.referenceDateIso === referenceDateIso
            && (localStorage.getItem(this.processedDataStorageKey) ?? "").trim().length > 0;

        if (hasCurrentMeta) {
            return true;
        }

        return this.readEvolucoesPendingHistory().some((batch) => batch.referenceDateIso === referenceDateIso);
    }

    private clearAllFisioHubStorage(excludedKeys: string[] = []): void {
        const excluded = new Set(excludedKeys);
        const keysToRemove: string[] = [];

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key && key.startsWith("fisiohub-") && !excluded.has(key)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach((key) => localStorage.removeItem(key));
    }

    private collectBackupStorageEntries(kind: BackupPayload["kind"]): Record<string, string> {
        const entries: Record<string, string> = {};
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

    private collectBackupStorageEntriesFromPayload(payload: Partial<BackupPayload>): Record<string, string> {
        if (payload.storageEntries && typeof payload.storageEntries === "object" && !Array.isArray(payload.storageEntries)) {
            const entries: Record<string, string> = {};

            Object.entries(payload.storageEntries).forEach(([key, value]) => {
                if (typeof value === "string") {
                    entries[key] = value;
                }
            });

            return entries;
        }

        const entries: Record<string, string> = {};

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

    private filterBackupStorageEntriesByKind(entries: Record<string, string>, kind: BackupPayload["kind"]): Record<string, string> {
        const filteredEntries: Record<string, string> = {};

        Object.entries(entries).forEach(([key, value]) => {
            if (key === FISIOHUB_RUNTIME_KEYS.PATIENTS_FALLBACK_SUPPRESSED || key === FISIOHUB_RUNTIME_KEYS.FINANCE_FALLBACK_SUPPRESSED) {
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

    private applyBackupStorageEntries(entries: Record<string, string>): void {
        Object.entries(entries).forEach(([key, value]) => {
            localStorage.setItem(key, value);
        });
    }

    private collectMergedBackupStorageEntriesFromPayloads(payloads: Array<Partial<BackupPayload>>, kind: BackupPayload["kind"]): Record<string, string> {
        const mergedEntries: Record<string, string> = {};

        payloads.forEach((payload) => {
            const backupEntries = this.collectBackupStorageEntriesFromPayload(payload);
            const entriesToApply = this.filterBackupStorageEntriesByKind(backupEntries, kind);

            Object.entries(entriesToApply).forEach(([key, value]) => {
                if (key === this.processedMetaStorageKey || key === FISIOHUB_STORAGE_KEYS.REFERENCE_DATE) {
                    return;
                }

                const currentValue = mergedEntries[key];
                mergedEntries[key] = this.mergeBackupStorageEntryValue(key, currentValue, value);
            });
        });

        if (kind !== "patients-only") {
            const referenceDateIso = this.resolveBackupReferenceDateFromMergedPayloads(payloads, mergedEntries);
            if (referenceDateIso) {
                mergedEntries[FISIOHUB_STORAGE_KEYS.REFERENCE_DATE] = referenceDateIso;
            }

            const processedMeta = this.buildMergedProcessedMeta(payloads, mergedEntries, referenceDateIso);
            if (processedMeta) {
                mergedEntries[this.processedMetaStorageKey] = JSON.stringify(processedMeta);
            }
        }

        return mergedEntries;
    }

    private mergeBackupStorageEntryValue(key: string, currentValue: string | undefined, incomingValue: string): string {
        if (key === this.patientsRecordsStorageKey) {
            return this.mergeBackupPatientsRecordsValue(currentValue, incomingValue);
        }

        if (key === this.stagingDataStorageKey || key === this.processedDataStorageKey) {
            return this.mergeBackupTextValue(currentValue, incomingValue);
        }

        if (key === this.evolucoesPendingHistoryStorageKey) {
            return this.mergeBackupPendingHistoryValue(currentValue, incomingValue);
        }

        if (key === this.doneEvolutionsStorageKey) {
            return this.mergeBackupDoneEvolutionsValue(currentValue, incomingValue);
        }

        if (!currentValue || currentValue.trim().length === 0) {
            return incomingValue;
        }

        if (incomingValue.trim().length === 0) {
            return currentValue;
        }

        return incomingValue;
    }

    private mergeBackupTextValue(currentValue: string | undefined, incomingValue: string): string {
        const mergedLines = this.uniqueValues([
            ...this.parseContent(currentValue ?? ""),
            ...this.parseContent(incomingValue)
        ]);

        return mergedLines.join("\n");
    }

    private mergeBackupPatientsRecordsValue(currentValue: string | undefined, incomingValue: string): string {
        const records = [
            ...this.parsePatientsRecords(currentValue ?? null),
            ...this.parsePatientsRecords(incomingValue)
        ];

        return JSON.stringify(this.mergePatientRecordsForBackup(records));
    }

    private mergeBackupDoneEvolutionsValue(currentValue: string | undefined, incomingValue: string): string {
        const merged = this.uniqueValues([
            ...this.parseBackupStringList(currentValue),
            ...this.parseBackupStringList(incomingValue)
        ]);

        return JSON.stringify(merged);
    }

    private mergeBackupPendingHistoryValue(currentValue: string | undefined, incomingValue: string): string {
        const batches = [
            ...this.parseBackupPendingHistory(currentValue),
            ...this.parseBackupPendingHistory(incomingValue)
        ];

        const grouped = new Map<string, EvolucoesPendingBatch>();

        batches.forEach((batch) => {
            const referenceDateIso = this.extractIsoDate(batch.referenceDateIso) ?? this.todayIso();
            const existing = grouped.get(referenceDateIso);

            if (!existing) {
                grouped.set(referenceDateIso, {
                    processedAtIso: batch.processedAtIso,
                    referenceDateIso,
                    lines: [...batch.lines]
                });
                return;
            }

            existing.processedAtIso = this.selectLatestIsoTimestamp([existing.processedAtIso, batch.processedAtIso]) ?? existing.processedAtIso;
            existing.lines = this.uniqueValues([...existing.lines, ...batch.lines]);
        });

        return JSON.stringify(Array.from(grouped.values()).sort((left, right) => left.referenceDateIso.localeCompare(right.referenceDateIso)));
    }

    private parseBackupStringList(value: string | undefined): string[] {
        if (!value || value.trim().length === 0) {
            return [];
        }

        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed
                    .map((item) => typeof item === "string" ? item.trim() : "")
                    .filter((item) => item.length > 0);
            }
        } catch {
            // Fallback para texto simples.
        }

        return value
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    }

    private parseBackupPendingHistory(value: string | undefined): EvolucoesPendingBatch[] {
        if (!value || value.trim().length === 0) {
            return [];
        }

        try {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed
                .map((entry) => {
                    const candidate = entry as Partial<EvolucoesPendingBatch>;
                    const lines = Array.isArray(candidate.lines)
                        ? candidate.lines.filter((line): line is string => typeof line === "string").map((line) => line.trim()).filter((line) => line.length > 0)
                        : [];

                    if (lines.length === 0) {
                        return null;
                    }

                    return {
                        processedAtIso: typeof candidate.processedAtIso === "string" && candidate.processedAtIso.trim().length > 0
                            ? candidate.processedAtIso.trim()
                            : new Date().toISOString(),
                        referenceDateIso: this.extractIsoDate(typeof candidate.referenceDateIso === "string" ? candidate.referenceDateIso : "") ?? this.todayIso(),
                        lines
                    };
                })
                .filter((entry): entry is EvolucoesPendingBatch => entry !== null);
        } catch {
            return [];
        }
    }

    private mergePatientRecordsForBackup(records: PatientRecord[]): PatientRecord[] {
        const groups = new Map<string, PatientRecord[]>();

        records.forEach((record) => {
            const key = this.normalizePatientKey(record);
            const bucket = groups.get(key) ?? [];
            bucket.push(record);
            groups.set(key, bucket);
        });

        return Array.from(groups.values())
            .map((groupRecords) => this.mergePatientRecordGroupForBackup(groupRecords))
            .filter((record) => record.nome.trim().length > 0)
            .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR", { sensitivity: "base" }));
    }

    private mergePatientRecordGroupForBackup(records: PatientRecord[]): PatientRecord {
        const orderedRecords = [...records].sort((left, right) => {
            const updatedComparison = left.updatedAtIso.localeCompare(right.updatedAtIso);
            if (updatedComparison !== 0) {
                return updatedComparison;
            }

            const createdComparison = left.createdAtIso.localeCompare(right.createdAtIso);
            if (createdComparison !== 0) {
                return createdComparison;
            }

            return left.nome.localeCompare(right.nome, "pt-BR", { sensitivity: "base" });
        });

        let merged = orderedRecords[0];

        if (!merged) {
            return {
                nome: "",
                statusFinanceiro: "Pagante",
                horario: "-",
                fisioterapeuta: "-",
                celular: "-",
                convenio: "-",
                procedimentos: "-",
                createdAtIso: new Date().toISOString(),
                updatedAtIso: new Date().toISOString()
            };
        }

        for (const nextRecord of orderedRecords.slice(1)) {
            const next = this.toSafeBackupPatientRecord(nextRecord);
            const effectiveNext: PatientRecord = {
                nome: this.chooseBackupPatientFieldValue(merged.nome, next.nome),
                statusFinanceiro: next.statusFinanceiro,
                horario: this.chooseBackupPatientFieldValue(merged.horario, next.horario),
                fisioterapeuta: this.chooseBackupPatientFieldValue(merged.fisioterapeuta, next.fisioterapeuta),
                celular: this.chooseBackupPatientFieldValue(merged.celular, next.celular),
                convenio: this.chooseBackupPatientFieldValue(merged.convenio, next.convenio),
                procedimentos: this.chooseBackupPatientFieldValue(merged.procedimentos, next.procedimentos),
                createdAtIso: this.selectEarliestIsoTimestamp([merged.createdAtIso, next.createdAtIso]) ?? merged.createdAtIso,
                updatedAtIso: this.selectLatestIsoTimestamp([merged.updatedAtIso, next.updatedAtIso]) ?? next.updatedAtIso,
                ...(merged.changeHistory ? { changeHistory: merged.changeHistory } : {})
            };

            const referenceDateIso = this.extractIsoDate(effectiveNext.updatedAtIso) ?? this.todayIso();
            const historyEntries = buildPatientChangeHistoryEntries(merged, effectiveNext, referenceDateIso);
            const changeHistory = mergePatientChangeHistory(merged.changeHistory, next.changeHistory, historyEntries);

            merged = {
                ...effectiveNext,
                ...(changeHistory.length > 0 ? { changeHistory } : {})
            };
        }

        return merged;
    }

    private toSafeBackupPatientRecord(record: PatientRecord): PatientRecord {
        return {
            ...record,
            nome: record.nome.trim(),
            horario: record.horario.trim() || "-",
            fisioterapeuta: record.fisioterapeuta.trim() || "-",
            celular: record.celular.trim() || "-",
            convenio: record.convenio.trim() || "-",
            procedimentos: this.sanitizeProcedimentosValue(record.procedimentos),
            createdAtIso: record.createdAtIso.trim() || new Date().toISOString(),
            updatedAtIso: record.updatedAtIso.trim() || new Date().toISOString()
        };
    }

    private chooseBackupPatientFieldValue(currentValue: string, incomingValue: string): string {
        const normalized = incomingValue.trim();
        if (normalized.length === 0 || normalized === "-") {
            return currentValue;
        }

        return normalized;
    }

    private resolveBackupReferenceDateFromMergedPayloads(payloads: Array<Partial<BackupPayload>>, entries: Record<string, string>): string | null {
        const candidates = [
            entries[FISIOHUB_STORAGE_KEYS.REFERENCE_DATE],
            ...payloads.flatMap((payload) => this.collectBackupReferenceDateCandidates(payload))
        ];

        return this.selectLatestIsoDate(candidates);
    }

    private collectBackupReferenceDateCandidates(payload: Partial<BackupPayload>): string[] {
        const candidates: string[] = [];
        const storageEntries = payload.storageEntries;

        if (storageEntries && typeof storageEntries === "object" && !Array.isArray(storageEntries)) {
            const storageReferenceDate = storageEntries[FISIOHUB_STORAGE_KEYS.REFERENCE_DATE];
            if (typeof storageReferenceDate === "string" && storageReferenceDate.trim().length > 0) {
                candidates.push(storageReferenceDate);
            }
        }

        if (payload.processedMeta && typeof payload.processedMeta.referenceDateIso === "string" && payload.processedMeta.referenceDateIso.trim().length > 0) {
            candidates.push(payload.processedMeta.referenceDateIso);
        }

        const legacyReferenceDate = (payload as { referenceDateIso?: unknown }).referenceDateIso;
        if (typeof legacyReferenceDate === "string" && legacyReferenceDate.trim().length > 0) {
            candidates.push(legacyReferenceDate);
        }

        return candidates;
    }

    private buildMergedProcessedMeta(
        payloads: Array<Partial<BackupPayload>>,
        entries: Record<string, string>,
        referenceDateIso: string | null
    ): ProcessedMeta | null {
        const sourceText = entries[this.processedDataStorageKey] ?? entries[this.stagingDataStorageKey] ?? "";
        const sourceLines = this.parseContent(sourceText);
        const storedPatients = this.parsePatientsRecords(entries[this.patientsRecordsStorageKey] ?? null);
        const parsedPatients = sourceLines.length > 0 ? this.parsePatientsFromLines(sourceLines) : [];

        if (sourceLines.length === 0 && storedPatients.length === 0 && parsedPatients.length === 0) {
            return null;
        }

        const processedAtIso = this.selectLatestIsoTimestamp([
            ...payloads.map((payload) => typeof payload.processedMeta?.processedAtIso === "string" ? payload.processedMeta.processedAtIso : null),
            new Date().toISOString()
        ]) ?? new Date().toISOString();

        const resolvedReferenceDate = referenceDateIso
            ?? this.selectLatestIsoDate(payloads.flatMap((payload) => this.collectBackupReferenceDateCandidates(payload)))
            ?? this.todayIso();

        const totalPatients = storedPatients.length > 0 ? storedPatients.length : parsedPatients.length;
        const totalForReferenceDate = sourceLines.filter((line) => {
            const extracted = this.extractIsoDate(line);
            return !extracted || extracted === resolvedReferenceDate;
        }).length;

        return {
            processedAtIso,
            referenceDateIso: resolvedReferenceDate,
            totalImportedLines: sourceLines.length,
            totalPatients,
            totalForReferenceDate
        };
    }

    private selectLatestIsoDate(values: Array<string | null | undefined>): string | null {
        const candidates = values
            .map((value) => typeof value === "string" ? this.extractIsoDate(value) ?? value.trim() : "")
            .filter((value) => value.length === 10);

        if (candidates.length === 0) {
            return null;
        }

        return candidates.sort((left, right) => left.localeCompare(right)).at(-1) ?? null;
    }

    private selectLatestIsoTimestamp(values: Array<string | null | undefined>): string | null {
        const candidates = values
            .map((value) => typeof value === "string" ? value.trim() : "")
            .filter((value) => value.length > 0);

        if (candidates.length === 0) {
            return null;
        }

        return candidates.sort((left, right) => left.localeCompare(right)).at(-1) ?? null;
    }

    private selectEarliestIsoTimestamp(values: Array<string | null | undefined>): string | null {
        const candidates = values
            .map((value) => typeof value === "string" ? value.trim() : "")
            .filter((value) => value.length > 0);

        if (candidates.length === 0) {
            return null;
        }

        return candidates.sort((left, right) => left.localeCompare(right))[0] ?? null;
    }

    private uniqueValues(values: string[]): string[] {
        const normalized = new Map<string, string>();

        values.forEach((value) => {
            const trimmed = value.trim();
            if (!trimmed) {
                return;
            }

            const key = this.normalizeKey(trimmed);
            if (!normalized.has(key)) {
                normalized.set(key, trimmed);
            }
        });

        return Array.from(normalized.values());
    }

    private resolveBackupReferenceDate(payload: Partial<BackupPayload>, entries: Record<string, string>): string | null {
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

    private listFisioHubStorageKeys(): string[] {
        const keys: string[] = [];

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key && key !== FISIOHUB_RUNTIME_KEYS.PATIENTS_FALLBACK_SUPPRESSED && key !== FISIOHUB_RUNTIME_KEYS.FINANCE_FALLBACK_SUPPRESSED && key.startsWith("fisiohub-")) {
                keys.push(key);
            }
        }

        return keys.sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
    }

    private setPatientsFallbackSuppressed(suppressed: boolean): void {
        if (suppressed) {
            localStorage.setItem(FISIOHUB_RUNTIME_KEYS.PATIENTS_FALLBACK_SUPPRESSED, "true");
            return;
        }

        localStorage.removeItem(FISIOHUB_RUNTIME_KEYS.PATIENTS_FALLBACK_SUPPRESSED);
    }

    private setFinanceFallbackSuppressed(suppressed: boolean): void {
        if (suppressed) {
            localStorage.setItem(FISIOHUB_RUNTIME_KEYS.FINANCE_FALLBACK_SUPPRESSED, "true");
            return;
        }

        localStorage.removeItem(FISIOHUB_RUNTIME_KEYS.FINANCE_FALLBACK_SUPPRESSED);
    }

    private getBackupFileSlug(kind: BackupPayload["kind"]): string {
        if (kind === "patients-only") {
            return "somente-pacientes";
        }

        if (kind === "all-without-patients") {
            return "sem-pacientes";
        }

        return "completo";
    }

    private async pickBackupFiles(): Promise<BackupFileSelection | null> {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.multiple = true;

        const files = await new Promise<FileList | null>((resolve) => {
            input.addEventListener("change", () => {
                resolve(input.files ?? null);
            }, { once: true });
            input.click();
        });

        if (!files || files.length === 0) {
            return null;
        }

        const payloads: Array<Partial<BackupPayload>> = [];
        let invalidCount = 0;

        for (const file of Array.from(files)) {
            try {
                const raw = await file.text();
                payloads.push(JSON.parse(raw) as Partial<BackupPayload>);
            } catch {
                invalidCount += 1;
            }
        }

        if (payloads.length === 0) {
            this.showSiteNotification("Nenhum arquivo de backup válido foi selecionado.");
            return null;
        }

        return { payloads, invalidCount };
    }

    private parseContent(content: string): string[] {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item));
            }
        } catch {
            // Se nao for JSON valido, segue como texto linha a linha.
        }

        return content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    }

    private parsePatientsFromLines(lines: string[]): PatientRecord[] {
        const records: PatientRecord[] = [];
        let draft = this.createEmptyPatientDraft();
        const nowIso = new Date().toISOString();

        const pushDraft = (): void => {
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

                if (key === "horario") draft.horario = value;
                if (key === "fisioterapeuta") draft.fisioterapeuta = value;
                if (key === "paciente") draft.nome = value;
                if (key === "celular") draft.celular = value;
                if (key === "convenio") draft.convenio = value;
                if (key === "status" || key === "situacao") draft.statusFinanceiro = /isento/i.test(value) ? "Isento" : "Pagante";
                if (key === "procedimentos" || key === "procedimento") draft.procedimentos = this.sanitizeProcedimentosValue(value);
            });
        });

        pushDraft();

        return records.map((record) => ({
            ...record,
            statusFinanceiro: record.statusFinanceiro === "Isento" || this.isIsento(record) ? "Isento" : "Pagante"
        }));
    }

    private createEmptyPatientDraft(): PatientRecord {
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

    private async mergePatientsWithConflictResolution(incomingRecords: PatientRecord[]): Promise<PatientRecord[] | null> {
        const currentRecords = this.parsePatientsRecords(localStorage.getItem(this.patientsRecordsStorageKey));
        const merged = [...currentRecords];
        const conflicts: PatientConflict[] = [];

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
                    const changeHistory = mergePatientChangeHistory(
                        conflict.existing.changeHistory,
                        conflict.incoming.changeHistory,
                        buildPatientChangeHistoryEntries(conflict.existing, conflict.incoming, this.getCurrentDate())
                    );

                    merged[conflict.index] = {
                        ...conflict.incoming,
                        createdAtIso: conflict.existing.createdAtIso,
                        updatedAtIso: new Date().toISOString(),
                        ...(changeHistory.length > 0 ? { changeHistory } : {})
                    };
                }
            }
        }

        return merged;
    }

    private normalizePatientKey(record: PatientRecord): string {
        return buildPatientRecordKey(record);
    }

    private areRecordsEquivalent(existing: PatientRecord, incoming: PatientRecord): boolean {
        return existing.nome === incoming.nome
            && existing.statusFinanceiro === incoming.statusFinanceiro
            && existing.horario === incoming.horario
            && existing.fisioterapeuta === incoming.fisioterapeuta
            && existing.celular === incoming.celular
            && existing.convenio === incoming.convenio
            && existing.procedimentos === incoming.procedimentos;
    }

    private askConflictChoices(conflicts: PatientConflict[]): Promise<Map<number, ConflictChoice> | null> {
        const dialog = document.getElementById("patientConflictDialog") as HTMLDialogElement | null;
        const title = document.getElementById("patientConflictTitle") as HTMLElement | null;
        const message = document.getElementById("patientConflictMessage") as HTMLElement | null;
        const list = document.getElementById("patientConflictList") as HTMLElement | null;
        const exitBtn = document.getElementById("exitPatientConflictBtn") as HTMLButtonElement | null;
        const useAllNewBtn = document.getElementById("useAllNewPatientConflictBtn") as HTMLButtonElement | null;
        const confirmBtn = document.getElementById("confirmPatientConflictBtn") as HTMLButtonElement | null;
        const autoFillBtn = document.getElementById("autoFillRequiredBtn") as HTMLButtonElement | null;

        if (!dialog || !title || !message || !list || !exitBtn || !useAllNewBtn || !confirmBtn) {
            return Promise.resolve(null);
        }

        title.textContent = "Conflito de paciente detectado";
        exitBtn.textContent = "Sair";
        useAllNewBtn.textContent = "Usar Novo";
        useAllNewBtn.hidden = false;
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
            const decisions = new Map<number, ConflictChoice>();
            let resolved = false;
            let pendingResult: Map<number, ConflictChoice> | null | undefined;
            const eventsController = new AbortController();
            const { signal } = eventsController;

            const cleanup = (): void => {
                eventsController.abort();
            };

            const resolveOnce = (value: Map<number, ConflictChoice> | null): void => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolve(value);
            };

            const closeDialogAsync = (): void => {
                window.setTimeout(() => {
                    if (dialog.open) dialog.close();
                }, 0);
            };

            const updateProgress = (): void => {
                const doneCount = conflicts.length - Array.from(list.querySelectorAll(".fh-conflict-item:not([data-choice])")).length;
                message.textContent = `Foram encontrados ${conflicts.length} conflito(s). Escolha qual versão manter em cada paciente. ${doneCount}/${conflicts.length} resolvido(s).`;
            };

            const markCard = (card: HTMLElement, choice: ConflictChoice): void => {
                card.dataset.choice = choice;
                const buttons = Array.from(card.querySelectorAll("button[data-conflict-choice]")) as HTMLButtonElement[];
                buttons.forEach((button) => {
                    const buttonChoice = button.dataset.conflictChoice as ConflictChoice;
                    button.disabled = true;
                    button.classList.toggle("is-active", buttonChoice === choice);
                });
            };

            const applyChoiceToAll = (choice: ConflictChoice): void => {
                const cards = Array.from(list.querySelectorAll(".fh-conflict-item")) as HTMLElement[];

                cards.forEach((card, index) => {
                    const conflictIndex = Number(card.dataset.conflictIndex ?? index);
                    if (!Number.isFinite(conflictIndex)) {
                        return;
                    }

                    decisions.set(conflictIndex, choice);
                    markCard(card, choice);
                });

                updateProgress();
                finalizeIfReady();
            };

            const finalizeIfReady = (): void => {
                if (decisions.size === conflicts.length) {
                    pendingResult = decisions;
                    closeDialogAsync();
                }
            };

            const onListClick = (event: MouseEvent): void => {
                const rawTarget = event.target;
                const targetElement = rawTarget instanceof Element
                    ? rawTarget
                    : rawTarget instanceof Node
                        ? rawTarget.parentElement
                        : null;

                if (!targetElement) return;

                const button = targetElement.closest("button[data-conflict-choice]") as HTMLButtonElement | null;
                if (!button) return;

                const index = Number(button.dataset.conflictIndex);
                const choice = button.dataset.conflictChoice as ConflictChoice | undefined;
                if (!Number.isFinite(index) || !choice) return;

                const card = list.querySelector(`.fh-conflict-item[data-conflict-index="${index}"]`) as HTMLElement | null;
                if (!card || decisions.has(index)) return;

                decisions.set(index, choice);
                markCard(card, choice);
                updateProgress();
                finalizeIfReady();
            };

            const onExit = (): void => {
                pendingResult = null;
                closeDialogAsync();
            };

            const onUseAllNew = (): void => {
                applyChoiceToAll("incoming");
            };

            const onCancel = (event: Event): void => {
                event.preventDefault();
                pendingResult = null;
                closeDialogAsync();
            };

            const onClose = (): void => {
                resolveOnce(pendingResult ?? null);
            };

            list.addEventListener("click", onListClick, { signal });
            useAllNewBtn.addEventListener("click", onUseAllNew, { signal });
            exitBtn.addEventListener("click", onExit, { once: true, signal });
            dialog.addEventListener("cancel", onCancel, { signal });
            dialog.addEventListener("close", onClose, { signal });

            if (!dialog.open) {
                dialog.showModal();
            }

            updateProgress();
        });
    }

    private splitImportedLinesByAppointment(lines: string[]): string[][] {
        const blocks: string[][] = [];
        let current: string[] = [];
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

    private normalizeRequiredFieldKey(value: string): RequiredFieldKey | null {
        const normalized = this.normalizeKey(value);

        if (normalized === "convenio") return "convenio";
        if (normalized === "procedimentos" || normalized === "procedimento") return "procedimentos";

        return null;
    }

    private getRequiredFieldLabel(field: RequiredFieldKey): string {
        if (field === "convenio") return "Convênio";
        return "Procedimentos";
    }

    private isMissingRequiredValue(value: string | undefined): boolean {
        if (typeof value !== "string") {
            return true;
        }

        const normalized = value.trim();
        return normalized.length === 0;
    }

    private parseFieldEntriesFromLine(line: string): Array<[string, string]> {
        const pattern = /(hor[áa]rio|paciente|celular|conv[eê]nio|status|procedimentos?|fisioterapeuta)\s*:\s*/gi;
        const matches = Array.from(line.matchAll(pattern));

        if (matches.length === 0) {
            const fallback = line.match(/^([^:]+):\s*(.*)$/);
            return fallback ? [[fallback[1], fallback[2].trim()]] : [];
        }

        const entries: Array<[string, string]> = [];

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

    private collectRequiredFieldIssues(lines: string[]): RequiredFieldIssue[] {
        const requiredFields: RequiredFieldKey[] = ["convenio", "procedimentos"];
        const blocks = this.splitImportedLinesByAppointment(lines);

        return blocks
            .map((block, blockIndex) => {
                const values: Partial<Record<RequiredFieldKey, string>> = {};
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

                        if (!key || this.isMissingRequiredValue(rawValue)) return;

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

    private askMissingRequiredFieldCorrections(issues: RequiredFieldIssue[]): Promise<Map<number, Partial<Record<RequiredFieldKey, string>>> | null> {
        const dialog = document.getElementById("patientConflictDialog") as HTMLDialogElement | null;
        const title = document.getElementById("patientConflictTitle") as HTMLElement | null;
        const message = document.getElementById("patientConflictMessage") as HTMLElement | null;
        const list = document.getElementById("patientConflictList") as HTMLElement | null;
        const exitBtn = document.getElementById("exitPatientConflictBtn") as HTMLButtonElement | null;
        const useAllNewBtn = document.getElementById("useAllNewPatientConflictBtn") as HTMLButtonElement | null;
        const confirmBtn = document.getElementById("confirmPatientConflictBtn") as HTMLButtonElement | null;
        const autoFillBtn = document.getElementById("autoFillRequiredBtn") as HTMLButtonElement | null;

        const procedureSearchDialog = document.getElementById("procedureSearchDialog") as HTMLDialogElement | null;
        const procedureSearchInput = document.getElementById("procedureSearchInput") as HTMLInputElement | null;
        const procedureSearchList = document.getElementById("procedureSearchList") as HTMLDivElement | null;
        const procedureSearchCount = document.getElementById("procedureSearchCount") as HTMLParagraphElement | null;
        const procedureSearchEmpty = document.getElementById("procedureSearchEmpty") as HTMLParagraphElement | null;
        const closeProcedureSearchBtn = document.getElementById("closeProcedureSearchBtn") as HTMLButtonElement | null;

        if (!dialog || !title || !message || !list || !exitBtn || !useAllNewBtn || !confirmBtn || !autoFillBtn || !procedureSearchDialog || !procedureSearchInput || !procedureSearchList || !procedureSearchCount || !procedureSearchEmpty || !closeProcedureSearchBtn) {
            return Promise.resolve(null);
        }

        title.textContent = "Correção obrigatória de dados";
        message.textContent = "Foram encontrados campos obrigatórios faltando. Preencha todos para continuar o processamento.";
        exitBtn.textContent = "Cancelar";
        useAllNewBtn.hidden = true;
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
            const corrections = new Map<number, Partial<Record<RequiredFieldKey, string>>>();
            let resolved = false;
            let pendingResult: Map<number, Partial<Record<RequiredFieldKey, string>>> | null | undefined;
            const eventsController = new AbortController();
            const { signal } = eventsController;

            const cleanup = (): void => {
                eventsController.abort();
            };

            const resolveOnce = (value: Map<number, Partial<Record<RequiredFieldKey, string>>> | null): void => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolve(value);
            };

            const closeDialogAsync = (): void => {
                window.setTimeout(() => {
                    if (procedureSearchDialog.open) {
                        procedureSearchDialog.close();
                    }

                    if (dialog.open) dialog.close();
                }, 0);
            };

            const allInputs = (): HTMLInputElement[] => {
                return Array.from(list.querySelectorAll("input[data-required-field]")) as HTMLInputElement[];
            };

            const hasMissingRequiredInputs = (): boolean => {
                return allInputs().some((input) => this.isMissingRequiredValue(input.value));
            };

            const updateConfirmState = (): void => {
                confirmBtn.disabled = false;
                confirmBtn.dataset.hasMissingRequiredInputs = hasMissingRequiredInputs() ? "true" : "false";
            };

            const findRecordForIssue = (issue: RequiredFieldIssue, records: PatientRecord[]): PatientRecord | null => {
                const patientName = issue.lookupName.trim();
                const patientPhone = issue.lookupPhone.replace(/\D/g, "");

                if (patientName.length > 0 && patientPhone.length > 0) {
                    const normalizedName = this.normalizeKey(patientName);
                    const withFullMatch = records.find((record) => {
                        return this.normalizeKey(record.nome) === normalizedName
                            && record.celular.replace(/\D/g, "") === patientPhone;
                    });

                    if (withFullMatch) return withFullMatch;
                }

                if (patientName.length > 0) {
                    const normalizedName = this.normalizeKey(patientName);
                    const withName = records.find((record) => this.normalizeKey(record.nome) === normalizedName);
                    if (withName) return withName;
                }

                if (patientPhone.length > 0) {
                    const withPhone = records.find((record) => record.celular.replace(/\D/g, "") === patientPhone);
                    if (withPhone) return withPhone;
                }

                return null;
            };

            const getRecordValueByField = (record: PatientRecord, field: RequiredFieldKey): string => {
                if (field === "convenio") return record.convenio;
                return record.procedimentos;
            };

            const getFilteredProcedureSuggestions = (query: string): string[] => {
                const normalizedQuery = this.normalizeKey(query);

                if (!normalizedQuery) {
                    return procedureSuggestions;
                }

                return procedureSuggestions.filter((procedure) => this.normalizeKey(procedure).includes(normalizedQuery));
            };

            const renderProcedureSearchResults = (): void => {
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

            const openProcedureSearchDialog = (issueIndex: number): void => {
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

            const closeProcedureSearchDialog = (): void => {
                if (procedureSearchDialog.open) {
                    procedureSearchDialog.close();
                }
            };

            const onInput = (): void => {
                updateConfirmState();
            };

            const onAutoProcess = (): void => {
                if (savedPatientsRecords.length === 0) {
                    this.showSiteNotification("Não há pacientes salvos para auto completar os campos obrigatórios.");
                    return;
                }

                let autoFilledCount = 0;

                issues.forEach((issue) => {
                    const record = findRecordForIssue(issue, savedPatientsRecords);
                    if (!record) return;

                    const issueInputs = Array.from(list.querySelectorAll(`input[data-issue-index="${issue.blockIndex}"]`)) as HTMLInputElement[];
                    issueInputs.forEach((input) => {
                        const field = input.dataset.requiredField as RequiredFieldKey | undefined;
                        if (!field || !this.isMissingRequiredValue(input.value)) return;

                        const value = getRecordValueByField(record, field).trim();
                        if (this.isMissingRequiredValue(value)) return;

                        input.value = value;
                        autoFilledCount += 1;
                    });
                });

                if (autoFilledCount === 0) {
                    this.showSiteNotification("Não foi possível auto completar os campos com base na lista de pacientes.");
                } else {
                    this.showSiteNotification(`${autoFilledCount} campo(s) obrigatorio(s) foram preenchidos automaticamente.`);
                }

                updateConfirmState();
            };

            const onListClick = (event: MouseEvent): void => {
                const rawTarget = event.target;
                const targetElement = rawTarget instanceof Element
                    ? rawTarget
                    : rawTarget instanceof Node
                        ? rawTarget.parentElement
                        : null;

                if (!targetElement) return;

                const searchButton = targetElement.closest("button[data-procedure-search-toggle]") as HTMLButtonElement | null;
                if (searchButton) {
                    const issueIndex = Number(searchButton.dataset.procedureSearchToggle ?? "");
                    if (!Number.isFinite(issueIndex)) return;
                    openProcedureSearchDialog(issueIndex);
                    return;
                }
            };

            const onProcedureSearchInput = (): void => {
                renderProcedureSearchResults();
            };

            const onProcedureSearchListClick = (event: MouseEvent): void => {
                const rawTarget = event.target;
                const targetElement = rawTarget instanceof Element
                    ? rawTarget
                    : rawTarget instanceof Node
                        ? rawTarget.parentElement
                        : null;

                if (!targetElement) return;

                const choiceButton = targetElement.closest("button[data-procedure-choice]") as HTMLButtonElement | null;
                if (!choiceButton) return;

                const issueIndex = Number(procedureSearchDialog.dataset.issueIndex ?? "");
                const procedure = choiceButton.dataset.procedureChoice?.trim() ?? "";

                if (!Number.isFinite(issueIndex) || this.isMissingRequiredValue(procedure)) return;

                const input = list.querySelector(`input[data-issue-index="${issueIndex}"][data-required-field="procedimentos"]`) as HTMLInputElement | null;
                if (!input) return;

                input.value = procedure;
                this.showSiteNotification("Procedimento registrado aplicado ao campo de correção.");
                updateConfirmState();
                closeProcedureSearchDialog();
            };

            const onProcedureSearchClose = (): void => {
                procedureSearchDialog.dataset.issueIndex = "";
            };

            const onProcedureSearchCancel = (event: Event): void => {
                event.preventDefault();
                closeProcedureSearchDialog();
            };

            const onConfirm = (): void => {
                if (hasMissingRequiredInputs()) {
                    this.showSiteNotification("Ainda faltam campos obrigatórios para preencher.");
                    updateConfirmState();
                    return;
                }

                corrections.clear();

                issues.forEach((issue) => {
                    const issueInputs = Array.from(list.querySelectorAll(`input[data-issue-index="${issue.blockIndex}"]`)) as HTMLInputElement[];
                    const values: Partial<Record<RequiredFieldKey, string>> = {};

                    issueInputs.forEach((input) => {
                        const field = input.dataset.requiredField as RequiredFieldKey | undefined;
                        if (!field) return;
                        values[field] = input.value.trim();
                    });

                    corrections.set(issue.blockIndex, values);
                });

                pendingResult = corrections;
                closeDialogAsync();
            };

            const onExit = (): void => {
                pendingResult = null;
                closeDialogAsync();
            };

            const onCancel = (event: Event): void => {
                event.preventDefault();
                pendingResult = null;
                closeDialogAsync();
            };

            const onClose = (): void => {
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

    private applyRequiredFieldCorrections(
        lines: string[],
        issues: RequiredFieldIssue[],
        corrections: Map<number, Partial<Record<RequiredFieldKey, string>>>
    ): string[] {
        const blocks = this.splitImportedLinesByAppointment(lines);

        issues.forEach((issue) => {
            const block = blocks[issue.blockIndex];
            const data = corrections.get(issue.blockIndex);
            if (!block || !data) return;

            issue.missingFields.forEach((field) => {
                const correctedValue = data[field]?.trim() ?? "";
                if (this.isMissingRequiredValue(correctedValue)) return;

                const label = this.getRequiredFieldLabel(field);
                let updated = false;

                for (let index = 0; index < block.length; index += 1) {
                    const entry = block[index].match(/^([^:]+):\s*(.*)$/);
                    if (!entry) continue;

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

    private describeConflictDiff(existing: PatientRecord, incoming: PatientRecord): string {
        const fields: Array<[keyof PatientRecord, string]> = [
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

    private getConflictDiffFields(existing: PatientRecord, incoming: PatientRecord): Array<[keyof PatientRecord, string]> {
        const fields: Array<[keyof PatientRecord, string]> = [
            ["statusFinanceiro", "Status financeiro"],
            ["horario", "Horário"],
            ["fisioterapeuta", "Fisioterapeuta"],
            ["celular", "Celular"],
            ["convenio", "Convênio"],
            ["procedimentos", "Procedimentos"]
        ];

        return fields.filter(([key]) => existing[key] !== incoming[key]);
    }

    private describeConflictSide(record: PatientRecord, fields: Array<[keyof PatientRecord, string]>): string {
        if (fields.length === 0) {
            return "Sem diferenças relevantes.";
        }

        return fields
            .map(([key, label]) => `${label}: ${this.getConflictValue(record, key)}`)
            .join("\n");
    }

    private getConflictValue(record: PatientRecord, key: keyof PatientRecord): string {
        const value = record[key];
        return typeof value === "string" ? value : "-";
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    private escapeHtmlAttr(value: string): string {
        return this.escapeHtml(value);
    }

    private normalizeKey(value: string): string {
        return value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    private isIsento(record: PatientRecord): boolean {
        return /isento/i.test(record.convenio) || /isento/i.test(record.procedimentos);
    }

    private sanitizeProcedimentosValue(value: string): string {
        return value.replace(/\s*observa[cç][oõ]es\s*:[\s\S]*$/i, "").trim();
    }

    private collectProcedureSuggestions(records: PatientRecord[]): string[] {
        const uniqueProcedures = new Map<string, string>();

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

    private extractIsoDate(value: string): string | null {
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

    private toIso(date: Date): string {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    private todayIso(): string {
        return this.toIso(new Date());
    }

    private formatDateForToast(value: string): string {
        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat("pt-BR").format(date);
    }

    private renderImportedData(): void {
        const editor = document.getElementById("importedDataEditor") as HTMLTextAreaElement | null;
        if (!editor) return;

        editor.value = this.importedItems.map((item) => item.raw).join("\n");
    }

    private syncImportedDataFromEditor(content: string): void {
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

    private saveStagingDataToStorage(): void {
        const serialized = this.importedItems.map((item) => item.raw).join("\n");
        localStorage.setItem(this.stagingDataStorageKey, serialized);
    }

    private loadStagingDataFromStorage(): void {
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

    private parsePatientsRecords(raw: string | null): PatientRecord[] {
        if (!raw) return [];

        try {
            const parsed = JSON.parse(raw);
            return this.toSafePatientsRecords(parsed);
        } catch {
            return [];
        }
    }

    private parseProcessedMeta(raw: string | null): ProcessedMeta {
        if (!raw) return this.toSafeProcessedMeta(undefined);

        try {
            const parsed = JSON.parse(raw);
            return this.toSafeProcessedMeta(parsed as Partial<ProcessedMeta>);
        } catch {
            return this.toSafeProcessedMeta(undefined);
        }
    }

    private toSafeText(value: unknown): string {
        return typeof value === "string" ? value : "";
    }

    private toSafeProcessedMeta(value: Partial<ProcessedMeta> | undefined): ProcessedMeta {
        return {
            processedAtIso: typeof value?.processedAtIso === "string" ? value.processedAtIso : new Date().toISOString(),
            referenceDateIso: typeof value?.referenceDateIso === "string" ? value.referenceDateIso : this.todayIso(),
            totalImportedLines: Number.isFinite(value?.totalImportedLines) ? Number(value?.totalImportedLines) : 0,
            totalPatients: Number.isFinite(value?.totalPatients) ? Number(value?.totalPatients) : 0,
            totalForReferenceDate: Number.isFinite(value?.totalForReferenceDate) ? Number(value?.totalForReferenceDate) : 0
        };
    }

    private toSafePatientsRecords(value: unknown): PatientRecord[] {
        if (!Array.isArray(value)) return [];

        return value.map((item) => {
            const candidate = item as Partial<PatientRecord>;
            const status: PatientRecord["statusFinanceiro"] = candidate.statusFinanceiro === "Isento" ? "Isento" : "Pagante";
            const changeHistory = parsePatientChangeHistory(candidate.changeHistory);

            return {
                nome: typeof candidate.nome === "string" ? candidate.nome : "",
                statusFinanceiro: status,
                horario: typeof candidate.horario === "string" ? candidate.horario : "-",
                fisioterapeuta: typeof candidate.fisioterapeuta === "string" ? candidate.fisioterapeuta : "-",
                celular: typeof candidate.celular === "string" ? candidate.celular : "-",
                convenio: typeof candidate.convenio === "string" ? candidate.convenio : "-",
                procedimentos: typeof candidate.procedimentos === "string" ? this.sanitizeProcedimentosValue(candidate.procedimentos) : "-",
                createdAtIso: typeof candidate.createdAtIso === "string" ? candidate.createdAtIso : new Date().toISOString(),
                updatedAtIso: typeof candidate.updatedAtIso === "string" ? candidate.updatedAtIso : new Date().toISOString(),
                ...(changeHistory.length > 0 ? { changeHistory } : {})
            };
        }).filter((record) => record.nome.trim().length > 0);
    }

    private startFloatingHomeHint(): void {
        sharedStartFloatingHomeHint();
    }

    private showSiteNotification(message: string): void {
        sharedShowSiteNotification(message);
    }
}
