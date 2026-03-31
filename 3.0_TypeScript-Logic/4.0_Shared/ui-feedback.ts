const DEFAULT_MODAL_SURFACE_SELECTORS = [
    ".fh-conflict-surface",
    ".fh-backups-surface",
    ".fh-terms-surface",
    ".fh-patient-details-surface"
];

type NotificationOptions = {
    hostId?: string;
    modalSurfaceSelectors?: string[];
};

type TermsDialogOptions = {
    dialogId: string;
    triggerButtonId: string;
    closeButtonId: string;
    surfaceSelector?: string;
};

type HoverToastOptions = {
    selector?: string;
    scope?: ParentNode;
    describe?: (element: Element) => string | null;
};

type HoverToastState = {
    toast: HTMLDivElement;
    hideTimer: number;
    cleanupTimer: number;
};

type AppPackageInfo = {
    version?: string;
};

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim().toLowerCase();

const getControlLabel = (element: HTMLElement): string => {
    return element.getAttribute("aria-label")?.trim()
        ?? element.getAttribute("title")?.trim()
        ?? element.textContent?.replace(/\s+/g, " ").trim()
        ?? "";
};

const resolveHoverMessage = (element: HTMLElement): string | null => {
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

const showDialogWithAnimation = (dialog: HTMLDialogElement): void => {
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

const requestDialogClose = (dialog: HTMLDialogElement, surfaceSelector: string, event?: Event): void => {
    event?.preventDefault();

    if (!dialog.open || dialog.dataset.closing === "true") {
        return;
    }

    dialog.dataset.closing = "true";
    dialog.classList.remove("is-opening");
    dialog.classList.add("is-closing");

    const finalizeClose = (): void => {
        dialog.classList.remove("is-closing");
        dialog.removeAttribute("data-closing");

        if (dialog.open) {
            dialog.close();
        }
    };

    window.setTimeout(finalizeClose, 180);
};

const appendToast = (container: HTMLElement, message: string): void => {
    const toast = document.createElement("div");
    toast.className = "fh-site-toast";
    toast.textContent = message;
    container.appendChild(toast);

    const beginClose = (): void => {
        toast.classList.add("is-leaving");
        const remove = (): void => {
            toast.removeEventListener("animationend", remove);
            toast.remove();
        };

        toast.addEventListener("animationend", remove);
    };

    window.setTimeout(beginClose, 2600);
};

const showAnchoredToast = (anchor: HTMLElement, message: string): void => {
    const existing = anchor.dataset.hoverToastId;
    if (existing) {
        const currentToast = document.getElementById(existing) as HTMLDivElement | null;
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
    const left = Math.min(
        window.innerWidth - toastRect.width - 8,
        Math.max(8, rect.left + rect.width / 2 - toastRect.width / 2)
    );

    toast.style.position = "fixed";
    toast.style.top = `${top}px`;
    toast.style.left = `${left}px`;
    toast.style.zIndex = "1004";
    toast.dataset.anchorId = anchor.id || "";
    anchor.dataset.hoverToastId = toastId;

    const state: HoverToastState = {
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

export const showSiteNotification = (message: string, options: NotificationOptions = {}): void => {
    const hostId = options.hostId ?? "siteNotifications";
    const baseHost = document.getElementById(hostId) as HTMLElement | null;
    if (!baseHost) {
        return;
    }

    const openDialogs = Array.from(document.querySelectorAll("dialog[open]")) as HTMLDialogElement[];
    const topDialog = openDialogs.length > 0 ? openDialogs[openDialogs.length - 1] : null;

    if (!topDialog) {
        baseHost.classList.remove("fh-site-notifications--modal");
        appendToast(baseHost, message);
        return;
    }

    const surfaceSelectors = options.modalSurfaceSelectors ?? DEFAULT_MODAL_SURFACE_SELECTORS;
    let surface: HTMLElement | null = null;

    for (const selector of surfaceSelectors) {
        surface = topDialog.querySelector(selector) as HTMLElement | null;
        if (surface) {
            break;
        }
    }

    const modalSurface = surface ?? topDialog;
    let modalHost = modalSurface.querySelector(".fh-site-notifications--modal") as HTMLElement | null;

    if (!modalHost) {
        modalHost = document.createElement("div");
        modalHost.className = "fh-site-notifications fh-site-notifications--modal";
        modalHost.setAttribute("aria-live", "polite");
        modalHost.setAttribute("aria-atomic", "false");
        modalSurface.appendChild(modalHost);
    }

    appendToast(modalHost, message);
};

export const bindTermsDialog = (options: TermsDialogOptions): void => {
    const dialog = document.getElementById(options.dialogId) as HTMLDialogElement | null;
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

export const startFloatingHomeHint = (selector = ".fh-floating-home-toast"): void => {
    const toast = document.querySelector(selector) as HTMLElement | null;
    if (!toast || toast.dataset.started === "true") {
        return;
    }

    toast.dataset.started = "true";
    const intervalMs = 15000;

    const pulse = (): void => {
        toast.classList.remove("is-visible");
        void toast.offsetWidth;
        toast.classList.add("is-visible");
    };

    let nextTick = performance.now() + intervalMs;

    const scheduleNext = (): void => {
        const delay = Math.max(0, nextTick - performance.now());
        window.setTimeout(() => {
            pulse();
            nextTick += intervalMs;
            scheduleNext();
        }, delay);
    };

    scheduleNext();
};

export const bindHoverToasts = (options: HoverToastOptions = {}): void => {
    const scope = options.scope ?? document;
    const selector = options.selector ?? "button, .fh-tab";
    const describe = options.describe ?? ((element: Element) => {
        const candidate = element as HTMLElement;
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
        const target = element as HTMLElement;
        if (target.dataset.hoverToastBound === "true") {
            return;
        }

        target.dataset.hoverToastBound = "true";

        let lastShownAt = 0;
        const showHoverToast = (): void => {
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

            const toast = document.getElementById(toastId) as HTMLDivElement | null;
            toast?.classList.add("is-leaving");
            window.setTimeout(() => toast?.remove(), 180);
            delete target.dataset.hoverToastId;
        });

        target.addEventListener("blur", () => {
            const toastId = target.dataset.hoverToastId;
            if (!toastId) {
                return;
            }

            const toast = document.getElementById(toastId) as HTMLDivElement | null;
            toast?.remove();
            delete target.dataset.hoverToastId;
        });
    });
};

export const syncFooterMetadata = async (): Promise<void> => {
    const footerVersion = document.getElementById("footerVersion");
    const footerCopyright = document.getElementById("footerCopyright");

    const currentYear = String(new Date().getFullYear());

    if (footerCopyright) {
        footerCopyright.textContent = `© Copyright ${currentYear} FisioHub. Todos os direitos reservados.`;
    }

    if (!footerVersion) {
        return;
    }

    try {
        const response = await fetch("package.json", { cache: "no-store" });
        if (!response.ok) {
            return;
        }

        const packageInfo = (await response.json()) as AppPackageInfo;
        if (packageInfo.version) {
            const normalizedVersion = String(packageInfo.version).replace(/^v/i, "");
            footerVersion.textContent = `Versão: ${normalizedVersion}`;
        }
    } catch {
        return;
    }
};