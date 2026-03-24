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
    private readonly processedDataStorageKey = "fisiohub-processed-data-v2";
    private readonly patientsRecordsStorageKey = "fisiohub-patients-records-v2";
    private readonly legacyImportedDataStorageKey = "fisiohub-imported-data-lines-v1";
    private readonly theme = new ThemeManager();
    private patientRecords: PatientRecord[] = [];
    private activeSearch = "";
    private activeStatusFilter: "all" | "pagante" | "isento" = "all";
    private activeOrderFilter: "az" | "za" = "az";

    async bootstrap(): Promise<void> {
        this.theme.init();
        await this.loadPage();
        await this.resolveIncludes();
        this.patientRecords = this.parsePatientsFromStorage();
        this.bindHandlers();
        this.render();
        this.startFloatingHomeHint();

        if (this.patientRecords.length === 0) {
            this.showSiteNotification("Nenhum paciente encontrado. Processe os dados na pagina inicial.");
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

        const orderFilter = document.getElementById("patientsOrderFilter") as HTMLSelectElement | null;
        orderFilter?.addEventListener("change", () => {
            const value = orderFilter.value;
            if (value === "az" || value === "za") {
                this.activeOrderFilter = value;
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

    private parsePatientsFromStorage(): PatientRecord[] {
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

    private parsePatientsRecords(raw: string | null): PatientRecord[] {
        if (!raw) return [];

        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];

            return parsed.map((item) => {
                const candidate = item as Partial<PatientRecord>;
                const status: PatientRecord["statusFinanceiro"] = candidate.statusFinanceiro === "Isento" ? "Isento" : "Pagante";

                return {
                    nome: typeof candidate.nome === "string" ? candidate.nome : "",
                    statusFinanceiro: status,
                    horario: typeof candidate.horario === "string" ? candidate.horario : "-",
                    fisioterapeuta: typeof candidate.fisioterapeuta === "string" ? candidate.fisioterapeuta : "-",
                    celular: typeof candidate.celular === "string" ? candidate.celular : "-",
                    convenio: typeof candidate.convenio === "string" ? candidate.convenio : "-",
                    procedimentos: typeof candidate.procedimentos === "string" ? candidate.procedimentos : "-"
                };
            }).filter((record) => record.nome.trim().length > 0);
        } catch {
            return [];
        }
    }

    private parsePatientsFromLines(raw: string): PatientRecord[] {
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

    private getFilteredRecords(): PatientRecord[] {
        const filtered = this.patientRecords.filter((record) => {
            const statusKind = record.statusFinanceiro.toLowerCase() as "pagante" | "isento";
            const statusMatches = this.activeStatusFilter === "all" || statusKind === this.activeStatusFilter;

            const searchBase = `${record.nome} ${record.fisioterapeuta} ${record.convenio} ${record.celular}`.toLowerCase();
            const searchMatches = !this.activeSearch || searchBase.includes(this.activeSearch);

            return statusMatches && searchMatches;
        });

        filtered.sort((a, b) => {
            const factor = this.activeOrderFilter === "za" ? -1 : 1;
            return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) * factor;
        });

        return filtered;
    }

    private startFloatingHomeHint(): void {
        const toast = document.querySelector(".fh-floating-home-toast") as HTMLElement | null;
        if (!toast || toast.dataset.started === "true") {
            return;
        }

        toast.dataset.started = "true";

        const pulse = (): void => {
            toast.classList.remove("is-visible");
            void toast.offsetWidth;
            toast.classList.add("is-visible");
        };

        window.setTimeout(pulse, 1200);
        window.setInterval(pulse, 5000);
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
