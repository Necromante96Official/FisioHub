import { STORAGE_KEYS } from "../../1.0_shared/constants.js";
import { initExtensionState, onStateChange, toggleExtensionState } from "./extensionState.js";
import { clearHistoryFromBackground } from "./messaging.js";
import { showToast } from "./notifications.js";
import { initNetworkMonitor } from "./networkMonitor.js";
import { initStatusMonitor } from "./statusMonitor.js";

type CardPosition = {
  left: number;
  top: number;
};

type CardPreferences = {
  position: CardPosition;
  minimized: boolean;
};

const DEFAULT_POSITION: CardPosition = {
  left: 20,
  top: 20
};

const DEFAULT_PREFERENCES: CardPreferences = {
  position: DEFAULT_POSITION,
  minimized: false
};

const CARD_CLASS = "zen-state-card";
const CARD_STYLE_ID = "zen-state-card-style";

const storageGet = <T = Record<string, unknown>>(keys: string[]): Promise<T> => {
  return new Promise(resolve => {
    chrome.storage.local.get(keys, result => resolve(result as T));
  });
};

const storageSet = (value: Record<string, unknown>): Promise<void> => {
  return new Promise(resolve => {
    chrome.storage.local.set(value, () => resolve());
  });
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(value, max));
};

const ensureStyles = (): void => {
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
  `;

  document.head.appendChild(style);
};

const readSavedPreferences = async (): Promise<CardPreferences> => {
  try {
    const stored = await storageGet<Record<string, unknown>>([
      STORAGE_KEYS.CARD_POSITION,
      STORAGE_KEYS.CARD_MINIMIZED
    ]);

    const rawPosition = stored[STORAGE_KEYS.CARD_POSITION] as Partial<CardPosition> | undefined;
    const rawMinimized = stored[STORAGE_KEYS.CARD_MINIMIZED];

    const position =
      rawPosition && typeof rawPosition.left === "number" && typeof rawPosition.top === "number"
        ? { left: rawPosition.left, top: rawPosition.top }
        : DEFAULT_POSITION;

    return {
      position,
      minimized: rawMinimized === true
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

const savePreferences = async (preferences: CardPreferences): Promise<void> => {
  await storageSet({
    [STORAGE_KEYS.CARD_POSITION]: preferences.position,
    [STORAGE_KEYS.CARD_MINIMIZED]: preferences.minimized
  });
};

const createFloatingStateCard = async (): Promise<void> => {
  ensureStyles();

  const preferences = await readSavedPreferences();
  let currentEnabled = false;
  let currentMinimized = preferences.minimized;
  let currentPosition: CardPosition = preferences.position;

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

  const compactState = document.createElement("div");
  compactState.className = "zen-state-card__state-value";
  compactState.textContent = "OFF";

  const compactStateWrap = document.createElement("div");
  compactStateWrap.className = "zen-state-card__state";
  compactStateWrap.appendChild(compactState);

  const compactShortcut = document.createElement("div");
  compactShortcut.className = "zen-state-card__shortcut";
  compactShortcut.innerHTML = '<span>Atalho</span><code>Control + Shift + Z</code>';

  const compactButton = document.createElement("button");
  compactButton.type = "button";
  compactButton.className = "zen-state-card__button zen-state-card__button--ghost zen-state-card__compact-button";
  compactButton.textContent = "Maximizar";

  compactView.appendChild(compactStateWrap);
  compactView.appendChild(compactShortcut);
  compactView.appendChild(compactButton);

  const expandedView = document.createElement("div");
  expandedView.className = "zen-state-card__expanded";

  const header = document.createElement("div");
  header.className = "zen-state-card__header zen-state-card__drag-handle";

  const brand = document.createElement("div");
  brand.className = "zen-state-card__brand";

  const titleRow = document.createElement("div");
  titleRow.className = "zen-state-card__title-row";

  const statusPill = document.createElement("span");
  statusPill.className = "zen-state-card__pill is-off";
  statusPill.textContent = "OFF";

  titleRow.appendChild(statusPill);
  brand.appendChild(titleRow);

  const minimizeButton = document.createElement("button");
  minimizeButton.type = "button";
  minimizeButton.className = "zen-state-card__button zen-state-card__button--secondary";
  minimizeButton.textContent = "Minimizar";

  header.appendChild(brand);
  header.appendChild(minimizeButton);

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

  const historyButton = document.createElement("button");
  historyButton.type = "button";
  historyButton.className = "zen-state-card__button zen-state-card__button--secondary";
  historyButton.textContent = "Ver historico";

  actions.appendChild(toggleButton);
  actions.appendChild(clearButton);
  actions.appendChild(historyButton);

  expandedView.appendChild(header);
  expandedView.appendChild(actions);

  content.appendChild(compactView);
  content.appendChild(expandedView);

  card.appendChild(accent);
  card.appendChild(content);
  document.body.appendChild(card);

  const applyEnabledState = (enabled: boolean): void => {
    currentEnabled = enabled;
    card.dataset.enabled = String(enabled);
    statusPill.textContent = enabled ? "ON" : "OFF";
    statusPill.className = `zen-state-card__pill ${enabled ? "is-on" : "is-off"}`;
    compactState.textContent = enabled ? "ON" : "OFF";
    compactState.className = `zen-state-card__state-value ${enabled ? "is-on" : "is-off"}`;
  };

  const clampToViewport = async (position: CardPosition): Promise<void> => {
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

  const applyMinimizedState = async (minimized: boolean): Promise<void> => {
    currentMinimized = minimized;
    card.dataset.minimized = String(minimized);
    minimizeButton.textContent = minimized ? "Maximizar" : "Minimizar";
    compactButton.textContent = "Maximizar";

    await savePreferences({ position: currentPosition, minimized: currentMinimized });
    await clampToViewport(currentPosition);
  };

  const startDrag = (event: PointerEvent): void => {
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

    const onPointerMove = (moveEvent: PointerEvent): void => {
      card.classList.add("is-dragging");
      const nextLeft = clamp(moveEvent.clientX - offsetX, 8, Math.max(8, window.innerWidth - rect.width - 8));
      const nextTop = clamp(moveEvent.clientY - offsetY, 8, Math.max(8, window.innerHeight - rect.height - 8));
      currentPosition = { left: nextLeft, top: nextTop };
      card.style.left = `${nextLeft}px`;
      card.style.top = `${nextTop}px`;
    };

    const onPointerUp = async (): Promise<void> => {
      card.classList.remove("is-dragging");
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      await savePreferences({ position: currentPosition, minimized: currentMinimized });
      showToast("Posicao do card salva.", "ok");
    };

    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
  };

  header.addEventListener("pointerdown", startDrag);
  compactView.addEventListener("pointerdown", startDrag);

  minimizeButton.addEventListener("click", event => {
    event.stopPropagation();
    void applyMinimizedState(!currentMinimized);
  });

  compactButton.addEventListener("click", event => {
    event.stopPropagation();
    void applyMinimizedState(false);
  });

  toggleButton.addEventListener("click", async event => {
    event.stopPropagation();
    try {
      const enabled = await toggleExtensionState();
      applyEnabledState(enabled);
      showToast(enabled ? "Extensao ativada" : "Extensao desativada", "ok");
    } catch (error) {
      showToast(`Falha ao alternar estado: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  });

  clearButton.addEventListener("click", async event => {
    event.stopPropagation();
    try {
      const ok = await clearHistoryFromBackground();
      showToast(ok ? "Historico limpo" : "Nao foi possivel limpar historico", ok ? "ok" : "error");
    } catch (error) {
      showToast(`Falha ao limpar historico: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  });

  historyButton.addEventListener("click", event => {
    event.stopPropagation();
    const historyUrl = chrome.runtime.getURL("src/4.0_ui/popup.html");
    const opened = window.open(historyUrl, "_blank", "noopener,noreferrer,width=420,height=640");
    if (!opened) {
      showToast("Nao foi possivel abrir o historico.", "error");
    }
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

const registerKeyboardShortcut = (): void => {
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

const bootstrap = async (): Promise<void> => {
  await initExtensionState();
  initNetworkMonitor();
  await createFloatingStateCard();
  registerKeyboardShortcut();
  initStatusMonitor();
};

if (document.readyState === "complete" || document.readyState === "interactive") {
  void bootstrap();
} else {
  document.addEventListener("DOMContentLoaded", () => {
    void bootstrap();
  }, { once: true });
}
