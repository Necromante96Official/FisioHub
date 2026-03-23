const appId = "app";
const homeTemplate = "1.0_HTML-Templates/1.1_Pages/home.html";

function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fisiohub-theme", theme);
}

function initTheme() {
    const saved = localStorage.getItem("fisiohub-theme") || "light";
    setTheme(saved);
}

async function loadHome() {
    const app = document.getElementById(appId);
    if (!app) return;
    const html = await fetch(homeTemplate).then((r) => r.text());
    app.innerHTML = html;
}

async function resolveIncludes() {
    const nodes = Array.from(document.querySelectorAll("[data-include]"));
    for (const node of nodes) {
        const path = node.getAttribute("data-include");
        if (!path) continue;
        const html = await fetch(path).then((r) => r.text());
        node.outerHTML = html;
    }
}

function bindHandlers() {
    const themeBtn = document.getElementById("themeToggleBtn");
    themeBtn?.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
        setTheme(current === "dark" ? "light" : "dark");
    });

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

function applyDefaultDate() {
    const el = document.getElementById("refDate");
    if (!el) return;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    el.value = `${yyyy}-${mm}-${dd}`;
}

async function bootstrap() {
    initTheme();
    await loadHome();
    await resolveIncludes();
    bindHandlers();
    applyDefaultDate();
}

bootstrap();
