import { MESSAGE_TYPES } from "../shared/constants.js";
import type { HistoryEntry } from "../shared/types.js";

type LastErrorInfo = {
  message: string;
  occurredAtIso: string;
};

type StateResponse = {
  enabled: boolean;
  lastError?: LastErrorInfo | null;
};

const byId = <TElement extends HTMLElement>(id: string): TElement => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Elemento nao encontrado: ${id}`);
  }
  return element as TElement;
};

const request = <TResponse = unknown>(message: unknown): Promise<TResponse> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response as TResponse);
    });
  });
};

const renderHistory = (items: HistoryEntry[]): void => {
  const list = byId<HTMLDivElement>("list");
  list.replaceChildren();

  if (!items.length) {
    list.textContent = "Nenhum envio registrado.";
    return;
  }

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "item";

    const info = document.createElement("div");
    const statusLabel = item.statusKind === "confirmed"
      ? "✅ Chegou"
      : item.statusKind === "missed"
        ? "🛑 FALTOU"
        : "❌ DESMARCAÇÃO";

    const patientName = document.createElement("strong");
    patientName.textContent = item.patientName;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${item.dateKey} - ${statusLabel}`;

    info.appendChild(patientName);
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "actions";

    const todayBtn = document.createElement("button");
    todayBtn.className = "mini";
    todayBtn.textContent = "Remover dia";
    todayBtn.addEventListener("click", async () => {
      await request({
        type: MESSAGE_TYPES.HISTORY_REMOVE,
        payload: { patientKey: item.patientKey, dateKey: item.dateKey }
      });
      await refresh();
    });

    const allBtn = document.createElement("button");
    allBtn.className = "mini";
    allBtn.textContent = "Remover tudo";
    allBtn.addEventListener("click", async () => {
      await request({
        type: MESSAGE_TYPES.HISTORY_REMOVE,
        payload: { patientKey: item.patientKey, removeAll: true }
      });
      await refresh();
    });

    actions.appendChild(todayBtn);
    actions.appendChild(allBtn);

    row.appendChild(info);
    row.appendChild(actions);
    list.appendChild(row);
  }
};

const refreshState = async (): Promise<void> => {
  const state = await request<StateResponse>({ type: MESSAGE_TYPES.STATE_QUERY });
  const button = byId<HTMLButtonElement>("toggleBtn");
  button.textContent = state.enabled ? "Extensao ATIVADA" : "Extensao DESATIVADA";
  button.style.background = state.enabled ? "#1f7a3f" : "#7a1f1f";

  const lastError = byId<HTMLParagraphElement>("lastError");
  if (state.lastError?.message) {
    lastError.classList.add("has-error");
    lastError.textContent = `${state.lastError.occurredAtIso}: ${state.lastError.message}`;
  } else {
    lastError.classList.remove("has-error");
    lastError.textContent = "Sem erro recente.";
  }
};

const refreshHistory = async (): Promise<void> => {
  const response = await request<{ ok: boolean; list: HistoryEntry[] }>({ type: MESSAGE_TYPES.HISTORY_LIST });
  if (!response?.ok) {
    byId<HTMLDivElement>("list").textContent = "Falha ao carregar historico.";
    return;
  }

  renderHistory(response.list || []);
};

const refresh = async (): Promise<void> => {
  await Promise.all([refreshState(), refreshHistory()]);
};

document.addEventListener("DOMContentLoaded", () => {
  byId<HTMLButtonElement>("toggleBtn").addEventListener("click", async () => {
    await request({ type: MESSAGE_TYPES.STATE_TOGGLE });
    await refreshState();
  });

  byId<HTMLButtonElement>("clearBtn").addEventListener("click", async () => {
    const confirmed = window.confirm("Deseja limpar todo o historico?");
    if (!confirmed) {
      return;
    }

    await request({ type: MESSAGE_TYPES.HISTORY_CLEAR });
    await refreshHistory();
  });

  byId<HTMLButtonElement>("openZenfisioBtn").addEventListener("click", async () => {
    await request({ type: MESSAGE_TYPES.OPEN_ZENFISIO });
  });

  byId<HTMLButtonElement>("openChatBtn").addEventListener("click", async () => {
    await request({ type: MESSAGE_TYPES.OPEN_CHAT });
  });

  byId<HTMLButtonElement>("testChatBtn").addEventListener("click", async () => {
    const response = await request<{ ok: boolean; error?: string }>({ type: MESSAGE_TYPES.CHAT_TEST });
    if (!response.ok && response.error) {
      byId<HTMLParagraphElement>("lastError").textContent = response.error;
    }
    await refreshState();
  });

  void refresh();
});
