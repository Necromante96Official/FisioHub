import { ThemeManager } from "../3.1_Core/theme-manager.js";
export class HomeController {
    appId = "app";
    homeTemplate = "1.0_HTML-Templates/1.1_Pages/home.html";
    theme = new ThemeManager();
    importedItems = [];
    async bootstrap() {
        const initialTheme = this.theme.init();
        await this.loadHome();
        await this.resolveIncludes();
        this.setDate(this.todayIso());
        this.updateThemeButtonLabel(initialTheme);
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
        const nodes = Array.from(document.querySelectorAll("[data-include]"));
        for (const node of nodes) {
            const path = node.getAttribute("data-include");
            if (!path)
                continue;
            const html = await fetch(path).then((r) => r.text());
            node.outerHTML = html;
        }
    }
    bindHandlers() {
        const themeBtn = document.getElementById("themeToggleBtn");
        themeBtn?.addEventListener("click", () => {
            const next = this.theme.toggle();
            this.updateThemeButtonLabel(next);
        });
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
    }
    importContent(content) {
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
        const list = document.getElementById("importedDataList");
        const emptyState = document.getElementById("emptyState");
        if (!list || !emptyState)
            return;
        list.innerHTML = "";
        const filtered = this.getFilteredItems(this.getCurrentDate());
        if (filtered.length === 0) {
            emptyState.style.display = "block";
            return;
        }
        emptyState.style.display = "none";
        filtered.forEach((item) => {
            const li = document.createElement("li");
            li.className = "fh-data-item";
            li.textContent = item.raw;
            list.appendChild(li);
        });
    }
    updateThemeButtonLabel(theme) {
        const themeBtn = document.getElementById("themeToggleBtn");
        if (!themeBtn)
            return;
        themeBtn.textContent = theme === "dark" ? "Tema: Escuro" : "Tema: Claro";
    }
}
//# sourceMappingURL=home-controller.js.map