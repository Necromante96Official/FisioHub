import { HomeController } from "./4.2_UI/home-controller.js";
import { PatientsController } from "./4.2_UI/patients-controller.js";
import { EvolucoesController } from "./4.2_UI/evolucoes-controller.js";
const pagePath = window.location.pathname.toLowerCase();
const isPatientsPage = pagePath.endsWith("/pacientes.html") || pagePath.endsWith("pacientes.html");
const isEvolucoesPage = pagePath.endsWith("/evolucoes.html") || pagePath.endsWith("evolucoes.html");
const controller = isPatientsPage
    ? new PatientsController()
    : isEvolucoesPage
        ? new EvolucoesController()
        : new HomeController();
controller.bootstrap();
//# sourceMappingURL=master.js.map