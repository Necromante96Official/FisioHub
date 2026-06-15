import { STORAGE_KEYS } from "../../shared/constants.js";
import { initExtensionState, onStateChange, toggleExtensionState } from "./extensionState.js";
import { clearHistoryFromBackground, getExtensionStatusFromBackground, openChatFromBackground, openHistoryFromBackground, openZenfisioFromBackground, testChatFromBackground } from "./messaging.js";
import { showToast } from "./notifications.js";
import { initNetworkMonitor } from "./networkMonitor.js";
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
      width: min(298px, calc(100vw - 20px));
      min-height: 202px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.10);
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
      backdrop-filter: blur(16px);
      box-shadow:
        0 18px 44px rgba(0, 0, 0, 0.42),
        0 0 0 1px rgba(255, 255, 255, 0.04) inset;
    }

    .${CARD_CLASS}[data-minimized="false"] {
      background:
        radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 42%),
        linear-gradient(180deg, rgba(17, 24, 39, 0.98), rgba(8, 12, 21, 0.98));
    }

    .${CARD_CLASS}[data-enabled="true"][data-minimized="false"] {
      background:
        radial-gradient(circle at top left, rgba(34, 197, 94, 0.24), transparent 38%),
        linear-gradient(180deg, rgba(8, 47, 31, 0.98), rgba(4, 20, 15, 0.98));
    }

    .${CARD_CLASS}[data-enabled="false"][data-minimized="false"] {
      background:
        radial-gradient(circle at top left, rgba(239, 68, 68, 0.24), transparent 38%),
        linear-gradient(180deg, rgba(58, 12, 17, 0.98), rgba(24, 8, 10, 0.98));
    }

    .${CARD_CLASS}[data-enabled="true"][data-minimized="false"] {
      border-color: rgba(110, 231, 183, 0.30);
      box-shadow:
        0 18px 44px rgba(0, 0, 0, 0.42),
        0 0 0 1px rgba(34, 197, 94, 0.10) inset;
    }

    .${CARD_CLASS}[data-enabled="false"][data-minimized="false"] {
      border-color: rgba(248, 113, 113, 0.26);
      box-shadow:
        0 18px 44px rgba(0, 0, 0, 0.42),
        0 0 0 1px rgba(239, 68, 68, 0.10) inset;
    }

    .${CARD_CLASS}[data-minimized="true"] {
      width: 236px;
      min-height: 136px;
      border-color: rgba(255, 255, 255, 0.12);
      box-shadow:
        0 18px 40px rgba(0, 0, 0, 0.34),
        0 0 0 1px rgba(255, 255, 255, 0.03) inset;
    }

    .${CARD_CLASS}[data-enabled="true"][data-minimized="true"] {
      background:
        radial-gradient(circle at top left, rgba(34, 197, 94, 0.32), transparent 38%),
        linear-gradient(180deg, rgba(6, 78, 59, 0.98), rgba(3, 46, 31, 0.98));
    }

    .${CARD_CLASS}[data-enabled="false"][data-minimized="true"] {
      background:
        radial-gradient(circle at top left, rgba(239, 68, 68, 0.32), transparent 38%),
        linear-gradient(180deg, rgba(127, 29, 29, 0.98), rgba(69, 10, 10, 0.98));
    }

    .zen-state-card__accent {
      height: 4px;
      background: linear-gradient(90deg, #68d391, #2b6cb0, #7c3aed);
      transition: opacity 180ms ease;
    }

    .${CARD_CLASS}[data-enabled="true"] .zen-state-card__accent {
      background: linear-gradient(90deg, #22c55e, #16a34a, #15803d);
    }

    .${CARD_CLASS}[data-enabled="false"] .zen-state-card__accent {
      background: linear-gradient(90deg, #f87171, #ef4444, #b91c1c);
    }

    .${CARD_CLASS}[data-minimized="true"] .zen-state-card__accent {
      opacity: 0;
    }

    .zen-state-card__content {
      display: grid;
      gap: 12px;
      padding: 12px;
    }

    .zen-state-card__expanded {
      display: grid;
      gap: 12px;
    }

    .zen-state-card__compact {
      display: grid;
      gap: 10px;
      align-items: center;
      justify-items: center;
      min-height: 132px;
      text-align: center;
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
      font-size: 15px;
      font-weight: 850;
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
      padding: 5px 9px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.07);
      color: #ffd2d2;
    }

    .zen-state-card__pill.is-on {
      background: rgba(34, 197, 94, 0.22);
      color: #dcfce7;
    }

    .zen-state-card__pill.is-off {
      background: rgba(239, 68, 68, 0.22);
      color: #fee2e2;
    }

    .zen-state-card__state {
      display: grid;
      gap: 6px;
      justify-items: center;
      padding: 6px 0 2px;
    }

    .zen-state-card__state-label {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.55);
    }

    .zen-state-card__state-value {
      font-size: 26px;
      line-height: 1;
      font-weight: 1000;
      letter-spacing: -0.05em;
    }

    .zen-state-card__state-value.is-on {
      color: #bbf7d0;
    }

    .zen-state-card__state-value.is-off {
      color: #fecaca;
    }

    .zen-state-card__shortcut {
      display: grid;
      gap: 5px;
      justify-items: center;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.04em;
      color: rgba(255, 255, 255, 0.78);
      line-height: 1.2;
    }

    .zen-state-card__shortcut code {
      padding: 4px 7px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.07);
      font: inherit;
      color: #fff;
    }

    .zen-state-card__actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .zen-state-card__button {
      border: none;
      border-radius: 12px;
      padding: 10px 12px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 800;
      color: #fff;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.16);
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
      background: linear-gradient(135deg, #2563eb, #60a5fa);
    }

    .zen-state-card__button--secondary {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.07);
    }

    .zen-state-card__button--danger {
      background: linear-gradient(135deg, #991b1b, #ef4444);
    }

    .zen-state-card__button--full {
      grid-column: 1 / -1;
    }

    .zen-state-card__button--ghost {
      background: rgba(255, 255, 255, 0.06);
    }

    .zen-state-card__compact-button {
      width: 100%;
      min-width: 0;
      max-width: 100%;
      justify-self: stretch;
    }

    .zen-state-card__footer {
      text-align: center;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.50);
    }

    .zen-state-card__move-hint {
      display: none;
      font-size: 11px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.72);
      text-align: center;
    }

    .${CARD_CLASS}.is-move-hint .zen-state-card__move-hint {
      display: block;
    }

    .${CARD_CLASS}.zen-notify-launcher {
      width: auto;
      min-height: 0;
      border: 0;
      overflow: visible;
      background: transparent;
      box-shadow: none;
      backdrop-filter: none;
      transition: transform 180ms ease, filter 180ms ease;
    }

    .zen-notify-launcher.is-dragging {
      filter: drop-shadow(0 22px 34px rgba(0, 0, 0, 0.38));
      transform: scale(1.02);
    }

    .zen-notify-launcher__button {
      width: 116px;
      height: 116px;
      border: 0;
      border-radius: 50%;
      padding: 0;
      background: transparent;
      cursor: grab;
      display: grid;
      place-items: center;
      filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.34));
      transition: transform 180ms cubic-bezier(.2,.8,.2,1), filter 180ms ease;
      touch-action: none;
    }

    .zen-notify-launcher__button:hover,
    .zen-notify-launcher[data-open="true"] .zen-notify-launcher__button {
      transform: translateY(-2px) scale(1.05);
      filter: drop-shadow(0 18px 28px rgba(0, 72, 255, 0.32));
    }

    .zen-notify-launcher__button:active,
    .zen-notify-launcher.is-dragging .zen-notify-launcher__button {
      cursor: grabbing;
      transform: scale(0.97);
    }

    .zen-notify-launcher__image {
      width: 116px;
      height: 116px;
      object-fit: contain;
      display: block;
      pointer-events: none;
      user-select: none;
    }

    .zen-notify-launcher__state-card {
      width: 108px;
      margin: 4px auto 0;
      padding: 5px 8px;
      border-radius: 999px;
      text-align: center;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.04em;
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
      transform: translateY(0);
      transition: background 180ms ease, color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
    }

    .zen-notify-launcher[data-enabled="true"] .zen-notify-launcher__state-card {
      background: linear-gradient(135deg, #16a34a, #22c55e);
      color: #ecfdf5;
    }

    .zen-notify-launcher[data-enabled="false"] .zen-notify-launcher__state-card {
      background: linear-gradient(135deg, #991b1b, #ef4444);
      color: #fff1f2;
    }

    .zen-notify-launcher__button:hover + .zen-notify-launcher__state-card,
    .zen-notify-launcher[data-open="true"] .zen-notify-launcher__state-card {
      transform: translateY(2px);
      box-shadow: 0 10px 22px rgba(0, 0, 0, 0.28);
    }

    .zen-notify-launcher__menu {
      position: absolute;
      top: 8px;
      left: calc(100% + 12px);
      width: 272px;
      display: grid;
      gap: 8px;
      padding: 12px;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background:
        radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 42%),
        linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98));
      color: #fff;
      box-shadow: 0 22px 48px rgba(0, 0, 0, 0.42);
      backdrop-filter: blur(16px);
      opacity: 0;
      pointer-events: none;
      transform: translateX(-8px) translateY(8px) scale(0.96);
      transform-origin: top left;
      transition: opacity 180ms ease, transform 220ms cubic-bezier(.2,.8,.2,1);
    }

    .zen-notify-launcher[data-open="true"] .zen-notify-launcher__menu {
      opacity: 1;
      pointer-events: auto;
      transform: translateX(0) translateY(0) scale(1);
    }

    .zen-notify-launcher__menu-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.01em;
    }

    .zen-notify-launcher__status {
      display: grid;
      gap: 4px;
      padding: 8px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 11px;
      line-height: 1.35;
      color: rgba(255, 255, 255, 0.78);
      overflow-wrap: anywhere;
    }

    .zen-notify-launcher__status strong {
      color: #dbeafe;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .zen-notify-launcher__status[data-error="true"] {
      border-color: rgba(248, 113, 113, 0.32);
      background: rgba(127, 29, 29, 0.32);
      color: #fecaca;
    }

    .zen-notify-launcher__shortcut {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.76);
      font-size: 11px;
      font-weight: 800;
    }

    .zen-notify-launcher__shortcut code {
      padding: 4px 7px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #fff;
      font: inherit;
      white-space: nowrap;
    }

    .zen-notify-launcher__action {
      width: 100%;
      min-height: 38px;
      border: 1px solid rgba(255, 255, 255, 0.10);
      border-radius: 12px;
      padding: 9px 10px;
      background: rgba(255, 255, 255, 0.07);
      color: #fff;
      cursor: pointer;
      text-align: left;
      font-size: 12px;
      font-weight: 800;
      opacity: 0;
      transform: translateY(8px);
      transition:
        opacity 180ms ease,
        transform 220ms cubic-bezier(.2,.8,.2,1),
        border-color 140ms ease,
        background 140ms ease;
    }

    .zen-notify-launcher[data-open="true"] .zen-notify-launcher__action {
      opacity: 1;
      transform: translateY(0);
    }

    .zen-notify-launcher[data-open="true"] .zen-notify-launcher__action:nth-of-type(1) { transition-delay: 20ms; }
    .zen-notify-launcher[data-open="true"] .zen-notify-launcher__action:nth-of-type(2) { transition-delay: 45ms; }
    .zen-notify-launcher[data-open="true"] .zen-notify-launcher__action:nth-of-type(3) { transition-delay: 70ms; }
    .zen-notify-launcher[data-open="true"] .zen-notify-launcher__action:nth-of-type(4) { transition-delay: 95ms; }
    .zen-notify-launcher[data-open="true"] .zen-notify-launcher__action:nth-of-type(5) { transition-delay: 120ms; }
    .zen-notify-launcher[data-open="true"] .zen-notify-launcher__action:nth-of-type(6) { transition-delay: 145ms; }

    .zen-notify-launcher__action:hover,
    .zen-notify-launcher__action:focus-visible {
      background: rgba(59, 130, 246, 0.26);
      border-color: rgba(147, 197, 253, 0.44);
      transform: translateY(-1px);
      outline: none;
    }

    .zen-notify-launcher__action--danger:hover,
    .zen-notify-launcher__action--danger:focus-visible {
      background: rgba(239, 68, 68, 0.24);
      border-color: rgba(252, 165, 165, 0.44);
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
    let currentPosition = preferences.position;
    let menuOpen = false;
    const card = document.createElement("section");
    card.id = CARD_CLASS;
    card.className = `${CARD_CLASS} zen-notify-launcher`;
    card.setAttribute("aria-label", "Menu de notificacoes da extensao Zenfisio");
    card.dataset.enabled = "false";
    card.dataset.open = "false";
    const launcherButton = document.createElement("button");
    launcherButton.type = "button";
    launcherButton.className = "zen-notify-launcher__button";
    launcherButton.setAttribute("aria-label", "Abrir menu de notificacoes");
    launcherButton.setAttribute("aria-expanded", "false");
    const launcherImage = document.createElement("img");
    launcherImage.className = "zen-notify-launcher__image";
    launcherImage.src = chrome.runtime.getURL("assets/botao-notificar-mensagem.png");
    launcherImage.alt = "Sistema Notificar Mensagens no Chat";
    launcherImage.draggable = false;
    launcherButton.appendChild(launcherImage);
    const stateCard = document.createElement("div");
    stateCard.className = "zen-notify-launcher__state-card";
    stateCard.textContent = "Desativado";
    const menu = document.createElement("div");
    menu.className = "zen-notify-launcher__menu";
    menu.setAttribute("role", "menu");
    const menuTitle = document.createElement("div");
    menuTitle.className = "zen-notify-launcher__menu-title";
    const menuTitleText = document.createElement("span");
    menuTitleText.textContent = "Notificar mensagens";
    const stateBadge = document.createElement("span");
    stateBadge.textContent = "OFF";
    menuTitle.appendChild(menuTitleText);
    menuTitle.appendChild(stateBadge);
    const statusBox = document.createElement("div");
    statusBox.className = "zen-notify-launcher__status";
    statusBox.dataset.error = "false";
    const statusTitle = document.createElement("strong");
    statusTitle.textContent = "Status";
    const statusMessage = document.createElement("span");
    statusMessage.textContent = "Sem erro recente.";
    statusBox.appendChild(statusTitle);
    statusBox.appendChild(statusMessage);
    const shortcutInfo = document.createElement("div");
    shortcutInfo.className = "zen-notify-launcher__shortcut";
    const shortcutLabel = document.createElement("span");
    shortcutLabel.textContent = "Ativar/desativar";
    const shortcutCode = document.createElement("code");
    shortcutCode.textContent = "Ctrl + Shift + Z";
    shortcutInfo.appendChild(shortcutLabel);
    shortcutInfo.appendChild(shortcutCode);
    const createMenuButton = (label, danger = false) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `zen-notify-launcher__action${danger ? " zen-notify-launcher__action--danger" : ""}`;
        button.setAttribute("role", "menuitem");
        button.textContent = label;
        return button;
    };
    const toggleButton = createMenuButton("Ativar / desativar monitor");
    const clearButton = createMenuButton("Limpar Historico", true);
    const historyButton = createMenuButton("Ver Histórico");
    const openChatButton = createMenuButton("Abrir chat");
    const openZenfisioButton = createMenuButton("Abrir Zenfisio");
    const testChatButton = createMenuButton("Testar chat");
    menu.appendChild(menuTitle);
    menu.appendChild(statusBox);
    menu.appendChild(shortcutInfo);
    menu.appendChild(toggleButton);
    menu.appendChild(clearButton);
    menu.appendChild(historyButton);
    menu.appendChild(openChatButton);
    menu.appendChild(openZenfisioButton);
    menu.appendChild(testChatButton);
    card.appendChild(launcherButton);
    card.appendChild(stateCard);
    card.appendChild(menu);
    document.body.appendChild(card);
    const applyEnabledState = (enabled) => {
        currentEnabled = enabled;
        card.dataset.enabled = String(enabled);
        stateBadge.textContent = enabled ? "ON" : "OFF";
        stateBadge.style.color = enabled ? "#bbf7d0" : "#fecaca";
        stateCard.textContent = enabled ? "Ativado" : "Desativado";
    };
    const setMenuOpen = async (open) => {
        menuOpen = open;
        card.dataset.open = String(open);
        launcherButton.setAttribute("aria-expanded", String(open));
        if (open) {
            await refreshStatusBox();
        }
    };
    const refreshStatusBox = async () => {
        try {
            const status = await getExtensionStatusFromBackground();
            applyEnabledState(status.enabled);
            if (status.lastError?.message) {
                statusBox.dataset.error = "true";
                statusMessage.textContent = `${status.lastError.occurredAtIso}: ${status.lastError.message}`;
            }
            else {
                statusBox.dataset.error = "false";
                statusMessage.textContent = "Sem erro recente.";
            }
        }
        catch (error) {
            statusBox.dataset.error = "true";
            statusMessage.textContent = error instanceof Error ? error.message : String(error);
        }
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
        await savePreferences({ position: currentPosition, minimized: false });
    };
    const startDrag = (event) => {
        if (event.button !== 0) {
            return;
        }
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (target && target.closest(".zen-notify-launcher__menu")) {
            return;
        }
        event.preventDefault();
        const rect = card.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        const startX = event.clientX;
        const startY = event.clientY;
        let moved = false;
        const onPointerMove = (moveEvent) => {
            if (Math.abs(moveEvent.clientX - startX) > 4 || Math.abs(moveEvent.clientY - startY) > 4) {
                moved = true;
            }
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
            if (moved) {
                await savePreferences({ position: currentPosition, minimized: false });
                showToast("Posicao do botao salva.", "ok");
                return;
            }
            await setMenuOpen(!menuOpen);
        };
        window.addEventListener("pointermove", onPointerMove, true);
        window.addEventListener("pointerup", onPointerUp, true);
    };
    launcherButton.addEventListener("pointerdown", startDrag);
    toggleButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        try {
            const enabled = await toggleExtensionState();
            applyEnabledState(enabled);
            showToast(enabled ? "Extensao ativada" : "Extensao desativada", "ok");
            await refreshStatusBox();
        }
        catch (error) {
            showToast(`Falha ao alternar estado: ${error instanceof Error ? error.message : String(error)}`, "error");
            await refreshStatusBox();
        }
    });
    clearButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        try {
            const ok = await clearHistoryFromBackground();
            showToast(ok ? "Historico limpo" : "Nao foi possivel limpar historico", ok ? "ok" : "error");
            await refreshStatusBox();
        }
        catch (error) {
            showToast(`Falha ao limpar historico: ${error instanceof Error ? error.message : String(error)}`, "error");
            await refreshStatusBox();
        }
    });
    historyButton.addEventListener("click", event => {
        event.stopPropagation();
        void openHistoryFromBackground()
            .then(ok => {
            showToast(ok ? "Historico aberto." : "Nao foi possivel abrir o historico.", ok ? "ok" : "error");
        })
            .catch(error => {
            showToast(`Falha ao abrir historico: ${error instanceof Error ? error.message : String(error)}`, "error");
        });
    });
    openChatButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        const ok = await openChatFromBackground();
        showToast(ok ? "Chat aberto." : "Nao foi possivel abrir o chat.", ok ? "ok" : "error");
        await refreshStatusBox();
    });
    openZenfisioButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        const ok = await openZenfisioFromBackground();
        showToast(ok ? "Zenfisio aberto." : "Nao foi possivel abrir o Zenfisio.", ok ? "ok" : "error");
        await refreshStatusBox();
    });
    testChatButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        const response = await testChatFromBackground();
        showToast(response.ok ? "Mensagem de teste enviada ao chat." : `Falha no teste: ${response.error ?? "erro desconhecido"}`, response.ok ? "ok" : "error");
        await refreshStatusBox();
    });
    document.addEventListener("pointerdown", event => {
        if (!menuOpen) {
            return;
        }
        const target = event.target instanceof Node ? event.target : null;
        if (target && card.contains(target)) {
            return;
        }
        void setMenuOpen(false);
    }, true);
    onStateChange(value => {
        applyEnabledState(value);
        void refreshStatusBox();
    });
    window.addEventListener("resize", () => {
        void clampToViewport(currentPosition);
    });
    applyEnabledState(await initExtensionState());
    await clampToViewport(currentPosition);
    await setMenuOpen(false);
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
    initNetworkMonitor();
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
