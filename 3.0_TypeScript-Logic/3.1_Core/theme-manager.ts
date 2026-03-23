export class ThemeManager {
    private readonly root: HTMLElement;
    private readonly storageKey = "fisiohub-theme";

    constructor() {
        this.root = document.documentElement;
    }

    toggle(): string {
        const current = this.getCurrentTheme();
        const next = current === "dark" ? "light" : "dark";
        this.applyTheme(next);
        return next;
    }

    init(): string {
        const saved = localStorage.getItem(this.storageKey);
        if (saved === "light" || saved === "dark") {
            this.applyTheme(saved);
            return saved;
        }

        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        const initial = prefersDark ? "dark" : "light";
        this.applyTheme(initial);
        return initial;
    }

    getCurrentTheme(): string {
        return this.root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    }

    private applyTheme(theme: string): void {
        this.root.setAttribute("data-theme", theme);
        localStorage.setItem(this.storageKey, theme);
    }
}
