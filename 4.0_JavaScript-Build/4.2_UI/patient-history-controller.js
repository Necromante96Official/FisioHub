import { ThemeManager } from "../4.1_Core/theme-manager.js";
import { FISIOHUB_STORAGE_KEYS } from "../4.0_Shared/fisiohub-models.js";
import { buildPatientRecordKey, formatPatientChangeSummary, parsePatientChangeHistory } from "../4.0_Shared/patient-history.js";
import { bindAnalysisDialog, bindFisioHubStorageListener, bindHoverToasts as sharedBindHoverToasts, bindTermsDialog, startFloatingHomeHint as sharedStartFloatingHomeHint, syncFooterMetadata } from "../4.0_Shared/ui-feedback.js";
export class PatientHistoryController {
    appId = "app";
    pageTemplate = "1.0_HTML-Templates/1.1_Pages/registro.html";
    patientsRecordsStorageKey = FISIOHUB_STORAGE_KEYS.PATIENTS_RECORDS;
    theme = new ThemeManager();
    patientRecords = [];
    selectedPatientKey = "";
    async bootstrap() {
        this.theme.init();
        await this.loadPage();
        await this.resolveIncludes();
        await syncFooterMetadata();
        bindTermsDialog({
            dialogId: "termsDialog",
            triggerButtonId: "footerTermsBtn",
            closeButtonId: "closeTermsDialogBtn"
        });
        bindAnalysisDialog({
            dialogId: "analysisDialog",
            triggerButtonId: "footerAnalysisBtn",
            closeButtonId: "closeAnalysisDialogBtn",
            printButtonId: "analysisPrintBtn",
            textButtonId: "analysisTextBtn"
        });
        this.selectedPatientKey = new URLSearchParams(window.location.search).get("patient")?.trim() ?? "";
        this.patientRecords = this.parsePatientsFromStorage();
        this.bindHandlers();
        sharedBindHoverToasts({ scope: document });
        this.render();
        const stopFloatingHomeHint = sharedStartFloatingHomeHint();
        const disposeStorageListener = bindFisioHubStorageListener(() => {
            this.patientRecords = this.parsePatientsFromStorage();
            this.render();
        });
        const cleanup = () => {
            stopFloatingHomeHint();
            disposeStorageListener();
        };
        window.addEventListener("beforeunload", cleanup, { once: true });
    }
    async loadPage() {
        const app = document.getElementById(this.appId);
        if (!app)
            return;
        const html = await fetch(this.pageTemplate).then((response) => response.text());
        app.innerHTML = html;
    }
    async resolveIncludes() {
        let nodes = Array.from(document.querySelectorAll("[data-include]"));
        while (nodes.length > 0) {
            for (const node of nodes) {
                const path = node.getAttribute("data-include");
                if (!path)
                    continue;
                const html = await fetch(path).then((response) => response.text());
                node.outerHTML = html;
            }
            nodes = Array.from(document.querySelectorAll("[data-include]"));
        }
    }
    bindHandlers() {
        const backButton = document.getElementById("backToPatientsBtn");
        if (backButton instanceof HTMLButtonElement) {
            backButton.dataset.hoverDescription = "Volta para a lista de pacientes.";
        }
        backButton?.addEventListener("click", () => {
            window.location.href = "pacientes.html";
        });
    }
    render() {
        const record = this.getSelectedPatientRecord();
        const historyList = document.getElementById("patientRecordHistoryList");
        if (!historyList) {
            return;
        }
        if (!record) {
            this.setDocumentTitle("FisioHub - Registro de Paciente");
            this.setText("patientRecordName", "Paciente não encontrado");
            this.setText("patientRecordMeta", "A chave informada não localizou um paciente na lista atual.");
            this.renderHistoryList(historyList, [], false);
            return;
        }
        const history = this.getSortedHistory(record);
        this.setDocumentTitle(`FisioHub - Registro de ${record.nome}`);
        this.setText("patientRecordName", record.nome);
        this.setText("patientRecordMeta", `${record.celular} • ${history.length} alteração${history.length === 1 ? "" : "es"}`);
        this.renderHistoryList(historyList, history, true);
    }
    renderHistoryList(historyList, history, hasRecord) {
        historyList.innerHTML = "";
        if (history.length === 0) {
            const empty = document.createElement("li");
            empty.className = "fh-registro-empty";
            empty.textContent = hasRecord
                ? "Nenhuma alteração registrada para este paciente ainda."
                : "Paciente não localizado para a chave informada.";
            historyList.appendChild(empty);
            return;
        }
        history.forEach((entry) => {
            const item = document.createElement("li");
            item.className = "fh-registro-item";
            const date = document.createElement("span");
            date.className = "fh-registro-date";
            date.textContent = this.formatDate(entry.referenceDateIso);
            const change = document.createElement("span");
            change.className = "fh-registro-change";
            change.textContent = formatPatientChangeSummary(entry);
            item.appendChild(date);
            item.appendChild(change);
            historyList.appendChild(item);
        });
    }
    parsePatientsFromStorage() {
        const raw = localStorage.getItem(this.patientsRecordsStorageKey);
        if (!raw)
            return [];
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed))
                return [];
            return parsed.map((item) => {
                const candidate = item;
                const status = candidate.statusFinanceiro === "Isento" ? "Isento" : "Pagante";
                const changeHistory = parsePatientChangeHistory(candidate.changeHistory);
                return {
                    nome: typeof candidate.nome === "string" ? candidate.nome : "",
                    statusFinanceiro: status,
                    horario: typeof candidate.horario === "string" ? candidate.horario : "-",
                    fisioterapeuta: typeof candidate.fisioterapeuta === "string" ? candidate.fisioterapeuta : "-",
                    celular: typeof candidate.celular === "string" ? candidate.celular : "-",
                    convenio: typeof candidate.convenio === "string" ? candidate.convenio : "-",
                    procedimentos: typeof candidate.procedimentos === "string" ? candidate.procedimentos : "-",
                    createdAtIso: typeof candidate.createdAtIso === "string" ? candidate.createdAtIso : new Date().toISOString(),
                    updatedAtIso: typeof candidate.updatedAtIso === "string" ? candidate.updatedAtIso : new Date().toISOString(),
                    ...(changeHistory.length > 0 ? { changeHistory } : {})
                };
            }).filter((record) => record.nome.trim().length > 0);
        }
        catch {
            return [];
        }
    }
    getSelectedPatientRecord() {
        if (!this.selectedPatientKey.trim()) {
            return null;
        }
        return this.patientRecords.find((record) => buildPatientRecordKey(record) === this.selectedPatientKey) ?? null;
    }
    getSortedHistory(record) {
        return [...parsePatientChangeHistory(record.changeHistory)]
            .sort((a, b) => b.referenceDateIso.localeCompare(a.referenceDateIso));
    }
    formatDate(value) {
        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short"
        }).format(date);
    }
    setDocumentTitle(title) {
        document.title = title;
    }
    setText(id, text) {
        const element = document.getElementById(id);
        if (!element)
            return;
        element.textContent = text;
    }
}
//# sourceMappingURL=patient-history-controller.js.map