export class ThemeManager {
    private readonly root: HTMLElement;
    private readonly storageKey = "fisiohub-theme";

    constructor() {
        this.root = document.documentElement;
    }

    init(): string {
        this.applyTheme("dark");
        return "dark";
    }

    getCurrentTheme(): string {
        return "dark";
    }

    private applyTheme(theme: string): void {
        this.root.setAttribute("data-theme", theme);
        localStorage.setItem(this.storageKey, theme);
    }
}
