import { ThemeManager } from "../4.1_Core/theme-manager.js";

type ImportedItem = {
    id: number;
    raw: string;
    dateIso: string | null;
};

type PatientRecord = {
    nome: string;
    statusFinanceiro: "Pagante" | "Isento";
    horario: string;
    fisioterapeuta: string;
    celular: string;
    convenio: string;
    procedimentos: string;
    createdAtIso: string;
    updatedAtIso: string;
};

type ProcessedMeta = {
    processedAtIso: string;
    referenceDateIso: string;
    totalImportedLines: number;
    totalPatients: number;
    totalForReferenceDate: number;
};

type EvolucoesPendingBatch = {
    processedAtIso: string;
    referenceDateIso: string;
    lines: string[];
};

type BackupPayload = {
    schema: "fisiohub-backup-v2";
    kind: "all" | "patients-only" | "all-without-patients";
    createdAtIso: string;
    stagingData?: string;
    processedData?: string;
    patientsRecords?: PatientRecord[];
    processedMeta?: ProcessedMeta;
};

type PatientConflict = {
    index: number;
    existing: PatientRecord;
    incoming: PatientRecord;
};

type ConflictChoice = "existing" | "incoming";

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
    private readonly legacyImportedDataStorageKey = "fisiohub-imported-data-lines-v1";
    private readonly stagingDataStorageKey = "fisiohub-staging-data-v2";
    private readonly processedDataStorageKey = "fisiohub-processed-data-v2";
    private readonly evolucoesPendingHistoryStorageKey = "fisiohub-evolucoes-pending-history-v1";
    private readonly doneEvolutionsStorageKey = "fisiohub-evolucoes-realizadas-v1";
    private readonly referenceDateStorageKey = "fisiohub-reference-date-v1";
    private readonly patientsRecordsStorageKey = "fisiohub-patients-records-v2";
    private readonly processedMetaStorageKey = "fisiohub-processed-meta-v2";
    private readonly theme = new ThemeManager();
    private importedItems: ImportedItem[] = [];
    private nextItemId = 1;

    async bootstrap(): Promise<void> {
        this.theme.init();
        await this.loadHome();
        await this.resolveIncludes();
        this.setDate(this.getStoredReferenceDate() ?? this.todayIso());
        this.loadStagingDataFromStorage();
        this.bindHandlers();
        this.renderImportedData();
        this.startFloatingHomeHint();

        window.addEventListener("storage", (event) => {
            if (event.key && !event.key.startsWith("fisiohub-")) {
                return;
            }

            this.loadStagingDataFromStorage();
            this.renderImportedData();
        });
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
            this.clearOnlyPageDataPreservingPatientsList();
        });

        const clearDataBtn = document.getElementById("clearDataBtn");
        clearDataBtn?.addEventListener("click", () => {
            this.clearImportedDataOnly();
        });

        const clearAllDataBtn = document.getElementById("clearAllDataBtn");
        clearAllDataBtn?.addEventListener("click", () => {
            this.clearAllStoredData();
        });

        const clearPatientsListBtn = document.getElementById("clearPatientsListBtn");
        clearPatientsListBtn?.addEventListener("click", () => {
            this.clearPatientsListOnly();
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

        document.getElementById("todayBtn")?.addEventListener("click", () => {
            this.setDate(this.todayIso());
            this.renderImportedData();
        });

        document.getElementById("prevDayBtn")?.addEventListener("click", () => this.moveDateByDays(-1));
        document.getElementById("nextDayBtn")?.addEventListener("click", () => this.moveDateByDays(1));
        document.getElementById("prevMonthBtn")?.addEventListener("click", () => this.moveMonthStart(-1));
        document.getElementById("nextMonthBtn")?.addEventListener("click", () => this.moveMonthStart(1));

        const termsButton = document.getElementById("termsBtn");
        const closeTermsButton = document.getElementById("closeTermsDialogBtn");
        const termsDialog = this.getTermsDialog();

        termsButton?.addEventListener("click", () => {
            if (!termsDialog.open) {
                termsDialog.classList.remove("is-opening");
                termsDialog.classList.remove("is-closing");
                termsDialog.removeAttribute("data-closing");
                termsDialog.showModal();

                window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => {
                        termsDialog.classList.add("is-opening");
                    });
                });

                const onOpenAnimationEnd = (): void => {
                    termsDialog.classList.remove("is-opening");
                    termsDialog.removeEventListener("animationend", onOpenAnimationEnd);
                };

                termsDialog.addEventListener("animationend", onOpenAnimationEnd);
            }
        });

        closeTermsButton?.addEventListener("click", () => {
            this.requestTermsClose(termsDialog);
        });

        termsDialog?.addEventListener("cancel", (event) => {
            this.requestTermsClose(termsDialog, event);
        });

        const openBackupsBtn = document.getElementById("openBackupsBtn");
        const backupsDialog = this.getBackupsDialog();
        const closeBackupsBtn = document.getElementById("closeBackupsDialogBtn");

        openBackupsBtn?.addEventListener("click", () => {
            if (!backupsDialog.open) {
                backupsDialog.showModal();
            }
        });

        closeBackupsBtn?.addEventListener("click", () => {
            if (backupsDialog.open) backupsDialog.close();
        });

        backupsDialog?.addEventListener("click", (event) => {
            if (event.target === backupsDialog) {
                backupsDialog.close();
            }
        });

        document.getElementById("exportAllDataBtn")?.addEventListener("click", () => {
            this.exportBackup("all");
        });

        document.getElementById("exportPatientsOnlyBtn")?.addEventListener("click", () => {
            this.exportBackup("patients-only");
        });

        document.getElementById("exportAllWithoutPatientsBtn")?.addEventListener("click", () => {
            this.exportBackup("all-without-patients");
        });

        document.getElementById("importAllDataBtn")?.addEventListener("click", async () => {
            await this.importBackup("all");
        });

        document.getElementById("importPatientsOnlyBtn")?.addEventListener("click", async () => {
            await this.importBackup("patients-only");
        });

        document.getElementById("importAllWithoutPatientsBtn")?.addEventListener("click", async () => {
            await this.importBackup("all-without-patients");
        });
    }

    private getTermsDialog(): HTMLDialogElement {
        return document.getElementById("termsDialog") as HTMLDialogElement;
    }

    private getBackupsDialog(): HTMLDialogElement {
        return document.getElementById("backupsDialog") as HTMLDialogElement;
    }

    private requestTermsClose(dialog: HTMLDialogElement, event?: Event): void {
        event?.preventDefault();

        if (!dialog.open || dialog.dataset.closing === "true") {
            return;
        }

        dialog.dataset.closing = "true";
        dialog.classList.remove("is-opening");
        dialog.classList.add("is-closing");
        const surface = dialog.querySelector(".fh-terms-surface") as HTMLElement | null;

        const finalizeClose = (): void => {
            dialog.classList.remove("is-closing");
            dialog.removeAttribute("data-closing");

            if (dialog.open) {
                dialog.close();
            }
        };

        const fallback = window.setTimeout(() => {
            if (surface) {
                surface.removeEventListener("animationend", onAnimationEnd);
            }
            finalizeClose();
        }, 560);

        const onAnimationEnd = (): void => {
            window.clearTimeout(fallback);

            if (surface) {
                surface.removeEventListener("animationend", onAnimationEnd);
            }

            finalizeClose();
        };

        if (surface) {
            surface.addEventListener("animationend", onAnimationEnd, { once: true });
            return;
        }

        finalizeClose();
    }

    private async processAndPersistData(): Promise<void> {
        const stagedLines = this.importedItems.map((item) => item.raw.trim()).filter((line) => line.length > 0);
        if (stagedLines.length === 0) {
            this.showSiteNotification("Nenhum dado em rascunho para processar.");
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
                dateIso: this.extractIsoDate(line) ?? this.getCurrentDate()
            }));
            this.saveStagingDataToStorage();
            this.renderImportedData();
        }

        const date = this.getCurrentDate();
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
        const stagingData = localStorage.getItem(this.stagingDataStorageKey) ?? "";
        const processedData = localStorage.getItem(this.processedDataStorageKey) ?? "";
        const processedMeta = this.parseProcessedMeta(localStorage.getItem(this.processedMetaStorageKey));
        const patientsRecords = this.parsePatientsRecords(localStorage.getItem(this.patientsRecordsStorageKey));

        const payload: BackupPayload = {
            schema: "fisiohub-backup-v2",
            kind,
            createdAtIso: new Date().toISOString()
        };

        if (kind === "all") {
            payload.stagingData = stagingData;
            payload.processedData = processedData;
            payload.patientsRecords = patientsRecords;
            payload.processedMeta = processedMeta;
        }

        if (kind === "patients-only") {
            payload.patientsRecords = patientsRecords;
            payload.processedMeta = processedMeta;
        }

        if (kind === "all-without-patients") {
            payload.stagingData = stagingData;
            payload.processedData = processedData;
            payload.processedMeta = processedMeta;
        }

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const fileName = `fisiohub-backup-${kind}-${this.todayIso()}.json`;

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
        const payload = await this.pickBackupFile();
        if (!payload) {
            this.showSiteNotification("Importação cancelada.");
            return;
        }

        if (kind === "all") {
            localStorage.setItem(this.stagingDataStorageKey, this.toSafeText(payload.stagingData));
            localStorage.setItem(this.processedDataStorageKey, this.toSafeText(payload.processedData));
            localStorage.setItem(this.patientsRecordsStorageKey, JSON.stringify(this.toSafePatientsRecords(payload.patientsRecords)));
            localStorage.setItem(this.processedMetaStorageKey, JSON.stringify(this.toSafeProcessedMeta(payload.processedMeta)));
        }

        if (kind === "patients-only") {
            localStorage.setItem(this.patientsRecordsStorageKey, JSON.stringify(this.toSafePatientsRecords(payload.patientsRecords)));

            if (payload.processedMeta) {
                localStorage.setItem(this.processedMetaStorageKey, JSON.stringify(this.toSafeProcessedMeta(payload.processedMeta)));
            }
        }

        if (kind === "all-without-patients") {
            localStorage.setItem(this.stagingDataStorageKey, this.toSafeText(payload.stagingData));
            localStorage.setItem(this.processedDataStorageKey, this.toSafeText(payload.processedData));
            localStorage.removeItem(this.patientsRecordsStorageKey);
            localStorage.setItem(this.processedMetaStorageKey, JSON.stringify(this.toSafeProcessedMeta(payload.processedMeta)));
        }

        this.loadStagingDataFromStorage();
        this.renderImportedData();
        this.showSiteNotification("Backup importado com sucesso.");
    }

    private clearAllStoredData(): void {
        this.clearAllFisioHubStorage();

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
        button.textContent = "Limpar Somente Dados";

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
        localStorage.removeItem(this.legacyImportedDataStorageKey);
        this.renderImportedData();
        this.showSiteNotification("Dados importados do painel foram limpos.");
    }

    private clearOnlyPageDataPreservingPatientsList(): void {
        const keysToRemove = [
            this.legacyImportedDataStorageKey,
            this.stagingDataStorageKey,
            this.processedDataStorageKey,
            this.processedMetaStorageKey,
            this.evolucoesPendingHistoryStorageKey,
            this.doneEvolutionsStorageKey,
            this.referenceDateStorageKey
        ];

        keysToRemove.forEach((key) => localStorage.removeItem(key));

        this.importedItems = [];
        this.nextItemId = 1;
        this.setDate(this.todayIso());
        this.renderImportedData();
        this.showSiteNotification("Dados das páginas foram limpos. A Lista de Pacientes foi preservada.");
    }

    private clearPatientsListOnly(): void {
        localStorage.removeItem(this.patientsRecordsStorageKey);
        this.persistReferenceDate(this.getCurrentDate());
        this.renderImportedData();
        this.showSiteNotification("Somente a Lista de Pacientes foi limpa. As demais páginas foram preservadas.");
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

    private clearAllFisioHubStorage(): void {
        const keysToRemove: string[] = [];

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key && key.startsWith("fisiohub-")) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach((key) => localStorage.removeItem(key));
    }

    private async pickBackupFile(): Promise<Partial<BackupPayload> | null> {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";

        const file = await new Promise<File | null>((resolve) => {
            input.addEventListener("change", () => {
                resolve(input.files?.[0] ?? null);
            }, { once: true });
            input.click();
        });

        if (!file) return null;

        try {
            const raw = await file.text();
            const parsed = JSON.parse(raw) as Partial<BackupPayload>;
            return parsed;
        } catch {
            this.showSiteNotification("Arquivo de backup invalido.");
            return null;
        }
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
                const choice = decisions.get(conflict.index) ?? "existing";
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

    private normalizePatientKey(record: PatientRecord): string {
        const normalizedName = record.nome
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();

        const normalizedPhone = record.celular.replace(/\D/g, "");
        return `${normalizedName}|${normalizedPhone}`;
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
        const confirmBtn = document.getElementById("confirmPatientConflictBtn") as HTMLButtonElement | null;
        const autoFillBtn = document.getElementById("autoFillRequiredBtn") as HTMLButtonElement | null;

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
            const decisions = new Map<number, ConflictChoice>();
            let resolved = false;
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

            const finalizeIfReady = (): void => {
                if (decisions.size === conflicts.length) {
                    resolveOnce(decisions);
                    window.setTimeout(() => {
                        if (dialog.open) dialog.close();
                    }, 0);
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
                resolveOnce(null);
                window.setTimeout(() => {
                    if (dialog.open) dialog.close();
                }, 0);
            };

            const onCancel = (event: Event): void => {
                event.preventDefault();
                resolveOnce(null);
                window.setTimeout(() => {
                    if (dialog.open) dialog.close();
                }, 0);
            };

            const onClose = (): void => {
                resolveOnce(decisions.size === conflicts.length ? decisions : null);
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
        const normalized = value?.trim() ?? "";
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
        const confirmBtn = document.getElementById("confirmPatientConflictBtn") as HTMLButtonElement | null;
        const autoFillBtn = document.getElementById("autoFillRequiredBtn") as HTMLButtonElement | null;
        const procedureDialog = document.getElementById("procedurePickerDialog") as HTMLDialogElement | null;
        const procedureTitle = document.getElementById("procedurePickerTitle") as HTMLElement | null;
        const procedureMessage = document.getElementById("procedurePickerMessage") as HTMLElement | null;
        const procedureList = document.getElementById("procedurePickerList") as HTMLElement | null;
        const closeProcedureBtn = document.getElementById("closeProcedurePickerBtn") as HTMLButtonElement | null;

        if (!dialog || !title || !message || !list || !exitBtn || !confirmBtn || !autoFillBtn || !procedureDialog || !procedureTitle || !procedureMessage || !procedureList || !closeProcedureBtn) {
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
                                                            class="fh-btn fh-btn-ghost fh-required-search-btn"
                                                            type="button"
                                                            data-procedure-search="true"
                                                            data-issue-index="${issue.blockIndex}"
                                                            aria-label="Procurar procedimento salvo">
                                                            Procurar
                                                        </button>
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

            const allInputs = (): HTMLInputElement[] => {
                return Array.from(list.querySelectorAll("input[data-required-field]")) as HTMLInputElement[];
            };

            const updateConfirmState = (): void => {
                const hasMissing = allInputs().some((input) => this.isMissingRequiredValue(input.value));
                confirmBtn.disabled = hasMissing;
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

            const openProcedurePicker = (issue: RequiredFieldIssue, targetInput: HTMLInputElement): Promise<string | null> => {
                if (procedureSuggestions.length === 0) {
                    this.showSiteNotification("Nao ha procedimentos salvos na lista de pacientes.");
                    return Promise.resolve(null);
                }

                procedureTitle.textContent = issue.patientName ? `Procedimentos salvos — ${issue.patientName}` : "Procedimentos salvos";
                procedureMessage.textContent = "Escolha um procedimento já salvo na lista de pacientes. A seleção é opcional.";
                procedureList.innerHTML = procedureSuggestions.map((procedure) => {
                    return `
                        <button class="fh-procedure-choice" type="button" data-procedure-choice="${this.escapeHtmlAttr(procedure)}">
                          <span class="fh-procedure-choice-main">
                            <span class="fh-procedure-choice-name">${this.escapeHtml(procedure)}</span>
                            <span class="fh-procedure-choice-meta">Selecionar procedimento</span>
                          </span>
                          <span class="fh-procedure-choice-meta">Opcional</span>
                        </button>
                    `;
                }).join("");

                return new Promise((resolve) => {
                    const pickerController = new AbortController();
                    const { signal: pickerSignal } = pickerController;
                    let resolved = false;

                    const cleanup = (): void => {
                        pickerController.abort();
                    };

                    const resolveOnce = (value: string | null): void => {
                        if (resolved) return;
                        resolved = true;
                        cleanup();
                        resolve(value);
                    };

                    const closePicker = (): void => {
                        resolveOnce(null);
                        window.setTimeout(() => {
                            if (procedureDialog.open) procedureDialog.close();
                        }, 0);
                    };

                    const onPickerClick = (event: MouseEvent): void => {
                        const rawTarget = event.target;
                        const targetElement = rawTarget instanceof Element
                            ? rawTarget
                            : rawTarget instanceof Node
                                ? rawTarget.parentElement
                                : null;

                        if (!targetElement) return;

                        const button = targetElement.closest("button[data-procedure-choice]") as HTMLButtonElement | null;
                        if (!button) return;

                        const procedure = button.dataset.procedureChoice?.trim() ?? "";
                        if (!procedure) return;

                        targetInput.value = procedure;
                        updateConfirmState();

                        resolveOnce(procedure);

                        window.setTimeout(() => {
                            if (procedureDialog.open) {
                                procedureDialog.close();
                            }
                        }, 0);
                    };

                    const onPickerCancel = (event: Event): void => {
                        event.preventDefault();
                        closePicker();
                    };

                    const onPickerClose = (): void => {
                        resolveOnce(null);
                    };

                    const onPickerBackdropClick = (event: MouseEvent): void => {
                        if (event.target === procedureDialog) {
                            closePicker();
                        }
                    };

                    procedureList.addEventListener("click", onPickerClick, { signal: pickerSignal });
                    closeProcedureBtn.addEventListener("click", closePicker, { once: true, signal: pickerSignal });
                    procedureDialog.addEventListener("cancel", onPickerCancel, { signal: pickerSignal });
                    procedureDialog.addEventListener("close", onPickerClose, { signal: pickerSignal });
                    procedureDialog.addEventListener("click", onPickerBackdropClick, { signal: pickerSignal });

                    if (!procedureDialog.open) {
                        procedureDialog.showModal();
                    }
                });
            };

            const onInput = (): void => {
                updateConfirmState();
            };

            const onAutoProcess = (): void => {
                if (savedPatientsRecords.length === 0) {
                    this.showSiteNotification("Nao ha pacientes salvos para auto completar os campos obrigatorios.");
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
                    this.showSiteNotification("Nao foi possivel auto completar os campos com base na lista de pacientes.");
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

                const searchButton = targetElement.closest("button[data-procedure-search]") as HTMLButtonElement | null;
                if (searchButton) {
                    const issueIndex = Number(searchButton.dataset.issueIndex);
                    if (!Number.isFinite(issueIndex)) return;

                    const issue = issues.find((item) => item.blockIndex === issueIndex);
                    if (!issue) return;

                    const targetInput = list.querySelector(`input[data-issue-index="${issueIndex}"][data-required-field="procedimentos"]`) as HTMLInputElement | null;
                    if (!targetInput) return;

                    void openProcedurePicker(issue, targetInput);
                    return;
                }
            };

            const onConfirm = (): void => {
                if (confirmBtn.disabled) return;

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

                resolveOnce(corrections);
                window.setTimeout(() => {
                    if (dialog.open) dialog.close();
                }, 0);
            };

            const onExit = (): void => {
                resolveOnce(null);
                window.setTimeout(() => {
                    if (dialog.open) dialog.close();
                }, 0);
            };

            const onCancel = (event: Event): void => {
                event.preventDefault();
                resolveOnce(null);
                window.setTimeout(() => {
                    if (dialog.open) dialog.close();
                }, 0);
            };

            const onClose = (): void => {
                resolveOnce(null);
            };

            list.addEventListener("click", onListClick, { signal });
            list.addEventListener("input", onInput, { signal });
            confirmBtn.addEventListener("click", onConfirm, { signal });
            autoFillBtn.addEventListener("click", onAutoProcess, { signal });
            exitBtn.addEventListener("click", onExit, { once: true, signal });
            dialog.addEventListener("cancel", onCancel, { signal });
            dialog.addEventListener("close", onClose, { signal });

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

    private getCurrentDate(): string {
        const dateInput = this.getDateInput();
        return dateInput?.value || this.getStoredReferenceDate() || this.todayIso();
    }

    private getDateInput(): HTMLInputElement | null {
        return document.getElementById("refDate") as HTMLInputElement | null;
    }

    private setDate(value: string): void {
        const dateInput = this.getDateInput();
        if (!dateInput) return;
        dateInput.value = value;
        this.persistReferenceDate(value);
    }

    private getStoredReferenceDate(): string | null {
        const stored = localStorage.getItem(this.referenceDateStorageKey);
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
        localStorage.setItem(this.referenceDateStorageKey, normalized);
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

    private toIso(date: Date): string {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    private todayIso(): string {
        return this.toIso(new Date());
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
        const legacy = localStorage.getItem(this.legacyImportedDataStorageKey);
        const source = staged ?? legacy ?? "";

        if (!source.trim()) {
            this.importedItems = [];
            return;
        }

        if (!staged && legacy) {
            localStorage.setItem(this.stagingDataStorageKey, legacy);
        }

        const lines = source
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

    private startFloatingHomeHint(): void {
        const toast = document.querySelector(".fh-floating-home-toast") as HTMLElement | null;
        if (!toast || toast.dataset.started === "true") {
            return;
        }

        toast.dataset.started = "true";
        const intervalMs = 15000;

        const pulse = (): void => {
            toast.classList.remove("is-visible");
            void toast.offsetWidth;
            toast.classList.add("is-visible");
        };

        let nextTick = performance.now() + intervalMs;

        const scheduleNext = (): void => {
            const delay = Math.max(0, nextTick - performance.now());
            window.setTimeout(() => {
                pulse();
                nextTick += intervalMs;
                scheduleNext();
            }, delay);
        };

        scheduleNext();
    }

    private getNotificationHost(): HTMLElement | null {
        const baseHost = document.getElementById("siteNotifications") as HTMLElement | null;
        if (!baseHost) {
            return null;
        }

        const openDialogs = Array.from(document.querySelectorAll("dialog[open]")) as HTMLDialogElement[];
        const topDialog = openDialogs.length > 0 ? openDialogs[openDialogs.length - 1] : null;
        if (!topDialog) {
            baseHost.classList.remove("fh-site-notifications--modal");
            return baseHost;
        }

        const surface = topDialog.querySelector(".fh-conflict-surface, .fh-backups-surface, .fh-terms-surface") as HTMLElement | null ?? topDialog;
        let modalHost = surface.querySelector(".fh-site-notifications--modal") as HTMLElement | null;

        if (!modalHost) {
            modalHost = document.createElement("div");
            modalHost.className = "fh-site-notifications fh-site-notifications--modal";
            modalHost.setAttribute("aria-live", "polite");
            modalHost.setAttribute("aria-atomic", "false");
            surface.appendChild(modalHost);
        }

        return modalHost;
    }

    private showSiteNotification(message: string): void {
        const container = this.getNotificationHost();
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = "fh-site-toast";
        toast.textContent = message;
        container.appendChild(toast);

        const beginClose = (): void => {
            toast.classList.add("is-leaving");
            const remove = (): void => {
                toast.removeEventListener("animationend", remove);
                toast.remove();
            };

            toast.addEventListener("animationend", remove);
        };

        window.setTimeout(beginClose, 2600);
    }
}
