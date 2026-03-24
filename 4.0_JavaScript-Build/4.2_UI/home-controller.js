import { ThemeManager } from "../4.1_Core/theme-manager.js";
export class HomeController {
    appId = "app";
    homeTemplate = "1.0_HTML-Templates/1.1_Pages/home.html";
    theme = new ThemeManager();
    importedItems = [];
    nextItemId = 1;
    async bootstrap() {
        this.theme.init();
        await this.loadHome();
        await this.resolveIncludes();
        this.setDate(this.todayIso());
        this.bindHandlers();
        this.renderImportedData();
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
            this.importContent(content);
            fileInput.value = "";
        });
        const clearBtn = document.getElementById("clearDataBtn");
        clearBtn?.addEventListener("click", () => {
            this.importedItems = [];
            this.renderImportedData();
        });
        const importedDataEditor = document.getElementById("importedDataEditor");
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
    getTermsDialog() {
        return document.getElementById("termsDialog");
    }
    requestTermsClose(dialog, event) {
        event?.preventDefault();
        if (!dialog.open || dialog.dataset.closing === "true") {
            return;
        }
        dialog.dataset.closing = "true";
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
        }, 260);
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
    importContent(content) {
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
        this.renderImportedData();
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
        return dateInput?.value || this.todayIso();
    }
    getDateInput() {
        return document.getElementById("refDate");
    }
    setDate(value) {
        const dateInput = this.getDateInput();
        if (!dateInput)
            return;
        dateInput.value = value;
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
    getFilteredItems(dateIso) {
        return this.importedItems.filter((item) => !item.dateIso || item.dateIso === dateIso);
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
    }
}
//# sourceMappingURL=home-controller.js.map