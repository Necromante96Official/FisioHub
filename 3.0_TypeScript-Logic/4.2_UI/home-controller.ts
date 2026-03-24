import { ThemeManager } from "../4.1_Core/theme-manager.js";

type ImportedItem = {
    id: number;
    raw: string;
    dateIso: string | null;
};

export class HomeController {
    private readonly appId = "app";
    private readonly homeTemplate = "1.0_HTML-Templates/1.1_Pages/home.html";
    private readonly importedDataStorageKey = "fisiohub-imported-data-lines-v1";
    private readonly theme = new ThemeManager();
    private importedItems: ImportedItem[] = [];
    private nextItemId = 1;

    async bootstrap(): Promise<void> {
        this.theme.init();
        await this.loadHome();
        await this.resolveIncludes();
        this.setDate(this.todayIso());
        this.loadImportedDataFromStorage();
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
            this.saveImportedDataToStorage();
            this.renderImportedData();
        });

        const importedDataEditor = document.getElementById("importedDataEditor") as HTMLTextAreaElement | null;
        importedDataEditor?.addEventListener("input", () => {
            this.syncImportedDataFromEditor(importedDataEditor.value);
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
                termsDialog.classList.remove("is-closing");
                termsDialog.removeAttribute("data-closing");
                termsDialog.showModal();
            }
        });

        closeTermsButton?.addEventListener("click", () => {
            this.requestTermsClose(termsDialog);
        });

        termsDialog?.addEventListener("cancel", (event) => {
            this.requestTermsClose(termsDialog, event);
        });
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

    private importContent(content: string): void {
        const lines = this.parseContent(content);
        const mapped = lines
            .map((line) => line.trim())
            .filter((line) => !/^[=\-_*]{6,}$/.test(line))
            .filter((line) => line.length > 0)
            .map((line) => ({
                id: this.nextItemId++,
                raw: line,
                dateIso: this.extractIsoDate(line)
            }));

        this.importedItems = mapped;
        this.saveImportedDataToStorage();
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

        this.saveImportedDataToStorage();
    }

    private saveImportedDataToStorage(): void {
        const serialized = this.importedItems.map((item) => item.raw).join("\n");
        localStorage.setItem(this.importedDataStorageKey, serialized);
    }

    private loadImportedDataFromStorage(): void {
        const stored = localStorage.getItem(this.importedDataStorageKey);
        if (!stored) {
            return;
        }

        const lines = stored
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        this.importedItems = lines.map((line) => ({
            id: this.nextItemId++,
            raw: line,
            dateIso: this.extractIsoDate(line) ?? this.getCurrentDate()
        }));
    }

}
