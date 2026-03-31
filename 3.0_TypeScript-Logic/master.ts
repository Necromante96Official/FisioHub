import { HomeController } from "./4.2_UI/home-controller.js";
import { PatientsController } from "./4.2_UI/patients-controller.js";
import { EvolucoesController } from "./4.2_UI/evolucoes-controller.js";
import { AgendamentosController } from "./4.2_UI/agendamentos-controller.js";

const pagePath = window.location.pathname.toLowerCase();
const isPatientsPage = pagePath.endsWith("/pacientes.html") || pagePath.endsWith("pacientes.html");
const isEvolucoesPage = pagePath.endsWith("/evolucoes.html") || pagePath.endsWith("evolucoes.html");
const isAgendamentosPage = pagePath.endsWith("/agendamentos.html") || pagePath.endsWith("agendamentos.html");

const controller = isPatientsPage
    ? new PatientsController()
    : isEvolucoesPage
        ? new EvolucoesController()
        : isAgendamentosPage
            ? new AgendamentosController()
            : new HomeController();
controller.bootstrap();
