import { ThemeManager } from "../3.1_Core/theme-manager";

export class HomeController {
    private readonly appId = "app";
    private readonly homeTemplate = "1.0_HTML-Templates/1.1_Pages/home.html";
    private readonly theme = new ThemeManager();

    async bootstrap(): Promise<void> {
        this.theme.init();
        await this.loadHome();
        await this.resolveIncludes();
        this.bindHandlers();
        this.applyDefaultDate();
    }

    private async loadHome(): Promise<void> {
        const app = document.getElementById(this.appId);
        if (!app) return;
        const html = await fetch(this.homeTemplate).then((r) => r.text());
        app.innerHTML = html;
    }

    private async resolveIncludes(): Promise<void> {
        const nodes = Array.from(document.querySelectorAll("[data-include]"));
        for (const node of nodes) {
            const path = node.getAttribute("data-include");
            if (!path) continue;
            const html = await fetch(path).then((r) => r.text());
            node.outerHTML = html;
        }
    }

    private bindHandlers(): void {
        const themeBtn = document.getElementById("themeToggleBtn");
        themeBtn?.addEventListener("click", () => this.theme.toggle());

        const modules = Array.from(document.querySelectorAll(".fh-module-card"));
        modules.forEach((btn) => {
            btn.addEventListener("click", () => {
                const moduleName = btn.getAttribute("data-module") || "modulo";
                window.alert(`Porte em construção: ${moduleName}`);
            });
        });

        const processBtn = document.getElementById("processBtn");
        processBtn?.addEventListener("click", () => {
            window.alert("Processamento inicial conectado. Próximo porte: parser + pipeline.");
        });
    }

    private applyDefaultDate(): void {
        const el = document.getElementById("refDate") as HTMLInputElement | null;
        if (!el) return;
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        el.value = `${yyyy}-${mm}-${dd}`;
    }
}
