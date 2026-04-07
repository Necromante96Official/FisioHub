import { ThemeManager } from "../4.1_Core/theme-manager.js";
import { FISIOHUB_STORAGE_KEYS, type EvolucoesPendingBatch, type ProcessedMeta } from "../4.0_Shared/fisiohub-models.js";
import { bindAnalysisDialog, bindFisioHubStorageListener, bindHoverToasts as sharedBindHoverToasts, bindTermsDialog, showSiteNotification as sharedShowSiteNotification, startFloatingHomeHint as sharedStartFloatingHomeHint, syncFooterMetadata } from "../4.0_Shared/ui-feedback.js";

type PendingEvolutionRecord = {
    nome: string;
    dataIso: string;
    dataLabel: string;
    horario: string;
    procedimento: string;
    assinatura: string;
    nomeNormalizado: string;
    procedimentoNormalizado: string;
    statusNormalizado: string;
    searchIndex: string;
};

type PendingEvolutionGroup = {
    nome: string;
    nomeNormalizado: string;
    records: PendingEvolutionRecord[];
};

type PendingDraft = {
    nome: string;
    dataIso: string;
    horario: string;
    procedimento: string;
    status: string;
};

type SortOption = "name-asc" | "pending-desc" | "pending-asc";

type DateMode = "all" | "specific" | "week" | "month" | "year";

export class EvolucoesController {
    private readonly appId = "app";
    private readonly pageTemplate = "1.0_HTML-Templates/1.1_Pages/evolucoes.html";
    private readonly processedDataStorageKey = FISIOHUB_STORAGE_KEYS.PROCESSED_DATA;
    private readonly processedMetaStorageKey = FISIOHUB_STORAGE_KEYS.PROCESSED_META;
    private readonly evolucoesPendingHistoryStorageKey = FISIOHUB_STORAGE_KEYS.EVOLUCOES_PENDING_HISTORY;
    private readonly doneEvolutionsStorageKey = FISIOHUB_STORAGE_KEYS.DONE_EVOLUTIONS;
    private readonly theme = new ThemeManager();

    private allPendingRecords: PendingEvolutionRecord[] = [];
    private visiblePendingRecords: PendingEvolutionRecord[] = [];
    private selectedPatientKey: string | null = null;
    private activeSearch = "";
    private activeDateMode: DateMode = "all";
    private activeSpecificDate = this.todayIso();
    private activeWeekDate = this.todayIso();
    private activeMonth = this.todayIso().slice(0, 7);
    private activeYear = this.todayIso().slice(0, 4);
    private activeProcedureFilter = "all";
    private activeSort: SortOption = "name-asc";

    async bootstrap(): Promise<void> {
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
        const stopFloatingHomeHint = sharedStartFloatingHomeHint();
        const disposeStorageListener = bindFisioHubStorageListener(() => {
            this.render();
        });
        const cleanup = (): void => {
            stopFloatingHomeHint();
            disposeStorageListener();
        };

        window.addEventListener("beforeunload", cleanup, { once: true });
    }

    private async loadPage(): Promise<void> {
        const app = document.getElementById(this.appId);
        if (!app) return;

        const html = await fetch(this.pageTemplate).then((response) => response.text());
        app.innerHTML = html;
    }

    private async resolveIncludes(): Promise<void> {
        let nodes = Array.from(document.querySelectorAll("[data-include]"));

        while (nodes.length > 0) {
            for (const node of nodes) {
                const path = node.getAttribute("data-include");
                if (!path) continue;

                const html = await fetch(path).then((response) => response.text());
                node.outerHTML = html;
            }

            nodes = Array.from(document.querySelectorAll("[data-include]"));
        }
    }

    private bindHandlers(): void {
        const modules = Array.from(document.querySelectorAll(".fh-module-card")) as HTMLAnchorElement[];
        modules.forEach((link) => {
            link.addEventListener("click", () => {
                const target = link.getAttribute("data-target");
                if (!target) return;
                window.location.href = target;
            });
        });

        const tableBody = document.getElementById("pendingEvolutionsTableBody") as HTMLTableSectionElement | null;
        tableBody?.addEventListener("click", (event) => {
            const target = event.target as HTMLElement;
            const detailsButton = target.closest("button[data-patient-details]") as HTMLButtonElement | null;
            if (detailsButton) {
                const patientKey = detailsButton.dataset.patientDetails;
                if (!patientKey) return;
                this.openDetails(patientKey);
                return;
            }

            const button = target.closest("button[data-signature]") as HTMLButtonElement | null;
            if (!button) return;

            const signature = button.dataset.signature;
            if (!signature) return;

            this.markAsDone(signature);
        });

        const searchInput = document.getElementById("evolucoesSearchInput") as HTMLInputElement | null;
        searchInput?.addEventListener("input", () => {
            this.activeSearch = this.normalizeForSearch(searchInput.value);
            this.render();
        });

        const dateMode = document.getElementById("evolucoesDateMode") as HTMLSelectElement | null;
        dateMode?.addEventListener("change", () => {
            const value = dateMode.value;
            if (value === "all" || value === "specific" || value === "week" || value === "month" || value === "year") {
                this.activeDateMode = value;
                this.syncDateControls();
                this.render();
            }
        });

        const specificDate = document.getElementById("evolucoesSpecificDate") as HTMLInputElement | null;
        specificDate?.addEventListener("change", () => {
            this.activeSpecificDate = specificDate.value || this.todayIso();
            this.render();
        });

        const weekDate = document.getElementById("evolucoesWeekDate") as HTMLInputElement | null;
        weekDate?.addEventListener("change", () => {
            this.activeWeekDate = weekDate.value || this.todayIso();
            this.render();
        });

        const monthDate = document.getElementById("evolucoesMonthDate") as HTMLInputElement | null;
        monthDate?.addEventListener("change", () => {
            this.activeMonth = monthDate.value || this.todayIso().slice(0, 7);
            this.render();
        });

        const yearInput = document.getElementById("evolucoesYearInput") as HTMLInputElement | null;
        yearInput?.addEventListener("change", () => {
            this.activeYear = yearInput.value || this.todayIso().slice(0, 4);
            this.render();
        });

        const procedureFilter = document.getElementById("evolucoesProcedureFilter") as HTMLSelectElement | null;
        procedureFilter?.addEventListener("change", () => {
            this.activeProcedureFilter = procedureFilter.value;
            this.render();
        });

        const sortSelect = document.getElementById("evolucoesSortSelect") as HTMLSelectElement | null;
        sortSelect?.addEventListener("change", () => {
            const value = sortSelect.value;
            if (value === "name-asc" || value === "pending-desc" || value === "pending-asc") {
                this.activeSort = value;
                this.render();
            }
        });

        const dialog = this.getDetailsDialog();
        const closeButton = document.getElementById("closeEvolucoesDetailsBtn");

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
            this.selectedPatientKey = null;
        });

        dialog.addEventListener("click", (event) => {
            const target = event.target as HTMLElement;
            const doneButton = target.closest("button[data-signature]") as HTMLButtonElement | null;
            if (!doneButton) return;

            const signature = doneButton.dataset.signature;
            if (!signature) return;

            this.markAsDone(signature);
        });

    }

    private render(): void {
        this.allPendingRecords = this.getPendingRecords();
        this.syncFilters(this.allPendingRecords);
        this.visiblePendingRecords = this.getVisibleRecords(this.allPendingRecords);

        const visibleGroups = this.groupRecordsByPatient(this.visiblePendingRecords);
        const countsByPatient = new Map<string, number>();
        visibleGroups.forEach((group) => {
            countsByPatient.set(group.nomeNormalizado, group.records.length);
        });
        const uniquePatients = new Set(this.visiblePendingRecords.map((record) => record.nomeNormalizado));
        this.setText("pendingPatientsCount", String(uniquePatients.size));
        this.setText("pendingEvolutionsCount", String(this.visiblePendingRecords.length));

        const tableBody = document.getElementById("pendingEvolutionsTableBody") as HTMLTableSectionElement | null;
        if (!tableBody) return;

        tableBody.innerHTML = "";

        if (this.visiblePendingRecords.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 5;
            cell.className = "fh-evolucoes-empty";
            cell.textContent = "Nenhuma evolucao pendente encontrada para os filtros atuais.";
            row.appendChild(cell);
            tableBody.appendChild(row);
            this.renderSelectedModal();
            return;
        }

        visibleGroups.forEach((group) => {
            const firstRecord = group.records[0];

            const row = document.createElement("tr");

            const nameCell = document.createElement("td");
            nameCell.textContent = group.nome;

            const detailsCell = document.createElement("td");
            const detailsButton = document.createElement("button");
            detailsButton.type = "button";
            detailsButton.className = "fh-evolucao-details-btn";
            detailsButton.dataset.patientDetails = group.nomeNormalizado;
            detailsButton.textContent = "Ver mais...";
            detailsCell.appendChild(detailsButton);

            const timeCell = document.createElement("td");
            timeCell.textContent = firstRecord.horario;

            const procedureCell = document.createElement("td");
            procedureCell.textContent = firstRecord.procedimento;

            const pendingCell = document.createElement("td");
            pendingCell.textContent = String(countsByPatient.get(group.nomeNormalizado) ?? group.records.length);

            row.appendChild(nameCell);
            row.appendChild(timeCell);
            row.appendChild(procedureCell);
            row.appendChild(pendingCell);
            row.appendChild(detailsCell);

            tableBody.appendChild(row);
        });

        this.renderSelectedModal();
    }

    private groupRecordsByPatient(records: PendingEvolutionRecord[]): PendingEvolutionGroup[] {
        const groups = new Map<string, PendingEvolutionGroup>();

        records.forEach((record) => {
            const existing = groups.get(record.nomeNormalizado);
            if (existing) {
                existing.records.push(record);
                return;
            }

            groups.set(record.nomeNormalizado, {
                nome: record.nome,
                nomeNormalizado: record.nomeNormalizado,
                records: [record]
            });
        });

        const orderedGroups = Array.from(groups.values());
        orderedGroups.sort((groupA, groupB) => {
            const firstA = groupA.records[0];
            const firstB = groupB.records[0];
            const byName = groupA.nome.localeCompare(groupB.nome, "pt-BR", { sensitivity: "base" });

            if (this.activeSort === "name-asc") {
                if (byName !== 0) return byName;
                return firstA.dataIso.localeCompare(firstB.dataIso) || firstA.horario.localeCompare(firstB.horario);
            }

            const countA = groupA.records.length;
            const countB = groupB.records.length;

            if (this.activeSort === "pending-desc") {
                if (countB !== countA) return countB - countA;
                if (byName !== 0) return byName;
                return firstA.dataIso.localeCompare(firstB.dataIso) || firstA.horario.localeCompare(firstB.horario);
            }

            if (countA !== countB) return countA - countB;
            if (byName !== 0) return byName;
            return firstA.dataIso.localeCompare(firstB.dataIso) || firstA.horario.localeCompare(firstB.horario);
        });

        return orderedGroups;
    }

    private syncFilters(records: PendingEvolutionRecord[]): void {
        this.syncDateControls();

        const dateMode = document.getElementById("evolucoesDateMode") as HTMLSelectElement | null;
        const procedureFilter = document.getElementById("evolucoesProcedureFilter") as HTMLSelectElement | null;
        if (!dateMode || !procedureFilter) return;

        const currentProcedure = this.activeProcedureFilter;

        const procedures = Array.from(new Set(records.map((record) => record.procedimento))).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

        procedureFilter.innerHTML = `<option value="all">Todos os procedimentos</option>${procedures.map((procedure) => `<option value="${this.escapeHtmlAttr(procedure)}">${this.escapeHtml(procedure)}</option>`).join("")}`;

        this.activeProcedureFilter = procedures.includes(currentProcedure) ? currentProcedure : "all";
        procedureFilter.value = this.activeProcedureFilter;
    }

    private getVisibleRecords(records: PendingEvolutionRecord[]): PendingEvolutionRecord[] {
        const searchTokens = this.activeSearch.split(" ").map((token) => token.trim()).filter((token) => token.length > 0);

        const filtered = records.filter((record) => {
            if (!this.matchesDateMode(record.dataIso)) {
                return false;
            }

            if (this.activeProcedureFilter !== "all" && record.procedimento !== this.activeProcedureFilter) {
                return false;
            }

            if (searchTokens.length > 0) {
                const matchesAll = searchTokens.every((token) => record.searchIndex.includes(token));
                if (!matchesAll) {
                    return false;
                }
            }

            return true;
        });

        const countsByPatient = new Map<string, number>();
        filtered.forEach((record) => {
            countsByPatient.set(record.nomeNormalizado, (countsByPatient.get(record.nomeNormalizado) ?? 0) + 1);
        });

        filtered.sort((a, b) => {
            const byName = a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });

            if (this.activeSort === "name-asc") {
                if (byName !== 0) return byName;
                return a.dataIso.localeCompare(b.dataIso) || a.horario.localeCompare(b.horario);
            }

            const countA = countsByPatient.get(a.nomeNormalizado) ?? 0;
            const countB = countsByPatient.get(b.nomeNormalizado) ?? 0;

            if (this.activeSort === "pending-desc") {
                if (countB !== countA) return countB - countA;
                if (byName !== 0) return byName;
                return a.dataIso.localeCompare(b.dataIso) || a.horario.localeCompare(b.horario);
            }

            if (countA !== countB) return countA - countB;
            if (byName !== 0) return byName;
            return a.dataIso.localeCompare(b.dataIso) || a.horario.localeCompare(b.horario);
        });

        return filtered;
    }

    private getCountsByPatient(records: PendingEvolutionRecord[]): Map<string, number> {
        const counts = new Map<string, number>();
        records.forEach((record) => {
            counts.set(record.nomeNormalizado, (counts.get(record.nomeNormalizado) ?? 0) + 1);
        });
        return counts;
    }

    private renderSelectedModal(): void {
        const dialog = this.getDetailsDialog();
        const list = document.getElementById("evolucoesDetailsList") as HTMLDivElement | null;
        const title = document.getElementById("evolucoesDetailsTitle");
        const subtitle = document.getElementById("evolucoesDetailsSubtitle");
        const count = document.getElementById("evolucoesDetailsCount");
        const emptyState = document.getElementById("evolucoesDetailsEmpty");

        const selectedGroup = this.selectedPatientKey
            ? this.groupRecordsByPatient(this.allPendingRecords).find((group) => group.nomeNormalizado === this.selectedPatientKey) ?? null
            : null;

        if (!selectedGroup) {
            if (dialog.open) {
                dialog.close();
            }

            if (list) list.innerHTML = "";
            if (title) title.textContent = "-";
            if (subtitle) subtitle.textContent = "-";
            if (count) count.textContent = "0 item(ns) pendente(s)";
            if (emptyState) emptyState.hidden = false;
            return;
        }

        if (title) title.textContent = selectedGroup.nome;
        if (subtitle) subtitle.textContent = "Todas as pendências deste paciente aparecem abaixo, uma por data.";
        if (count) count.textContent = `${selectedGroup.records.length} item(ns) pendente(s)`;

        if (!list) return;

        const orderedRecords = this.sortRecordsByDateDesc(selectedGroup.records);

        if (orderedRecords.length === 0) {
            list.innerHTML = "";
            if (emptyState) emptyState.hidden = false;
        } else {
            if (emptyState) emptyState.hidden = true;
            list.innerHTML = orderedRecords.map((record) => `
                <article class="fh-evolucoes-dialog-item">
                    <div class="fh-evolucoes-dialog-item-main">
                        <strong>${this.escapeHtml(record.dataLabel)}</strong>
                        <span>${this.escapeHtml(record.horario)}</span>
                    </div>
                    <p>${this.escapeHtml(record.procedimento)}</p>
                    <div class="fh-evolucoes-dialog-item-actions">
                        <button type="button" class="fh-btn fh-evolucao-done-btn" data-signature="${this.escapeHtmlAttr(record.assinatura)}">Evoluído</button>
                    </div>
                </article>
            `).join("");
        }

        if (!dialog.open) {
            dialog.showModal();
        }
    }

    private openDetails(patientKey: string): void {
        this.selectedPatientKey = patientKey;
        this.renderSelectedModal();
    }

    private getDetailsDialog(): HTMLDialogElement {
        return document.getElementById("evolucoesDetailsDialog") as HTMLDialogElement;
    }

    private sortRecordsByDateDesc(records: PendingEvolutionRecord[]): PendingEvolutionRecord[] {
        return [...records].sort((a, b) => {
            if (a.dataIso !== b.dataIso) {
                return b.dataIso.localeCompare(a.dataIso);
            }

            return b.horario.localeCompare(a.horario);
        });
    }

    private matchesDateMode(recordDateIso: string): boolean {
        if (this.activeDateMode === "all") {
            return true;
        }

        if (this.activeDateMode === "specific") {
            return this.normalizeDateIso(this.activeSpecificDate) === recordDateIso;
        }

        if (this.activeDateMode === "month") {
            const activeMonth = this.activeMonth.match(/^\d{4}-\d{2}$/) ? this.activeMonth : this.todayIso().slice(0, 7);
            return recordDateIso.startsWith(activeMonth);
        }

        if (this.activeDateMode === "year") {
            const activeYear = this.activeYear.match(/^\d{4}$/) ? this.activeYear : this.todayIso().slice(0, 4);
            return recordDateIso.startsWith(activeYear);
        }

        if (this.activeDateMode === "week") {
            const weekDate = this.normalizeDateIso(this.activeWeekDate) ?? this.todayIso();
            const bounds = this.getWeekBounds(weekDate);
            return recordDateIso >= bounds.start && recordDateIso <= bounds.end;
        }

        return true;
    }

    private getWeekBounds(referenceIso: string): { start: string; end: string } {
        const referenceDate = new Date(`${referenceIso}T00:00:00`);
        const weekday = referenceDate.getDay();
        const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
        const fridayOffset = mondayOffset + 4;

        const startDate = new Date(referenceDate);
        startDate.setDate(referenceDate.getDate() + mondayOffset);

        const endDate = new Date(referenceDate);
        endDate.setDate(referenceDate.getDate() + fridayOffset);

        return {
            start: this.toIsoDate(startDate),
            end: this.toIsoDate(endDate)
        };
    }

    private toIsoDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    private syncDateControls(): void {
        const dateMode = document.getElementById("evolucoesDateMode") as HTMLSelectElement | null;
        const controls = Array.from(document.querySelectorAll(".fh-date-mode-field")) as HTMLInputElement[];

        if (dateMode) {
            dateMode.value = this.activeDateMode;
        }

        controls.forEach((control) => {
            const mode = control.dataset.mode as DateMode | undefined;
            const active = mode === this.activeDateMode;
            control.classList.toggle("is-active", active);

            if (mode === "specific" && !control.value) {
                control.value = this.activeSpecificDate;
            }
            if (mode === "week" && !control.value) {
                control.value = this.activeWeekDate;
            }
            if (mode === "month" && !control.value) {
                control.value = this.activeMonth;
            }
            if (mode === "year" && !control.value) {
                control.value = this.activeYear;
            }
        });

        const specificDate = document.getElementById("evolucoesSpecificDate") as HTMLInputElement | null;
        const weekDate = document.getElementById("evolucoesWeekDate") as HTMLInputElement | null;
        const monthDate = document.getElementById("evolucoesMonthDate") as HTMLInputElement | null;
        const yearInput = document.getElementById("evolucoesYearInput") as HTMLInputElement | null;

        if (specificDate) specificDate.value = this.activeSpecificDate;
        if (weekDate) weekDate.value = this.activeWeekDate;
        if (monthDate) monthDate.value = this.activeMonth;
        if (yearInput) yearInput.value = this.activeYear;
    }

    private getPendingRecords(): PendingEvolutionRecord[] {
        const doneSignatures = this.readDoneSignatures();
        const batches = this.readEvolucoesPendingBatches();
        const allRecords: PendingEvolutionRecord[] = [];

        batches.forEach((batch, batchIndex) => {
            const records = this.parseProcessedLines(batch.lines.join("\n"), batch.referenceDateIso);
            records.forEach((record, recordIndex) => {
                allRecords.push({
                    ...record,
                    // Mantem cada item enviado em cada processamento como registro independente.
                    assinatura: `${batch.processedAtIso}|${batchIndex}|${recordIndex}|${record.assinatura}`
                });
            });
        });

        return allRecords.filter((record) => !doneSignatures.has(record.assinatura));
    }

    private readEvolucoesPendingBatches(): EvolucoesPendingBatch[] {
        const history = this.readEvolucoesPendingHistory();
        if (history.length > 0) {
            return history;
        }

        const processedRaw = localStorage.getItem(this.processedDataStorageKey) ?? "";
        if (!processedRaw.trim()) {
            return [];
        }

        return [{
            processedAtIso: this.getReferenceDateIso() ?? new Date().toISOString(),
            referenceDateIso: this.getReferenceDateIso() ?? this.todayIso(),
            lines: processedRaw.split(/\r?\n/)
        }];
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
                        ? candidate.lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
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

    private parseProcessedLines(raw: string, referenceDateIso: string): PendingEvolutionRecord[] {
        const lines = raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        const results: PendingEvolutionRecord[] = [];
        let draft: PendingDraft = this.createEmptyDraft(referenceDateIso);

        const pushDraft = (): void => {
            const normalized = this.normalizeDraft(draft);
            draft = this.createEmptyDraft(referenceDateIso);

            if (!normalized) {
                return;
            }

            results.push(normalized);
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

            const key = this.normalizeFieldKey(entryMatch[1]);
            const value = entryMatch[2].trim();

            if (key === "paciente" || key === "nome") draft.nome = value;
            if (key === "horario") draft.horario = value || "-";
            if (key === "procedimentos" || key === "procedimento") draft.procedimento = value;
            if (key === "status" || key === "situacao") draft.status = value;
            if (key === "data") {
                const extracted = this.extractIsoDate(value);
                if (extracted) {
                    draft.dataIso = extracted;
                }
            }
        });

        pushDraft();

        return results;
    }

    private createEmptyDraft(referenceDateIso: string): PendingDraft {
        return {
            nome: "",
            dataIso: referenceDateIso,
            horario: "-",
            procedimento: "-",
            status: ""
        };
    }

    private normalizeDraft(draft: PendingDraft): PendingEvolutionRecord | null {
        const nome = this.normalizePatientName(draft.nome);
        if (!nome) return null;

        const statusNormalizado = this.normalizeStatus(draft.status);
        if (statusNormalizado !== "presenca confirmada") {
            return null;
        }

        const dataIso = this.normalizeDateIso(draft.dataIso) ?? this.todayIso();
        const horario = this.normalizeClock(draft.horario);
        const procedimento = this.normalizeProcedure(draft.procedimento);
        const nomeNormalizado = this.normalizeForSearch(nome);
        const procedimentoNormalizado = this.normalizeForSearch(procedimento);
        const assinatura = this.makeSignature(nome, dataIso, horario, procedimento);
        const dataLabel = this.formatDate(dataIso);
        const searchIndex = this.buildSearchIndex(nome, dataIso, dataLabel, horario, procedimento, statusNormalizado);

        return {
            nome,
            dataIso,
            dataLabel,
            horario,
            procedimento,
            assinatura,
            nomeNormalizado,
            procedimentoNormalizado,
            statusNormalizado,
            searchIndex
        };
    }

    private normalizeStatus(value: string): string {
        const normalized = this.normalizeForSearch(value);
        if (normalized.includes("presenca confirmada")) return "presenca confirmada";
        if (normalized.includes("nao atendido")) return "nao atendido";
        if (normalized.includes("faltou")) return "faltou";
        if (normalized === "atendido" || (normalized.includes("atendido") && !normalized.includes("nao") && !normalized.includes("presenca"))) {
            return "atendido";
        }
        return normalized;
    }

    private normalizePatientName(value: string): string {
        const clean = value.replace(/\s+/g, " ").trim();
        return clean || "";
    }

    private normalizeProcedure(value: string): string {
        const sanitized = value.replace(/\s*observa[cç][oõ]es\s*:[\s\S]*$/i, "").replace(/\s+/g, " ").trim();
        return sanitized || "-";
    }

    private normalizeClock(value: string): string {
        const clean = value.replace(/\s+/g, " ").trim();
        return clean || "-";
    }

    private normalizeDateIso(value: string): string | null {
        const extracted = this.extractIsoDate(value);
        if (!extracted) return null;

        const date = new Date(`${extracted}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return extracted;
    }

    private normalizeFieldKey(value: string): string {
        return this.normalizeForSearch(value).replace(/\s+/g, "");
    }

    private buildSearchIndex(
        nome: string,
        dataIso: string,
        dataLabel: string,
        horario: string,
        procedimento: string,
        status: string
    ): string {
        const joined = [nome, dataIso, dataLabel, horario, procedimento, status].join(" ");
        return this.normalizeForSearch(joined);
    }

    private getReferenceDateIso(): string | null {
        const raw = localStorage.getItem(this.processedMetaStorageKey);
        if (!raw) return null;

        try {
            const parsed = JSON.parse(raw) as Partial<ProcessedMeta>;
            if (typeof parsed.referenceDateIso !== "string") {
                return null;
            }

            const date = new Date(parsed.referenceDateIso);
            if (Number.isNaN(date.getTime())) {
                return null;
            }

            return parsed.referenceDateIso;
        } catch {
            return null;
        }
    }

    private extractIsoDate(value: string): string | null {
        const isoMatch = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
        if (isoMatch) {
            return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
        }

        const brMatch = value.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
        if (brMatch) {
            return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
        }

        return null;
    }

    private readDoneSignatures(): Set<string> {
        const raw = localStorage.getItem(this.doneEvolutionsStorageKey);
        if (!raw) return new Set();

        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return new Set();

            const normalized = parsed
                .filter((item) => typeof item === "string")
                .map((item) => item.trim())
                .filter((item) => item.length > 0);

            return new Set(normalized);
        } catch {
            return new Set();
        }
    }

    private markAsDone(signature: string): void {
        const doneSignatures = this.readDoneSignatures();
        doneSignatures.add(signature);
        localStorage.setItem(this.doneEvolutionsStorageKey, JSON.stringify(Array.from(doneSignatures)));

        this.render();
        this.showSiteNotification("Evolução marcada como concluída.");
    }

    private makeSignature(nome: string, dataIso: string, horario: string, procedimento: string): string {
        const normalizedName = this.normalizeForSearch(nome);
        const normalizedTime = this.normalizeForSearch(horario);
        const normalizedProcedure = this.normalizeForSearch(procedimento);
        return `${normalizedName}|${dataIso}|${normalizedTime}|${normalizedProcedure}`;
    }

    private normalizeForSearch(value: string): string {
        return value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    private escapeHtml(value: string): string {
        return value
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    private escapeHtmlAttr(value: string): string {
        return this.escapeHtml(value);
    }

    private formatDate(isoDate: string): string {
        const date = new Date(`${isoDate}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return "-";
        }

        return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
    }

    private todayIso(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    private startFloatingHomeHint(): void {
        sharedStartFloatingHomeHint();
    }

    private showSiteNotification(message: string): void {
        sharedShowSiteNotification(message);
    }

    private setText(id: string, text: string): void {
        const element = document.getElementById(id);
        if (!element) return;
        element.textContent = text;
    }
}
