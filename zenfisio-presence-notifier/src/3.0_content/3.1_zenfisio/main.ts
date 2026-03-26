import { initExtensionState, onStateChange, toggleExtensionState } from "./extensionState.js";
import { clearHistoryFromBackground } from "./messaging.js";
import { showToast } from "./notifications.js";
import { initStatusMonitor } from "./statusMonitor.js";

const createFloatingStateChip = (): void => {
  const chip = document.createElement("div");
  chip.id = "zen-state-chip";
  chip.style.cssText = [
    "position:fixed",
    "top:12px",
    "right:12px",
    "z-index:2147483647",
    "display:flex",
    "align-items:center",
    "gap:8px",
    "padding:8px 10px",
    "border-radius:999px",
    "font-family:Segoe UI, Arial, sans-serif",
    "font-size:12px",
    "font-weight:700",
    "color:#fff",
    "background:#7a1f1f",
    "box-shadow:0 8px 18px rgba(0,0,0,0.24)"
  ].join(";");

  const label = document.createElement("span");
  label.textContent = "Notifier: OFF";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "Toggle";
  toggle.style.cssText = [
    "border:none",
    "border-radius:8px",
    "padding:4px 8px",
    "cursor:pointer",
    "font-size:11px",
    "font-weight:700"
  ].join(";");

  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "Limpar cache";
  clear.style.cssText = toggle.style.cssText;

  const applyState = (enabled: boolean): void => {
    label.textContent = enabled ? "Notifier: ON" : "Notifier: OFF";
    chip.style.background = enabled ? "#1f7a3f" : "#7a1f1f";
  };

  onStateChange(value => applyState(value));

  toggle.addEventListener("click", async event => {
    event.stopPropagation();
    try {
      const enabled = await toggleExtensionState();
      applyState(enabled);
      showToast(enabled ? "Extensao ativada" : "Extensao desativada", "ok");
    } catch (error) {
      showToast(`Falha ao alternar estado: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  });

  clear.addEventListener("click", async event => {
    event.stopPropagation();
    try {
      const ok = await clearHistoryFromBackground();
      showToast(ok ? "Historico limpo" : "Nao foi possivel limpar historico", ok ? "ok" : "error");
    } catch (error) {
      showToast(`Falha ao limpar historico: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  });

  chip.appendChild(label);
  chip.appendChild(toggle);
  chip.appendChild(clear);

  document.body.appendChild(chip);
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
  createFloatingStateChip();
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
