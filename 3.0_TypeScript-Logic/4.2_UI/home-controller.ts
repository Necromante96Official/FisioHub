import { ThemeManager } from "../4.1_Core/theme-manager.js";

type ImportedItem = {
    raw: string;
    dateIso: string | null;
};

export class HomeController {
    private readonly appId = "app";
    private readonly homeTemplate = "1.0_HTML-Templates/1.1_Pages/home.html";
    private readonly theme = new ThemeManager();
    private importedItems: ImportedItem[] = [];

    async bootstrap(): Promise<void> {
        this.theme.init();
        await this.loadHome();
        await this.resolveIncludes();
        this.setDate(this.todayIso());
        this.bindHandlers();
        this.renderImportedData();
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
            this.importContent(content);
            fileInput.value = "";
        });

        const clearBtn = document.getElementById("clearDataBtn");
        clearBtn?.addEventListener("click", () => {
            this.importedItems = [];
            this.renderImportedData();
        });

        const processBtn = document.getElementById("processBtn");
        processBtn?.addEventListener("click", () => {
            const date = this.getCurrentDate();
            const filtered = this.getFilteredItems(date);
            window.alert(`Processamento conectado para ${filtered.length} registro(s) na data ${date}.`);
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
                termsDialog.showModal();
            }
        });

        closeTermsButton?.addEventListener("click", () => {
            termsDialog.close();
        });
    }

    private getTermsDialog(): HTMLDialogElement {
        return document.getElementById("termsDialog") as HTMLDialogElement;
    }

    private importContent(content: string): void {
        const lines = this.parseContent(content);
        const mapped = lines
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => ({
                raw: line,
                dateIso: this.extractIsoDate(line)
            }));

        this.importedItems = mapped;
        this.renderImportedData();
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

    private getFilteredItems(dateIso: string): ImportedItem[] {
        return this.importedItems.filter((item) => !item.dateIso || item.dateIso === dateIso);
    }

    private renderImportedData(): void {
        const list = document.getElementById("importedDataList") as HTMLUListElement | null;
        const emptyState = document.getElementById("emptyState") as HTMLParagraphElement | null;
        if (!list || !emptyState) return;

        list.innerHTML = "";
        const filtered = this.getFilteredItems(this.getCurrentDate());

        if (filtered.length === 0) {
            emptyState.style.display = "block";
            return;
        }

        emptyState.style.display = "none";
        filtered.forEach((item, index) => {
            list.appendChild(this.createDataListItem(item.raw, index));
        });
    }

    private createDataListItem(raw: string, index: number): HTMLLIElement {
        const item = document.createElement("li");
        item.className = "fh-data-item";

        const parsed = this.parseDataLine(raw);
        item.dataset.kind = parsed.kind;

        if (parsed.kind === "divider") {
            item.setAttribute("aria-hidden", "true");
            return item;
        }

        if (parsed.kind === "heading") {
            item.appendChild(this.createTextSpan(parsed.text ?? raw, "fh-data-text"));
            return item;
        }

        if (parsed.kind === "kv") {
            item.appendChild(this.createTextSpan(parsed.label ?? "", "fh-data-label"));
            item.appendChild(this.createTextSpan(parsed.value ?? "", "fh-data-value"));
            return item;
        }

        item.classList.add("fh-data-text");
        item.appendChild(this.createTextSpan(raw, "fh-data-value"));
        return item;
    }

    private createTextSpan(text: string, className: string): HTMLSpanElement {
        const span = document.createElement("span");
        span.className = className;
        span.textContent = text;
        return span;
    }

    private parseDataLine(raw: string): { kind: "divider" | "heading" | "kv" | "text"; label?: string; value?: string; text?: string } {
        const trimmed = raw.trim();

        if (/^[=-]{8,}$/.test(trimmed)) {
            return { kind: "divider" };
        }

        const headingMatch = trimmed.match(/^---\s*(.+?)\s*---$/);
        if (headingMatch) {
            return { kind: "heading", text: headingMatch[1] };
        }

        const titleLike = trimmed.length <= 72 && /^[A-ZÀ-Ý0-9][A-ZÀ-Ý0-9\s\-()\/.,]+$/.test(trimmed);
        if (titleLike) {
            return { kind: "heading", text: trimmed };
        }

        const kvMatch = trimmed.match(/^([^:]{2,40}):\s*(.+)$/);
        if (kvMatch) {
            return {
                kind: "kv",
                label: kvMatch[1].trim(),
                value: kvMatch[2].trim()
            };
        }

        return { kind: "text" };
    }

}
