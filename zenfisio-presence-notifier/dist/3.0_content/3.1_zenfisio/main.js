import { STORAGE_KEYS } from "../../1.0_shared/constants.js";
import { initExtensionState, onStateChange, toggleExtensionState } from "./extensionState.js";
import { clearHistoryFromBackground } from "./messaging.js";
import { showToast } from "./notifications.js";
import { initStatusMonitor } from "./statusMonitor.js";
const DEFAULT_POSITION = {
    left: 20,
    top: 20
};
const DEFAULT_PREFERENCES = {
    position: DEFAULT_POSITION,
    minimized: false
};
const CARD_CLASS = "zen-state-card";
const CARD_STYLE_ID = "zen-state-card-style";
const storageGet = (keys) => {
    return new Promise(resolve => {
        chrome.storage.local.get(keys, result => resolve(result));
    });
};
const storageSet = (value) => {
    return new Promise(resolve => {
        chrome.storage.local.set(value, () => resolve());
    });
};
const clamp = (value, min, max) => {
    return Math.max(min, Math.min(value, max));
};
const ensureStyles = () => {
    if (document.getElementById(CARD_STYLE_ID)) {
        return;
    }
    const style = document.createElement("style");
    style.id = CARD_STYLE_ID;
    style.textContent = `
    .${CARD_CLASS} {
      position: fixed;
      left: 20px;
      top: 20px;
      z-index: 2147483647;
      width: min(392px, calc(100vw - 28px));
      min-height: 248px;
      border-radius: 26px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      overflow: hidden;
      color: #fff;
      font-family: Segoe UI, Arial, sans-serif;
      user-select: none;
      touch-action: none;
      transition:
        width 180ms ease,
        min-height 180ms ease,
        box-shadow 180ms ease,
        border-color 180ms ease,
        background 180ms ease,
        transform 180ms ease;
      backdrop-filter: blur(14px);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.38), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
    }

    .${CARD_CLASS}[data-minimized="false"] {
      background: linear-gradient(180deg, rgba(17, 22, 33, 0.96), rgba(9, 13, 20, 0.96));
    }

    .${CARD_CLASS}[data-enabled="true"][data-minimized="false"] {
      border-color: rgba(110, 231, 183, 0.22);
      box-shadow:
        0 24px 60px rgba(0, 0, 0, 0.38),
        0 0 0 1px rgba(255, 255, 255, 0.04) inset,
        0 0 0 1px rgba(46, 125, 50, 0.18);
    }

    .${CARD_CLASS}[data-enabled="false"][data-minimized="false"] {
      border-color: rgba(248, 113, 113, 0.24);
      box-shadow:
        0 24px 60px rgba(0, 0, 0, 0.38),
        0 0 0 1px rgba(255, 255, 255, 0.04) inset,
        0 0 0 1px rgba(198, 40, 40, 0.16);
    }

    .${CARD_CLASS}[data-minimized="true"] {
      width: 248px;
      min-height: 84px;
      border-color: rgba(255, 255, 255, 0.16);
      box-shadow: 0 18px 46px rgba(0, 0, 0, 0.34);
    }

    .${CARD_CLASS}[data-enabled="true"][data-minimized="true"] {
      background: linear-gradient(135deg, #0c7a36 0%, #12b76a 52%, #0ea5e9 100%);
    }

    .${CARD_CLASS}[data-enabled="false"][data-minimized="true"] {
      background: linear-gradient(135deg, #7f1d1d 0%, #dc2626 54%, #f97316 100%);
    }

    .zen-state-card__accent {
      height: 4px;
      background: linear-gradient(90deg, #68d391, #2b6cb0, #7c3aed);
      transition: opacity 180ms ease;
    }

    .${CARD_CLASS}[data-enabled="true"] .zen-state-card__accent {
      background: linear-gradient(90deg, #34d399, #06b6d4, #8b5cf6);
    }

    .${CARD_CLASS}[data-enabled="false"] .zen-state-card__accent {
      background: linear-gradient(90deg, #f87171, #ef4444, #f59e0b);
    }

    .${CARD_CLASS}[data-minimized="true"] .zen-state-card__accent {
      opacity: 0;
    }

    .zen-state-card__content {
      display: grid;
      gap: 14px;
      padding: 16px;
    }

    .zen-state-card__expanded {
      display: grid;
      gap: 14px;
    }

    .zen-state-card__compact {
      display: grid;
      gap: 10px;
      align-items: center;
      min-height: 76px;
    }

    .${CARD_CLASS}[data-minimized="false"] .zen-state-card__compact {
      display: none;
    }

    .${CARD_CLASS}[data-minimized="true"] .zen-state-card__expanded {
      display: none;
    }

    .zen-state-card__drag-handle {
      cursor: grab;
    }

    .${CARD_CLASS}.is-dragging .zen-state-card__drag-handle {
      cursor: grabbing;
    }

    .zen-state-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .zen-state-card__brand {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .zen-state-card__title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .zen-state-card__title {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }

    .zen-state-card__subtitle {
      font-size: 12px;
      line-height: 1.45;
      color: rgba(255, 255, 255, 0.72);
    }

    .zen-state-card__pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.08);
      color: #ffd2d2;
    }

    .zen-state-card__pill.is-on {
      background: rgba(46, 125, 50, 0.26);
      color: #b9ffd0;
    }

    .zen-state-card__pill.is-off {
      background: rgba(198, 40, 40, 0.24);
      color: #ffd2d2;
    }

    .zen-state-card__state {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.04em;
      line-height: 1;
    }

    .zen-state-card__state.is-on {
      color: #ecfff2;
    }

    .zen-state-card__state.is-off {
      color: #fff1f1;
    }

    .zen-state-card__state-note {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.76);
    }

    .zen-state-card__panel {
      display: grid;
      gap: 10px;
      padding: 14px;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .zen-state-card__panel-label {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.56);
    }

    .zen-state-card__panel-value {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.03em;
    }

    .zen-state-card__panel-help {
      font-size: 12px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.72);
    }

    .zen-state-card__actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .zen-state-card__button {
      border: none;
      border-radius: 14px;
      padding: 12px 14px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 800;
      color: #fff;
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.18);
      transition: transform 120ms ease, filter 120ms ease, opacity 120ms ease;
    }

    .zen-state-card__button:hover {
      transform: translateY(-1px);
    }

    .zen-state-card__button:focus-visible {
      outline: 3px solid rgba(255, 255, 255, 0.32);
      outline-offset: 2px;
    }

    .zen-state-card__button--primary {
      background: linear-gradient(135deg, #2b6cb0, #3b82f6);
    }

    .zen-state-card__button--secondary {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .zen-state-card__button--danger {
      background: linear-gradient(135deg, #7f1d1d, #dc2626);
    }

    .zen-state-card__button--ghost {
      background: rgba(255, 255, 255, 0.08);
    }

    .zen-state-card__button--full {
      grid-column: 1 / -1;
    }

    .zen-state-card__footer {
      text-align: center;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.56);
    }

    .zen-state-card__compact-top {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
      align-items: start;
    }

    .zen-state-card__compact-labels {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .zen-state-card__compact-title {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: -0.02em;
    }

    .zen-state-card__compact-state {
      font-size: 20px;
      line-height: 1;
      font-weight: 1000;
      letter-spacing: -0.05em;
    }

    .zen-state-card__compact-state.is-on {
      color: #ecfff2;
    }

    .zen-state-card__compact-state.is-off {
      color: #fff1f1;
    }

    .zen-state-card__compact-button {
      width: 100%;
      min-width: 0;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.14);
      justify-self: stretch;
    }

    .zen-state-card__move-hint {
      display: none;
      font-size: 11px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.72);
    }

    .${CARD_CLASS}.is-move-hint .zen-state-card__move-hint {
      display: block;
    }
  `;
    document.head.appendChild(style);
};
const readSavedPreferences = async () => {
    try {
        const stored = await storageGet([
            STORAGE_KEYS.CARD_POSITION,
            STORAGE_KEYS.CARD_MINIMIZED
        ]);
        const rawPosition = stored[STORAGE_KEYS.CARD_POSITION];
        const rawMinimized = stored[STORAGE_KEYS.CARD_MINIMIZED];
        const position = rawPosition && typeof rawPosition.left === "number" && typeof rawPosition.top === "number"
            ? { left: rawPosition.left, top: rawPosition.top }
            : DEFAULT_POSITION;
        return {
            position,
            minimized: rawMinimized === true
        };
    }
    catch {
        return DEFAULT_PREFERENCES;
    }
};
const savePreferences = async (preferences) => {
    await storageSet({
        [STORAGE_KEYS.CARD_POSITION]: preferences.position,
        [STORAGE_KEYS.CARD_MINIMIZED]: preferences.minimized
    });
};
const createFloatingStateCard = async () => {
    ensureStyles();
    const preferences = await readSavedPreferences();
    let currentEnabled = false;
    let currentMinimized = preferences.minimized;
    let currentPosition = preferences.position;
    const card = document.createElement("section");
    card.id = CARD_CLASS;
    card.className = CARD_CLASS;
    card.setAttribute("aria-label", "Controle da extensao Zenfisio");
    card.dataset.enabled = "false";
    card.dataset.minimized = String(currentMinimized);
    const accent = document.createElement("div");
    accent.className = "zen-state-card__accent";
    const content = document.createElement("div");
    content.className = "zen-state-card__content";
    const compactView = document.createElement("div");
    compactView.className = "zen-state-card__compact";
    const compactTop = document.createElement("div");
    compactTop.className = "zen-state-card__compact-top zen-state-card__drag-handle";
    const compactLabels = document.createElement("div");
    compactLabels.className = "zen-state-card__compact-labels";
    const compactTitle = document.createElement("div");
    compactTitle.className = "zen-state-card__compact-title";
    compactTitle.textContent = "Zenfisio Notifier";
    const compactState = document.createElement("div");
    compactState.className = "zen-state-card__compact-state";
    compactState.textContent = "DESATIVADO";
    compactLabels.appendChild(compactTitle);
    compactLabels.appendChild(compactState);
    const compactButton = document.createElement("button");
    compactButton.type = "button";
    compactButton.className = "zen-state-card__button zen-state-card__button--ghost zen-state-card__compact-button";
    compactButton.textContent = "Expandir";
    compactTop.appendChild(compactLabels);
    compactTop.appendChild(compactButton);
    const compactHint = document.createElement("div");
    compactHint.className = "zen-state-card__move-hint";
    compactHint.textContent = "Arraste pelo topo para mover.";
    compactView.appendChild(compactTop);
    compactView.appendChild(compactHint);
    const expandedView = document.createElement("div");
    expandedView.className = "zen-state-card__expanded";
    const header = document.createElement("div");
    header.className = "zen-state-card__header zen-state-card__drag-handle";
    const brand = document.createElement("div");
    brand.className = "zen-state-card__brand";
    const titleRow = document.createElement("div");
    titleRow.className = "zen-state-card__title-row";
    const title = document.createElement("div");
    title.className = "zen-state-card__title";
    title.textContent = "Zenfisio Notifier";
    const statusPill = document.createElement("span");
    statusPill.className = "zen-state-card__pill is-off";
    statusPill.textContent = "OFF";
    const subtitle = document.createElement("div");
    subtitle.className = "zen-state-card__subtitle";
    subtitle.textContent = "Controle visual da extensao na Zenfisio";
    titleRow.appendChild(title);
    titleRow.appendChild(statusPill);
    brand.appendChild(titleRow);
    brand.appendChild(subtitle);
    const minimizeButton = document.createElement("button");
    minimizeButton.type = "button";
    minimizeButton.className = "zen-state-card__button zen-state-card__button--secondary";
    minimizeButton.textContent = "Minimizar";
    header.appendChild(brand);
    header.appendChild(minimizeButton);
    const statusPanel = document.createElement("div");
    statusPanel.className = "zen-state-card__panel";
    const statusLabel = document.createElement("div");
    statusLabel.className = "zen-state-card__panel-label";
    statusLabel.textContent = "Estado atual";
    const statusValue = document.createElement("div");
    statusValue.className = "zen-state-card__panel-value";
    statusValue.textContent = "Notifier desativado";
    const statusHelp = document.createElement("div");
    statusHelp.className = "zen-state-card__panel-help";
    statusHelp.textContent = "Atalhos e ações continuam funcionando. O card pode ser reposicionado e sua posição fica salva.";
    statusPanel.appendChild(statusLabel);
    statusPanel.appendChild(statusValue);
    statusPanel.appendChild(statusHelp);
    const actions = document.createElement("div");
    actions.className = "zen-state-card__actions";
    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "zen-state-card__button zen-state-card__button--primary";
    toggleButton.textContent = "Ativar / desativar";
    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "zen-state-card__button zen-state-card__button--secondary";
    clearButton.textContent = "Limpar cache";
    const moveButton = document.createElement("button");
    moveButton.type = "button";
    moveButton.className = "zen-state-card__button zen-state-card__button--danger";
    moveButton.textContent = "Reposicionar";
    const expandButton = document.createElement("button");
    expandButton.type = "button";
    expandButton.className = "zen-state-card__button zen-state-card__button--secondary zen-state-card__button--full";
    expandButton.textContent = "Minimizar";
    actions.appendChild(toggleButton);
    actions.appendChild(clearButton);
    actions.appendChild(moveButton);
    actions.appendChild(expandButton);
    const footer = document.createElement("div");
    footer.className = "zen-state-card__footer";
    footer.textContent = "Dica: arraste pelo topo para mudar o local.";
    expandedView.appendChild(header);
    expandedView.appendChild(statusPanel);
    expandedView.appendChild(actions);
    expandedView.appendChild(footer);
    content.appendChild(compactView);
    content.appendChild(expandedView);
    card.appendChild(accent);
    card.appendChild(content);
    document.body.appendChild(card);
    const applyEnabledState = (enabled) => {
        currentEnabled = enabled;
        card.dataset.enabled = String(enabled);
        statusPill.textContent = enabled ? "ON" : "OFF";
        statusPill.className = `zen-state-card__pill ${enabled ? "is-on" : "is-off"}`;
        statusValue.textContent = enabled ? "Notifier ativado" : "Notifier desativado";
        compactState.textContent = enabled ? "ATIVADO" : "DESATIVADO";
        compactState.className = `zen-state-card__compact-state ${enabled ? "is-on" : "is-off"}`;
    };
    const clampToViewport = async (position) => {
        const rect = card.getBoundingClientRect();
        const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
        const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
        const nextLeft = clamp(position.left, 8, maxLeft);
        const nextTop = clamp(position.top, 8, maxTop);
        currentPosition = { left: nextLeft, top: nextTop };
        card.style.left = `${nextLeft}px`;
        card.style.top = `${nextTop}px`;
        await savePreferences({ position: currentPosition, minimized: currentMinimized });
    };
    const applyMinimizedState = async (minimized) => {
        currentMinimized = minimized;
        card.dataset.minimized = String(minimized);
        minimizeButton.textContent = minimized ? "Expandir" : "Minimizar";
        expandButton.textContent = minimized ? "Expandir" : "Minimizar";
        compactButton.textContent = "Expandir";
        if (minimized) {
            compactHint.textContent = "Arraste pelo topo para mover.";
        }
        else {
            compactHint.textContent = "Arraste o card para reposicionar.";
        }
        await savePreferences({ position: currentPosition, minimized: currentMinimized });
        await clampToViewport(currentPosition);
    };
    const startDrag = (event) => {
        if (event.button !== 0) {
            return;
        }
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (target && target.closest("button")) {
            return;
        }
        event.preventDefault();
        const rect = card.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        const onPointerMove = (moveEvent) => {
            card.classList.add("is-dragging");
            const nextLeft = clamp(moveEvent.clientX - offsetX, 8, Math.max(8, window.innerWidth - rect.width - 8));
            const nextTop = clamp(moveEvent.clientY - offsetY, 8, Math.max(8, window.innerHeight - rect.height - 8));
            currentPosition = { left: nextLeft, top: nextTop };
            card.style.left = `${nextLeft}px`;
            card.style.top = `${nextTop}px`;
        };
        const onPointerUp = async () => {
            card.classList.remove("is-dragging");
            window.removeEventListener("pointermove", onPointerMove, true);
            window.removeEventListener("pointerup", onPointerUp, true);
            await savePreferences({ position: currentPosition, minimized: currentMinimized });
            showToast("Posicao do card salva.", "ok");
        };
        window.addEventListener("pointermove", onPointerMove, true);
        window.addEventListener("pointerup", onPointerUp, true);
    };
    const promptMoveMode = () => {
        card.classList.add("is-move-hint");
        showToast("Arraste o topo do card para reposicionar.", "warn");
        window.setTimeout(() => card.classList.remove("is-move-hint"), 2200);
    };
    header.addEventListener("pointerdown", startDrag);
    compactTop.addEventListener("pointerdown", startDrag);
    minimizeButton.addEventListener("click", event => {
        event.stopPropagation();
        void applyMinimizedState(!currentMinimized);
    });
    compactButton.addEventListener("click", event => {
        event.stopPropagation();
        void applyMinimizedState(false);
    });
    expandButton.addEventListener("click", event => {
        event.stopPropagation();
        void applyMinimizedState(!currentMinimized);
    });
    toggleButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        try {
            const enabled = await toggleExtensionState();
            applyEnabledState(enabled);
            showToast(enabled ? "Extensao ativada" : "Extensao desativada", "ok");
        }
        catch (error) {
            showToast(`Falha ao alternar estado: ${error instanceof Error ? error.message : String(error)}`, "error");
        }
    });
    clearButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        try {
            const ok = await clearHistoryFromBackground();
            showToast(ok ? "Historico limpo" : "Nao foi possivel limpar historico", ok ? "ok" : "error");
        }
        catch (error) {
            showToast(`Falha ao limpar historico: ${error instanceof Error ? error.message : String(error)}`, "error");
        }
    });
    moveButton.addEventListener("click", event => {
        event.stopPropagation();
        promptMoveMode();
    });
    onStateChange(value => {
        applyEnabledState(value);
    });
    window.addEventListener("resize", () => {
        void clampToViewport(currentPosition);
    });
    applyEnabledState(await initExtensionState());
    await applyMinimizedState(currentMinimized);
    await clampToViewport(currentPosition);
};
const registerKeyboardShortcut = () => {
    document.addEventListener("keydown", event => {
        if (!(event.ctrlKey && event.shiftKey && (event.key === "Z" || event.key === "z"))) {
            return;
        }
        event.preventDefault();
        void toggleExtensionState()
            .then(enabled => {
            showToast(enabled ? "Extensao ativada" : "Extensao desativada", "ok");
        })
            .catch(error => {
            showToast(`Falha ao alternar estado: ${error instanceof Error ? error.message : String(error)}`, "error");
        });
    }, true);
};
const bootstrap = async () => {
    await initExtensionState();
    await createFloatingStateCard();
    registerKeyboardShortcut();
    initStatusMonitor();
};
if (document.readyState === "complete" || document.readyState === "interactive") {
    void bootstrap();
}
else {
    document.addEventListener("DOMContentLoaded", () => {
        void bootstrap();
    }, { once: true });
}
