import { ThemeManager } from "../4.1_Core/theme-manager.js";

type PatientRecord = {
    nome: string;
    statusFinanceiro: "Pagante" | "Isento";
    horario: string;
    fisioterapeuta: string;
    celular: string;
    convenio: string;
    procedimentos: string;
};

export class PatientsController {
    private readonly appId = "app";
    private readonly pageTemplate = "1.0_HTML-Templates/1.1_Pages/pacientes.html";
    private readonly importedDataStorageKey = "fisiohub-imported-data-lines-v1";
    private readonly theme = new ThemeManager();
    private patientRecords: PatientRecord[] = [];
    private activeSearch = "";
    private activeStatusFilter: "all" | "pagante" | "isento" = "all";

    async bootstrap(): Promise<void> {
        this.theme.init();
        await this.loadPage();
        await this.resolveIncludes();
        this.patientRecords = this.parsePatientsFromStorage();
        this.bindHandlers();
        this.render();

        if (this.patientRecords.length === 0) {
            this.showSiteNotification("Nenhum paciente encontrado. Importe dados na página inicial.");
        }
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

        const tableBody = document.getElementById("patientsTableBody");
        tableBody?.addEventListener("click", (event) => {
            const target = event.target as HTMLElement;
            const button = target.closest("button[data-index]") as HTMLButtonElement | null;
            if (!button) return;

            const index = Number(button.dataset.index);
            const record = this.patientRecords[index];
            if (!record) return;

            this.openDetails(record);
        });

        const searchInput = document.getElementById("patientsSearchInput") as HTMLInputElement | null;
        searchInput?.addEventListener("input", () => {
            this.activeSearch = searchInput.value.trim().toLowerCase();
            this.render();
        });

        const statusFilter = document.getElementById("patientsStatusFilter") as HTMLSelectElement | null;
        statusFilter?.addEventListener("change", () => {
            const value = statusFilter.value;
            if (value === "all" || value === "pagante" || value === "isento") {
                this.activeStatusFilter = value;
                this.render();
            }
        });

        const dialog = this.getDetailsDialog();
        const closeButton = document.getElementById("closePatientDetailsDialogBtn");

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
                    termsDialog.classList.add("is-opening");
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
        const visibleRecords = this.getFilteredRecords();
        const total = visibleRecords.length;
        const isentos = visibleRecords.filter((record) => record.statusFinanceiro === "Isento").length;
        const pagantes = total - isentos;

        this.setText("patientsTotalCount", String(total));
        this.setText("patientsPagantesCount", String(pagantes));
        this.setText("patientsIsentosCount", String(isentos));

        const tableBody = document.getElementById("patientsTableBody") as HTMLTableSectionElement | null;
        if (!tableBody) return;

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

        visibleRecords.forEach((record, index) => {
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

    private parsePatientsFromStorage(): PatientRecord[] {
        const raw = localStorage.getItem(this.importedDataStorageKey) ?? "";
        if (!raw.trim()) {
            return [];
        }

        const lines = raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        const records: PatientRecord[] = [];
        let draft = this.createEmptyDraft();

        const pushDraft = (): void => {
            if (!draft.nome) {
                draft = this.createEmptyDraft();
                return;
            }

            records.push({ ...draft });
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

            if (key === "horario") draft.horario = value;
            if (key === "fisioterapeuta") draft.fisioterapeuta = value;
            if (key === "paciente") draft.nome = value;
            if (key === "celular") draft.celular = value;
            if (key === "convenio") draft.convenio = value;
            if (key === "procedimentos") draft.procedimentos = value;
        });

        pushDraft();

        return records.map((record) => ({
            ...record,
            statusFinanceiro: this.isIsento(record) ? "Isento" : "Pagante"
        }));
    }

    private createEmptyDraft(): PatientRecord {
        return {
            nome: "",
            statusFinanceiro: "Pagante",
            horario: "-",
            fisioterapeuta: "-",
            celular: "-",
            convenio: "-",
            procedimentos: "-"
        };
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

    private getWhatsappLink(phone: string): string | null {
        const onlyDigits = phone.replace(/\D/g, "");
        if (!onlyDigits) {
            return null;
        }

        const withCountryCode = onlyDigits.startsWith("55") ? onlyDigits : `55${onlyDigits}`;
        return `https://wa.me/${withCountryCode}`;
    }

    private openDetails(record: PatientRecord): void {
        this.setText("detailHorario", record.horario || "-");
        this.setText("detailFisioterapeuta", record.fisioterapeuta || "-");
        this.setText("detailPaciente", record.nome || "-");
        this.setText("detailCelular", record.celular || "-");
        this.setText("detailConvenio", record.convenio || "-");
        this.setText("detailProcedimentos", record.procedimentos || "-");

        const whatsappLink = document.getElementById("detailWhatsappLink") as HTMLAnchorElement | null;
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

    private getDetailsDialog(): HTMLDialogElement {
        return document.getElementById("patientDetailsDialog") as HTMLDialogElement;
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
        }, 260);

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

    private getFilteredRecords(): PatientRecord[] {
        return this.patientRecords.filter((record) => {
            const statusKind = record.statusFinanceiro.toLowerCase() as "pagante" | "isento";
            const statusMatches = this.activeStatusFilter === "all" || statusKind === this.activeStatusFilter;

            const searchBase = `${record.nome} ${record.fisioterapeuta} ${record.convenio} ${record.celular}`.toLowerCase();
            const searchMatches = !this.activeSearch || searchBase.includes(this.activeSearch);

            return statusMatches && searchMatches;
        });
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
