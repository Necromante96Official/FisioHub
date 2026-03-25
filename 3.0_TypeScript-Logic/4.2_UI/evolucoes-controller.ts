import { ThemeManager } from "../4.1_Core/theme-manager.js";

type PendingEvolutionRecord = {
    nome: string;
    dataIso: string;
    horario: string;
    procedimento: string;
    assinatura: string;
};

type ProcessedMeta = {
    processedAtIso: string;
    referenceDateIso: string;
    totalImportedLines: number;
    totalPatients: number;
    totalForReferenceDate: number;
};

export class EvolucoesController {
    private readonly appId = "app";
    private readonly pageTemplate = "1.0_HTML-Templates/1.1_Pages/evolucoes.html";
    private readonly processedDataStorageKey = "fisiohub-processed-data-v2";
    private readonly processedMetaStorageKey = "fisiohub-processed-meta-v2";
    private readonly doneEvolutionsStorageKey = "fisiohub-evolucoes-realizadas-v1";
    private readonly theme = new ThemeManager();

    private pendingRecords: PendingEvolutionRecord[] = [];

    async bootstrap(): Promise<void> {
        this.theme.init();
        await this.loadPage();
        await this.resolveIncludes();
        this.bindHandlers();
        this.render();
        this.startFloatingHomeHint();

        window.addEventListener("storage", (event) => {
            if (event.key && !event.key.startsWith("fisiohub-")) {
                return;
            }

            this.render();
        });
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
            const button = target.closest("button[data-signature]") as HTMLButtonElement | null;
            if (!button) return;

            const signature = button.dataset.signature;
            if (!signature) return;

            this.markAsDone(signature);
        });

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
    }

    private render(): void {
        this.pendingRecords = this.getPendingRecords();

        const uniquePatients = new Set(this.pendingRecords.map((record) => this.normalizeText(record.nome)));
        this.setText("pendingPatientsCount", String(uniquePatients.size));
        this.setText("pendingEvolutionsCount", String(this.pendingRecords.length));

        const referenceDateIso = this.getReferenceDateIso();
        const referenceDateText = referenceDateIso ? this.formatDate(referenceDateIso) : "-";
        this.setText("pendingReferenceDate", `Data de referencia: ${referenceDateText}`);

        const tableBody = document.getElementById("pendingEvolutionsTableBody") as HTMLTableSectionElement | null;
        if (!tableBody) return;

        tableBody.innerHTML = "";

        if (this.pendingRecords.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 5;
            cell.className = "fh-evolucoes-empty";
            cell.textContent = "Nenhuma evolucao pendente encontrada.";
            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }

        this.pendingRecords.forEach((record) => {
            const row = document.createElement("tr");

            const nameCell = document.createElement("td");
            nameCell.textContent = record.nome;

            const dateCell = document.createElement("td");
            dateCell.textContent = this.formatDate(record.dataIso);

            const timeCell = document.createElement("td");
            timeCell.textContent = record.horario;

            const procedureCell = document.createElement("td");
            procedureCell.textContent = record.procedimento;

            const actionCell = document.createElement("td");
            const doneButton = document.createElement("button");
            doneButton.type = "button";
            doneButton.className = "fh-evolucao-done-btn";
            doneButton.dataset.signature = record.assinatura;
            doneButton.textContent = "Evoluido";
            actionCell.appendChild(doneButton);

            row.appendChild(nameCell);
            row.appendChild(dateCell);
            row.appendChild(timeCell);
            row.appendChild(procedureCell);
            row.appendChild(actionCell);

            tableBody.appendChild(row);
        });
    }

    private getPendingRecords(): PendingEvolutionRecord[] {
        const processedRaw = localStorage.getItem(this.processedDataStorageKey) ?? "";
        if (!processedRaw.trim()) {
            return [];
        }

        const doneSignatures = this.readDoneSignatures();
        const referenceDateIso = this.getReferenceDateIso() ?? this.todayIso();

        const records = this.parseProcessedLines(processedRaw, referenceDateIso);
        return records.filter((record) => !doneSignatures.has(record.assinatura));
    }

    private parseProcessedLines(raw: string, referenceDateIso: string): PendingEvolutionRecord[] {
        const lines = raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        const results: PendingEvolutionRecord[] = [];

        let nome = "";
        let horario = "-";
        let procedimento = "-";
        let status = "";
        let dataIso = referenceDateIso;

        const pushDraft = (): void => {
            if (!nome) {
                nome = "";
                horario = "-";
                procedimento = "-";
                status = "";
                dataIso = referenceDateIso;
                return;
            }

            if (!this.isPendingStatus(status)) {
                nome = "";
                horario = "-";
                procedimento = "-";
                status = "";
                dataIso = referenceDateIso;
                return;
            }

            const assinatura = this.makeSignature(nome, dataIso, horario, procedimento);
            results.push({
                nome,
                dataIso,
                horario,
                procedimento,
                assinatura
            });

            nome = "";
            horario = "-";
            procedimento = "-";
            status = "";
            dataIso = referenceDateIso;
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

            const key = this.normalizeText(entryMatch[1]);
            const value = entryMatch[2].trim();

            if (key === "paciente") nome = value;
            if (key === "horario") horario = value || "-";
            if (key === "procedimentos" || key === "procedimento") procedimento = this.sanitizeProcedure(value);
            if (key === "status" || key === "situacao") status = value;
            if (key === "data") {
                const extracted = this.extractIsoDate(value);
                if (extracted) {
                    dataIso = extracted;
                }
            }
        });

        pushDraft();

        return results;
    }

    private isPendingStatus(status: string): boolean {
        const normalized = this.normalizeText(status);
        return normalized.includes("presenca confirmada");
    }

    private sanitizeProcedure(value: string): string {
        return value.replace(/\s*observa[cç][oõ]es\s*:[\s\S]*$/i, "").trim() || "-";
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
        this.showSiteNotification("Evolucao marcada como concluida.");
    }

    private makeSignature(nome: string, dataIso: string, horario: string, procedimento: string): string {
        const normalizedName = this.normalizeText(nome);
        const normalizedTime = this.normalizeText(horario);
        const normalizedProcedure = this.normalizeText(procedimento);
        return `${normalizedName}|${dataIso}|${normalizedTime}|${normalizedProcedure}`;
    }

    private normalizeText(value: string): string {
        return value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
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

    private getTermsDialog(): HTMLDialogElement {
        return document.getElementById("termsDialog") as HTMLDialogElement;
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

    private setText(id: string, text: string): void {
        const element = document.getElementById(id);
        if (!element) return;
        element.textContent = text;
    }
}
