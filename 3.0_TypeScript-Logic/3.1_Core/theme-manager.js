export class ThemeManager {
    constructor() {
        this.root = document.documentElement;
        this.storageKey = "fisiohub-theme";
    }

    toggle() {
        const current = this.getCurrentTheme();
        const next = current === "dark" ? "light" : "dark";
        this.applyTheme(next);
        return next;
    }

    init() {
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

    getCurrentTheme() {
        return this.root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    }

    applyTheme(theme) {
        this.root.setAttribute("data-theme", theme);
        localStorage.setItem(this.storageKey, theme);
    }
}
