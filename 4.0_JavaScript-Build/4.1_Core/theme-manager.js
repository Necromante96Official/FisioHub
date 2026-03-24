export class ThemeManager {
    root;
    storageKey = "fisiohub-theme";
    constructor() {
        this.root = document.documentElement;
    }
    init() {
        this.applyTheme("dark");
        return "dark";
    }
    applyTheme(theme) {
        this.root.setAttribute("data-theme", theme);
        localStorage.setItem(this.storageKey, theme);
    }
}
//# sourceMappingURL=theme-manager.js.map