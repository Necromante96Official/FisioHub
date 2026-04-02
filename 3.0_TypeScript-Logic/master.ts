import { HomeController } from "./4.2_UI/home-controller.js";
import { PatientsController } from "./4.2_UI/patients-controller.js";
import { EvolucoesController } from "./4.2_UI/evolucoes-controller.js";
import { AgendamentosController } from "./4.2_UI/agendamentos-controller.js";
import { FinanceiroController } from "./4.2_UI/financeiro-controller.js";

const pagePath = window.location.pathname.toLowerCase();
const isPatientsPage = pagePath.endsWith("/pacientes.html") || pagePath.endsWith("pacientes.html");
const isEvolucoesPage = pagePath.endsWith("/evolucoes.html") || pagePath.endsWith("evolucoes.html");
const isAgendamentosPage = pagePath.endsWith("/agendamentos.html") || pagePath.endsWith("agendamentos.html");
const isFinanceiroPage = pagePath.endsWith("/financeiro.html") || pagePath.endsWith("financeiro.html");

const controller = isPatientsPage
    ? new PatientsController()
    : isEvolucoesPage
        ? new EvolucoesController()
        : isAgendamentosPage
                ? new AgendamentosController()
                : isFinanceiroPage
                    ? new FinanceiroController()
                    : new HomeController();
controller.bootstrap();
