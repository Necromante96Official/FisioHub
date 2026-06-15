import { HomeController } from "./ui/home-controller.js";
import { PatientsController } from "./ui/patients-controller.js";
import { EvolucoesController } from "./ui/evolucoes-controller.js";
import { AgendamentosController } from "./ui/agendamentos-controller.js";
import { FinanceiroController } from "./ui/financeiro-controller.js";
import { PatientHistoryController } from "./ui/patient-history-controller.js";
const legacyRouteByPage = {
    "pacientes.html": "pacientes",
    "evolucoes.html": "evolucoes",
    "agendamentos.html": "agendamentos",
    "financeiro.html": "financeiro",
    "registro.html": "registro"
};
const getHashRoute = () => {
    const rawHash = window.location.hash.replace(/^#\/?/, "");
    const routeName = rawHash.split("?")[0]?.trim().toLowerCase();
    if (routeName === "pacientes" || routeName === "evolucoes" || routeName === "agendamentos" || routeName === "financeiro" || routeName === "registro" || routeName === "home") {
        return routeName;
    }
    const pageName = window.location.pathname.split("/").pop()?.toLowerCase() ?? "";
    return legacyRouteByPage[pageName] ?? "home";
};
const bootstrapRoute = () => {
    const app = document.getElementById("app");
    if (app) {
        app.innerHTML = "";
    }
    const route = getHashRoute();
    const controller = route === "pacientes"
        ? new PatientsController()
        : route === "evolucoes"
            ? new EvolucoesController()
            : route === "agendamentos"
                ? new AgendamentosController()
                : route === "financeiro"
                    ? new FinanceiroController()
                    : route === "registro"
                        ? new PatientHistoryController()
                        : new HomeController();
    void controller.bootstrap();
};
bootstrapRoute();
window.addEventListener("hashchange", () => {
    bootstrapRoute();
});
//# sourceMappingURL=main.js.map