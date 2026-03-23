export class ThemeManager {
    private readonly root: HTMLElement;

    constructor() {
        this.root = document.documentElement;
    }

    toggle(): void {
        const current = this.root.getAttribute("data-theme") === "dark" ? "dark" : "light";
        const next = current === "dark" ? "light" : "dark";
        this.root.setAttribute("data-theme", next);
        localStorage.setItem("fisiohub-theme", next);
    }

    init(): void {
        const saved = localStorage.getItem("fisiohub-theme") || "light";
        this.root.setAttribute("data-theme", saved);
    }
}
