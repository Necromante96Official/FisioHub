import { HomeController } from "./4.2_UI/home-controller.js";
import { PatientsController } from "./4.2_UI/patients-controller.js";
const pagePath = window.location.pathname.toLowerCase();
const isPatientsPage = pagePath.endsWith("/pacientes.html") || pagePath.endsWith("pacientes.html");
const controller = isPatientsPage ? new PatientsController() : new HomeController();
controller.bootstrap();
//# sourceMappingURL=master.js.map