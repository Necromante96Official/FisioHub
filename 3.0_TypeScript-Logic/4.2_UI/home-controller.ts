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

export class HomeController {
    private readonly appId = "app";
    private readonly homeTemplate = "1.0_HTML-Templates/1.1_Pages/home.html";
    private readonly legacyImportedDataStorageKey = "fisiohub-imported-data-lines-v1";
    private readonly stagingDataStorageKey = "fisiohub-staging-data-v2";
    private readonly processedDataStorageKey = "fisiohub-processed-data-v2";
    private readonly patientsRecordsStorageKey = "fisiohub-patients-records-v2";
    private readonly processedMetaStorageKey = "fisiohub-processed-meta-v2";
    private readonly theme = new ThemeManager();
    private importedItems: ImportedItem[] = [];
    private nextItemId = 1;

    async bootstrap(): Promise<void> {
        this.theme.init();
        await this.loadHome();
        await this.resolveIncludes();
        this.setDate(this.todayIso());
        this.loadStagingDataFromStorage();
        this.bindHandlers();
        this.renderImportedData();
        this.startFloatingHomeHint();
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

        const clearBtn = document.getElementById("clearDataBtn");
        clearBtn?.addEventListener("click", () => {
            this.clearAllStoredData();
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
        dateInput?.addEventListener("change", () => this.renderImportedData());

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

        const date = this.getCurrentDate();
        const filtered = stagedLines.filter((line) => {
            const extracted = this.extractIsoDate(line);
            return !extracted || extracted === date;
        });

        const patientRecords = this.parsePatientsFromLines(stagedLines);
        const mergedPatients = await this.mergePatientsWithConflictResolution(patientRecords);

        const processedMeta: ProcessedMeta = {
            processedAtIso: new Date().toISOString(),
            referenceDateIso: date,
            totalImportedLines: stagedLines.length,
            totalPatients: mergedPatients.length,
            totalForReferenceDate: filtered.length
        };

        localStorage.setItem(this.processedDataStorageKey, stagedLines.join("\n"));
        localStorage.setItem(this.patientsRecordsStorageKey, JSON.stringify(mergedPatients));
        localStorage.setItem(this.processedMetaStorageKey, JSON.stringify(processedMeta));

        this.importedItems = [];
        this.saveStagingDataToStorage();
        this.renderImportedData();

        this.showSiteNotification(`Processamento concluido: ${mergedPatients.length} paciente(s) salvos com precisao local.`);
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
            this.showSiteNotification("Importacao cancelada.");
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
        localStorage.removeItem(this.legacyImportedDataStorageKey);
        localStorage.removeItem(this.stagingDataStorageKey);
        localStorage.removeItem(this.processedDataStorageKey);
        localStorage.removeItem(this.patientsRecordsStorageKey);
        localStorage.removeItem(this.processedMetaStorageKey);

        this.importedItems = [];
        this.renderImportedData();
        this.showSiteNotification("Todos os dados locais foram limpos.");
    }

    private clearPatientsListOnly(): void {
        localStorage.removeItem(this.patientsRecordsStorageKey);
        localStorage.removeItem(this.processedDataStorageKey);
        localStorage.removeItem(this.processedMetaStorageKey);
        localStorage.removeItem(this.legacyImportedDataStorageKey);
        this.importedItems = [];
        this.saveStagingDataToStorage();
        this.renderImportedData();
        this.showSiteNotification("Lista de pacientes removida do armazenamento local.");
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

            const entryMatch = line.match(/^([^:]+):\s*(.+)$/);
            if (!entryMatch) {
                return;
            }

            const key = this.normalizeKey(entryMatch[1]);
            const value = this.sanitizeProcedimentosValue(entryMatch[2].trim());

            if (key === "horario") draft.horario = value;
            if (key === "fisioterapeuta") draft.fisioterapeuta = value;
            if (key === "paciente") draft.nome = value;
            if (key === "celular") draft.celular = value;
            if (key === "convenio") draft.convenio = value;
            if (key === "procedimentos") draft.procedimentos = this.sanitizeProcedimentosValue(value);
        });

        pushDraft();

        return records.map((record) => ({
            ...record,
            statusFinanceiro: this.isIsento(record) ? "Isento" : "Pagante"
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

    private async mergePatientsWithConflictResolution(incomingRecords: PatientRecord[]): Promise<PatientRecord[]> {
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

        for (const conflict of conflicts) {
            const choice = await this.askConflictChoice(conflict.existing, conflict.incoming);
            if (choice === "incoming") {
                merged[conflict.index] = {
                    ...conflict.incoming,
                    createdAtIso: conflict.existing.createdAtIso,
                    updatedAtIso: new Date().toISOString()
                };
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

    private askConflictChoice(existing: PatientRecord, incoming: PatientRecord): Promise<"existing" | "incoming"> {
        const dialog = document.getElementById("patientConflictDialog") as HTMLDialogElement | null;
        const message = document.getElementById("patientConflictMessage") as HTMLElement | null;
        const existingPre = document.getElementById("patientConflictExisting") as HTMLElement | null;
        const incomingPre = document.getElementById("patientConflictIncoming") as HTMLElement | null;
        const keepExistingBtn = document.getElementById("keepExistingPatientBtn") as HTMLButtonElement | null;
        const keepIncomingBtn = document.getElementById("keepIncomingPatientBtn") as HTMLButtonElement | null;

        if (!dialog || !message || !existingPre || !incomingPre || !keepExistingBtn || !keepIncomingBtn) {
            return Promise.resolve("existing");
        }

        message.textContent = `Paciente ${incoming.nome} ja existe com dados diferentes. Escolha qual versao deseja manter.`;
        existingPre.textContent = this.describeRecord(existing);
        incomingPre.textContent = this.describeRecord(incoming);

        return new Promise((resolve) => {
            let resolved = false;

            const cleanup = (): void => {
                keepExistingBtn.removeEventListener("click", onKeepExisting);
                keepIncomingBtn.removeEventListener("click", onKeepIncoming);
                dialog.removeEventListener("cancel", onCancel);
                dialog.removeEventListener("close", onClose);
            };

            const resolveOnce = (choice: "existing" | "incoming"): void => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolve(choice);
            };

            const onKeepExisting = (): void => {
                if (dialog.open) dialog.close();
                resolveOnce("existing");
            };

            const onKeepIncoming = (): void => {
                if (dialog.open) dialog.close();
                resolveOnce("incoming");
            };

            const onCancel = (event: Event): void => {
                event.preventDefault();
                if (dialog.open) dialog.close();
                resolveOnce("existing");
            };

            const onClose = (): void => {
                resolveOnce("existing");
            };

            keepExistingBtn.addEventListener("click", onKeepExisting, { once: true });
            keepIncomingBtn.addEventListener("click", onKeepIncoming, { once: true });
            dialog.addEventListener("cancel", onCancel);
            dialog.addEventListener("close", onClose);

            if (!dialog.open) {
                dialog.showModal();
            }
        });
    }

    private describeRecord(record: PatientRecord): string {
        return [
            `Nome: ${record.nome}`,
            `Status: ${record.statusFinanceiro}`,
            `Horario: ${record.horario}`,
            `Fisioterapeuta: ${record.fisioterapeuta}`,
            `Celular: ${record.celular}`,
            `Convenio: ${record.convenio}`,
            `Procedimentos: ${record.procedimentos}`
        ].join("\n");
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
        return dateInput?.value || this.todayIso();
    }

    private getDateInput(): HTMLInputElement | null {
        return document.getElementById("refDate") as HTMLInputElement | null;
    }

    private setDate(value: string): void {
        const dateInput = this.getDateInput();
        if (!dateInput) return;
        dateInput.value = value;
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

    private showSiteNotification(message: string): void {
        const container = document.getElementById("siteNotifications");
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
