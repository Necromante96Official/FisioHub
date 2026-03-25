import { ThemeManager } from "../4.1_Core/theme-manager.js";
export class HomeController {
    appId = "app";
    homeTemplate = "1.0_HTML-Templates/1.1_Pages/home.html";
    legacyImportedDataStorageKey = "fisiohub-imported-data-lines-v1";
    stagingDataStorageKey = "fisiohub-staging-data-v2";
    processedDataStorageKey = "fisiohub-processed-data-v2";
    evolucoesPendingHistoryStorageKey = "fisiohub-evolucoes-pending-history-v1";
    referenceDateStorageKey = "fisiohub-reference-date-v1";
    patientsRecordsStorageKey = "fisiohub-patients-records-v2";
    processedMetaStorageKey = "fisiohub-processed-meta-v2";
    theme = new ThemeManager();
    importedItems = [];
    nextItemId = 1;
    async bootstrap() {
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
                const onOpenAnimationEnd = () => {
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
            if (backupsDialog.open)
                backupsDialog.close();
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
    getTermsDialog() {
        return document.getElementById("termsDialog");
    }
    getBackupsDialog() {
        return document.getElementById("backupsDialog");
    }
    requestTermsClose(dialog, event) {
        event?.preventDefault();
        if (!dialog.open || dialog.dataset.closing === "true") {
            return;
        }
        dialog.dataset.closing = "true";
        dialog.classList.remove("is-opening");
        dialog.classList.add("is-closing");
        const surface = dialog.querySelector(".fh-terms-surface");
        const finalizeClose = () => {
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
        const onAnimationEnd = () => {
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
    async processAndPersistData() {
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
        if (!mergedPatients) {
            this.showSiteNotification("Processamento cancelado.");
            return;
        }
        const processedMeta = {
            processedAtIso: new Date().toISOString(),
            referenceDateIso: date,
            totalImportedLines: stagedLines.length,
            totalPatients: mergedPatients.length,
            totalForReferenceDate: filtered.length
        };
        localStorage.setItem(this.processedDataStorageKey, stagedLines.join("\n"));
        localStorage.setItem(this.patientsRecordsStorageKey, JSON.stringify(mergedPatients));
        localStorage.setItem(this.processedMetaStorageKey, JSON.stringify(processedMeta));
        this.appendEvolucoesPendingBatch({
            processedAtIso: processedMeta.processedAtIso,
            referenceDateIso: processedMeta.referenceDateIso,
            lines: stagedLines
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
        const stagingData = localStorage.getItem(this.stagingDataStorageKey) ?? "";
        const processedData = localStorage.getItem(this.processedDataStorageKey) ?? "";
        const processedMeta = this.parseProcessedMeta(localStorage.getItem(this.processedMetaStorageKey));
        const patientsRecords = this.parsePatientsRecords(localStorage.getItem(this.patientsRecordsStorageKey));
        const payload = {
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
    async importBackup(kind) {
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
    clearAllStoredData() {
        this.clearAllFisioHubStorage();
        this.importedItems = [];
        this.nextItemId = 1;
        this.setDate(this.todayIso());
        this.renderImportedData();
        this.showSiteNotification("Todos os dados locais foram limpos.");
    }
    clearPatientsListOnly() {
        localStorage.removeItem(this.patientsRecordsStorageKey);
        this.persistReferenceDate(this.getCurrentDate());
        this.renderImportedData();
        this.showSiteNotification("Lista de pacientes removida do armazenamento local.");
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
    clearAllFisioHubStorage() {
        const keysToRemove = [];
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key && key.startsWith("fisiohub-")) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
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
            this.showSiteNotification("Arquivo de backup invalido.");
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
            const entryMatch = line.match(/^([^:]+):\s*(.+)$/);
            if (!entryMatch) {
                return;
            }
            const key = this.normalizeKey(entryMatch[1]);
            const value = this.sanitizeProcedimentosValue(entryMatch[2].trim());
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
        const message = document.getElementById("patientConflictMessage");
        const list = document.getElementById("patientConflictList");
        const exitBtn = document.getElementById("exitPatientConflictBtn");
        if (!dialog || !message || !list || !exitBtn) {
            return Promise.resolve(null);
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
            const cleanup = () => {
                list.removeEventListener("click", onListClick);
                exitBtn.removeEventListener("click", onExit);
                dialog.removeEventListener("cancel", onCancel);
                dialog.removeEventListener("close", onClose);
            };
            const resolveOnce = (value) => {
                if (resolved)
                    return;
                resolved = true;
                cleanup();
                resolve(value);
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
                    if (dialog.open)
                        dialog.close();
                    resolveOnce(decisions);
                }
            };
            const onListClick = (event) => {
                const target = event.target;
                const button = target.closest("button[data-conflict-choice]");
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
                if (dialog.open)
                    dialog.close();
                resolveOnce(null);
            };
            const onCancel = (event) => {
                event.preventDefault();
                if (dialog.open)
                    dialog.close();
                resolveOnce(null);
            };
            const onClose = () => {
                resolveOnce(decisions.size === conflicts.length ? decisions : null);
            };
            list.addEventListener("click", onListClick);
            exitBtn.addEventListener("click", onExit, { once: true });
            dialog.addEventListener("cancel", onCancel);
            dialog.addEventListener("close", onClose);
            if (!dialog.open) {
                dialog.showModal();
            }
            updateProgress();
        });
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
    getCurrentDate() {
        const dateInput = this.getDateInput();
        return dateInput?.value || this.getStoredReferenceDate() || this.todayIso();
    }
    getDateInput() {
        return document.getElementById("refDate");
    }
    setDate(value) {
        const dateInput = this.getDateInput();
        if (!dateInput)
            return;
        dateInput.value = value;
        this.persistReferenceDate(value);
    }
    getStoredReferenceDate() {
        const stored = localStorage.getItem(this.referenceDateStorageKey);
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
        localStorage.setItem(this.referenceDateStorageKey, normalized);
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
    toIso(date) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }
    todayIso() {
        return this.toIso(new Date());
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
        const toast = document.querySelector(".fh-floating-home-toast");
        if (!toast || toast.dataset.started === "true") {
            return;
        }
        toast.dataset.started = "true";
        const intervalMs = 15000;
        const pulse = () => {
            toast.classList.remove("is-visible");
            void toast.offsetWidth;
            toast.classList.add("is-visible");
        };
        let nextTick = performance.now() + intervalMs;
        const scheduleNext = () => {
            const delay = Math.max(0, nextTick - performance.now());
            window.setTimeout(() => {
                pulse();
                nextTick += intervalMs;
                scheduleNext();
            }, delay);
        };
        scheduleNext();
    }
    showSiteNotification(message) {
        const container = document.getElementById("siteNotifications");
        if (!container)
            return;
        const toast = document.createElement("div");
        toast.className = "fh-site-toast";
        toast.textContent = message;
        container.appendChild(toast);
        const beginClose = () => {
            toast.classList.add("is-leaving");
            const remove = () => {
                toast.removeEventListener("animationend", remove);
                toast.remove();
            };
            toast.addEventListener("animationend", remove);
        };
        window.setTimeout(beginClose, 2600);
    }
}
//# sourceMappingURL=home-controller.js.map