import { buildAnalysisReportData, buildAnalysisReportText, renderAnalysisReportMarkup } from "./analysis-report.js";
const DEFAULT_MODAL_SURFACE_SELECTORS = [
    ".fh-conflict-surface",
    ".fh-backups-surface",
    ".fh-terms-surface",
    ".fh-patient-details-surface"
];
const analysisDialogStates = new WeakMap();
const normalizeText = (value) => value.replace(/\s+/g, " ").trim().toLowerCase();
const getControlLabel = (element) => {
    return element.getAttribute("aria-label")?.trim()
        ?? element.getAttribute("title")?.trim()
        ?? element.textContent?.replace(/\s+/g, " ").trim()
        ?? "";
};
const resolveHoverMessage = (element) => {
    const explicit = element.getAttribute("data-hover-description")?.trim();
    if (explicit) {
        return explicit;
    }
    const label = getControlLabel(element);
    if (!label) {
        return null;
    }
    const labelKey = normalizeText(label);
    const id = element.id;
    switch (id) {
        case "importBtn":
            return "Abre o seletor para importar dados.";
        case "processBtn":
            return "Processa os dados importados e prepara o resultado.";
        case "clearDataBtn":
            return "Apaga apenas os dados importados.";
        case "clearAllDataBtn":
            return "Limpa todos os dados das páginas, mantendo a Lista de Pacientes intacta.";
        case "clearOnlyDataBtn":
            return "Limpa todos os dados do sistema, sem exceções.";
        case "backupsBtn":
            return "Abre as opções de backup e restauração.";
        case "footerTermsBtn":
            return "Abre os termos de uso do sistema.";
        case "footerAnalysisBtn":
            return "Abre a análise consolidada da operação.";
        case "analysisPrintBtn":
            return "Abre a impressão em formato A4.";
        case "analysisTextBtn":
            return "Baixa o relatório em arquivo .txt.";
        case "closeAnalysisDialogBtn":
            return "Fecha a janela de análise.";
        case "todayBtn":
            return "Volta a data de referência para o dia atual.";
        case "prevDayBtn":
            return "Volta a data de referência para o dia anterior.";
        case "nextDayBtn":
            return "Avança a data de referência para o dia seguinte.";
        case "prevMonthBtn":
            return "Volta a data de referência para o mês anterior.";
        case "nextMonthBtn":
            return "Avança a data de referência para o mês seguinte.";
        case "closePatientConflictDialogBtn":
        case "exitPatientConflictBtn":
            return "Fecha esta janela sem aplicar mudanças.";
        case "confirmPatientConflictBtn":
            return "Confirma a escolha e continua o processamento.";
        case "autoFillRequiredBtn":
            return "Preenche automaticamente os campos obrigatórios faltantes.";
        case "closePatientDetailsDialogBtn":
            return "Fecha os detalhes do paciente.";
        case "editPatientDetailsBtn":
            return "Ativa a edição dos dados do paciente.";
        case "savePatientDetailsBtn":
            return "Salva as alterações feitas nos dados do paciente.";
        case "backToPatientsBtn":
            return "Volta para a lista de pacientes.";
        default:
            break;
    }
    if (element.classList.contains("fh-tab")) {
        return `Abre a página ${label}.`;
    }
    if (element.classList.contains("fh-btn")) {
        return `Executa a ação ${label}.`;
    }
    if (labelKey === "detalhes") {
        return "Abre os detalhes deste paciente.";
    }
    if (labelKey === "registro") {
        return "Abre o registro de alterações deste paciente.";
    }
    if (labelKey === "evoluído") {
        return "Marca esta evolução como concluída.";
    }
    if (labelKey === "sair") {
        return "Fecha a janela atual.";
    }
    if (labelKey === "cancelar") {
        return "Cancela a ação atual.";
    }
    if (labelKey === "confirmar") {
        return "Confirma a ação atual.";
    }
    if (labelKey === "auto completar") {
        return "Preenche automaticamente os campos faltantes.";
    }
    return label;
};
const showDialogWithAnimation = (dialog) => {
    dialog.classList.remove("is-opening");
    dialog.classList.remove("is-closing");
    dialog.removeAttribute("data-closing");
    dialog.showModal();
    window.requestAnimationFrame(() => {
        dialog.classList.add("is-opening");
    });
    window.setTimeout(() => {
        dialog.classList.remove("is-opening");
    }, 180);
};
const requestDialogClose = (dialog, surfaceSelector, event) => {
    event?.preventDefault();
    if (!dialog.open || dialog.dataset.closing === "true") {
        return;
    }
    dialog.dataset.closing = "true";
    dialog.classList.remove("is-opening");
    dialog.classList.add("is-closing");
    const finalizeClose = () => {
        dialog.classList.remove("is-closing");
        dialog.removeAttribute("data-closing");
        if (dialog.open) {
            dialog.close();
        }
    };
    window.setTimeout(finalizeClose, 180);
};
const appendToast = (container, message) => {
    const toast = document.createElement("div");
    toast.className = "fh-site-toast";
    toast.textContent = message;
    container.appendChild(toast);
    const beginClose = () => {
        if (!toast.isConnected) {
            return;
        }
        toast.classList.add("is-leaving");
        const remove = () => {
            toast.removeEventListener("animationend", remove);
            toast.remove();
        };
        toast.addEventListener("animationend", remove, { once: true });
        window.setTimeout(remove, 260);
    };
    window.setTimeout(beginClose, 3000);
};
const showAnchoredToast = (anchor, message) => {
    const existing = anchor.dataset.hoverToastId;
    if (existing) {
        const currentToast = document.getElementById(existing);
        currentToast?.remove();
    }
    const toast = document.createElement("div");
    const toastId = `fh-hover-toast-${Math.random().toString(36).slice(2, 10)}`;
    toast.id = toastId;
    toast.className = "fh-site-toast fh-hover-toast";
    toast.textContent = message;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
    const rect = anchor.getBoundingClientRect();
    const toastRect = toast.getBoundingClientRect();
    const gap = 10;
    const top = rect.top - toastRect.height - gap;
    const left = Math.min(window.innerWidth - toastRect.width - 8, Math.max(8, rect.left + rect.width / 2 - toastRect.width / 2));
    toast.style.position = "fixed";
    toast.style.top = `${top}px`;
    toast.style.left = `${left}px`;
    toast.style.zIndex = "1004";
    toast.dataset.anchorId = anchor.id || "";
    anchor.dataset.hoverToastId = toastId;
    const state = {
        toast,
        hideTimer: window.setTimeout(() => {
            toast.classList.add("is-leaving");
        }, 1400),
        cleanupTimer: window.setTimeout(() => {
            toast.remove();
            if (anchor.dataset.hoverToastId === toastId) {
                delete anchor.dataset.hoverToastId;
            }
        }, 1700)
    };
    toast.addEventListener("mouseenter", () => {
        window.clearTimeout(state.hideTimer);
        window.clearTimeout(state.cleanupTimer);
    });
    toast.addEventListener("mouseleave", () => {
        toast.classList.add("is-leaving");
        state.cleanupTimer = window.setTimeout(() => {
            toast.remove();
            if (anchor.dataset.hoverToastId === toastId) {
                delete anchor.dataset.hoverToastId;
            }
        }, 180);
    });
};
export const showSiteNotification = (message, options = {}) => {
    const hostId = options.hostId ?? "siteNotifications";
    const baseHost = document.getElementById(hostId);
    if (!baseHost) {
        return;
    }
    const openDialogs = Array.from(document.querySelectorAll("dialog[open]"));
    const topDialog = openDialogs.length > 0 ? openDialogs[openDialogs.length - 1] : null;
    if (!topDialog) {
        baseHost.classList.remove("fh-site-notifications--modal");
        appendToast(baseHost, message);
        return;
    }
    const surfaceSelectors = options.modalSurfaceSelectors ?? DEFAULT_MODAL_SURFACE_SELECTORS;
    let surface = null;
    for (const selector of surfaceSelectors) {
        surface = topDialog.querySelector(selector);
        if (surface) {
            break;
        }
    }
    const modalSurface = surface ?? topDialog;
    let modalHost = modalSurface.querySelector(".fh-site-notifications--modal");
    if (!modalHost) {
        modalHost = document.createElement("div");
        modalHost.className = "fh-site-notifications fh-site-notifications--modal";
        modalHost.setAttribute("aria-live", "polite");
        modalHost.setAttribute("aria-atomic", "false");
        modalSurface.appendChild(modalHost);
    }
    appendToast(modalHost, message);
};
export const bindTermsDialog = (options) => {
    const dialog = document.getElementById(options.dialogId);
    if (!dialog) {
        return;
    }
    const triggerButton = document.getElementById(options.triggerButtonId);
    const closeButton = document.getElementById(options.closeButtonId);
    const surfaceSelector = options.surfaceSelector ?? ".fh-terms-surface";
    triggerButton?.addEventListener("click", () => {
        if (!dialog.open) {
            showDialogWithAnimation(dialog);
        }
    });
    closeButton?.addEventListener("click", () => {
        requestDialogClose(dialog, surfaceSelector);
    });
    dialog.addEventListener("cancel", (event) => {
        requestDialogClose(dialog, surfaceSelector, event);
    });
};
const ensureAnalysisState = (dialog) => {
    const existing = analysisDialogStates.get(dialog);
    if (existing) {
        return existing;
    }
    const created = {
        timerId: null,
        reportData: null
    };
    analysisDialogStates.set(dialog, created);
    return created;
};
const clearAnalysisTimer = (state) => {
    if (state.timerId !== null) {
        window.clearTimeout(state.timerId);
        state.timerId = null;
    }
};
const setAnalysisLoadingState = (dialog, loadingSelector, reportSelector) => {
    dialog.dataset.analysisState = "loading";
    const loadingElement = dialog.querySelector(loadingSelector);
    const reportElement = dialog.querySelector(reportSelector);
    loadingElement?.classList.add("is-active");
    reportElement?.classList.remove("is-active");
};
const setAnalysisReportState = (dialog, loadingSelector, reportSelector, data) => {
    dialog.dataset.analysisState = "ready";
    const loadingElement = dialog.querySelector(loadingSelector);
    const reportElement = dialog.querySelector(reportSelector);
    const reportContent = dialog.querySelector("[data-analysis-report-content]");
    if (reportContent) {
        reportContent.innerHTML = renderAnalysisReportMarkup(data);
    }
    loadingElement?.classList.remove("is-active");
    reportElement?.classList.add("is-active");
};
const downloadAnalysisText = (data) => {
    const content = buildAnalysisReportText(data);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const datePart = data.generatedAtIso.slice(0, 10).replace(/-/g, "");
    anchor.href = url;
    anchor.download = `fisiohub-analise-${datePart}.txt`;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
};
export const bindFisioHubStorageListener = (onChange, options = {}) => {
    const listener = (event) => {
        if (!options.includeNonFisioHubKeys && event.key && !event.key.startsWith("fisiohub-")) {
            return;
        }
        onChange();
    };
    window.addEventListener("storage", listener);
    return () => {
        window.removeEventListener("storage", listener);
    };
};
const openAnalysisPrintView = (dialog) => {
    dialog.dataset.printMode = "true";
    window.requestAnimationFrame(() => {
        window.print();
        window.setTimeout(() => {
            delete dialog.dataset.printMode;
        }, 100);
    });
};
export const bindAnalysisDialog = (options) => {
    const dialog = document.getElementById(options.dialogId);
    if (!dialog) {
        return;
    }
    const triggerButton = document.getElementById(options.triggerButtonId);
    const closeButton = document.getElementById(options.closeButtonId);
    const printButton = document.getElementById(options.printButtonId);
    const textButton = document.getElementById(options.textButtonId);
    const loadingSelector = options.loadingSelector ?? ".fh-analysis-loading";
    const reportSelector = options.reportSelector ?? ".fh-analysis-report-stage";
    const surfaceSelector = options.surfaceSelector ?? ".fh-analysis-surface";
    const state = ensureAnalysisState(dialog);
    const setActionsEnabled = (enabled) => {
        if (printButton) {
            printButton.disabled = !enabled;
        }
        if (textButton) {
            textButton.disabled = !enabled;
        }
    };
    const startAnalysis = () => {
        clearAnalysisTimer(state);
        state.reportData = buildAnalysisReportData();
        setActionsEnabled(false);
        setAnalysisLoadingState(dialog, loadingSelector, reportSelector);
        state.timerId = window.setTimeout(() => {
            if (!dialog.open || dialog.dataset.closing === "true") {
                return;
            }
            if (!state.reportData) {
                state.reportData = buildAnalysisReportData();
            }
            setAnalysisReportState(dialog, loadingSelector, reportSelector, state.reportData);
            setActionsEnabled(true);
        }, 1400);
    };
    triggerButton?.addEventListener("click", () => {
        if (dialog.open) {
            return;
        }
        showDialogWithAnimation(dialog);
        startAnalysis();
    });
    closeButton?.addEventListener("click", () => {
        clearAnalysisTimer(state);
        requestDialogClose(dialog, surfaceSelector);
    });
    printButton?.addEventListener("click", () => {
        if (!state.reportData) {
            state.reportData = buildAnalysisReportData();
            setAnalysisReportState(dialog, loadingSelector, reportSelector, state.reportData);
        }
        openAnalysisPrintView(dialog);
    });
    textButton?.addEventListener("click", () => {
        if (!state.reportData) {
            state.reportData = buildAnalysisReportData();
            setAnalysisReportState(dialog, loadingSelector, reportSelector, state.reportData);
        }
        downloadAnalysisText(state.reportData);
    });
    dialog.addEventListener("cancel", (event) => {
        clearAnalysisTimer(state);
        requestDialogClose(dialog, surfaceSelector, event);
    });
    dialog.addEventListener("close", () => {
        clearAnalysisTimer(state);
        setActionsEnabled(false);
        state.reportData = null;
        delete dialog.dataset.analysisState;
        delete dialog.dataset.printMode;
        const loadingElement = dialog.querySelector(loadingSelector);
        const reportElement = dialog.querySelector(reportSelector);
        loadingElement?.classList.remove("is-active");
        reportElement?.classList.remove("is-active");
    });
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
            clearAnalysisTimer(state);
            requestDialogClose(dialog, surfaceSelector, event);
        }
    });
};
export const startFloatingHomeHint = (selector = ".fh-floating-home-toast") => {
    const toast = document.querySelector(selector);
    if (!toast || toast.dataset.started === "true") {
        return () => { };
    }
    toast.dataset.started = "true";
    const intervalMs = 15000;
    let timerId = null;
    let cancelled = false;
    const pulse = () => {
        if (cancelled) {
            return;
        }
        toast.classList.remove("is-visible");
        void toast.offsetWidth;
        toast.classList.add("is-visible");
    };
    const clearTimer = () => {
        if (timerId !== null) {
            window.clearTimeout(timerId);
            timerId = null;
        }
    };
    const cancel = () => {
        if (cancelled) {
            return;
        }
        cancelled = true;
        clearTimer();
        toast.classList.remove("is-visible");
        delete toast.dataset.started;
    };
    let nextTick = performance.now() + intervalMs;
    const scheduleNext = () => {
        if (cancelled) {
            return;
        }
        const delay = Math.max(0, nextTick - performance.now());
        timerId = window.setTimeout(() => {
            if (cancelled) {
                return;
            }
            pulse();
            nextTick += intervalMs;
            scheduleNext();
        }, delay);
    };
    scheduleNext();
    return cancel;
};
export const bindHoverToasts = (options = {}) => {
    const scope = options.scope ?? document;
    const selector = options.selector ?? "button, .fh-tab";
    const describe = options.describe ?? ((element) => {
        const candidate = element;
        const ariaLabel = candidate.getAttribute("aria-label")?.trim();
        if (ariaLabel) {
            return ariaLabel;
        }
        const title = candidate.getAttribute("title")?.trim();
        if (title) {
            return title;
        }
        const text = candidate.textContent?.replace(/\s+/g, " ").trim();
        return text && text.length > 0 ? text : null;
    });
    const elements = Array.from(scope.querySelectorAll(selector));
    elements.forEach((element) => {
        const target = element;
        if (target.dataset.hoverToastBound === "true") {
            return;
        }
        target.dataset.hoverToastBound = "true";
        let lastShownAt = 0;
        const showHoverToast = () => {
            const message = resolveHoverMessage(target) ?? describe(element);
            if (!message) {
                return;
            }
            const label = getControlLabel(target);
            if (normalizeText(message) === normalizeText(label)) {
                return;
            }
            const now = performance.now();
            if (now - lastShownAt < 1500) {
                return;
            }
            lastShownAt = now;
            showAnchoredToast(target, message);
        };
        target.addEventListener("mouseenter", showHoverToast);
        target.addEventListener("focus", showHoverToast);
        target.addEventListener("mouseleave", () => {
            const toastId = target.dataset.hoverToastId;
            if (!toastId) {
                return;
            }
            const toast = document.getElementById(toastId);
            toast?.classList.add("is-leaving");
            window.setTimeout(() => toast?.remove(), 180);
            delete target.dataset.hoverToastId;
        });
        target.addEventListener("blur", () => {
            const toastId = target.dataset.hoverToastId;
            if (!toastId) {
                return;
            }
            const toast = document.getElementById(toastId);
            toast?.remove();
            delete target.dataset.hoverToastId;
        });
    });
};
export const syncFooterMetadata = async () => {
    const footerVersion = document.getElementById("footerVersion");
    const footerCopyright = document.getElementById("footerCopyright");
    const currentYear = String(new Date().getFullYear());
    if (footerCopyright) {
        footerCopyright.textContent = `© Copyright ${currentYear} FisioHub. Todos os direitos reservados.`;
    }
    if (!footerVersion) {
        return;
    }
    const dataVersion = footerVersion.getAttribute("data-version")?.trim();
    if (dataVersion) {
        footerVersion.textContent = `Versão: ${dataVersion.replace(/^v/i, "")}`;
        return;
    }
    try {
        const response = await fetch("package.json", { cache: "no-store" });
        if (!response.ok) {
            return;
        }
        const packageInfo = (await response.json());
        if (packageInfo.version) {
            const normalizedVersion = String(packageInfo.version).replace(/^v/i, "");
            footerVersion.textContent = `Versão: ${normalizedVersion}`;
        }
    }
    catch {
        return;
    }
};
//# sourceMappingURL=ui-feedback.js.map